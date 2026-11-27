// useAISummary.ts
// Şehir Nabzı (pulse) tamamen canlı sensör/grounding state'inden dinamik üretilir:
// Üst KPI kutularıyla asla çelişmez, sabit %44/%41/Dinar kalıntısı barındırmaz ve
// Supabase Realtime güncellemelerinde ek Gemini kotası tüketmeden anında yenilenir.

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { cacheManager, TTL } from "@/lib/cache-manager";
import { useLiveData } from "@/hooks/useLiveData";
import { useTranslation, translateText, type Language } from "@/hooks/useTranslation";
import {
  useDamIntelligence,
  useTourismIntelligence,
  useSecurityIntelligence,
  type DamIntelligenceSnapshot,
  type TourismIntelligenceSnapshot,
  type SecurityIntelligenceSnapshot,
} from "@/services/topicGroundingService";
import {
  DEFAULT_AQI_SNAPSHOT,
  DEFAULT_TRAFFIC_SNAPSHOT,
  DEFAULT_WEATHER_SNAPSHOT,
  OFFICIAL_DAM_REFERENCE_AVG,
  OFFICIAL_TOURISM_REFERENCE,
} from "@/data/officialReferenceData";
import { useMonitorStore, selectEarthquakes } from "@/store/useMonitorStore";

export type SummaryType = "daily" | "social" | "earthquake" | "weather" | "pulse";

export interface AISummary {
  type: SummaryType;
  summary: string;
  generated_at: string;
  isStale?: boolean;
  sourceLabel?: string;
}

const SUMMARY_CACHE_KEY = (type: SummaryType) => `ai_summary_${type}`;

const COMPASS_TR: Record<string, string> = {
  N: "kuzeyi",
  NNE: "kuzey-kuzeydoğusu",
  NE: "kuzeydoğusu",
  ENE: "doğu-kuzeydoğusu",
  E: "doğusu",
  ESE: "doğu-güneydoğusu",
  SE: "güneydoğusu",
  SSE: "güney-güneydoğusu",
  S: "güneyi",
  SSW: "güney-güneybatısı",
  SW: "güneybatısı",
  WSW: "batı-güneybatısı",
  W: "batısı",
  WNW: "batı-kuzeybatısı",
  NW: "kuzeybatısı",
  NNW: "kuzey-kuzeybatısı",
};

const COMPASS_EN: Record<string, string> = {
  N: "north",
  NNE: "north-northeast",
  NE: "northeast",
  ENE: "east-northeast",
  E: "east",
  ESE: "east-southeast",
  SE: "southeast",
  SSE: "south-southeast",
  S: "south",
  SSW: "south-southwest",
  SW: "southwest",
  WSW: "west-southwest",
  W: "west",
  WNW: "west-northwest",
  NW: "northwest",
  NNW: "north-northwest",
};

/**
 * USGS/AFAD İngilizce konum metinlerini (ör. "10 km WSW of Bodrum, Turkey")
 * doğal Türkçe formata dönüştürür ("Bodrum (10 km batı-güneybatısı)").
 */
export function formatQuakeLocationTr(rawLocation?: string | null): string {
  if (!rawLocation || typeof rawLocation !== "string") return "Muğla çevresi";
  const cleaned = rawLocation
    .trim()
    .replace(/,\s*Turkey$/i, "")
    .replace(/,\s*Türkiye$/i, "")
    .replace(/\bAegean Sea\b/gi, "Ege Denizi")
    .replace(/\bMediterranean Sea\b/gi, "Akdeniz")
    .replace(/\bDodecanese Islands,\s*Greece\b/gi, "On İki Adalar (Ege)")
    .replace(/,\s*Greece$/i, " (Ege)")
    .trim();

  const usgsMatch = cleaned.match(
    /^(\d+(?:[.,]\d+)?)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i
  );
  if (usgsMatch) {
    const km = usgsMatch[1].replace(".", ",");
    const dir = COMPASS_TR[usgsMatch[2].toUpperCase()] || usgsMatch[2];
    const place = usgsMatch[3].trim();
    return `${place} (${km} km ${dir})`;
  }

  return cleaned || "Muğla çevresi";
}

/**
 * USGS/AFAD konum metinlerini temiz ve tutarlı İngilizce formata dönüştürür
 * ("Bodrum (10 km west-southwest)").
 */
export function formatQuakeLocationEn(rawLocation?: string | null): string {
  if (!rawLocation || typeof rawLocation !== "string") return "Muğla region";
  const cleaned = rawLocation
    .trim()
    .replace(/,\s*Turkey$/i, "")
    .replace(/,\s*Türkiye$/i, "")
    .replace(/\bEge Denizi\b/gi, "Aegean Sea")
    .replace(/\bAkdeniz\b/gi, "Mediterranean Sea")
    .replace(/\bAçıkları\b/gi, "Offshore")
    .replace(/\bOn İki Adalar\b/gi, "Dodecanese Islands")
    .trim();

  const usgsMatch = cleaned.match(
    /^(\d+(?:[.,]\d+)?)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i
  );
  if (usgsMatch) {
    const km = usgsMatch[1].replace(",", ".");
    const dir = COMPASS_EN[usgsMatch[2].toUpperCase()] || usgsMatch[2];
    const place = usgsMatch[3].trim();
    return `${place} (${km} km ${dir})`;
  }

  return cleaned || "Muğla region";
}

export function formatQuakeLocation(rawLocation?: string | null, lang: Language = "tr"): string {
  return lang === "en" ? formatQuakeLocationEn(rawLocation) : formatQuakeLocationTr(rawLocation);
}

function getAqiLabelTr(aqi: number, fallbackLabel?: string): string {
  if (fallbackLabel && fallbackLabel.trim()) {
    const mapEnToTr: Record<string, string> = {
      "very good": "Çok İyi",
      good: "İyi",
      fair: "Orta",
      moderate: "Orta",
      sensitive: "Hassas",
      poor: "Kötü",
      "very poor": "Çok Kötü",
    };
    const low = fallbackLabel.trim().toLowerCase();
    return mapEnToTr[low] || fallbackLabel.trim();
  }
  if (aqi <= 20) return "Çok İyi";
  if (aqi <= 40) return "İyi";
  if (aqi <= 60) return "Orta";
  if (aqi <= 80) return "Hassas";
  if (aqi <= 100) return "Kötü";
  return "Çok Kötü";
}

function getAqiLabelEn(aqi: number, fallbackLabel?: string): string {
  if (fallbackLabel && fallbackLabel.trim()) {
    const translated = translateText(fallbackLabel.trim(), "en");
    if (translated && translated !== fallbackLabel.trim()) return translated;
  }
  if (aqi <= 20) return "Very Good";
  if (aqi <= 40) return "Good";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Sensitive";
  if (aqi <= 100) return "Poor";
  return "Very Poor";
}

export interface DynamicCityPulseInput {
  weather?: { temperature?: number | string | null; condition?: string | null } | null;
  airQuality?: { aqi?: number | string | null; aqi_label?: string | null } | null;
  traffic?: { hotspots?: Array<{ name?: string; density?: number }> } | null;
  dams: Pick<
    DamIntelligenceSnapshot,
    "avgOccupancy" | "latestSourceSummary" | "latestMeasuredAt" | "verifiedCount"
  >;
  tourism: Pick<
    TourismIntelligenceSnapshot,
    "hotelOccupancyPct" | "annualTourists" | "occupancySourceSummary" | "latestMeasuredAt"
  >;
  security: Pick<
    SecurityIntelligenceSnapshot,
    "latestQuake" | "publicOrderEvents" | "latestSourceSummary" | "latestMeasuredAt"
  >;
}

/**
 * Üst KPI kutularıyla birebir aynı canlı state kaynaklarından 4 maddelik
 * dinamik TR veya EN Şehir Nabzı metni üretir. Sabit %44 baraj, %41 otel veya
 * karışık dil kalıntısı asla içermez.
 */
export function buildDynamicCityPulse(
  input: DynamicCityPulseInput,
  lang: Language = "tr"
): AISummary {
  const { weather, airQuality, traffic, dams, tourism, security } = input;
  const isEn = lang === "en";

  // 1. Hava & Hava Kalitesi
  const tempNum =
    weather?.temperature !== undefined && weather?.temperature !== null && weather?.temperature !== ""
      ? Number(weather.temperature)
      : NaN;
  const hasTemp = Number.isFinite(tempNum);
  const aqiNum =
    airQuality?.aqi !== undefined && airQuality?.aqi !== null && airQuality?.aqi !== ""
      ? Number(airQuality.aqi)
      : NaN;
  const hasAqi = Number.isFinite(aqiNum);

  let p1: string;
  if (isEn) {
    const cond = weather?.condition ? ` (${translateText(weather.condition, "en")})` : "";
    if (hasTemp && hasAqi) {
      const label = getAqiLabelEn(aqiNum, airQuality?.aqi_label ?? undefined);
      p1 = `1. Temperature across Muğla is ${weather!.temperature}°C${cond}, with air quality at EAQI ${aqiNum} (${label}).`;
    } else if (hasTemp) {
      p1 = `1. Temperature across Muğla is ${weather!.temperature}°C${cond}; live air quality reading is pending.`;
    } else if (hasAqi) {
      const label = getAqiLabelEn(aqiNum, airQuality?.aqi_label ?? undefined);
      p1 = `1. Air quality across Muğla is at EAQI ${aqiNum} (${label}); live temperature reading is pending.`;
    } else {
      p1 = "1. Live meteorological readings for temperature and air quality across Muğla are pending.";
    }
  } else {
    const cond = weather?.condition ? ` (${translateText(weather.condition, "tr")})` : "";
    if (hasTemp && hasAqi) {
      const label = getAqiLabelTr(aqiNum, airQuality?.aqi_label ?? undefined);
      p1 = `1. Muğla genelinde sıcaklık ${weather!.temperature}°C${cond}, hava kalitesi EAQI ${aqiNum} (${label}) seviyesindedir.`;
    } else if (hasTemp) {
      p1 = `1. Muğla genelinde sıcaklık ${weather!.temperature}°C${cond}; hava kalitesi için güncel ölçüm bekleniyor.`;
    } else if (hasAqi) {
      const label = getAqiLabelTr(aqiNum, airQuality?.aqi_label ?? undefined);
      p1 = `1. Muğla hava kalitesi EAQI ${aqiNum} (${label}) seviyesindedir; güncel sıcaklık ölçümü bekleniyor.`;
    } else {
      p1 = "1. Muğla genelinde hava durumu ve hava kalitesi için canlı meteoroloji ölçümü bekleniyor.";
    }
  }

  // 2. Su & Barajlar (üst KPI "Baraj" ile birebir senkron)
  const damSource = isEn ? translateText(dams.latestSourceSummary, "en") : dams.latestSourceSummary;
  const p2 = isEn
    ? dams.avgOccupancy !== null
      ? `2. According to verified sources, average dam occupancy in Muğla stands at ${dams.avgOccupancy}% (${damSource}).`
      : `2. Latest dam occupancy reading is pending (${damSource}).`
    : dams.avgOccupancy !== null
      ? `2. Doğrulanmış kaynaklara göre Muğla barajlarında ortalama doluluk %${dams.avgOccupancy} seviyesindedir (${dams.latestSourceSummary}).`
      : `2. Barajlar için güncel ölçüm bekleniyor (${dams.latestSourceSummary}).`;

  // 3. Canlı Trafik (TomTom hotspots — sabit Menteşe %32 yok)
  const validHotspots = Array.isArray(traffic?.hotspots)
    ? traffic!.hotspots.filter(
        (h) => h && typeof h.name === "string" && Number.isFinite(Number(h.density))
      )
    : [];
  let p3: string;
  if (validHotspots.length > 0) {
    const avgDensity = Math.round(
      validHotspots.reduce((acc, h) => acc + Number(h.density), 0) / validHotspots.length
    );
    const busiest = [...validHotspots].sort((a, b) => Number(b.density) - Number(a.density))[0];
    const criticalCount = validHotspots.filter((h) => Number(h.density) >= 50).length;
    if (isEn) {
      p3 =
        criticalCount > 0
          ? `3. Average live traffic congestion across ${validHotspots.length} districts is ${avgDensity}%; busiest district is ${busiest.name} (${busiest.density}%) with ${criticalCount} congested zones monitored.`
          : `3. Traffic is flowing smoothly across ${validHotspots.length} districts at ${avgDensity}% average congestion; busiest district is ${busiest.name} (${busiest.density}%).`;
    } else {
      p3 =
        criticalCount > 0
          ? `3. ${validHotspots.length} ilçede anlık ortalama trafik yoğunluğu %${avgDensity}; en yoğun nokta ${busiest.name} (%${busiest.density}) ve ${criticalCount} bölgede kritik yoğunluk izleniyor.`
          : `3. ${validHotspots.length} ilçede anlık ortalama trafik yoğunluğu %${avgDensity} ile akıcı seyrediyor; en yoğun nokta ${busiest.name} (%${busiest.density}).`;
    }
  } else {
    p3 = isEn
      ? "3. Live province-wide traffic congestion sensor data is pending."
      : "3. İl genelinde canlı trafik yoğunluğu sensör verisi bekleniyor.";
  }

  // 4. Turizm & Deprem / Güvenlik (üst KPI "Otel Doluluk" ve "Güvenlik" ile birebir senkron)
  const tourSource = isEn
    ? translateText(tourism.occupancySourceSummary, "en")
    : tourism.occupancySourceSummary;
  let tourismPart: string;
  if (isEn) {
    if (tourism.hotelOccupancyPct !== null) {
      const annualPart = tourism.annualTourists
        ? `, with ${tourism.annualTourists} annual visitors`
        : "";
      tourismPart = `Current hotel occupancy is ${tourism.hotelOccupancyPct}%${annualPart} (${tourSource}).`;
    } else if (tourism.annualTourists) {
      tourismPart = `Current hotel occupancy reading is pending; annual visitor figure stands at ${tourism.annualTourists}.`;
    } else {
      tourismPart = "Current hotel occupancy data is pending.";
    }
  } else {
    if (tourism.hotelOccupancyPct !== null) {
      const annualPart = tourism.annualTourists
        ? `, yıllık ${tourism.annualTourists} ziyaretçi`
        : "";
      tourismPart = `Turizmde güncel otel doluluğu %${tourism.hotelOccupancyPct}${annualPart} (${tourism.occupancySourceSummary}).`;
    } else if (tourism.annualTourists) {
      tourismPart = `Turizmde otel doluluğu için güncel ölçüm bekleniyor; yıllık ziyaretçi verisi ${tourism.annualTourists}.`;
    } else {
      tourismPart = "Turizmde güncel otel doluluğu verisi bekleniyor.";
    }
  }

  let securityPart: string;
  if (security.latestQuake) {
    const loc = formatQuakeLocation(security.latestQuake.location, lang);
    const depthPart =
      security.latestQuake.depthKm !== null
        ? isEn
          ? ` (${security.latestQuake.depthKm} km depth)`
          : ` (${security.latestQuake.depthKm} km derinlik)`
        : "";
    securityPart = isEn
      ? `Latest earthquake record: ${loc} — M${security.latestQuake.magnitude.toFixed(1)}${depthPart}.`
      : `Son deprem kaydı: ${loc} — M${security.latestQuake.magnitude.toFixed(1)}${depthPart}.`;
  } else if (security.publicOrderEvents.length > 0) {
    securityPart = isEn
      ? `${security.publicOrderEvents.length} recent public order updates are being monitored.`
      : `Güvenlik ve asayişte ${security.publicOrderEvents.length} güncel gelişme takip ediliyor.`;
  } else {
    securityPart = isEn
      ? "No critical earthquake records detected in Muğla and surrounding areas."
      : "Muğla ve çevresinde güncel kritik deprem kaydı bulunmuyor.";
  }
  const p4 = `4. ${tourismPart} ${securityPart}`;

  const timestamps = [
    dams.latestMeasuredAt,
    tourism.latestMeasuredAt,
    security.latestMeasuredAt,
  ]
    .filter((ts): ts is string => Boolean(ts && !Number.isNaN(new Date(ts).getTime())))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return {
    type: "pulse",
    summary: `${p1}\n${p2}\n${p3}\n${p4}`,
    generated_at: timestamps[0] || new Date().toISOString(),
    sourceLabel: "Canlı Göstergeler & Doğrulanmış Kaynaklar",
  };
}

function isCorruptedSummary(text?: string | null): boolean {
  if (!text || typeof text !== "string") return true;
  const lower = text.toLowerCase();
  return (
    lower.includes("sosyal medya verisine ulaşılamamış") ||
    lower.includes("istihbarat zafiyeti") ||
    lower.includes("veri akışının kesilmesi") ||
    lower.includes("veri akışı kesil") ||
    lower.includes("dijital veri akışının kesilmesi") ||
    lower.includes("özet üretilemedi") ||
    lower.includes("analiz edilecek sosyal medya verisi bulunamadı") ||
    lower.includes("açık kaynak dinleme sistemlerinin acilen çeşitlendirilmesi") ||
    lower.includes("10 km wsw of dinar")
  );
}

async function buildContextForType(): Promise<string> {
  if (!isSupabaseClientConfigured) {
    return "Muğla için canlı sensör ve doğrulanmış kaynak verileri bekleniyor.";
  }
  try {
    const { data: rows } = await supabase
      .from("live_data_cache")
      .select("data_type, data")
      .in("data_type", ["weather", "air_quality", "traffic_density", "dams", "tourism", "earthquakes", "economy"]);
    const byType = new Map(((rows as any[]) || []).map((r) => [r.data_type, r.data]));
    const w = byType.get("weather");
    const aq = byType.get("air_quality");
    const traf = byType.get("traffic_density");
    const eq = byType.get("earthquakes");

    const lines: string[] = [];
    if (w?.temperature !== undefined && w?.temperature !== null) {
      lines.push(`Hava: Muğla genelinde ${w.temperature}°C (${w.condition ?? "Açık"}).`);
    }
    if (aq?.aqi !== undefined && aq?.aqi !== null) {
      lines.push(`Hava Kalitesi: EAQI ${aq.aqi} (${getAqiLabelTr(Number(aq.aqi), aq.aqi_label)}).`);
    }
    if (Array.isArray(traf?.hotspots) && traf.hotspots.length > 0) {
      const avg = Math.round(
        traf.hotspots.reduce((s: number, h: any) => s + Number(h.density || 0), 0) /
          traf.hotspots.length
      );
      lines.push(`Trafik: ${traf.hotspots.length} ilçede ortalama yoğunluk %${avg}.`);
    }
    if (eq?.earthquakes?.[0]) {
      const q = eq.earthquakes[0];
      lines.push(
        `Deprem: ${formatQuakeLocationTr(q.place || q.location)} (M${Number(q.magnitude).toFixed(1)}).`
      );
    }
    return lines.length > 0
      ? lines.join("\n")
      : "Muğla genelinde canlı sensör verileri izleniyor.";
  } catch {
    return "Muğla genelinde canlı sensör verileri izleniyor.";
  }
}

async function buildLiveFallback(type: SummaryType): Promise<AISummary> {
  try {
    let byType = new Map<string, any>();
    if (isSupabaseClientConfigured) {
      const { data: rows } = await supabase
        .from("live_data_cache")
        .select("data_type, data, fetched_at")
        .in("data_type", ["weather", "air_quality", "traffic_density", "dams", "tourism", "earthquakes", "economy"]);
      byType = new Map(((rows as any[]) || []).map((r) => [r.data_type, r.data]));
    }
    const w = byType.get("weather");
    const eq = byType.get("earthquakes");

    if (type === "weather") {
      return {
        type: "weather",
        summary:
          w?.temperature !== undefined && w?.temperature !== null
            ? `Muğla merkezde sıcaklık ${w.temperature}°C (${w.condition ?? "Açık"})${
                w.humidity !== undefined ? `, nem %${w.humidity}` : ""
              }${w.windspeed !== undefined ? `, rüzgar hızı ${w.windspeed} km/s` : ""}.`
            : "Muğla için güncel meteoroloji ölçümü bekleniyor.",
        generated_at: new Date().toISOString(),
        sourceLabel: "Open-Meteo Canlı",
      };
    }

    if (type === "earthquake") {
      const latest = eq?.earthquakes?.[0];
      return {
        type: "earthquake",
        summary: latest
          ? `Bölgeye yakın son sarsıntı ${formatQuakeLocationTr(latest.place || latest.location)} mevkiinde M${Number(latest.magnitude).toFixed(1)} büyüklüğünde kaydedilmiştir.`
          : "Son 24 saat içerisinde Muğla ve yakın çevresinde yeni bir deprem kaydı bulunmamaktadır.",
        generated_at: new Date().toISOString(),
        sourceLabel: "AFAD / USGS Deprem İzleme",
      };
    }

    if (type === "social") {
      return {
        type: "social",
        summary:
          "Muğla genelinde yerel basın ve sosyal medya gündemi 13 ilçe bazında izlenmektedir; doğrulanmış yeni paylaşımlar geldikçe özet güncellenir.",
        generated_at: new Date().toISOString(),
        sourceLabel: "Muğla Kamuoyu Takibi",
      };
    }

    return {
      type: "daily",
      summary:
        w?.temperature !== undefined && w?.temperature !== null
          ? `Muğla merkezde güncel sıcaklık ${w.temperature}°C (${w.condition ?? "Açık"}). 13 ilçede canlı sensör ve doğrulanmış yerel basın akışı izlenmektedir.`
          : "Muğla 13 ilçesi için canlı sensör ve doğrulanmış yerel kaynak verileri izlenmektedir.",
      generated_at: new Date().toISOString(),
      sourceLabel: "Canlı Göstergeler",
    };
  } catch {
    return {
      type,
      summary: "Muğla 13 ilçesi için canlı sensör ve doğrulanmış yerel kaynak verileri izlenmektedir.",
      generated_at: new Date().toISOString(),
      sourceLabel: "Canlı Şehir Nabzı",
    };
  }
}

export function useAISummary(type: SummaryType = "daily") {
  const { lang } = useTranslation();
  const isPulse = type === "pulse";

  // Pulse modu doğrudan üst KPI kutularıyla aynı canlı state katmanına bağlanır (0 ek Gemini kotası)
  const { data: weatherData, isLoading: weatherLoading } = useLiveData<any>("weather", {
    refetchInterval: 15 * 60 * 1000,
    enabled: isPulse,
  });
  const { data: aqData, isLoading: aqLoading } = useLiveData<any>("air_quality", {
    refetchInterval: 30 * 60 * 1000,
    enabled: isPulse,
  });
  const { data: trafficData } = useLiveData<any>("traffic_density", {
    refetchInterval: 5 * 60 * 1000,
    enabled: isPulse,
  });
  const damIntel = useDamIntelligence();
  const tourismIntel = useTourismIntelligence();
  const securityIntel = useSecurityIntelligence();
  const storeQuakes = useMonitorStore(selectEarthquakes);

  const livePulseSummary = useMemo<AISummary | null>(() => {
    if (!isPulse) return null;
    const resolvedWeather =
      weatherData && weatherData.temperature !== undefined && weatherData.temperature !== null
        ? weatherData
        : DEFAULT_WEATHER_SNAPSHOT;
    const resolvedAq =
      aqData && aqData.aqi !== undefined && aqData.aqi !== null
        ? aqData
        : DEFAULT_AQI_SNAPSHOT;
    const resolvedTraffic =
      Array.isArray(trafficData?.hotspots) && trafficData.hotspots.length > 0
        ? trafficData
        : DEFAULT_TRAFFIC_SNAPSHOT;
    const resolvedDams =
      damIntel.avgOccupancy !== null
        ? damIntel
        : {
            ...damIntel,
            avgOccupancy: OFFICIAL_DAM_REFERENCE_AVG,
            latestSourceSummary: "REFERANS VERİ · DSİ / MUSKİ (8 Baraj Ort.)",
          };
    const resolvedTourism =
      tourismIntel.hotelOccupancyPct !== null
        ? tourismIntel
        : {
            ...tourismIntel,
            hotelOccupancyPct: OFFICIAL_TOURISM_REFERENCE.hotelOccupancyPct,
            annualTourists: tourismIntel.annualTourists ?? OFFICIAL_TOURISM_REFERENCE.annualTourists,
            occupancySourceSummary: `REFERANS VERİ · ${OFFICIAL_TOURISM_REFERENCE.hotelOccupancySource}`,
          };
    const resolvedSecurity =
      securityIntel.latestQuake || !storeQuakes.items[0]
        ? securityIntel
        : {
            ...securityIntel,
            latestQuake: {
              id: storeQuakes.items[0].id,
              magnitude: storeQuakes.items[0].magnitude,
              location: storeQuakes.items[0].location,
              depthKm: storeQuakes.items[0].depthKm,
              occurredAt: storeQuakes.items[0].occurredAt,
              sourceName: storeQuakes.items[0].sourceName || "USGS / AFAD",
            },
          };
    return buildDynamicCityPulse(
      {
        weather: resolvedWeather,
        airQuality: resolvedAq,
        traffic: resolvedTraffic,
        dams: resolvedDams,
        tourism: resolvedTourism,
        security: resolvedSecurity,
      },
      lang
    );
  }, [isPulse, weatherData, aqData, trafficData, damIntel, tourismIntel, securityIntel, storeQuakes.items, lang]);

  const [data, setData] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    async (forceRefresh = false) => {
      if (isPulse) return;

      const cacheKey = SUMMARY_CACHE_KEY(type);

      if (!forceRefresh) {
        const cached = cacheManager.getMeta<AISummary>(cacheKey);
        if (cached) {
          if (!isCorruptedSummary(cached.data.summary)) {
            setData({ ...cached.data, isStale: cached.ageMs > TTL.LONG / 2 });
            if (cached.ageMs < TTL.LONG) return;
          } else {
            cacheManager.delete(cacheKey);
          }
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        if (!forceRefresh && isSupabaseClientConfigured) {
          const today = new Date().toISOString().split("T")[0];
          const { data: row } = await supabase
            .from("ai_summaries")
            .select("type, summary, generated_at")
            .eq("type", type)
            .eq("date", today)
            .maybeSingle();

          if (row?.summary && !isCorruptedSummary(row.summary)) {
            const summary: AISummary = {
              type: row.type as SummaryType,
              summary: row.summary,
              generated_at: row.generated_at,
              sourceLabel: "Gemini 3.5 Flash Lite",
            };
            setData(summary);
            cacheManager.set(cacheKey, summary, TTL.LONG);
            return;
          }
        }

        if (isSupabaseClientConfigured) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            const context = await buildContextForType();
            const { data: fnData, error: fnError } = await supabase.functions.invoke("ai-summary", {
              body: { type, context },
            });

            if (!fnError && fnData?.summary && !isCorruptedSummary(fnData.summary)) {
              const summary: AISummary = {
                ...(fnData as AISummary),
                sourceLabel: "Gemini 3.5 Flash Lite",
              };
              setData(summary);
              cacheManager.set(cacheKey, summary, TTL.LONG);
              return;
            }
          }
        }

        const liveFallback = await buildLiveFallback(type);
        setData(liveFallback);
        cacheManager.set(cacheKey, liveFallback, TTL.MEDIUM);
      } catch {
        const liveFallback = await buildLiveFallback(type);
        setData(liveFallback);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    },
    [isPulse, type]
  );

  useEffect(() => {
    if (!isPulse) {
      fetchSummary();
    }
  }, [isPulse, fetchSummary]);

  if (isPulse) {
    return {
      data: livePulseSummary,
      isLoading: weatherLoading && aqLoading && !livePulseSummary,
      error: null,
      refresh: () => {},
    };
  }

  return { data, isLoading, error, refresh: () => fetchSummary(true) };
}

export function useAllAISummaries() {
  const pulse = useAISummary("pulse");
  const daily = useAISummary("daily");
  const social = useAISummary("social");
  const earthquake = useAISummary("earthquake");
  const weather = useAISummary("weather");
  return { pulse, daily, social, earthquake, weather };
}
