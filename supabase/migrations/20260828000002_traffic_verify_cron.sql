-- Trafik teyidi: TomTom tıkanıklığını basın/duyuru haberleriyle doğrular ve
-- kritik/anomali tıkanıklıkları üzerinde uyarı üretir. AI her 15 dakikada çağrılır
-- (maliyeti sınırlamak için 5 dk'lık TomTom tazelemesinden daha seyrek).
select cron.unschedule(jobid) from cron.job where jobname = 'traffic-verify';

select cron.schedule('traffic-verify', '*/15 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/traffic-teyit',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{}'::jsonb);
$$);