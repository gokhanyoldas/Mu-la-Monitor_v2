-- Muğla Monitor: Live Data Cache Table
-- Stores latest fetched values from edge functions to reduce API calls
-- and provide instant page-load data.

CREATE TABLE IF NOT EXISTS public.live_data_cache (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  data_type   text        NOT NULL UNIQUE,
  data        jsonb       NOT NULL,
  fetched_at  timestamptz DEFAULT now() NOT NULL,
  expires_at  timestamptz,
  source      text,
  error       text
);

-- RLS: public read, authenticated write (edge functions use service_role)
ALTER TABLE public.live_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on live_data_cache"
  ON public.live_data_cache FOR SELECT USING (true);

-- Useful index for type lookups
CREATE INDEX IF NOT EXISTS idx_live_data_cache_type ON public.live_data_cache (data_type);
CREATE INDEX IF NOT EXISTS idx_live_data_cache_fetched ON public.live_data_cache (fetched_at DESC);

-- Comment for documentation
COMMENT ON TABLE public.live_data_cache IS
  'Cache table for live data fetched by Supabase Edge Functions from free external APIs';
