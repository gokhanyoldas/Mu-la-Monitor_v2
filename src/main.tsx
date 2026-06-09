import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { initSentry } from "./lib/sentry";

// ── Sentry APM (Madde 12) ────────────────────────────────────────────────
initSentry();

// ── Service Worker / PWA (Madde 10) ───────────────────────────────────────
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
