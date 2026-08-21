import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Güvenli ortam değişkeni okuma: build/test sırasında import.meta.env tanımsız
// olabilir — istemci asla undefined/boş değerle kurulmamalı.
const env: Record<string, string | undefined> =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env) || {};

// Public Supabase project values (anon key is safe to expose in frontend,
// protected by RLS). Hardcoded fallbacks keep the app mountable even when
// .env is missing — placeholder kullanmak Realtime/WebSocket çöküşüne yol açar.
const FALLBACK_SUPABASE_URL = "https://wivooargsmcwbiokpklu.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpdm9vYXJnc21jd2Jpb2twa2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjgxMTEsImV4cCI6MjA5MzY0NDExMX0.9PweuSu2sc72kKKv2W_wVd7VCAic7QtI-QC-Z5zKa8g";

const SUPABASE_URL =
  (env.VITE_SUPABASE_URL as string | undefined) ||
  (env.SUPABASE_URL as string | undefined) ||
  FALLBACK_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (env.SUPABASE_ANON_KEY as string | undefined) ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_PUBLISHABLE_KEY .env içinde tanımlı değil. " +
      "Yedek (fallback) değerler kullanılıyor. Lütfen proje kökünde .env dosyasını oluşturun."
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof localStorage !== "undefined" ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
