#!/usr/bin/env node
/**
 * Muğla Monitör v2 — 1. Ajan: 7/24 Free-Tier Otonom İstihbarat İşçisi
 *
 * Her 6 saatte bir (00:00, 06:00, 12:00, 18:00 UTC) cron / sunucu zamanlayıcısı ile çalışır:
 * - 13 Muğla ilçesini 4 bölgesel grup halinde sırayla tarar (günde 4, ayda 120 Gemini Search Grounding isteği = %8 ücretsiz kota).
 * - Her 6 saatlik turda ilgili bölgesel gruba atanmış `topic-grounding` sektörel sorgularını (7 sektörün tamamı 24 saatte döner) tek çağrıda tarar.
 * - Doğrulanmış verileri doğrudan Supabase `social_keywords`, `social_posts`, `alert_events` ve `live_data_cache` (dams + topic_grounding:*) tablolarına yazar.
 * - Her çalışmada hafif bir Supabase sorgusu yürüterek ücretsiz Supabase veritabanının 7 günlük inaktivite uykusuna geçmesini engeller.
 *
 * Kullanım:
 *   node scripts/run-autonomous-agent.mjs
 *   node scripts/run-autonomous-agent.mjs --dry-run --group=A
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

export const AGENT_MODEL = "gemini-4-hydrogen";
export const AGENT_SOURCE = "autonomous-intel-agent";
export const MONTHLY_FREE_GROUNDING_QUOTA = 1500;

const INVISIBLE_ENV_CHARS_RE = /[\r\n\t\u200B-\u200D\uFEFF]+/g;
const EDGE_QUOTES_AND_SPACE_RE =
  /^[\s\u00A0"'`\u201C\u201D\u2018\u2019\\]+|[\s\u00A0"'`\u201C\u201D\u2018\u2019\\]+$/g;
const EDGE_ENCODED_TOKENS_RE = /^(?:%20|%22|%27)+|(?:%20|%22|%27|%2F)+$/gi;

/**
 * Ortam değişkeni anahtarından dış boşluk, satır sonu, tırnak ve yanlışlıkla
 * yapıştırılan KEY= önekini temizler.
 */
export function sanitizeEnvSecret(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return "";
  let cleaned = rawValue.replace(INVISIBLE_ENV_CHARS_RE, "").replace(/\u00A0/g, " ").trim();
  let prev = "";
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(EDGE_ENCODED_TOKENS_RE, "")
      .replace(EDGE_QUOTES_AND_SPACE_RE, "")
      .replace(
        /^(?:VITE_)?(?:SUPABASE_(?:SERVICE_ROLE|ANON|PUBLISHABLE)_KEY|GEMINI_API_KEY)\s*=\s*/i,
        ""
      )
      .trim();
  }
  return cleaned;
}

/**
 * SUPABASE_URL değerini temizler: baş/son boşluk ve tırnakları, sondaki `/`
 * işaretini ve varsa `/rest/v1`, `/auth/v1` vb. alt yolları otomatik kaldırır;
 * yalnızca temiz `https://<proje-id>.supabase.co` kök adresini döndürür.
 */
export function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  let cleaned = rawUrl.replace(INVISIBLE_ENV_CHARS_RE, "").replace(/\u00A0/g, " ").trim();
  let prev = "";
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned
      .replace(EDGE_ENCODED_TOKENS_RE, "")
      .replace(EDGE_QUOTES_AND_SPACE_RE, "")
      .replace(/^(?:VITE_)?SUPABASE_URL\s*=\s*/i, "")
      .trim();
  }
  cleaned = cleaned.replace(/\/+$/, "").trim();
  if (!cleaned) return "";

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

  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch {
    return "";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  const host = parsed.hostname.toLowerCase();
  if (!host || (!host.includes(".") && host !== "localhost")) return "";

  if (host === "supabase.com" || host === "www.supabase.com" || host === "app.supabase.com") {
    const dashboardMatch = parsed.pathname.match(
      /^\/(?:dashboard\/)?project\/([a-z0-9][a-z0-9-]{2,62})(?:\/|$)/i
    );
    if (dashboardMatch?.[1]) {
      return `https://${dashboardMatch[1].toLowerCase()}.supabase.co`;
    }
    return "";
  }

  if (host.endsWith(".supabase.co")) {
    const portSuffix = parsed.port ? `:${parsed.port}` : "";
    return `https://${host}${portSuffix}`;
  }

  return parsed.origin.replace(/\/+$/, "");
}

/**
 * Çalıştırma ortamındaki Gemini ve Supabase değişkenlerini otomatik uyumlu biçimde çözer.
 * SUPABASE_SERVICE_ROLE_KEY yoksa SUPABASE_ANON_KEY (veya VITE_ yedekleri) ile devam eder.
 */
export function resolveAgentEnv(env = process.env, options = {}) {
  const geminiApiKey = sanitizeEnvSecret(options.geminiApiKey ?? env?.GEMINI_API_KEY ?? "");
  const geminiModel =
    sanitizeEnvSecret(options.model ?? env?.GEMINI_MODEL ?? "") || AGENT_MODEL;
  const supabaseUrl = normalizeSupabaseUrl(
    options.supabaseUrl ?? env?.SUPABASE_URL ?? env?.VITE_SUPABASE_URL ?? ""
  );

  const serviceKey = sanitizeEnvSecret(
    options.supabaseServiceRoleKey ?? env?.SUPABASE_SERVICE_ROLE_KEY ?? ""
  );
  const explicitKey = sanitizeEnvSecret(options.supabaseKey ?? "");
  const anonKey = sanitizeEnvSecret(
    options.supabaseAnonKey ??
      env?.SUPABASE_ANON_KEY ??
      env?.VITE_SUPABASE_ANON_KEY ??
      env?.SUPABASE_PUBLISHABLE_KEY ??
      env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
      ""
  );

  const supabaseKey = explicitKey || serviceKey || anonKey;
  const supabaseKeyType = explicitKey
    ? "explicit"
    : serviceKey
    ? "service_role"
    : anonKey
    ? "anon"
    : "missing";

  const systemUserId =
    sanitizeEnvSecret(options.systemUserId ?? env?.AGENT_SYSTEM_USER_ID ?? "") || null;

  return {
    geminiApiKey,
    geminiModel,
    supabaseUrl,
    supabaseKey,
    supabaseKeyType,
    systemUserId,
  };
}

export const SECTOR_TOPIC_QUERIES = {
  environment_dams:
    '"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı',
  transport_infra:
    '"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik',
  energy_outages:
    '"ADM Elektrik" Muğla planlı kesinti OR arıza OR elektrik kesintisi',
  security_quakes:
    '("AFAD" OR "Kandilli") Muğla deprem OR ("Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" asayiş OR "trafik kazası" OR "Sahil Güvenlik" OR yangın)',
  tourism_occupancy:
    '"Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" otel doluluk oranı OR turist sayısı OR Dalaman Havalimanı yolcu 2026',
  economy_budget:
    '"Muğla Büyükşehir Belediyesi" OR "MUSKİ" OR "Bodrum Belediyesi" OR "Marmaris Belediyesi" bütçe milyar TL OR ihale 2026 OR 2027',
  protocol_activity:
    '("Muğla Valisi" OR "Muğla Büyükşehir Belediye Başkanı" OR "Ahmet Aras" OR "İdris Akbıyık" OR "Muğla Kaymakam" OR "Muğla Başsavcı") ziyaret OR açıklama OR atama son 24 saat',
};

// 6 saatlik 4 turda (günde 4 çağrı = ayda 120 çağrı = %8 kota) 7 sektörün tamamını kapsayan rotasyon
export const GROUP_TOPIC_ASSIGNMENTS = {
  A: ["environment_dams", "transport_infra"],
  B: ["energy_outages", "tourism_occupancy"],
  C: ["security_quakes", "economy_budget"],
  D: ["protocol_activity", "environment_dams"],
};

export function selectTopicsForGroup(groupOrId) {
  const id =
    typeof groupOrId === "string"
      ? groupOrId.trim().toUpperCase()
      : String(groupOrId?.id || "A").trim().toUpperCase();
  return GROUP_TOPIC_ASSIGNMENTS[id] || GROUP_TOPIC_ASSIGNMENTS.A;
}

export const MUGLA_DAM_CAPACITIES = [
  { id: "mumcular", name: "Mumcular Barajı", capacity_hm3: 18.6, district: "Bodrum", aliases: ["mumcular"] },
  { id: "geyik", name: "Geyik Barajı", capacity_hm3: 40.8, district: "Milas", aliases: ["geyik"] },
  { id: "akgedik", name: "Akgedik Barajı", capacity_hm3: 26.3, district: "Milas", aliases: ["akgedik"] },
  { id: "marmaris", name: "Marmaris (Atatürk) Barajı", capacity_hm3: 30.0, district: "Marmaris", aliases: ["marmaris baraj", "atatürk baraj"] },
  { id: "akkopru", name: "Akköprü Barajı ve HES", capacity_hm3: 384.5, district: "Dalaman", aliases: ["akköprü"] },
  { id: "bayir", name: "Bayır Barajı", capacity_hm3: 7.1, district: "Menteşe", aliases: ["bayır"] },
  { id: "esen1", name: "Eşen 1 Barajı ve HES", capacity_hm3: 22.9, district: "Seydikemer", aliases: ["eşen 1", "eşen-1"] },
  { id: "esen2", name: "Eşen 2 Barajı ve HES", capacity_hm3: 6.4, district: "Seydikemer", aliases: ["eşen 2", "eşen-2"] },
];

export const DISTRICT_GROUPS = [
  {
    id: "A",
    name: "Kuzey ve Batı Yarımada",
    utcHourSlot: 0,
    districts: ["Bodrum", "Milas", "Yatağan", "Kavaklıdere"],
  },
  {
    id: "B",
    name: "Güneybatı Körfez",
    utcHourSlot: 6,
    districts: ["Marmaris", "Datça", "Ula"],
  },
  {
    id: "C",
    name: "Doğu Muğla ve Turizm Koridoru",
    utcHourSlot: 12,
    districts: ["Fethiye", "Seydikemer", "Dalaman"],
  },
  {
    id: "D",
    name: "Merkez ve İç Bölge",
    utcHourSlot: 18,
    districts: ["Menteşe", "Ortaca", "Köyceğiz"],
  },
];

export const DISTRICT_COORDS = {
  Bodrum: { lat: 37.0344, lon: 27.4305 },
  Milas: { lat: 37.3164, lon: 27.7839 },
  Yatağan: { lat: 37.3396, lon: 28.1369 },
  Kavaklıdere: { lat: 37.4453, lon: 28.3664 },
  Marmaris: { lat: 36.855, lon: 28.2742 },
  Datça: { lat: 36.726, lon: 27.6869 },
  Ula: { lat: 37.1031, lon: 28.4167 },
  Fethiye: { lat: 36.6213, lon: 29.1164 },
  Seydikemer: { lat: 36.649, lon: 29.366 },
  Dalaman: { lat: 36.7667, lon: 28.8028 },
  Menteşe: { lat: 37.2153, lon: 28.3636 },
  Ortaca: { lat: 36.8392, lon: 28.7647 },
  Köyceğiz: { lat: 36.9692, lon: 28.69 },
};

const VALID_CATEGORIES = new Set([
  "altyapi",
  "ulasim",
  "cevre",
  "turizm",
  "ekonomi",
  "guvenlik",
  "saglik",
  "belediye",
  "genel",
]);

const VALID_SENTIMENTS = new Set(["positive", "negative", "neutral"]);
const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

/**
 * 6 saatlik zaman dilimine veya manuel grup koduna (A/B/C/D) göre taranacak ilçe grubunu seçer.
 */
export function selectRegionalGroup(dateOrGroup = new Date()) {
  if (typeof dateOrGroup === "string" && dateOrGroup.trim()) {
    const normalized = dateOrGroup.trim().toUpperCase();
    const matched = DISTRICT_GROUPS.find((g) => g.id === normalized);
    if (matched) return matched;
  }

  const date = dateOrGroup instanceof Date ? dateOrGroup : new Date(dateOrGroup);
  const utcHour = Number.isNaN(date.getTime()) ? 0 : date.getUTCHours();
  const slotIndex = Math.floor(utcHour / 6) % DISTRICT_GROUPS.length;
  return DISTRICT_GROUPS[slotIndex];
}

/**
 * Aylık ücretsiz Search Grounding kotasının yüzde kaçının kullanıldığını hesaplar.
 * Hedef: %15'in altında kalmak (4 çağrı/gün * 30 gün = 120 / 1500 = %8.0).
 */
export function calculateMonthlyQuotaUsage(
  runsPerDay = 4,
  daysPerMonth = 30,
  monthlyFreeQuota = MONTHLY_FREE_GROUNDING_QUOTA
) {
  const monthlyCalls = runsPerDay * daysPerMonth;
  const percentUsed = Number(((monthlyCalls / monthlyFreeQuota) * 100).toFixed(2));
  return {
    runsPerDay,
    monthlyCalls,
    monthlyFreeQuota,
    percentUsed,
    withinBudget: percentUsed <= 15,
  };
}

/**
 * Model yanıtından JSON nesnesini güvenli şekilde ayıklar.
 */
export function extractJsonFromModelText(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();

  // Kod bloğu içindeyse çıkar
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Kaynak adresinin gerçekten geçerli, herkese açık bir http(s) URL'si olduğunu doğrular.
 * Yerel adresleri (localhost/127.0.0.1) ve geçersiz metinleri reddeder.
 */
export function isValidExternalSourceUrl(uri) {
  if (typeof uri !== "string") return false;
  const trimmed = uri.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".")) return false;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".invalid")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Gemini Grounding çıktısını doğrular ve standart yapıya dönüştürür.
 * Canlı modda (allowDryRun !== true) doğrulanmış dış kaynak URL'si veya
 * Google Search Grounding kaynağı olmayan hiçbir gönderi, uyarı veya kelime üretilmez.
 */
export function normalizeAgentFindings(rawJson, group, groundingChunks = [], options = {}) {
  const allowUnverified = Boolean(options?.allowDryRun);

  const fallbackUrls = groundingChunks
    .map((chunk) => chunk?.web?.uri)
    .filter((uri) => isValidExternalSourceUrl(uri))
    .map((uri) => uri.trim());

  const allowedDistricts = new Set(Object.keys(DISTRICT_COORDS));
  const normalizeDistrict = (raw) => {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (allowedDistricts.has(trimmed)) return trimmed;
    const lower = trimmed.toLocaleLowerCase("tr-TR");
    if (lower === "muğla merkez" || lower === "mugla merkez" || lower === "mentese") return "Menteşe";
    if (lower === "kavaklidere") return "Kavaklıdere";
    return null;
  };
  const defaultDistrict = group?.districts?.[0] || "Menteşe";

  const rawPosts = Array.isArray(rawJson?.posts) ? rawJson.posts : [];
  const posts = rawPosts
    .map((item, idx) => {
      const title = typeof item?.title === "string" ? item.title.trim() : "";
      const summary = typeof item?.summary === "string" ? item.summary.trim() : "";
      const content = [title, summary].filter(Boolean).join(" — ").slice(0, 1200);
      if (!content || content.length < 12) return null;

      const district = normalizeDistrict(item?.district) || defaultDistrict;
      const category = VALID_CATEGORIES.has(item?.category) ? item.category : "genel";
      const sentiment = VALID_SENTIMENTS.has(item?.sentiment) ? item.sentiment : "neutral";
      const severity = VALID_SEVERITIES.has(item?.severity) ? item.severity : "medium";
      const url = isValidExternalSourceUrl(item?.source_url)
        ? item.source_url.trim()
        : fallbackUrls[idx] || fallbackUrls[0] || null;

      // Doğrulanmış kaynak URL'si yoksa canlı modda kaydı tamamen reddet
      if (!allowUnverified && !url) return null;

      const sourceName =
        typeof item?.source_name === "string" && item.source_name.trim()
          ? item.source_name.trim().slice(0, 120)
          : "Muğla Yerel Basın (Grounding)";
      const keywords = Array.isArray(item?.keywords)
        ? item.keywords
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter((k) => k.length >= 2 && k.length <= 60)
            .slice(0, 8)
        : [];

      return {
        title: title || content.slice(0, 120),
        content,
        district,
        category,
        sentiment,
        severity,
        url,
        sourceName,
        keywords,
      };
    })
    .filter(Boolean)
    .slice(0, 12);

  const rawAlerts = Array.isArray(rawJson?.alerts) ? rawJson.alerts : [];
  const alerts = rawAlerts
    .map((item) => {
      const title = typeof item?.title === "string" ? item.title.trim().slice(0, 200) : "";
      const body = typeof item?.body === "string" ? item.body.trim().slice(0, 800) : "";
      if (!title) return null;

      const sourceUrl = isValidExternalSourceUrl(item?.source_url)
        ? item.source_url.trim()
        : fallbackUrls[0] || null;

      // Teyitli dış kaynak veya grounding URL'si olmadan asla uyarı üretme
      if (!allowUnverified && !sourceUrl) return null;

      const district = allowedDistricts.has(item?.district) ? item.district : defaultDistrict;
      const severity = VALID_SEVERITIES.has(item?.severity) ? item.severity : "high";
      const type =
        typeof item?.type === "string" && item.type.trim()
          ? item.type.trim().slice(0, 50)
          : "field_intel";

      return { title, body, district, severity, type, sourceUrl };
    })
    .filter(Boolean)
    .slice(0, 5);

  const rawDamUpdates = Array.isArray(rawJson?.dam_updates) ? rawJson.dam_updates : [];
  const damUpdates = rawDamUpdates
    .map((item) => {
      const rawName = typeof item?.dam_name === "string" ? item.dam_name.toLocaleLowerCase("tr-TR") : "";
      const matchedDam = MUGLA_DAM_CAPACITIES.find((d) =>
        d.aliases.some((alias) => rawName.includes(alias))
      );
      const rate = Number(item?.occupancy_rate);
      const sourceUrl = isValidExternalSourceUrl(item?.source_url)
        ? item.source_url.trim()
        : fallbackUrls[0] || null;
      if (!matchedDam || !Number.isFinite(rate) || rate < 0 || rate > 100) return null;
      if (!allowUnverified && !sourceUrl) return null;
      const measuredAt =
        typeof item?.published_date === "string" && !Number.isNaN(new Date(item.published_date).getTime())
          ? new Date(item.published_date).toISOString()
          : new Date().toISOString();
      return {
        damId: matchedDam.id,
        damName: matchedDam.name,
        district: matchedDam.district,
        capacityHm3: matchedDam.capacity_hm3,
        occupancyRate: Math.round(rate * 10) / 10,
        sourceName:
          typeof item?.source_name === "string" && item.source_name.trim()
            ? item.source_name.trim().slice(0, 80)
            : "Yerel Basın/DSİ",
        sourceUrl,
        measuredAt,
        confidence: item?.confidence === "medium" ? "medium" : "high",
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  const parseIsoDate = (raw) =>
    typeof raw === "string" && !Number.isNaN(new Date(raw).getTime())
      ? new Date(raw).toISOString()
      : new Date().toISOString();

  const resolveUrl = (rawUrl, idx = 0) =>
    isValidExternalSourceUrl(rawUrl)
      ? rawUrl.trim()
      : fallbackUrls[idx] || fallbackUrls[0] || null;

  const transportIncidents = (Array.isArray(rawJson?.transport_incidents) ? rawJson.transport_incidents : [])
    .map((item, idx) => {
      const title = typeof item?.title === "string" ? item.title.trim().slice(0, 180) : "";
      const sourceUrl = resolveUrl(item?.source_url, idx);
      if (!title || (!allowUnverified && !sourceUrl)) return null;
      return {
        id: `agent-tr-${idx}-${Date.now()}`,
        title,
        district: normalizeDistrict(item?.district) || defaultDistrict,
        category: ["yol_calismasi", "isale_hatti", "trafik"].includes(item?.category)
          ? item.category
          : "yol_calismasi",
        status: ["devam", "tamamlandı", "uyarı"].includes(item?.status) ? item.status : "devam",
        sourceName:
          typeof item?.source_name === "string" && item.source_name.trim()
            ? item.source_name.trim().slice(0, 80)
            : "Yerel Basın",
        sourceUrl: sourceUrl || "",
        publishedAt: parseIsoDate(item?.published_date),
        confidence: item?.confidence === "medium" ? "medium" : "high",
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  const energyOutages = (Array.isArray(rawJson?.energy_outages) ? rawJson.energy_outages : [])
    .map((item, idx) => {
      const summary = typeof item?.summary === "string" ? item.summary.trim().slice(0, 200) : "";
      const sourceUrl = resolveUrl(item?.source_url, idx);
      if (!summary || (!allowUnverified && !sourceUrl)) return null;
      return {
        id: `agent-en-${idx}-${Date.now()}`,
        district: normalizeDistrict(item?.district) || defaultDistrict,
        neighborhoods:
          typeof item?.neighborhoods === "string" ? item.neighborhoods.trim().slice(0, 120) : "",
        type: item?.type === "ariza" ? "ariza" : "planli",
        status: ["aktif", "planli", "giderildi"].includes(item?.status) ? item.status : "planli",
        summary,
        sourceName:
          typeof item?.source_name === "string" && item.source_name.trim()
            ? item.source_name.trim().slice(0, 80)
            : "ADM Elektrik",
        sourceUrl: sourceUrl || "",
        publishedAt: parseIsoDate(item?.published_date),
        confidence: item?.confidence === "medium" ? "medium" : "high",
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  const securityEvents = (Array.isArray(rawJson?.security_events) ? rawJson.security_events : [])
    .map((item, idx) => {
      const title = typeof item?.title === "string" ? item.title.trim().slice(0, 180) : "";
      const sourceUrl = resolveUrl(item?.source_url, idx);
      if (!title || (!allowUnverified && !sourceUrl)) return null;
      const mag = item?.magnitude !== undefined && item?.magnitude !== null ? Number(item.magnitude) : null;
      const depth = item?.depth_km !== undefined && item?.depth_km !== null ? Number(item.depth_km) : null;
      return {
        id: `agent-sec-${idx}-${Date.now()}`,
        category: ["deprem", "asayis", "deniz_guvenligi", "trafik_kazasi", "yangin"].includes(
          item?.category
        )
          ? item.category
          : "asayis",
        title,
        district: normalizeDistrict(item?.district) || defaultDistrict,
        magnitude: mag !== null && Number.isFinite(mag) && mag > 0 && mag < 10 ? Math.round(mag * 10) / 10 : null,
        depthKm: depth !== null && Number.isFinite(depth) && depth >= 0 ? Math.round(depth * 10) / 10 : null,
        severity: ["kritik", "yuksek", "normal"].includes(item?.severity) ? item.severity : "normal",
        sourceName:
          typeof item?.source_name === "string" && item.source_name.trim()
            ? item.source_name.trim().slice(0, 80)
            : "AFAD / Yerel Basın",
        sourceUrl: sourceUrl || "",
        publishedAt: parseIsoDate(item?.published_date),
        confidence: item?.confidence === "medium" ? "medium" : "high",
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  const rawTourism = rawJson?.tourism_metrics;
  let tourismMetrics = null;
  if (rawTourism && typeof rawTourism === "object") {
    const tUrl = resolveUrl(rawTourism.source_url, 0);
    const occNum =
      rawTourism.hotel_occupancy_pct !== null && rawTourism.hotel_occupancy_pct !== undefined
        ? Number(rawTourism.hotel_occupancy_pct)
        : NaN;
    const annualTourists =
      typeof rawTourism.annual_tourists === "string" && rawTourism.annual_tourists.trim()
        ? rawTourism.annual_tourists.trim().slice(0, 40)
        : null;
    const airportPassengers =
      typeof rawTourism.airport_passengers === "string" && rawTourism.airport_passengers.trim()
        ? rawTourism.airport_passengers.trim().slice(0, 40)
        : null;
    const districtRates = (Array.isArray(rawTourism.district_rates) ? rawTourism.district_rates : [])
      .map((r, idx) => {
        const rate = Number(r?.occupancy_pct);
        const rUrl = resolveUrl(r?.source_url || tUrl, idx);
        if (!r?.district || !Number.isFinite(rate) || rate < 0 || rate > 100) return null;
        if (!allowUnverified && !rUrl) return null;
        return {
          district: String(r.district).trim(),
          occupancyPct: Math.round(rate * 10) / 10,
          sourceName: String(r.source_name || rawTourism.source_name || "TÜRSAB / Yerel Basın").trim(),
          sourceUrl: rUrl || "",
          measuredAt: parseIsoDate(r.published_date || rawTourism.published_date),
        };
      })
      .filter(Boolean)
      .slice(0, 4);
    const headlines = (Array.isArray(rawTourism.headlines) ? rawTourism.headlines : [])
      .map((h, idx) => {
        const hUrl = resolveUrl(h?.source_url || tUrl, idx);
        if (!h?.title || (!allowUnverified && !hUrl)) return null;
        return {
          title: String(h.title).trim().slice(0, 160),
          district: normalizeDistrict(h.district) || defaultDistrict,
          sourceName: String(h.source_name || rawTourism.source_name || "Yerel Basın").trim(),
          sourceUrl: hUrl || "",
          publishedAt: parseIsoDate(h.published_date || rawTourism.published_date),
        };
      })
      .filter(Boolean)
      .slice(0, 4);

    if (
      (allowUnverified || tUrl || districtRates.length > 0 || headlines.length > 0) &&
      (Number.isFinite(occNum) ||
        annualTourists !== null ||
        airportPassengers !== null ||
        districtRates.length > 0 ||
        headlines.length > 0)
    ) {
      tourismMetrics = {
        hotelOccupancyPct:
          (allowUnverified || tUrl) && Number.isFinite(occNum) && occNum >= 0 && occNum <= 100
            ? Math.round(occNum * 10) / 10
            : null,
        annualTourists: allowUnverified || tUrl ? annualTourists : null,
        airportPassengers: allowUnverified || tUrl ? airportPassengers : null,
        districtRates,
        headlines,
        sourceName: String(rawTourism.source_name || "TÜRSAB / Yerel Basın").trim(),
        sourceUrl: tUrl || undefined,
        measuredAt: parseIsoDate(rawTourism.published_date),
      };
    }
  }

  const rawEco = rawJson?.economy_updates;
  let economyUpdates = null;
  if (rawEco && typeof rawEco === "object") {
    const eUrl = resolveUrl(rawEco.source_url, 0);
    const unemp =
      rawEco.unemployment_rate !== null && rawEco.unemployment_rate !== undefined
        ? Number(rawEco.unemployment_rate)
        : NaN;
    const rawBudgets = Array.isArray(rawEco.municipal_budgets) ? rawEco.municipal_budgets : [];
    const municipalBudgets = rawBudgets
      .map((b, idx) => {
        const institution = typeof b?.institution === "string" ? b.institution.trim().slice(0, 80) : "";
        const amountBn = Number(b?.amount_billion_try ?? b?.amountBillionTry);
        const bUrl = resolveUrl(b?.source_url || eUrl, idx);
        if (!institution || !Number.isFinite(amountBn) || amountBn <= 0 || amountBn > 500) return null;
        if (!allowUnverified && !bUrl) return null;
        const yrRaw = b?.year !== null && b?.year !== undefined ? Number(b.year) : NaN;
        const yoyRaw =
          b?.yoy_change_pct !== null && b?.yoy_change_pct !== undefined
            ? Number(b.yoy_change_pct)
            : b?.yoyChangePct !== null && b?.yoyChangePct !== undefined
            ? Number(b.yoyChangePct)
            : NaN;
        const invRaw =
          b?.investment_billion_try !== null && b?.investment_billion_try !== undefined
            ? Number(b.investment_billion_try)
            : b?.investmentBillionTry !== null && b?.investmentBillionTry !== undefined
            ? Number(b.investmentBillionTry)
            : NaN;
        return {
          institution,
          amountBillionTry: Math.round(amountBn * 100) / 100,
          year: Number.isFinite(yrRaw) && yrRaw >= 2020 && yrRaw <= 2035 ? Math.round(yrRaw) : null,
          yoyChangePct:
            Number.isFinite(yoyRaw) && yoyRaw > -100 && yoyRaw < 500
              ? Math.round(yoyRaw * 100) / 100
              : null,
          investmentBillionTry:
            Number.isFinite(invRaw) && invRaw > 0 && invRaw <= amountBn
              ? Math.round(invRaw * 100) / 100
              : null,
          sourceName: String(b?.source_name || rawEco.source_name || "Muğla Büyükşehir / Yerel Basın").trim(),
          sourceUrl: bUrl || "",
          publishedAt: parseIsoDate(b?.published_date || rawEco.published_date),
        };
      })
      .filter(Boolean)
      .slice(0, 12);

    const rawCombined =
      rawEco.combined_total_billion_try !== null && rawEco.combined_total_billion_try !== undefined
        ? Number(rawEco.combined_total_billion_try)
        : NaN;
    const combinedTotalBillionTry =
      (allowUnverified || eUrl || municipalBudgets.length > 0) &&
      Number.isFinite(rawCombined) &&
      rawCombined > 0 &&
      rawCombined < 500
        ? Math.round(rawCombined * 100) / 100
        : null;
    const rawBudgetYear =
      rawEco.budget_year !== null && rawEco.budget_year !== undefined ? Number(rawEco.budget_year) : NaN;
    const budgetYear =
      Number.isFinite(rawBudgetYear) && rawBudgetYear >= 2020 && rawBudgetYear <= 2035
        ? Math.round(rawBudgetYear)
        : null;
    const rawBudgetYoy =
      rawEco.budget_yoy_change_pct !== null && rawEco.budget_yoy_change_pct !== undefined
        ? Number(rawEco.budget_yoy_change_pct)
        : NaN;
    const budgetYoyChangePct =
      Number.isFinite(rawBudgetYoy) && rawBudgetYoy > -100 && rawBudgetYoy < 500
        ? Math.round(rawBudgetYoy * 100) / 100
        : null;

    const items = (Array.isArray(rawEco.items) ? rawEco.items : [])
      .map((it, idx) => {
        const itUrl = resolveUrl(it?.source_url || eUrl, idx);
        if (!it?.title || (!allowUnverified && !itUrl)) return null;
        return {
          id: `agent-eco-${idx}-${Date.now()}`,
          institution: String(it.institution || "Muğla Büyükşehir Belediyesi").trim().slice(0, 80),
          category: ["butce", "ihale", "yatirim", "isgucu"].includes(it.category)
            ? it.category
            : "yatirim",
          title: String(it.title).trim().slice(0, 180),
          amountLabel:
            typeof it.amount_label === "string" && it.amount_label.trim()
              ? it.amount_label.trim().slice(0, 40)
              : undefined,
          sourceName: String(it.source_name || rawEco.source_name || "Yerel Basın").trim(),
          sourceUrl: itUrl || "",
          publishedAt: parseIsoDate(it.published_date || rawEco.published_date),
        };
      })
      .filter(Boolean)
      .slice(0, 6);
    if (
      (allowUnverified || eUrl || municipalBudgets.length > 0 || items.length > 0) &&
      (Number.isFinite(unemp) ||
        items.length > 0 ||
        municipalBudgets.length > 0 ||
        combinedTotalBillionTry !== null)
    ) {
      economyUpdates = {
        budgetYear,
        combinedTotalBillionTry,
        budgetYoyChangePct,
        municipalBudgets,
        unemploymentRate:
          (allowUnverified || eUrl) && Number.isFinite(unemp) && unemp > 0 && unemp < 60
            ? Math.round(unemp * 10) / 10
            : null,
        unemploymentPeriod:
          typeof rawEco.unemployment_period === "string" && rawEco.unemployment_period.trim()
            ? rawEco.unemployment_period.trim().slice(0, 40)
            : null,
        unemploymentSource:
          typeof rawEco.unemployment_source === "string" && rawEco.unemployment_source.trim()
            ? rawEco.unemployment_source.trim().slice(0, 60)
            : null,
        items,
        sourceName: String(rawEco.source_name || "Muğla Büyükşehir / TÜİK").trim(),
        sourceUrl: eUrl || undefined,
        measuredAt: parseIsoDate(rawEco.published_date),
      };
    }
  }

  const protocolActivities = (
    Array.isArray(rawJson?.protocol_activities) ? rawJson.protocol_activities : []
  )
    .map((item, idx) => {
      const summary = typeof item?.summary === "string" ? item.summary.trim().slice(0, 200) : "";
      const sourceUrl = resolveUrl(item?.source_url, idx);
      if ((!item?.actor_name && !item?.actor_title) || !summary || (!allowUnverified && !sourceUrl)) {
        return null;
      }
      return {
        id: `agent-proto-${idx}-${Date.now()}`,
        actorName: String(item.actor_name || "").trim().slice(0, 80),
        actorTitle: String(item.actor_title || "").trim().slice(0, 100),
        category: ["ziyaret", "aciklama", "gorev_degisikligi"].includes(item?.category)
          ? item.category
          : "aciklama",
        summary,
        sourceName: String(item.source_name || "Muğla Valiliği / Yerel Basın").trim().slice(0, 80),
        sourceUrl: sourceUrl || "",
        publishedAt: parseIsoDate(item?.published_date),
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  const hasVerifiedBacking =
    allowUnverified ||
    posts.length > 0 ||
    fallbackUrls.length > 0 ||
    damUpdates.length > 0 ||
    transportIncidents.length > 0 ||
    energyOutages.length > 0 ||
    securityEvents.length > 0 ||
    Boolean(tourismMetrics) ||
    Boolean(economyUpdates) ||
    protocolActivities.length > 0;
  const rawKeywords =
    hasVerifiedBacking && Array.isArray(rawJson?.new_keywords) ? rawJson.new_keywords : [];
  const keywordMap = new Map();

  for (const entry of rawKeywords) {
    const keyword =
      typeof entry === "string"
        ? entry.trim()
        : typeof entry?.keyword === "string"
        ? entry.keyword.trim()
        : "";
    if (keyword.length < 2 || keyword.length > 60) continue;

    const dedupeKey = keyword.toLocaleLowerCase("tr-TR");
    if (keywordMap.has(dedupeKey)) continue;

    const category =
      typeof entry === "object" && VALID_CATEGORIES.has(entry?.category)
        ? entry.category
        : "genel";
    const region =
      typeof entry === "object" && allowedDistricts.has(entry?.district)
        ? entry.district
        : defaultDistrict;

    keywordMap.set(dedupeKey, { keyword, category, region });
  }

  // Gönderilerdeki etiketlerden de eksik olanları sözlüğe ekle
  for (const post of posts) {
    for (const kw of post.keywords) {
      const dedupeKey = kw.toLocaleLowerCase("tr-TR");
      if (!keywordMap.has(dedupeKey) && keywordMap.size < 16) {
        keywordMap.set(dedupeKey, {
          keyword: kw,
          category: post.category,
          region: post.district,
        });
      }
    }
  }

  return {
    posts,
    keywords: Array.from(keywordMap.values()).slice(0, 16),
    alerts,
    damUpdates,
    transportIncidents,
    energyOutages,
    securityEvents,
    tourismMetrics,
    economyUpdates,
    protocolActivities,
    groundingUrls: Array.from(new Set(fallbackUrls)).slice(0, 10),
  };
}

/**
 * Supabase `social_keywords`, `social_posts` ve `alert_events` tablolarına yazılacak
 * tekilleştirilmiş (deduplicated) insert kayıtlarını hazırlar.
 */
export function buildSupabasePayloads({
  findings,
  group,
  existingKeywords = [],
  existingUrls = [],
  systemUserId = null,
  now = new Date(),
  allowDryRun = false,
}) {
  const nowIso = now.toISOString();
  const validGroundingUrls = (findings.groundingUrls || []).filter((u) =>
    isValidExternalSourceUrl(u)
  );
  const existingKwSet = new Set(
    existingKeywords
      .filter((k) => typeof k === "string")
      .map((k) => k.trim().toLocaleLowerCase("tr-TR"))
  );
  const existingUrlSet = new Set(
    existingUrls.filter((u) => typeof u === "string").map((u) => u.trim())
  );

  const postRows = [];
  for (const post of findings.posts || []) {
    if (!allowDryRun && !isValidExternalSourceUrl(post.url)) continue;
    if (post.url && existingUrlSet.has(post.url)) continue;
    if (post.url) existingUrlSet.add(post.url);

    const coords = DISTRICT_COORDS[post.district] || DISTRICT_COORDS.Menteşe;
    const sentimentScore =
      post.sentiment === "positive" ? 0.65 : post.sentiment === "negative" ? -0.65 : 0.0;

    postRows.push({
      platform: "web_grounding",
      author: post.sourceName,
      content: post.content,
      url: post.url,
      district: post.district,
      category: post.category,
      sentiment: post.sentiment,
      sentiment_score: sentimentScore,
      sentiment_confidence: 0.82,
      sentiment_method: "gemini_autonomous_agent",
      keywords_matched: post.keywords,
      lat: coords.lat,
      lon: coords.lon,
      published_at: nowIso,
      collected_at: nowIso,
      analyzed_at: nowIso,
    });
  }

  const hasVerifiedTopicFindings =
    (findings.damUpdates?.length || 0) > 0 ||
    (findings.transportIncidents?.length || 0) > 0 ||
    (findings.energyOutages?.length || 0) > 0 ||
    (findings.securityEvents?.length || 0) > 0 ||
    (findings.protocolActivities?.length || 0) > 0 ||
    Boolean(findings.tourismMetrics) ||
    Boolean(findings.economyUpdates);
  const canEmitKeywords =
    allowDryRun ||
    postRows.length > 0 ||
    validGroundingUrls.length > 0 ||
    hasVerifiedTopicFindings;
  const keywordRows = [];
  if (canEmitKeywords) {
    for (const item of findings.keywords || []) {
      const key = item.keyword.trim().toLocaleLowerCase("tr-TR");
      if (!key || existingKwSet.has(key)) continue;
      existingKwSet.add(key);

      const row = {
        keyword: item.keyword.trim(),
        category: item.category || "genel",
        region: item.region || group?.districts?.[0] || "Muğla",
        platform: "all",
        is_active: true,
        created_by: AGENT_SOURCE,
      };
      if (systemUserId) {
        row.user_id = systemUserId;
      }
      keywordRows.push(row);
    }
  }

  const alertRows = [];
  for (const alert of findings.alerts || []) {
    if (alert.severity !== "high" && alert.severity !== "critical") continue;
    const verifiedAlertUrl = isValidExternalSourceUrl(alert.sourceUrl)
      ? alert.sourceUrl.trim()
      : validGroundingUrls[0] || null;

    if (!allowDryRun && !verifiedAlertUrl) continue;

    const coords = DISTRICT_COORDS[alert.district] || DISTRICT_COORDS.Menteşe;

    alertRows.push({
      type: alert.type || "field_intel",
      title: alert.title,
      body: alert.body || null,
      severity: alert.severity,
      source: AGENT_SOURCE,
      lat: coords.lat,
      lon: coords.lon,
      metadata: {
        district: alert.district,
        regional_group: group?.id || "A",
        source_url: verifiedAlertUrl,
        verified: Boolean(verifiedAlertUrl),
        grounding_urls: validGroundingUrls,
        collected_at: nowIso,
      },
    });
  }

  // Kritik veya yüksek öncelikli DOĞRULANMIŞ gönderi olup ayrıca alert üretilmemişse 1 özet uyarı ekle
  if (alertRows.length === 0) {
    const urgentPost = (findings.posts || []).find(
      (p) =>
        (p.severity === "critical" || p.severity === "high") &&
        (allowDryRun || isValidExternalSourceUrl(p.url))
    );
    if (urgentPost) {
      const coords = DISTRICT_COORDS[urgentPost.district] || DISTRICT_COORDS.Menteşe;
      alertRows.push({
        type: urgentPost.category || "field_intel",
        title: `[${urgentPost.district}] ${urgentPost.title.slice(0, 160)}`,
        body: urgentPost.content.slice(0, 600),
        severity: urgentPost.severity,
        source: AGENT_SOURCE,
        lat: coords.lat,
        lon: coords.lon,
        metadata: {
          district: urgentPost.district,
          regional_group: group?.id || "A",
          url: urgentPost.url,
          verified: isValidExternalSourceUrl(urgentPost.url),
          collected_at: nowIso,
        },
      });
    }
  }

  // 7. Topic-Grounding live_data_cache snapshot'ları (tarayıcılar Realtime ile alır, 0 ek Gemini kotası)
  const cacheRows = [];
  const groundingSources = validGroundingUrls.map((uri) => ({ uri, title: uri }));

  if (findings.damUpdates && findings.damUpdates.length > 0) {
    const updateById = new Map(findings.damUpdates.map((d) => [d.damId, d]));
    const mergedDams = MUGLA_DAM_CAPACITIES.map((base) => {
      const obs = updateById.get(base.id);
      return {
        name: base.name,
        district: base.district,
        capacity_hm3: base.capacity_hm3,
        occupancy_rate: obs ? obs.occupancyRate : null,
        source_name: obs?.sourceName ?? null,
        source_url: obs?.sourceUrl ?? null,
        measured_at: obs?.measuredAt ?? null,
        estimated: !obs,
      };
    });
    const verifiedRates = mergedDams.filter((d) => d.occupancy_rate !== null);
    const avgOcc =
      verifiedRates.length > 0
        ? Math.round(
            verifiedRates.reduce((acc, d) => acc + Number(d.occupancy_rate), 0) /
              verifiedRates.length
          )
        : null;
    const latestDamObs = findings.damUpdates[0];
    cacheRows.push({
      data_type: "dams",
      data: {
        dams: mergedDams,
        avg_occupancy: avgOcc,
        source: latestDamObs.sourceName,
        updated_at: latestDamObs.measuredAt,
      },
      fetched_at: nowIso,
    });
    cacheRows.push({
      data_type: "topic_grounding:environment_dams",
      data: {
        topic: "environment_dams",
        fetchedAt: nowIso,
        damUpdates: findings.damUpdates,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  if (findings.transportIncidents && findings.transportIncidents.length > 0) {
    cacheRows.push({
      data_type: "topic_grounding:transport_infra",
      data: {
        topic: "transport_infra",
        fetchedAt: nowIso,
        transportIncidents: findings.transportIncidents,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  if (findings.energyOutages && findings.energyOutages.length > 0) {
    cacheRows.push({
      data_type: "topic_grounding:energy_outages",
      data: {
        topic: "energy_outages",
        fetchedAt: nowIso,
        energyOutages: findings.energyOutages,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  if (findings.securityEvents && findings.securityEvents.length > 0) {
    cacheRows.push({
      data_type: "topic_grounding:security_quakes",
      data: {
        topic: "security_quakes",
        fetchedAt: nowIso,
        securityEvents: findings.securityEvents,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  if (findings.tourismMetrics) {
    cacheRows.push({
      data_type: "topic_grounding:tourism_occupancy",
      data: {
        topic: "tourism_occupancy",
        fetchedAt: nowIso,
        tourismMetrics: findings.tourismMetrics,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  if (findings.economyUpdates) {
    cacheRows.push({
      data_type: "topic_grounding:economy_budget",
      data: {
        topic: "economy_budget",
        fetchedAt: nowIso,
        economyUpdates: findings.economyUpdates,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  if (findings.protocolActivities && findings.protocolActivities.length > 0) {
    cacheRows.push({
      data_type: "topic_grounding:protocol_activity",
      data: {
        topic: "protocol_activity",
        fetchedAt: nowIso,
        protocolActivities: findings.protocolActivities,
        groundingSources,
      },
      fetched_at: nowIso,
    });
  }

  return { keywordRows, postRows, alertRows, cacheRows };
}

export function buildGroundingPrompt(group) {
  const districtList = group.districts.join(", ");
  const assignedTopics = selectTopicsForGroup(group);
  const topicLines = assignedTopics.map(
    (topicKey) => `- [${topicKey}] sorgusu: ${SECTOR_TOPIC_QUERIES[topicKey]}`
  );

  return [
    `Sen Muğla Monitör v2 için çalışan 7/24 otonom saha istihbarat ajanısın.`,
    `Görev: Google Arama (Search Grounding) kullanarak hem şu ilçelerdeki (${districtList}) güncel gelişmeleri hem de bu 6 saatlik dilime atanan sektörel topic-grounding konularını tara:`,
    ...topicLines,
    `KESİN DOĞRULAMA KURALLARI:`,
    `1. Yalnızca arama sonuçlarında doğrudan yer alan, geçerli ve doğrulanabilir bir kaynak URL'sine (https://...) sahip gelişmeleri bildir; teyitsiz sosyal medya dedikodusu, varsayım veya sentetik uyarı ASLA üretme.`,
    `2. Doğrulanmış kaynak bulunamazsa uydurma veri üretme; ilgili dizileri boş ([]) veya nesneleri null döndür.`,
    `3. Her kayıt için geçerli "source_url" alanını mutlaka doldur; ilçe adını listeden seç (${districtList}).`,
    `4. Yalnızca bu turda atanan sektörel konular (${assignedTopics.join(", ")}) için ilgili alanları doldur; diğer sektörel alanları boş bırak.`,
    `5. Hem bölgesel ilçe taramasında hem de barajlar, ulaşım/altyapı ve enerji kesintileri dahil taranan topic-grounding haberlerinde öne çıkan yeni yerel kavram, mevki veya kurum terimlerini "new_keywords" dizisine ekle.`,
    `6. Yalnızca doğrulanmış acil/yüksek öncelikli olayları (resmi kesinti, yol kapanması, isale hattı patlaması, yangın/sel, deprem) "alerts" dizisine koy.`,
    `7. Yalnızca aşağıdaki geçerli JSON formatında yanıt ver (ek açıklama yazma):`,
    JSON.stringify(
      {
        posts: [
          {
            title: "Kısa haber başlığı",
            summary: "1-2 cümlelik net özet",
            district: group.districts[0],
            category: "altyapi | ulasim | cevre | turizm | ekonomi | guvenlik | saglik | belediye | genel",
            sentiment: "positive | negative | neutral",
            severity: "low | medium | high | critical",
            source_name: "Kaynak adı",
            source_url: "https://...",
            keywords: ["kelime1", "kelime2"],
          },
        ],
        new_keywords: [
          {
            keyword: "Yeni yerel kavram veya mevki",
            category: "altyapi",
            district: group.districts[0],
          },
        ],
        alerts: [
          {
            title: "Yüksek öncelikli uyarı başlığı",
            body: "Kısa detay",
            district: group.districts[0],
            severity: "high | critical",
            type: "altyapi | trafik | cevre | guvenlik",
            source_url: "https://...",
          },
        ],
        dam_updates: [
          {
            dam_name: "Mumcular Barajı | Geyik Barajı | Akgedik Barajı | Marmaris (Atatürk) Barajı",
            occupancy_rate: 80,
            source_name: "Anter Haber | AA | MUSKİ | DSİ",
            source_url: "https://...",
            published_date: "YYYY-MM-DD",
            confidence: "high | medium",
          },
        ],
        transport_incidents: [
          {
            title: "Yol çalışması veya isale hattı gelişmesi",
            district: group.districts[0],
            category: "yol_calismasi | isale_hatti | trafik",
            status: "devam | tamamlandı | uyarı",
            source_name: "Kaynak adı",
            source_url: "https://...",
            published_date: "YYYY-MM-DD",
          },
        ],
        energy_outages: [
          {
            district: group.districts[0],
            neighborhoods: "Etkilenen mahalleler",
            type: "planli | ariza",
            status: "aktif | planli | giderildi",
            summary: "ADM Elektrik kesinti özeti",
            source_name: "ADM Elektrik",
            source_url: "https://...",
            published_date: "YYYY-MM-DD",
          },
        ],
        security_events: [
          {
            category: "deprem | asayis | deniz_guvenligi | trafik_kazasi | yangin",
            title: "Gelişme başlığı (asayiş, trafik kazası, Sahil Güvenlik, yangın veya deprem)",
            district: group.districts[0],
            magnitude: null,
            depth_km: null,
            severity: "kritik | yuksek | normal",
            source_name: "AFAD | Kandilli | Sahil Güvenlik | Muğla Emniyet | OGM | Yerel Basın",
            source_url: "https://...",
            published_date: "YYYY-MM-DD",
          },
        ],
        tourism_metrics: assignedTopics.includes("tourism_occupancy")
          ? {
              hotel_occupancy_pct: null,
              annual_tourists: null,
              airport_passengers: null,
              source_name: "BODER | GETOB | TÜRSAB | DHMİ",
              source_url: "https://...",
              published_date: "YYYY-MM-DD",
              district_rates: [
                {
                  district: "Bodrum | Marmaris | Fethiye",
                  occupancy_pct: 68,
                  source_name: "Kaynak adı",
                  source_url: "https://...",
                  published_date: "YYYY-MM-DD",
                },
              ],
              headlines: [
                {
                  title: "Doğrulanmış turizm veya havalimanı yolcu gelişmesi",
                  district: group.districts[0],
                  source_name: "Kaynak adı",
                  source_url: "https://...",
                  published_date: "YYYY-MM-DD",
                },
              ],
            }
          : null,
        economy_updates: assignedTopics.includes("economy_budget")
          ? {
              budget_year: 2026,
              combined_total_billion_try: null,
              budget_yoy_change_pct: null,
              municipal_budgets: [
                {
                  institution: "Muğla Büyükşehir Belediyesi | MUSKİ | Bodrum Belediyesi | Marmaris Belediyesi",
                  amount_billion_try: 24.3,
                  year: 2026,
                  yoy_change_pct: 30.35,
                  investment_billion_try: null,
                  source_name: "Muğla Büyükşehir | MUSKİ | Yerel Basın",
                  source_url: "https://...",
                  published_date: "YYYY-MM-DD",
                },
              ],
              unemployment_rate: null,
              unemployment_period: null,
              unemployment_source: null,
              source_name: "Muğla Büyükşehir | MUSKİ | Yerel Basın",
              source_url: "https://...",
              published_date: "YYYY-MM-DD",
              items: [
                {
                  institution: "Muğla Büyükşehir Belediyesi | MUSKİ | Bodrum Belediyesi",
                  category: "butce | ihale | yatirim | isgucu",
                  title: "Resmi meclis bütçesi veya ihale gelişmesi",
                  amount_label: "44.8 Milyar ₺",
                  source_name: "Kaynak adı",
                  source_url: "https://...",
                  published_date: "YYYY-MM-DD",
                },
              ],
            }
          : null,
        protocol_activities: [],
      },
      null,
      2
    ),
  ].join("\n");
}

function parseCliArgs(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run") || process.env.DRY_RUN === "true";
  const groupArg = argv.find((a) => a.startsWith("--group="));
  const groupOverride = groupArg
    ? groupArg.split("=")[1]
    : process.env.AGENT_GROUP_OVERRIDE || "";
  return { dryRun, groupOverride };
}

function isRetryableHttpStatus(status) {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRateLimitMessage(errOrText) {
  const msg = errOrText instanceof Error ? errOrText.message : String(errOrText || "");
  return /RESOURCE_EXHAUSTED|"code"\s*:\s*429|\b429\b|exceeded your current quota|rate[- ]?limit/i.test(
    msg
  );
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geçici ağ ve 5xx hatalarında üstel geri çekilme (exponential backoff) ile yeniden deneyen fetch sarmalayıcı.
 * Ek bağımlılık gerektirmeden Node.js 20+ yerleşik `fetch` ve `AbortSignal.timeout` kullanır.
 */
export async function fetchWithRetry(fetchFn, url, init = {}, retryOpts = {}) {
  const maxRetries = Number.isInteger(retryOpts.maxRetries) ? retryOpts.maxRetries : 2;
  const baseDelayMs = Number.isFinite(retryOpts.retryDelayMs) ? retryOpts.retryDelayMs : 800;
  const timeoutMs = Number.isFinite(retryOpts.timeoutMs) ? retryOpts.timeoutMs : 20000;
  const label = retryOpts.label || "HTTP";

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const requestInit = {
        ...init,
        signal:
          init.signal ??
          (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(timeoutMs)
            : undefined),
      };
      const res = await fetchFn(url, requestInit);
      if (isRetryableHttpStatus(res.status) && attempt < maxRetries) {
        const delay = baseDelayMs * (attempt + 1);
        console.warn(
          `[1. Ajan] [${label}] Geçici HTTP ${res.status} yanıtı (deneme ${attempt + 1}/${maxRetries + 1}), ${delay}ms sonra tekrar deneniyor...`
        );
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * (attempt + 1);
        console.warn(
          `[1. Ajan] [${label}] Geçici ağ hatası (deneme ${attempt + 1}/${maxRetries + 1}): ${err?.message || err} — ${delay}ms sonra tekrar deneniyor...`
        );
        await sleep(delay);
        continue;
      }
    }
  }
  throw lastError || new Error(`${label} isteği başarısız oldu.`);
}

async function parseErrorBody(res) {
  try {
    const text = await res.text();
    if (!text) return `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      const detail =
        parsed?.message ||
        parsed?.error?.message ||
        parsed?.hint ||
        parsed?.details ||
        text;
      return `HTTP ${res.status}: ${String(detail).slice(0, 300)}`;
    } catch {
      return `HTTP ${res.status}: ${text.slice(0, 300)}`;
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Node.js 20+ üzerinde `@supabase/supabase-js` kurulumu gerektirmeden çalışan
 * yerleşik PostgREST istemcisi.
 */
export function createSupabaseRestClient({
  supabaseUrl,
  supabaseKey,
  fetchImpl = globalThis.fetch,
  retryDelayMs = 800,
  timeoutMs = 15000,
}) {
  const baseRestUrl = `${normalizeSupabaseUrl(supabaseUrl)}/rest/v1`;
  const baseHeaders = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  return {
    async select(table, queryString) {
      const url = `${baseRestUrl}/${encodeURIComponent(table)}?${queryString}`;
      const res = await fetchWithRetry(
        fetchImpl,
        url,
        { method: "GET", headers: baseHeaders },
        { label: `Supabase SELECT ${table}`, retryDelayMs, timeoutMs }
      );
      if (!res.ok) {
        return { data: null, error: { status: res.status, message: await parseErrorBody(res) } };
      }
      const data = await res.json();
      return { data: Array.isArray(data) ? data : [], error: null };
    },

    async insert(table, rows, { ignoreDuplicates = false } = {}) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return { error: null, count: 0 };
      }
      const url = `${baseRestUrl}/${encodeURIComponent(table)}`;
      const prefer = ignoreDuplicates
        ? "resolution=ignore-duplicates,return=minimal"
        : "return=minimal";
      const res = await fetchWithRetry(
        fetchImpl,
        url,
        {
          method: "POST",
          headers: { ...baseHeaders, Prefer: prefer },
          body: JSON.stringify(rows),
        },
        { label: `Supabase INSERT ${table}`, retryDelayMs, timeoutMs }
      );
      if (!res.ok) {
        return { error: { status: res.status, message: await parseErrorBody(res) }, count: 0 };
      }
      return { error: null, count: rows.length };
    },

    async upsert(table, rowOrRows, { onConflict } = {}) {
      const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
      const url = `${baseRestUrl}/${encodeURIComponent(table)}${qs}`;
      const res = await fetchWithRetry(
        fetchImpl,
        url,
        {
          method: "POST",
          headers: {
            ...baseHeaders,
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify(rowOrRows),
        },
        { label: `Supabase UPSERT ${table}`, retryDelayMs, timeoutMs }
      );
      if (!res.ok) {
        return { error: { status: res.status, message: await parseErrorBody(res) } };
      }
      return { error: null };
    },
  };
}

/**
 * Gemini Search Grounding çağrısı.
 * Node.js 20+ üzerinde ek paket olmadan yerleşik `fetch` ile çalışır;
 * `@google/genai` yüklüyse (ve özel `fetchImpl` enjekte edilmediyse) SDK üzerinden de çağırabilir.
 */
export async function callGeminiSearchGrounding({
  apiKey,
  model = AGENT_MODEL,
  prompt,
  fetchImpl = globalThis.fetch,
  preferNativeFetch = false,
  retryDelayMs = 1000,
  timeoutMs = 45000,
}) {
  const useSdk = !preferNativeFetch && fetchImpl === globalThis.fetch;
  if (useSdk) {
    let sdkModule = null;
    try {
      sdkModule = await import("@google/genai");
    } catch {
      sdkModule = null;
    }
    if (sdkModule?.GoogleGenAI) {
      const ai = new sdkModule.GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });
      const config = {
        tools: [{ googleSearch: {} }],
      };
      if (model.startsWith("gemini-4") || model.startsWith("gemini-3")) {
        config.thinkingConfig = {
          thinkingLevel: sdkModule.ThinkingLevel?.LOW ?? "LOW",
        };
      }
      let lastSdkErr = null;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config,
          });
          return {
            text: response?.text || "",
            groundingChunks:
              response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
          };
        } catch (err) {
          lastSdkErr = err;
          if (isRateLimitMessage(err) || attempt === 2) break;
          const delay = retryDelayMs * (attempt + 1);
          console.warn(
            `[1. Ajan] [Gemini SDK] Geçici hata (deneme ${attempt + 1}/3): ${err?.message || err} — ${delay}ms sonra tekrar deneniyor...`
          );
          await sleep(delay);
        }
      }
      throw lastSdkErr;
    }
  }

  // Sıfır bağımlılıklı Node.js 20+ native fetch Gemini REST v1beta çağrısı
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  };
  if (model.startsWith("gemini-4") || model.startsWith("gemini-3")) {
    body.generationConfig = {
      thinkingConfig: { thinkingLevel: "LOW" },
    };
  }

  const res = await fetchWithRetry(
    fetchImpl,
    endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "User-Agent": "aistudio-build",
      },
      body: JSON.stringify(body),
    },
    { label: "Gemini REST Grounding", retryDelayMs, timeoutMs }
  );

  if (!res.ok) {
    const errMsg = await parseErrorBody(res);
    const err = new Error(`Gemini API hatası: ${errMsg}`);
    err.status = res.status;
    throw err;
  }

  const payload = await res.json();
  const candidate = payload?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
  const groundingChunks = Array.isArray(candidate?.groundingMetadata?.groundingChunks)
    ? candidate.groundingMetadata.groundingChunks
    : [];

  return { text, groundingChunks };
}

export async function runAutonomousAgent(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const dryRun = Boolean(options.dryRun);
  const group = selectRegionalGroup(options.groupOverride || now);
  const topics = selectTopicsForGroup(group);
  const quota = calculateMonthlyQuotaUsage();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 800;

  console.log(
    `[1. Ajan] Başlatılıyor | Grup ${group.id} (${group.name}) | İlçeler: ${group.districts.join(", ")} | Konular: ${topics.join(", ")}`
  );
  console.log(
    `[1. Ajan] Aylık Kota Kontrolü: ${quota.monthlyCalls}/${quota.monthlyFreeQuota} (%${quota.percentUsed}) — Limit ≤ %15: ${quota.withinBudget ? "UYGUN" : "AŞIM"}`
  );

  const envConfig = resolveAgentEnv(options.env ?? process.env, options);
  const {
    geminiApiKey,
    geminiModel,
    supabaseUrl,
    supabaseKey,
    supabaseKeyType,
    systemUserId: configuredSystemUserId,
  } = envConfig;

  if (dryRun) {
    const sampleFindings = normalizeAgentFindings(
      {
        posts: [
          {
            title: `${group.districts[0]} rutin saha tarama kontrolü (Dry-Run)`,
            summary: `${group.districts.join(", ")} ilçeleri için 6 saatlik otonom tarama planı doğrulandı.`,
            district: group.districts[0],
            category: "genel",
            sentiment: "neutral",
            severity: "low",
            source_name: "Dry-Run Doğrulama",
            source_url: null,
            keywords: [group.districts[0], "Muğla"],
          },
        ],
        new_keywords: [
          { keyword: `${group.districts[0]} saha izleme`, category: "genel", district: group.districts[0] },
        ],
        alerts: [],
      },
      group,
      [],
      { allowDryRun: true }
    );
    const payloads = buildSupabasePayloads({
      findings: sampleFindings,
      group,
      systemUserId: configuredSystemUserId,
      now,
      allowDryRun: true,
    });
    console.log(
      `[1. Ajan] DRY-RUN tamamlandı. Hazırlanan kayıtlar -> social_keywords: ${payloads.keywordRows.length}, social_posts: ${payloads.postRows.length}, alert_events: ${payloads.alertRows.length}`
    );
    return {
      status: "dry_run",
      group,
      topics,
      quota,
      inserted: {
        social_keywords: 0,
        social_posts: 0,
        alert_events: 0,
        dam_updates: 0,
        topic_caches: 0,
      },
      planned: {
        social_keywords: payloads.keywordRows.length,
        social_posts: payloads.postRows.length,
        alert_events: payloads.alertRows.length,
      },
      errors: [],
    };
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (veya SUPABASE_ANON_KEY) ortam değişkenleri tanımlı olmalıdır."
    );
  }

  console.log(
    `[1. Ajan] Supabase hedefi hazır: ${supabaseUrl} (anahtar türü: ${supabaseKeyType})`
  );

  const supabase = createSupabaseRestClient({
    supabaseUrl,
    supabaseKey,
    fetchImpl,
    retryDelayMs,
  });

  const errors = [];
  const recordStepError = (step, err) => {
    const message = err?.message || String(err);
    errors.push({ step, message });
    console.error(`[1. Ajan] [HATA] ${step}: ${message} — sonraki adıma devam ediliyor.`);
  };

  // 1a. Supabase Keep-Alive + mevcut social_keywords (geçici ağ hatasında sonraki adımı durdurmaz)
  let existingKwData = [];
  try {
    const { data, error } = await supabase.select(
      "social_keywords",
      "select=keyword,user_id&limit=500"
    );
    if (error) {
      recordStepError("social_keywords okuma", error);
    } else {
      existingKwData = data || [];
      console.log(
        `[1. Ajan] Supabase Keep-Alive başarılı (${existingKwData.length} mevcut kelime okundu).`
      );
    }
  } catch (err) {
    recordStepError("social_keywords okuma", err);
  }

  const existingKeywords = existingKwData.map((r) => r.keyword).filter(Boolean);
  const resolvedUserId =
    configuredSystemUserId ||
    existingKwData.find((r) => r.user_id)?.user_id ||
    null;

  // 1b. Mevcut son social_posts URL'leri (tekrarlı kayıt engelleme)
  let existingUrls = [];
  try {
    const { data, error } = await supabase.select(
      "social_posts",
      "select=url&order=collected_at.desc&limit=200"
    );
    if (error) {
      recordStepError("social_posts okuma", error);
    } else {
      existingUrls = (data || []).map((r) => r.url).filter(Boolean);
    }
  } catch (err) {
    recordStepError("social_posts okuma", err);
  }

  if (!geminiApiKey) {
    console.warn(
      "[1. Ajan] GEMINI_API_KEY eksik — yalnızca Supabase Keep-Alive tamamlandı, arama adımı atlandı."
    );
    return {
      status: "keepalive_only",
      group,
      topics,
      quota,
      inserted: {
        social_keywords: 0,
        social_posts: 0,
        alert_events: 0,
        dam_updates: 0,
        topic_caches: 0,
      },
      errors,
    };
  }

  // 2. Tek bir ücretsiz kotaya uyumlu Gemini Search Grounding çağrısı
  let groundingResponse = null;
  try {
    const prompt = buildGroundingPrompt(group);
    if (typeof options.generateGrounding === "function") {
      groundingResponse = await options.generateGrounding({
        model: geminiModel,
        prompt,
        group,
        topics,
      });
    } else {
      groundingResponse = await callGeminiSearchGrounding({
        apiKey: geminiApiKey,
        model: geminiModel,
        prompt,
        fetchImpl,
        preferNativeFetch: Boolean(options.fetchImpl) || Boolean(options.preferNativeFetch),
        retryDelayMs,
      });
    }
  } catch (err) {
    if (isRateLimitMessage(err)) {
      recordStepError("Gemini Search Grounding (429 kota limiti)", err);
    } else {
      recordStepError("Gemini Search Grounding", err);
    }
    return {
      status: "partial_error",
      group,
      topics,
      quota,
      inserted: {
        social_keywords: 0,
        social_posts: 0,
        alert_events: 0,
        dam_updates: 0,
        topic_caches: 0,
      },
      errors,
    };
  }

  const groundingChunks = Array.isArray(groundingResponse?.groundingChunks)
    ? groundingResponse.groundingChunks
    : groundingResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const rawModelText = groundingResponse?.text || "";
  const parsedJson = extractJsonFromModelText(rawModelText);
  if (!parsedJson && rawModelText.trim()) {
    console.warn(
      "[1. Ajan] Model yanıtı geçerli JSON olarak ayrıştırılamadı; doğrulanmamış veri yazımı atlanıyor."
    );
  }

  const findings = normalizeAgentFindings(parsedJson || {}, group, groundingChunks);

  const { keywordRows, postRows, alertRows, cacheRows } = buildSupabasePayloads({
    findings,
    group,
    existingKeywords,
    existingUrls,
    systemUserId: resolvedUserId,
    now,
  });

  const inserted = {
    social_keywords: 0,
    social_posts: 0,
    alert_events: 0,
    dam_updates: 0,
    topic_caches: 0,
  };

  // 3. social_keywords tablosuna ekle (append-only, eski kelimeleri asla silmez)
  if (keywordRows.length > 0) {
    try {
      const { error, count } = await supabase.insert("social_keywords", keywordRows, {
        ignoreDuplicates: true,
      });
      if (error) {
        recordStepError("social_keywords yazma", error);
      } else {
        inserted.social_keywords = count;
      }
    } catch (err) {
      recordStepError("social_keywords yazma", err);
    }
  }

  // 4. social_posts tablosuna yaz (önceki adım hata verse bile devam eder)
  if (postRows.length > 0) {
    try {
      const { error, count } = await supabase.insert("social_posts", postRows);
      if (error) {
        recordStepError("social_posts yazma", error);
      } else {
        inserted.social_posts = count;
      }
    } catch (err) {
      recordStepError("social_posts yazma", err);
    }
  }

  // 5. alert_events tablosuna yüksek öncelikli uyarıları yaz
  if (alertRows.length > 0) {
    try {
      const { error, count } = await supabase.insert("alert_events", alertRows);
      if (error) {
        recordStepError("alert_events yazma", error);
      } else {
        inserted.alert_events = count;
      }
    } catch (err) {
      recordStepError("alert_events yazma", err);
    }
  }

  // 6. Doğrulanmış baraj & sektörel topic_grounding snapshot'larını live_data_cache tablosuna yaz
  for (const cacheRow of cacheRows) {
    try {
      const { error: cacheErr } = await supabase.upsert("live_data_cache", cacheRow, {
        onConflict: "data_type",
      });
      if (cacheErr) {
        recordStepError(`live_data_cache(${cacheRow.data_type}) güncelleme`, cacheErr);
      } else {
        inserted.topic_caches += 1;
        if (cacheRow.data_type === "dams") {
          inserted.dam_updates = findings.damUpdates?.length ?? 0;
        }
      }
    } catch (err) {
      recordStepError(`live_data_cache(${cacheRow.data_type}) güncelleme`, err);
    }
  }

  const finalStatus = errors.length > 0 ? "partial_ok" : "ok";
  console.log(
    `[1. Ajan] Tamamlandı (${finalStatus}) | Grup ${group.id} | Konular: ${topics.join(", ")} | Yazılanlar -> social_keywords: ${inserted.social_keywords}, social_posts: ${inserted.social_posts}, alert_events: ${inserted.alert_events}, topic_caches: ${inserted.topic_caches} | Adım hataları: ${errors.length}`
  );

  return {
    status: finalStatus,
    group,
    topics,
    quota,
    inserted,
    errors,
  };
}

// Doğrudan CLI olarak çalıştırıldığında başlat (Vitest importlarında çalışmaz)
const isDirectExecution =
  typeof process !== "undefined" &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const { dryRun, groupOverride } = parseCliArgs();
  runAutonomousAgent({ dryRun, groupOverride }).catch((err) => {
    console.error("[1. Ajan] Kritik hata:", err?.message || err);
    process.exitCode = 1;
  });
}
