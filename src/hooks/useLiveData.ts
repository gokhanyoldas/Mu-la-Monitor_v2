import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DataType =
  | "weather" | "air_quality" | "dams" | "protocol" | "news"
  | "economy" | "real_estate" | "tourism" | "road_works" | "energy" | "trends"
  | "demographics" | "education" | "health" | "traffic_density"
  | "gastronomy" | "budget" | "culture" | "life_quality"
  | "earthquakes" | "all";

async function readPersistentCache<T>(type: DataType): Promise<T | null> {
  try {
    if (!supabase) return null;
    const { data } = await supabase
      .from("live_data_cache")
      .select("data, fetched_at")
      .eq("data_type", type)
      .maybeSingle();
    return (data?.data as T) || null;
  } catch (err) {
    console.error("Cache read error:", err);
    return null;
  }
}

export function useLiveData<T>(type: DataType) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["live-data", type],
    queryFn: () => readPersistentCache<T>(type),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!type || !supabase) return;

    try {
      const channel = supabase
        .channel(`live-data:${type}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "live_data_cache",
            filter: `data_type=eq.${type}`,
          },
          (payload) => {
            if (payload?.new) {
              queryClient.setQueryData(["live-data", type], (payload.new as any).data);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.error("Realtime subscription error:", e);
    }
  }, [type, queryClient]);

  return query;
}

export default useLiveData;
