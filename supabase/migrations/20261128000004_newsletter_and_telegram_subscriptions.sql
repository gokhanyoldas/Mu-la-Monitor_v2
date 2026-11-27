-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör v2 — KVKK/İYS Uyumlu Günlük Bülten & Telegram Abonelik Altyapısı
-- Migration: 20261128000004
--
-- AMAÇ
--   1) newsletter_subscribers : anonim, Çift Onaylı (double opt-in), KVKK/İYS
--      denetim kanıtı 3 yıl saklanacak şekilde İMMUTABLE abonelik kaydı.
--   2) telegram_subscribers   : isteğe bağlı ilçe bazlı Telegram uyarıları.
--   3) Sıkı RLS: bu tablolara doğrudan public SELECT/INSERT YOK. Tüm erişim
--      yalnızca SECURITY DEFINER RPC'ler (anon/authenticated) ve service_role
--      üzerinden yapılır.
--   4) dispatch-digest pg_cron job'ı (07:15, executive-report 07:00'ten SONRA)
--      — kanıtlanmış Vault deseni (INTERNAL_FUNCTION_SECRET) ile.
--
-- ESKİ ŞEMA UZLAŞTIRMASI (KRİTİK)
--   20261127000001_newsletter_subscribers.sql, `user_id` FK'lı farklı bir
--   "giriş yapmış kullanıcı anahtarı" varyantı tanımlıyordu. O migration
--   üretime HİÇ uygulanmadı (public.newsletter_subscribers canlıda yoktu), ancak
--   `supabase db push` sırası gereği önce çalışıp aynı adı işgal edecekti.
--   Bu yüzden aşağıda, yalnızca eski imza (user_id sütunu) hâlâ mevcutsa
--   tablo düşürülür; ardından yeni anonim şema aynı adı devralır.
--
-- Idempotent: do/then ile korunmuş drop, create table if not exists,
--             create or replace function, cron.unschedule+schedule.
--
-- NOT: Bu dosya yalnızca şema tanımlar; hiçbir canlı DB yazımı yapmaz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0) Eski (prod'a uygulanmamış) kullanıcı-bağlı tabloyu güvenle temizle ──
do $legacy$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'newsletter_subscribers'
       and column_name  = 'user_id'
  ) then
    drop table public.newsletter_subscribers cascade;
  end if;
end
$legacy$;

-- ─── 1) newsletter_subscribers — anonim, KVKK/İYS denetimli abonelik ─────────
create table if not exists public.newsletter_subscribers (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique
                       check (length(trim(email)) > 3 and position('@' in email) > 1 and length(email) <= 254),
  -- Boş dizi => Muğla'nın 13 ilçesinin tamamı (genel bülten)
  districts          text[] not null default '{}'::text[],
  status             text not null default 'pending'
                       check (status in ('pending', 'active', 'unsubscribed')),
  -- Çift onay: e-posta doğrulama ve 1-tık çıkış jetonları (jetonlar immutable'dır)
  verification_token uuid not null default gen_random_uuid(),
  unsubscribe_token  uuid not null default gen_random_uuid(),
  -- KVKK/İYS denetim kanıtı (onay anının değişmez kaydı)
  consent_version    text not null default 'v1.0',
  consent_ip         text,
  consent_user_agent text,
  consented_at       timestamptz not null default now(),
  verified_at        timestamptz,
  unsubscribed_at    timestamptz
);

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

create index if not exists newsletter_subscribers_verification_token_idx
  on public.newsletter_subscribers (verification_token);

create index if not exists newsletter_subscribers_unsubscribe_token_idx
  on public.newsletter_subscribers (unsubscribe_token);

comment on table public.newsletter_subscribers is
  'KVKK/İYS uyumlu anonim günlük bülten aboneliği (çift onaylı). Doğrudan erişim yok; erişim yalnızca service_role ve SECURITY DEFINER RPC''ler üzerinden. Onay kanıtı 3 yıl saklanır.';

-- ─── 2) telegram_subscribers — isteğe bağlı ilçe bazlı Telegram uyarıları ────
create table if not exists public.telegram_subscribers (
  chat_id         bigint primary key,
  username        text,
  districts       text[] not null default '{}'::text[],
  is_active       boolean not null default true,
  consented_at    timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create index if not exists telegram_subscribers_active_idx
  on public.telegram_subscribers (is_active)
  where is_active = true;

comment on table public.telegram_subscribers is
  'İsteğe bağlı, ilçe filtreli Telegram uyarı aboneleri. telegram-webhook (service_role) yönetir; public erişim yok.';

-- ─── 3) Sıkı RLS: doğrudan public erişim YOK ─────────────────────────────────
alter table public.newsletter_subscribers enable row level security;
alter table public.telegram_subscribers   enable row level security;

-- Hiçbir policy tanımlanmaz => anon/authenticated için RLS her satırı reddeder.
-- Tablo yetkileri de geri alınır; tek erişim yolu RPC'ler + service_role olur.
revoke all on table public.newsletter_subscribers from public, anon, authenticated;
revoke all on table public.telegram_subscribers   from public, anon, authenticated;
grant all on table public.newsletter_subscribers to service_role;
grant all on table public.telegram_subscribers   to service_role;

-- ─── 4) SECURITY DEFINER RPC'ler ─────────────────────────────────────────────
-- İstemci IP/User-Agent değerleri PostgREST'in request.headers GUC'ından
-- güvenilir biçimde türetilir; böylece KVKK onay kanıtı istemci tarafından
-- uydurulamaz.

-- 4.1) subscribe_newsletter — çift onayın 1. adımı (pending kayıt + doğrulama)
create or replace function public.subscribe_newsletter(
  p_email           text,
  p_districts       text[] default '{}'::text[],
  p_consent_version text   default 'v1.0'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_canonical constant text[] := array[
    'Bodrum', 'Datça', 'Dalaman', 'Fethiye', 'Kavaklıdere',
    'Köyceğiz', 'Marmaris', 'Menteşe', 'Milas', 'Ortaca',
    'Seydikemer', 'Ula', 'Yatağan'
  ];
  v_url    constant text := 'https://ntheudveohozxdjgcvif.supabase.co/functions/v1';
  v_email      text;
  v_districts  text[];
  v_ip         text;
  v_ua         text;
  v_headers    jsonb;
  v_recent     int;
  v_token      uuid;
  v_status     text;
  v_secret     text;
begin
  v_email := lower(trim(coalesce(p_email, '')));

  -- Basit e-posta doğrulaması
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  -- Yalnızca geçerli 13 ilçe adını kabul et (boş => tüm Muğla)
  select coalesce(array_agg(d order by d), '{}'::text[])
    into v_districts
    from unnest(coalesce(p_districts, '{}'::text[])) as d
   where d = any (v_canonical);
  v_districts := coalesce(v_districts, '{}'::text[]);

  -- İstemci IP ve User-Agent'ı güvenilir şekilde request.headers'tan türet
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(btrim(coalesce(
    split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1),
    '')), '');
  v_ua := nullif(btrim(coalesce(v_headers ->> 'user-agent', '')), '');

  -- Basit hız sınırı: aynı IP'den saatte en fazla 5 abonelik isteği
  if v_ip is not null then
    select count(*) into v_recent
      from public.newsletter_subscribers
     where consent_ip = v_ip
       and consented_at > now() - interval '1 hour';
    if v_recent >= 5 then
      return jsonb_build_object('ok', false, 'error', 'rate_limited');
    end if;
  end if;

  insert into public.newsletter_subscribers as ns
    (email, districts, status, consent_ip, consent_user_agent, consent_version, consented_at)
  values
    (v_email, v_districts, 'pending', v_ip, v_ua, coalesce(p_consent_version, 'v1.0'), now())
  on conflict (email) do update
    set districts          = excluded.districts,
        consent_ip         = excluded.consent_ip,
        consent_user_agent = excluded.consent_user_agent,
        consent_version    = excluded.consent_version,
        consented_at       = now(),
        -- Zaten aktif olan abone yeniden onay beklemez; diğerleri çift onaya döner
        status             = case when ns.status = 'active' then 'active' else 'pending' end,
        verification_token = case when ns.status = 'active' then ns.verification_token else gen_random_uuid() end,
        unsubscribed_at    = null
  returning ns.verification_token, ns.status into v_token, v_status;

  -- Çift onay: pending ise doğrulama e-postası için dispatch-digest'i tetikle.
  -- En iyi çaba (best effort): Vault sırrı yoksa veya pg_net yoksa sessizce atla.
  if v_status = 'pending' then
    begin
      select decrypted_secret into v_secret
        from vault.decrypted_secrets
       where name = 'INTERNAL_FUNCTION_SECRET';
    exception when others then
      v_secret := null;
    end;

    if v_secret is not null then
      begin
        perform net.http_post(
          url     := v_url || '/dispatch-digest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-internal-secret', v_secret
          ),
          body    := jsonb_build_object('mode', 'verify', 'email', v_email, 'token', v_token)
        );
      exception when others then
        -- Doğrulama e-postası gönderilemese bile abonelik kaydı geçerlidir.
        null;
      end;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- 4.2) verify_newsletter_subscription — çift onayın 2. adımı
create or replace function public.verify_newsletter_subscription(
  p_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  update public.newsletter_subscribers
     set status = 'active', verified_at = now()
   where verification_token = p_token
     and status <> 'active'
  returning status into v_status;

  if v_status is null then
    -- Zaten aktif olabilir; bu durumda da başarı döner (idempotent).
    select status into v_status
      from public.newsletter_subscribers
     where verification_token = p_token;
  end if;

  if v_status is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- 4.3) unsubscribe_newsletter — jetonla 1-tık çıkış
create or replace function public.unsubscribe_newsletter(
  p_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_found boolean;
begin
  update public.newsletter_subscribers
     set status = 'unsubscribed', unsubscribed_at = now()
   where unsubscribe_token = p_token
  returning true into v_found;

  if v_found is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  return jsonb_build_object('ok', true, 'status', 'unsubscribed');
end;
$$;

-- Yetkilendirme: yalnızca bu üç RPC çağrılabilir; tablo erişimi verilmez.
revoke all on function public.subscribe_newsletter(text, text[], text)  from public;
revoke all on function public.verify_newsletter_subscription(uuid)      from public;
revoke all on function public.unsubscribe_newsletter(uuid)              from public;
grant execute on function public.subscribe_newsletter(text, text[], text) to anon, authenticated, service_role;
grant execute on function public.verify_newsletter_subscription(uuid)     to anon, authenticated, service_role;
grant execute on function public.unsubscribe_newsletter(uuid)             to anon, authenticated, service_role;

comment on function public.subscribe_newsletter(text, text[], text) is
  'Çift onaylı bülten aboneliği başlatır (pending). KVKK kanıtı IP/UA request.headers''tan türetilir.';
comment on function public.verify_newsletter_subscription(uuid) is
  'Doğrulama jetonuyla aboneliği aktifleştirir (çift onay 2. adım).';
comment on function public.unsubscribe_newsletter(uuid) is
  'Çıkış jetonuyla aboneliği kapatır (1-tık İYS/KVKK çıkışı).';

-- ─── 5) Günlük bülten dağıtımı (07:15 — executive-report 07:00'ten sonra) ────
do $cron$
declare
  v_url  constant text := 'https://ntheudveohozxdjgcvif.supabase.co/functions/v1';
  v_auth constant text := $h$jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'INTERNAL_FUNCTION_SECRET'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'INTERNAL_FUNCTION_SECRET')
    )$h$;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron yok; dispatch-digest job''ı kurulmadı.';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'dispatch-digest';

  perform cron.schedule('dispatch-digest', '15 7 * * *', format(
    $j$select net.http_post(
         url := %L || '/dispatch-digest',
         headers := %s,
         body := '{"mode":"digest"}'::jsonb
       );$j$,
    v_url, v_auth));
end
$cron$;
