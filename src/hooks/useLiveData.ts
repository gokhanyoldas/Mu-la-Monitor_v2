import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { data } = await supabase
    .from("live_data_cache")
    .select("data, fetched_at")
    .eq("data_type", type)
    .maybeSingle();
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

  // Push channel: cron jobs refresh live_data_cache in the background;
  // Realtime streams the new row straight into the query cache so the UI
  // updates without waiting for the next poll.
  useEffect(() => {
    if (options?.enabled === false) return;
    // Guard: register all listeners BEFORE subscribe. If Realtime is already
    // subscribed (e.g. reused channel instance) a post-subscribe .on() throws
    // synchronously — that error crashed the app via RootErrorBoundary.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`live-data:${type}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "live_data_cache",
          filter: `data_type=eq.${type}`,
        }, (payload) => {
          const row = payload.new as { data?: T };
          if (row?.data == null) return;
          // setQueryData (exact key) — prior version used setQueriesData with an
          // exact match, which never resolved once extraBody joined the key.
          queryClient.setQueryData(["live-data", type, options?.extraBody], row.data);
        })
        .subscribe();
    } catch (err) {
      console.warn(`[useLiveData] Realtime aboneliği kurulamadı (${type}) — polling ile devam:`, err);
      return;
    }
    return () => { supabase.removeChannel(channel!); };
  }, [type, options?.enabled, options?.extraBody, queryClient]);

  return useQuery<T | null>({
    queryKey: ["live-data", type, options?.extraBody],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { type, ...options?.extraBody },
      });
      if (error) {
        console.error(`Live data error (${type}):`, error);
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
