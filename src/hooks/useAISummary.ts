// useAISummary.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cacheManager, TTL } from "@/lib/cache-manager";

export type SummaryType = "daily" | "social" | "earthquake" | "weather";

interface AISummary { type: SummaryType; summary: string; generated_at: string; isStale?: boolean; }

const SUMMARY_CACHE_KEY = (type: SummaryType) => `ai_summary_${type}`;

export function useAISummary(type: SummaryType = "daily") {
  const [data, setData] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (forceRefresh = false) => {
    const cacheKey = SUMMARY_CACHE_KEY(type);
    if (!forceRefresh) {
      const cached = cacheManager.getMeta<AISummary>(cacheKey);
      if (cached) {
        setData({ ...cached.data, isStale: cached.ageMs > TTL.LONG / 2 });
        if (cached.ageMs < TTL.LONG) return;
      }
    }
    setIsLoading(true); setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: row } = await supabase
        .from("ai_summaries").select("type, summary, generated_at")
        .eq("type", type).eq("date", today).maybeSingle();
      if (row) {
        const summary: AISummary = { type: row.type as SummaryType, summary: row.summary, generated_at: row.generated_at };
        setData(summary); cacheManager.set(cacheKey, summary, TTL.LONG); return;
      }
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ai-summary", { body: { type } });
      if (fnError) throw new Error(fnError.message);
      const summary: AISummary = fnData as AISummary;
      setData(summary); cacheManager.set(cacheKey, summary, TTL.LONG);
    } catch (e) {
      setError(String(e));
      const stale = cacheManager.getMeta<AISummary>(cacheKey);
      if (stale) setData({ ...stale.data, isStale: true });
    } finally { setIsLoading(false); }
  }, [type]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  return { data, isLoading, error, refresh: () => fetchSummary(true) };
}

export function useAllAISummaries() {
  const daily = useAISummary("daily");
  const social = useAISummary("social");
  const earthquake = useAISummary("earthquake");
  const weather = useAISummary("weather");
  return { daily, social, earthquake, weather };
}
