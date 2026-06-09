// useCachedFetch.ts
// React hook wrapping cacheManager with stale-while-revalidate pattern.

import { useState, useEffect, useCallback } from "react";
import { cacheManager } from "@/lib/cache-manager";

interface UseCachedFetchOptions {
  ttl?: number;
  enabled?: boolean;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  ageMs: number | null;
  refetch: () => void;
}

export function useCachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options: UseCachedFetchOptions = {}
): UseCachedFetchResult<T> {
  const { ttl, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [ageMs, setAgeMs] = useState<number | null>(null);

  const fetchFresh = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const fresh = await fetcher();
      cacheManager.set(cacheKey, fresh, ttl);
      setData(fresh); setAgeMs(0);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally { setIsLoading(false); }
  }, [cacheKey, fetcher, ttl]);

  useEffect(() => {
    if (!enabled) return;
    const cached = cacheManager.getMeta<T>(cacheKey);
    if (cached) {
      setData(cached.data); setAgeMs(cached.ageMs);
      if (ttl && cached.ageMs > ttl / 2) fetchFresh();
    } else {
      fetchFresh();
    }
  }, [cacheKey, enabled, fetchFresh, ttl]);

  return { data, isLoading, error, ageMs, refetch: fetchFresh };
}
