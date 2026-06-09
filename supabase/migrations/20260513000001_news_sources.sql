-- News sources: manual newspaper/site entries for keyword-based tracking
CREATE TABLE IF NOT EXISTS public.news_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                        -- "Muğla Gazetesi"
  url TEXT NOT NULL,                         -- homepage URL
  rss_url TEXT,                              -- RSS feed URL (optional)
  category TEXT DEFAULT 'newspaper',         -- newspaper | blog | portal | agency
  region TEXT,                               -- district scope, null = all Muğla
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(url)
);

ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read news_sources"  ON public.news_sources FOR SELECT USING (true);
CREATE POLICY "Public write news_sources" ON public.news_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update news_sources" ON public.news_sources FOR UPDATE USING (true);
CREATE POLICY "Public delete news_sources" ON public.news_sources FOR DELETE USING (true);

-- Seed with well-known Muğla local news sources (verified RSS where possible)
INSERT INTO public.news_sources (name, url, rss_url, category, region) VALUES
  ('Muğla Gazetesi',      'https://www.muglagazetesi.com.tr',     'https://www.muglagazetesi.com.tr/rss.xml',           'newspaper', NULL),
  ('Bodrum Haber',         'https://www.bodrumhaber.com',           'https://www.bodrumhaber.com/feed/',                  'newspaper', 'Bodrum'),
  ('Fethiye Gazetesi',     'https://www.fethiyegazetesi.com.tr',    'https://www.fethiyegazetesi.com.tr/rss.xml',         'newspaper', 'Fethiye'),
  ('Marmaris Haber',       'https://www.marmarishaber.net',         'https://www.marmarishaber.net/feed/',                'newspaper', 'Marmaris'),
  ('Datça Haber',          'https://www.datcahaber.com',            NULL,                                                 'newspaper', 'Datça'),
  ('Milas Haber',          'https://www.milashaber.com',            NULL,                                                 'newspaper', 'Milas'),
  ('Söke Ekspres',         'https://www.sokeekspres.com',           'https://www.sokeekspres.com/feed/',                  'newspaper', NULL),
  ('Muğla Haberleri',      'https://www.muglahaberleri.com',        'https://www.muglahaberleri.com/feed/',               'portal',    NULL),
  ('Gazete Pencere',       'https://www.gazetepencere.com',         'https://gazetepencere.com/feed/',                    'newspaper', NULL)
ON CONFLICT (url) DO NOTHING;

-- Email alerts inbox: stores parsed Google Alerts / Talkwalker emails
CREATE TABLE IF NOT EXISTS public.email_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,          -- 'google_alerts' | 'talkwalker'
  alert_keyword TEXT,            -- tracked term from alert
  article_title TEXT NOT NULL,
  article_url TEXT,
  article_snippet TEXT,
  source_domain TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  email_received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed BOOLEAN DEFAULT false,     -- was it analyzed + inserted into social_posts?
  social_post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_alerts_source ON public.email_alerts(source);
CREATE INDEX IF NOT EXISTS idx_email_alerts_processed ON public.email_alerts(processed);
CREATE INDEX IF NOT EXISTS idx_email_alerts_received ON public.email_alerts(email_received_at DESC);

ALTER TABLE public.email_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read email_alerts"  ON public.email_alerts FOR SELECT USING (true);
CREATE POLICY "Public write email_alerts" ON public.email_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update email_alerts" ON public.email_alerts FOR UPDATE USING (true);
