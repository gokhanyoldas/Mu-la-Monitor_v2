import type { IncomingMessage, ServerResponse } from "node:http";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { persistTopicGroundingToSupabase } from "./_supabaseBridge";

type VercelRequest = IncomingMessage & {
  method?: string;
  body?: Record<string, unknown>;
};
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

export type TopicGroundingKey =
  | "environment_dams"
  | "transport_infra"
  | "energy_outages"
  | "security_quakes"
  | "tourism_occupancy"
  | "economy_budget"
  | "protocol_activity";

const VALID_TOPICS = new Set<TopicGroundingKey>([
  "environment_dams",
  "transport_infra",
  "energy_outages",
  "security_quakes",
  "tourism_occupancy",
  "economy_budget",
  "protocol_activity",
]);

export function isValidTopicKey(raw: unknown): raw is TopicGroundingKey {
  return typeof raw === "string" && VALID_TOPICS.has(raw as TopicGroundingKey);
}

export function normalizeTopicKey(raw: unknown): TopicGroundingKey {
  if (isValidTopicKey(raw)) {
    return raw;
  }
  return "environment_dams";
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-4-hydrogen";

export const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;
const TOPIC_RESULT_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_GROUNDING_SPACING_MS = 450;

let geminiQuotaCooldownUntil = 0;
let lastGroundedCallEndedAt = 0;
let groundingQueueTail: Promise<void> = Promise.resolve();
const topicResultCache = new Map<TopicGroundingKey, { expiresAt: number; payload: Record<string, unknown> }>();
const inFlightTopicRequests = new Map<TopicGroundingKey, Promise<Record<string, unknown>>>();

export function isGeminiRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (obj.status === 429 || obj.code === 429) return true;
    if (obj.status === "RESOURCE_EXHAUSTED") return true;
    const nested = obj.error;
    if (nested && typeof nested === "object") {
      const n = nested as Record<string, unknown>;
      if (n.code === 429 || n.status === 429 || n.status === "RESOURCE_EXHAUSTED") {
        return true;
      }
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /RESOURCE_EXHAUSTED|"code"\s*:\s*429|\b429\b|exceeded your current quota|rate[- ]?limit/i.test(
    msg
  );
}

export function getGeminiRateLimitState(now = Date.now()): {
  rateLimited: boolean;
  retryAfterMs: number;
  cooldownUntil: number;
} {
  const retryAfterMs = Math.max(0, geminiQuotaCooldownUntil - now);
  return {
    rateLimited: retryAfterMs > 0,
    retryAfterMs,
    cooldownUntil: geminiQuotaCooldownUntil,
  };
}

export function markGeminiRateLimited(cooldownMs = RATE_LIMIT_COOLDOWN_MS): number {
  const nextUntil = Date.now() + Math.max(60_000, cooldownMs);
  if (nextUntil > geminiQuotaCooldownUntil) {
    geminiQuotaCooldownUntil = nextUntil;
  }
  return Math.max(0, geminiQuotaCooldownUntil - Date.now());
}

export function resetTopicGroundingRuntimeState() {
  geminiQuotaCooldownUntil = 0;
  lastGroundedCallEndedAt = 0;
  groundingQueueTail = Promise.resolve();
  topicResultCache.clear();
  inFlightTopicRequests.clear();
}

function buildRateLimitedPayload(topic: TopicGroundingKey, retryAfterMs: number): Record<string, unknown> {
  return {
    ok: false,
    fallback: true,
    rateLimited: true,
    retryAfterMs,
    topic,
    reason:
      "Gemini API kota/hız limiti nedeniyle geçici bekleme modunda; mevcut doğrulanmış veriler korunuyor.",
  };
}

function enqueueGroundedCall<T>(spacingMs: number, fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    if (spacingMs > 0 && lastGroundedCallEndedAt > 0) {
      const waitMs = Math.max(0, spacingMs - (Date.now() - lastGroundedCallEndedAt));
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    try {
      return await fn();
    } finally {
      lastGroundedCallEndedAt = Date.now();
    }
  };
  const next = groundingQueueTail.then(run, run);
  groundingQueueTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

const DAM_ALIASES: Array<{ id: string; name: string; aliases: string[] }> = [
  { id: "mumcular", name: "Mumcular Barajı", aliases: ["mumcular"] },
  { id: "geyik", name: "Geyik Barajı", aliases: ["geyik"] },
  { id: "akgedik", name: "Akgedik Barajı", aliases: ["akgedik"] },
  { id: "marmaris", name: "Marmaris (Atatürk) Barajı", aliases: ["marmaris baraj", "atatürk baraj"] },
  { id: "akkopru", name: "Akköprü Barajı ve HES", aliases: ["akköprü"] },
  { id: "bayir", name: "Bayır Barajı", aliases: ["bayır baraj", "bayır"] },
  { id: "esen1", name: "Eşen 1 Barajı ve HES", aliases: ["eşen 1", "eşen-1"] },
  { id: "esen2", name: "Eşen 2 Barajı ve HES", aliases: ["eşen 2", "eşen-2"] },
];

function sendJson(res: VercelResponse, statusCode: number, body: unknown) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(statusCode).json(body);
  }
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isPrivateOrLocalHost(host: string): boolean {
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".invalid")
  ) {
    return true;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const m172 = host.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function isValidExternalUrl(uri: unknown): uri is string {
  if (typeof uri !== "string") return false;
  try {
    const parsed = new URL(uri.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return Boolean(host && host.includes(".") && !isPrivateOrLocalHost(host));
  } catch {
    return false;
  }
}

function extractJsonFromText<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function matchDam(rawName: unknown): { id: string; name: string } | null {
  if (typeof rawName !== "string") return null;
  const low = rawName.toLocaleLowerCase("tr-TR");
  for (const d of DAM_ALIASES) {
    if (d.aliases.some((a) => low.includes(a))) {
      return { id: d.id, name: d.name };
    }
  }
  return null;
}

function parseIsoDateOrFallback(raw: unknown, fallbackIso: string): string {
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw.trim());
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallbackIso;
}

function cleanStr(raw: unknown, maxLen: number, fallback = ""): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

export function getDynamicQueryYears(now: Date = new Date()): {
  currentYear: number;
  nextYear: number;
} {
  const currentYear = now.getFullYear();
  return { currentYear, nextYear: currentYear + 1 };
}

export function buildPromptForTopic(topic: TopicGroundingKey, now: Date = new Date()): string {
  const { currentYear, nextYear } = getDynamicQueryYears(now);
  switch (topic) {
    case "environment_dams":
      return `Google Arama aracını kullanarak şu sorguyu tara:
"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı ${currentYear}

GÖREV:
- Yalnızca arama sonuçlarında doğrudan yer alan doğrulanmış haber veya resmi kurumlardan (Anter Haber, AA, MUSKİ, DSİ, DHA, İHA, Muğla yerel basını) Muğla barajlarının güncel doluluk yüzdelerini çıkar.
- Asla tahmin veya uydurma oran üretme. Kaynak URL'si bulunmayan kaydı ekleme.
- Şanlıurfa Atatürk Barajı verilerini karıştırma; yalnızca Muğla Marmaris Atatürk Barajı için veri ekle.
- SADECE aşağıdaki JSON yapısını döndür:
{
  "damUpdates": [
    {
      "damName": "Mumcular Barajı | Geyik Barajı | Akgedik Barajı | Marmaris (Atatürk) Barajı | Akköprü Barajı ve HES | Bayır Barajı",
      "occupancyRate": 80,
      "sourceName": "Anter Haber | AA | MUSKİ | DSİ | Yerel Basın",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD",
      "confidence": "high | medium",
      "headline": "Kısa haber başlığı"
    }
  ]
}`;

    case "transport_infra":
      return `Google Arama aracını kullanarak şu sorguyu tara:
"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik

GÖREV:
- Son günlerde Muğla, Bodrum, Marmaris, Fethiye, Milas, Menteşe ilçelerinde yaşanan doğrulanmış yol çalışması, isale hattı patlaması/su arızası veya trafik duyurularını çıkar.
- Asla uydurma kayıt üretme; yalnızca gerçek kaynak URL'si bulunan olayları döndür (en fazla 6 kayıt).
- SADECE aşağıdaki JSON yapısını döndür:
{
  "incidents": [
    {
      "title": "Kısa ve net olay başlığı",
      "district": "Bodrum | Marmaris | Menteşe | Milas | Fethiye | Datça | Dalaman | Ortaca | Köyceğiz | Yatağan | Ula | Seydikemer | Kavaklıdere",
      "category": "yol_calismasi | isale_hatti | trafik",
      "status": "devam | tamamlandı | uyarı",
      "sourceName": "Kaynak adı",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD",
      "confidence": "high | medium"
    }
  ]
}`;

    case "energy_outages":
      return `Google Arama aracını kullanarak şu sorguyu tara:
"ADM Elektrik" Muğla planlı kesinti OR arıza OR elektrik kesintisi

GÖREV:
- Yalnızca arama sonuçlarında doğrudan yer alan güncel ADM Elektrik Muğla planlı veya arızalı elektrik kesintisi duyurularını çıkar (Bodrum, Marmaris, Fethiye, Milas, Menteşe, Datça, Dalaman, Ortaca, Köyceğiz, Yatağan, Ula, Seydikemer, Kavaklıdere).
- Asla tahmin veya uydurma kesinti üretme. Doğrulanmış kaynak URL'si olmayan kaydı ekleme (en fazla 8 kayıt).
- SADECE aşağıdaki JSON yapısını döndür:
{
  "outages": [
    {
      "district": "İlçe adı",
      "neighborhoods": "Etkilenen mahalleler / bölge özeti",
      "type": "planli | ariza",
      "status": "aktif | planli | giderildi",
      "summary": "Kısa kesinti açıklaması ve saat aralığı",
      "sourceName": "ADM Elektrik | Yerel Basın",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD",
      "confidence": "high | medium"
    }
  ]
}`;

    case "security_quakes":
      return `Google Arama aracını kullanarak şu sorguyu tara:
("AFAD" OR "Kandilli") Muğla deprem OR ("Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" asayiş OR "trafik kazası" OR "Sahil Güvenlik" OR yangın)

GÖREV:
- Muğla ve 13 ilçesi (Bodrum, Marmaris, Datça, Fethiye, Milas, Menteşe, Dalaman, Ortaca, Köyceğiz, Ula, Yatağan, Seydikemer, Kavaklıdere) için son günlerdeki doğrulanmış AFAD/Kandilli depremlerine EK OLARAK günlük asayiş olayları, trafik kazaları, Sahil Güvenlik operasyonları ve orman/yerleşim yangını haberlerini çıkar.
- Asla uydurma olay veya sabit istatistik (485, 128 vb.) üretme; yalnızca gerçek kaynak URL'si bulunan doğrulanmış olayları ekle (en fazla 8 kayıt).
- SADECE aşağıdaki JSON yapısını döndür:
{
  "events": [
    {
      "category": "deprem | asayis | deniz_guvenligi | trafik_kazasi | yangin",
      "title": "Kısa ve net olay başlığı",
      "district": "İlçe veya deniz açıkları",
      "magnitude": 3.4,
      "depthKm": 7.2,
      "severity": "kritik | yuksek | normal",
      "sourceName": "AFAD | Kandilli | Sahil Güvenlik | Muğla Emniyet | OGM | AA | Yerel Basın",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD",
      "confidence": "high | medium"
    }
  ]
}`;

    case "tourism_occupancy":
      return `Google Arama aracını kullanarak şu sorguyu tara:
"Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" otel doluluk oranı OR turist sayısı OR Dalaman Havalimanı yolcu ${currentYear}

GÖREV:
- Muğla geneli ve Bodrum, Marmaris, Fethiye, Datça ilçeleri için ${currentYear} yılına ait doğrulanmış güncel otel doluluk oranlarını, yıllık/dönemlik turist sayısını ve Dalaman / Milas-Bodrum Havalimanı yolcu istatistiklerini (TÜRSAB, BODER, GETOB, DHMİ, Kültür ve Turizm Bakanlığı, AA, yerel basın) çıkar.
- Tahmini veya uydurma yüzde/rakam yazma; haberde doğrudan yer almıyorsa null bırak. Kaynak URL'si olmayan kaydı ekleme.
- SADECE aşağıdaki JSON yapısını döndür:
{
  "hotelOccupancyPct": 68,
  "annualTourists": "4.2M",
  "airportPassengers": "5.6M",
  "sourceName": "BODER | GETOB | TÜRSAB | DHMİ | Kültür ve Turizm Bakanlığı | Yerel Basın",
  "sourceUrl": "https://...",
  "publishedDate": "YYYY-MM-DD",
  "districtRates": [
    {
      "district": "Bodrum | Marmaris | Fethiye | Datça",
      "occupancyPct": 72,
      "sourceName": "Kaynak adı",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD"
    }
  ],
  "headlines": [
    {
      "title": "Kısa turizm veya havalimanı yolcu gelişmesi başlığı",
      "district": "Muğla | Bodrum | Marmaris | Fethiye | Dalaman",
      "sourceName": "Kaynak adı",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD"
    }
  ]
}`;

    case "economy_budget":
      return `Google Arama aracını kullanarak şu sorguyu tara:
"Muğla Büyükşehir Belediyesi" OR "MUSKİ" OR "Bodrum Belediyesi" OR "Marmaris Belediyesi" bütçe milyar TL OR ihale ${currentYear} OR ${nextYear}

GÖREV:
- Muğla Büyükşehir Belediyesi, MUSKİ ve ilçe belediyelerinin (Bodrum, Marmaris, Fethiye, Milas, Menteşe vb.) resmi meclis onaylı ${currentYear} veya ${nextYear} bütçe rakamlarını (milyar TL cinsinden, varsa birleşik toplam ve yıllık artış yüzdesi dahil), güncel ihale/yatırım duyurularını ve varsa güncel TÜİK Muğla işsizlik oranını çıkar.
- Tahmini veya uydurma rakam yazma; yalnızca arama sonuçlarında doğrudan yer alan resmi rakamları ve gerçek kaynak URL'lerini döndür.
- SADECE aşağıdaki JSON yapısını döndür:
{
  "budgetYear": ${currentYear},
  "combinedTotalBillionTry": 44.8,
  "budgetYoyChangePct": 30.35,
  "municipalBudgets": [
    {
      "institution": "Muğla Büyükşehir Belediyesi | MUSKİ | Bodrum Belediyesi | Marmaris Belediyesi | Fethiye Belediyesi",
      "amountBillionTry": 24.3,
      "year": ${currentYear},
      "yoyChangePct": 30.35,
      "investmentBillionTry": 9.8,
      "sourceName": "Muğla Büyükşehir | MUSKİ | AA | Yerel Basın",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD"
    }
  ],
  "unemploymentRate": null,
  "unemploymentPeriod": null,
  "unemploymentSource": null,
  "sourceName": "Muğla Büyükşehir | MUSKİ | Yerel Basın",
  "sourceUrl": "https://...",
  "publishedDate": "YYYY-MM-DD",
  "items": [
    {
      "institution": "Muğla Büyükşehir Belediyesi | MUSKİ | Bodrum Belediyesi | Marmaris Belediyesi | Fethiye Belediyesi",
      "category": "butce | ihale | yatirim | isgucu",
      "title": "Kısa ve net bütçe veya ihale gelişmesi başlığı",
      "amountLabel": "Varsa tutar örn. 44.8 Milyar ₺ veya boş",
      "sourceName": "Kaynak adı",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD"
    }
  ]
}`;

    case "protocol_activity":
      return `Google Arama aracını kullanarak şu sorguyu tara:
("Muğla Valisi" OR "Seddar Yavuz" OR "Muğla Büyükşehir Belediye Başkanı" OR "Ahmet Aras" OR "Muğla Kaymakam" OR "Muğla Başsavcı") ziyaret OR açıklama OR atama OR kararname ${currentYear} OR ${nextYear} son 24 saat

GÖREV:
- Muğla il protokolündeki yöneticiler (Vali Seddar Yavuz, Büyükşehir Belediye Başkanı Ahmet Aras, 13 İlçe Kaymakamı, 13 İlçe Belediye Başkanı, Rektör, Cumhuriyet Başsavcısı, İl Emniyet Müdürü, İl Jandarma Komutanı vb.) hakkında son 24-48 saatte yayınlanan doğrulanmış resmi ziyaret, açıklama veya görev değişikliği/atama kararname haberlerini çıkar.
- Yeni bir atama veya görev değişikliği (Vali, Kaymakam, Belediye Başkanı vb.) varsa category alanını "gorev_degisikligi" yap ve actorName alanına yeni atanan kişinin tam adını, actorTitle alanına ise makamı eksiksiz yaz.
- Asla uydurma kayıt üretme; yalnızca gerçek kaynak URL'si bulunan haberleri döndür (en fazla 8 kayıt).
- SADECE aşağıdaki JSON yapısını döndür:
{
  "activities": [
    {
      "actorName": "Kişinin tam adı (örn. Seddar Yavuz, Ahmet Aras)",
      "actorTitle": "Görevi (örn. Muğla Valisi, Muğla Büyükşehir Belediye Başkanı, Bodrum Kaymakamı)",
      "category": "ziyaret | aciklama | gorev_degisikligi",
      "summary": "Kısa ve tek cümlelik özet",
      "sourceName": "Muğla Valiliği | Resmî Gazete | MBB | AA | Yerel Basın",
      "sourceUrl": "https://...",
      "publishedDate": "YYYY-MM-DD"
    }
  ]
}`;
  }
}

export interface ExecuteTopicGroundingDeps {
  generateContent?: (args: {
    model: string;
    contents: string;
    config: Record<string, unknown>;
  }) => Promise<{
    text?: string;
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  }>;
  spacingMs?: number;
}

export async function executeTopicGrounding(
  rawTopic: unknown,
  apiKey: string,
  deps?: ExecuteTopicGroundingDeps
): Promise<Record<string, unknown>> {
  const topic = normalizeTopicKey(rawTopic);
  if (!apiKey) {
    return {
      ok: false,
      fallback: true,
      topic,
      reason: "GEMINI_API_KEY tanımlı değil.",
    };
  }

  const cached = topicResultCache.get(topic);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const limitState = getGeminiRateLimitState();
  if (limitState.rateLimited) {
    return buildRateLimitedPayload(topic, limitState.retryAfterMs);
  }

  const existingInFlight = inFlightTopicRequests.get(topic);
  if (existingInFlight) {
    return existingInFlight;
  }

  const spacingMs = deps?.spacingMs ?? DEFAULT_GROUNDING_SPACING_MS;
  const task = enqueueGroundedCall(spacingMs, async () => {
    const queuedCached = topicResultCache.get(topic);
    if (queuedCached && queuedCached.expiresAt > Date.now()) {
      return queuedCached.payload;
    }

    const queuedLimit = getGeminiRateLimitState();
    if (queuedLimit.rateLimited) {
      return buildRateLimitedPayload(topic, queuedLimit.retryAfterMs);
    }

    const payload = await runTopicGroundingCall(topic, apiKey, deps);
    if (payload.ok) {
      topicResultCache.set(topic, {
        expiresAt: Date.now() + TOPIC_RESULT_CACHE_TTL_MS,
        payload,
      });
    }
    return payload;
  }).finally(() => {
    inFlightTopicRequests.delete(topic);
  });

  inFlightTopicRequests.set(topic, task);
  return task;
}

async function runTopicGroundingCall(
  topic: TopicGroundingKey,
  apiKey: string,
  deps?: ExecuteTopicGroundingDeps
): Promise<Record<string, unknown>> {
  const prompt = buildPromptForTopic(topic);
  const config: Record<string, unknown> = {
    tools: [{ googleSearch: {} }],
  };
  if (GEMINI_MODEL.startsWith("gemini-4") || GEMINI_MODEL.startsWith("gemini-3")) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  let response: {
    text?: string;
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };

  try {
    if (deps?.generateContent) {
      response = await deps.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
      });
    } else {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { "User-Agent": "aistudio-build" },
        },
      });
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
      });
    }
  } catch (err) {
    if (isGeminiRateLimitError(err)) {
      const wasAlreadyLimited = getGeminiRateLimitState().rateLimited;
      const retryAfterMs = markGeminiRateLimited(RATE_LIMIT_COOLDOWN_MS);
      if (!wasAlreadyLimited) {
        console.warn(
          `[/api/intel/topic-grounding] Gemini 429 RESOURCE_EXHAUSTED — ${Math.round(
            retryAfterMs / 60000
          )} dk bekleme modu aktif (konu: ${topic}).`
        );
      }
      return buildRateLimitedPayload(topic, retryAfterMs);
    }
    throw err;
  }

  const metadata = response.candidates?.[0]?.groundingMetadata;
  const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const groundingSources = chunks
    .map((c: { web?: { uri?: string; title?: string } }) => ({
      uri: c.web?.uri || "",
      title: c.web?.title || "",
    }))
    .filter((s) => isValidExternalUrl(s.uri));

  const fallbackUrl = groundingSources[0]?.uri;
  const nowIso = new Date().toISOString();
  const rawText = response.text ?? "";

  switch (topic) {
    case "environment_dams": {
      const parsed = extractJsonFromText<{ damUpdates?: Array<Record<string, unknown>> }>(rawText);
      const rawList = Array.isArray(parsed?.damUpdates) ? parsed!.damUpdates : [];
      const damUpdates = rawList
        .map((item) => {
          const matched = matchDam(item.damName);
          const rate = Number(item.occupancyRate);
          const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
          if (!matched || !Number.isFinite(rate) || rate < 0 || rate > 100 || !url) return null;
          return {
            damId: matched.id,
            damName: matched.name,
            occupancyRate: Math.round(rate * 10) / 10,
            sourceName: cleanStr(item.sourceName, 60, "Yerel Basın/DSİ"),
            sourceUrl: url,
            measuredAt: parseIsoDateOrFallback(item.publishedDate, nowIso),
            confidence: item.confidence === "medium" ? "medium" : "high",
            headline: cleanStr(item.headline, 160) || undefined,
          };
        })
        .filter(Boolean);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        damUpdates,
        groundingSources,
      };
    }

    case "transport_infra": {
      const parsed = extractJsonFromText<{ incidents?: Array<Record<string, unknown>> }>(rawText);
      const rawIncidents = Array.isArray(parsed?.incidents) ? parsed!.incidents : [];
      const transportIncidents = rawIncidents
        .map((item, idx) => {
          const title = cleanStr(item.title, 140);
          const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
          if (!title || !url) return null;
          return {
            id: `ti-${idx}-${Date.now()}`,
            title,
            district: cleanStr(item.district, 40, "Muğla"),
            category:
              item.category === "isale_hatti" || item.category === "trafik"
                ? item.category
                : "yol_calismasi",
            status:
              item.status === "tamamlandı" || item.status === "uyarı" ? item.status : "devam",
            sourceName: cleanStr(item.sourceName, 60, "Yerel Basın"),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(item.publishedDate, nowIso),
            confidence: item.confidence === "medium" ? "medium" : "high",
          };
        })
        .filter(Boolean)
        .slice(0, 6);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        transportIncidents,
        groundingSources,
      };
    }

    case "energy_outages": {
      const parsed = extractJsonFromText<{ outages?: Array<Record<string, unknown>> }>(rawText);
      const rawOutages = Array.isArray(parsed?.outages) ? parsed!.outages : [];
      const energyOutages = rawOutages
        .map((item, idx) => {
          const district = cleanStr(item.district, 40);
          const summary = cleanStr(item.summary, 160);
          const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
          if (!district || !summary || !url) return null;
          return {
            id: `eo-${idx}-${Date.now()}`,
            district,
            neighborhoods: cleanStr(item.neighborhoods, 100),
            type: item.type === "ariza" ? "ariza" : "planli",
            status:
              item.status === "aktif" || item.status === "giderildi" ? item.status : "planli",
            summary,
            sourceName: cleanStr(item.sourceName, 60, "ADM Elektrik"),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(item.publishedDate, nowIso),
            confidence: item.confidence === "medium" ? "medium" : "high",
          };
        })
        .filter(Boolean)
        .slice(0, 8);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        energyOutages,
        groundingSources,
      };
    }

    case "security_quakes": {
      const parsed = extractJsonFromText<{ events?: Array<Record<string, unknown>> }>(rawText);
      const rawEvents = Array.isArray(parsed?.events) ? parsed!.events : [];
      const securityEvents = rawEvents
        .map((item, idx) => {
          const title = cleanStr(item.title, 150);
          const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
          if (!title || !url) return null;
          const rawMag = item.magnitude !== null && item.magnitude !== undefined ? Number(item.magnitude) : NaN;
          const rawDepth = item.depthKm !== null && item.depthKm !== undefined ? Number(item.depthKm) : NaN;
          const rawCat = item.category;
          const category =
            rawCat === "deprem" ||
            rawCat === "deniz_guvenligi" ||
            rawCat === "trafik_kazasi" ||
            rawCat === "yangin" ||
            rawCat === "asayis"
              ? rawCat
              : "asayis";
          return {
            id: `sq-${idx}-${Date.now()}`,
            category,
            title,
            district: cleanStr(item.district, 50, "Muğla"),
            magnitude: Number.isFinite(rawMag) && rawMag > 0 && rawMag < 10 ? Math.round(rawMag * 10) / 10 : null,
            depthKm: Number.isFinite(rawDepth) && rawDepth >= 0 && rawDepth < 700 ? Math.round(rawDepth * 10) / 10 : null,
            severity:
              item.severity === "kritik" || item.severity === "yuksek" ? item.severity : "normal",
            sourceName: cleanStr(item.sourceName, 60, "AFAD/Yerel Basın"),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(item.publishedDate, nowIso),
            confidence: item.confidence === "medium" ? "medium" : "high",
          };
        })
        .filter(Boolean)
        .slice(0, 8);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        securityEvents,
        groundingSources,
      };
    }

    case "tourism_occupancy": {
      const parsed = extractJsonFromText<Record<string, unknown>>(rawText) ?? {};
      const topUrl = isValidExternalUrl(parsed.sourceUrl) ? parsed.sourceUrl.trim() : fallbackUrl;
      const rawOcc =
        parsed.hotelOccupancyPct !== null && parsed.hotelOccupancyPct !== undefined
          ? Number(parsed.hotelOccupancyPct)
          : NaN;
      const validOcc =
        topUrl && Number.isFinite(rawOcc) && rawOcc >= 0 && rawOcc <= 100
          ? Math.round(rawOcc * 10) / 10
          : null;
      const annualTourists =
        topUrl && typeof parsed.annualTourists === "string" && parsed.annualTourists.trim()
          ? parsed.annualTourists.trim().slice(0, 24)
          : null;
      const airportPassengers =
        topUrl && typeof parsed.airportPassengers === "string" && parsed.airportPassengers.trim()
          ? parsed.airportPassengers.trim().slice(0, 32)
          : null;

      const rawDistrictRates = Array.isArray(parsed.districtRates) ? parsed.districtRates : [];
      const districtRates = rawDistrictRates
        .map((item: Record<string, unknown>) => {
          const district = cleanStr(item?.district, 40);
          const pct = Number(item?.occupancyPct);
          const url = isValidExternalUrl(item?.sourceUrl) ? String(item.sourceUrl).trim() : topUrl;
          if (!district || !Number.isFinite(pct) || pct < 0 || pct > 100 || !url) return null;
          return {
            district,
            occupancyPct: Math.round(pct * 10) / 10,
            sourceName: cleanStr(item?.sourceName, 60, cleanStr(parsed.sourceName, 60, "Yerel Basın")),
            sourceUrl: url,
            measuredAt: parseIsoDateOrFallback(item?.publishedDate ?? parsed.publishedDate, nowIso),
          };
        })
        .filter(Boolean)
        .slice(0, 6);

      const rawHeadlines = Array.isArray(parsed.headlines) ? parsed.headlines : [];
      const headlines = rawHeadlines
        .map((item: Record<string, unknown>) => {
          const title = cleanStr(item?.title, 150);
          const url = isValidExternalUrl(item?.sourceUrl) ? String(item.sourceUrl).trim() : topUrl;
          if (!title || !url) return null;
          return {
            title,
            district: cleanStr(item?.district, 40, "Muğla"),
            sourceName: cleanStr(item?.sourceName, 60, "Yerel Basın"),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(item?.publishedDate ?? parsed.publishedDate, nowIso),
          };
        })
        .filter(Boolean)
        .slice(0, 5);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        tourismMetrics: {
          hotelOccupancyPct: validOcc,
          annualTourists,
          airportPassengers,
          districtRates,
          headlines,
          sourceName: topUrl ? cleanStr(parsed.sourceName, 60, "TÜRSAB / Yerel Basın") : undefined,
          sourceUrl: topUrl || undefined,
          measuredAt: topUrl ? parseIsoDateOrFallback(parsed.publishedDate, nowIso) : undefined,
        },
        groundingSources,
      };
    }

    case "economy_budget": {
      const parsed = extractJsonFromText<Record<string, unknown>>(rawText) ?? {};
      const topUrl = isValidExternalUrl(parsed.sourceUrl) ? parsed.sourceUrl.trim() : fallbackUrl;
      const rawUnemp =
        parsed.unemploymentRate !== null && parsed.unemploymentRate !== undefined
          ? Number(parsed.unemploymentRate)
          : NaN;
      const unemploymentRate =
        topUrl && Number.isFinite(rawUnemp) && rawUnemp > 0 && rawUnemp < 60
          ? Math.round(rawUnemp * 10) / 10
          : null;

      const rawBudgets = Array.isArray(parsed.municipalBudgets) ? parsed.municipalBudgets : [];
      const municipalBudgets = rawBudgets
        .map((entry: Record<string, unknown>) => {
          const institution = cleanStr(entry?.institution, 80);
          const amountBn = Number(entry?.amountBillionTry);
          const url = isValidExternalUrl(entry?.sourceUrl) ? String(entry.sourceUrl).trim() : topUrl;
          if (!institution || !Number.isFinite(amountBn) || amountBn <= 0 || amountBn > 500 || !url) {
            return null;
          }
          const maxAllowedYear = new Date().getFullYear() + 5;
          const rawYear = entry?.year !== null && entry?.year !== undefined ? Number(entry.year) : NaN;
          const year = Number.isFinite(rawYear) && rawYear >= 2020 && rawYear <= maxAllowedYear ? Math.round(rawYear) : null;
          const rawYoy =
            entry?.yoyChangePct !== null && entry?.yoyChangePct !== undefined
              ? Number(entry.yoyChangePct)
              : NaN;
          const yoyChangePct =
            Number.isFinite(rawYoy) && rawYoy > -100 && rawYoy < 500
              ? Math.round(rawYoy * 100) / 100
              : null;
          const rawInv =
            entry?.investmentBillionTry !== null && entry?.investmentBillionTry !== undefined
              ? Number(entry.investmentBillionTry)
              : NaN;
          const investmentBillionTry =
            Number.isFinite(rawInv) && rawInv > 0 && rawInv <= amountBn
              ? Math.round(rawInv * 100) / 100
              : null;
          return {
            institution,
            amountBillionTry: Math.round(amountBn * 100) / 100,
            year,
            yoyChangePct,
            investmentBillionTry,
            sourceName: cleanStr(entry?.sourceName, 60, cleanStr(parsed.sourceName, 60, "Muğla Büyükşehir / Yerel Basın")),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(entry?.publishedDate ?? parsed.publishedDate, nowIso),
          };
        })
        .filter(Boolean)
        .slice(0, 12);

      const rawCombined =
        parsed.combinedTotalBillionTry !== null && parsed.combinedTotalBillionTry !== undefined
          ? Number(parsed.combinedTotalBillionTry)
          : NaN;
      const combinedTotalBillionTry =
        (topUrl || municipalBudgets.length > 0) &&
        Number.isFinite(rawCombined) &&
        rawCombined > 0 &&
        rawCombined < 500
          ? Math.round(rawCombined * 100) / 100
          : null;

      const maxBudgetYear = new Date().getFullYear() + 5;
      const rawBudgetYear =
        parsed.budgetYear !== null && parsed.budgetYear !== undefined ? Number(parsed.budgetYear) : NaN;
      const budgetYear =
        Number.isFinite(rawBudgetYear) && rawBudgetYear >= 2020 && rawBudgetYear <= maxBudgetYear
          ? Math.round(rawBudgetYear)
          : null;

      const rawBudgetYoy =
        parsed.budgetYoyChangePct !== null && parsed.budgetYoyChangePct !== undefined
          ? Number(parsed.budgetYoyChangePct)
          : NaN;
      const budgetYoyChangePct =
        Number.isFinite(rawBudgetYoy) && rawBudgetYoy > -100 && rawBudgetYoy < 500
          ? Math.round(rawBudgetYoy * 100) / 100
          : null;

      const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
      const items = rawItems
        .map((item: Record<string, unknown>, idx: number) => {
          const title = cleanStr(item?.title, 150);
          const url = isValidExternalUrl(item?.sourceUrl) ? String(item.sourceUrl).trim() : topUrl;
          if (!title || !url) return null;
          const cat = item?.category;
          return {
            id: `eb-${idx}-${Date.now()}`,
            institution: cleanStr(item?.institution, 60, "Muğla Büyükşehir"),
            category:
              cat === "butce" || cat === "ihale" || cat === "yatirim" || cat === "isgucu"
                ? cat
                : "yatirim",
            title,
            amountLabel: cleanStr(item?.amountLabel, 40) || undefined,
            sourceName: cleanStr(item?.sourceName, 60, "Yerel Basın"),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(item?.publishedDate ?? parsed.publishedDate, nowIso),
          };
        })
        .filter(Boolean)
        .slice(0, 6);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        economyUpdates: {
          budgetYear,
          combinedTotalBillionTry,
          budgetYoyChangePct,
          municipalBudgets,
          unemploymentRate,
          unemploymentPeriod: unemploymentRate !== null ? cleanStr(parsed.unemploymentPeriod, 40, "TÜİK") : null,
          unemploymentSource: unemploymentRate !== null ? cleanStr(parsed.unemploymentSource, 40, "TÜİK") : null,
          items,
          sourceName: topUrl ? cleanStr(parsed.sourceName, 60, "Muğla Büyükşehir / TÜİK") : undefined,
          sourceUrl: topUrl || undefined,
          measuredAt: topUrl ? parseIsoDateOrFallback(parsed.publishedDate, nowIso) : undefined,
        },
        groundingSources,
      };
    }

    case "protocol_activity": {
      const parsed = extractJsonFromText<{ activities?: Array<Record<string, unknown>> }>(rawText);
      const rawActivities = Array.isArray(parsed?.activities) ? parsed!.activities : [];
      const protocolActivities = rawActivities
        .map((item, idx) => {
          const actorName = cleanStr(item.actorName, 80);
          const actorTitle = cleanStr(item.actorTitle, 100);
          const summary = cleanStr(item.summary, 180);
          const url = isValidExternalUrl(item.sourceUrl) ? item.sourceUrl.trim() : fallbackUrl;
          if ((!actorName && !actorTitle) || !summary || !url) return null;
          const cat = item.category;
          return {
            id: `pa-${idx}-${Date.now()}`,
            actorName,
            actorTitle,
            category:
              cat === "ziyaret" || cat === "gorev_degisikligi" ? cat : "aciklama",
            summary,
            sourceName: cleanStr(item.sourceName, 60, "Resmi Kaynak / Yerel Basın"),
            sourceUrl: url,
            publishedAt: parseIsoDateOrFallback(item.publishedDate, nowIso),
          };
        })
        .filter(Boolean)
        .slice(0, 8);

      return {
        ok: true,
        topic,
        model: GEMINI_MODEL,
        fetchedAt: nowIso,
        protocolActivities,
        groundingSources,
      };
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";

  try {
    const payload = await executeTopicGrounding(body.topic, apiKey);
    if (payload && typeof payload === "object" && "ok" in payload && payload.ok === true) {
      const normalizedTopic = normalizeTopicKey(body.topic);
      await persistTopicGroundingToSupabase(
        normalizedTopic,
        payload as unknown as Record<string, unknown>
      );
    }
    return sendJson(res, 200, payload);
  } catch (err) {
    if (isGeminiRateLimitError(err)) {
      const retryAfterMs = markGeminiRateLimited(RATE_LIMIT_COOLDOWN_MS);
      console.warn(
        `[vercel /api/intel/topic-grounding] Gemini 429 RESOURCE_EXHAUSTED — ${Math.round(
          retryAfterMs / 60000
        )} dk bekleme modu.`
      );
      return sendJson(res, 200, buildRateLimitedPayload(normalizeTopicKey(body.topic), retryAfterMs));
    }
    console.error("[vercel /api/intel/topic-grounding] error:", err);
    return sendJson(res, 200, {
      ok: false,
      fallback: true,
      reason: "Konu bazlı Google Search Grounding geçici olarak kullanılamıyor.",
    });
  }
}
