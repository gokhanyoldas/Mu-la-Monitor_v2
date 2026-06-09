import { useQuery } from "@tanstack/react-query";
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

export function useLiveData<T = any>(type: DataType, options?: {
  refetchInterval?: number;
  enabled?: boolean;
  extraBody?: Record<string, any>;
}) {
  const functionName = REFERENCE_TYPES.has(type) ? "reference-data" : "data-scrape";

  return useQuery<T | null>({
    queryKey: ["live-data", type, options?.extraBody],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { type, ...options?.extraBody },
      });
      if (error) {
        console.error(`Live data error (${type}):`, error);
        return null;
      }
      return data?.data ?? null;
    },
    refetchInterval: options?.refetchInterval ?? (REFERENCE_TYPES.has(type) ? 60 * 60 * 1000 : 10 * 60 * 1000),
    enabled: options?.enabled ?? true,
    retry: 1,
    staleTime: REFERENCE_TYPES.has(type) ? 30 * 60 * 1000 : 5 * 60 * 1000,
  });
}
