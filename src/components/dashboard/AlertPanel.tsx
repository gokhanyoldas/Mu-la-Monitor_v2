import { useAlertSystem } from "@/hooks/useAlertSystem";
import { Bell, BellRing, X, Settings, RefreshCw } from "lucide-react";
import { useState } from "react";

export const AlertPanel = () => {
  const { rules, activeAlerts, lastCheck, dismissAlert, toggleRule, checkNow } = useAlertSystem();
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasAlerts = activeAlerts.length > 0;

  return (
    <div className="relative">
      {/* Alert Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`relative p-2 rounded-lg border transition-all ${
          hasAlerts
            ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
            : "border-border/50 bg-muted/10 text-muted-foreground hover:text-primary"
        }`}
      >
        {hasAlerts ? <BellRing size={16} /> : <Bell size={16} />}
        {hasAlerts && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {activeAlerts.length}
          </span>
        )}
      </button>

      {/* Alert Dropdown */}
      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/50">
            <span className="text-xs font-mono font-bold text-primary">BİLDİRİM MERKEZİ</span>
            <div className="flex items-center gap-2">
              <button onClick={checkNow} className="text-muted-foreground hover:text-primary" title="Şimdi kontrol et">
                <RefreshCw size={12} />
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="text-muted-foreground hover:text-primary">
                <Settings size={12} />
              </button>
              <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-primary">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Settings */}
          {showSettings && (
            <div className="p-3 border-b border-border/50 max-h-40 overflow-y-auto">
              <span className="text-[10px] font-mono text-muted-foreground mb-2 block">UYARI KURALLARI</span>
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono text-foreground/80">{rule.label}</span>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      rule.enabled
                        ? "bg-success/20 text-success border border-success/30"
                        : "bg-muted/20 text-muted-foreground border border-border/30"
                    }`}
                  >
                    {rule.enabled ? "AÇIK" : "KAPALI"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Alerts List */}
          <div className="max-h-60 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="p-4 text-center text-[11px] font-mono text-muted-foreground">
                <Bell size={20} className="mx-auto mb-2 opacity-30" />
                Aktif uyarı yok
              </div>
            ) : (
              activeAlerts.map(alert => (
                <div key={alert.id} className={`p-3 border-b border-border/30 flex items-start gap-2 ${
                  alert.severity === "critical" ? "bg-destructive/5" : "bg-yellow-500/5"
                }`}>
                  <div className="flex-1">
                    <p className="text-[11px] font-mono text-foreground/90">{alert.message}</p>
                    <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
                      {new Date(alert.timestamp).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border/50 text-center">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              Son kontrol: {lastCheck ? new Date(lastCheck).toLocaleTimeString("tr-TR") : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
