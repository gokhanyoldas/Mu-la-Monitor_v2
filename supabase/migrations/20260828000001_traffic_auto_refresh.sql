-- Canlı trafik otomatik tazeleme: TomTom verisi 30 saniyede güncellenir ve
-- reference-data traffic_density TTL'i 5 dk'dır. Bu cron her 5 dakikada bir
-- TomTom'tan güncel segment hızlarını çekip live_data_cache tablosunu günceller;
-- böylece panel, tarayıcı açık olmasa bile en güncel trafik yoğunluklarını gösterir
-- (frontend Realtime/poll ile bu cache'ten taze veriyi alır).
-- İdempotent: önce varsa aynı isimli job kaldırılır, sonra yeniden kurulur.

select cron.unschedule(jobid) from cron.job where jobname = 'refresh-traffic-live';

select cron.schedule('refresh-traffic-live', '*/5 * * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/reference-data',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || current_setting('app.anon_key')),
    body := '{"type":"traffic_density"}'::jsonb);
$$);