-- Muğla Monitor: public sosyal kaynaklar, öğrenilen kelimeler ve çapraz doğrulama
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'public_feed',
  ADD COLUMN IF NOT EXISTS source_instance text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_score real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corroboration_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS social_posts_verification_idx
  ON public.social_posts (verification_status, verification_score DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_source_idx
  ON public.social_posts (platform, source_instance, published_at DESC);

CREATE TABLE IF NOT EXISTS public.social_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  social_post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  evidence_source text NOT NULL,
  evidence_url text,
  evidence_status text NOT NULL DEFAULT 'matched',
  score real NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_verification_events_post_idx
  ON public.social_verification_events (social_post_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS social_verification_events_source_idx
  ON public.social_verification_events (evidence_source, checked_at DESC);

ALTER TABLE public.social_verification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS social_verification_events_public_read ON public.social_verification_events;
CREATE POLICY social_verification_events_public_read
  ON public.social_verification_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS social_verification_events_service_write ON public.social_verification_events;
CREATE POLICY social_verification_events_service_write
  ON public.social_verification_events FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON COLUMN public.social_posts.source_type IS 'public_api, rss, official, monitored_account, manual';
COMMENT ON COLUMN public.social_posts.verification_status IS 'unverified, corroborating, corroborated, disputed';
COMMENT ON COLUMN public.social_posts.verification_score IS '0..1 cross-source confidence score';
