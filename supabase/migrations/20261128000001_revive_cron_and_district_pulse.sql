-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — Zamanlayıcı canlandırma + district_pulse görünümü (P0)
-- Migration: 20261128000001
--
-- SORUN 1 — Sessiz zamanlayıcı arızası:
--   20261127000007_news_scrape_batching_cron.sql içindeki news-scrape-a/b/c/d
--   job'ları hedef URL'i current_setting('app.supabase_url') GUC'ından okuyordu.
--   Bu GUC üretim veritabanında TANIMLI DEĞİL → her turda
--   net.http_post(url := NULL ...) → "null value in column \"url\" of
--   relation \"http_request\"" hatası. Aynı şekilde belgelenen diğer pipeline
--   job'ları (refresh-live-*, refresh-traffic-live, spike-scan, executive-report,
--   protocol-scrape, tourism-data-checker, traffic-verify, refresh-bus,
--   job-worker, anomaly-scan, ai-summary) canlı cron.job listesinde HİÇ yoktu.
--   Sonuç: otonom veri hattı büyük ölçüde uykudaydı.
--
--   ÇÖZÜM: 20261125000003_social_pipeline_cron_vault.sql ile KANITLANMIŞ desen —
--   proje URL'i SABİT yazılır, sır çalışma anında Supabase Vault'tan okunur
--   (vault.decrypted_secrets → INTERNAL_FUNCTION_SECRET). Böylece app.* GUC
--   bağımlılığı tamamen kalkar ve sır hiçbir zaman SQL/metin olarak saklanmaz.
--
-- SORUN 2 — district_pulse görünümü yok:
--   20260821000001_intelligence_platform.sql üretime tam uygulanmadığı için
--   public.district_pulse hiç oluşmamıştı. executive-report ve city-briefing bu
--   görünümü okur; yokluğunda sessizce boş ilçe verisiyle AI raporu üretiyorlardı.
--   Görünüm, 13 ilçenin tamamını (aktivite olmasa bile sıfır değerlerle) döndürür.
--
-- Idempotent: job'lar önce unschedule edilip sonra yeniden kurulur; görünüm
--             create or replace ile yazılır. Güvenle tekrar çalıştırılabilir.
--
-- ÖN KOŞUL: Hedef Edge Functions deploy edilmiş olmalıdır —
--   news-scrape, data-scrape, reference-data, spike-scan, executive-report,
--   protocol-scrape, tourism-data-checker, traffic-teyit, transport-scrape,
--   job-worker, anomaly-scan, ai-summary.
--
-- NOT: Bu dosya yalnızca zamanlayıcı/görünüm tanımlar; hiçbir canlı DB yazımı
--      yapmaz. Uygulanması ayrı bir adımdır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) district_pulse görünümü (13 ilçe tam kapsam) ────────────────────────
-- Son 24 saatteki (tekrar olmayan) sosyal içeriklerin ilçe bazında özeti.
-- Canonical 13 ilçe listesi ile FULL JOIN: aktivitesi olmayan ilçeler de
-- sıfır değerlerle görünür; listelenen isimle eşleşmeyen (ör. NLP takma adı)
-- ilçe satırları da kaybolmaz — granülerlik bozulmadan korunur.
create or replace view public.district_pulse as
with canonical_districts(district) as (
  values
    ('Bodrum'), ('Datça'), ('Dalaman'), ('Fethiye'), ('Kavaklıdere'),
    ('Köyceğiz'), ('Marmaris'), ('Menteşe'), ('Milas'), ('Ortaca'),
    ('Seydikemer'), ('Ula'), ('Yatağan')
),
agg as (
  select
    sp.district,
    count(*)::int                                                         as post_count,
    count(*) filter (where sp.sentiment = 'negative')::int                as negative_count,
    count(*) filter (where sp.sentiment = 'positive')::int                as positive_count,
    avg(sp.sentiment_score)                                               as avg_sentiment,
    count(*) filter (where sp.category = 'fire_disaster')::int            as disaster_count,
    count(*) filter (where sp.category = 'infrastructure_transport')::int as infra_count,
    count(*) filter (where sp.category = 'tourism')::int                  as tourism_count,
    count(*) filter (where sp.category = 'governance')::int               as governance_count,
    max(sp.published_at)                                                  as latest_at
  from public.social_posts sp
  where sp.published_at > now() - interval '24 hours'
    and sp.district is not null
    and sp.is_duplicate = false
  group by sp.district
)
select
  coalesce(a.district, cd.district) as district,
  coalesce(a.post_count, 0)         as post_count,
  coalesce(a.negative_count, 0)     as negative_count,
  coalesce(a.positive_count, 0)     as positive_count,
  a.avg_sentiment                   as avg_sentiment,
  coalesce(a.disaster_count, 0)     as disaster_count,
  coalesce(a.infra_count, 0)        as infra_count,
  coalesce(a.tourism_count, 0)      as tourism_count,
  coalesce(a.governance_count, 0)   as governance_count,
  a.latest_at                       as latest_at
from agg a
full join canonical_districts cd on cd.district = a.district;

-- security_invoker: görünüm, sorgulayan rolün yetkileriyle çalışır (RLS
-- social_posts üzerinde uygulanır). Anon/auth/service yalnızca OKUYABİLİR.
alter view public.district_pulse set (security_invoker = true);

grant select on table public.district_pulse to anon, authenticated, service_role;

comment on view public.district_pulse is
  'Son 24 saat ilçe nabzı — 13 ilçe tam kapsam (aktivite yoksa sıfır). executive-report ve city-briefing tüketir.';

-- ─── 2) Pipeline cron job'ları (Vault deseni, sabit URL) ─────────────────────
do $cron$
declare
  v_url  constant text := 'https://ntheudveohozxdjgcvif.supabase.co/functions/v1';
  v_auth constant text := $h$jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'INTERNAL_FUNCTION_SECRET'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'INTERNAL_FUNCTION_SECRET')
    )$h$;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron yok; pipeline job''ları kurulmadı.';
    return;
  end if;

  -- Eski/bozuk job'ları temizle (idempotent; ayrıca kasıtlı kaldırılanları da
  -- garanti altına al: social-cron-job = social-collect ile çakışır,
  -- twitter-collect = free-tier geçişinde kaldırıldı).
  perform cron.unschedule(jobid)
    from cron.job
   where jobname in (
     'news-scrape', 'news-scrape-a', 'news-scrape-b', 'news-scrape-c', 'news-scrape-d',
     'refresh-live-fast', 'refresh-live-medium', 'refresh-live-slow', 'refresh-reference',
     'refresh-traffic-live', 'traffic-verify', 'refresh-bus',
     'job-worker', 'spike-scan', 'executive-report', 'protocol-scrape',
     'tourism-data-checker', 'anomaly-scan-job', 'ai-pulse-job', 'ai-summary-job',
     'social-cron-job', 'twitter-collect'
   );

  -- ▼ Haber kazıma: ~43 kaynak 4 gruba bölünmüş (A/B/C/D). Her kaynak yine
  --   ~15 dk'da bir taranır ama her çağrı yalnızca ~11 kaynak işler (duvar-saati
  --   zaman aşımını önler). Turlar 0/3/7/11. dakikaya kaydırılmıştır.
  perform cron.schedule('news-scrape-a', '0-59/15 * * * *', format(
    $j$select net.http_post(url := %L || '/news-scrape?batch=A', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  perform cron.schedule('news-scrape-b', '3-59/15 * * * *', format(
    $j$select net.http_post(url := %L || '/news-scrape?batch=B', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  perform cron.schedule('news-scrape-c', '7-59/15 * * * *', format(
    $j$select net.http_post(url := %L || '/news-scrape?batch=C', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  perform cron.schedule('news-scrape-d', '11-59/15 * * * *', format(
    $j$select net.http_post(url := %L || '/news-scrape?batch=D', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Hızlı katman (10 dk): hava, hava kalitesi, deprem
  perform cron.schedule('refresh-live-fast', '2-59/10 * * * *', format(
    $j$
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"weather"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"air_quality"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"earthquakes"}'::jsonb);
    $j$,
    v_url, v_auth, v_url, v_auth, v_url, v_auth));

  -- ▼ Orta katman (30 dk): ekonomi, haber, trend, yol çalışması.
  --   NOT: trafik yoğunluğu (reference-data traffic_density) buradan ÇIKARILDI;
  --   onu 5 dk'lık refresh-traffic-live job'ı zaten tazeliyor (çakışma önlendi).
  perform cron.schedule('refresh-live-medium', '16-59/30 * * * *', format(
    $j$
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"economy"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"news"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"trends"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"road_works"}'::jsonb);
    $j$,
    v_url, v_auth, v_url, v_auth, v_url, v_auth, v_url, v_auth));

  -- ▼ Yavaş katman (6 saatte bir): baraj, turizm, enerji, emlak
  perform cron.schedule('refresh-live-slow', '7 */6 * * *', format(
    $j$
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"dams"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"tourism"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"energy"}'::jsonb);
    select net.http_post(url := %L || '/data-scrape', headers := %s, body := '{"type":"real_estate"}'::jsonb);
    $j$,
    v_url, v_auth, v_url, v_auth, v_url, v_auth, v_url, v_auth));

  -- ▼ Referans katman (günde bir 06:15): demografi, eğitim, sağlık vb.
  perform cron.schedule('refresh-reference', '15 6 * * *', format(
    $j$select net.http_post(
         url := %L || '/reference-data',
         headers := %s,
         body := jsonb_build_object('type', t.type)
       )
       from (values
         ('demographics'), ('education'), ('health'), ('agriculture'),
         ('gastronomy'), ('budget'), ('culture'), ('life_quality')
       ) as t(type);$j$,
    v_url, v_auth));

  -- ▼ Canlı trafik yoğunluğu (5 dk): TomTom → live_data_cache
  perform cron.schedule('refresh-traffic-live', '*/5 * * * *', format(
    $j$select net.http_post(url := %L || '/reference-data', headers := %s, body := '{"type":"traffic_density"}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Trafik basın/AI teyidi (15 dk, 9. dakikaya kaydırılmış)
  perform cron.schedule('traffic-verify', '9-59/15 * * * *', format(
    $j$select net.http_post(url := %L || '/traffic-teyit', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Şehirlerarası otobüs seferleri (30 dk)
  perform cron.schedule('refresh-bus', '*/30 * * * *', format(
    $j$select net.http_post(url := %L || '/transport-scrape', headers := %s, body := '{"type":"bus"}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ İş kuyruğu işleyici (2 dk)
  perform cron.schedule('job-worker', '*/2 * * * *', format(
    $j$select net.http_post(url := %L || '/job-worker', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Kelime hacmi sıçrama taraması (10 dk)
  perform cron.schedule('spike-scan', '5-59/10 * * * *', format(
    $j$select net.http_post(url := %L || '/spike-scan', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Anomali taraması (15 dk, 13. dakikaya kaydırılmış)
  perform cron.schedule('anomaly-scan-job', '13-59/15 * * * *', format(
    $j$select net.http_post(url := %L || '/anomaly-scan', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Günlük yönetici özeti (07:00)
  perform cron.schedule('executive-report', '0 7 * * *', format(
    $j$select net.http_post(url := %L || '/executive-report', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Protokol listesi kazıma (günde bir 05:17)
  perform cron.schedule('protocol-scrape', '17 5 * * *', format(
    $j$select net.http_post(url := %L || '/protocol-scrape', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Turizm veri kontrolü (Pazartesi 06:33)
  perform cron.schedule('tourism-data-checker', '33 6 * * 1', format(
    $j$select net.http_post(url := %L || '/tourism-data-checker', headers := %s, body := '{}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Şehir Nabzı AI özeti (6 saatte bir, 05. dakika)
  perform cron.schedule('ai-pulse-job', '5 */6 * * *', format(
    $j$select net.http_post(url := %L || '/ai-summary', headers := %s, body := '{"type":"pulse"}'::jsonb);$j$,
    v_url, v_auth));

  -- ▼ Günlük AI özeti (6 saatte bir, 35. dakika — ai-pulse ile çakışmaz)
  perform cron.schedule('ai-summary-job', '35 */6 * * *', format(
    $j$select net.http_post(url := %L || '/ai-summary', headers := %s, body := '{"type":"daily"}'::jsonb);$j$,
    v_url, v_auth));
end
$cron$;
