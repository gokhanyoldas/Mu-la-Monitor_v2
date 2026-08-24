-- M15: Kullanıcı Tercihleri Tablosu
create table if not exists public.user_preferences (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create unique index if not exists user_preferences_user_id_idx
  on public.user_preferences (user_id);

alter table public.user_preferences enable row level security;

-- Users can only read/write their own preferences
DO $$ BEGIN
  CREATE POLICY "owner select" ON public.user_preferences
  for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner insert" ON public.user_preferences
  for insert with check (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner update" ON public.user_preferences
  for update using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "owner delete" ON public.user_preferences
  for delete using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

comment on table public.user_preferences is
  'Kullanıcı başına kişiselleştirme tercihleri (ilçe, sekme, gizli bölümler, kompakt mod)';
