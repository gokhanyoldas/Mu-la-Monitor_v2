-- Keep old protocol snapshots usable if a source response is incomplete.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'protocol_changes' and column_name = 'title'
  ) then
    alter table public.protocol_changes alter column title drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'protocol_changes' and column_name = 'new_name'
  ) then
    alter table public.protocol_changes alter column new_name drop not null;
  end if;
end
$$;

alter table public.protocol_changes
  add column if not exists district text;

alter table public.protocol_members
  add column if not exists sira text not null default '';

-- Replace the roster atomically so an insert failure cannot leave an empty snapshot.
create or replace function public.replace_protocol_members_snapshot(p_members jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if coalesce(jsonb_typeof(p_members), '') <> 'array' then
    raise exception 'Protocol snapshot must be a JSON array';
  end if;
  if jsonb_array_length(p_members) < 350 then
    raise exception 'Protocol snapshot must contain at least 350 members';
  end if;
  if exists (
    select 1
    from (values
      ('Bodrum'), ('Datça'), ('Dalaman'), ('Fethiye'), ('Kavaklıdere'),
      ('Köyceğiz'), ('Marmaris'), ('Menteşe'), ('Milas'), ('Ortaca'),
      ('Seydikemer'), ('Ula'), ('Yatağan')
    ) as districts(name)
    where not exists (
      select 1
      from jsonb_to_recordset(p_members) as roster(district text, unvan text)
      where roster.district = districts.name
        and roster.unvan ilike '%Kaymakam%'
    )
  ) then
    raise exception 'Protocol snapshot is missing a district Kaymakam role';
  end if;

  delete from public.protocol_members;
  insert into public.protocol_members
    (isim, unvan, sira, kategori, telefon, faks, district)
  select
    coalesce(roster.isim, ''),
    coalesce(roster.unvan, ''),
    coalesce(roster.sira, ''),
    coalesce(roster.kategori, ''),
    coalesce(roster.telefon, ''),
    coalesce(roster.faks, ''),
    roster.district
  from jsonb_to_recordset(p_members) as roster(
    isim text,
    unvan text,
    sira text,
    kategori text,
    telefon text,
    faks text,
    district text
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_protocol_members_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.replace_protocol_members_snapshot(jsonb) to service_role;

-- A deterministic evidence key prevents repeat governance alerts when a scrape
-- is retried after the member snapshot has already changed.
create unique index if not exists alert_events_protocol_evidence_uidx
  on public.alert_events ((metadata ->> 'evidence_key'))
  where type = 'governance'
    and source = 'Protokol İzleme'
    and metadata ? 'evidence_key';

-- One row represents the latest successfully validated and stored snapshot.
create table if not exists public.protocol_scrape_status (
  id boolean primary key default true check (id is true),
  scraped_at timestamptz not null,
  member_count integer not null check (member_count >= 0),
  complete boolean not null default false,
  source text not null
);

alter table public.protocol_scrape_status enable row level security;

do $$
begin
  create policy protocol_scrape_status_read on public.protocol_scrape_status
    for select using (true);
exception when duplicate_object then null;
end
$$;

grant select on public.protocol_scrape_status to anon, authenticated, service_role;
