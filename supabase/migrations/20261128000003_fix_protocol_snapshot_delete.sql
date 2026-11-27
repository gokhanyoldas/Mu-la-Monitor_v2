-- The PostgREST `authenticator` role preloads the `safeupdate` library
-- (`session_preload_libraries = supautils, safeupdate`), so any DELETE executed
-- through PostgREST — including statements inside an RPC — must carry a WHERE
-- clause. The original snapshot-replace function used an unfiltered DELETE and
-- was rejected with "DELETE requires a WHERE clause". `id` is the primary key,
-- so `where id is not null` is equivalent and satisfies safeupdate.
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

  delete from public.protocol_members where id is not null;
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
