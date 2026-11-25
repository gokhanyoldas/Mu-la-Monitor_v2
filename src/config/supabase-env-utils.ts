// src/config/supabase-env-utils.ts
// Saf, yan etkisiz (side-effect-free) Supabase URL ve anahtar temizleme yardımcıları.
// Hem tarayıcı çalışma zamanında (src/config/env.ts, client.ts) hem de
// Node.js derleme zamanında (vite.config.ts, src/config/deploy.ts) güvenle kullanılır.

const INVISIBLE_CHARS_RE = /[\r\n\t\u200B-\u200D\uFEFF]+/g;
const EDGE_QUOTES_AND_SPACE_RE =
  /^[\s\u00A0"'`\u201C\u201D\u2018\u2019\\]+|[\s\u00A0"'`\u201C\u201D\u2018\u2019\\]+$/g;
const EDGE_ENCODED_TOKENS_RE = /^(?:%20|%22|%27)+|(?:%20|%22|%27|%2F)+$/gi;

/**
 * Supabase Anon / Publishable anahtar değerinden dış boşlukları, satır sonlarını,
 * kaçışlı/düz/kıvrık tırnakları ve yanlışlıkla yapıştırılmış `KEY=` önekini temizler.
 */
export function sanitizeSupabaseKey(rawKey?: string | null): string {
  if (!rawKey || typeof rawKey !== "string") {
    return "";
  }

  let cleaned = rawKey.replace(INVISIBLE_CHARS_RE, "").replace(/\u00A0/g, " ").trim();
  let prev = "";
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(EDGE_ENCODED_TOKENS_RE, "")
      .replace(EDGE_QUOTES_AND_SPACE_RE, "")
      .replace(/^(?:VITE_)?SUPABASE_(?:ANON|PUBLISHABLE)_KEY\s*=\s*/i, "")
      .trim();
  }

  return cleaned;
}

/**
 * Supabase URL değerini istemciye verilmeden önce temizler ve doğrular:
 * - Baş/son boşlukları, görünmez karakterleri, tek/çift/kıvrık tırnakları ve sondaki `/` karakterlerini temizler.
 * - Yanlışlıkla `VITE_SUPABASE_URL=...` önekiyle yapıştırılmış değerleri düzeltir.
 * - Yanlışlıkla `https://supabase.com/dashboard/project/<PROJECT_REF>...` girildiyse
 *   `<PROJECT_REF>` değerini ayıklayıp `https://<PROJECT_REF>.supabase.co` üretir.
 * - Sonunda `/rest/v1`, `/auth/v1`, `/storage/v1` vb. alt yollar, query veya hash varsa
 *   temiz `https://<proje-id>.supabase.co` kök adresini (origin) döndürür.
 * - `http://<proje-id>.supabase.co` girilmişse otomatik olarak `https://` protokolüne yükseltir.
 * - Geçersiz veya boş URL durumunda `""` döndürerek güvenli fallback moduna geçişi sağlar.
 */
export function normalizeSupabaseUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "";
  }

  let cleaned = rawUrl.replace(INVISIBLE_CHARS_RE, "").replace(/\u00A0/g, " ").trim();

  // Dış boşlukları, kaçışlı/düz/kıvrık tırnakları, URL-encoded tırnak/boşlukları
  // ve yanlışlıkla "VITE_SUPABASE_URL=..." şeklinde yapıştırılan öneki yinelemeli temizle
  let prev = "";
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(EDGE_ENCODED_TOKENS_RE, "")
      .replace(EDGE_QUOTES_AND_SPACE_RE, "")
      .replace(/^(?:VITE_)?SUPABASE_URL\s*=\s*/i, "")
      .trim();
  }

  // Sondaki gereksiz slash'ları temizle
  cleaned = cleaned.replace(/\/+$/, "").trim();
  if (!cleaned) {
    return "";
  }

  // Protokol unutulmuş bilinen Supabase adreslerini otomatik tamamla
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) {
    if (
      /^[a-z0-9-]+\.supabase\.co(?:\/.*)?$/i.test(cleaned) ||
      /^(?:www\.|app\.)?supabase\.com\/(?:dashboard\/)?project\/[a-z0-9-]+/i.test(cleaned)
    ) {
      cleaned = `https://${cleaned}`;
    } else {
      return "";
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return "";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "";
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || (!host.includes(".") && host !== "localhost")) {
    return "";
  }

  // Yanlışlıkla Supabase Dashboard URL'si girildiyse proje ref'ini çıkar
  if (host === "supabase.com" || host === "www.supabase.com" || host === "app.supabase.com") {
    const dashboardMatch = parsed.pathname.match(
      /^\/(?:dashboard\/)?project\/([a-z0-9][a-z0-9-]{2,62})(?:\/|$)/i
    );
    if (dashboardMatch?.[1]) {
      return `https://${dashboardMatch[1].toLowerCase()}.supabase.co`;
    }
    return "";
  }

  // *.supabase.co adreslerinde protokol her zaman HTTPS olmalı
  if (host.endsWith(".supabase.co")) {
    const portSuffix = parsed.port ? `:${parsed.port}` : "";
    return `https://${host}${portSuffix}`;
  }

  // Tüm alt yolları (/rest/v1, /auth/v1 vb.), query ve hash'i kaldırıp temiz origin döndür
  return parsed.origin.replace(/\/+$/, "");
}

/**
 * `https://<project-ref>.supabase.co` adresinden Supabase proje kimliğini çıkarır.
 * Özel alan adı veya localhost adreslerinde `null` döner.
 */
export function extractSupabaseProjectRefFromUrl(normalizedUrl?: string | null): string | null {
  if (!normalizedUrl || typeof normalizedUrl !== "string") return null;
  try {
    const host = new URL(normalizedUrl).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function decodeBase64UrlToUtf8(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + "=".repeat(padLen);
    if (typeof atob === "function") {
      return atob(padded);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Klasik Supabase JWT (`eyJ...`) anahtarının payload bölümündeki `ref` (proje kimliği) alanını okur.
 * Yeni `sb_publishable_*` anahtarlarında veya JWT olmayan değerlerde `null` döner.
 */
export function extractJwtProjectRef(rawKey?: string | null): string | null {
  const key = sanitizeSupabaseKey(rawKey);
  if (!key) return null;
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[0].startsWith("eyJ")) {
    return null;
  }
  const decoded = decodeBase64UrlToUtf8(parts[1]);
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as { ref?: unknown };
    if (typeof payload?.ref === "string" && payload.ref.trim().length > 0) {
      return payload.ref.trim().toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verilen Supabase URL ve anon/publishable anahtarının uyumlu olup olmadığını kontrol eder.
 * - Her iki parametre sırasını da destekler: `(url, key)` veya `(key, url)`.
 * - URL veya anahtar boş/geçersizse `false` döner.
 * - `sb_publishable_*` anahtarlarını güvenli biçimde doğrular (`true`).
 * - Klasik JWT (`eyJ...`) anahtarlarında `ref` alanının `https://<ref>.supabase.co` ile eşleşmesini doğrular.
 */
export function isSupabaseKeyCompatibleWithUrl(
  urlOrKey?: string | null,
  keyOrUrl?: string | null
): boolean {
  if (!urlOrKey || !keyOrUrl) return false;

  const firstAsUrl = normalizeSupabaseUrl(urlOrKey);
  const secondAsUrl = normalizeSupabaseUrl(keyOrUrl);

  let normalizedUrl = "";
  let key = "";

  if (firstAsUrl && !secondAsUrl) {
    normalizedUrl = firstAsUrl;
    key = sanitizeSupabaseKey(keyOrUrl);
  } else if (secondAsUrl && !firstAsUrl) {
    normalizedUrl = secondAsUrl;
    key = sanitizeSupabaseKey(urlOrKey);
  } else {
    return false;
  }

  if (!normalizedUrl || !key) return false;

  if (key.startsWith("sb_publishable_")) {
    return key.length > "sb_publishable_".length;
  }

  const urlRef = extractSupabaseProjectRefFromUrl(normalizedUrl);
  if (!urlRef) return true;

  const jwtRef = extractJwtProjectRef(key);
  if (!jwtRef) return true;

  return jwtRef === urlRef;
}

/**
 * Verilen ortam kaydından `VITE_SUPABASE_ANON_KEY || VITE_SUPABASE_PUBLISHABLE_KEY`
 * öncelik sırasıyla (ve `SUPABASE_*` yedekleriyle) temizlenmiş istemci anahtarını çözer.
 * `normalizedUrl` verildiyse başka bir Supabase projesine ait JWT anahtarları elenir
 * ve URL ile eşleşen anahtar otomatik seçilir.
 */
export function resolveSupabaseKeyFromRecord(
  env: Record<string, string | undefined>,
  normalizedUrl?: string | null
): string {
  const candidates = [
    sanitizeSupabaseKey(env.VITE_SUPABASE_ANON_KEY),
    sanitizeSupabaseKey(env.VITE_SUPABASE_PUBLISHABLE_KEY),
    sanitizeSupabaseKey(env.SUPABASE_ANON_KEY),
    sanitizeSupabaseKey(env.SUPABASE_PUBLISHABLE_KEY),
  ].filter(Boolean);

  if (candidates.length === 0) return "";
  if (!normalizedUrl) return candidates[0];

  const compatible = candidates.find((candidate) =>
    isSupabaseKeyCompatibleWithUrl(candidate, normalizedUrl)
  );
  return compatible ?? "";
}
