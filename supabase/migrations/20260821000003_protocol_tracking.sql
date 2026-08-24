-- Protokol izleme: valilik + 13 kaymakamlık protokol listesi snapshot & değişiklik günlüğü
create table if not exists public.protocol_members (
  id          uuid primary key default gen_random_uuid(),
  isim        text not null,
  unvan       text not null,
  kategori    text not null default '',
  telefon     text not null default '',
  faks        text not null default '',
  district    text,                          -- Kaymakamlar/Belediye başkanları için ilgili ilçe
  updated_at  timestamptz not null default now()
);
create table if not exists public.protocol_changes (
  id          uuid primary key default gen_random_uuid(),
  change_type text not null check (change_type in ('added','removed','updated')),
  unvan       text not null,
  isim_old    text,
  isim_new    text,
  detail      text not null,
  scraped_at  timestamptz not null default now()
);
-- Mevcut eski protocol_changes şemasına uyum: eksikse kolon ekle
alter table public.protocol_changes add column if not exists scraped_at timestamptz not null default now();
alter table public.protocol_changes add column if not exists change_type text;
alter table public.protocol_changes add column if not exists unvan text;
alter table public.protocol_changes add column if not exists isim_old text;
alter table public.protocol_changes add column if not exists isim_new text;
alter table public.protocol_changes add column if not exists detail text;
create index if not exists protocol_changes_scraped_idx on public.protocol_changes (scraped_at desc);

alter table public.protocol_members enable row level security;
alter table public.protocol_changes enable row level security;
do $$ begin
  create policy protocol_members_read on public.protocol_members
    for select using (true);              -- kamu verisi: herkes okur
exception when duplicate_object then null; end $$;
do $$ begin
  create policy protocol_changes_read on public.protocol_changes
    for select using (true);
exception when duplicate_object then null; end $$;

-- Günde bir protokol taraması (değişiklikler alert_events'e düşer)
select cron.unschedule(jobid) from cron.job where jobname = 'protocol-scrape';
select cron.schedule('protocol-scrape', '17 5 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/protocol-scrape',
    headers := ('{"Authorization":"Bearer ' || current_setting('app.anon_key', true) || '","Content-Type":"application/json"}')::jsonb,
    body := '{}'::jsonb
  ); $$);
