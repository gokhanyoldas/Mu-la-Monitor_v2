-- ============================================================================
-- Muğla Monitör v2 — Production Security Hardening Migration (Idempotent)
-- 1) Drop permissive / anon-writable RLS policies across all tables
-- 2) Enforce least-privilege RLS (anon = read-only public tables, auth = strict ownership / app_metadata.role)
-- 3) Convert SECURITY DEFINER functions -> SECURITY INVOKER + SET search_path = public + REVOKE/GRANT
-- 4) Set district_pulse view to security_invoker = true
-- 5) Re-schedule pg_cron jobs to pass x-internal-secret + service_role_key (never anon_key)
-- ============================================================================

-- ── 1) Tüm hedef tablolarda RLS'i etkinleştir ve güvensiz eski policy'leri temizle ──
DO $$
DECLARE
  v_tables text[] := ARRAY[
    'alert_events',
    'anomaly_alerts',
    'job_queue',
    'keyword_volume_snapshots',
    'live_data_cache',
    'ai_summaries',
    'social_posts',
    'social_collection_runs',
    'social_trends',
    'source_reliability',
    'historical_snapshots',
    'incidents',
    'districts',
    'protocol_members',
    'protocol_changes',
    'monitored_accounts',
    'news_sources',
    'email_alerts',
    'osint_searches',
    'social_keywords',
    'social_analyses',
    'user_preferences'
  ];
  v_table text;
  v_pol record;
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

      FOR v_pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_table
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_table);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ── 2) job_queue: Yalnızca service_role (Edge Functions). Public / anon / authenticated erişimi kapalı ──
DO $$
BEGIN
  IF to_regclass('public.job_queue') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.job_queue FROM PUBLIC, anon, authenticated;
    GRANT ALL ON TABLE public.job_queue TO service_role;
  END IF;
END $$;

-- ── 3) Salt-okunur açık pano tabloları (anon + authenticated yalnızca SELECT; yazma yalnızca service_role) ──
DO $$
DECLARE
  v_public_read_tables text[] := ARRAY[
    'alert_events',
    'anomaly_alerts',
    'keyword_volume_snapshots',
    'live_data_cache',
    'ai_summaries',
    'social_posts',
    'social_collection_runs',
    'source_reliability',
    'historical_snapshots',
    'districts',
    'protocol_members',
    'protocol_changes'
  ];
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY v_public_read_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM anon, authenticated', v_table);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        v_table || '_public_read',
        v_table
      );
    END IF;
  END LOOP;
END $$;

-- ── 4) incidents: Herkes okuyabilir; yalnızca gerçek kimliği doğrulanmış kullanıcı olay ekleyebilir ──
DO $$
BEGIN
  IF to_regclass('public.incidents') IS NOT NULL THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.incidents FROM anon, authenticated;
    REVOKE INSERT ON TABLE public.incidents FROM anon;

    CREATE POLICY "incidents_public_read"
      ON public.incidents FOR SELECT TO anon, authenticated
      USING (true);

    CREATE POLICY "incidents_authenticated_insert"
      ON public.incidents FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── 5) monitored_accounts & news_sources: Herkes okuyabilir, yalnızca admin/analyst yazabilir ──
DO $$
BEGIN
  IF to_regclass('public.monitored_accounts') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.monitored_accounts FROM anon;

    CREATE POLICY "monitored_accounts_public_read"
      ON public.monitored_accounts FOR SELECT TO anon, authenticated
      USING (true);

    CREATE POLICY "monitored_accounts_privileged_insert"
      ON public.monitored_accounts FOR INSERT TO authenticated
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));

    CREATE POLICY "monitored_accounts_privileged_update"
      ON public.monitored_accounts FOR UPDATE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'))
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));

    CREATE POLICY "monitored_accounts_privileged_delete"
      ON public.monitored_accounts FOR DELETE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));
  END IF;

  IF to_regclass('public.news_sources') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.news_sources FROM anon;

    CREATE POLICY "news_sources_public_read"
      ON public.news_sources FOR SELECT TO anon, authenticated
      USING (true);

    CREATE POLICY "news_sources_privileged_insert"
      ON public.news_sources FOR INSERT TO authenticated
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));

    CREATE POLICY "news_sources_privileged_update"
      ON public.news_sources FOR UPDATE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'))
      WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));

    CREATE POLICY "news_sources_privileged_delete"
      ON public.news_sources FOR DELETE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));
  END IF;
END $$;

-- ── 6) email_alerts & osint_searches: Anonim erişime kapalı; yalnızca kimliği doğrulanmış kullanıcılar ──
DO $$
BEGIN
  IF to_regclass('public.email_alerts') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.email_alerts FROM anon;

    CREATE POLICY "email_alerts_authenticated_read"
      ON public.email_alerts FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF to_regclass('public.osint_searches') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.osint_searches FROM anon;

    CREATE POLICY "osint_searches_authenticated_read"
      ON public.osint_searches FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);

    CREATE POLICY "osint_searches_admin_delete"
      ON public.osint_searches FOR DELETE TO authenticated
      USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'));
  END IF;
END $$;

-- ── 7) social_trends & social_keywords: Sistem satırları (user_id IS NULL) okunabilir, yazma sahiplik/rol kontrollü ──
DO $$
BEGIN
  IF to_regclass('public.social_trends') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.social_trends FROM anon;

    CREATE POLICY "social_trends_read_scope"
      ON public.social_trends FOR SELECT TO anon, authenticated
      USING (user_id IS NULL OR auth.uid() = user_id);

    CREATE POLICY "social_trends_owner_write"
      ON public.social_trends FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "social_trends_owner_update"
      ON public.social_trends FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "social_trends_owner_delete"
      ON public.social_trends FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF to_regclass('public.social_keywords') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.social_keywords FROM anon;

    CREATE POLICY "social_keywords_read_scope"
      ON public.social_keywords FOR SELECT TO anon, authenticated
      USING (user_id IS NULL OR auth.uid() = user_id);

    CREATE POLICY "social_keywords_auth_insert"
      ON public.social_keywords FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        OR (user_id IS NULL AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'))
      );

    CREATE POLICY "social_keywords_auth_update"
      ON public.social_keywords FOR UPDATE TO authenticated
      USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'))
      )
      WITH CHECK (
        auth.uid() = user_id
        OR (user_id IS NULL AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'))
      );

    CREATE POLICY "social_keywords_auth_delete"
      ON public.social_keywords FOR DELETE TO authenticated
      USING (
        auth.uid() = user_id
        OR (user_id IS NULL AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'analyst'))
      );
  END IF;
END $$;

-- ── 8) Kullanıcıya özel tablolar: user_preferences & social_analyses (sıkı auth.uid() = user_id) ──
DO $$
BEGIN
  IF to_regclass('public.social_analyses') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.social_analyses FROM anon;

    CREATE POLICY "social_analyses_owner_select"
      ON public.social_analyses FOR SELECT TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "social_analyses_owner_insert"
      ON public.social_analyses FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "social_analyses_owner_update"
      ON public.social_analyses FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "social_analyses_owner_delete"
      ON public.social_analyses FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF to_regclass('public.user_preferences') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.user_preferences FROM anon;

    CREATE POLICY "user_preferences_owner_select"
      ON public.user_preferences FOR SELECT TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "user_preferences_owner_insert"
      ON public.user_preferences FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "user_preferences_owner_update"
      ON public.user_preferences FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "user_preferences_owner_delete"
      ON public.user_preferences FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 9) SECURITY DEFINER fonksiyonlarını SECURITY INVOKER + search_path + REVOKE/GRANT ile sertleştir ──
DO $$
BEGIN
  IF to_regclass('public.job_queue') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.claim_jobs(p_limit int default 5)
    RETURNS SETOF public.job_queue
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public
    AS $fn$
    BEGIN
      IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
         AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Yetkisiz: claim_jobs yalnızca service_role tarafından çalıştırılabilir';
      END IF;

      RETURN QUERY
      UPDATE public.job_queue
         SET status = 'processing', attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM public.job_queue
          WHERE status = 'pending' AND run_after <= now()
          ORDER BY priority, run_after
          LIMIT GREATEST(1, LEAST(p_limit, 50))
          FOR UPDATE SKIP LOCKED
       )
      RETURNING *;
    END;
    $fn$;

    REVOKE ALL ON FUNCTION public.claim_jobs(int) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.claim_jobs(int) TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_similar_post' AND pronamespace = 'public'::regnamespace) THEN
    CREATE OR REPLACE FUNCTION public.find_similar_post(
      p_embedding vector(768),
      p_threshold double precision default 0.92
    )
    RETURNS TABLE (id uuid, similarity double precision)
    LANGUAGE plpgsql
    STABLE
    SECURITY INVOKER
    SET search_path = public
    AS $fn$
    BEGIN
      IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
         AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Yetkisiz: find_similar_post yalnızca service_role tarafından çalıştırılabilir';
      END IF;

      RETURN QUERY
      SELECT sp.id, 1 - (sp.embedding <=> p_embedding) AS similarity
        FROM public.social_posts sp
       WHERE sp.embedding IS NOT NULL
         AND sp.published_at > now() - interval '72 hours'
         AND 1 - (sp.embedding <=> p_embedding) >= p_threshold
       ORDER BY sp.embedding <=> p_embedding
       LIMIT 1;
    END;
    $fn$;

    REVOKE ALL ON FUNCTION public.find_similar_post(vector, double precision) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.find_similar_post(vector, double precision) TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.historical_snapshots') IS NOT NULL
     AND to_regclass('public.live_data_cache') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.capture_daily_snapshot()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public
    AS $fn$
    BEGIN
      IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
         AND COALESCE(auth.role(), '') <> 'service_role' THEN
        RAISE EXCEPTION 'Yetkisiz: capture_daily_snapshot yalnızca cron veya service_role tarafından çalıştırılabilir';
      END IF;

      INSERT INTO public.historical_snapshots
        (snapshot_date, category, metric_key, value_num, unit, source)
      SELECT current_date, s.category, s.metric_key, s.value_num, s.unit, 'live_data_cache'
      FROM (
        SELECT 'weather' category, 'temperature' metric_key, (c.data->>'temperature')::numeric value_num, '°C' unit
          FROM public.live_data_cache c WHERE c.data_type = 'weather'
        UNION ALL
        SELECT 'weather', 'humidity', (c.data->>'humidity')::numeric, '%'
          FROM public.live_data_cache c WHERE c.data_type = 'weather'
        UNION ALL
        SELECT 'weather', 'windspeed', (c.data->>'windspeed')::numeric, 'km/h'
          FROM public.live_data_cache c WHERE c.data_type = 'weather'
        UNION ALL
        SELECT 'environment', 'aqi', (c.data->>'aqi')::numeric, 'EAQI'
          FROM public.live_data_cache c WHERE c.data_type = 'air_quality'
        UNION ALL
        SELECT 'environment', 'pm25', (c.data->>'pm25')::numeric, 'µg/m³'
          FROM public.live_data_cache c WHERE c.data_type = 'air_quality'
        UNION ALL
        SELECT 'economy', 'usd_try', (c.data->>'usd_try')::numeric, 'TRY'
          FROM public.live_data_cache c WHERE c.data_type = 'economy'
        UNION ALL
        SELECT 'economy', 'eur_try', (c.data->>'eur_try')::numeric, 'TRY'
          FROM public.live_data_cache c WHERE c.data_type = 'economy'
        UNION ALL
        SELECT 'environment', 'dam_occupancy', (c.data->>'avg_occupancy')::numeric, '%'
          FROM public.live_data_cache c WHERE c.data_type = 'dams'
        UNION ALL
        SELECT 'tourism', 'hotel_occupancy', (c.data->>'hotel_occupancy')::numeric, '%'
          FROM public.live_data_cache c WHERE c.data_type = 'tourism'
      ) s
      WHERE s.value_num IS NOT NULL
      ON CONFLICT (snapshot_date, category, metric_key)
      DO UPDATE SET value_num = excluded.value_num, source = excluded.source;

      INSERT INTO public.historical_snapshots
        (snapshot_date, category, metric_key, value_num, unit, source)
      SELECT current_date, 'earthquakes', 'event_count',
             (c.data->>'count')::numeric, 'adet', 'live_data_cache'
      FROM public.live_data_cache c
      WHERE c.data_type = 'earthquakes' AND (c.data->>'count') IS NOT NULL
      ON CONFLICT (snapshot_date, category, metric_key)
      DO UPDATE SET value_num = excluded.value_num, source = excluded.source;

      INSERT INTO public.historical_snapshots
        (snapshot_date, category, metric_key, value_num, unit, source)
      SELECT current_date, 'earthquakes', 'max_magnitude',
             max((e->>'magnitude')::numeric), 'Mw', 'live_data_cache'
      FROM public.live_data_cache c,
           jsonb_array_elements(c.data->'earthquakes') e
      WHERE c.data_type = 'earthquakes'
      GROUP BY c.id
      HAVING max((e->>'magnitude')::numeric) IS NOT NULL
      ON CONFLICT (snapshot_date, category, metric_key)
      DO UPDATE SET value_num = excluded.value_num, source = excluded.source;
    END;
    $fn$;

    REVOKE ALL ON FUNCTION public.capture_daily_snapshot() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.capture_daily_snapshot() TO service_role;
  END IF;
END $$;

-- ── 10) district_pulse görünümünü security_invoker = true yap ──
DO $$
BEGIN
  IF to_regclass('public.district_pulse') IS NOT NULL THEN
    ALTER VIEW public.district_pulse SET (security_invoker = true);
    GRANT SELECT ON TABLE public.district_pulse TO anon, authenticated, service_role;
  END IF;
END $$;

-- ── 11) pg_cron job'larını anon_key yerine x-internal-secret + service_role_key ile güncelle ──
DO $$
DECLARE
  v_auth_headers text :=
    $$jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', coalesce(current_setting('app.internal_function_secret', true), ''),
      'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.service_role_key', true), ''), nullif(current_setting('app.internal_function_secret', true), ''), '')
    )$$;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'refresh-live-fast',
      'refresh-live-medium',
      'refresh-live-slow',
      'refresh-reference',
      'social-cron-job',
      'anomaly-scan-job',
      'ai-pulse-job',
      'ai-summary-job',
      'job-worker',
      'news-scrape',
      'spike-scan',
      'executive-report',
      'protocol-scrape',
      'refresh-traffic-live',
      'traffic-verify',
      'refresh-bus',
      'tourism-data-checker'
    );

    PERFORM cron.schedule('refresh-live-fast', '*/10 * * * *', format(
      $cmd$
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"weather"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"air_quality"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"earthquakes"}'::jsonb);
      $cmd$, v_auth_headers, v_auth_headers, v_auth_headers
    ));

    PERFORM cron.schedule('refresh-live-medium', '*/30 * * * *', format(
      $cmd$
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"economy"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"news"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"trends"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"road_works"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/reference-data', headers := %s, body := '{"type":"traffic_density"}'::jsonb);
      $cmd$, v_auth_headers, v_auth_headers, v_auth_headers, v_auth_headers, v_auth_headers
    ));

    PERFORM cron.schedule('refresh-live-slow', '7 */6 * * *', format(
      $cmd$
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"dams"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"tourism"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"energy"}'::jsonb);
      SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/data-scrape', headers := %s, body := '{"type":"real_estate"}'::jsonb);
      $cmd$, v_auth_headers, v_auth_headers, v_auth_headers, v_auth_headers
    ));

    PERFORM cron.schedule('refresh-reference', '15 6 * * *', format(
      $cmd$
      SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/reference-data',
        headers := %s,
        body := jsonb_build_object('type', t.type)
      )
      FROM (VALUES
        ('demographics'), ('education'), ('health'), ('agriculture'),
        ('gastronomy'), ('budget'), ('culture'), ('life_quality')
      ) AS t(type);
      $cmd$, v_auth_headers
    ));

    PERFORM cron.schedule('social-cron-job', '*/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/social-cron', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('anomaly-scan-job', '*/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/anomaly-scan', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('ai-pulse-job', '5 */6 * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/ai-summary', headers := %s, body := '{"type":"pulse"}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('ai-summary-job', '0 */6 * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/ai-summary', headers := %s, body := '{"type":"daily"}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('job-worker', '*/2 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/job-worker', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('news-scrape', '*/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/news-scrape', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('spike-scan', '*/10 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/spike-scan', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('executive-report', '0 7 * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/executive-report', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('protocol-scrape', '17 5 * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/protocol-scrape', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('refresh-traffic-live', '*/5 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/reference-data', headers := %s, body := '{"type":"traffic_density"}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('traffic-verify', '*/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/traffic-teyit', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('refresh-bus', '*/30 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/transport-scrape', headers := %s, body := '{"type":"bus"}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('tourism-data-checker', '33 6 * * 1', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/tourism-data-checker', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));
  END IF;
END $$;
