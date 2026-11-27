-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — Kaynak Sağlığı & Devre Kesici (P1)
--
-- Amaç: Çok kaynaklı kazıyıcıların (news-scrape vb.) her kaynak için
--       başarı/başarısızlık, gecikme ve ardışık hata sayısını izlemesi;
--       üst üste başarısız olan bir kaynağı otomatik olarak GEÇİCİ olarak
--       atlaması (circuit breaker) ve böylece çalışma süresi/zaman aşımı
--       bütçesini koruması.
--
-- Not: Tüm yazımlar servis rolü + `record_source_health` RPC üzerinden
--      yapılır; anonim/authenticated yalnızca OKUYABİLİR (şeffaflık).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.source_health (
  source_name          text PRIMARY KEY,
  source_url           text,
  last_status          text,           -- 'ok' | 'error' | 'skipped'
  last_http_status     integer,
  last_error           text,
  last_success_at      timestamptz,
  last_failure_at      timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  total_success        integer NOT NULL DEFAULT 0,
  total_failure        integer NOT NULL DEFAULT 0,
  avg_latency_ms       integer,
  circuit_open_until   timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_health_circuit_idx
  ON public.source_health (circuit_open_until)
  WHERE circuit_open_until IS NOT NULL;

COMMENT ON TABLE public.source_health IS
  'Kazıyıcı kaynak başına sağlık durumu + devre kesici (circuit breaker) penceresi';

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read source_health"
    ON public.source_health FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service write source_health"
    ON public.source_health FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Atomik sağlık kaydı + devre kesici güncellemesi ───────────────────────
-- Okuma-değiştir-yazma yarışını önlemek için tek atomik upsert.
-- Devre kesici: ardışık hata eşiği (5) aşıldığında 15 dk boyunca açılır;
-- bir sonraki başarılı çekimde otomatik olarak sıfırlanır (kapanır).
CREATE OR REPLACE FUNCTION public.record_source_health(
  p_source_name text,
  p_source_url  text DEFAULT NULL,
  p_ok          boolean DEFAULT true,
  p_http_status integer DEFAULT NULL,
  p_error       text DEFAULT NULL,
  p_latency_ms  integer DEFAULT NULL
) RETURNS public.source_health
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold constant integer := 5;
  v_open_window constant interval := interval '15 minutes';
  v_row public.source_health;
BEGIN
  INSERT INTO public.source_health AS sh (
    source_name, source_url, last_status, last_http_status, last_error,
    last_success_at, last_failure_at, consecutive_failures,
    total_success, total_failure, avg_latency_ms, circuit_open_until, updated_at
  ) VALUES (
    p_source_name, p_source_url,
    CASE WHEN p_ok THEN 'ok' ELSE 'error' END,
    p_http_status, p_error,
    CASE WHEN p_ok THEN now() ELSE NULL END,
    CASE WHEN p_ok THEN NULL ELSE now() END,
    CASE WHEN p_ok THEN 0 ELSE 1 END,
    CASE WHEN p_ok THEN 1 ELSE 0 END,
    CASE WHEN p_ok THEN 0 ELSE 1 END,
    p_latency_ms,
    CASE WHEN p_ok THEN NULL
         WHEN 1 >= v_threshold THEN now() + v_open_window
         ELSE NULL END,
    now()
  )
  ON CONFLICT (source_name) DO UPDATE SET
    source_url           = COALESCE(EXCLUDED.source_url, sh.source_url),
    last_status          = EXCLUDED.last_status,
    last_http_status     = EXCLUDED.last_http_status,
    last_error           = EXCLUDED.last_error,
    last_success_at      = CASE WHEN p_ok THEN now() ELSE sh.last_success_at END,
    last_failure_at      = CASE WHEN p_ok THEN sh.last_failure_at ELSE now() END,
    consecutive_failures = CASE WHEN p_ok THEN 0 ELSE sh.consecutive_failures + 1 END,
    total_success        = sh.total_success + CASE WHEN p_ok THEN 1 ELSE 0 END,
    total_failure        = sh.total_failure + CASE WHEN p_ok THEN 0 ELSE 1 END,
    avg_latency_ms       = CASE
                             WHEN p_latency_ms IS NULL THEN sh.avg_latency_ms
                             WHEN sh.avg_latency_ms IS NULL THEN p_latency_ms
                             ELSE ROUND(sh.avg_latency_ms * 0.7 + p_latency_ms * 0.3)::int
                           END,
    circuit_open_until   = CASE
                             WHEN p_ok THEN NULL
                             WHEN (sh.consecutive_failures + 1) >= v_threshold THEN now() + v_open_window
                             ELSE sh.circuit_open_until
                           END,
    updated_at           = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_source_health(text, text, boolean, integer, text, integer)
  FROM PUBLIC, anon, authenticated;
-- Yalnızca servis rolü (edge function service client) çağırabilir
GRANT EXECUTE ON FUNCTION public.record_source_health(text, text, boolean, integer, text, integer)
  TO service_role;
