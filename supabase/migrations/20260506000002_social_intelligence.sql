-- Social Intelligence Tables
-- Stores collected social posts and their sentiment analysis

-- Raw collected posts from various platforms
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL, -- 'news', 'reddit', 'eksisozluk', 'twitter'
  content TEXT NOT NULL,
  author TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  keywords_matched TEXT[] DEFAULT '{}',
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Sentiment analysis results
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  sentiment_confidence REAL,
  sentiment_method TEXT, -- 'ai', 'keyword'
  analyzed_at TIMESTAMPTZ,
  
  -- Deduplication
  content_hash TEXT GENERATED ALWAYS AS (md5(platform || ':' || content)) STORED,
  UNIQUE(content_hash)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_sentiment ON social_posts(sentiment);
CREATE INDEX IF NOT EXISTS idx_social_posts_collected_at ON social_posts(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_published_at ON social_posts(published_at DESC);

-- Social collection runs (tracking)
CREATE TABLE IF NOT EXISTS social_collection_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  platforms_queried TEXT[] DEFAULT '{}',
  keywords_used TEXT[] DEFAULT '{}',
  posts_collected INTEGER DEFAULT 0,
  posts_analyzed INTEGER DEFAULT 0,
  errors TEXT[],
  status TEXT DEFAULT 'running' -- 'running', 'completed', 'failed'
);

-- Enable RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_collection_runs ENABLE ROW LEVEL SECURITY;

-- Allow public read (anon key)
CREATE POLICY "Public read social_posts" ON social_posts FOR SELECT USING (true);
CREATE POLICY "Public read social_collection_runs" ON social_collection_runs FOR SELECT USING (true);

-- Allow service_role full access (for edge functions)
CREATE POLICY "Service insert social_posts" ON social_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update social_posts" ON social_posts FOR UPDATE USING (true);
CREATE POLICY "Service insert social_collection_runs" ON social_collection_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update social_collection_runs" ON social_collection_runs FOR UPDATE USING (true);
