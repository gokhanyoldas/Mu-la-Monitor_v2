// RealtimeAlertBanner.tsx
// Floating critical alert banner — WebSocket-driven, instant push.

import { useEffect, useRef } from "react";
import { AlertTriangle, X, Zap, Flame, Droplets, Radio } from "lucide-react";
import { useRealtimeAlerts, type RealtimeAlert } from "@/hooks/useRealtimeAlerts";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<RealtimeAlert["type"], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  earthquake: { icon: AlertTriangle, label: "Deprem", color: "border-orange-500 bg-orange-950/80 text-orange-100" },
  fire:        { icon: Flame,         label: "Yangın", color: "border-red-500 bg-red-950/80 text-red-100" },
  flood:       { icon: Droplets,      label: "Sel",    color: "border-blue-500 bg-blue-950/80 text-blue-100" },
  crisis:      { icon: Radio,         label: "Kriz",   color: "border-yellow-500 bg-yellow-950/80 text-yellow-100" },
  social:      { icon: Zap,           label: "Sosyal", color: "border-purple-500 bg-purple-950/80 text-purple-100" },
  system:      { icon: Zap,           label: "Sistem", color: "border-slate-500 bg-slate-900/80 text-slate-100" },
};

function AlertCard({ alert, onDismiss }: { alert: RealtimeAlert; onDismiss: (id: string) => void }) {
  const config = TYPE_CONFIG[alert.type];
  const Icon = config.icon;
  const isCritical = alert.severity === "critical";

  return (
    <div className={cn("relative flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-sm",
      "animate-in slide-in-from-top-2 duration-300", config.color,
      isCritical && "ring-2 ring-red-400/50")} role="alert" aria-live="assertive">
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", isCritical && "animate-pulse")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-70">{config.label}</span>
          {isCritical && <span className="text-[9px] font-mono bg-red-500 text-white px-1 rounded">KRİTİK</span>}
          <span className="text-[10px] font-mono opacity-50 ml-auto">
            {new Date(alert.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-sm font-semibold mt-0.5 leading-snug">{alert.title}</p>
        {alert.body && <p className="text-xs opacity-80 mt-0.5 line-clamp-2">{alert.body}</p>}
        <p className="text-[10px] opacity-50 mt-1">Kaynak: {alert.source}</p>
      </div>
      <button onClick={() => onDismiss(alert.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity" aria-label="Uyarıyı kapat">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function RealtimeAlertBanner() {
  const { alerts, isConnected, dismissAlert, criticalCount } = useRealtimeAlerts({
    minSeverity: "high",
    onCritical: (alert) => {
      if (Notification.permission === "granted") {
        new Notification(`🚨 ${alert.title}`, { body: alert.body, icon: "/favicon.ico", tag: alert.id });
      }
    },
  });

  const permissionAsked = useRef(false);
  useEffect(() => {
    if (criticalCount > 0 && !permissionAsked.current && Notification.permission === "default") {
      permissionAsked.current = true;
      Notification.requestPermission();
    }
  }, [criticalCount]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]" aria-label="Gerçek zamanlı uyarılar">
      {!isConnected && (
        <div className="text-[10px] font-mono text-yellow-400 flex items-center gap-1 justify-end">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          yeniden bağlanıyor…
        </div>
      )}
      {alerts.slice(0, 5).map((alert) => (
        <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
      ))}
      {alerts.length > 5 && (
        <p className="text-[10px] font-mono text-center text-muted-foreground">+{alerts.length - 5} daha fazla uyarı</p>
      )}
    </div>
  );
}
