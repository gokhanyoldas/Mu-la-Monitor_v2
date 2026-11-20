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
