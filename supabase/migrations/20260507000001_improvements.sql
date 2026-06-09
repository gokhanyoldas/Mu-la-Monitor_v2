-- Migration: Additional improvements (2026-05-07)

-- Add sentiment analysis columns to social_posts
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS sentiment_confidence REAL;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS sentiment_method TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Source reliability: ensure columns & unique constraint
ALTER TABLE source_reliability ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE source_reliability ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE source_reliability ADD COLUMN IF NOT EXISTS total_posts INTEGER DEFAULT 0;
DO $$ BEGIN
  CREATE UNIQUE INDEX idx_source_reliability_unique ON source_reliability(platform, source_name);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Protocol changes tracking table
CREATE TABLE IF NOT EXISTS protocol_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  old_name TEXT,
  new_name TEXT NOT NULL,
  social_url TEXT,
  social_source TEXT,
  detected_at TIMESTAMPTZ DEFAULT now(),
  confirmed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_protocol_changes_date ON protocol_changes(detected_at DESC);
ALTER TABLE protocol_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read protocol changes" ON protocol_changes FOR SELECT USING (true);
