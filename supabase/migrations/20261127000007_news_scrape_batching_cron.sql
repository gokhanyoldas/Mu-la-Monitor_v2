-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — news-scrape toplu çalıştırma (P1)
--
-- Sorun: news-scrape ~43 kaynağı tek çağrıda sırayla çekiyordu; her kaynak
--        12 sn'ye kadar sürebildiğinden çağrı edge function duvar-saati
--        sınırını aşabiliyor ve zaman aşımına düşebiliyordu.
--
-- Çözüm: Kaynakları 4 gruba (A/B/C/D) bölen batch modu. Eski tek 'news-scrape'
--        job'ı kaldırılır; yerine 15 dakikalık döngü içinde birer 3-4 dk
--        kaydırılmış 4 job kurulur. Böylece her kaynak yine ~15 dk'da bir
--        taranır ama her çağrı yalnızca ~11 kaynak işler.
--
-- Not: Uç nokta ?batch= parametresi verilmezse tüm kaynakları işler
--      (geriye dönük uyumluluk), bu nedenle eski job MUTLAKA kaldırılmalıdır.
-- ═══════════════════════════════════════════════════════════════════════════

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
    -- Eski tek toplu job'ı kaldır (aksi halde tüm kaynaklar iki kez çekilir)
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname IN ('news-scrape', 'news-scrape-a', 'news-scrape-b', 'news-scrape-c', 'news-scrape-d');

    -- Her batch 15 dk'da bir, 3-4 dk kaydırılmış olarak çalışır
    PERFORM cron.schedule('news-scrape-a', '0-59/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/news-scrape?batch=A', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('news-scrape-b', '3-59/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/news-scrape?batch=B', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('news-scrape-c', '7-59/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/news-scrape?batch=C', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));

    PERFORM cron.schedule('news-scrape-d', '11-59/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/news-scrape?batch=D', headers := %s, body := '{}'::jsonb);$cmd$,
      v_auth_headers
    ));
  END IF;
END $$;
