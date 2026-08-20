-- Migration: Yaşayan Şehir Veri Hattı (Live Pipeline)
-- 1) alert_events: kalıcı + realtime kritik olay akışı (deprem, yangın, anomali)
-- 2) anomaly_alerts: anomaly-scan edge function'ının ürettiği anomaliler
-- 3) Realtime publication: live_data_cache, alert_events, anomaly_alerts, ai_summaries
-- 4) capture_daily_snapshot(): live_data_cache -> historical_snapshots günlük aktarım
-- 5) pg_cron: periyodik veri yenileme, sosyal toplama, anomali taraması, snapshot

-- ── 1) alert_events ─────────────────────────────────────────────────────────
create table if not exists public.alert_events (
  id          bigint generated always as identity primary key,
  type        text not null,                    -- earthquake | fire | flood | crisis | social | system
  severity    text not null default 'info',     -- critical | high | medium | info
  title       text not null,
  body        text,
  source      text,
  lat         double precision,
  lon         double precision,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_alert_events_created on public.alert_events (created_at desc);
create index if not exists idx_alert_events_type on public.alert_events (type, created_at desc);

alter table public.alert_events enable row level security;

create policy "public read alert_events"
  on public.alert_events for select using (true);

create policy "service write alert_events"
  on public.alert_events for insert with check (true);

comment on table public.alert_events is
  'Kritik olay akışı — realtime broadcast ile anında dashboard''a düşer';

-- ── 2) anomaly_alerts ───────────────────────────────────────────────────────
create table if not exists public.anomaly_alerts (
  id           uuid primary key default gen_random_uuid(),
  severity     text not null check (severity in ('critical', 'warning', 'info')),
  category     text not null,                   -- weather | economy | environment | ...
  metric_key   text not null,                   -- e.g. 'temperature', 'usd_try', 'dam_occupancy'
  title        text not null,
  description  text,
  value_num    numeric,
  baseline_num numeric,                         -- 7 günlük ortalama (varsa)
  is_active    boolean not null default true,
  detected_at  timestamptz not null default now(),
  unique (category, metric_key)
);

create index if not exists idx_anomaly_alerts_active
  on public.anomaly_alerts (is_active, detected_at desc);

alter table public.anomaly_alerts enable row level security;

create policy "public read anomaly_alerts"
  on public.anomaly_alerts for select using (true);

create policy "service write anomaly_alerts"
  on public.anomaly_alerts for all using (true) with check (true);

comment on table public.anomaly_alerts is
  'anomaly-scan tarafından üretilen anomali kayıtları — category+metric_key başına tek aktif kayıt (upsert)';

-- ── 3) Realtime publication ────────────────────────────────────────────────
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['live_data_cache', 'alert_events', 'anomaly_alerts', 'ai_summaries'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ── 4) capture_daily_snapshot() ─────────────────────────────────────────────
-- live_data_cache'teki son değerleri historical_snapshots'a günlük metrik olarak işler.
create or replace function public.capture_daily_snapshot()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skaler metrikler (weather, air_quality, economy, dams, tourism)
  insert into public.historical_snapshots
    (snapshot_date, category, metric_key, value_num, unit, source)
  select current_date, s.category, s.metric_key, s.value_num, s.unit, 'live_data_cache'
  from (
    select 'weather' category, 'temperature' metric_key,
           (c.data->>'temperature')::numeric value_num, '°C' unit
    from public.live_data_cache c where c.data_type = 'weather'
    union all
    select 'weather', 'humidity', (c.data->>'humidity')::numeric, '%'
    from public.live_data_cache c where c.data_type = 'weather'
    union all
    select 'weather', 'windspeed', (c.data->>'windspeed')::numeric, 'km/h'
    from public.live_data_cache c where c.data_type = 'weather'
    union all
    select 'environment', 'aqi', (c.data->>'aqi')::numeric, 'EAQI'
    from public.live_data_cache c where c.data_type = 'air_quality'
    union all
    select 'environment', 'pm25', (c.data->>'pm25')::numeric, 'µg/m³'
    from public.live_data_cache c where c.data_type = 'air_quality'
    union all
    select 'economy', 'usd_try', (c.data->>'usd_try')::numeric, 'TRY'
    from public.live_data_cache c where c.data_type = 'economy'
    union all
    select 'economy', 'eur_try', (c.data->>'eur_try')::numeric, 'TRY'
    from public.live_data_cache c where c.data_type = 'economy'
    union all
    select 'environment', 'dam_occupancy', (c.data->>'avg_occupancy')::numeric, '%'
    from public.live_data_cache c where c.data_type = 'dams'
    union all
    select 'tourism', 'hotel_occupancy', (c.data->>'hotel_occupancy')::numeric, '%'
    from public.live_data_cache c where c.data_type = 'tourism'
  ) s
  where s.value_num is not null
  on conflict (snapshot_date, category, metric_key)
  do update set value_num = excluded.value_num, source = excluded.source;

  -- Deprem: gün içi olay sayısı + en büyük büyüklük
  insert into public.historical_snapshots
    (snapshot_date, category, metric_key, value_num, unit, source)
  select current_date, 'earthquakes', 'event_count',
         (c.data->>'count')::numeric, 'adet', 'live_data_cache'
  from public.live_data_cache c
  where c.data_type = 'earthquakes' and (c.data->>'count') is not null
  on conflict (snapshot_date, category, metric_key)
  do update set value_num = excluded.value_num, source = excluded.source;

  insert into public.historical_snapshots
    (snapshot_date, category, metric_key, value_num, unit, source)
  select current_date, 'earthquakes', 'max_magnitude',
         max((e->>'magnitude')::numeric), 'Mw', 'live_data_cache'
  from public.live_data_cache c,
       jsonb_array_elements(c.data->'earthquakes') e
  where c.data_type = 'earthquakes'
  group by c.id
  having max((e->>'magnitude')::numeric) is not null
  on conflict (snapshot_date, category, metric_key)
  do update set value_num = excluded.value_num, source = excluded.source;
end;
$$;

-- ── 5) pg_cron zamanlayıcıları ──────────────────────────────────────────────
-- Not: app.supabase_url ve app.anon_key ayarlarının tanımlı olması gerekir:
--   alter database postgres set app.supabase_url = 'https://<proje>.supabase.co';
--   alter database postgres set app.anon_key = '<anon-key>';

-- Hızlı katman: her 10 dk — hava, hava kalitesi, deprem
select cron.schedule('refresh-live-fast', '*/10 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"weather"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"air_quality"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"earthquakes"}'::jsonb);
$$);

-- Orta katman: her 30 dk — ekonomi, haber, trend, yol çalışması, trafik
select cron.schedule('refresh-live-medium', '*/30 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"economy"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"news"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"trends"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"road_works"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/reference-data',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"traffic_density"}'::jsonb);
$$);

-- Yavaş katman: 6 saatte bir — baraj, turizm, enerji, emlak
select cron.schedule('refresh-live-slow', '7 */6 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"dams"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"tourism"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"energy"}'::jsonb);
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/data-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"real_estate"}'::jsonb);
$$);

-- Referans katman: günde bir (06:15) — demografi, eğitim, sağlık vb.
select cron.schedule('refresh-reference', '15 6 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/reference-data',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := jsonb_build_object('type', t.type))
  from (values
    ('demographics'), ('education'), ('health'), ('agriculture'),
    ('gastronomy'), ('budget'), ('culture'), ('life_quality')
  ) as t(type);
$$);

-- Sosyal istihbarat toplama: 15 dk'da bir
select cron.schedule('social-cron-job', '*/15 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/social-cron',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{}'::jsonb);
$$);

-- Anomali taraması: 15 dk'da bir
select cron.schedule('anomaly-scan-job', '*/15 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/anomaly-scan',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{}'::jsonb);
$$);

-- Şehir Nabzı AI özeti: 6 saatte bir
select cron.schedule('ai-pulse-job', '5 */6 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/ai-summary',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"pulse"}'::jsonb);
$$);

-- Günlük snapshot: 23:55
select cron.schedule('daily-snapshot-job', '55 23 * * *', $$
  select public.capture_daily_snapshot();
$$);
