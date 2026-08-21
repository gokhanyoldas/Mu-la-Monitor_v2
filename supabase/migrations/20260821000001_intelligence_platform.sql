-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — Canlı Şehir İstihbarat Platformu
-- Modül 1-3: Veri toplama kuyruğu, NLP zenginleştirme, pgvector dedupe, RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── pgvector: bot/spam dedupe ve haber gruplama için embedding desteği ───
create extension if not exists vector;

-- ─── Modül 1: Dayanıklı arka plan iş kuyruğu (BullMQ yerine DB tabanlı) ───
-- Serverless ortamda Redis yok; aynı dayanıklılığı advisory-lock'lu kuyrukla
-- sağlıyoruz: kilitli işler atomik alınır, crash'te kilit düşer ve iş tekrar
-- denenir (attempts < max_attempts).
create table if not exists public.job_queue (
  id            bigint generated always as identity primary key,
  job_type      text not null,             -- 'twitter_fetch' | 'rss_fetch' | ...
  payload       jsonb not null default '{}',
  status        text not null default 'pending'
                check (status in ('pending','processing','done','failed')),
  priority      int  not null default 100, -- küçük = önce
  attempts      int  not null default 0,
  max_attempts  int  not null default 3,
  run_after     timestamptz not null default now(), -- rate-limit backoff
  last_error    text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index if not exists job_queue_pending_idx
  on public.job_queue (run_after, priority) where status = 'pending';

-- Atomik iş alma: aynı anda iki worker aynı işi alamaz
create or replace function public.claim_jobs(p_limit int default 5)
returns setof public.job_queue
language plpgsql security definer set search_path = public as $$
begin
  return query
  update job_queue
     set status = 'processing', attempts = attempts + 1
   where id in (
     select id from job_queue
      where status = 'pending' and run_after <= now()
      order by priority, run_after
      limit p_limit
      for update skip locked
   )
  returning *;
end;
$$;

-- ─── Modül 2: NLP zenginleştirme kolonları (sosyal + haber öğeleri) ───
alter table public.social_posts
  add column if not exists district     text,
  add column if not exists category     text,
  add column if not exists sentiment    text,
  add column if not exists sentiment_score double precision,
  add column if not exists entities     jsonb default '[]',
  add column if not exists lat          double precision,
  add column if not exists lon          double precision,
  add column if not exists embedding    vector(768),
  add column if not exists is_duplicate boolean default false,
  add column if not exists cluster_id   bigint;

create index if not exists social_posts_district_idx  on public.social_posts (district);
create index if not exists social_posts_category_idx  on public.social_posts (category);
create index if not exists social_posts_sentiment_idx on public.social_posts (sentiment);
create index if not exists social_posts_pub_idx       on public.social_posts (published_at desc);

-- Full-Text Search (Türkçe)
alter table public.social_posts
  add column if not exists fts tsvector
  generated always as (to_tsvector('turkish', coalesce(content,''))) stored;
create index if not exists social_posts_fts_idx on public.social_posts using gin (fts);

-- ─── Anomali: ani kelime hacmi sıçramaları (+300% / 1 saat) ───
create table if not exists public.keyword_volume_snapshots (
  id         bigint generated always as identity primary key,
  keyword    text not null,
  district   text,
  count      int  not null,
  window_end timestamptz not null default now()
);
create index if not exists kvs_keyword_time_idx
  on public.keyword_volume_snapshots (keyword, window_end desc);

-- ─── Modül 3: Vektör benzerliği ile dedupe ───
create or replace function public.find_similar_post(
  p_embedding vector(768), p_threshold double precision default 0.92
) returns table (id uuid, similarity double precision)
language sql stable security definer set search_path = public as $$
  select sp.id, 1 - (sp.embedding <=> p_embedding) as similarity
    from social_posts sp
   where sp.embedding is not null
     and sp.published_at > now() - interval '72 hours'
     and 1 - (sp.embedding <=> p_embedding) >= p_threshold
   order by sp.embedding <=> p_embedding
   limit 1;
$$;

-- ─── İlçe bazlı canlı özet görünümü (dashboard tek sorguyla) ───
create or replace view public.district_pulse as
select
  district,
  count(*)                                                        as post_count,
  count(*) filter (where sentiment = 'negative')                  as negative_count,
  count(*) filter (where sentiment = 'positive')                  as positive_count,
  avg(sentiment_score)                                            as avg_sentiment,
  count(*) filter (where category = 'fire_disaster')              as disaster_count,
  count(*) filter (where category = 'infrastructure_transport')   as infra_count,
  count(*) filter (where category = 'tourism')                    as tourism_count,
  count(*) filter (where category = 'governance')                 as governance_count,
  max(published_at)                                               as latest_at
from public.social_posts
where published_at > now() - interval '24 hours'
  and district is not null
  and is_duplicate = false
group by district;

-- ─── Güvenlik: RLS ───
alter table public.job_queue                enable row level security;
alter table public.keyword_volume_snapshots enable row level security;

-- job_queue sadece service role (edge function) erişir — public okuma yok
drop policy if exists "job_queue_service_only" on public.job_queue;
create policy "job_queue_service_only" on public.job_queue
  for all using (auth.role() = 'service_role');

drop policy if exists "kvs_read_all" on public.keyword_volume_snapshots;
create policy "kvs_read_all" on public.keyword_volume_snapshots
  for select using (true);

-- ─── Zamanlayıcılar (pg_cron) ───
create extension if not exists pg_cron;

-- Kuyruk işleyici her 2 dk
select cron.schedule('job-worker',       '*/2 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/job-worker',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body   := '{}'::jsonb
  ); $$) where not exists (select 1 from cron.job where jobname = 'job-worker');

-- Twitter toplama her 15 dk (rate-limit güvenli)
select cron.schedule('twitter-collect',  '*/15 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/twitter-collect',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body   := '{}'::jsonb
  ); $$) where not exists (select 1 from cron.job where jobname = 'twitter-collect');

-- Yerel haber/RSS her 15 dk
select cron.schedule('news-scrape',      '*/15 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/news-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body   := '{}'::jsonb
  ); $$) where not exists (select 1 from cron.job where jobname = 'news-scrape');

-- Ani sıçrama taraması her 10 dk
select cron.schedule('spike-scan',       '*/10 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/spike-scan',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body   := '{}'::jsonb
  ); $$) where not exists (select 1 from cron.job where jobname = 'spike-scan');

-- Günlük yönetici özeti her sabah 07:00
select cron.schedule('executive-report', '0 7 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/executive-report',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body   := '{}'::jsonb
  ); $$) where not exists (select 1 from cron.job where jobname = 'executive-report');
