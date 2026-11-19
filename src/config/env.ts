// src/config/env.ts
// Muğla Monitör v2 — Merkezi Ortam Değişkenleri Yapılandırması
// GitHub, Vercel (Vite import.meta.env.VITE_*) ve Google AI Studio (process.env.GEMINI_API_KEY)
// çalışma zamanlarını güvenli ve beyaz ekran hatası olmadan birleştirir.

type EnvRecord = Record<string, string | boolean | undefined>;

function readImportMetaEnv(): EnvRecord {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as { env?: EnvRecord }).env) {
      return (import.meta as { env: EnvRecord }).env;
    }
  } catch {
    // import.meta erişilemeyen ortamlarda sessizce geç
  }
  return {};
}

function readProcessEnv(key: string): string | undefined {
  // Vite `define` bloğu statik `process.env.<KEY>` ifadelerini derleme zamanında yerleştirir.
  try {
    if (typeof process !== "undefined") {
      if (key === "GEMINI_API_KEY" && process.env?.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
      }
      if (key === "VITE_GEMINI_API_KEY" && process.env?.VITE_GEMINI_API_KEY) {
        return process.env.VITE_GEMINI_API_KEY;
      }
      if (key === "APP_URL" && process.env?.APP_URL) {
        return process.env.APP_URL;
      }
      if (process.env && typeof process.env[key] === "string") {
        return process.env[key];
      }
    }
  } catch {
    // Tarayıcıda global `process` tanımlı değilse hata fırlatma
  }
  return undefined;
}

/**
 * Verilen VITE_* ve opsiyonel fallback anahtarını sırayla güvenli şekilde okur.
 */
export function resolveEnv(viteKey: string, fallbackProcessKey?: string): string {
  const metaEnv = readImportMetaEnv();
  const isVitest = Boolean(readProcessEnv("VITEST") || metaEnv.VITEST);

  // Test ortamında (vi.stubEnv) process.env üzerindeki açık tanımları/sıfırlamaları önceliklendir
  if (isVitest && typeof process !== "undefined" && process.env) {
    if (viteKey in process.env) {
      const val = (process.env[viteKey] ?? "").trim();
      if (val.length > 0) return val;
      if (fallbackProcessKey && fallbackProcessKey in process.env) {
        return (process.env[fallbackProcessKey] ?? "").trim();
      }
      return "";
    }
    if (fallbackProcessKey && fallbackProcessKey in process.env) {
      return (process.env[fallbackProcessKey] ?? "").trim();
    }
  }

  const fromMeta = metaEnv[viteKey];
  if (typeof fromMeta === "string" && fromMeta.trim().length > 0) {
    return fromMeta.trim();
  }

  const fromProcessVite = readProcessEnv(viteKey);
  if (typeof fromProcessVite === "string" && fromProcessVite.trim().length > 0) {
    return fromProcessVite.trim();
  }

  if (fallbackProcessKey) {
    const fromMetaFallback = metaEnv[fallbackProcessKey];
    if (typeof fromMetaFallback === "string" && fromMetaFallback.trim().length > 0) {
      return fromMetaFallback.trim();
    }
    const fromProcessFallback = readProcessEnv(fallbackProcessKey);
    if (typeof fromProcessFallback === "string" && fromProcessFallback.trim().length > 0) {
      return fromProcessFallback.trim();
    }
  }

  return "";
}

/**
 * Merkezi ENV nesnesi:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY (VITE_SUPABASE_PUBLISHABLE_KEY yedeğiyle)
 * - VITE_GEMINI_API_KEY (AI Studio process.env.GEMINI_API_KEY yedeğiyle)
 * - VITE_TOMTOM_API_KEY
 */
export const ENV = {
  get VITE_SUPABASE_URL(): string {
    return resolveEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  },
  get SUPABASE_URL(): string {
    return resolveEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  },
  get VITE_SUPABASE_ANON_KEY(): string {
    return (
      resolveEnv("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY") ||
      resolveEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
    );
  },
  get SUPABASE_ANON_KEY(): string {
    return (
      resolveEnv("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY") ||
      resolveEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
    );
  },
  get VITE_SUPABASE_PUBLISHABLE_KEY(): string {
    return (
      resolveEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
      resolveEnv("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY")
    );
  },
  get VITE_GEMINI_API_KEY(): string {
    return resolveEnv("VITE_GEMINI_API_KEY", "GEMINI_API_KEY");
  },
  get GEMINI_API_KEY(): string {
    return resolveEnv("VITE_GEMINI_API_KEY", "GEMINI_API_KEY");
  },
  get VITE_TOMTOM_API_KEY(): string {
    return resolveEnv("VITE_TOMTOM_API_KEY", "TOMTOM_API_KEY");
  },
  get TOMTOM_API_KEY(): string {
    return resolveEnv("VITE_TOMTOM_API_KEY", "TOMTOM_API_KEY");
  },
  get VITE_APP_URL(): string {
    return resolveEnv("VITE_APP_URL", "APP_URL");
  },
  get VITE_APP_VERSION(): string {
    return resolveEnv("VITE_APP_VERSION") || "2.0.0";
  },
  get VITE_SENTRY_DSN(): string {
    return resolveEnv("VITE_SENTRY_DSN");
  },
  get IS_PROD(): boolean {
    return Boolean(readImportMetaEnv().PROD);
  },
  get IS_DEV(): boolean {
    return Boolean(readImportMetaEnv().DEV);
  },
};

export function getGeminiApiKey(): string {
  return ENV.VITE_GEMINI_API_KEY;
}

export function getAppUrl(): string {
  return ENV.VITE_APP_URL;
}

export function getRuntimeEnvSummary() {
  return {
    appVersion: ENV.VITE_APP_VERSION,
    appUrl: ENV.VITE_APP_URL,
    supabaseUrl: ENV.VITE_SUPABASE_URL,
    hasSupabaseKey: Boolean(ENV.VITE_SUPABASE_ANON_KEY),
    hasGeminiKey: Boolean(ENV.VITE_GEMINI_API_KEY),
    hasTomTomKey: Boolean(ENV.VITE_TOMTOM_API_KEY),
    hasSentryDsn: Boolean(ENV.VITE_SENTRY_DSN),
    isProd: ENV.IS_PROD,
    isDev: ENV.IS_DEV,
  };
}

let hasWarnedMissingKeys = false;

/**
 * Eksik anahtarlarda uygulamanın çökmesini önler ve geliştiriciye açıklayıcı konsol uyarısı üretir.
 */
export function validateEnvAndWarn(): string[] {
  const warnings: string[] = [];

  if (!ENV.VITE_SUPABASE_URL || !ENV.VITE_SUPABASE_ANON_KEY) {
    warnings.push(
      "[ENV] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımlı değil — Supabase bağlantısı salt-okunur yerel yedek modda çalışacak."
    );
  }
  if (!ENV.VITE_GEMINI_API_KEY) {
    warnings.push(
      "[ENV] VITE_GEMINI_API_KEY / GEMINI_API_KEY tanımlı değil — istemci tarafı olay ayrıştırıcısı yerel heuristik NLP yedeğini kullanacak."
    );
  }
  if (!ENV.VITE_TOMTOM_API_KEY) {
    warnings.push(
      "[ENV] VITE_TOMTOM_API_KEY tanımlı değil — canlı trafik verisi Supabase Edge Function (reference-data) ve ücretsiz harita katmanı üzerinden devam edecek."
    );
  }

  if (!hasWarnedMissingKeys && warnings.length > 0 && typeof console !== "undefined") {
    hasWarnedMissingKeys = true;
    warnings.forEach((msg) => console.warn(msg));
  }

  return warnings;
}

// Uygulama başlangıcında test ortamı dışında bir kez kontrol uyarısı üret
if (!readProcessEnv("VITEST") && !readImportMetaEnv().VITEST) {
  validateEnvAndWarn();
}

export default ENV;
