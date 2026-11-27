// supabase/functions/_shared/source-health.ts
// Kaynak sağlığı + devre kesici yardımcıları.
//
// Kazıyıcılar her kaynak için sonucu `record_source_health` RPC'si ile
// atomik olarak kaydeder. Üst üste başarısız olan kaynaklar bir süre
// atlanır (devre kesici), böylece zaman aşımı bütçesi boşa harcanmaz.
//
// Tüm çağrılar hataya dayanıklıdır: migration henüz uygulanmamışsa veya
// servis bağlantısı yoksa sessizce yutulur (kazıma akışı bozulmaz).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SourceHealthInput {
  name: string;
  url?: string | null;
  ok: boolean;
  httpStatus?: number | null;
  error?: string | null;
  latencyMs?: number | null;
}

/**
 * Verilen kaynak adları arasından devre kesici penceresi AÇIK olanları
 * (yani şimdilik atlanması gerekenleri) döner.
 */
export async function loadOpenCircuitNames(
  sb: SupabaseClient | null,
  sourceNames: readonly string[],
): Promise<Set<string>> {
  const open = new Set<string>();
  if (!sb || sourceNames.length === 0) return open;
  try {
    const { data, error } = await sb
      .from("source_health")
      .select("source_name, circuit_open_until")
      .in("source_name", [...sourceNames]);
    if (error) return open;
    const now = Date.now();
    for (const row of (data ?? []) as Array<{ source_name: string; circuit_open_until: string | null }>) {
      if (row.circuit_open_until && new Date(row.circuit_open_until).getTime() > now) {
        open.add(row.source_name);
      }
    }
  } catch (err) {
    console.debug("[source-health] loadOpenCircuitNames atlandı:", err);
  }
  return open;
}

/**
 * Tek bir kaynağın sonucunu atomik olarak kaydeder (devre kesici dahil).
 */
export async function recordSourceHealth(
  sb: SupabaseClient | null,
  input: SourceHealthInput,
): Promise<void> {
  if (!sb) return;
  try {
    await sb.rpc("record_source_health", {
      p_source_name: input.name,
      p_source_url: input.url ?? null,
      p_ok: input.ok,
      p_http_status: input.httpStatus ?? null,
      p_error: input.error ?? null,
      p_latency_ms: input.latencyMs ?? null,
    });
  } catch (err) {
    console.debug(`[source-health] kayıt başarısız (${input.name}):`, err);
  }
}
