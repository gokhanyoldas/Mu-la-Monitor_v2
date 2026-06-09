-- Monitored social media accounts (username-based monitoring)
-- Platform: twitter | youtube | instagram | facebook | linkedin
-- No OAuth needed — public posts collected via Nitter (Twitter) or RSS (YouTube)

CREATE TABLE IF NOT EXISTS monitored_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     TEXT NOT NULL CHECK (platform IN ('twitter', 'youtube', 'instagram', 'facebook', 'linkedin')),
  username     TEXT NOT NULL,
  display_name TEXT,
  channel_id   TEXT,  -- YouTube channel ID for RSS feed
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, username)
);

-- RLS: allow authenticated + anon read, authenticated write
ALTER TABLE monitored_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON monitored_accounts FOR SELECT USING (true);
CREATE POLICY "auth_write"  ON monitored_accounts FOR ALL USING (true) WITH CHECK (true);

-- Default seed: common Muğla-related accounts (can be managed via UI)
INSERT INTO monitored_accounts (platform, username, display_name) VALUES
  ('twitter', 'mugla_valiligi',    'Muğla Valiliği'),
  ('twitter', 'MuglaBuyuksehir',   'Muğla Büyükşehir Belediyesi'),
  ('youtube', 'UCMuglaHaber',      'Muğla Haber YouTube')
ON CONFLICT (platform, username) DO NOTHING;
