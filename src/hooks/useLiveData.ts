import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import {
  isSupabaseRuntimeAvailable,
  markSupabaseUnavailableIfFatal,
} from "@/lib/supabase-runtime-guard";
import { subscribeToRealtimeTable } from "@/lib/supabase-realtime-singleton";
import {
  DEFAULT_AQI_SNAPSHOT,
  DEFAULT_TRAFFIC_SNAPSHOT,
  DEFAULT_WEATHER_SNAPSHOT,
  eaqiToTurkishLabel,
  weatherCodeToTurkish,
} from "@/data/officialReferenceData";

export type DataType =
  | "weather" | "air_quality" | "dams" | "protocol" | "news"
  | "economy" | "real_estate" | "tourism" | "road_works" | "energy" | "trends"
  | "demographics" | "education" | "health" | "agriculture" | "traffic_density"
  | "gastronomy" | "budget" | "culture" | "life_quality"
  | "earthquakes" | "all";

// Map reference data types to their edge function
const REFERENCE_TYPES = new Set([
  "demographics", "education", "health", "agriculture",
  "traffic_density", "gastronomy", "budget", "culture", "life_quality",
]);

async function fetchWithTimeout(url: string, timeoutMs = 5500): Promise<Response | null> {
  if (typeof fetch !== "function") return null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const resp = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!resp || !resp.ok) return null;
    return resp;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchDirectPublicFallback<T>(type: DataType): Promise<T | null> {
  if (type === "weather") {
    const resp = await fetchWithTimeout(
      "https://api.open-meteo.com/v1/forecast?latitude=37.2153&longitude=28.3636&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=uv_index_max&timezone=Europe%2FIstanbul&forecast_days=1"
    );
    if (resp) {
      try {
        const json = await resp.json();
        const cur = json?.current;
        if (cur && typeof cur.temperature_2m === "number") {
          const temp = Math.round(cur.temperature_2m);
          const wind = typeof cur.wind_speed_10m === "number" ? Math.round(cur.wind_speed_10m) : 12;
          const humidity =
            typeof cur.relative_humidity_2m === "number" ? Math.round(cur.relative_humidity_2m) : 60;
          const uvMax = Array.isArray(json?.daily?.uv_index_max)
            ? Math.round(Number(json.daily.uv_index_max[0] ?? 4))
            : 4;
          const code = typeof cur.weather_code === "number" ? cur.weather_code : 3;
          return {
            temperature: temp,
            humidity,
            windspeed: wind,
            wind_speed: wind,
            uv_index: Number.isFinite(uvMax) ? uvMax : 4,
            sea_temp: Math.max(15, Math.min(27, temp + 3)),
            condition: weatherCodeToTurkish(code),
            source: "Open-Meteo Canlı",
            fetched_at: new Date().toISOString(),
            isReference: false,
          } as T;
        }
      } catch {
        // fallback below
      }
    }
    return DEFAULT_WEATHER_SNAPSHOT as T;
  }

  if (type === "air_quality") {
    const resp = await fetchWithTimeout(
      "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.2153&longitude=28.3636&current=european_aqi,pm2_5,pm10&timezone=Europe%2FIstanbul"
    );
    if (resp) {
      try {
        const json = await resp.json();
        const cur = json?.current;
        if (cur && typeof cur.european_aqi === "number") {
          const aqi = Math.round(cur.european_aqi);
          const label = eaqiToTurkishLabel(aqi);
          return {
            aqi,
            pm25: typeof cur.pm2_5 === "number" ? Math.round(cur.pm2_5 * 10) / 10 : 10,
            pm10: typeof cur.pm10 === "number" ? Math.round(cur.pm10 * 10) / 10 : 18,
            aqi_label: label,
            quality_label: label,
            source: "Open-Meteo EAQI Canlı",
            fetched_at: new Date().toISOString(),
            isReference: false,
          } as T;
        }
      } catch {
        // fallback below
      }
    }
    return DEFAULT_AQI_SNAPSHOT as T;
  }

  if (type === "earthquakes") {
    const resp = await fetchWithTimeout(
      "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=37.1&longitude=28.4&maxradiuskm=180&minmagnitude=1.5&limit=10"
    );
    if (resp) {
      try {
        const json = await resp.json();
        if (Array.isArray(json?.features) && json.features.length > 0) {
          const earthquakes = json.features
            .map((f: any) => {
              const mag = Number(f?.properties?.mag);
              if (!Number.isFinite(mag)) return null;
              const coords = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
              const depth = Number(coords[2]);
              const timeMs = Number(f?.properties?.time);
              return {
                id: String(f?.id ?? `usgs-${timeMs || Date.now()}`),
                magnitude: Math.round(mag * 10) / 10,
                place: String(f?.properties?.place ?? "Muğla Çevresi"),
                location: String(f?.properties?.place ?? "Muğla Çevresi"),
                depth_km: Number.isFinite(depth) ? Math.round(depth * 10) / 10 : null,
                time: Number.isFinite(timeMs) ? new Date(timeMs).toISOString() : new Date().toISOString(),
                url: typeof f?.properties?.url === "string" ? f.properties.url : undefined,
                source: "USGS",
              };
            })
            .filter(Boolean);
          if (earthquakes.length > 0) {
            return {
              earthquakes,
              source: "USGS Canlı",
              fetched_at: new Date().toISOString(),
            } as T;
          }
        }
      } catch {
        // return null if unavailable
      }
    }
    return null;
  }

  if (type === "traffic_density") {
    return DEFAULT_TRAFFIC_SNAPSHOT as T;
  }

  return null;
}

// Last-known-good value from the persistent live_data_cache table.
// Used when the edge function is unreachable, so the dashboard
// still renders the latest snapshot instead of going blank.
async function readPersistentCache<T>(type: DataType): Promise<T | null> {
  if (!isSupabaseRuntimeAvailable(isSupabaseClientConfigured)) return null;
  const { data, error } = await supabase
    .from("live_data_cache")
    .select("data, fetched_at")
    .eq("data_type", type)
    .maybeSingle();
  if (error) {
    markSupabaseUnavailableIfFatal(error, `live_data_cache:${type}`);
    return null;
  }
  if (!data?.data) return null;
  return { ...(data.data as object), stale: true, fetched_at: data.fetched_at } as T;
}

export function useLiveData<T = any>(type: DataType, options?: {
  refetchInterval?: number;
  enabled?: boolean;
  extraBody?: Record<string, any>;
}) {
  const queryClient = useQueryClient();
  const functionName = REFERENCE_TYPES.has(type) ? "reference-data" : "data-scrape";
  const isEnabled = options?.enabled !== false;
  const extraBodyRef = useRef(options?.extraBody);
  extraBodyRef.current = options?.extraBody;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  // Tekil singleton Realtime kanalı üzerinden `live_data_cache` değişikliklerini dinle;
  // her kart için ayrı WebSocket kanalı açılmaz ve state değişiminde kanal yeniden kurulmaz.
  useEffect(() => {
    if (!isEnabled || !isSupabaseClientConfigured) return;

    return subscribeToRealtimeTable("live_data_cache", (payload) => {
      const row = payload.new as { data_type?: string; data?: T } | undefined;
      if (!row || row.data_type !== type || row.data == null) return;
      queryClientRef.current.setQueryData(
        ["live-data", type, extraBodyRef.current],
        row.data
      );
    });
  }, [type, isEnabled]);

  return useQuery<T | null>({
    queryKey: ["live-data", type, options?.extraBody],
    queryFn: async () => {
      let resolved: T | null = null;

      if (isSupabaseRuntimeAvailable(isSupabaseClientConfigured)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          resolved = await readPersistentCache<T>(type);
        } else {
          const { data, error } = await supabase.functions.invoke(functionName, {
            body: { type, ...options?.extraBody },
          });
          if (error) {
            if (!markSupabaseUnavailableIfFatal(error, `live-data:${type}`)) {
              console.warn(`Live data fallback (${type}):`, error);
              resolved = await readPersistentCache<T>(type);
            }
          } else {
            resolved = (data?.data as T) ?? null;
          }
        }
      }

      if (resolved !== null && resolved !== undefined) {
        return resolved;
      }

      // Open-Meteo (weather/air_quality), USGS (earthquakes) ve 13 ilçe trafik profili
      // doğrudan senkron kaynaklardan beslenir; böylece Genel Bakış ile sekmeler asla ayrışmaz.
      return fetchDirectPublicFallback<T>(type);
    },
    refetchInterval: options?.refetchInterval ?? (REFERENCE_TYPES.has(type) ? 60 * 60 * 1000 : 10 * 60 * 1000),
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: REFERENCE_TYPES.has(type) ? 30 * 60 * 1000 : 5 * 60 * 1000,
  });
}
