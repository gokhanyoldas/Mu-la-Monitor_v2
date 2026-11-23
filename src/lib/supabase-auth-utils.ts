// src/lib/supabase-auth-utils.ts
// Supabase Auth yönlendirme adresi ve kullanıcı dostu Türkçe hata mesajı yardımcıları

export const AUTH_CONFIG_FALLBACK_MESSAGE =
  "Bağlantı adresi yapılandırması eksik — şimdilik Misafir Olarak Devam Et seçeneğini kullanabilirsiniz";

/**
 * `supabase.auth.signUp` için yalnızca temiz `window.location.origin` döndürür.
 * Hatalı alt yol, geçersiz karakter veya desteklenmeyen protokol üretilmesini engeller.
 */
export function getSafeEmailRedirectOrigin(originInput?: string): string | undefined {
  const rawOrigin =
    typeof originInput === "string"
      ? originInput
      : typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";

  const trimmed = rawOrigin.trim();
  if (!trimmed || trimmed === "null") {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

/**
 * Supabase Auth hatalarını anlaşılır Türkçe mesajlara dönüştürür.
 * URL/yol veya bağlantı kaynaklı ham İngilizce hataları kullanıcı dostu açıklamaya çevirir.
 */
export function formatAuthErrorMessage(err: unknown): string {
  let raw = "";
  if (typeof err === "string") {
    raw = err;
  } else if (err && typeof err === "object") {
    const record = err as { message?: unknown; error_description?: unknown; msg?: unknown };
    raw = String(record.message ?? record.error_description ?? record.msg ?? "");
  }

  const message = raw.trim();
  if (!message) {
    return AUTH_CONFIG_FALLBACK_MESSAGE;
  }

  if (message === "Invalid login credentials") {
    return "E-posta veya şifre hatalı";
  }

  if (
    /invalid path specified in request url|invalid path|invalid request url|invalid url|err_invalid_url|failed to fetch|networkerror|fetch failed|load failed|enotfound|econnrefused/i.test(
      message
    )
  ) {
    return AUTH_CONFIG_FALLBACK_MESSAGE;
  }

  return message;
}
