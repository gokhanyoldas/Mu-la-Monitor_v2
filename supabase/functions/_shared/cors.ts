// supabase/functions/_shared/cors.ts
// Origin-restricted CORS helper. Wildcard '*' kullanılmaz.
// İzin verilen origin'ler ALLOWED_ORIGINS (virgülle ayrılmış), APP_URL ve bilinen üretim/geliştirme alan adlarından okunur.

const DEFAULT_ALLOWED_ORIGINS = [
  "https://gokhanyoldas.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
];

function getEnv(key: string): string {
  try {
    return (typeof Deno !== "undefined" ? Deno.env.get(key) : undefined) ?? "";
  } catch {
    return "";
  }
}

export function getAllowedOrigins(): string[] {
  const configured = getEnv("ALLOWED_ORIGINS")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const appUrl = getEnv("APP_URL").trim().replace(/\/$/, "");
  const siteUrl = getEnv("SITE_URL").trim().replace(/\/$/, "");
  const vercelUrl = getEnv("VERCEL_URL").trim();

  const origins = new Set<string>([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
  if (appUrl) origins.add(appUrl);
  if (siteUrl) origins.add(siteUrl);
  if (vercelUrl) {
    origins.add(vercelUrl.startsWith("http") ? vercelUrl.replace(/\/$/, "") : `https://${vercelUrl}`);
  }
  return Array.from(origins);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const clean = origin.trim().replace(/\/$/, "");
  const allowed = getAllowedOrigins();
  if (allowed.includes(clean)) return true;

  // Vercel preview/prod alt alan adları (yalnızca proje ön ekine sahip güvenli HTTPS)
  if (/^https:\/\/mu-la-monitor[-a-z0-9]*\.vercel\.app$/i.test(clean)) {
    return true;
  }
  return false;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const baseHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && isOriginAllowed(origin)) {
    baseHeaders["Access-Control-Allow-Origin"] = origin;
  } else if (!origin) {
    // Sunucu-sunucu / cron isteklerinde wildcard dönülmez; yalnızca bilgilendirme amaçlı Vary korunur
  }

  return baseHeaders;
}

export function handleCorsPreflight(req: Request, allowBrowserCors = true): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!allowBrowserCors) {
    return new Response(JSON.stringify({ error: "CORS disabled for internal endpoint" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const origin = req.headers.get("Origin");
  if (origin && !isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", Vary: "Origin" },
    });
  }

  return new Response("ok", { headers: getCorsHeaders(req) });
}

// Geriye dönük uyumluluk için minimal sabit header (wildcard içermez)
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Vary": "Origin",
};
