import { createRoot } from "react-dom/client";
import { inject } from "@vercel/analytics";
import App from "./App.tsx";
import "./index.css";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { initSentry } from "./lib/sentry";

// ── Sentry APM (Madde 12) ────────────────────────────────────────────────
initSentry();

// ── Vercel Web Analytics (yalnızca tarayıcı / production ortamında) ──────
if (typeof window !== "undefined" && import.meta.env.PROD && import.meta.env.MODE !== "test") {
  try {
    inject();
  } catch {
    // Analytics yüklenemezse uygulama akışını kesme
  }
}

// ── Service Worker / PWA (Madde 10) ───────────────────────────────────────
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/";
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
