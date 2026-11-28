// api/telegram/send-digest.ts
// Vercel Serverless & Express uyumlu Telegram Günlük Muğla Bülteni göndericisi.
// - Yalnızca sunucu taraflı `process.env.TELEGRAM_BOT_TOKEN`, `process.env.TELEGRAM_CHAT_ID`,
//   `process.env.TELEGRAM_DIGEST_SECRET` / `process.env.CRON_SECRET` ve Supabase anahtarlarını kullanır.
// - Aynı gün (Europe/Istanbul) içinde çift gönderimi Supabase `live_data_cache` + bellek kilidiyle engeller.
// - Tüm dinamik metinleri Telegram HTML (`parse_mode: "HTML"`) için güvenli biçimde kaçışlar.

import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

type VercelRequest = IncomingMessage & {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
};

type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

export interface MonitorDataRow {
  source?: string | null;
  district_name?: string | null;
  content?: string | null;
  sentiment?: string | null;
  category?: string | null;
  created_at?: string | null;
}

export interface AlertEventRow {
  type?: string | null;
  severity?: string | null;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  description?: string | null;
  source?: string | null;
  created_at?: string | null;
}

export interface ProtocolMemberRow {
  isim?: string | null;
  name?: string | null;
  unvan?: string | null;
  title?: string | null;
  kategori?: string | null;
  district?: string | null;
  updated_at?: string | null;
}

export interface AiSummaryRow {
  type?: string | null;
  date?: string | null;
  summary?: string | null;
  content?: string | null;
  generated_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface TelegramDigestResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  date: string;
  messageId?: number | null;
  counts?: {
    monitorData: number;
    alerts: number;
    protocolMembers: number;
    aiSummaries: number;
  };
  error?: string;
}

const TELEGRAM_DEDUP_CACHE_KEY = "telegram_digest_last_sent";
const TELEGRAM_MAX_MESSAGE_LENGTH = 3900;
const inMemorySentDates = new Set<string>();

export function resetTelegramDigestMemoryGuard(): void {
  inMemorySentDates.clear();
}

export function getIstanbulDateKey(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function formatTurkishDateHeader(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "long",
      year: "numeric",
      weekday: "long",
    }).format(now);
  } catch {
    return getIstanbulDateKey(now);
  }
}

export function escapeTelegramHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeSupabaseUrl(raw?: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\/+(?:rest|auth|realtime|storage)\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function constantTimeEquals(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Bearer token doğrulaması: `TELEGRAM_DIGEST_SECRET` veya `CRON_SECRET` eşleşmelidir.
 * Her iki gizli anahtar da tanımlı değilse fail-closed (yetkisiz) döner.
 */
export function verifyDigestAuth(
  authHeader: string | string[] | undefined,
  env: NodeJS.ProcessEnv = process.env
): { authorized: boolean; statusCode: number; reason?: string } {
  const secrets = [env.TELEGRAM_DIGEST_SECRET, env.CRON_SECRET]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (secrets.length === 0) {
    return {
      authorized: false,
      statusCode: 503,
      reason: "TELEGRAM_DIGEST_SECRET veya CRON_SECRET sunucuda tanımlı değil.",
    };
  }

  const rawHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (typeof rawHeader !== "string" || !rawHeader.trim()) {
    return { authorized: false, statusCode: 401, reason: "Authorization Bearer başlığı eksik." };
  }

  const match = rawHeader.trim().match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]?.trim()) {
    return { authorized: false, statusCode: 401, reason: "Geçersiz Authorization biçimi." };
  }

  const token = match[1].trim();
  const matched = secrets.some((secret) => constantTimeEquals(token, secret));
  if (!matched) {
    return { authorized: false, statusCode: 403, reason: "Yetkisiz erişim." };
  }

  return { authorized: true, statusCode: 200 };
}

function summarizeMonitorContent(rawContent: string | null | undefined): string {
  if (!rawContent || typeof rawContent !== "string") return "";
  const trimmed = rawContent.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const candidates = [
        parsed.summary,
        parsed.headline,
        parsed.title,
        parsed.note,
        parsed.status,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim().slice(0, 140);
      }
      if (parsed.metrics && typeof parsed.metrics === "object") {
        const pairs = Object.entries(parsed.metrics as Record<string, unknown>)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${String(v)}`);
        if (pairs.length > 0) return pairs.join(" · ").slice(0, 140);
      }
    } catch {
      // Düz metin olarak devam et
    }
  }
  return trimmed.replace(/\s+/g, " ").slice(0, 140);
}

const CATEGORY_LABELS_TR: Record<string, string> = {
  ekonomi: "Ekonomi",
  cevre: "Çevre",
  turizm: "Turizm",
  ulasim: "Ulaşım",
  sosyal: "Sosyal",
  guvenlik: "Güvenlik",
  enerji: "Enerji",
  protokol: "Protokol",
  altyapi: "Altyapı",
};

function sanitizePublicSiteUrl(raw?: string): string {
  const fallback = "https://mugla-monitor.vercel.app";
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    // ignore invalid URL
  }
  return fallback;
}

export function buildDailyDigestHtml(params: {
  dateHeader: string;
  monitorData: MonitorDataRow[];
  alerts: AlertEventRow[];
  protocolMembers: ProtocolMemberRow[];
  aiSummaries: AiSummaryRow[];
  siteUrl?: string;
}): string {
  const lines: string[] = [];
  const siteUrl = sanitizePublicSiteUrl(params.siteUrl);

  lines.push(`<b>📍 MUĞLA GÜNLÜK ŞEHİR BÜLTENİ</b>`);
  lines.push(`<i>${escapeTelegramHtml(params.dateHeader)}</i>`);
  lines.push("");

  // 1. Günün Özeti (ai_summaries)
  const latestSummary = params.aiSummaries.find((s) => {
    const text = s?.summary || s?.content;
    return typeof text === "string" && text.trim().length > 0;
  });
  const latestSummaryText = latestSummary?.summary || latestSummary?.content || "";
  if (latestSummaryText.trim().length > 0) {
    const summaryClean = latestSummaryText.trim().replace(/\s+/g, " ").slice(0, 480);
    lines.push(`<b>🧭 Günün Özeti</b>`);
    lines.push(escapeTelegramHtml(summaryClean));
    lines.push("");
  }

  // 2. Öne Çıkan Uyarılar (alert_events)
  const validAlerts = params.alerts
    .filter((a) => typeof a?.title === "string" && a.title.trim().length > 0)
    .slice(0, 4);
  lines.push(`<b>🚨 Güncel Uyarılar (${validAlerts.length})</b>`);
  if (validAlerts.length > 0) {
    for (const alert of validAlerts) {
      const sev = String(alert.severity || "").toLowerCase();
      const icon = sev === "critical" || sev === "kritik" ? "🔴" : sev === "high" || sev === "yuksek" ? "🟠" : "🟡";
      const title = escapeTelegramHtml(alert.title!.trim().slice(0, 120));
      const rawBody = alert.body || alert.message || alert.description || "";
      const detail =
        typeof rawBody === "string" && rawBody.trim()
          ? ` — ${escapeTelegramHtml(rawBody.trim().replace(/\s+/g, " ").slice(0, 100))}`
          : "";
      lines.push(`${icon} <b>${title}</b>${detail}`);
    }
  } else {
    lines.push(`✅ Kayıtlı kritik şehir uyarısı bulunmuyor.`);
  }
  lines.push("");

  // 3. Sektör ve İlçe Durumu (monitor_data)
  const seenCategories = new Set<string>();
  const sectorLines: string[] = [];
  for (const row of params.monitorData) {
    const catKey = String(row.category || "").trim().toLowerCase() || "genel";
    if (seenCategories.has(catKey)) continue;
    const snippet = summarizeMonitorContent(row.content);
    if (!snippet) continue;
    seenCategories.add(catKey);
    const label = CATEGORY_LABELS_TR[catKey] || catKey.toUpperCase();
    const districtTag = row.district_name ? ` (${row.district_name})` : "";
    sectorLines.push(
      `• <b>${escapeTelegramHtml(label)}${escapeTelegramHtml(districtTag)}:</b> ${escapeTelegramHtml(snippet)}`
    );
    if (sectorLines.length >= 6) break;
  }

  if (sectorLines.length > 0) {
    lines.push(`<b>📊 Sekme &amp; İlçe Özetleri</b>`);
    lines.push(...sectorLines);
    lines.push("");
  }

  // 4. İl Protokolü (protocol_members)
  const governor = params.protocolMembers.find((m) =>
    String(m?.unvan || m?.title || "").toLocaleLowerCase("tr-TR").includes("vali")
  );
  const mayor = params.protocolMembers.find((m) =>
    String(m?.unvan || m?.title || "").toLocaleLowerCase("tr-TR").includes("büyükşehir belediye başkanı")
  );
  if (params.protocolMembers.length > 0) {
    lines.push(`<b>🏛️ Muğla Protokol İzleme</b>`);
    const govName = governor?.isim || governor?.name;
    if (govName) {
      lines.push(
        `• ${escapeTelegramHtml(governor?.unvan || governor?.title || "Muğla Valisi")}: <b>${escapeTelegramHtml(govName)}</b>`
      );
    }
    const mayorName = mayor?.isim || mayor?.name;
    if (mayorName) {
      lines.push(
        `• ${escapeTelegramHtml(mayor?.unvan || mayor?.title || "Büyükşehir Belediye Başkanı")}: <b>${escapeTelegramHtml(mayorName)}</b>`
      );
    }
    lines.push(`• İzlenen aktif protokol kaydı: <b>${params.protocolMembers.length}</b>`);
    lines.push("");
  }

  lines.push(`🔗 <a href="${escapeTelegramHtml(siteUrl)}">Muğla Monitör Canlı Panel</a>`);

  const joined = lines.join("\n").trim();
  if (joined.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
    return joined;
  }
  return `${joined.slice(0, TELEGRAM_MAX_MESSAGE_LENGTH - 24).trimEnd()}\n…`;
}

async function supabaseRestGet<T>(
  supabaseUrl: string,
  supabaseKey: string,
  table: string,
  queryString: string,
  fetchImpl: typeof fetch
): Promise<T[]> {
  if (!supabaseUrl || !supabaseKey) return [];
  const url = `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?${queryString}`;
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

async function checkAlreadySentTodayInSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  todayKey: string,
  fetchImpl: typeof fetch
): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey) return false;
  const rows = await supabaseRestGet<{ data?: { date?: string } | null }>(
    supabaseUrl,
    supabaseKey,
    "live_data_cache",
    `select=data,updated_at&data_type=eq.${encodeURIComponent(TELEGRAM_DEDUP_CACHE_KEY)}&limit=1`,
    fetchImpl
  );
  return rows[0]?.data?.date === todayKey;
}

async function recordSentTodayInSupabase(
  supabaseUrl: string,
  supabaseKey: string,
  todayKey: string,
  messageId: number | null,
  source: string,
  fetchImpl: typeof fetch
): Promise<void> {
  if (!supabaseUrl || !supabaseKey) return;
  const url = `${supabaseUrl}/rest/v1/live_data_cache?on_conflict=data_type`;
  const nowIso = new Date().toISOString();
  try {
    await fetchImpl(url, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        data_type: TELEGRAM_DEDUP_CACHE_KEY,
        data: {
          date: todayKey,
          sent_at: nowIso,
          message_id: messageId,
          source,
        },
        source: "telegram-digest",
        updated_at: nowIso,
      }),
    });
  } catch {
    // Cache kaydı başarısız olsa bile gönderim zaten tamamlandı
  }
}

export async function sendDailyTelegramDigest(options?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: Date;
  force?: boolean;
  sourceLabel?: string;
}): Promise<TelegramDigestResult> {
  const env = options?.env ?? process.env;
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const now = options?.now ?? new Date();
  const force = Boolean(options?.force);
  const sourceLabel = options?.sourceLabel ?? "api";
  const todayKey = getIstanbulDateKey(now);

  const botToken = (env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (env.TELEGRAM_CHAT_ID || "").trim();

  if (!botToken || !chatId) {
    return {
      ok: false,
      skipped: true,
      date: todayKey,
      reason: "TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID tanımlı değil.",
    };
  }

  const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const supabaseKey = (
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!force) {
    if (inMemorySentDates.has(todayKey)) {
      return {
        ok: true,
        skipped: true,
        date: todayKey,
        reason: "already_sent_today",
      };
    }
    const alreadySentInDb = await checkAlreadySentTodayInSupabase(
      supabaseUrl,
      supabaseKey,
      todayKey,
      fetchImpl
    );
    if (alreadySentInDb) {
      inMemorySentDates.add(todayKey);
      return {
        ok: true,
        skipped: true,
        date: todayKey,
        reason: "already_sent_today",
      };
    }
  }

  const [monitorData, alerts, protocolMembers, aiSummaries] = await Promise.all([
    supabaseRestGet<MonitorDataRow>(
      supabaseUrl,
      supabaseKey,
      "monitor_data",
      "select=source,district_name,content,sentiment,category,created_at&order=created_at.desc&limit=30",
      fetchImpl
    ),
    supabaseRestGet<AlertEventRow>(
      supabaseUrl,
      supabaseKey,
      "alert_events",
      "select=*&order=created_at.desc&limit=10",
      fetchImpl
    ),
    supabaseRestGet<ProtocolMemberRow>(
      supabaseUrl,
      supabaseKey,
      "protocol_members",
      "select=*&limit=60",
      fetchImpl
    ),
    supabaseRestGet<AiSummaryRow>(
      supabaseUrl,
      supabaseKey,
      "ai_summaries",
      "select=*&order=date.desc&limit=5",
      fetchImpl
    ),
  ]);

  const resolvedSiteUrl = env.PUBLIC_APP_URL
    ? String(env.PUBLIC_APP_URL)
    : env.VERCEL_URL
    ? `https://${String(env.VERCEL_URL).replace(/^https?:\/\//i, "")}`
    : undefined;

  const htmlMessage = buildDailyDigestHtml({
    dateHeader: formatTurkishDateHeader(now),
    monitorData,
    alerts,
    protocolMembers,
    aiSummaries,
    siteUrl: resolvedSiteUrl,
  });

  const telegramEndpoint = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  const telegramRes = await fetchImpl(telegramEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: htmlMessage,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const telegramJson = (await telegramRes.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  } | null;

  if (!telegramRes.ok || !telegramJson?.ok) {
    return {
      ok: false,
      date: todayKey,
      error: telegramJson?.description || `Telegram API HTTP ${telegramRes.status}`,
    };
  }

  const messageId =
    typeof telegramJson?.result?.message_id === "number" ? telegramJson.result.message_id : null;

  inMemorySentDates.add(todayKey);
  await recordSentTodayInSupabase(
    supabaseUrl,
    supabaseKey,
    todayKey,
    messageId,
    sourceLabel,
    fetchImpl
  );

  return {
    ok: true,
    skipped: false,
    date: todayKey,
    messageId,
    counts: {
      monitorData: monitorData.length,
      alerts: alerts.length,
      protocolMembers: protocolMembers.length,
      aiSummaries: aiSummaries.length,
    },
  };
}

function sendJson(res: VercelResponse, statusCode: number, body: unknown): void {
  if (typeof res.setHeader === "function") {
    res.setHeader("Cache-Control", "no-store");
  }
  if (typeof res.status === "function" && typeof res.json === "function") {
    res.status(statusCode).json(body);
    return;
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    return;
  }

  const auth = verifyDigestAuth(req.headers?.authorization, process.env);
  if (!auth.authorized) {
    sendJson(res, auth.statusCode, { ok: false, error: auth.reason || "Unauthorized" });
    return;
  }

  try {
    const result = await sendDailyTelegramDigest({ sourceLabel: "vercel-api" });
    const statusCode = result.ok ? 200 : result.skipped ? 503 : 502;
    sendJson(res, statusCode, result);
  } catch (err) {
    console.error("[/api/telegram/send-digest] unexpected error:", err instanceof Error ? err.message : "unknown");
    sendJson(res, 500, { ok: false, error: "Telegram bülteni gönderilirken sunucu hatası oluştu." });
  }
}
