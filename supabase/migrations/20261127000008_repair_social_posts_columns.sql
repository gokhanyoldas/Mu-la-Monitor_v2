-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — social_posts NLP/kalite kolon onarımı (20261127000008)
--
-- Sorun: 20260821000001_intelligence_platform migrasyonu üretim veritabanına
--        tam uygulanmamış; canlı social_posts tablosunda district, category,
--        sentiment_score, entities, lat, lon ve is_duplicate kolonları eksik
--        kalmıştı (job_queue ve keyword_volume_snapshots ise mevcut).
--
--        Bu kolonlar news-scrape, social-collect, twitter-collect,
--        mock-data-injector ve spike-scan tarafından yazılır/okunur; ayrıca
--        scripts/backfill-canonical-urls.mjs tekrarları işaretlemek için
--        is_duplicate kullanır. Eksiklik, toplayıcı upsert'lerini ve kanonik
--        URL backfill'ini bozuyordu.
--
-- Not: sentiment, sentiment_method, analyzed_at, region, keywords_matched,
--      url_canonical ve content_hash kolonları zaten mevcut.
--
-- Idempotent: tüm ifadeler "if not exists" ile korunmuştur; güvenle tekrar
--             çalıştırılabilir.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.social_posts
  add column if not exists district        text,
  add column if not exists category        text,
  add column if not exists sentiment_score double precision,
  add column if not exists entities        jsonb default '[]',
  add column if not exists lat             double precision,
  add column if not exists lon             double precision,
  add column if not exists is_duplicate    boolean default false;

-- Sorgu performansı: ilçe/kategori/sentiment filtreleri + tarih sıralaması
create index if not exists social_posts_district_idx  on public.social_posts (district);
create index if not exists social_posts_category_idx  on public.social_posts (category);
create index if not exists social_posts_sentiment_idx on public.social_posts (sentiment);
create index if not exists social_posts_pub_idx       on public.social_posts (published_at desc);
