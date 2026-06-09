
-- Keywords table for tracking social media mentions
CREATE TABLE public.social_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'all', -- 'twitter', 'instagram', 'facebook', 'youtube', 'all'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Social media analysis results
CREATE TABLE public.social_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword_id UUID REFERENCES public.social_keywords(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  sentiment TEXT, -- 'positive', 'negative', 'neutral'
  sentiment_score NUMERIC(3,2),
  summary TEXT,
  source_url TEXT,
  source_author TEXT,
  engagement_count INTEGER DEFAULT 0,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trend snapshots
CREATE TABLE public.social_trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  platform TEXT NOT NULL,
  mention_count INTEGER DEFAULT 0,
  positive_ratio NUMERIC(3,2) DEFAULT 0,
  negative_ratio NUMERIC(3,2) DEFAULT 0,
  neutral_ratio NUMERIC(3,2) DEFAULT 0,
  top_topics TEXT[],
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_trends ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users manage own keywords" ON public.social_keywords FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own analyses" ON public.social_analyses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own trends" ON public.social_trends FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_social_analyses_keyword ON public.social_analyses(keyword_id);
CREATE INDEX idx_social_analyses_sentiment ON public.social_analyses(sentiment);
CREATE INDEX idx_social_trends_date ON public.social_trends(snapshot_date);
