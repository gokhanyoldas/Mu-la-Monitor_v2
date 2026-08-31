import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages alt dizininde yayınlanacağı için base yol
  base: "/Mu-la-Monitor_v2/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // OpenHands iş ortamı önizleme host'ları
    allowedHosts: [
      ".prod-runtime.all-hands.dev",
      ".all-hands.dev",
      "localhost",
      "127.0.0.1",
    ],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
