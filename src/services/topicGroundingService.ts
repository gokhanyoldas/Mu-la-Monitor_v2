// Konu Bazlı Güncelleme & Doğrulanmış Baraj / Altyapı İstihbarat Servisi
// Sabit veya gerçek dışı mock değerler yerine Gemini Search Grounding (/api/intel/topic-grounding)
// ve doğrulanmış yerel basın/kurum kaynaklarından (Anter Haber, AA, MUSKİ, DSİ vb.) beslenir.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { useLiveData } from "@/hooks/useLiveData";
import { isValidVerificationUrl } from "@/services/fieldArbitrationEngine";
import { useMonitorStore } from "@/store/useMonitorStore";

export type SectorTopicKey =
  | "environment_dams"
  | "transport_infra"
  | "energy_outages"
  | "security_quakes"
  | "tourism_occupancy"
  | "economy_budget"
  | "protocol_activity";

export function getDynamicQueryYears(now: Date = new Date()): {
  currentYear: number;
  nextYear: number;
} {
  const currentYear = now.getFullYear();
  return { currentYear, nextYear: currentYear + 1 };
}

export function buildTopicGroundingQueries(
  now: Date = new Date()
): Record<SectorTopicKey, { label: string; tab: string; query: string }> {
  const { currentYear, nextYear } = getDynamicQueryYears(now);
  return {
    environment_dams: {
      label: "Çevre / Barajlar",
      tab: "Çevre",
      query: `"Mumcular Barajı" OR "Geyik Barajı" OR "Akgedik Barajı" OR "Atatürk Barajı" Muğla doluluk oranı ${currentYear}`,
    },
    transport_infra: {
      label: "Ulaşım / Altyapı",
      tab: "Ulaşım",
      query:
        '"Muğla" OR "Bodrum" OR "Marmaris" yol çalışması OR isale hattı patladı OR trafik',
    },
    energy_outages: {
      label: "Enerji / ADM Elektrik",
      tab: "Enerji",
      query: '"ADM Elektrik" Muğla planlı kesinti OR arıza OR elektrik kesintisi',
    },
    security_quakes: {
      label: "Güvenlik / AFAD, Asayiş & Yangın",
      tab: "Güvenlik",
      query:
        '("AFAD" OR "Kandilli") Muğla deprem OR ("Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" asayiş OR "trafik kazası" OR "Sahil Güvenlik" OR yangın)',
    },
    tourism_occupancy: {
      label: "Turizm / Doluluk & Yolcu",
      tab: "Turizm",
      query: `"Muğla" OR "Bodrum" OR "Marmaris" OR "Fethiye" otel doluluk oranı OR turist sayısı OR Dalaman Havalimanı yolcu ${currentYear}`,
    },
    economy_budget: {
      label: "Ekonomi / Bütçe & İhale",
      tab: "Ekonomi",
      query: `"Muğla Büyükşehir Belediyesi" OR "MUSKİ" OR "Bodrum Belediyesi" OR "Marmaris Belediyesi" bütçe milyar TL OR ihale ${currentYear} OR ${nextYear}`,
    },
    protocol_activity: {
      label: "Muğla Protokol / Son 24s",
      tab: "Protokol",
      query: `("Muğla Valisi" OR "Seddar Yavuz" OR "Muğla Büyükşehir Belediye Başkanı" OR "Ahmet Aras" OR "Muğla Kaymakam" OR "Muğla Başsavcı") ziyaret OR açıklama OR atama OR kararname ${currentYear} OR ${nextYear} son 24 saat`,
    },
  };
}

export const TOPIC_GROUNDING_QUERIES: Record<
  SectorTopicKey,
  { label: string; tab: string; query: string }
> = buildTopicGroundingQueries();

/**
 * 26 Kasım 2026 Meclis Kararı doğrulanmış temel bütçe referansı.
 * Canlı topic-grounding veya Supabase verisi geldiğinde her zaman bu tohumun üzerine yazar.
 */
export const VERIFIED_BUDGET_SEED = {
  year: 2026,
  decisionDateIso: "2026-11-26T12:00:00Z",
  mbbBillionTry: 24.3,
  muskiBillionTry: 20.5,
  combinedBillionTry: 44.8,
  yoyChangePct: 30.35,
  muttasCapitalIncreaseTry: 1_116_639_124,
  muttasCapitalIncreaseBillionTry: 1.12,
  sourceLabel:
    "26 Kasım 2026 Meclis Kararı (Muğla BB 24.3 Milyar ₺ + MUSKİ 20.5 Milyar ₺ = 44.8 Milyar ₺, +%30.35)",
  sourceUrl: "https://www.mugla.bel.tr/",
} as const;

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

export interface EnergyOutageNotice {
  id: string;
  district: string;
  neighborhoods: string;
  type: "planli" | "ariza";
  status: "aktif" | "planli" | "giderildi";
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  confidence: "high" | "medium";
}

export interface EnergyIntelligenceSnapshot {
  dailyConsumptionGwh: number | null;
  activeOutageCount: number | null;
  affectedDistricts: string[];
  outages: EnergyOutageNotice[];
  hasVerifiedLiveData: boolean;
  latestSourceSummary: string;
  latestMeasuredAt: string | null;
}

export interface SecurityTopicEvent {
  id: string;
  category: "deprem" | "asayis" | "deniz_guvenligi" | "trafik_kazasi" | "yangin";
  title: string;
  district: string;
  magnitude?: number | null;
  depthKm?: number | null;
  severity: "kritik" | "yuksek" | "normal";
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  confidence: "high" | "medium";
}

export interface MergedQuakeRecord {
  id: string;
  magnitude: number;
  location: string;
  depthKm: number | null;
  occurredAt: string;
  sourceName: string;
  sourceUrl?: string;
}

export interface SecurityIntelligenceSnapshot {
  quakes: MergedQuakeRecord[];
  latestQuake: MergedQuakeRecord | null;
  maxMagnitude: number | null;
  quakeCount: number | null;
  publicOrderEvents: SecurityTopicEvent[];
  publicOrderCount: number | null;
  fireEvents: SecurityTopicEvent[];
  trafficAccidentEvents: SecurityTopicEvent[];
  fireRiskLevel: "YÜKSEK" | "ORTA" | "DÜŞÜK";
  quakeRiskLevel: "YÜKSEK" | "ORTA" | "DÜŞÜK";
  activeAlertCount: number;
  overviewValue: string;
  hasVerifiedLiveData: boolean;
  latestSourceSummary: string;
  latestMeasuredAt: string | null;
}

export interface TourismDistrictRate {
  district: string;
  occupancyPct: number;
  sourceName: string;
  sourceUrl: string;
  measuredAt: string;
}

export interface TourismTopicHeadline {
  title: string;
  district: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface TourismTopicMetrics {
  hotelOccupancyPct?: number | null;
  annualTourists?: string | null;
  airportPassengers?: string | null;
  districtRates?: TourismDistrictRate[];
  headlines?: TourismTopicHeadline[];
  sourceName?: string;
  sourceUrl?: string;
  measuredAt?: string;
}

export interface TourismIntelligenceSnapshot {
  hotelOccupancyPct: number | null;
  annualTourists: string | null;
  airportPassengers: string | null;
  cruiseShips: number | null;
  totalBedsK: string | null;
  districtRates: TourismDistrictRate[];
  headlines: TourismTopicHeadline[];
  hasVerifiedOccupancy: boolean;
  hasVerifiedLiveData: boolean;
  occupancySourceSummary: string;
  movementSourceSummary: string;
  latestMeasuredAt: string | null;
}

export interface EconomyBudgetItem {
  id: string;
  institution: string;
  category: "butce" | "ihale" | "yatirim" | "isgucu";
  title: string;
  amountLabel?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface MunicipalBudgetUpdate {
  institution: string;
  amountBillionTry: number;
  year?: number | null;
  yoyChangePct?: number | null;
  investmentBillionTry?: number | null;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface EconomyTopicUpdates {
  budgetYear?: number | null;
  combinedTotalBillionTry?: number | null;
  budgetYoyChangePct?: number | null;
  municipalBudgets?: MunicipalBudgetUpdate[];
  unemploymentRate?: number | null;
  unemploymentPeriod?: string | null;
  unemploymentSource?: string | null;
  items?: EconomyBudgetItem[];
  sourceName?: string;
  sourceUrl?: string;
  measuredAt?: string;
}

export interface EconomyIntelligenceSnapshot {
  unemploymentRate: number | null;
  unemploymentPeriod: string | null;
  tourismRevenueBn: string | null;
  newCompanies: number | null;
  budgetItems: EconomyBudgetItem[];
  municipalBudgets: MunicipalBudgetUpdate[];
  combinedTotalBillionTry: number | null;
  budgetYear: number | null;
  budgetYoyChangePct: number | null;
  budgetSourceSummary: string;
  hasVerifiedBudgetUpdate: boolean;
  hasVerifiedLiveData: boolean;
  latestSourceSummary: string;
  latestMeasuredAt: string | null;
}

export interface ProtocolTopicActivity {
  id: string;
  actorName: string;
  actorTitle: string;
  category: "ziyaret" | "aciklama" | "gorev_degisikligi";
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
}

export interface ProtocolMemberLike {
  isim: string;
  unvan: string;
  kategori?: string;
}

export interface ProtocolActivitySnapshot {
  byMemberKey: Map<string, ProtocolTopicActivity[]>;
  activities: ProtocolTopicActivity[];
  matchedMemberCount: number;
  hasVerifiedLiveData: boolean;
  latestSourceSummary: string;
  latestMeasuredAt: string | null;
}

const TOPIC_CACHE_PREFIX = "mugla_topic_grounding_v1:";
const TOPIC_COOLDOWN_KEY = "mugla_topic_grounding_cooldown_until_v1";
const TOPIC_CACHE_TTL_MS = 30 * 60 * 1000;
const SUPABASE_TOPIC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TOPIC_NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CLIENT_COOLDOWN_MS = 15 * 60 * 1000;

let clientRateLimitCooldownUntil = 0;
const topicNegativeCacheUntil = new Map<SectorTopicKey, number>();
const inFlightClientTopicFetches = new Map<SectorTopicKey, Promise<TopicGroundingPayload>>();

export function resetTopicGroundingClientState() {
  clientRateLimitCooldownUntil = 0;
  topicNegativeCacheUntil.clear();
  inFlightClientTopicFetches.clear();
  useMonitorStore.getState().resetStore();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(TOPIC_COOLDOWN_KEY);
    } catch {
      // ignore storage errors
    }
  }
}

function getClientCooldownUntil(): number {
  let until = clientRateLimitCooldownUntil;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(TOPIC_COOLDOWN_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > until) {
          until = parsed;
          clientRateLimitCooldownUntil = parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return until;
}

function setClientRateLimitCooldown(retryAfterMs?: number) {
  const clamped = Math.max(
    60_000,
    Math.min(Number.isFinite(Number(retryAfterMs)) && Number(retryAfterMs) > 0 ? Number(retryAfterMs) : DEFAULT_CLIENT_COOLDOWN_MS, 30 * 60 * 1000)
  );
  const until = Date.now() + clamped;
  if (until > clientRateLimitCooldownUntil) {
    clientRateLimitCooldownUntil = until;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TOPIC_COOLDOWN_KEY, String(clientRateLimitCooldownUntil));
    } catch {
      // ignore storage errors
    }
  }
}

function createEmptyTopicPayload(topic: SectorTopicKey): TopicGroundingPayload {
  return {
    topic,
    fetchedAt: new Date().toISOString(),
    damUpdates: [],
    transportIncidents: [],
    energyOutages: [],
    securityEvents: [],
    tourismMetrics: null,
    economyUpdates: null,
    protocolActivities: [],
    groundingSources: [],
  };
}

export interface TopicGroundingPayload {
  topic: SectorTopicKey;
  fetchedAt: string;
  damUpdates?: DamMeasurementObservation[];
  transportIncidents?: TransportTopicIncident[];
  energyOutages?: EnergyOutageNotice[];
  securityEvents?: SecurityTopicEvent[];
  tourismMetrics?: TourismTopicMetrics | null;
  economyUpdates?: EconomyTopicUpdates | null;
  protocolActivities?: ProtocolTopicActivity[];
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

export function writeLocalTopicCache(topic: SectorTopicKey, payload: TopicGroundingPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TOPIC_CACHE_PREFIX}${topic}`, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

async function readSupabaseTopicCache(
  topic: SectorTopicKey
): Promise<TopicGroundingPayload | null> {
  if (!isSupabaseClientConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("live_data_cache")
      .select("data, fetched_at")
      .eq("data_type", `topic_grounding:${topic}`)
      .maybeSingle();
    if (error || !data?.data || typeof data.data !== "object") return null;
    const fetchedAt =
      typeof (data.data as any).fetchedAt === "string"
        ? (data.data as any).fetchedAt
        : typeof data.fetched_at === "string"
        ? data.fetched_at
        : null;
    if (!fetchedAt) return null;
    const age = Date.now() - new Date(fetchedAt).getTime();
    if (!Number.isFinite(age) || age > SUPABASE_TOPIC_CACHE_TTL_MS) return null;
    const payload: TopicGroundingPayload = {
      ...(data.data as TopicGroundingPayload),
      topic,
      fetchedAt,
    };
    writeLocalTopicCache(topic, payload);
    return payload;
  } catch {
    return null;
  }
}

export async function fetchTopicGrounding(
  topic: SectorTopicKey
): Promise<TopicGroundingPayload> {
  const cached = readLocalTopicCache(topic);
  if (cached) return cached;

  const existingInFlight = inFlightClientTopicFetches.get(topic);
  if (existingInFlight) return existingInFlight;

  const task = (async (): Promise<TopicGroundingPayload> => {
    // 7/24 arka plan işçisinin Supabase'e yazdığı güncel tarama varsa ek Gemini kotası tüketme
    const remoteCached = await readSupabaseTopicCache(topic);
    if (remoteCached) return remoteCached;

    const empty = createEmptyTopicPayload(topic);

    // Sunucu 429 RESOURCE_EXHAUSTED bekleme modundaysa yeni istek gönderme
    if (Date.now() < getClientCooldownUntil()) {
      return empty;
    }

    const negUntil = topicNegativeCacheUntil.get(topic) ?? 0;
    if (Date.now() < negUntil) {
      return empty;
    }

    if (typeof fetch !== "function") return empty;

    try {
      const resp = await fetch("/api/intel/topic-grounding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (resp.status === 429) {
        setClientRateLimitCooldown(DEFAULT_CLIENT_COOLDOWN_MS);
        return empty;
      }
      if (!resp.ok) {
        topicNegativeCacheUntil.set(topic, Date.now() + TOPIC_NEGATIVE_CACHE_TTL_MS);
        return empty;
      }
      const json = await resp.json();
      if (json?.rateLimited) {
        setClientRateLimitCooldown(json.retryAfterMs);
        return empty;
      }
      if (!json?.ok) {
        topicNegativeCacheUntil.set(topic, Date.now() + TOPIC_NEGATIVE_CACHE_TTL_MS);
        return empty;
      }

      const payload: TopicGroundingPayload = {
        topic,
        fetchedAt: json.fetchedAt || new Date().toISOString(),
        damUpdates: Array.isArray(json.damUpdates) ? json.damUpdates : [],
        transportIncidents: Array.isArray(json.transportIncidents) ? json.transportIncidents : [],
        energyOutages: Array.isArray(json.energyOutages) ? json.energyOutages : [],
        securityEvents: Array.isArray(json.securityEvents) ? json.securityEvents : [],
        tourismMetrics:
          json.tourismMetrics && typeof json.tourismMetrics === "object"
            ? json.tourismMetrics
            : null,
        economyUpdates:
          json.economyUpdates && typeof json.economyUpdates === "object"
            ? json.economyUpdates
            : null,
        protocolActivities: Array.isArray(json.protocolActivities) ? json.protocolActivities : [],
        groundingSources: Array.isArray(json.groundingSources) ? json.groundingSources : [],
      };
      writeLocalTopicCache(topic, payload);
      return payload;
    } catch {
      topicNegativeCacheUntil.set(topic, Date.now() + TOPIC_NEGATIVE_CACHE_TTL_MS);
      return empty;
    }
  })().finally(() => {
    inFlightClientTopicFetches.delete(topic);
  });

  inFlightClientTopicFetches.set(topic, task);
  return task;
}

function buildSourceAttribution(sourceName?: string | null, isoDate?: string | null): string {
  const name = (sourceName || "").trim();
  const shortDate = formatShortTurkishDate(isoDate);
  if (!name && !shortDate) return "";
  if (name && shortDate) return `Kaynak: ${name} • ${shortDate}`;
  if (name) return `Kaynak: ${name}`;
  return `Güncelleme: ${shortDate}`;
}

/**
 * 1. ENERJİ: ADM Elektrik kesinti duyuruları ile doğrulanmış canlı tüketim verilerini birleştirir.
 * Canlı veri yoksa sabit 1.8 GWh veya "3 kesinti" uydurmaz; null (UI'da "—") döner.
 */
export function mergeEnergyIntelligence(params: {
  energyCache?: any;
  groundedOutages?: EnergyOutageNotice[];
  arbitratedAlertsCount?: number;
  arbitratedDistricts?: string[];
}): EnergyIntelligenceSnapshot {
  const {
    energyCache,
    groundedOutages = [],
    arbitratedAlertsCount = 0,
    arbitratedDistricts = [],
  } = params;

  const verifiedOutages = groundedOutages.filter(
    (o) => Boolean(o?.district && o?.summary && isValidVerificationUrl(o?.sourceUrl))
  );

  const cacheIsSynthetic =
    !energyCache || energyCache?.estimated === true || isSyntheticSeasonalCache(energyCache);

  const rawConsumption =
    !cacheIsSynthetic && energyCache?.daily_consumption_gwh !== undefined
      ? Number(energyCache.daily_consumption_gwh)
      : NaN;
  const dailyConsumptionGwh =
    Number.isFinite(rawConsumption) && rawConsumption > 0
      ? Math.round(rawConsumption * 100) / 100
      : null;

  const activeGrounded = verifiedOutages.filter((o) => o.status !== "giderildi");
  const cacheOutageRaw =
    !cacheIsSynthetic && energyCache?.active_outages !== undefined
      ? Number(energyCache.active_outages)
      : NaN;

  let activeOutageCount: number | null = null;
  if (activeGrounded.length > 0 || arbitratedAlertsCount > 0) {
    activeOutageCount = activeGrounded.length + arbitratedAlertsCount;
  } else if (verifiedOutages.length > 0) {
    activeOutageCount = 0;
  } else if (Number.isFinite(cacheOutageRaw) && cacheOutageRaw >= 0) {
    activeOutageCount = Math.round(cacheOutageRaw);
  }

  const districtSet = new Set<string>();
  for (const o of activeGrounded) {
    if (o.district.trim()) districtSet.add(o.district.trim());
  }
  for (const d of arbitratedDistricts) {
    if (d && d.trim()) districtSet.add(d.trim());
  }
  const affectedDistricts = Array.from(districtSet);

  const sortedOutages = [...verifiedOutages].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const latestOutage = sortedOutages[0] ?? null;
  const cacheUpdatedAt =
    typeof energyCache?.updated_at === "string"
      ? energyCache.updated_at
      : typeof energyCache?.fetched_at === "string"
      ? energyCache.fetched_at
      : null;

  const latestMeasuredAt = latestOutage?.publishedAt ?? (!cacheIsSynthetic ? cacheUpdatedAt : null);
  const hasVerifiedLiveData =
    verifiedOutages.length > 0 || arbitratedAlertsCount > 0 || dailyConsumptionGwh !== null;

  let latestSourceSummary = "Canlı ADM Elektrik kesinti verisi yok · Tarama bekleniyor";
  if (latestOutage) {
    latestSourceSummary = buildSourceAttribution(latestOutage.sourceName, latestOutage.publishedAt);
  } else if (!cacheIsSynthetic && dailyConsumptionGwh !== null) {
    latestSourceSummary =
      buildSourceAttribution(energyCache?.source || "EPİAŞ / ADM Elektrik", cacheUpdatedAt) ||
      "Kaynak: EPİAŞ / ADM Elektrik";
  }

  return {
    dailyConsumptionGwh,
    activeOutageCount,
    affectedDistricts,
    outages: sortedOutages.slice(0, 5),
    hasVerifiedLiveData,
    latestSourceSummary,
    latestMeasuredAt,
  };
}

/**
 * 2. GÜVENLİK: AFAD/Kandilli/USGS Muğla depremleri ile doğrulanmış asayiş/deniz güvenliği
 * gelişmelerini birleştirir. Sabit "485", "128" ve "78/100" uydurma değerlerini üretmez.
 */
export function mergeSecurityIntelligence(params: {
  earthquakeCache?: any;
  groundedEvents?: SecurityTopicEvent[];
}): SecurityIntelligenceSnapshot {
  const { earthquakeCache, groundedEvents = [] } = params;

  const quakes: MergedQuakeRecord[] = [];
  const rawCacheList = Array.isArray(earthquakeCache)
    ? earthquakeCache
    : Array.isArray(earthquakeCache?.earthquakes)
    ? earthquakeCache.earthquakes
    : Array.isArray(earthquakeCache?.events)
    ? earthquakeCache.events
    : [];

  for (let i = 0; i < rawCacheList.length; i++) {
    const q = rawCacheList[i];
    if (!q || typeof q !== "object") continue;
    const mag = Number(q.magnitude ?? q.mag);
    if (!Number.isFinite(mag) || mag <= 0 || mag >= 10) continue;
    const loc = String(q.location ?? q.place ?? q.title ?? "Muğla").trim();
    const depthRaw = q.depth_km ?? q.depth;
    const depthNum = depthRaw !== null && depthRaw !== undefined ? Number(depthRaw) : NaN;
    const rawTime = q.time ?? q.date ?? q.timestamp ?? q.occurred_at;
    const parsedTime = rawTime ? new Date(rawTime) : null;
    const occurredAt =
      parsedTime && !Number.isNaN(parsedTime.getTime())
        ? parsedTime.toISOString()
        : new Date().toISOString();
    const url = typeof q.url === "string" ? q.url : typeof q.source_url === "string" ? q.source_url : undefined;
    quakes.push({
      id: String(q.id ?? `eq-cache-${i}`),
      magnitude: Math.round(mag * 10) / 10,
      location: loc.slice(0, 90),
      depthKm: Number.isFinite(depthNum) && depthNum >= 0 ? Math.round(depthNum * 10) / 10 : null,
      occurredAt,
      sourceName: String(q.source || earthquakeCache?.source || "AFAD/USGS").trim(),
      sourceUrl: isValidVerificationUrl(url) ? url : undefined,
    });
  }

  const verifiedGrounded = groundedEvents.filter(
    (e) => Boolean(e?.title && isValidVerificationUrl(e?.sourceUrl))
  );

  for (const ev of verifiedGrounded) {
    if (ev.category !== "deprem") continue;
    const mag = typeof ev.magnitude === "number" ? ev.magnitude : NaN;
    if (!Number.isFinite(mag) || mag <= 0 || mag >= 10) continue;
    const sameDay = formatShortTurkishDate(ev.publishedAt);
    const duplicate = quakes.some(
      (q) =>
        Math.abs(q.magnitude - mag) < 0.15 &&
        formatShortTurkishDate(q.occurredAt) === sameDay
    );
    if (!duplicate) {
      quakes.push({
        id: ev.id,
        magnitude: Math.round(mag * 10) / 10,
        location: ev.district || ev.title,
        depthKm: typeof ev.depthKm === "number" ? ev.depthKm : null,
        occurredAt: ev.publishedAt,
        sourceName: ev.sourceName || "AFAD/Kandilli",
        sourceUrl: ev.sourceUrl,
      });
    }
  }

  quakes.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const publicOrderEvents = verifiedGrounded
    .filter(
      (e) =>
        e.category === "asayis" ||
        e.category === "deniz_guvenligi" ||
        e.category === "trafik_kazasi" ||
        e.category === "yangin"
    )
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const fireEvents = publicOrderEvents.filter((e) => e.category === "yangin");
  const trafficAccidentEvents = publicOrderEvents.filter((e) => e.category === "trafik_kazasi");
  const fireRiskLevel: "YÜKSEK" | "ORTA" | "DÜŞÜK" =
    fireEvents.some((e) => e.severity === "kritik" || e.severity === "yuksek") ||
    fireEvents.length >= 2
      ? "YÜKSEK"
      : fireEvents.length === 1
      ? "ORTA"
      : "DÜŞÜK";

  const latestQuake = quakes[0] ?? null;
  const maxMagnitude =
    quakes.length > 0 ? Math.max(...quakes.map((q) => q.magnitude)) : null;

  const quakeRiskLevel: "YÜKSEK" | "ORTA" | "DÜŞÜK" =
    maxMagnitude !== null && maxMagnitude >= 4.0
      ? "YÜKSEK"
      : maxMagnitude !== null && maxMagnitude >= 2.5
      ? "ORTA"
      : "DÜŞÜK";

  const highSeverityIncidents = publicOrderEvents.filter(
    (e) => e.severity === "kritik" || e.severity === "yuksek" || e.category === "yangin"
  );
  const activeAlertCount =
    highSeverityIncidents.length + (maxMagnitude !== null && maxMagnitude >= 4.0 ? 1 : 0);

  const latestItems: Array<{ sourceName: string; isoDate: string }> = [];
  if (latestQuake) {
    latestItems.push({ sourceName: latestQuake.sourceName, isoDate: latestQuake.occurredAt });
  }
  if (publicOrderEvents[0]) {
    latestItems.push({
      sourceName: publicOrderEvents[0].sourceName,
      isoDate: publicOrderEvents[0].publishedAt,
    });
  }
  latestItems.sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
  const newest = latestItems[0] ?? null;

  const hasVerifiedLiveData = quakes.length > 0 || publicOrderEvents.length > 0;
  let overviewValue = "—";
  if (latestQuake) {
    overviewValue = `M${latestQuake.magnitude.toFixed(1)}`;
  } else if (publicOrderEvents.length > 0) {
    overviewValue = `${publicOrderEvents.length} gelişme`;
  }

  const latestSourceSummary = newest
    ? buildSourceAttribution(newest.sourceName, newest.isoDate)
    : "Canlı AFAD/Kandilli veya asayiş/yangın verisi yok · Tarama bekleniyor";

  return {
    quakes: quakes.slice(0, 6),
    latestQuake,
    maxMagnitude,
    quakeCount: quakes.length > 0 ? quakes.length : null,
    publicOrderEvents: publicOrderEvents.slice(0, 6),
    publicOrderCount: publicOrderEvents.length > 0 ? publicOrderEvents.length : null,
    fireEvents: fireEvents.slice(0, 4),
    trafficAccidentEvents: trafficAccidentEvents.slice(0, 4),
    fireRiskLevel,
    quakeRiskLevel,
    activeAlertCount,
    overviewValue,
    hasVerifiedLiveData,
    latestSourceSummary,
    latestMeasuredAt: newest?.isoDate ?? null,
  };
}

/**
 * 3. TURİZM: Muğla/Bodrum/Marmaris/Fethiye otel doluluk, turist sayısı ve Dalaman Havalimanı
 * yolcu verilerini yerel kaynaklardan günceller; eski sentetik sezonsal %41/%38 değerlerini canlı
 * ölçüm gibi göstermez.
 */
export function mergeTourismIntelligence(params: {
  tourismCache?: any;
  groundedTourism?: TourismTopicMetrics | null;
}): TourismIntelligenceSnapshot {
  const { tourismCache, groundedTourism } = params;

  const verifiedDistrictRates = (groundedTourism?.districtRates ?? []).filter(
    (r) =>
      Boolean(r?.district && isValidVerificationUrl(r?.sourceUrl)) &&
      Number.isFinite(r.occupancyPct) &&
      r.occupancyPct >= 0 &&
      r.occupancyPct <= 100
  );

  const verifiedHeadlines = (groundedTourism?.headlines ?? []).filter(
    (h) => Boolean(h?.title && isValidVerificationUrl(h?.sourceUrl))
  );

  const groundedHasUrl = isValidVerificationUrl(groundedTourism?.sourceUrl);
  let hotelOccupancyPct: number | null = null;
  let occSourceName: string | undefined;
  let occMeasuredAt: string | undefined;

  if (
    groundedHasUrl &&
    typeof groundedTourism?.hotelOccupancyPct === "number" &&
    Number.isFinite(groundedTourism.hotelOccupancyPct) &&
    groundedTourism.hotelOccupancyPct >= 0 &&
    groundedTourism.hotelOccupancyPct <= 100
  ) {
    hotelOccupancyPct = Math.round(groundedTourism.hotelOccupancyPct * 10) / 10;
    occSourceName = groundedTourism.sourceName || "TÜRSAB / Yerel Basın";
    occMeasuredAt = groundedTourism.measuredAt;
  } else if (verifiedDistrictRates.length > 0) {
    const avg =
      verifiedDistrictRates.reduce((acc, r) => acc + r.occupancyPct, 0) /
      verifiedDistrictRates.length;
    hotelOccupancyPct = Math.round(avg * 10) / 10;
    occSourceName = verifiedDistrictRates[0].sourceName;
    occMeasuredAt = verifiedDistrictRates[0].measuredAt;
  } else if (
    tourismCache &&
    tourismCache.hotel_occupancy_verified === true &&
    !isSyntheticSeasonalCache(tourismCache) &&
    isValidVerificationUrl(tourismCache.source_url) &&
    Number.isFinite(Number(tourismCache.hotel_occupancy))
  ) {
    hotelOccupancyPct = Math.round(Number(tourismCache.hotel_occupancy) * 10) / 10;
    occSourceName = String(tourismCache.source || "TÜRSAB").trim();
    occMeasuredAt = String(tourismCache.measured_at || tourismCache.updated_at || "");
  }

  const groundedAnnualTourists =
    groundedHasUrl &&
    typeof groundedTourism?.annualTourists === "string" &&
    groundedTourism.annualTourists.trim()
      ? groundedTourism.annualTourists.trim()
      : null;

  const groundedAirportPassengers =
    groundedHasUrl &&
    typeof groundedTourism?.airportPassengers === "string" &&
    groundedTourism.airportPassengers.trim()
      ? groundedTourism.airportPassengers.trim()
      : null;

  const cachePeriod =
    typeof tourismCache?.source_period === "string" && tourismCache.source_period.trim()
      ? tourismCache.source_period.trim()
      : null;

  const annualTourists =
    groundedAnnualTourists ??
    (cachePeriod && tourismCache?.annual_tourists ? String(tourismCache.annual_tourists) : null);

  const airportPassengers =
    groundedAirportPassengers ??
    (cachePeriod && tourismCache?.airport_passengers
      ? String(tourismCache.airport_passengers)
      : null);
  const cruiseShips =
    cachePeriod && Number.isFinite(Number(tourismCache?.cruise_ships))
      ? Number(tourismCache.cruise_ships)
      : null;
  const rawBeds = Number(tourismCache?.beds);
  const totalBedsK =
    cachePeriod && Number.isFinite(rawBeds) && rawBeds > 0
      ? rawBeds >= 1000
        ? `${Math.round(rawBeds / 1000)}K`
        : String(rawBeds)
      : null;

  const occupancySourceSummary =
    hotelOccupancyPct !== null
      ? buildSourceAttribution(occSourceName || "TÜRSAB / Yerel Basın", occMeasuredAt)
      : "Canlı otel doluluk verisi yok · TÜRSAB/BODER taraması bekleniyor";

  let movementSourceSummary = "Canlı turizm verisi yok · Kültür-Turizm/yerel kaynak bekleniyor";
  if (groundedAnnualTourists || groundedAirportPassengers) {
    movementSourceSummary = buildSourceAttribution(
      groundedTourism?.sourceName || "Kültür ve Turizm Bakanlığı / DHMİ",
      groundedTourism?.measuredAt
    );
  } else if (verifiedHeadlines[0]) {
    movementSourceSummary = buildSourceAttribution(
      verifiedHeadlines[0].sourceName,
      verifiedHeadlines[0].publishedAt
    );
  } else if (cachePeriod && (annualTourists || airportPassengers)) {
    movementSourceSummary = `Kaynak: Kültür ve Turizm Bakanlığı • ${cachePeriod}`;
  }

  return {
    hotelOccupancyPct,
    annualTourists,
    airportPassengers,
    cruiseShips,
    totalBedsK,
    districtRates: verifiedDistrictRates.slice(0, 4),
    headlines: verifiedHeadlines.slice(0, 4),
    hasVerifiedOccupancy: hotelOccupancyPct !== null,
    hasVerifiedLiveData:
      hotelOccupancyPct !== null ||
      annualTourists !== null ||
      airportPassengers !== null ||
      verifiedHeadlines.length > 0,
    occupancySourceSummary,
    movementSourceSummary,
    latestMeasuredAt: occMeasuredAt ?? groundedTourism?.measuredAt ?? null,
  };
}

export function canonicalizeBudgetInstitution(rawName: string): string {
  const low = normTr(rawName);
  if (low.includes("muski") || low.includes("muskİ")) return "MUSKİ";
  if (
    low.includes("büyükşehir") ||
    low.includes("buyuksehir") ||
    low === "mbb" ||
    low.includes("muğla bb")
  ) {
    return "Büyükşehir Belediyesi";
  }
  if (low.includes("valili")) return "Muğla Valiliği";
  const districts = [
    ["bodrum", "Bodrum Belediyesi"],
    ["fethiye", "Fethiye Belediyesi"],
    ["marmaris", "Marmaris Belediyesi"],
    ["milas", "Milas Belediyesi"],
    ["dalaman", "Dalaman Belediyesi"],
    ["datça", "Datça Belediyesi"],
    ["datca", "Datça Belediyesi"],
    ["ortaca", "Ortaca Belediyesi"],
    ["köyceğiz", "Köyceğiz Belediyesi"],
    ["koycegiz", "Köyceğiz Belediyesi"],
    ["yatağan", "Yatağan Belediyesi"],
    ["yatagan", "Yatağan Belediyesi"],
    ["ula", "Ula Belediyesi"],
    ["kavaklıdere", "Kavaklıdere Belediyesi"],
    ["kavaklidere", "Kavaklıdere Belediyesi"],
    ["seydikemer", "Seydikemer Belediyesi"],
    ["menteşe", "Menteşe Belediyesi"],
    ["mentese", "Menteşe Belediyesi"],
  ] as const;
  for (const [needle, canonical] of districts) {
    if (low.includes(needle)) return canonical;
  }
  return rawName.trim();
}

function parseBillionTryFromLabel(raw?: string): number | null {
  if (!raw || typeof raw !== "string") return null;
  const low = normTr(raw);
  const bnMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(?:milyar|bn|\bb\b)/);
  if (bnMatch?.[1]) {
    const val = Number(bnMatch[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0 && val < 500) return Math.round(val * 100) / 100;
  }
  const mnMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(?:milyon)/);
  if (mnMatch?.[1]) {
    const val = Number(mnMatch[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0 && val < 500000) return Math.round((val / 1000) * 100) / 100;
  }
  return null;
}

/**
 * 4. EKONOMİ: Muğla Büyükşehir, MUSKİ & ilçe belediyelerinin resmi meclis bütçe rakamları,
 * ihale/yatırım gelişmeleri ve TÜİK işgücü verilerini kaynak tarihiyle birleştirir.
 */
export function mergeEconomyIntelligence(params: {
  economyCache?: any;
  groundedEconomy?: EconomyTopicUpdates | null;
}): EconomyIntelligenceSnapshot {
  const { economyCache, groundedEconomy } = params;

  const verifiedItems = (groundedEconomy?.items ?? [])
    .filter((it) => Boolean(it?.title && isValidVerificationUrl(it?.sourceUrl)))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const groundedHasUrl = isValidVerificationUrl(groundedEconomy?.sourceUrl);

  // Yapılandırılmış belediye/MUSKİ bütçe kayıtlarını doğrula ve kurum bazında tekilleştir
  const budgetMap = new Map<string, MunicipalBudgetUpdate>();
  const registerBudget = (entry: MunicipalBudgetUpdate) => {
    if (
      !entry?.institution ||
      !Number.isFinite(entry.amountBillionTry) ||
      entry.amountBillionTry <= 0 ||
      entry.amountBillionTry > 500 ||
      !isValidVerificationUrl(entry.sourceUrl)
    ) {
      return;
    }
    const canonical = canonicalizeBudgetInstitution(entry.institution);
    const normalized: MunicipalBudgetUpdate = {
      ...entry,
      institution: canonical,
      amountBillionTry: Math.round(entry.amountBillionTry * 100) / 100,
    };
    const existing = budgetMap.get(canonical);
    if (
      !existing ||
      new Date(normalized.publishedAt).getTime() >= new Date(existing.publishedAt).getTime()
    ) {
      budgetMap.set(canonical, normalized);
    }
  };

  for (const b of groundedEconomy?.municipalBudgets ?? []) {
    registerBudget(b);
  }

  // Yapılandırılmış municipalBudgets boşsa, `butce` kategorili doğrulanmış item'lardan tutar çıkar
  if (budgetMap.size === 0) {
    for (const item of verifiedItems) {
      if (item.category !== "butce") continue;
      const amountBn =
        parseBillionTryFromLabel(item.amountLabel) ?? parseBillionTryFromLabel(item.title);
      if (amountBn === null) continue;
      const yearMatch = `${item.title}`.match(/\b(202[5-9]|203\d)\b/);
      registerBudget({
        institution: item.institution,
        amountBillionTry: amountBn,
        year: yearMatch ? Number(yearMatch[1]) : null,
        yoyChangePct: null,
        investmentBillionTry: null,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt,
      });
    }
  }

  const municipalBudgets = Array.from(budgetMap.values()).sort(
    (a, b) => b.amountBillionTry - a.amountBillionTry
  );

  const mbbBudget = budgetMap.get("Büyükşehir Belediyesi") ?? null;
  const muskiBudget = budgetMap.get("MUSKİ") ?? null;
  const rawCombined =
    groundedEconomy?.combinedTotalBillionTry !== null &&
    groundedEconomy?.combinedTotalBillionTry !== undefined
      ? Number(groundedEconomy.combinedTotalBillionTry)
      : NaN;
  const combinedTotalBillionTry =
    (groundedHasUrl || municipalBudgets.length > 0) &&
    Number.isFinite(rawCombined) &&
    rawCombined > 0 &&
    rawCombined < 500
      ? Math.round(rawCombined * 100) / 100
      : mbbBudget && muskiBudget
      ? Math.round((mbbBudget.amountBillionTry + muskiBudget.amountBillionTry) * 100) / 100
      : null;

  const maxAllowedYear = new Date().getFullYear() + 5;
  const budgetYear =
    typeof groundedEconomy?.budgetYear === "number" &&
    groundedEconomy.budgetYear >= 2020 &&
    groundedEconomy.budgetYear <= maxAllowedYear
      ? groundedEconomy.budgetYear
      : municipalBudgets.find((b) => typeof b.year === "number" && b.year !== null)?.year ?? null;

  const rawBudgetYoy =
    groundedEconomy?.budgetYoyChangePct !== null &&
    groundedEconomy?.budgetYoyChangePct !== undefined
      ? Number(groundedEconomy.budgetYoyChangePct)
      : NaN;
  const budgetYoyChangePct =
    Number.isFinite(rawBudgetYoy) && rawBudgetYoy > -100 && rawBudgetYoy < 500
      ? Math.round(rawBudgetYoy * 100) / 100
      : municipalBudgets.find(
          (b) => typeof b.yoyChangePct === "number" && Number.isFinite(b.yoyChangePct)
        )?.yoyChangePct ?? null;

  const hasVerifiedBudgetUpdate =
    municipalBudgets.length > 0 || combinedTotalBillionTry !== null;

  const groundedUnemp =
    groundedHasUrl &&
    typeof groundedEconomy?.unemploymentRate === "number" &&
    Number.isFinite(groundedEconomy.unemploymentRate) &&
    groundedEconomy.unemploymentRate > 0 &&
    groundedEconomy.unemploymentRate < 60
      ? Math.round(groundedEconomy.unemploymentRate * 10) / 10
      : null;

  const cachePeriod =
    typeof economyCache?.source_period === "string" && economyCache.source_period.trim()
      ? economyCache.source_period.trim()
      : null;
  const cacheUnempRaw = Number(economyCache?.unemployment_rate);
  const cacheUnemp =
    cachePeriod && Number.isFinite(cacheUnempRaw) && cacheUnempRaw > 0 && cacheUnempRaw < 60
      ? Math.round(cacheUnempRaw * 10) / 10
      : null;

  const unemploymentRate = groundedUnemp ?? cacheUnemp;
  const unemploymentPeriod =
    groundedUnemp !== null
      ? groundedEconomy?.unemploymentPeriod || "TÜİK"
      : cacheUnemp !== null
      ? cachePeriod
      : null;

  const tourismRevenueBn =
    economyCache?.tourism_revenue_usd_m && economyCache?.usd_try
      ? ((Number(economyCache.tourism_revenue_usd_m) * Number(economyCache.usd_try)) / 1000).toFixed(1)
      : null;

  const rawCompanies = Number(economyCache?.new_companies);
  const newCompanies =
    cachePeriod && Number.isFinite(rawCompanies) && rawCompanies > 0
      ? Math.round(rawCompanies)
      : null;

  const newestBudget = [...municipalBudgets].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )[0] ?? null;
  const latestItem = verifiedItems[0] ?? null;

  const budgetSourceSummary = newestBudget
    ? buildSourceAttribution(newestBudget.sourceName, newestBudget.publishedAt)
    : combinedTotalBillionTry !== null && groundedHasUrl
    ? buildSourceAttribution(
        groundedEconomy?.sourceName || "Muğla Büyükşehir / MUSKİ",
        groundedEconomy?.measuredAt
      )
    : "2024 resmi meclis bütçe referansı · Güncel meclis kararı bekleniyor";

  const latestMeasuredAt =
    newestBudget?.publishedAt ??
    latestItem?.publishedAt ??
    (groundedHasUrl ? groundedEconomy?.measuredAt ?? null : null);

  let latestSourceSummary = "Canlı bütçe/ihale ve TÜİK verisi yok · Tarama bekleniyor";
  if (newestBudget) {
    latestSourceSummary = buildSourceAttribution(newestBudget.sourceName, newestBudget.publishedAt);
  } else if (latestItem) {
    latestSourceSummary = buildSourceAttribution(latestItem.sourceName, latestItem.publishedAt);
  } else if (combinedTotalBillionTry !== null && groundedHasUrl) {
    latestSourceSummary = buildSourceAttribution(
      groundedEconomy?.sourceName || "Muğla Büyükşehir / MUSKİ",
      groundedEconomy?.measuredAt
    );
  } else if (groundedUnemp !== null) {
    latestSourceSummary = buildSourceAttribution(
      groundedEconomy?.unemploymentSource || groundedEconomy?.sourceName || "TÜİK",
      groundedEconomy?.measuredAt
    );
  } else if (cachePeriod && (cacheUnemp !== null || tourismRevenueBn !== null)) {
    latestSourceSummary = `Kaynak: TÜİK / TCMB • ${cachePeriod}`;
  }

  return {
    unemploymentRate,
    unemploymentPeriod,
    tourismRevenueBn,
    newCompanies,
    budgetItems: verifiedItems.slice(0, 5),
    municipalBudgets,
    combinedTotalBillionTry,
    budgetYear,
    budgetYoyChangePct,
    budgetSourceSummary,
    hasVerifiedBudgetUpdate,
    hasVerifiedLiveData:
      unemploymentRate !== null ||
      tourismRevenueBn !== null ||
      newCompanies !== null ||
      verifiedItems.length > 0 ||
      hasVerifiedBudgetUpdate,
    latestSourceSummary,
    latestMeasuredAt,
  };
}

const HONORIFIC_TOKENS = new Set([
  "dr",
  "prof",
  "doç",
  "doc",
  "av",
  "sayın",
  "sayin",
  "sn",
  "tuğg",
  "tugg",
  "tümg",
  "tumg",
  "alb",
  "yarb",
  "başkan",
  "baskan",
  "vali",
  "kaymakam",
  "müdür",
  "mudur",
]);

const MUGLA_DISTRICTS_NORM = [
  "bodrum",
  "marmaris",
  "fethiye",
  "milas",
  "menteşe",
  "datça",
  "dalaman",
  "ortaca",
  "köyceğiz",
  "yatağan",
  "ula",
  "seydikemer",
  "kavaklıdere",
];

function tokenizePersonName(raw: string): string[] {
  return normTr(raw)
    .replace(/[.,()'"/:;-]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !HONORIFIC_TOKENS.has(tok));
}

export function getProtocolMemberKey(member: Pick<ProtocolMemberLike, "isim" | "unvan">): string {
  return `${member.isim}::${member.unvan}`;
}

/**
 * 5. MUĞLA PROTOKOL: Son 24 saatteki doğrulanmış resmi ziyaret, açıklama veya görev
 * değişikliklerini 462 kişilik protokol listesiyle deterministik olarak eşleştirir.
 */
export function matchProtocolActivitiesToMembers(
  members: ProtocolMemberLike[],
  activities: ProtocolTopicActivity[]
): ProtocolActivitySnapshot {
  const byMemberKey = new Map<string, ProtocolTopicActivity[]>();
  const verified = (activities ?? [])
    .filter(
      (a) =>
        Boolean((a?.actorName || a?.actorTitle) && a?.summary && isValidVerificationUrl(a?.sourceUrl))
    )
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const addMatch = (member: ProtocolMemberLike, act: ProtocolTopicActivity) => {
    const key = getProtocolMemberKey(member);
    const list = byMemberKey.get(key) ?? [];
    if (!list.some((x) => x.summary === act.summary && x.sourceUrl === act.sourceUrl)) {
      list.push(act);
      byMemberKey.set(key, list);
    }
  };

  for (const act of verified) {
    const actorTokens = tokenizePersonName(act.actorName || "");
    let matchedAny = false;

    // 1. Öncelik: Tam isim eşleşmesi (en az 2 ortak ad/soyad tokeni + soyad uyumu)
    if (actorTokens.length >= 2) {
      const surname = actorTokens[actorTokens.length - 1];
      for (const m of members) {
        const mTokens = tokenizePersonName(m.isim);
        if (mTokens.length < 2) continue;
        const overlap = actorTokens.filter((t) => mTokens.includes(t));
        if (overlap.length >= 2 && mTokens.includes(surname)) {
          addMatch(m, act);
          matchedAny = true;
        }
      }
    }

    // 2. Öncelik: Makam / unvan eşleşmesi (isim haberde geçmediyse veya farklı yazıldıysa)
    if (!matchedAny && act.actorTitle) {
      const titleLow = normTr(act.actorTitle);
      const actDistrict = MUGLA_DISTRICTS_NORM.find((d) => titleLow.includes(d));

      for (const m of members) {
        const uLow = normTr(m.unvan);
        if (
          titleLow.includes("vali") &&
          !titleLow.includes("yardımcı") &&
          (uLow === "vali" || uLow === "muğla valisi")
        ) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (
          titleLow.includes("büyükşehir belediye başkanı") &&
          uLow.includes("büyükşehir belediye başkanı") &&
          !uLow.includes("vekil")
        ) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (
          actDistrict &&
          titleLow.includes("kaymakam") &&
          uLow.includes(actDistrict) &&
          uLow.includes("kaymakam")
        ) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (
          actDistrict &&
          titleLow.includes("belediye başkanı") &&
          uLow.includes(actDistrict) &&
          uLow.includes("belediye başkanı")
        ) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (
          titleLow.includes("cumhuriyet başsavcısı") &&
          uLow.includes("cumhuriyet başsavcısı") &&
          (!actDistrict || uLow.includes(actDistrict))
        ) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (
          titleLow.includes("rektör") &&
          !titleLow.includes("yardımcı") &&
          uLow.includes("rektör") &&
          !uLow.includes("yardımcı")
        ) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (titleLow.includes("il emniyet müdürü") && uLow.includes("il emniyet müdürü")) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
        if (titleLow.includes("il jandarma komutanı") && uLow.includes("il jandarma komutanı")) {
          addMatch(m, act);
          matchedAny = true;
          break;
        }
      }
    }
  }

  const latest = verified[0] ?? null;
  const latestSourceSummary = latest
    ? buildSourceAttribution(latest.sourceName, latest.publishedAt)
    : "Son 24 saatte doğrulanmış protokol gelişmesi yok · Tarama bekleniyor";

  return {
    byMemberKey,
    activities: verified,
    matchedMemberCount: byMemberKey.size,
    hasVerifiedLiveData: verified.length > 0,
    latestSourceSummary,
    latestMeasuredAt: latest?.publishedAt ?? null,
  };
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

  useEffect(() => {
    const existing = useMonitorStore.getState().dams;
    // Wait until initial queries settle before overwriting a verified store snapshot
    if (!snapshot.hasVerifiedLiveData && (cacheLoading || topicLoading) && existing.hasVerifiedLiveData) {
      return;
    }
    useMonitorStore.getState().setDamsSnapshot({
      records: snapshot.dams,
      avgOccupancy: snapshot.avgOccupancy,
      verifiedCount: snapshot.verifiedCount,
      hasVerifiedLiveData: snapshot.hasVerifiedLiveData,
      latestSourceSummary: snapshot.latestSourceSummary,
      latestMeasuredAt: snapshot.latestMeasuredAt,
      updatedAt: topicData?.fetchedAt ?? snapshot.latestMeasuredAt ?? existing.updatedAt,
    });
  }, [snapshot, topicData?.fetchedAt, cacheLoading, topicLoading]);

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

  useEffect(() => {
    const incidents = data?.transportIncidents ?? [];
    if (incidents.length === 0) return;
    useMonitorStore
      .getState()
      .setTransportOverride(incidents, data?.fetchedAt ?? new Date().toISOString());
  }, [data?.transportIncidents, data?.fetchedAt]);

  return {
    incidents: data?.transportIncidents ?? [],
    fetchedAt: data?.fetchedAt ?? null,
    isLoading,
  };
}

/**
 * Enerji sekmesi: ADM Elektrik Muğla güncel planlı/arızalı kesinti duyuruları + canlı tüketim.
 */
export function useEnergyIntelligence(arbitratedAlertsCount = 0, arbitratedDistricts: string[] = []) {
  const { data: energyCache, isLoading: cacheLoading } = useLiveData<any>("energy", {
    refetchInterval: 30 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "energy_outages"],
    queryFn: () => fetchTopicGrounding("energy_outages"),
    staleTime: 20 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });

  const snapshot = useMemo(
    () =>
      mergeEnergyIntelligence({
        energyCache,
        groundedOutages: topicData?.energyOutages ?? [],
        arbitratedAlertsCount,
        arbitratedDistricts,
      }),
    [energyCache, topicData?.energyOutages, arbitratedAlertsCount, arbitratedDistricts]
  );

  useEffect(() => {
    if (!snapshot.hasVerifiedLiveData) return;
    useMonitorStore
      .getState()
      .setEnergyOverride(snapshot, topicData?.fetchedAt ?? snapshot.latestMeasuredAt);
  }, [snapshot, topicData?.fetchedAt]);

  return {
    ...snapshot,
    isLoading: cacheLoading || topicLoading,
  };
}

/**
 * Güvenlik sekmesi & Genel Bakış: AFAD/Kandilli Muğla depremleri + asayiş / deniz güvenliği.
 */
export function useSecurityIntelligence() {
  const { data: earthquakeCache, isLoading: cacheLoading } = useLiveData<any>("earthquakes", {
    refetchInterval: 10 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "security_quakes"],
    queryFn: () => fetchTopicGrounding("security_quakes"),
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });

  const snapshot = useMemo(
    () =>
      mergeSecurityIntelligence({
        earthquakeCache,
        groundedEvents: topicData?.securityEvents ?? [],
      }),
    [earthquakeCache, topicData?.securityEvents]
  );

  useEffect(() => {
    if (snapshot.quakes.length > 0) {
      useMonitorStore.getState().setEarthquakes(
        snapshot.quakes.map((q) => ({
          id: q.id,
          magnitude: q.magnitude,
          location: q.location,
          depthKm: q.depthKm,
          occurredAt: q.occurredAt,
          url: q.sourceUrl,
          sourceName: q.sourceName,
        })),
        topicData?.fetchedAt ?? snapshot.latestMeasuredAt ?? new Date().toISOString()
      );
    }
    if (snapshot.hasVerifiedLiveData) {
      useMonitorStore
        .getState()
        .setSecurityOverride(snapshot, topicData?.fetchedAt ?? snapshot.latestMeasuredAt);
    }
  }, [snapshot, topicData?.fetchedAt]);

  return {
    ...snapshot,
    isLoading: cacheLoading || topicLoading,
  };
}

/**
 * Turizm sekmesi & Genel Bakış: Muğla/Bodrum/Marmaris/Fethiye güncel otel doluluk ve turist verileri.
 */
export function useTourismIntelligence() {
  const { data: tourismCache, isLoading: cacheLoading } = useLiveData<any>("tourism", {
    refetchInterval: 60 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "tourism_occupancy"],
    queryFn: () => fetchTopicGrounding("tourism_occupancy"),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: false,
  });

  const snapshot = useMemo(
    () =>
      mergeTourismIntelligence({
        tourismCache,
        groundedTourism: topicData?.tourismMetrics ?? null,
      }),
    [tourismCache, topicData?.tourismMetrics]
  );

  useEffect(() => {
    if (!snapshot.hasVerifiedLiveData) return;
    useMonitorStore
      .getState()
      .setTourismOverride(snapshot, topicData?.fetchedAt ?? snapshot.latestMeasuredAt);
  }, [snapshot, topicData?.fetchedAt]);

  return {
    ...snapshot,
    isLoading: cacheLoading || topicLoading,
  };
}

/**
 * Ekonomi sekmesi & Genel Bakış: Muğla Büyükşehir & ilçe belediyesi bütçe/ihale/yatırım + TÜİK işgücü.
 */
export function useEconomyIntelligence() {
  const { data: economyCache, isLoading: cacheLoading } = useLiveData<any>("economy", {
    refetchInterval: 30 * 60 * 1000,
  });

  const { data: topicData, isLoading: topicLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "economy_budget"],
    queryFn: () => fetchTopicGrounding("economy_budget"),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: false,
  });

  const snapshot = useMemo(
    () =>
      mergeEconomyIntelligence({
        economyCache,
        groundedEconomy: topicData?.economyUpdates ?? null,
      }),
    [economyCache, topicData?.economyUpdates]
  );

  useEffect(() => {
    if (!snapshot.hasVerifiedLiveData) return;
    useMonitorStore
      .getState()
      .setEconomyOverride(snapshot, topicData?.fetchedAt ?? snapshot.latestMeasuredAt);
  }, [snapshot, topicData?.fetchedAt]);

  return {
    ...snapshot,
    isLoading: cacheLoading || topicLoading,
  };
}

/**
 * Muğla Protokol sekmesi: 462 kişilik liste ile son 24 saatteki resmi ziyaret/açıklama/görev değişikliği eşleşmesi.
 */
export function useProtocolActivityIntelligence(members: ProtocolMemberLike[]) {
  const { data: topicData, isLoading } = useQuery<TopicGroundingPayload>({
    queryKey: ["topic-grounding", "protocol_activity"],
    queryFn: () => fetchTopicGrounding("protocol_activity"),
    staleTime: 20 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });

  const snapshot = useMemo(
    () => matchProtocolActivitiesToMembers(members, topicData?.protocolActivities ?? []),
    [members, topicData?.protocolActivities]
  );

  useEffect(() => {
    if (snapshot.activities.length === 0) return;
    useMonitorStore
      .getState()
      .setProtocolActivitiesOverride(
        snapshot.activities,
        topicData?.fetchedAt ?? snapshot.latestMeasuredAt
      );
  }, [snapshot.activities, snapshot.latestMeasuredAt, topicData?.fetchedAt]);

  return {
    ...snapshot,
    isLoading,
  };
}
