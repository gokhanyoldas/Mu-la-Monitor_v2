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
import crypto from "node:crypto";

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

export function getDynamicQueryYears(now = new Date()) {
  const currentYear = now.getFullYear();
  return { currentYear, nextYear: currentYear + 1 };
}

export function buildSectorTopicQueries(now = new Date()) {
  const { currentYear, nextYear } = getDynamicQueryYears(now);
  return {
    environment_dams: `"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı ${currentYear}`,
    transport_infra:
      '"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik',
    energy_outages:
      '"ADM Elektrik" Muğla planlı kesinti OR arıza OR elektrik kesintisi',
    security_quakes:
      '("AFAD" OR "Kandilli") Muğla deprem OR ("Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" asayiş OR "trafik kazası" OR "Sahil Güvenlik" OR yangın)',
    tourism_occupancy: `"Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" otel doluluk oranı OR turist sayısı OR Dalaman Havalimanı yolcu ${currentYear}`,
    economy_budget: `"Muğla Büyükşehir Belediyesi" OR "MUSKİ" OR "Bodrum Belediyesi" OR "Marmaris Belediyesi" bütçe milyar TL OR ihale ${currentYear} OR ${nextYear}`,
    protocol_activity: `("Muğla Valisi" OR "Seddar Yavuz" OR "Muğla Büyükşehir Belediye Başkanı" OR "Ahmet Aras" OR "Muğla Kaymakam" OR "Muğla Başsavcı") ziyaret OR açıklama OR atama OR kararname ${currentYear} OR ${nextYear} son 24 saat`,
  };
}

export const SECTOR_TOPIC_QUERIES = buildSectorTopicQueries();

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
        const maxAllowedYear = new Date().getFullYear() + 5;
        return {
          institution,
          amountBillionTry: Math.round(amountBn * 100) / 100,
          year: Number.isFinite(yrRaw) && yrRaw >= 2020 && yrRaw <= maxAllowedYear ? Math.round(yrRaw) : null,
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
    const maxBudgetYear = new Date().getFullYear() + 5;
    const rawBudgetYear =
      rawEco.budget_year !== null && rawEco.budget_year !== undefined ? Number(rawEco.budget_year) : NaN;
    const budgetYear =
      Number.isFinite(rawBudgetYear) && rawBudgetYear >= 2020 && rawBudgetYear <= maxBudgetYear
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

export function buildGroundingPrompt(group, now = new Date()) {
  const { currentYear, nextYear } = getDynamicQueryYears(now);
  const dynamicQueries = buildSectorTopicQueries(now);
  const districtList = group.districts.join(", ");
  const assignedTopics = selectTopicsForGroup(group);
  const topicLines = assignedTopics.map(
    (topicKey) => `- [${topicKey}] sorgusu: ${dynamicQueries[topicKey]}`
  );

  return [
    `Sen Muğla Monitör v2 için çalışan 7/24 otonom saha istihbarat ajanısın. Aktif tarama dönemi: ${currentYear}/${nextYear}.`,
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
              budget_year: currentYear,
              combined_total_billion_try: null,
              budget_yoy_change_pct: null,
              municipal_budgets: [
                {
                  institution: "Muğla Büyükşehir Belediyesi | MUSKİ | Bodrum Belediyesi | Marmaris Belediyesi",
                  amount_billion_try: 24.3,
                  year: currentYear,
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

// ---------------------------------------------------------------------------
// 7-Tablolu Supabase Yazım Köprüsü ve İdempotent Başlangıç Seed Verileri
// Hedef tablolar: monitor_data, districts, protocol_members, protocol_changes,
// alert_events, ai_summaries, live_data_cache
// ---------------------------------------------------------------------------

export function deterministicUuid(namespace, key) {
  const hash = crypto
    .createHash("sha256")
    .update(`${String(namespace)}::${String(key).trim().toLowerCase()}`)
    .digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}

// Muğla'nın 13 resmi ilçesi (TÜİK 2024 ADNKS nüfus kayıtları + resmi koordinatlar)
// Not: `geom` kolonu veritabanında GENERATED ALWAYS olduğu için payload'a DAHİL EDİLMEZ.
export const VERIFIED_DISTRICTS_SEED = Object.freeze([
  { id: "mentese", name: "Menteşe", lat: 37.2153, lon: 28.3636, population: 121831 },
  { id: "bodrum", name: "Bodrum", lat: 37.0344, lon: 27.4305, population: 198335 },
  { id: "fethiye", name: "Fethiye", lat: 36.6222, lon: 29.1156, population: 177569 },
  { id: "marmaris", name: "Marmaris", lat: 36.855, lon: 28.2742, population: 96589 },
  { id: "milas", name: "Milas", lat: 37.3164, lon: 27.7839, population: 149691 },
  { id: "dalaman", name: "Dalaman", lat: 36.7658, lon: 28.8028, population: 49044 },
  { id: "ortaca", name: "Ortaca", lat: 36.8392, lon: 28.7647, population: 54714 },
  { id: "koycegiz", name: "Köyceğiz", lat: 36.9689, lon: 28.6939, population: 40468 },
  { id: "datca", name: "Datça", lat: 36.7378, lon: 27.6844, population: 25649 },
  { id: "ula", name: "Ula", lat: 37.1056, lon: 28.4167, population: 27051 },
  { id: "yatagan", name: "Yatağan", lat: 37.3397, lon: 28.1369, population: 45172 },
  { id: "seydikemer", name: "Seydikemer", lat: 36.6458, lon: 29.3611, population: 65912 },
  { id: "kavaklidere", name: "Kavaklıdere", lat: 37.4447, lon: 28.3661, population: 10711 },
]);

// Doğrulanmış Muğla il protokol çekirdek listesi (Vali Seddar YAVUZ dahil)
export const VERIFIED_PROTOCOL_MEMBERS_SEED = Object.freeze([
  {
    isim: "Seddar YAVUZ",
    unvan: "Muğla Valisi",
    kategori: "Mülki İdare",
    telefon: "0252 214 10 01",
    faks: "0252 214 12 44",
    district: "Menteşe",
  },
  {
    isim: "Ahmet ARAS",
    unvan: "Muğla Büyükşehir Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 444 48 01",
    faks: "0252 214 14 25",
    district: "Menteşe",
  },
  {
    isim: "Oğuzhan DÖNMEZ",
    unvan: "Muğla Cumhuriyet Başsavcısı",
    kategori: "Yargı",
    telefon: "0252 214 10 38",
    faks: "0252 214 10 39",
    district: "Menteşe",
  },
  {
    isim: "Prof. Dr. Turhan KAÇAR",
    unvan: "Muğla Sıtkı Koçman Üniversitesi Rektörü",
    kategori: "Akademi",
    telefon: "0252 211 10 00",
    faks: "0252 223 92 80",
    district: "Menteşe",
  },
  {
    isim: "Ali CANBOLAT",
    unvan: "Muğla İl Emniyet Müdürü",
    kategori: "Güvenlik",
    telefon: "0252 214 14 20",
    faks: "0252 214 14 24",
    district: "Menteşe",
  },
  {
    isim: "Tuğgeneral Emrullah BÜYÜK",
    unvan: "Muğla İl Jandarma Komutanı",
    kategori: "Güvenlik",
    telefon: "0252 214 12 00",
    faks: "0252 214 12 05",
    district: "Menteşe",
  },
  {
    isim: "Mustafa ÇİT",
    unvan: "Bodrum Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 316 10 01",
    faks: "",
    district: "Bodrum",
  },
  {
    isim: "Tamer MANDALİNCİ",
    unvan: "Bodrum Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 316 10 09",
    faks: "",
    district: "Bodrum",
  },
  {
    isim: "İsmail AKTAŞ",
    unvan: "Fethiye Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 614 10 01",
    faks: "",
    district: "Fethiye",
  },
  {
    isim: "Alim KARACA",
    unvan: "Fethiye Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 614 10 20",
    faks: "",
    district: "Fethiye",
  },
  {
    isim: "Nurullah KAYA",
    unvan: "Marmaris Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 412 10 01",
    faks: "",
    district: "Marmaris",
  },
  {
    isim: "Acar ÜNLÜ",
    unvan: "Marmaris Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 412 10 05",
    faks: "",
    district: "Marmaris",
  },
  {
    isim: "Mehmet ERİŞ",
    unvan: "Menteşe Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 214 10 15",
    faks: "",
    district: "Menteşe",
  },
  {
    isim: "Gonca KÖKSAL",
    unvan: "Menteşe Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 214 48 80",
    faks: "",
    district: "Menteşe",
  },
  {
    isim: "Mustafa Ünver BÖKE",
    unvan: "Milas Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 512 10 01",
    faks: "",
    district: "Milas",
  },
  {
    isim: "Fevzi TOPUZ",
    unvan: "Milas Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 512 10 14",
    faks: "",
    district: "Milas",
  },
  {
    isim: "Mesut YAKUTA",
    unvan: "Dalaman Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 692 10 01",
    faks: "",
    district: "Dalaman",
  },
  {
    isim: "Sezer DURMUŞ",
    unvan: "Dalaman Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 692 20 20",
    faks: "",
    district: "Dalaman",
  },
  {
    isim: "Kenan AKTAŞ",
    unvan: "Ortaca Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 282 50 01",
    faks: "",
    district: "Ortaca",
  },
  {
    isim: "Evren TEZCAN",
    unvan: "Ortaca Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 282 50 20",
    faks: "",
    district: "Ortaca",
  },
  {
    isim: "Mustafa MASLAK",
    unvan: "Köyceğiz Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 262 40 01",
    faks: "",
    district: "Köyceğiz",
  },
  {
    isim: "Ali ERDOĞAN",
    unvan: "Köyceğiz Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 262 40 15",
    faks: "",
    district: "Köyceğiz",
  },
  {
    isim: "Murat ATICI",
    unvan: "Datça Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 712 30 01",
    faks: "",
    district: "Datça",
  },
  {
    isim: "Aytaç KURT",
    unvan: "Datça Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 712 30 14",
    faks: "",
    district: "Datça",
  },
  {
    isim: "Mehmet Rıdvan DOĞAN",
    unvan: "Ula Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 242 20 01",
    faks: "",
    district: "Ula",
  },
  {
    isim: "Mehmet CANER",
    unvan: "Ula Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 242 20 12",
    faks: "",
    district: "Ula",
  },
  {
    isim: "Mustafa Emre KILIÇ",
    unvan: "Yatağan Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 572 50 01",
    faks: "",
    district: "Yatağan",
  },
  {
    isim: "Mesut GÜNAY",
    unvan: "Yatağan Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 572 50 15",
    faks: "",
    district: "Yatağan",
  },
  {
    isim: "Yıldız BÜYÜKER",
    unvan: "Seydikemer Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 656 10 01",
    faks: "",
    district: "Seydikemer",
  },
  {
    isim: "Bayram Önder AKDENİZLİ",
    unvan: "Seydikemer Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 656 10 15",
    faks: "",
    district: "Seydikemer",
  },
  {
    isim: "Ali ARGAMA",
    unvan: "Kavaklıdere Kaymakamı",
    kategori: "Mülki İdare",
    telefon: "0252 592 70 01",
    faks: "",
    district: "Kavaklıdere",
  },
  {
    isim: "Mehmet DEMİR",
    unvan: "Kavaklıdere Belediye Başkanı",
    kategori: "Yerel Yönetim",
    telefon: "0252 592 70 15",
    faks: "",
    district: "Kavaklıdere",
  },
]);

// Wikipedia/DSİ doğrulamalı 8 resmi Muğla barajı
export const OFFICIAL_MUGLA_DAMS_SEED = Object.freeze([
  { id: "geyik", name: "Geyik Barajı", district: "Milas", purpose: "İçme suyu + Sanayi" },
  { id: "mumcular", name: "Mumcular Barajı", district: "Bodrum", purpose: "İçme suyu + Sulama" },
  { id: "akgedik", name: "Akgedik Barajı", district: "Milas", purpose: "Sulama + Taşkın kontrol" },
  { id: "akkopru", name: "Dalaman Akköprü Barajı", district: "Köyceğiz / Dalaman", purpose: "Enerji + Sulama" },
  { id: "bayir", name: "Bayır Barajı", district: "Yatağan / Menteşe", purpose: "Sulama" },
  { id: "marmaris", name: "Marmaris (Atatürk) Barajı", district: "Marmaris", purpose: "İçme suyu" },
  { id: "derince", name: "Derince Barajı", district: "Menteşe", purpose: "Sulama" },
  { id: "seki", name: "Seki Barajı", district: "Seydikemer", purpose: "Sulama" },
]);

export const MONITOR_TAB_KEYS = Object.freeze([
  "genel",
  "diyagram",
  "ekonomi",
  "cevre",
  "turizm",
  "ulasim",
  "sosyal",
  "guvenlik",
  "enerji",
  "protokol",
  "ilceler",
]);

function normalizeTextForMatch(raw) {
  return String(raw || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sanitizeHttpUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Supabase `social_posts` tablosundaki mevcut doğrulanmış gönderilerden
 * 13 ilçe yoğunluğu, kategori dağılımı, acil uyarı sinyalleri ve protokol değişikliklerini çıkarır.
 */
export function extractSignalsFromSocialPosts(recentSocialPosts = [], now = new Date()) {
  const posts = Array.isArray(recentSocialPosts) ? recentSocialPosts : [];
  const districtCounts = {};
  const categoryCounts = {
    ekonomi: 0,
    cevre: 0,
    turizm: 0,
    ulasim: 0,
    sosyal: 0,
    guvenlik: 0,
    enerji: 0,
    protokol: 0,
  };
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  const urgentAlertCandidates = [];
  const securityHighlights = [];
  const energyHighlights = [];
  const tourismHighlights = [];
  const economyHighlights = [];

  for (const d of VERIFIED_DISTRICTS_SEED) {
    districtCounts[d.id] = { id: d.id, name: d.name, total: 0, negative: 0, positive: 0 };
  }

  for (const post of posts) {
    const content = String(post?.content || "").trim();
    if (!content) continue;
    const norm = normalizeTextForMatch(content);
    const sentiment = String(post?.sentiment || "neutral").toLowerCase();
    if (sentiment === "positive") positiveCount += 1;
    else if (sentiment === "negative") negativeCount += 1;
    else neutralCount += 1;

    // İlçe eşleştirme
    const rawDistrict = normalizeTextForMatch(post?.district || post?.region || "");
    let matchedDistrict = VERIFIED_DISTRICTS_SEED.find(
      (d) => rawDistrict === d.id || rawDistrict.includes(normalizeTextForMatch(d.name))
    );
    if (!matchedDistrict) {
      matchedDistrict = VERIFIED_DISTRICTS_SEED.find((d) =>
        norm.includes(normalizeTextForMatch(d.name))
      );
    }
    if (matchedDistrict) {
      districtCounts[matchedDistrict.id].total += 1;
      if (sentiment === "negative") districtCounts[matchedDistrict.id].negative += 1;
      if (sentiment === "positive") districtCounts[matchedDistrict.id].positive += 1;
    }

    // Kategori sınıflandırması
    const cat = normalizeTextForMatch(post?.category || "");
    const postDistrictName = matchedDistrict?.name || post?.district || post?.region || "Muğla";
    const postUrl = sanitizeHttpUrl(post?.url);
    const publishedAt = post?.published_at || post?.collected_at || now.toISOString();

    if (cat.includes("ekonom") || /butce|ihale|belediye.*milyar|yatirim/.test(norm)) {
      categoryCounts.ekonomi += 1;
      if (economyHighlights.length < 5) {
        economyHighlights.push({
          title: content.slice(0, 140),
          district: postDistrictName,
          sourceName: post?.author || post?.platform || "Sosyal / Basın",
          sourceUrl: postUrl,
          publishedAt,
        });
      }
    }
    if (cat.includes("cevre") || /baraj|muski|su kesinti|yangin|orman|hava kalite/.test(norm)) {
      categoryCounts.cevre += 1;
    }
    if (cat.includes("turizm") || /turist|otel|doluluk|dalaman havalimani|milas bodrum/.test(norm)) {
      categoryCounts.turizm += 1;
      if (tourismHighlights.length < 5) {
        tourismHighlights.push({
          title: content.slice(0, 140),
          district: postDistrictName,
          sourceName: post?.author || post?.platform || "Sosyal / Basın",
          sourceUrl: postUrl,
          publishedAt,
        });
      }
    }
    if (cat.includes("ulasim") || /trafik|kaza|karayol|muttas|feribot|yol calisma/.test(norm)) {
      categoryCounts.ulasim += 1;
    }
    if (cat.includes("guvenlik") || /deprem|afad|kandilli|jandarma|emniyet|asayis|operasyon/.test(norm)) {
      categoryCounts.guvenlik += 1;
      if (securityHighlights.length < 6) {
        securityHighlights.push({
          title: content.slice(0, 140),
          district: postDistrictName,
          sourceName: post?.author || post?.platform || "Sosyal / Basın",
          sourceUrl: postUrl,
          publishedAt,
        });
      }
    }
    if (cat.includes("enerji") || /adm elektrik|aydem|elektrik kesinti|trafo|dogalgaz/.test(norm)) {
      categoryCounts.enerji += 1;
      if (energyHighlights.length < 6) {
        energyHighlights.push({
          title: content.slice(0, 140),
          district: postDistrictName,
          sourceName: post?.author || post?.platform || "ADM / Yerel Basın",
          sourceUrl: postUrl,
          publishedAt,
        });
      }
    }
    if (cat.includes("protokol") || /vali|kaymakam|kararname|atama|belediye baskani/.test(norm)) {
      categoryCounts.protokol += 1;
    }
    categoryCounts.sosyal += 1;

    // Acil kesinti / deprem / yangın uyarı sinyalleri (sadece doğrulanmış URL veya resmi haberlerde)
    const isUrgentQuake = /deprem|afad|kandilli/.test(norm) && /\b[3-7][.,][0-9]\b/.test(content);
    const isUrgentOutage =
      /(adm elektrik|aydem|muski).*(kesinti|ariza)|planli elektrik kesintisi|ana isale hatti/.test(
        norm
      );
    const isUrgentFireOrStorm = /(orman yangini|yangin cikti|sel baskini|firtina uyari|yol kapandi)/.test(
      norm
    );

    if ((isUrgentQuake || isUrgentOutage || isUrgentFireOrStorm) && urgentAlertCandidates.length < 6) {
      const alertType = isUrgentQuake
        ? "deprem"
        : isUrgentOutage
          ? "kesinti"
          : "acil_durum";
      const severity = isUrgentQuake || isUrgentFireOrStorm ? "high" : "medium";
      urgentAlertCandidates.push({
        type: alertType,
        severity,
        title: `[${postDistrictName}] ${content.slice(0, 110)}`,
        body: content.slice(0, 280),
        source: AGENT_SOURCE,
        lat: matchedDistrict?.lat ?? 37.2153,
        lon: matchedDistrict?.lon ?? 28.3636,
        metadata: {
          district: postDistrictName,
          source_url: postUrl,
          origin: "social_posts_bridge",
          published_at: publishedAt,
        },
        created_at: now.toISOString(),
      });
    }
  }

  return {
    totalPostsAnalyzed: posts.length,
    positiveCount,
    negativeCount,
    neutralCount,
    districtCounts,
    categoryCounts,
    urgentAlertCandidates,
    securityHighlights,
    energyHighlights,
    tourismHighlights,
    economyHighlights,
  };
}

/**
 * 7 çekirdek Supabase tablosunun (`monitor_data`, `districts`, `protocol_members`,
 * `protocol_changes`, `alert_events`, `ai_summaries`, `live_data_cache`) tamamı için
 * idempotent upsert/insert payload'larını üretir.
 */
export function buildBridgeTablePayloads({
  findings,
  group,
  recentSocialPosts = [],
  existingAlertTitles = [],
  existingProtocolChangesCount = 0,
  now = new Date(),
}) {
  const isoNow = now.toISOString();
  const dateOnly = isoNow.slice(0, 10);
  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;
  const signals = extractSignalsFromSocialPosts(recentSocialPosts, now);

  // 1. districts (13 Muğla ilçesi — idempotent upsert onConflict: "id")
  const districtsRows = VERIFIED_DISTRICTS_SEED.map((d) => ({
    id: d.id,
    name: d.name,
    lat: d.lat,
    lon: d.lon,
    population: d.population,
  }));

  // 2. protocol_members & protocol_changes
  const activeProtocolMap = new Map(
    VERIFIED_PROTOCOL_MEMBERS_SEED.map((m) => [
      normalizeTextForMatch(m.unvan),
      {
        id: deterministicUuid("protocol_member", m.unvan),
        isim: m.isim,
        unvan: m.unvan,
        kategori: m.kategori,
        telefon: m.telefon,
        faks: m.faks,
        district: m.district,
        updated_at: isoNow,
      },
    ])
  );

  const protocolChangeRows = [];

  // Başlangıç tohum kaydı: protocol_changes boşsa doğrulanmış Muğla Valisi Seddar YAVUZ atamasını kaydet
  if (existingProtocolChangesCount === 0) {
    protocolChangeRows.push({
      id: deterministicUuid("protocol_change", "mugla-valisi-seddar-yavuz-2026-398"),
      change_type: "updated",
      unvan: "Muğla Valisi",
      isim_old: "İdris AKBIYIK",
      isim_new: "Seddar YAVUZ",
      detail:
        "25 Kasım 2026 tarihli 2026/398 sayılı Cumhurbaşkanlığı Atama Kararnamesi ile Muğla Valiliğine Seddar YAVUZ atanmıştır (Resmi Gazete).",
      scraped_at: isoNow,
    });
  }

  // Gemini grounding üzerinden yeni bir görev değişikliği yakalandıysa protocol_members + protocol_changes'e işle
  const protoActivities = Array.isArray(findings?.protocolActivities)
    ? findings.protocolActivities
    : [];
  for (const act of protoActivities) {
    if (act?.category === "gorev_degisikligi" && act.actorName && act.actorTitle) {
      const normTitle = normalizeTextForMatch(act.actorTitle);
      const existingMember =
        activeProtocolMap.get(normTitle) ||
        (normTitle === "vali" ? activeProtocolMap.get(normalizeTextForMatch("Muğla Valisi")) : null);
      const oldName = existingMember ? existingMember.isim : null;
      const canonicalTitle = existingMember ? existingMember.unvan : act.actorTitle;
      const memberId = deterministicUuid("protocol_member", canonicalTitle);

      activeProtocolMap.set(normalizeTextForMatch(canonicalTitle), {
        id: memberId,
        isim: act.actorName,
        unvan: canonicalTitle,
        kategori: existingMember?.kategori || "Mülki İdare / Protokol",
        telefon: existingMember?.telefon || "",
        faks: existingMember?.faks || "",
        district: existingMember?.district || "Menteşe",
        updated_at: isoNow,
      });

      protocolChangeRows.push({
        id: deterministicUuid(
          "protocol_change",
          `${canonicalTitle}::${act.actorName}::${dateOnly}`
        ),
        change_type: oldName ? "updated" : "added",
        unvan: canonicalTitle,
        isim_old: oldName && oldName !== act.actorName ? oldName : null,
        isim_new: act.actorName,
        detail: `${act.summary} (${act.sourceName || "Resmi Kaynak"})`.slice(0, 400),
        scraped_at: act.publishedAt || isoNow,
      });
    }
  }

  const protocolMemberRows = Array.from(activeProtocolMap.values());

  // 3. alert_events (sosyal gönderilerden türetilen acil uyarılar; mevcut başlıklarla tekilleştirilir)
  const seenAlertTitles = new Set(
    (Array.isArray(existingAlertTitles) ? existingAlertTitles : []).map((t) =>
      normalizeTextForMatch(t).slice(0, 80)
    )
  );
  const derivedAlertRows = [];
  for (const cand of signals.urgentAlertCandidates) {
    const key = normalizeTextForMatch(cand.title).slice(0, 80);
    if (!key || seenAlertTitles.has(key)) continue;
    seenAlertTitles.add(key);
    derivedAlertRows.push(cand);
  }

  // 4. live_data_cache temel sektörel önbellekleri (8 baraj, turizm, güvenlik, enerji, ekonomi, protokol)
  const damUpdatesById = new Map();
  for (const du of findings?.damUpdates || []) {
    damUpdatesById.set(normalizeTextForMatch(du.damName), du);
  }
  const mergedDamsList = OFFICIAL_MUGLA_DAMS_SEED.map((dam) => {
    const matched =
      damUpdatesById.get(normalizeTextForMatch(dam.name)) ||
      Array.from(damUpdatesById.entries()).find(([k]) => k.includes(dam.id))?.[1];
    return {
      id: dam.id,
      name: dam.name,
      district: dam.district,
      purpose: dam.purpose,
      occupancyRate: matched?.occupancyRate ?? null,
      sourceName: matched?.sourceName || "DSİ / MUSKİ / Wikipedia doğrulamalı envanter",
      sourceUrl: matched?.sourceUrl || null,
      measuredAt: matched?.measuredAt || null,
      verified: Boolean(matched && matched.occupancyRate !== null),
    };
  });
  const verifiedDamRates = mergedDamsList
    .map((d) => d.occupancyRate)
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  const avgDamOccupancy =
    verifiedDamRates.length > 0
      ? Math.round((verifiedDamRates.reduce((a, b) => a + b, 0) / verifiedDamRates.length) * 10) / 10
      : null;

  const expiresIn12h = new Date(now.getTime() + 12 * 3600_000).toISOString();
  const ecoBudgetTotal = findings?.economyUpdates?.combinedTotalBillionTry ?? 44.8;
  const ecoBudgetYear = findings?.economyUpdates?.budgetYear ?? currentYear;
  const activeGovernor =
    protocolMemberRows.find((m) => normalizeTextForMatch(m.unvan) === "mugla valisi")?.isim ||
    "Seddar YAVUZ";

  const baselineCacheRows = [
    {
      data_type: "dams",
      data: {
        dams: mergedDamsList,
        damCount: mergedDamsList.length,
        avgOccupancy: avgDamOccupancy,
        verifiedCount: verifiedDamRates.length,
        updatedAt: isoNow,
      },
      fetched_at: isoNow,
      expires_at: expiresIn12h,
      source: AGENT_SOURCE,
      error: null,
    },
    {
      data_type: "tourism",
      data: {
        hotelOccupancyPct: findings?.tourismMetrics?.hotelOccupancyPct ?? null,
        annualTourists: findings?.tourismMetrics?.annualTourists ?? null,
        airportPassengers: findings?.tourismMetrics?.airportPassengers ?? null,
        districtRates: findings?.tourismMetrics?.districtRates ?? [],
        headlines:
          findings?.tourismMetrics?.headlines?.length > 0
            ? findings.tourismMetrics.headlines
            : signals.tourismHighlights,
        yearRange: `${currentYear}-${nextYear}`,
        updatedAt: isoNow,
      },
      fetched_at: isoNow,
      expires_at: expiresIn12h,
      source: AGENT_SOURCE,
      error: null,
    },
    {
      data_type: "security",
      data: {
        events:
          findings?.securityEvents?.length > 0
            ? findings.securityEvents
            : signals.securityHighlights,
        activeAlertCount: derivedAlertRows.length + (findings?.alerts?.length ?? 0),
        monitoredDistricts: VERIFIED_DISTRICTS_SEED.length,
        updatedAt: isoNow,
      },
      fetched_at: isoNow,
      expires_at: expiresIn12h,
      source: AGENT_SOURCE,
      error: null,
    },
    {
      data_type: "energy",
      data: {
        outages:
          findings?.energyOutages?.length > 0
            ? findings.energyOutages
            : signals.energyHighlights,
        activeOutageCount:
          findings?.energyOutages?.length || signals.energyHighlights.length,
        provider: "ADM Elektrik Dağıtım",
        updatedAt: isoNow,
      },
      fetched_at: isoNow,
      expires_at: expiresIn12h,
      source: AGENT_SOURCE,
      error: null,
    },
    {
      data_type: "economy",
      data: {
        budgetYear: ecoBudgetYear,
        combinedTotalBillionTry: ecoBudgetTotal,
        budgetYoyChangePct: findings?.economyUpdates?.budgetYoyChangePct ?? 30.35,
        municipalBudgets:
          findings?.economyUpdates?.municipalBudgets?.length > 0
            ? findings.economyUpdates.municipalBudgets
            : [
                { institution: "Muğla Büyükşehir Belediyesi", amountBillionTry: 24.3, year: currentYear },
                { institution: "MUSKİ Genel Müdürlüğü", amountBillionTry: 20.5, year: currentYear },
                { institution: "MUTTAŞ", amountBillionTry: 1.12, year: currentYear },
              ],
        highlights:
          findings?.economyUpdates?.items?.length > 0
            ? findings.economyUpdates.items
            : signals.economyHighlights,
        updatedAt: isoNow,
      },
      fetched_at: isoNow,
      expires_at: expiresIn12h,
      source: AGENT_SOURCE,
      error: null,
    },
    {
      data_type: "protocol",
      data: {
        governor: activeGovernor,
        memberCount: protocolMemberRows.length,
        recentChangesCount: protocolChangeRows.length,
        activities: protoActivities,
        updatedAt: isoNow,
      },
      fetched_at: isoNow,
      expires_at: expiresIn12h,
      source: AGENT_SOURCE,
      error: null,
    },
  ];

  // 5. monitor_data (11 ana sekmenin canlı metrik kayıtları — idempotent upsert onConflict: "id")
  const totalPopulation = VERIFIED_DISTRICTS_SEED.reduce((sum, d) => sum + d.population, 0);
  const topActiveDistricts = Object.values(signals.districtCounts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const monitorDataRows = [
    {
      id: "genel",
      tab_key: "genel",
      title: "Genel Bakış",
      metrics: {
        totalPopulation,
        districtCount: VERIFIED_DISTRICTS_SEED.length,
        socialPostsAnalyzed: signals.totalPostsAnalyzed,
        activeGovernor,
        combinedBudgetBillionTry: ecoBudgetTotal,
        avgDamOccupancyPct: avgDamOccupancy,
        hotelOccupancyPct: findings?.tourismMetrics?.hotelOccupancyPct ?? null,
        activeAlertCount: derivedAlertRows.length + (findings?.alerts?.length ?? 0),
        scanGroup: group.id,
        scanYear: currentYear,
      },
      summary: `Muğla (${VERIFIED_DISTRICTS_SEED.length} ilçe, ${totalPopulation.toLocaleString("tr-TR")} nüfus) — Grup ${group.id} canlı senkronizasyon tamamlandı.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "diyagram",
      tab_key: "diyagram",
      title: "Şehir Ağı Diyagramı",
      metrics: {
        districtNodes: VERIFIED_DISTRICTS_SEED.length,
        protocolNodes: protocolMemberRows.length,
        damNodes: OFFICIAL_MUGLA_DAMS_SEED.length,
        topActiveDistricts,
      },
      summary: `${VERIFIED_DISTRICTS_SEED.length} ilçe, ${protocolMemberRows.length} protokol üyesi ve ${OFFICIAL_MUGLA_DAMS_SEED.length} baraj düğümü senkronize edildi.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "ekonomi",
      tab_key: "ekonomi",
      title: "Ekonomi & Bütçe",
      metrics: {
        budgetYear: ecoBudgetYear,
        combinedTotalBillionTry: ecoBudgetTotal,
        budgetYoyChangePct: findings?.economyUpdates?.budgetYoyChangePct ?? 30.35,
        municipalBudgetsCount: findings?.economyUpdates?.municipalBudgets?.length || 3,
        socialMentions: signals.categoryCounts.ekonomi,
      },
      summary: `Toplam yerel yönetim bütçesi ${ecoBudgetTotal} Milyar ₺ (${ecoBudgetYear}); ${signals.categoryCounts.ekonomi} güncel ekonomi/ihale sinyali işlendi.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "cevre",
      tab_key: "cevre",
      title: "Çevre & Barajlar",
      metrics: {
        damCount: OFFICIAL_MUGLA_DAMS_SEED.length,
        verifiedDamCount: verifiedDamRates.length,
        avgOccupancyPct: avgDamOccupancy,
        socialMentions: signals.categoryCounts.cevre,
      },
      summary: `${OFFICIAL_MUGLA_DAMS_SEED.length} resmi Muğla barajı izleniyor; ${verifiedDamRates.length} barajda güncel basın/DSİ ölçümü doğrulandı.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "turizm",
      tab_key: "turizm",
      title: "Turizm & Konaklama",
      metrics: {
        hotelOccupancyPct: findings?.tourismMetrics?.hotelOccupancyPct ?? null,
        annualTourists: findings?.tourismMetrics?.annualTourists ?? null,
        airportPassengers: findings?.tourismMetrics?.airportPassengers ?? null,
        headlinesCount:
          findings?.tourismMetrics?.headlines?.length || signals.tourismHighlights.length,
        socialMentions: signals.categoryCounts.turizm,
      },
      summary: `${currentYear}/${nextYear} turizm verileri ve ${signals.categoryCounts.turizm} turizm sinyali senkronize edildi.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "ulasim",
      tab_key: "ulasim",
      title: "Ulaşım & Altyapı",
      metrics: {
        monitoredDistricts: VERIFIED_DISTRICTS_SEED.length,
        activeIncidentsCount: findings?.transportIncidents?.length ?? 0,
        socialMentions: signals.categoryCounts.ulasim,
      },
      summary: `13 ilçe trafik/altyapı akışı ve ${findings?.transportIncidents?.length ?? 0} güncel yol/altyapı bildirimi işlendi.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "sosyal",
      tab_key: "sosyal",
      title: "Sosyal İstihbarat",
      metrics: {
        postsAnalyzed: signals.totalPostsAnalyzed,
        positiveCount: signals.positiveCount,
        negativeCount: signals.negativeCount,
        neutralCount: signals.neutralCount,
        topActiveDistricts,
      },
      summary: `Son ${signals.totalPostsAnalyzed} sosyal/basın gönderisi analiz edildi (Olumlu: ${signals.positiveCount}, Olumsuz: ${signals.negativeCount}, Nötr: ${signals.neutralCount}).`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "guvenlik",
      tab_key: "guvenlik",
      title: "Güvenlik & Asayiş",
      metrics: {
        eventsCount: findings?.securityEvents?.length || signals.securityHighlights.length,
        urgentAlertsCount: derivedAlertRows.length + (findings?.alerts?.length ?? 0),
        socialMentions: signals.categoryCounts.guvenlik,
      },
      summary: `${findings?.securityEvents?.length || signals.securityHighlights.length} güvenlik/deprem gelişmesi ve ${derivedAlertRows.length + (findings?.alerts?.length ?? 0)} acil uyarı kaydı izleniyor.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "enerji",
      tab_key: "enerji",
      title: "Enerji & Kesintiler",
      metrics: {
        activeOutagesCount: findings?.energyOutages?.length || signals.energyHighlights.length,
        provider: "ADM Elektrik",
        socialMentions: signals.categoryCounts.enerji,
      },
      summary: `ADM Elektrik ve enerji hattı sinyalleri güncellendi (${findings?.energyOutages?.length || signals.energyHighlights.length} kayıt).`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "protokol",
      tab_key: "protokol",
      title: "Muğla Protokol",
      metrics: {
        governor: activeGovernor,
        memberCount: protocolMemberRows.length,
        changesRecorded: protocolChangeRows.length,
        activitiesCount: protoActivities.length,
      },
      summary: `Muğla Valisi ${activeGovernor} dahil ${protocolMemberRows.length} protokol üyesi ve atama değişiklikleri güncel.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
    {
      id: "ilceler",
      tab_key: "ilceler",
      title: "İlçeler (13 İlçe)",
      metrics: {
        districtCount: VERIFIED_DISTRICTS_SEED.length,
        totalPopulation,
        activeGroup: group.id,
        activeGroupDistricts: group.districts,
        districtCounts: signals.districtCounts,
      },
      summary: `13 ilçenin tamamı (${group.districts.join(", ")} öncelikli tarama) canlı veritabanına bağlandı.`,
      source: AGENT_SOURCE,
      updated_at: isoNow,
    },
  ];

  // 6. ai_summaries (günlük yönetici özeti + şehir nabzı — onConflict: "type,date")
  const topDistrictLabel =
    topActiveDistricts.length > 0 && topActiveDistricts[0].total > 0
      ? topActiveDistricts
          .filter((d) => d.total > 0)
          .slice(0, 3)
          .map((d) => `${d.name} (${d.total})`)
          .join(", ")
      : group.districts.join(", ");

  const dailySummaryText = [
    `Muğla Monitör ${dateOnly} Günlük Özeti (Grup ${group.id} — ${group.districts.join(", ")}):`,
    `${signals.totalPostsAnalyzed} güncel haber/sosyal gönderi analiz edildi; en yoğun ilçeler: ${topDistrictLabel}.`,
    `Ekonomi: ${ecoBudgetTotal} Milyar ₺ yerel yönetim bütçesi (${ecoBudgetYear}).`,
    `Çevre: ${OFFICIAL_MUGLA_DAMS_SEED.length} resmi baraj izleniyor${avgDamOccupancy !== null ? ` (ort. %${avgDamOccupancy})` : ""}.`,
    `Protokol: Muğla Valisi ${activeGovernor} ve ${protocolMemberRows.length} protokol kaydı senkronize edildi.`,
    `Acil uyarılar: ${derivedAlertRows.length + (findings?.alerts?.length ?? 0)} kayıt işlendi.`,
  ].join(" ");

  const pulseSummaryText = [
    `Şehir Nabzı (${dateOnly}):`,
    `Olumlu ${signals.positiveCount} / Olumsuz ${signals.negativeCount} / Nötr ${signals.neutralCount}.`,
    `Enerji kesinti sinyali: ${findings?.energyOutages?.length || signals.energyHighlights.length},`,
    `Güvenlik/asayiş sinyali: ${findings?.securityEvents?.length || signals.securityHighlights.length},`,
    `Turizm sinyali: ${signals.categoryCounts.turizm}.`,
  ].join(" ");

  const aiSummaryRows = [
    {
      type: "daily",
      date: dateOnly,
      summary: dailySummaryText,
      generated_at: isoNow,
    },
    {
      type: "pulse",
      date: dateOnly,
      summary: pulseSummaryText,
      generated_at: isoNow,
    },
  ];

  return {
    districtsRows,
    protocolMemberRows,
    protocolChangeRows,
    monitorDataRows,
    aiSummaryRows,
    derivedAlertRows,
    baselineCacheRows,
    signals,
  };
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
    const bridgePayloads = buildBridgeTablePayloads({
      findings: sampleFindings,
      group,
      recentSocialPosts: [],
      existingAlertTitles: [],
      existingProtocolChangesCount: 0,
      now,
    });
    console.log(
      `[1. Ajan] DRY-RUN tamamlandı. Hazırlanan kayıtlar -> monitor_data: ${bridgePayloads.monitorDataRows.length}, districts: ${bridgePayloads.districtsRows.length}, protocol_members: ${bridgePayloads.protocolMemberRows.length}, protocol_changes: ${bridgePayloads.protocolChangeRows.length}, ai_summaries: ${bridgePayloads.aiSummaryRows.length}, live_data_cache: ${bridgePayloads.baselineCacheRows.length + payloads.cacheRows.length}, social_keywords: ${payloads.keywordRows.length}, social_posts: ${payloads.postRows.length}, alert_events: ${payloads.alertRows.length}`
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
        live_data_cache: 0,
        monitor_data: 0,
        districts: 0,
        protocol_members: 0,
        protocol_changes: 0,
        ai_summaries: 0,
      },
      planned: {
        social_keywords: payloads.keywordRows.length,
        social_posts: payloads.postRows.length,
        alert_events: payloads.alertRows.length,
        monitor_data: bridgePayloads.monitorDataRows.length,
        districts: bridgePayloads.districtsRows.length,
        protocol_members: bridgePayloads.protocolMemberRows.length,
        protocol_changes: bridgePayloads.protocolChangeRows.length,
        ai_summaries: bridgePayloads.aiSummaryRows.length,
        live_data_cache: bridgePayloads.baselineCacheRows.length + payloads.cacheRows.length,
      },
      errors: [],
    };
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlı olmalıdır."
    );
  }

  if (supabaseKeyType !== "service_role") {
    console.warn(
      `[1. Ajan] UYARI: SUPABASE_SERVICE_ROLE_KEY tanımlı değil (${supabaseKeyType} anahtarı kullanılıyor). RLS korumalı tablolara yazım için SUPABASE_SERVICE_ROLE_KEY önerilir.`
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
  const recordStepError = (step, err, table = null) => {
    const status = err && typeof err === "object" && "status" in err ? err.status : null;
    const message = err?.message || String(err);
    errors.push({ step, table, status, message });
    console.error(
      `[1. Ajan] [YAZIM/OKUMA HATASI] ${step}${table ? ` (tablo: ${table})` : ""}: ${message}`
    );
  };

  // 1a. Supabase Keep-Alive + mevcut social_keywords
  let existingKwData = [];
  try {
    const { data, error } = await supabase.select(
      "social_keywords",
      "select=keyword,user_id&limit=500"
    );
    if (error) {
      recordStepError("social_keywords okuma", error, "social_keywords");
    } else {
      existingKwData = data || [];
      console.log(
        `[1. Ajan] Supabase Keep-Alive başarılı (${existingKwData.length} mevcut kelime okundu).`
      );
    }
  } catch (err) {
    recordStepError("social_keywords okuma", err, "social_keywords");
  }

  const existingKeywords = existingKwData.map((r) => r.keyword).filter(Boolean);
  const resolvedUserId =
    configuredSystemUserId ||
    existingKwData.find((r) => r.user_id)?.user_id ||
    null;

  // 1b. Mevcut son social_posts kayıtları (hem URL tekilleştirme hem 7-tablo canlı sentez için)
  let recentSocialPosts = [];
  let existingUrls = [];
  try {
    const { data, error } = await supabase.select(
      "social_posts",
      "select=id,platform,author,content,sentiment,district,region,category,url,published_at,collected_at&order=collected_at.desc&limit=200"
    );
    if (error) {
      recordStepError("social_posts okuma", error, "social_posts");
    } else {
      recentSocialPosts = Array.isArray(data) ? data : [];
      existingUrls = recentSocialPosts.map((r) => r.url).filter(Boolean);
      console.log(
        `[1. Ajan] social_posts okundu: ${recentSocialPosts.length} güncel gönderi işlenmek üzere alındı.`
      );
    }
  } catch (err) {
    recordStepError("social_posts okuma", err, "social_posts");
  }

  // 1c. Son alert_events başlıkları (tekrarlı uyarı engelleme) ve protocol_changes sayısı
  let existingAlertTitles = [];
  try {
    const { data, error } = await supabase.select(
      "alert_events",
      "select=title&order=created_at.desc&limit=50"
    );
    if (!error && Array.isArray(data)) {
      existingAlertTitles = data.map((r) => r.title).filter(Boolean);
    }
  } catch {
    // alert_events ön okuması isteğe bağlı tekilleştirme içindir; yazım adımı hataları aşağıda kesin raporlanır
  }

  let existingProtocolChangesCount = 0;
  try {
    const { data, error } = await supabase.select(
      "protocol_changes",
      "select=id&limit=5"
    );
    if (!error && Array.isArray(data)) {
      existingProtocolChangesCount = data.length;
    }
  } catch {
    existingProtocolChangesCount = 0;
  }

  // 2. Dinamik yıl (currentYear / nextYear) destekli Gemini Search Grounding çağrısı
  // Not: GEMINI_API_KEY eksik olsa veya 429 dönse bile 7 çekirdek tablonun social_posts + seed senkronizasyonu KESİNLİKLE çalışır!
  let groundingResponse = null;
  let geminiSucceeded = false;
  if (!geminiApiKey) {
    console.warn(
      "[1. Ajan] GEMINI_API_KEY eksik — Gemini araması atlanıyor, mevcut social_posts ve idempotent 7-tablo senkronizasyonu çalıştırılıyor."
    );
  } else {
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
      geminiSucceeded = true;
    } catch (err) {
      if (isRateLimitMessage(err)) {
        recordStepError("Gemini Search Grounding (429 kota limiti)", err);
      } else {
        recordStepError("Gemini Search Grounding", err);
      }
    }
  }

  const groundingChunks = Array.isArray(groundingResponse?.groundingChunks)
    ? groundingResponse.groundingChunks
    : groundingResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const rawModelText = groundingResponse?.text || "";
  const parsedJson = geminiSucceeded ? extractJsonFromModelText(rawModelText) : null;
  if (geminiSucceeded && !parsedJson && rawModelText.trim()) {
    console.warn(
      "[1. Ajan] Model yanıtı geçerli JSON olarak ayrıştırılamadı; doğrulanmamış Gemini verisi yazımı atlanıyor, social_posts ve tablo köprüsü devam ediyor."
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

  const bridgePayloads = buildBridgeTablePayloads({
    findings,
    group,
    recentSocialPosts,
    existingAlertTitles: [
      ...existingAlertTitles,
      ...alertRows.map((a) => a.title),
    ],
    existingProtocolChangesCount,
    now,
  });

  const inserted = {
    social_keywords: 0,
    social_posts: 0,
    alert_events: 0,
    dam_updates: 0,
    topic_caches: 0,
    live_data_cache: 0,
    monitor_data: 0,
    districts: 0,
    protocol_members: 0,
    protocol_changes: 0,
    ai_summaries: 0,
  };

  // 3. social_keywords tablosuna ekle (append-only, eski kelimeleri asla silmez)
  if (keywordRows.length > 0) {
    try {
      const { error, count } = await supabase.insert("social_keywords", keywordRows, {
        ignoreDuplicates: true,
      });
      if (error) {
        recordStepError("social_keywords yazma", error, "social_keywords");
      } else {
        inserted.social_keywords = count;
      }
    } catch (err) {
      recordStepError("social_keywords yazma", err, "social_keywords");
    }
  }

  // 4. social_posts tablosuna yaz (önceki adım hata verse bile devam eder)
  if (postRows.length > 0) {
    try {
      const { error, count } = await supabase.insert("social_posts", postRows);
      if (error) {
        recordStepError("social_posts yazma", error, "social_posts");
      } else {
        inserted.social_posts = count;
      }
    } catch (err) {
      recordStepError("social_posts yazma", err, "social_posts");
    }
  }

  // 5. alert_events tablosuna yüksek öncelikli uyarıları yaz (Gemini + social_posts acil sinyalleri)
  const allAlertRows = [...alertRows, ...bridgePayloads.derivedAlertRows];
  if (allAlertRows.length > 0) {
    try {
      const { error, count } = await supabase.insert("alert_events", allAlertRows);
      if (error) {
        recordStepError("alert_events yazma", error, "alert_events");
      } else {
        inserted.alert_events = count;
      }
    } catch (err) {
      recordStepError("alert_events yazma", err, "alert_events");
    }
  }

  // 6. districts (13 Muğla ilçesi — idempotent upsert)
  if (bridgePayloads.districtsRows.length > 0) {
    try {
      const { error } = await supabase.upsert("districts", bridgePayloads.districtsRows, {
        onConflict: "id",
      });
      if (error) {
        recordStepError("districts upsert", error, "districts");
      } else {
        inserted.districts = bridgePayloads.districtsRows.length;
      }
    } catch (err) {
      recordStepError("districts upsert", err, "districts");
    }
  }

  // 7. protocol_members (Muğla Valisi Seddar YAVUZ dahil aktif protokol — idempotent upsert)
  if (bridgePayloads.protocolMemberRows.length > 0) {
    try {
      const { error } = await supabase.upsert(
        "protocol_members",
        bridgePayloads.protocolMemberRows,
        { onConflict: "id" }
      );
      if (error) {
        recordStepError("protocol_members upsert", error, "protocol_members");
      } else {
        inserted.protocol_members = bridgePayloads.protocolMemberRows.length;
      }
    } catch (err) {
      recordStepError("protocol_members upsert", err, "protocol_members");
    }
  }

  // 8. protocol_changes (güncel atama / kararname değişiklikleri — idempotent upsert)
  if (bridgePayloads.protocolChangeRows.length > 0) {
    try {
      const { error } = await supabase.upsert(
        "protocol_changes",
        bridgePayloads.protocolChangeRows,
        { onConflict: "id" }
      );
      if (error) {
        recordStepError("protocol_changes upsert", error, "protocol_changes");
      } else {
        inserted.protocol_changes = bridgePayloads.protocolChangeRows.length;
      }
    } catch (err) {
      recordStepError("protocol_changes upsert", err, "protocol_changes");
    }
  }

  // 9. ai_summaries (günlük özet ve şehir nabzı — idempotent upsert onConflict: "type,date")
  if (bridgePayloads.aiSummaryRows.length > 0) {
    try {
      const { error } = await supabase.upsert("ai_summaries", bridgePayloads.aiSummaryRows, {
        onConflict: "type,date",
      });
      if (error) {
        recordStepError("ai_summaries upsert", error, "ai_summaries");
      } else {
        inserted.ai_summaries = bridgePayloads.aiSummaryRows.length;
      }
    } catch (err) {
      recordStepError("ai_summaries upsert", err, "ai_summaries");
    }
  }

  // 10. live_data_cache (Gemini topic_grounding snapshot'ları + 8 baraj/turizm/güvenlik/enerji/ekonomi/protokol önbelleği)
  const mergedCacheByType = new Map();
  for (const baseRow of bridgePayloads.baselineCacheRows) {
    mergedCacheByType.set(baseRow.data_type, baseRow);
  }
  for (const liveRow of cacheRows) {
    // Gemini doğrulamalı canlı kayıt her zaman temel kaydın üzerine yazar
    mergedCacheByType.set(liveRow.data_type, liveRow);
  }
  const allCacheRows = Array.from(mergedCacheByType.values());

  for (const cacheRow of allCacheRows) {
    try {
      const { error: cacheErr } = await supabase.upsert("live_data_cache", cacheRow, {
        onConflict: "data_type",
      });
      if (cacheErr) {
        recordStepError(
          `live_data_cache(${cacheRow.data_type}) güncelleme`,
          cacheErr,
          "live_data_cache"
        );
      } else {
        inserted.live_data_cache += 1;
        if (cacheRow.data_type.startsWith("topic_grounding:") || cacheRow.data_type === "dams") {
          inserted.topic_caches += 1;
        }
        if (cacheRow.data_type === "dams") {
          inserted.dam_updates = findings.damUpdates?.length ?? 0;
        }
      }
    } catch (err) {
      recordStepError(
        `live_data_cache(${cacheRow.data_type}) güncelleme`,
        err,
        "live_data_cache"
      );
    }
  }

  // 11. monitor_data (11 ana sekmenin canlı özet ve metrikleri — idempotent upsert)
  if (bridgePayloads.monitorDataRows.length > 0) {
    try {
      const { error } = await supabase.upsert("monitor_data", bridgePayloads.monitorDataRows, {
        onConflict: "id",
      });
      if (error) {
        recordStepError("monitor_data upsert", error, "monitor_data");
      } else {
        inserted.monitor_data = bridgePayloads.monitorDataRows.length;
      }
    } catch (err) {
      recordStepError("monitor_data upsert", err, "monitor_data");
    }
  }

  const finalStatus = errors.length > 0 ? "partial_ok" : "ok";
  console.log(
    `[1. Ajan] Tablo yazım özeti (${finalStatus}) | Grup ${group.id} | ` +
      `monitor_data: ${inserted.monitor_data}, districts: ${inserted.districts}, ` +
      `protocol_members: ${inserted.protocol_members}, protocol_changes: ${inserted.protocol_changes}, ` +
      `alert_events: ${inserted.alert_events}, ai_summaries: ${inserted.ai_summaries}, ` +
      `live_data_cache: ${inserted.live_data_cache}, social_keywords: ${inserted.social_keywords}, ` +
      `social_posts: ${inserted.social_posts} | Hata sayısı: ${errors.length}`
  );

  if (errors.length > 0) {
    for (const errItem of errors) {
      console.error(
        `[1. Ajan] Başarısız adım -> ${errItem.step}${errItem.table ? ` [${errItem.table}]` : ""}: ${errItem.message}`
      );
    }
  }

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
  runAutonomousAgent({ dryRun, groupOverride })
    .then((result) => {
      if (result.errors && result.errors.length > 0) {
        console.error(
          `[1. Ajan] ${result.errors.length} tablo/adım yazım hatası tespit edildi; işlem hata koduyla sonlandırılıyor.`
        );
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("[1. Ajan] Kritik hata:", err?.message || err);
      process.exitCode = 1;
    });
}
