import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { ENV } from "@/config/env";
import { safeStorage } from "@/lib/safe-storage";

const SUPABASE_URL = ENV.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  ENV.VITE_SUPABASE_ANON_KEY || ENV.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseClientConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseClientConfigured) {
  const message =
    "[supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY tanımlı değil. " +
    "Hardcoded production fallback değerleri güvenlik nedeniyle devre dışı bırakıldı.";
  if (ENV.IS_PROD) {
    console.error(message);
  } else {
    console.warn(`${message} Yerel salt-okunur yedek modunda çalışılıyor.`);
  }
}

// Eksik ortam değişkeni durumunda istemci tarafı import crash'ini önlemek için
// yalnızca yerel/test güvenli placeholder kullanılır (production build vite.config.ts tarafından engellenir).
const effectiveUrl = SUPABASE_URL || "http://127.0.0.1:54321";
const effectiveKey = SUPABASE_ANON_KEY || "missing-supabase-anon-key";

export const supabase = createClient<Database>(effectiveUrl, effectiveKey, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
