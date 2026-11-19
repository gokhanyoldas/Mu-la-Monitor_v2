-- ============================================================================
-- Muğla Monitör v2 — LivingLexicon <-> public.social_keywords Schema Sync
-- Idempotent migration ensuring upsert({ onConflict: 'term' }) with
-- { term, layer, category, district, weight, is_learned, source_context, updated_at }
-- works seamlessly across authenticated analyst/user sessions and system seeds.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.social_keywords') IS NOT NULL THEN
    -- Allow system/admin seed rows without user_id (RLS checks auth.jwt() app_metadata.role)
    ALTER TABLE public.social_keywords ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE public.social_keywords ALTER COLUMN keyword DROP NOT NULL;

    ALTER TABLE public.social_keywords
      ADD COLUMN IF NOT EXISTS term TEXT,
      ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'field_jargon',
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS district TEXT,
      ADD COLUMN IF NOT EXISTS weight REAL DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS is_learned BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS source_context TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

    -- Backfill term from legacy keyword column if null
    UPDATE public.social_keywords
       SET term = keyword,
           updated_at = COALESCE(updated_at, created_at, now())
     WHERE term IS NULL
       AND keyword IS NOT NULL;

    -- Backfill keyword from term if legacy reads expect keyword
    UPDATE public.social_keywords
       SET keyword = term
     WHERE keyword IS NULL
       AND term IS NOT NULL;
  END IF;
END $$;

-- Ensure non-partial UNIQUE index/constraint on term for ON CONFLICT (term) upsert
DO $$
BEGIN
  IF to_regclass('public.social_keywords') IS NOT NULL THEN
    -- Remove duplicate terms keeping the newest row before creating unique index
    DELETE FROM public.social_keywords a
     USING public.social_keywords b
     WHERE a.id < b.id
       AND a.term IS NOT NULL
       AND a.term = b.term;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'social_keywords'
        AND indexname = 'idx_social_keywords_term_unique'
    ) THEN
      CREATE UNIQUE INDEX idx_social_keywords_term_unique
        ON public.social_keywords (term);
    END IF;
  END IF;
END $$;
