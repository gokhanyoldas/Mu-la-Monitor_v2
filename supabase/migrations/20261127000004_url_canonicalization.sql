-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — URL Kanonikleştirme (P0, dedupe)
-- Aynı haberin birden çok kaynakta (sendikasyon / Google News yönlendirmesi /
-- takip parametreleri) tekrar kaydedilmesini önlemek için normalize URL alanı.
--
-- Not: Kanonikleştirme mantığı edge fonksiyonlarında (supabase/functions/
--      _shared/url.ts → canonicalizeUrl) uygulanır; bu alan ingest sırasında
--      doldurulur ve yazımdan önce hızlı tekrar kontrolü için indekslenir.
--      Mevcut satırlar için tek seferlik backfill:
--        npm run backfill:canonical
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS url_canonical text;

COMMENT ON COLUMN public.social_posts.url_canonical IS
  'Normalize edilmiş URL (küçük harf host, www yok, takip parametreleri ve fragment temizlenmiş). Ingest sırasında doldurulur.';

-- Yazımdan önce tekrar kontrolü için kısmi indeks (yalnızca dolu değerler)
CREATE INDEX IF NOT EXISTS social_posts_url_canonical_idx
  ON public.social_posts (url_canonical)
  WHERE url_canonical IS NOT NULL;
