// useAISummary.ts
// Şehir Nabzı (pulse) tamamen canlı sensör/grounding state'inden dinamik üretilir:
// Üst KPI kutularıyla asla çelişmez, sabit %44/%41/Dinar kalıntısı barındırmaz ve
// Supabase Realtime güncellemelerinde ek Gemini kotası tüketmeden anında yenilenir.

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { cacheManager, TTL } from "@/lib/cache-manager";
import { useLiveData } from "@/hooks/useLiveData";
import {
  useDamIntelligence,
  useTourismIntelligence,
  useSecurityIntelligence,
  type DamIntelligenceSnapshot,
  type TourismIntelligenceSnapshot,
  type SecurityIntelligenceSnapshot,
} from "@/services/topicGroundingService";

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

/**
 * USGS/AFAD İngilizce konum metinlerini (ör. "10 km WSW of Bodrum, Turkey")
 * doğal Türkçe formata dönüştürür ("Bodrum — 10 km batı-güneybatısı").
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

function getAqiLabelTr(aqi: number, fallbackLabel?: string): string {
  if (fallbackLabel && fallbackLabel.trim()) return fallbackLabel.trim();
  if (aqi <= 20) return "Çok İyi";
  if (aqi <= 40) return "İyi";
  if (aqi <= 60) return "Orta";
  if (aqi <= 80) return "Hassas";
  if (aqi <= 100) return "Kötü";
  return "Çok Kötü";
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
 * dinamik Türkçe Şehir Nabzı metni üretir. Sabit %44 baraj, %41 otel veya
 * İngilizce USGS kalıntısı asla içermez.
 */
export function buildDynamicCityPulse(input: DynamicCityPulseInput): AISummary {
  const { weather, airQuality, traffic, dams, tourism, security } = input;

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
  if (hasTemp && hasAqi) {
    const cond = weather?.condition ? ` (${weather.condition})` : "";
    const label = getAqiLabelTr(aqiNum, airQuality?.aqi_label ?? undefined);
    p1 = `1. Muğla genelinde sıcaklık ${weather!.temperature}°C${cond}, hava kalitesi EAQI ${aqiNum} (${label}) seviyesindedir.`;
  } else if (hasTemp) {
    const cond = weather?.condition ? ` (${weather.condition})` : "";
    p1 = `1. Muğla genelinde sıcaklık ${weather!.temperature}°C${cond}; hava kalitesi için güncel ölçüm bekleniyor.`;
  } else if (hasAqi) {
    const label = getAqiLabelTr(aqiNum, airQuality?.aqi_label ?? undefined);
    p1 = `1. Muğla hava kalitesi EAQI ${aqiNum} (${label}) seviyesindedir; güncel sıcaklık ölçümü bekleniyor.`;
  } else {
    p1 = "1. Muğla genelinde hava durumu ve hava kalitesi için canlı meteoroloji ölçümü bekleniyor.";
  }

  // 2. Su & Barajlar (üst KPI "Baraj" ile birebir senkron)
  const p2 =
    dams.avgOccupancy !== null
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
    p3 =
      criticalCount > 0
        ? `3. ${validHotspots.length} ilçede anlık ortalama trafik yoğunluğu %${avgDensity}; en yoğun nokta ${busiest.name} (%${busiest.density}) ve ${criticalCount} bölgede kritik yoğunluk izleniyor.`
        : `3. ${validHotspots.length} ilçede anlık ortalama trafik yoğunluğu %${avgDensity} ile akıcı seyrediyor; en yoğun nokta ${busiest.name} (%${busiest.density}).`;
  } else {
    p3 = "3. İl genelinde canlı trafik yoğunluğu sensör verisi bekleniyor.";
  }

  // 4. Turizm & Deprem / Güvenlik (üst KPI "Otel Doluluk" ve "Güvenlik" ile birebir senkron)
  let tourismPart: string;
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

  let securityPart: string;
  if (security.latestQuake) {
    const locTr = formatQuakeLocationTr(security.latestQuake.location);
    const depthPart =
      security.latestQuake.depthKm !== null
        ? ` (${security.latestQuake.depthKm} km derinlik)`
        : "";
    securityPart = `Son deprem kaydı: ${locTr} — M${security.latestQuake.magnitude.toFixed(1)}${depthPart}.`;
  } else if (security.publicOrderEvents.length > 0) {
    securityPart = `Güvenlik ve asayişte ${security.publicOrderEvents.length} güncel gelişme takip ediliyor.`;
  } else {
    securityPart = "Muğla ve çevresinde güncel kritik deprem kaydı bulunmuyor.";
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

  const livePulseSummary = useMemo<AISummary | null>(() => {
    if (!isPulse) return null;
    return buildDynamicCityPulse({
      weather: weatherData,
      airQuality: aqData,
      traffic: trafficData,
      dams: damIntel,
      tourism: tourismIntel,
      security: securityIntel,
    });
  }, [isPulse, weatherData, aqData, trafficData, damIntel, tourismIntel, securityIntel]);

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
