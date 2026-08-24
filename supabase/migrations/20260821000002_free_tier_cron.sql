-- Free-tier geçişi: pahalı Twitter/X API job'ını kaldır; X/yerel sinyal üretimini
-- sıfır maliyetli mock-data-injector + news-scrape RSS akışı devralır.
-- pg_cron jobları idempotent yeniden-yazıldı (yeniden uygulamada üst üste gelmez).

select cron.unschedule(jobid) from cron.job where jobname = 'twitter-collect';

-- Kullanıcı tercihi: otomatik demo veri üretimi yok — 'social-feed' cron'u
-- bilinçli olarak kurulmuyor; mock-data-injector yalnızca UI'daki
-- DemoDataButton ile manuel tetiklenir. Sosyal akış news-scrape RSS'inden gelir.
select cron.unschedule(jobid) from cron.job where jobname = 'social-feed';
