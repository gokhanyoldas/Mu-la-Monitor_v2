// useServiceWorker.ts
import { useEffect, useState } from "react";

interface SWState { isSupported: boolean; isRegistered: boolean; updateAvailable: boolean; applyUpdate: () => void; }

export function useServiceWorker(): SWState {
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const isSupported = "serviceWorker" in navigator;

  useEffect(() => {
    if (!isSupported || import.meta.env.DEV) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        setIsRegistered(true);
        if (reg.waiting) { setWaitingWorker(reg.waiting); setUpdateAvailable(true); }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker); setUpdateAvailable(true);
            }
          });
        });
        setInterval(() => reg.update(), 30 * 60 * 1000);
      } catch (e) { console.warn("[SW] Registration failed:", e); }
    };
    register();
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
  }, [isSupported]);

  const applyUpdate = () => { waitingWorker?.postMessage({ type: "SKIP_WAITING" }); setUpdateAvailable(false); };
  return { isSupported, isRegistered, updateAvailable, applyUpdate };
}
