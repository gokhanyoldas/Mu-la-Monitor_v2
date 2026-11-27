-- Muğla Monitör v2: Merkezi canlı veri yazım köprüsü şeması ve Realtime yayını
-- Boş kalan monitor_data, districts, protocol_members, protocol_changes,
-- alert_events, ai_summaries ve live_data_cache tabloları için idempotent şema ve RLS.

-- 1. 11 ana sekmenin canlı metriklerini tutan monitor_data tablosu
CREATE TABLE IF NOT EXISTS public.monitor_data (
  id text PRIMARY KEY,
  tab_key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Önceden farklı kolonlarla oluşturulmuş boş bir monitor_data tablosu varsa eksik kolonları tamamla
ALTER TABLE public.monitor_data ADD COLUMN IF NOT EXISTS tab_key text;
ALTER TABLE public.monitor_data ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
ALTER TABLE public.monitor_data ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.monitor_data ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.monitor_data ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.monitor_data ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS monitor_data_tab_key_uidx
  ON public.monitor_data (tab_key)
  WHERE tab_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS monitor_data_updated_at_idx
  ON public.monitor_data (updated_at DESC);

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

-- 2. Tüm çekirdek tabloların Realtime yayınına dahil edildiğinden emin ol (idempotent)
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
