-- Priority 4 & 5: Social Intelligence Enhancements
-- Fix existing social_keywords + add trends + source reliability

-- Add missing columns to social_keywords
ALTER TABLE social_keywords ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE social_keywords ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE social_keywords ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE social_keywords ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system';

-- Default keywords (insert only if empty)
INSERT INTO social_keywords (keyword, category, region) VALUES
  ('Muğla', 'general', NULL),
  ('Bodrum', 'general', 'Bodrum'),
  ('Fethiye', 'general', 'Fethiye'),
  ('Marmaris', 'general', 'Marmaris'),
  ('Datça', 'general', 'Datça'),
  ('Dalaman', 'general', 'Dalaman'),
  ('Milas', 'general', 'Milas'),
  ('Köyceğiz', 'general', 'Köyceğiz'),
  ('Ortaca', 'general', 'Ortaca'),
  ('Menteşe', 'general', 'Menteşe'),
  ('Yatağan', 'general', 'Yatağan'),
  ('yangın', 'crisis', NULL),
  ('deprem', 'crisis', NULL),
  ('sel', 'crisis', NULL),
  ('kaza', 'crisis', NULL),
  ('turizm', 'tourism', NULL),
  ('otel', 'tourism', NULL),
  ('tatil', 'tourism', NULL)
ON CONFLICT (keyword) DO NOTHING;

-- Trend data (time series for charts)
CREATE TABLE IF NOT EXISTS social_trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'hourly',
  platform TEXT,
  region TEXT,
  mention_count INTEGER DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  top_keywords TEXT[] DEFAULT '{}',
  avg_confidence REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_trends_period ON social_trends(period_start DESC, period_type);
CREATE INDEX IF NOT EXISTS idx_social_trends_region ON social_trends(region, period_type);

-- Source reliability tracking
CREATE TABLE IF NOT EXISTS source_reliability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  source_name TEXT NOT NULL,
  total_posts INTEGER DEFAULT 0,
  accurate_posts INTEGER DEFAULT 0,
  reliability_score REAL DEFAULT 0.5,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, source_name)
);

CREATE INDEX IF NOT EXISTS idx_source_reliability_score ON source_reliability(reliability_score DESC);

-- Add region column to social_posts for geographic tagging
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS idx_social_posts_region ON social_posts(region);

-- Enable RLS
ALTER TABLE social_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_reliability ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
  CREATE POLICY "Public read social_trends" ON social_trends FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service insert social_trends" ON social_trends FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public read source_reliability" ON source_reliability FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service upsert source_reliability" ON source_reliability FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Service update source_reliability" ON source_reliability FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS for social_keywords write access
DO $$ BEGIN
  CREATE POLICY "Public write social_keywords" ON social_keywords FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public update social_keywords" ON social_keywords FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public delete social_keywords" ON social_keywords FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
