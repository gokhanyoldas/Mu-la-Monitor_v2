-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — Veri Yaşam Döngüsü Yönetimi (P0, Free Tier)
-- Amaç: Supabase Free Tier depolama limiti içinde kalmak için otomatik
--       rollup (günlük özet) + retention (budama) + compaction (VACUUM).
-- Prensip: ham satırlar budanmadan ÖNCE günlük özete aktarılır; böylece
--          geçmiş trendler dashboard'da kaybolmaz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) Günlük özet tablosu (kalıcı, çok küçük) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_posts_daily_rollup (
  day           date NOT NULL,
  platform      text NOT NULL DEFAULT '',
  district      text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT '',
  sentiment     text NOT NULL DEFAULT '',
  post_count    integer NOT NULL DEFAULT 0,
  avg_sentiment double precision,
  PRIMARY KEY (day, platform, district, category, sentiment)
);
CREATE INDEX IF NOT EXISTS social_rollup_day_idx
  ON public.social_posts_daily_rollup (day DESC);
CREATE INDEX IF NOT EXISTS social_rollup_district_idx
  ON public.social_posts_daily_rollup (district, day DESC);

COMMENT ON TABLE public.social_posts_daily_rollup IS
  'Ham social_posts satırları budandıktan sonra korunan günlük istatistik özeti';

-- ─── 2) Bakım çalışma kaydı (gözlemlenebilirlik) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_name    text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running',
  db_size_mb  numeric,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS maintenance_runs_job_idx
  ON public.maintenance_runs (job_name, started_at DESC);

-- ─── 3) RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.social_posts_daily_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read social_posts_daily_rollup"
    ON public.social_posts_daily_rollup FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service write social_posts_daily_rollup"
    ON public.social_posts_daily_rollup FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service only maintenance_runs"
    ON public.maintenance_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4) Retention + rollup fonksiyonu ──────────────────────────────────────
-- Tek çağrıda: rollup → budama → bakım kaydı. Idempotent (yeniden çalıştırılabilir).
CREATE OR REPLACE FUNCTION public.run_data_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size_mb     numeric;
  v_window_days integer;
  v_details     jsonb := '{}'::jsonb;
  v_n           integer;
  v_started     timestamptz := now();
BEGIN
  SELECT pg_total_relation_size('public.social_posts') / (1024.0 * 1024.0)
    INTO v_size_mb;

  -- Uyarlanabilir pencere: tablo büyüdükçe daha agresif budama (storage guard)
  v_window_days := CASE WHEN v_size_mb > 400 THEN 45 ELSE 90 END;

  -- (a) Ham sosyal verileri günlük özete aktar (yalnızca 30 günden eski kesim;
  --     ham veri saklama penceresi içinde tutulmaya devam eder)
  INSERT INTO public.social_posts_daily_rollup
    (day, platform, district, category, sentiment, post_count, avg_sentiment)
  SELECT
    COALESCE(published_at, collected_at)::date AS day,
    COALESCE(platform, '')  AS platform,
    COALESCE(district, '')  AS district,
    COALESCE(category, '')  AS category,
    COALESCE(sentiment, '') AS sentiment,
    COUNT(*)::int           AS post_count,
    AVG(sentiment_score)    AS avg_sentiment
  FROM public.social_posts
  WHERE COALESCE(published_at, collected_at) < now() - interval '30 days'
  GROUP BY 1, 2, 3, 4, 5
  ON CONFLICT (day, platform, district, category, sentiment)
  DO UPDATE SET
    post_count    = excluded.post_count,
    avg_sentiment = excluded.avg_sentiment;

  -- (b) Ham sosyal satırları buda (CASCADE: social_verification_events)
  DELETE FROM public.social_posts
   WHERE COALESCE(published_at, collected_at)
         < now() - make_interval(days => v_window_days);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{social_posts}', to_jsonb(v_n));

  DELETE FROM public.alert_events
   WHERE created_at < now() - interval '180 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{alert_events}', to_jsonb(v_n));

  DELETE FROM public.anomaly_alerts
   WHERE is_active = false AND detected_at < now() - interval '90 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{anomaly_alerts}', to_jsonb(v_n));

  DELETE FROM public.keyword_volume_snapshots
   WHERE window_end < now() - interval '14 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{keyword_volume_snapshots}', to_jsonb(v_n));

  DELETE FROM public.job_queue
   WHERE status IN ('done', 'failed')
     AND COALESCE(processed_at, created_at) < now() - interval '7 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{job_queue}', to_jsonb(v_n));

  DELETE FROM public.social_collection_runs
   WHERE COALESCE(completed_at, started_at) < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{social_collection_runs}', to_jsonb(v_n));

  DELETE FROM public.osint_searches
   WHERE searched_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{osint_searches}', to_jsonb(v_n));

  -- Süresi geçmiş canlı cache: her data_type için en yeni kayıt korunur
  -- (dashboard son bilinen değeri gösterebilsin diye)
  DELETE FROM public.live_data_cache
   WHERE expires_at < now()
     AND id NOT IN (
       SELECT DISTINCT ON (data_type) id
       FROM public.live_data_cache
       ORDER BY data_type, fetched_at DESC
     );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_details := jsonb_set(v_details, '{live_data_cache}', to_jsonb(v_n));

  INSERT INTO public.maintenance_runs
    (job_name, started_at, finished_at, status, db_size_mb, details)
  VALUES ('retention', v_started, now(), 'ok', v_size_mb, v_details);

  RETURN jsonb_build_object(
    'db_size_mb',   v_size_mb,
    'window_days',  v_window_days,
    'pruned',       v_details
  );
END;
$$;

-- Fonksiyon yalnızca arka plan (service_role/postgres) tarafından çağrılır
REVOKE ALL ON FUNCTION public.run_data_retention() FROM PUBLIC, anon, authenticated;

-- ─── 5) pg_cron zamanlayıcıları ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname IN ('muglamonitor-retention', 'muglamonitor-compact');

    -- Günlük retention + rollup (03:30)
    PERFORM cron.schedule(
      'muglamonitor-retention',
      '30 3 * * *',
      $job$SELECT public.run_data_retention();$job$
    );

    -- Haftalık compaction: toplu silme sonrası index/space toparlama (Pazar 04:00)
    PERFORM cron.schedule(
      'muglamonitor-compact',
      '0 4 * * 0',
      $job$
        VACUUM (ANALYZE) public.social_posts;
        VACUUM (ANALYZE) public.alert_events;
        VACUUM (ANALYZE) public.anomaly_alerts;
        VACUUM (ANALYZE) public.keyword_volume_snapshots;
        VACUUM (ANALYZE) public.job_queue;
        VACUUM (ANALYZE) public.live_data_cache;
      $job$
    );
  END IF;
END $$;
