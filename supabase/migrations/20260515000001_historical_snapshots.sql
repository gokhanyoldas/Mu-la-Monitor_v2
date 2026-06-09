-- Madde 5: Tarihsel veri karşılaştırma
-- Günlük anlık görüntü tablosu (Supabase Postgres)

create table if not exists public.historical_snapshots (
  id            bigserial primary key,
  snapshot_date date        not null,
  category      text        not null,  -- 'weather', 'economy', 'social', 'tourism', 'environment'
  metric_key    text        not null,  -- e.g. 'temperature', 'unemployment_rate', 'post_count_positive'
  value_num     numeric,               -- numeric value
  value_text    text,                  -- text value (when non-numeric)
  unit          text,                  -- '°C', '%', 'adet', etc.
  source        text,                  -- source identifier
  created_at    timestamptz default now()
);

-- Unique constraint: one snapshot per metric per day
create unique index if not exists historical_snapshots_date_category_key
  on public.historical_snapshots (snapshot_date, category, metric_key);

-- Efficient querying by date range
create index if not exists historical_snapshots_date_idx
  on public.historical_snapshots (snapshot_date desc);

create index if not exists historical_snapshots_category_key_idx
  on public.historical_snapshots (category, metric_key, snapshot_date desc);

-- RLS: all authenticated users can read; only service role can insert
alter table public.historical_snapshots enable row level security;

create policy "public read" on public.historical_snapshots
  for select using (true);

create policy "service insert" on public.historical_snapshots
  for insert with check (true);

create policy "service upsert" on public.historical_snapshots
  for update using (true);

comment on table public.historical_snapshots is
  'Günlük metrik anlık görüntüleri — tarihsel karşılaştırma için';
