// Shared read-through/write-through cache helpers for the live_data_cache table.
// Edge functions call readLiveCache before hitting external APIs and
// writeLiveCache after a successful fetch, so the dashboard keeps working
// (with stale data) even when an upstream API is down.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient | null {
  if (client) return client;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  client = createClient(url, key);
  return client;
}

export interface CacheRead<T> {
  data: T;
  fetched_at: string;
  fresh: boolean;
}

export async function readLiveCache<T = unknown>(
  dataType: string,
  ttlMs: number,
): Promise<CacheRead<T> | null> {
  const sb = getServiceClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("live_data_cache")
    .select("data, fetched_at")
    .eq("data_type", dataType)
    .maybeSingle();
  if (error || !data) return null;
  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  return { data: data.data as T, fetched_at: data.fetched_at, fresh: ageMs < ttlMs };
}

export async function writeLiveCache(
  dataType: string,
  payload: unknown,
  ttlMs: number,
  source?: string,
): Promise<void> {
  const sb = getServiceClient();
  if (!sb) return;
  const { error } = await sb.from("live_data_cache").upsert(
    {
      data_type: dataType,
      data: payload,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      source: source ?? null,
      error: null,
    },
    { onConflict: "data_type" },
  );
  if (error) console.error(`[cache] write failed for ${dataType}:`, error.message);
}

export async function writeCacheError(dataType: string, message: string): Promise<void> {
  const sb = getServiceClient();
  if (!sb) return;
  await sb.from("live_data_cache").update({ error: message }).eq("data_type", dataType);
}
