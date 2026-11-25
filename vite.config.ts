import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { resolveViteBase, assertProductionEnv } from "./src/config/deploy.ts";
import {
  normalizeSupabaseUrl,
  resolveSupabaseKeyFromRecord,
  sanitizeSupabaseKey,
} from "./src/config/supabase-env-utils.ts";

export { resolveViteBase, assertProductionEnv };

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const mergedEnv: Record<string, string | undefined> = {
    ...env,
    ...process.env,
  };

  const base = resolveViteBase(mergedEnv);
  assertProductionEnv(command, mode, mergedEnv);

  // Supabase URL ve çift anahtar (VITE_SUPABASE_ANON_KEY || VITE_SUPABASE_PUBLISHABLE_KEY) otomatik uyumu
  const supabaseUrl = normalizeSupabaseUrl(
    mergedEnv.VITE_SUPABASE_URL || mergedEnv.SUPABASE_URL || ""
  );
  const supabaseAnonKey = resolveSupabaseKeyFromRecord(mergedEnv, supabaseUrl);
  const supabasePublishableKey =
    sanitizeSupabaseKey(mergedEnv.VITE_SUPABASE_PUBLISHABLE_KEY) || supabaseAnonKey;

  if (supabaseUrl) {
    process.env.VITE_SUPABASE_URL = supabaseUrl;
  }
  if (supabaseAnonKey && !process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;
  }
  if (supabasePublishableKey && !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supabasePublishableKey;
  }

  const appUrl =
    env.VITE_APP_URL ||
    env.APP_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "") ||
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    "";

  if (appUrl && !process.env.VITE_APP_URL) {
    process.env.VITE_APP_URL = appUrl;
  }

  return {
    base,
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      hmr: {
        overlay: false,
      },
    },
    define: {
      "process.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
      "process.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "process.env.APP_URL": JSON.stringify(appUrl),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
