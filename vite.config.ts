import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
import { resolveViteBase, assertProductionEnv } from "./src/config/deploy.ts";

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
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Build-time code splitting: heavy, stable vendor libraries get their
          // own chunks so the app entry stays small and vendor chunks remain
          // cacheable across deploys (the service worker caches /assets/*).
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/leaflet") || id.includes("leaflet.")) return "vendor-leaflet";
            if (id.includes("/recharts") || id.includes("/d3-") || id.includes("/victory-vendor")) return "vendor-charts";
            if (id.includes("/jspdf")) return "vendor-pdf";
            if (id.includes("/@radix-ui/")) return "vendor-radix";
            if (id.includes("/react-dom") || id.includes("/scheduler")) return "vendor-react-dom";
            if (id.includes("/@supabase/") || id.includes("/zustand")) return "vendor-supabase";
            if (id.includes("/lucide-react")) return "vendor-icons";
            if (id.includes("/react") || id.includes("/remix")) return "vendor-react";
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      hmr: {
        overlay: false,
      },
    },
    define: {
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
