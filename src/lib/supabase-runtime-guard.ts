// src/lib/supabase-runtime-guard.ts
// Supabase API key uyuşmazlığı (Invalid API key / JWT hatası) veya proje kota kısıtlaması
// (HTTP 401/402, exceed_egress_quota) durumlarında tekrarlı console.error fırtınasını önleyen
// hafif çalışma zamanı devre kesicisi.

const SUPABASE_COOLDOWN_MS = 10 * 60 * 1000;

let supabaseUnavailableUntil = 0;
let lastLoggedReason = "";

export function isSupabaseAuthOrQuotaError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const status = Number(obj.status ?? obj.statusCode ?? obj.code);
    if (status === 401 || status === 402) {
      return true;
    }
    const combined = [obj.message, obj.hint, obj.details, obj.error_description]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ");
    if (matchesFatalSupabasePattern(combined)) {
      return true;
    }
  }

  const msg = error instanceof Error ? error.message : String(error);
  return matchesFatalSupabasePattern(msg);
}

function matchesFatalSupabasePattern(text: string): boolean {
  if (!text) return false;
  return /invalid api key|owned by another supabase project|invalid jwt|jwt expired|no api key found in request|exceed_egress_quota|service for this project is restricted|project is paused/i.test(
    text
  );
}

export function isSupabaseRuntimeAvailable(isClientConfigured: boolean): boolean {
  if (!isClientConfigured) return false;
  return Date.now() >= supabaseUnavailableUntil;
}

/**
 * Hata bir Supabase API anahtarı / proje kısıtlama hatasıysa devre kesiciyi aktifleştirir,
 * tek seferlik özlü bir `console.warn` yazar ve `true` döner.
 */
export function markSupabaseUnavailableIfFatal(error: unknown, context?: string): boolean {
  if (!isSupabaseAuthOrQuotaError(error)) {
    return false;
  }

  const reason =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "Invalid API key")
      : String(error);

  const alreadyCoolingDown = Date.now() < supabaseUnavailableUntil;
  supabaseUnavailableUntil = Date.now() + SUPABASE_COOLDOWN_MS;

  if (!alreadyCoolingDown || lastLoggedReason !== reason) {
    lastLoggedReason = reason;
    const prefix = context ? `[supabase:${context}]` : "[supabase]";
    console.warn(
      `${prefix} Supabase bağlantısı geçici olarak yerel yedek moduna alındı (${reason}). ` +
        "VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY eşleşmesini kontrol edin."
    );
  }

  return true;
}

export function resetSupabaseRuntimeGuard(): void {
  supabaseUnavailableUntil = 0;
  lastLoggedReason = "";
}
