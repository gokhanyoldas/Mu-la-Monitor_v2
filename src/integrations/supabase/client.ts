import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  ENV,
  normalizeSupabaseUrl,
  sanitizeSupabaseKey,
  isSupabaseKeyCompatibleWithUrl,
} from "@/config/env";
import { safeStorage } from "@/lib/safe-storage";

export { normalizeSupabaseUrl };

const SUPABASE_URL = normalizeSupabaseUrl(ENV.VITE_SUPABASE_URL);
const RAW_SUPABASE_KEY =
  sanitizeSupabaseKey(ENV.VITE_SUPABASE_ANON_KEY) ||
  sanitizeSupabaseKey(ENV.VITE_SUPABASE_PUBLISHABLE_KEY);
const SUPABASE_ANON_KEY = isSupabaseKeyCompatibleWithUrl(RAW_SUPABASE_KEY, SUPABASE_URL)
  ? RAW_SUPABASE_KEY
  : "";

export const isSupabaseClientConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseClientConfigured) {
  const message =
    "[supabase] VITE_SUPABASE_URL geçersiz/eksik veya VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY tanımlı değil. " +
    "Hardcoded production fallback değerleri güvenlik nedeniyle devre dışı bırakıldı.";
  if (ENV.IS_PROD) {
    console.error(message);
  } else {
    console.warn(`${message} Yerel yedek modunda çalışılıyor.`);
  }
}

// Eksik veya bozuk URL durumunda istemci tarafı import crash'ini ve hatalı ağ isteklerini önlemek için
// yalnızca güvenli yerel placeholder kullanılır.
const effectiveUrl = isSupabaseClientConfigured ? SUPABASE_URL : "http://127.0.0.1:54321";
const effectiveKey = isSupabaseClientConfigured ? SUPABASE_ANON_KEY : "missing-supabase-anon-key";

export const supabase = createClient<Database>(effectiveUrl, effectiveKey, {
  auth: {
    storage: safeStorage,
    persistSession: isSupabaseClientConfigured,
    autoRefreshToken: isSupabaseClientConfigured,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});

export default supabase;
