-- ─────────────────────────────────────────────────────────────────────────────
-- OSINT Module: Username lookup history + results
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.osint_searches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  search_type  TEXT NOT NULL DEFAULT 'username',   -- 'username' | 'geo' | 'keyword'
  query        TEXT NOT NULL,                       -- the searched username/term
  results      JSONB,                               -- array of platform results
  platform_count INT DEFAULT 0,                    -- how many platforms found
  found_count  INT DEFAULT 0,                      -- confirmed hits
  searched_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS idx_osint_searches_query ON public.osint_searches(query);
CREATE INDEX IF NOT EXISTS idx_osint_searches_at    ON public.osint_searches(searched_at DESC);

ALTER TABLE public.osint_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read osint_searches"  ON public.osint_searches FOR SELECT USING (true);
CREATE POLICY "Public write osint_searches" ON public.osint_searches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete osint_searches" ON public.osint_searches FOR DELETE USING (true);
