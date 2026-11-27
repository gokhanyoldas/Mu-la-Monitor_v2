import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import {
  isSupabaseRuntimeAvailable,
  markSupabaseUnavailableIfFatal,
} from "@/lib/supabase-runtime-guard";
import { subscribeToRealtimeTable } from "@/lib/supabase-realtime-singleton";

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
      if (!isSupabaseRuntimeAvailable(isSupabaseClientConfigured)) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return readPersistentCache<T>(type);
      }
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { type, ...options?.extraBody },
      });
      if (error) {
        if (markSupabaseUnavailableIfFatal(error, `live-data:${type}`)) {
          return null;
        }
        console.warn(`Live data fallback (${type}):`, error);
        return readPersistentCache<T>(type);
      }
      return data?.data ?? null;
    },
    refetchInterval: options?.refetchInterval ?? (REFERENCE_TYPES.has(type) ? 60 * 60 * 1000 : 10 * 60 * 1000),
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: REFERENCE_TYPES.has(type) ? 30 * 60 * 1000 : 5 * 60 * 1000,
  });
}
