-- Otobüs seferleri arka plan tazeleme: transport-scrape'i her 30 dakikada bir
-- çağırır; fonksiyon obilet.com + MUTTAŞ'tan veriyi çekip live_data_cache
-- (bus_schedule) içine yazar. Böylece ulaşım sekmesi her zaman en güncel
-- şehirlerarası/ilçe seferlerini gösterir (frontend Realtime/poll ile okur).
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-bus';

select cron.schedule('refresh-bus', '*/30 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/transport-scrape',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"bus"}'::jsonb);
$$);