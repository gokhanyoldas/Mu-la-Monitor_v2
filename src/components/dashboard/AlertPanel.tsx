import { useAlertSystem } from "@/hooks/useAlertSystem";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { formatRelativeTime } from "@/lib/time-utils";
import { Bell, BellRing, X, Settings, RefreshCw, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export const AlertPanel = () => {
  const { rules, activeAlerts, lastCheck, dismissAlert, toggleRule, checkNow } = useAlertSystem();
  const hub = useOptionalUnifiedIntelligence();
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const dateLocale = isEn ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";

  const tabNotifications = hub?.tabNotifications ?? [];
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const totalCount = activeAlerts.length + tabNotifications.length;
  const hasAlerts = totalCount > 0;

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && hub) {
      hub.markNotificationsRead();
    }
  };

  const buttonAria = isEn
    ? hasAlerts
      ? `Alert center (${totalCount} active notifications)`
      : "Alert center"
    : hasAlerts
    ? `Bildirim merkezi (${totalCount} aktif bildirim)`
    : "Bildirim merkezi";

  return (
    <div className="relative" ref={panelRef}>
      {/* Alert Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={buttonAria}
        title={buttonAria}
        className={`relative p-1.5 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          hasAlerts
            ? "border-destructive/50 bg-destructive/10 text-destructive animate-pulse"
            : "border-border/50 bg-muted/15 text-muted-foreground hover:text-primary hover:bg-muted/35"
        }`}
      >
        {hasAlerts ? <BellRing size={14} aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
        {hasAlerts && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[9px] font-bold text-white flex items-center justify-center tabular-nums-stat">
            {totalCount}
          </span>
        )}
      </button>

      {/* Alert Dropdown */}
      {expanded && (
        <div
          role="dialog"
          aria-label={isEn ? "Alert Center" : "Bildirim Merkezi"}
          className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-background border border-border rounded-lg shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/50">
            <span className="text-xs font-mono font-bold text-primary">
              {isEn ? "ALERT CENTER" : "BİLDİRİM MERKEZİ"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={checkNow}
                className="p-0.5 rounded text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={isEn ? "Check now" : "Şimdi kontrol et"}
                aria-label={isEn ? "Check alerts now" : "Uyarıları şimdi kontrol et"}
              >
                <RefreshCw size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                aria-pressed={showSettings}
                aria-label={isEn ? "Alert rules settings" : "Uyarı kuralları ayarları"}
                title={isEn ? "Alert rules" : "Uyarı kuralları"}
                className="p-0.5 rounded text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Settings size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label={isEn ? "Close alert center" : "Bildirim merkezini kapat"}
                className="p-0.5 rounded text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Settings */}
          {showSettings && (
            <div className="p-3 border-b border-border/50 max-h-40 overflow-y-auto">
              <span className="text-[10px] font-mono text-muted-foreground mb-2 block">
                {isEn ? "ALERT RULES" : "UYARI KURALLARI"}
              </span>
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-1">
                  <span className="text-[10px] font-mono text-foreground/80">{translate(rule.label)}</span>
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    aria-pressed={rule.enabled}
                    aria-label={`${translate(rule.label)}: ${rule.enabled ? (isEn ? "ON" : "AÇIK") : isEn ? "OFF" : "KAPALI"}`}
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      rule.enabled
                        ? "bg-success/20 text-success border border-success/30"
                        : "bg-muted/20 text-muted-foreground border border-border/30"
                    }`}
                  >
                    {rule.enabled ? (isEn ? "ON" : "AÇIK") : isEn ? "OFF" : "KAPALI"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Güncel Şehir Bildirimleri */}
          {tabNotifications.length > 0 && (
            <div className="border-b border-border/50 bg-amber-500/5 max-h-48 overflow-y-auto">
              <div className="px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-amber-300 border-b border-border/30 flex items-center gap-1">
                <Zap size={10} aria-hidden="true" />
                {isEn
                  ? `Live City Updates (${tabNotifications.length})`
                  : `Güncel Şehir Bildirimleri (${tabNotifications.length})`}
              </div>
              {tabNotifications.map((tn) => (
                <div key={tn.id} className="p-2.5 border-b border-border/30 last:border-b-0 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono font-bold text-foreground">
                      {translate(tn.title)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tn.updatedTabs.map((tabName) => (
                        <span
                          key={tabName}
                          className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30"
                        >
                          {t(tabName)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => hub?.dismissHubNotification(tn.id)}
                    className="p-0.5 rounded text-muted-foreground hover:text-destructive shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    title={isEn ? "Dismiss notification" : "Bildirimi kapat"}
                    aria-label={isEn ? "Dismiss notification" : "Bildirimi kapat"}
                  >
                    <X size={10} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Alerts List */}
          <div className="max-h-60 overflow-y-auto">
            {activeAlerts.length === 0 && tabNotifications.length === 0 ? (
              <div className="p-4 text-center text-[11px] font-mono text-muted-foreground">
                <Bell size={20} className="mx-auto mb-2 opacity-30" aria-hidden="true" />
                {isEn ? "No active alerts" : "Aktif uyarı yok"}
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 border-b border-border/30 flex items-start gap-2 ${
                    alert.severity === "critical" ? "bg-destructive/5" : "bg-yellow-500/5"
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-[11px] font-mono text-foreground/90">{translate(alert.message)}</p>
                    <p
                      className="text-[9px] font-mono text-muted-foreground mt-0.5"
                      title={new Date(alert.timestamp).toLocaleString(dateLocale)}
                    >
                      {formatRelativeTime(alert.timestamp, lang)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissAlert(alert.id)}
                    aria-label={isEn ? "Dismiss alert" : "Uyarıyı kapat"}
                    className="p-0.5 rounded text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <X size={10} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border/50 text-center">
            <span
              className="text-[9px] font-mono text-muted-foreground/70"
              title={lastCheck ? new Date(lastCheck).toLocaleString(dateLocale) : undefined}
            >
              {isEn ? "Last check" : "Son kontrol"}:{" "}
              {lastCheck ? formatRelativeTime(lastCheck, lang) : "—"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
