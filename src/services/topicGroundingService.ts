// Konu Bazlı Güncelleme & Doğrulanmış Baraj / Altyapı İstihbarat Servisi
// Sabit veya gerçek dışı mock değerler yerine Gemini Search Grounding (/api/intel/topic-grounding)
// ve doğrulanmış yerel basın/kurum kaynaklarından (Anter Haber, AA, MUSKİ, DSİ vb.) beslenir.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { isValidVerificationUrl } from "@/services/fieldArbitrationEngine";

export type SectorTopicKey = "environment_dams" | "transport_infra";

export const TOPIC_GROUNDING_QUERIES: Record<
  SectorTopicKey,
  { label: string; tab: string; query: string }
> = {
  environment_dams: {
    label: "Çevre / Barajlar",
    tab: "Çevre",
    query:
      '"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı',
  },
  transport_infra: {
    label: "Ulaşım / Altyapı",
    tab: "Ulaşım",
    query:
      '"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik',
  },
};

export interface VerifiedDamDefinition {
  id: string;
  name: string;
  district: string;
  capacityHm3: number;
  aliases: string[];
}

// DSİ & MUSKİ resmi kapasite envanteri (Muğla'daki 8 gerçek baraj — hm³ toplam depolama hacmi)
export const MUGLA_DAMS_REGISTRY: VerifiedDamDefinition[] = [
  {
    id: "mumcular",
    name: "Mumcular Barajı",
    district: "Bodrum",
    capacityHm3: 18.6,
    aliases: ["mumcular barajı", "mumcular"],
  },
  {
    id: "geyik",
    name: "Geyik Barajı",
    district: "Milas",
    capacityHm3: 40.8,
    aliases: ["geyik barajı", "geyik"],
  },
  {
    id: "akgedik",
    name: "Akgedik Barajı",
    district: "Milas",
    capacityHm3: 26.3,
    aliases: ["akgedik barajı", "akgedik"],
  },
  {
    id: "marmaris",
    name: "Marmaris (Atatürk) Barajı",
    district: "Marmaris",
    capacityHm3: 30.0,
    aliases: [
      "marmaris barajı",
      "marmaris atatürk barajı",
      "atatürk barajı",
      "marmaris (atatürk) barajı",
    ],
  },
  {
    id: "akkopru",
    name: "Akköprü Barajı ve HES",
    district: "Dalaman",
    capacityHm3: 384.5,
    aliases: ["akköprü barajı", "akköprü barajı ve hes", "akköprü"],
  },
  {
    id: "bayir",
    name: "Bayır Barajı",
    district: "Menteşe",
    capacityHm3: 7.1,
    aliases: ["bayır barajı", "bayır"],
  },
  {
    id: "esen1",
    name: "Eşen 1 Barajı ve HES",
    district: "Seydikemer",
    capacityHm3: 22.9,
    aliases: ["eşen 1 barajı", "eşen 1 barajı ve hes", "eşen 1", "eşen-1"],
  },
  {
    id: "esen2",
    name: "Eşen 2 Barajı ve HES",
    district: "Seydikemer",
    capacityHm3: 6.4,
    aliases: ["eşen 2 barajı", "eşen 2 barajı ve hes", "eşen 2", "eşen-2"],
  },
];

export interface DamMeasurementObservation {
  damId: string;
  damName: string;
  occupancyRate: number;
  sourceName: string;
  sourceUrl?: string;
  measuredAt: string;
  confidence: "high" | "medium";
  headline?: string;
}

export interface TransportTopicIncident {
  id: string;
  title: string;
  district: string;
  category: "yol_calismasi" | "isale_hatti" | "trafik";
  status: "devam" | "tamamlandı" | "uyarı";
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  confidence: "high" | "medium";
}

export interface MergedDamRecord {
  id: string;
  name: string;
  district: string;
  capacityHm3: number;
  capacityLabel: string;
  occupancyRate: number | null;
  sourceName?: string;
  sourceUrl?: string;
  measuredAt?: string;
  confidence?: "high" | "medium";
  headline?: string;
  isVerified: boolean;
}

export interface DamIntelligenceSnapshot {
  dams: MergedDamRecord[];
  avgOccupancy: number | null;
  verifiedCount: number;
  hasVerifiedLiveData: boolean;
  latestSourceSummary: string;
  latestMeasuredAt: string | null;
}

const TR_SHORT_MONTHS = [
  "Oca",
  "Şub",
  "Mar",
  "Nis",
  "May",
  "Haz",
  "Tem",
  "Ağu",
  "Eyl",
  "Eki",
  "Kas",
  "Ara",
];

const TRUSTED_PRESS_HINTS = [
  "anter haber",
  "anterhaber",
  "anadolu ajansı",
  "aa",
  "muski",
  "muskİ",
  "dsİ",
  "dsi",
  "muğla gazetesi",
  "muğla postası",
  "dha",
  "iha",
  "trt",
  "bodrum",
  "marmaris",
  "fethiye",
  "yerel basın",
  "hamle",
  "devrim",
  "gündem",
  "haber48",
  "mugla.bel.tr",
  "mugla.gov.tr",
];

function normTr(value: string): string {
  return value.toLocaleLowerCase("tr-TR").trim();
}

export function formatShortTurkishDate(isoOrDate?: string | null): string {
  if (!isoOrDate) return "";
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return "";
  const day = parsed.getDate();
  const month = TR_SHORT_MONTHS[parsed.getMonth()] ?? "";
  return `${day} ${month}`.trim();
}

export function resolveMuglaDam(nameOrText?: string | null): VerifiedDamDefinition | null {
  if (!nameOrText) return null;
  const lower = normTr(nameOrText);
  for (const dam of MUGLA_DAMS_REGISTRY) {
    if (normTr(dam.name) === lower) return dam;
    if (dam.aliases.some((alias) => lower.includes(alias))) {
      return dam;
    }
  }
  return null;
}

function isTrustedPressOrOfficial(sourceName?: string, sourceUrl?: string): boolean {
  if (isValidVerificationUrl(sourceUrl)) return true;
  if (!sourceName) return false;
  const low = normTr(sourceName);
  return TRUSTED_PRESS_HINTS.some((hint) => low.includes(normTr(hint)));
}

/**
 * Yerel basın veya kurum duyurusu metninden baraj doluluk yüzdesini deterministik olarak ayıklar.
 * Ör: "Mumcular Barajı doluluk %80'i aştı", "Geyik Barajı yüzde 64,5 doluluk oranına ulaştı"
 */
export function extractDamUpdatesFromNewsText(params: {
  text: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string;
}): DamMeasurementObservation[] {
  const { text, sourceName = "Yerel Basın/DSİ", sourceUrl, publishedAt } = params;
  if (!text || text.trim().length < 8) return [];
  if (!isTrustedPressOrOfficial(sourceName, sourceUrl)) return [];

  const cleanText = text.replace(/\s+/g, " ").trim();
  const lower = normTr(cleanText);
  if (
    !lower.includes("baraj") &&
    !MUGLA_DAMS_REGISTRY.some((d) => d.aliases.some((a) => lower.includes(a)))
  ) {
    return [];
  }

  const results: DamMeasurementObservation[] = [];
  const measuredAt =
    publishedAt && !Number.isNaN(new Date(publishedAt).getTime())
      ? new Date(publishedAt).toISOString()
      : new Date().toISOString();

  for (const dam of MUGLA_DAMS_REGISTRY) {
    const matchedAlias = dam.aliases.find((alias) => lower.includes(alias));
    if (!matchedAlias) continue;

    // Avoid matching national Şanlıurfa Atatürk Barajı unless Muğla/Marmaris context is present
    if (
      dam.id === "marmaris" &&
      matchedAlias === "atatürk barajı" &&
      !lower.includes("marmaris") &&
      !lower.includes("muğla") &&
      !lower.includes("muski")
    ) {
      continue;
    }

    const idx = lower.indexOf(matchedAlias);
    const afterStart = idx + matchedAlias.length;
    const afterRaw = cleanText.slice(afterStart, Math.min(cleanText.length, afterStart + 100));
    // Stop forward scan at sentence end or before another dam mention
    const afterClause = afterRaw.split(/[.!?;]/)[0] ?? afterRaw;
    const matchPercent = (segment: string) => {
      const segLow = normTr(segment);
      return (
        segLow.match(/%\s*(\d{1,3}(?:[.,]\d{1,2})?)/) ||
        segLow.match(/yüzde\s+(\d{1,3}(?:[.,]\d{1,2})?)/) ||
        segLow.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/)
      );
    };

    let pctMatch = matchPercent(afterClause);
    if (!pctMatch) {
      const beforeRaw = cleanText.slice(Math.max(0, idx - 45), idx);
      const beforeParts = beforeRaw.split(/[,.;!?]/);
      const immediateBefore = beforeParts[beforeParts.length - 1] ?? "";
      pctMatch = matchPercent(immediateBefore);
    }

    if (!pctMatch) continue;
    const numeric = Number(pctMatch[1].replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) continue;

    const rate = Math.round(numeric * 10) / 10;
    const highConfidence =
      isValidVerificationUrl(sourceUrl) ||
      /dsİ|dsi|muski|anadolu ajansı|\baa\b|anter haber/i.test(sourceName);

    results.push({
      damId: dam.id,
      damName: dam.name,
      occupancyRate: rate,
      sourceName: sourceName.trim() || "Yerel Basın/DSİ",
      sourceUrl: isValidVerificationUrl(sourceUrl) ? sourceUrl!.trim() : undefined,
      measuredAt,
      confidence: highConfidence ? "high" : "medium",
      headline: cleanText.slice(0, 140),
    });
  }

  return results;
}

function isSyntheticSeasonalCache(cacheData: any): boolean {
  if (!cacheData || typeof cacheData !== "object") return false;
  const src = normTr(String(cacheData.source ?? ""));
  const note = normTr(String(cacheData.note ?? ""));
  return (
    src.includes("sezonsal model") ||
    src.includes("mevsimsel") ||
    note.includes("mevsimsel model") ||
    note.includes("gerçek zamanlı api mevcut değil")
  );
}

function observationScore(obs: DamMeasurementObservation): number {
  const ts = new Date(obs.measuredAt).getTime();
  const safeTs = Number.isFinite(ts) ? ts : 0;
  // Newer verified observation wins; within same day, high confidence wins
  const dayBucket = Math.floor(safeTs / (12 * 3600 * 1000));
  const confBonus = obs.confidence === "high" ? 1 : 0;
  return dayBucket * 10 + confBonus;
}

/**
 * 8 gerçek Muğla barajını doğru DSİ kapasiteleriyle başlatır ve yalnızca doğrulanmış
 * kaynaklardan (Topic Grounding, doğrulanmış basın, canlı resmi önbellek) gelen en yeni
 * yüksek güvenli ölçümleri birleştirir. Eski/sahte sezonsal model oranlarını ve hatalı
 * kapasiteleri (örn. Mumcular 70.2 hm³) asla göstermez.
 */
export function mergeDamIntelligence(params: {
  cacheData?: any;
  groundedUpdates?: DamMeasurementObservation[];
  pressUpdates?: DamMeasurementObservation[];
}): DamIntelligenceSnapshot {
  const { cacheData, groundedUpdates = [], pressUpdates = [] } = params;

  const bestByDamId = new Map<string, DamMeasurementObservation>();
  const consider = (obs: DamMeasurementObservation) => {
    if (!Number.isFinite(obs.occupancyRate) || obs.occupancyRate < 0 || obs.occupancyRate > 100) {
      return;
    }
    const existing = bestByDamId.get(obs.damId);
    if (!existing || observationScore(obs) > observationScore(existing)) {
      bestByDamId.set(obs.damId, obs);
    }
  };

  // 1. Only trust live_data_cache dam rates if they are NOT from the old synthetic seasonal model
  const cacheRows = Array.isArray(cacheData)
    ? cacheData
    : Array.isArray(cacheData?.dams)
    ? cacheData.dams
    : [];
  const cacheIsSynthetic = isSyntheticSeasonalCache(cacheData);
  const cacheUpdatedAt =
    typeof cacheData?.updated_at === "string"
      ? cacheData.updated_at
      : typeof cacheData?.fetched_at === "string"
      ? cacheData.fetched_at
      : undefined;

  if (!cacheIsSynthetic) {
    for (const row of cacheRows) {
      if (!row || row.estimated === true) continue;
      const rawRate = row.occupancy_rate ?? row.rate;
      if (rawRate === null || rawRate === undefined || !Number.isFinite(Number(rawRate))) continue;
      const dam = resolveMuglaDam(row.name);
      if (!dam) continue;
      const rowSource = String(row.source_name || cacheData?.source || "").trim();
      const rowUrl = typeof row.source_url === "string" ? row.source_url : undefined;
      if (!isTrustedPressOrOfficial(rowSource, rowUrl)) continue;
      consider({
        damId: dam.id,
        damName: dam.name,
        occupancyRate: Math.round(Number(rawRate) * 10) / 10,
        sourceName: rowSource || "Yerel Basın/DSİ",
        sourceUrl: isValidVerificationUrl(rowUrl) ? rowUrl : undefined,
        measuredAt: String(row.measured_at || cacheUpdatedAt || new Date().toISOString()),
        confidence: isValidVerificationUrl(rowUrl) ? "high" : "medium",
        headline: typeof row.headline === "string" ? row.headline : undefined,
      });
    }
  }

  // 2. Verified press extractions (from Supabase social_posts)
  for (const obs of pressUpdates) {
    consider(obs);
  }

  // 3. Topic-based Gemini Search Grounding updates (highest freshness)
  for (const obs of groundedUpdates) {
    consider(obs);
  }

  const dams: MergedDamRecord[] = MUGLA_DAMS_REGISTRY.map((def) => {
    const obs = bestByDamId.get(def.id);
    return {
      id: def.id,
      name: def.name,
      district: def.district,
      capacityHm3: def.capacityHm3,
      capacityLabel: `${def.capacityHm3} hm³`,
      occupancyRate: obs ? obs.occupancyRate : null,
      sourceName: obs?.sourceName,
      sourceUrl: obs?.sourceUrl,
      measuredAt: obs?.measuredAt,
      confidence: obs?.confidence,
      headline: obs?.headline,
      isVerified: Boolean(obs),
    };
  });

  const verifiedDams = dams.filter((d) => d.occupancyRate !== null);
  const avgOccupancy =
    verifiedDams.length > 0
      ? Math.round(
          verifiedDams.reduce((acc, d) => acc + (d.occupancyRate ?? 0), 0) / verifiedDams.length
        )
      : null;

  let latestObs: DamMeasurementObservation | null = null;
  for (const obs of bestByDamId.values()) {
    if (
      !latestObs ||
      new Date(obs.measuredAt).getTime() > new Date(latestObs.measuredAt).getTime()
    ) {
      latestObs = obs;
    }
  }

  const latestShortDate = latestObs ? formatShortTurkishDate(latestObs.measuredAt) : "";
  const latestSourceSummary = latestObs
    ? `Kaynak: ${latestObs.sourceName}${latestShortDate ? ` • ${latestShortDate}` : ""}`
    : "Canlı resmi ölçüm yok · Yerel basın/DSİ teyidi bekleniyor";

  return {
    dams,
    avgOccupancy,
    verifiedCount: verifiedDams.length,
    hasVerifiedLiveData: verifiedDams.length > 0,
    latestSourceSummary,
    latestMeasuredAt: latestObs?.measuredAt ?? null,
  };
}

const TOPIC_CACHE_PREFIX = "mugla_topic_grounding_v1:";
const TOPIC_CACHE_TTL_MS = 30 * 60 * 1000;

interface TopicGroundingPayload {
  topic: SectorTopicKey;
  fetchedAt: string;
  damUpdates?: DamMeasurementObservation[];
  transportIncidents?: TransportTopicIncident[];
  groundingSources?: Array<{ uri: string; title: string }>;
}

function readLocalTopicCache(topic: SectorTopicKey): TopicGroundingPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${TOPIC_CACHE_PREFIX}${topic}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TopicGroundingPayload;
    if (!parsed?.fetchedAt) return null;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age > TOPIC_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalTopicCache(topic: SectorTopicKey, payload: TopicGroundingPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TOPIC_CACHE_PREFIX}${topic}`, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchTopicGrounding(
  topic: SectorTopicKey
): Promise<TopicGroundingPayload> {
  const cached = readLocalTopicCache(topic);
  if (cached) return cached;

  const empty: TopicGroundingPayload = {
    topic,
    fetchedAt: new Date().toISOString(),
    damUpdates: [],
    transportIncidents: [],
    groundingSources: [],
  };

  if (typeof fetch !== "function") return empty;

  try {
    const resp = await fetch("/api/intel/topic-grounding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!resp.ok) return empty;
    const json = await resp.json();
    if (!json?.ok) return empty;

    const payload: TopicGroundingPayload = {
      topic,
      fetchedAt: json.fetchedAt || new Date().toISOString(),
      damUpdates: Array.isArray(json.damUpdates) ? json.damUpdates : [],
      transportIncidents: Array.isArray(json.transportIncidents) ? json.transportIncidents : [],
      groundingSources: Array.isArray(json.groundingSources) ? json.groundingSources : [],
    };
    writeLocalTopicCache(topic, payload);
    return payload;
  } catch {
    return empty;
  }
}

async function fetchVerifiedDamPressPosts(): Promise<DamMeasurementObservation[]> {
  try {
    const since = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("social_posts")
      .select("content, author, url, published_at")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(120);

    if (error || !Array.isArray(data)) return [];

    const observations: DamMeasurementObservation[] = [];
    for (const row of data) {
      const text = String(row.content ?? "");
      if (!normTr(text).includes("baraj")) continue;
      const extracted = extractDamUpdatesFromNewsText({
        text,
        sourceName: String(row.author || "Yerel Basın/DSİ"),
        sourceUrl: typeof row.url === "string" ? row.url : undefined,
        publishedAt: typeof row.published_at === "string" ? row.published_at : undefined,
      });
      observations.push(...extracted);
    }
    return observations;
  } catch {
    return [];
  }
}

/**
 * Çevre -> Su & Barajlar kartı ile Genel Bakış üst şeridindeki "Baraj" özetinin
 * tek ve senkronize veri kaynağı.
 */
export function useDamIntelligence() {
  const { data: cacheData, isLoading: cacheLoading } = useLiveData<any>("dams", {
    refetchInterval: 60 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "environment_dams"],
    queryFn: () => fetchTopicGrounding("environment_dams"),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: false,
  });

  const { data: pressUpdates = [] } = useQuery<DamMeasurementObservation[]>({
    queryKey: ["dam-press-observations"],
    queryFn: fetchVerifiedDamPressPosts,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });

  const snapshot = useMemo(
    () =>
      mergeDamIntelligence({
        cacheData,
        groundedUpdates: topicData?.damUpdates ?? [],
        pressUpdates,
      }),
    [cacheData, topicData?.damUpdates, pressUpdates]
  );

  return {
    ...snapshot,
    isLoading: cacheLoading || topicLoading,
  };
}

/**
 * Ulaşım / Altyapı konusu için Gemini Search Grounding üzerinden doğrulanmış
 * yol çalışması, isale hattı arızası ve trafik gelişmelerini periyodik çeker.
 */
export function useTransportTopicGrounding() {
  const { data, isLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "transport_infra"],
    queryFn: () => fetchTopicGrounding("transport_infra"),
    staleTime: 20 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });

  return {
    incidents: data?.transportIncidents ?? [],
    fetchedAt: data?.fetchedAt ?? null,
    isLoading,
  };
}
