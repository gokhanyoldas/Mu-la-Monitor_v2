// PWAUpdateBanner.tsx
import { RefreshCw, X } from "lucide-react";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useState } from "react";

export function PWAUpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const [dismissed, setDismissed] = useState(false);
  if (!updateAvailable || dismissed) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-950/90 px-4 py-3 shadow-xl backdrop-blur-sm text-violet-100 text-sm font-mono animate-in slide-in-from-bottom-4 duration-300">
      <RefreshCw className="h-4 w-4 text-violet-400 shrink-0" />
      <span className="text-xs">Yeni sürüm hazır</span>
      <button onClick={applyUpdate} className="text-xs bg-violet-500 hover:bg-violet-400 text-white px-3 py-1 rounded-lg transition-colors">Güncelle</button>
      <button onClick={() => setDismissed(true)} className="opacity-50 hover:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
