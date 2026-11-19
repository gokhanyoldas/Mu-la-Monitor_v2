import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { resolveViteBase, assertProductionEnv } from "./src/config/deploy";

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

  // Vite (import.meta.env.VITE_*) ile AI Studio / Vercel (process.env.GEMINI_API_KEY) birleştirme
  const geminiApiKey =
    env.VITE_GEMINI_API_KEY ||
    env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    "";

  const appUrl =
    env.VITE_APP_URL ||
    env.APP_URL ||
    (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "") ||
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    "";

  if (geminiApiKey && !process.env.VITE_GEMINI_API_KEY) {
    process.env.VITE_GEMINI_API_KEY = geminiApiKey;
  }
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
      "process.env.GEMINI_API_KEY": JSON.stringify(geminiApiKey),
      "process.env.VITE_GEMINI_API_KEY": JSON.stringify(geminiApiKey),
      "process.env.APP_URL": JSON.stringify(appUrl),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
