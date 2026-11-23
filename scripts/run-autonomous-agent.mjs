#!/usr/bin/env node
/**
 * Muğla Monitör v2 — 1. Ajan: 7/24 Free-Tier Otonom İstihbarat İşçisi
 *
 * Her 6 saatte bir (00:00, 06:00, 12:00, 18:00 UTC) GitHub Actions üzerinden çalışır:
 * - 13 Muğla ilçesini 4 bölgesel grup halinde sırayla tarar (günde 4, ayda 120 Gemini Search Grounding isteği = %8 ücretsiz kota).
 * - Google Search Grounding (Gemini) ile gerçek yerel gelişmeleri, altyapı/afet/trafik uyarılarını ve yeni anahtar kelimeleri çıkarır.
 * - Verileri doğrudan Supabase `social_keywords`, `social_posts` ve `alert_events` tablolarına yazar.
 * - Her çalışmada hafif bir Supabase sorgusu yürüterek ücretsiz Supabase veritabanının 7 günlük inaktivite uykusuna geçmesini engeller.
 *
 * Kullanım:
 *   node scripts/run-autonomous-agent.mjs
 *   node scripts/run-autonomous-agent.mjs --dry-run --group=A
 */

import { pathToFileURL } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const AGENT_MODEL = "gemini-4-hydrogen";
export const AGENT_SOURCE = "autonomous-intel-agent";
export const MONTHLY_FREE_GROUNDING_QUOTA = 1500;

export const SECTOR_TOPIC_QUERIES = {
  environment_dams:
    '"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı',
  transport_infra:
    '"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik',
};

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

  const hasVerifiedBacking = allowUnverified || posts.length > 0 || fallbackUrls.length > 0;
  const rawKeywords = hasVerifiedBacking && Array.isArray(rawJson?.new_keywords) ? rawJson.new_keywords : [];
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

  return {
    posts,
    keywords: Array.from(keywordMap.values()).slice(0, 16),
    alerts,
    damUpdates,
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

  const canEmitKeywords = allowDryRun || postRows.length > 0 || validGroundingUrls.length > 0;
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

  return { keywordRows, postRows, alertRows };
}

function buildGroundingPrompt(group) {
  const districtList = group.districts.join(", ");
  return [
    `Sen Muğla Monitör v2 için çalışan 7/24 otonom saha istihbarat ajanısın.`,
    `Görev: Google Arama (Search Grounding) kullanarak hem şu ilçelerdeki (${districtList}) güncel gelişmeleri hem de aşağıdaki 2 sektörel konuyu tara:`,
    `- Çevre / Barajlar sorgusu: ${SECTOR_TOPIC_QUERIES.environment_dams}`,
    `- Ulaşım / Altyapı sorgusu: ${SECTOR_TOPIC_QUERIES.transport_infra}`,
    `KESİN DOĞRULAMA KURALLARI:`,
    `1. Yalnızca arama sonuçlarında doğrudan yer alan, geçerli ve doğrulanabilir bir kaynak URL'sine (https://...) sahip gelişmeleri bildir; teyitsiz sosyal medya dedikodusu, varsayım veya sentetik uyarı ASLA üretme.`,
    `2. Doğrulanmış kaynak bulunamazsa uydurma veri üretme; "posts", "new_keywords", "alerts" ve "dam_updates" dizilerini boş ([]) döndür.`,
    `3. Her gönderi, uyarı ve baraj ölçümü için geçerli "source_url" alanını mutlaka doldur; ilçe adını listeden seç (${districtList}).`,
    `4. Baraj doluluk oranı yalnızca yerel basın/kurum (Anter Haber, AA, MUSKİ, DSİ vb.) haberinde açıkça geçiyorsa "dam_updates" içine ekle.`,
    `5. Yalnızca doğrulanmış acil/yüksek öncelikli olayları (resmi kesinti, yol kapanması, isale hattı patlaması, yangın/sel) "alerts" dizisine koy.`,
    `6. Yalnızca aşağıdaki geçerli JSON formatında yanıt ver (ek açıklama yazma):`,
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

export async function runAutonomousAgent(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const dryRun = Boolean(options.dryRun);
  const group = selectRegionalGroup(options.groupOverride || now);
  const quota = calculateMonthlyQuotaUsage();

  console.log(
    `[1. Ajan] Başlatılıyor | Grup ${group.id} (${group.name}) | İlçeler: ${group.districts.join(", ")}`
  );
  console.log(
    `[1. Ajan] Aylık Kota Kontrolü: ${quota.monthlyCalls}/${quota.monthlyFreeQuota} (%${quota.percentUsed}) — Limit ≤ %15: ${quota.withinBudget ? "UYGUN" : "AŞIM"}`
  );

  const geminiApiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY ?? "";
  const supabaseUrl = options.supabaseUrl ?? process.env.SUPABASE_URL ?? "";
  const supabaseServiceRoleKey =
    options.supabaseServiceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const configuredSystemUserId =
    options.systemUserId ?? process.env.AGENT_SYSTEM_USER_ID ?? null;

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
      quota,
      inserted: {
        social_keywords: 0,
        social_posts: 0,
        alert_events: 0,
      },
      planned: {
        social_keywords: payloads.keywordRows.length,
        social_posts: payloads.postRows.length,
        alert_events: payloads.alertRows.length,
      },
    };
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri tanımlı olmalıdır."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Supabase Keep-Alive + mevcut anahtar kelimeler & URL'ler (7 günlük uykuyu önler)
  const { data: existingKwData, error: kwFetchError } = await supabase
    .from("social_keywords")
    .select("keyword, user_id")
    .limit(500);

  if (kwFetchError) {
    console.warn(`[1. Ajan] social_keywords okuma uyarısı: ${kwFetchError.message}`);
  } else {
    console.log(
      `[1. Ajan] Supabase Keep-Alive başarılı (${existingKwData?.length ?? 0} mevcut kelime okundu).`
    );
  }

  const existingKeywords = (existingKwData || []).map((r) => r.keyword).filter(Boolean);
  const resolvedUserId =
    configuredSystemUserId ||
    (existingKwData || []).find((r) => r.user_id)?.user_id ||
    null;

  const { data: recentPostsData } = await supabase
    .from("social_posts")
    .select("url")
    .order("collected_at", { ascending: false })
    .limit(200);
  const existingUrls = (recentPostsData || []).map((r) => r.url).filter(Boolean);

  if (!geminiApiKey) {
    console.warn(
      "[1. Ajan] GEMINI_API_KEY eksik — yalnızca Supabase Keep-Alive tamamlandı, arama adımı atlandı."
    );
    return {
      status: "keepalive_only",
      group,
      quota,
      inserted: { social_keywords: 0, social_posts: 0, alert_events: 0 },
    };
  }

  // 2. Tek bir ücretsiz kotaya uyumlu Gemini Search Grounding çağrısı
  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
    },
  });

  const response = await ai.models.generateContent({
    model: AGENT_MODEL,
    contents: buildGroundingPrompt(group),
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const groundingChunks =
    response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const parsedJson = extractJsonFromModelText(response?.text || "");
  const findings = normalizeAgentFindings(parsedJson || {}, group, groundingChunks);

  const { keywordRows, postRows, alertRows } = buildSupabasePayloads({
    findings,
    group,
    existingKeywords,
    existingUrls,
    systemUserId: resolvedUserId,
    now,
  });

  const inserted = { social_keywords: 0, social_posts: 0, alert_events: 0, dam_updates: 0 };

  // 3. social_keywords tablosuna ekle (append-only, eski kelimeleri asla silmez)
  if (keywordRows.length > 0) {
    const { error } = await supabase.from("social_keywords").insert(keywordRows);
    if (error) {
      console.warn(`[1. Ajan] social_keywords yazma uyarısı: ${error.message}`);
    } else {
      inserted.social_keywords = keywordRows.length;
    }
  }

  // 4. social_posts tablosuna yaz
  if (postRows.length > 0) {
    const { error } = await supabase.from("social_posts").insert(postRows);
    if (error) {
      console.warn(`[1. Ajan] social_posts yazma uyarısı: ${error.message}`);
    } else {
      inserted.social_posts = postRows.length;
    }
  }

  // 5. alert_events tablosuna yüksek öncelikli uyarıları yaz
  if (alertRows.length > 0) {
    const { error } = await supabase.from("alert_events").insert(alertRows);
    if (error) {
      console.warn(`[1. Ajan] alert_events yazma uyarısı: ${error.message}`);
    } else {
      inserted.alert_events = alertRows.length;
    }
  }

  // 6. Doğrulanmış baraj doluluk verisi yakalandıysa live_data_cache(dams) kaydını güncelle
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
    const { error: damErr } = await supabase.from("live_data_cache").upsert(
      {
        data_type: "dams",
        data: {
          dams: mergedDams,
          avg_occupancy: avgOcc,
          source: latestDamObs.sourceName,
          updated_at: latestDamObs.measuredAt,
        },
        fetched_at: now.toISOString(),
      },
      { onConflict: "data_type" }
    );
    if (damErr) {
      console.warn(`[1. Ajan] live_data_cache(dams) güncelleme uyarısı: ${damErr.message}`);
    } else {
      inserted.dam_updates = findings.damUpdates.length;
    }
  }

  console.log(
    `[1. Ajan] Tamamlandı | Grup ${group.id} | Yazılanlar -> social_keywords: ${inserted.social_keywords}, social_posts: ${inserted.social_posts}, alert_events: ${inserted.alert_events}`
  );

  return {
    status: "ok",
    group,
    quota,
    inserted,
  };
}

// Doğrudan CLI olarak çalıştırıldığında başlat (Vitest importlarında çalışmaz)
const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const { dryRun, groupOverride } = parseCliArgs();
  runAutonomousAgent({ dryRun, groupOverride }).catch((err) => {
    console.error("[1. Ajan] Kritik hata:", err?.message || err);
    process.exitCode = 1;
  });
}
