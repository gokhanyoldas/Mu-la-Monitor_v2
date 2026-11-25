-- Muğla Monitor: sosyal public collector + verifier otomasyonu
DO $$
DECLARE
  h jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-internal-secret', coalesce(current_setting('app.internal_function_secret', true), ''),
    'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.service_role_key', true), ''), nullif(current_setting('app.internal_function_secret', true), ''), '')
  );
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('muglamonitor-social-collect','muglamonitor-social-verifier');
    PERFORM cron.schedule('muglamonitor-social-collect', '*/15 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/social-collect', headers := %s, body := '{"platforms":["bluesky","mastodon","news","reddit"]}'::jsonb);$cmd$, h));
    PERFORM cron.schedule('muglamonitor-social-verifier', '7,27,47 * * * *', format(
      $cmd$SELECT net.http_post(url := current_setting('app.supabase_url', true) || '/functions/v1/social-verifier', headers := %s, body := '{"limit":100}'::jsonb);$cmd$, h));
  END IF;
END $$;
