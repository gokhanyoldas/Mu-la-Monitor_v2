-- ============================================================================
-- Muğla Monitör v2 — Günlük Muğla Gündem Bülteni (08:30) Abonelik Tablosu
-- Her kullanıcı RLS üzerinden yalnızca kendi abonelik kaydını okuyup güncelleyebilir.
-- ============================================================================

create table if not exists public.newsletter_subscribers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users(id) on delete cascade,
  email              text not null check (length(trim(email)) > 3 and position('@' in email) > 1),
  subscribed         boolean not null default false,
  preferred_language text not null default 'tr' check (preferred_language in ('tr', 'en')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_user_id_uidx
  on public.newsletter_subscribers (user_id);

create index if not exists newsletter_subscribers_subscribed_idx
  on public.newsletter_subscribers (subscribed)
  where subscribed = true;

-- updated_at sütununu güncelleme anında otomatik yenile (SECURITY INVOKER + sabit search_path)
create or replace function public.set_newsletter_subscribers_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger trg_newsletter_subscribers_updated_at
  before update on public.newsletter_subscribers
  for each row
  execute function public.set_newsletter_subscribers_updated_at();

-- Row Level Security (RLS) ve en az yetki ilkesi
alter table public.newsletter_subscribers enable row level security;

revoke all on table public.newsletter_subscribers from public, anon;
grant select, insert, update, delete on table public.newsletter_subscribers to authenticated;
grant all on table public.newsletter_subscribers to service_role;

drop policy if exists "newsletter_subscribers_owner_select" on public.newsletter_subscribers;
create policy "newsletter_subscribers_owner_select"
  on public.newsletter_subscribers
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "newsletter_subscribers_owner_insert" on public.newsletter_subscribers;
create policy "newsletter_subscribers_owner_insert"
  on public.newsletter_subscribers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "newsletter_subscribers_owner_update" on public.newsletter_subscribers;
create policy "newsletter_subscribers_owner_update"
  on public.newsletter_subscribers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "newsletter_subscribers_owner_delete" on public.newsletter_subscribers;
create policy "newsletter_subscribers_owner_delete"
  on public.newsletter_subscribers
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.newsletter_subscribers is
  'Günlük Muğla Gündem Bülteni (08:30) kullanıcı abonelik tercihleri (strict RLS: auth.uid() = user_id)';
