-- Free-tier geçişi: pahalı Twitter/X API job'ını kaldır; X/yerel sinyal üretimini
-- sıfır maliyetli mock-data-injector + news-scrape RSS akışı devralır.
-- pg_cron jobları idempotent yeniden-yazıldı (yeniden uygulamada üst üste gelmez).

select cron.unschedule(jobid) from cron.job where jobname = 'twitter-collect';

select cron.unschedule(jobid) from cron.job where jobname = 'social-feed';
select cron.schedule('social-feed', '*/15 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/mock-data-injector',
    headers := ('{"Authorization":"Bearer ' || current_setting('app.anon_key', true) || '","Content-Type":"application/json"}')::jsonb,
    body := '{"perDistrict":6,"hours":24}'::jsonb
  ); $$);
