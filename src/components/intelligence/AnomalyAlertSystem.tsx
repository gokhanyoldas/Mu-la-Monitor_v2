import { useEffect, useState } from "react";
import { osintDataManager, IntelligenceItem } from "@/services/osint-data-manager";
import { CircleAlert as AlertCircle, Zap, TrendingDown, TrendingUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  actionUrl?: string;
}

export const AnomalyAlertSystem = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    checkForAnomalies();
    const interval = setInterval(checkForAnomalies, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkForAnomalies = () => {
    const items = osintDataManager.getIntelligenceFeed();
    const criticalItems = osintDataManager.getCriticalItems();
    const newAlerts: Alert[] = [];

    criticalItems.slice(0, 5).forEach((item) => {
      const alertId = `anomaly_${item.id}`;

      const exists = alerts.some((a) => a.id === alertId);
      if (!exists) {
        newAlerts.push({
          id: alertId,
          type: "critical",
          title: "KRİTİK ANOM ALİ TESPİT EDİLDİ",
          message: item.title.substring(0, 60) + (item.title.length > 60 ? "..." : ""),
          timestamp: Date.now(),
          duration: 15000,
          actionUrl: item.link,
        });
      }
    });

    const highImportanceCount = items.filter(
      (i) => i.importance === "high"
    ).length;
    if (highImportanceCount > 5) {
      const existsHighAlert = alerts.some((a) => a.id === "high_volume");
      if (!existsHighAlert) {
        newAlerts.push({
          id: "high_volume",
          type: "warning",
          title: "YÜKSEK HACIM BİLDİRİMİ",
          message: `Son 1 saatte ${highImportanceCount} yüksek önem bildirimi`,
          timestamp: Date.now(),
          duration: 20000,
        });
      }
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 8));
    }

    setAlerts((prev) =>
      prev.filter((a) => {
        if (a.duration && Date.now() - a.timestamp > a.duration) {
          return false;
        }
        return true;
      })
    );
  };

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <Zap className="w-4 h-4 text-red-400 animate-pulse" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      default:
        return <TrendingUp className="w-4 h-4 text-blue-400" />;
    }
  };

  const getAlertBgColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-gradient-to-r from-red-950/80 to-red-900/80 border-red-700/50 hover:border-red-700";
      case "warning":
        return "bg-gradient-to-r from-orange-950/80 to-orange-900/80 border-orange-700/50 hover:border-orange-700";
      default:
        return "bg-gradient-to-r from-blue-950/80 to-blue-900/80 border-blue-700/50 hover:border-blue-700";
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {!isMinimized ? (
        <>
          {alerts.map((alert, index) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border backdrop-blur-sm transition-all duration-300 ${getAlertBgColor(
                alert.type
              )} animate-in slide-in-from-top-2`}
              style={{
                animation: `slideIn 0.3s ease-out ${index * 50}ms both`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.type)}</div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    {alert.title}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                    {alert.message}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {alert.actionUrl && (
                    <a
                      href={alert.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Aç
                    </a>
                  )}
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-200" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 flex items-center justify-between">
          <Badge className="bg-red-600 text-white text-xs">
            {alerts.length} Uyarı
          </Badge>
          <button
            onClick={() => setIsMinimized(false)}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Aç
          </button>
        </div>
      )}

      {alerts.length > 0 && (
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="absolute -bottom-8 right-0 text-xs text-slate-500 hover:text-slate-300"
        >
          {isMinimized ? "Göster" : "Kapat"}
        </button>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
