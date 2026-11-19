// supabase/functions/_shared/auth.ts
// Edge Functions için merkezi JWT doğrulama, iç servis/cron gizli anahtar doğrulaması,
// app_metadata tabanlı rol kontrolü ve hız sınırı (rate limit) koruması.

import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

export interface AuthContext {
  kind: "internal" | "user";
  user: User | null;
  role: string;
  userId: string;
}

export interface AuthGuardOptions {
  allowInternal?: boolean;
  allowUser?: boolean;
  allowedRoles?: string[];
  allowCors?: boolean;
}

function getEnv(key: string): string {
  try {
    return (typeof Deno !== "undefined" ? Deno.env.get(key) : undefined) ?? "";
  } catch {
    return "";
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

/**
 * pg_cron, GitHub Actions veya worker çağrıları için iç servis yetkilendirmesini doğrular.
 * Yalnızca `INTERNAL_FUNCTION_SECRET` (`x-internal-secret` / `x-cron-secret` / Bearer),
 * `SUPABASE_SECRET_KEY` veya `SUPABASE_SERVICE_ROLE_KEY` kabul edilir.
 * Anon key asla iç servis yetkisi olarak kabul edilmez.
 */
export function verifyInternalServiceRequest(req: Request): boolean {
  const internalSecret = getEnv("INTERNAL_FUNCTION_SECRET") || getEnv("CRON_SECRET");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const secretKey = getEnv("SUPABASE_SECRET_KEY");
  const anonKey = getEnv("SUPABASE_ANON_KEY");

  const headerSecret = (
    req.headers.get("x-internal-secret") ??
    req.headers.get("x-cron-secret") ??
    ""
  ).trim();
  const bearer = extractBearerToken(req);
  const apiKeyHeader = (req.headers.get("apikey") ?? "").trim();

  if (internalSecret) {
    if (headerSecret && timingSafeEqual(headerSecret, internalSecret)) return true;
    if (bearer && timingSafeEqual(bearer, internalSecret)) return true;
  }

  if (serviceRoleKey) {
    if (bearer && !timingSafeEqual(bearer, anonKey) && timingSafeEqual(bearer, serviceRoleKey)) {
      return true;
    }
    if (apiKeyHeader && !timingSafeEqual(apiKeyHeader, anonKey) && timingSafeEqual(apiKeyHeader, serviceRoleKey)) {
      return true;
    }
  }

  if (secretKey) {
    if (bearer && timingSafeEqual(bearer, secretKey)) return true;
    if (apiKeyHeader && timingSafeEqual(apiKeyHeader, secretKey)) return true;
  }

  return false;
}

/**
 * Gerçek kullanıcı JWT'sini Supabase Auth üzerinden doğrular ve rolü yalnızca
 * sunucu kontrollü `app_metadata` alanından okur (`user_metadata` dikkate alınmaz).
 */
export async function verifyUserRequest(req: Request): Promise<AuthContext | null> {
  const bearer = extractBearerToken(req);
  if (!bearer) return null;

  const supabaseUrl = getEnv("SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Anon key gerçek bir kullanıcı oturumu değildir — kesinlikle reddet
  if (anonKey && timingSafeEqual(bearer, anonKey)) {
    return null;
  }

  const verifyKey = serviceKey || anonKey;
  if (!supabaseUrl || !verifyKey) return null;

  const authClient = createClient(supabaseUrl, verifyKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.getUser(bearer);
  if (error || !data?.user) return null;

  // Rol YALNIZCA app_metadata üzerinden okunur (kullanıcı tarafından değiştirilemez)
  const appMeta = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const role =
    typeof appMeta.role === "string" && appMeta.role.trim()
      ? appMeta.role.trim().toLowerCase()
      : "user";

  return {
    kind: "user",
    user: data.user,
    role,
    userId: data.user.id,
  };
}

function buildErrorResponse(
  req: Request,
  status: number,
  message: string,
  allowCors: boolean
): Response {
  const headers: Record<string, string> = {
    ...(allowCors ? getCorsHeaders(req) : {}),
    "Content-Type": "application/json",
  };
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers });
}

/**
 * İsteği yetkilendirir; başarısızsa hazır 401/403 Response döner.
 */
export async function authorizeRequest(
  req: Request,
  options: AuthGuardOptions = {}
): Promise<{ ok: true; auth: AuthContext } | { ok: false; response: Response }> {
  const {
    allowInternal = true,
    allowUser = true,
    allowedRoles,
    allowCors = true,
  } = options;

  if (allowInternal && verifyInternalServiceRequest(req)) {
    return {
      ok: true,
      auth: {
        kind: "internal",
        user: null,
        role: "service_role",
        userId: "internal-service",
      },
    };
  }

  if (!allowUser) {
    return {
      ok: false,
      response: buildErrorResponse(
        req,
        401,
        "Yetkisiz erişim: Bu uç nokta yalnızca iç servis / cron çağrılarına açıktır.",
        allowCors
      ),
    };
  }

  const userAuth = await verifyUserRequest(req);
  if (!userAuth) {
    return {
      ok: false,
      response: buildErrorResponse(
        req,
        401,
        "Kimlik doğrulama gerekli: Geçerli bir kullanıcı oturumu bulunamadı.",
        allowCors
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(userAuth.role)) {
      return {
        ok: false,
        response: buildErrorResponse(
          req,
          403,
          `Yetki yetersiz: Bu işlem için [${allowedRoles.join(", ")}] rolü gereklidir.`,
          allowCors
        ),
      };
    }
  }

  return { ok: true, auth: userAuth };
}

// ── AI / Maliyetli Uç Noktalar İçin Kaydırmalı Pencere Hız Sınırı ──────────
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  bucketKey: string,
  maxRequests = 12,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = rateBuckets.get(bucketKey);

  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSec: 0 };
}

export function buildRateLimitResponse(
  req: Request,
  retryAfterSec: number,
  allowCors = true
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: `İstek sınırı aşıldı. Lütfen ${retryAfterSec} saniye sonra tekrar deneyin.`,
    }),
    {
      status: 429,
      headers: {
        ...(allowCors ? getCorsHeaders(req) : {}),
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
