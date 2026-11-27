-- Muğla Monitör v2: Canlı Supabase şemasıyla uyumlu monitor_data RLS ve Realtime yayını
-- Gerçek sütunlar: source, district_name, content, sentiment, category, created_at

CREATE TABLE IF NOT EXISTS public.monitor_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text,
  district_name text,
  content text NOT NULL DEFAULT '',
  sentiment text DEFAULT 'neutral',
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monitor_data_created_at_idx
  ON public.monitor_data (created_at DESC);

CREATE INDEX IF NOT EXISTS monitor_data_category_idx
  ON public.monitor_data (category);

ALTER TABLE public.monitor_data ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitor_data' AND policyname = 'Public read monitor_data'
  ) THEN
    CREATE POLICY "Public read monitor_data"
      ON public.monitor_data
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitor_data' AND policyname = 'Service role write monitor_data'
  ) THEN
    CREATE POLICY "Service role write monitor_data"
      ON public.monitor_data
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Çekirdek tabloların Realtime yayınına dahil edildiğinden emin ol (idempotent)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'monitor_data',
    'districts',
    'protocol_members',
    'protocol_changes',
    'alert_events',
    'ai_summaries',
    'live_data_cache'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;
