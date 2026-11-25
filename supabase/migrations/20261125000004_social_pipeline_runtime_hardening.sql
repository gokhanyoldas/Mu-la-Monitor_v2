-- Muğla Monitor: runtime hardening for secret-safe cron and social persistence
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.social_posts
  ALTER COLUMN raw_metadata DROP NOT NULL;
ALTER TABLE public.social_posts
  ALTER COLUMN raw_metadata SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('muglamonitor-social-collect', 'muglamonitor-social-verifier');

  PERFORM cron.schedule(
    'muglamonitor-social-collect',
    '*/15 * * * *',
    $job$SELECT net.http_post(
      url := 'https://ntheudveohozxdjgcvif.supabase.co/functions/v1/social-collect',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET'),
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET')
      ),
      body := '{"platforms":["bluesky","mastodon","news","reddit"]}'::jsonb
    );$job$
  );

  PERFORM cron.schedule(
    'muglamonitor-social-verifier',
    '7,27,47 * * * *',
    $job$SELECT net.http_post(
      url := 'https://ntheudveohozxdjgcvif.supabase.co/functions/v1/social-verifier',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET'),
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_FUNCTION_SECRET')
      ),
      body := '{"limit":100}'::jsonb
    );$job$
  );
END $$;
