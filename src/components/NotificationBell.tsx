import { useState, useRef, useEffect } from "react";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import { useNotifications, type NotificationPreferences } from "@/hooks/useNotifications";
import { useTranslation } from "@/hooks/useTranslation";

export const NotificationBell = () => {
  const {
    isSupported,
    permission,
    preferences,
    requestPermission,
    updatePreferences,
    showLocalNotification,
  } = useNotifications();
  const { lang, t } = useTranslation();
  const isEn = lang === "en";

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (!isSupported) return null;

  const isGranted = permission === "granted";
  const isDenied = permission === "denied";
  const hasActive = isGranted && Object.values(preferences).some(Boolean);

  const handleEnable = async () => {
    const ok = await requestPermission();
    if (ok) {
      await showLocalNotification(
        isEn ? "Muğla Monitor" : "Muğla Monitör",
        isEn
          ? "Notifications enabled! You will receive earthquake, fire, and crisis alerts."
          : "Bildirimler aktif! Deprem, yangın ve kriz uyarılarını alacaksınız.",
        { tag: "onboarding", severity: "info" }
      );
    }
  };

  const prefLabels: Record<keyof NotificationPreferences, { label: string; emoji: string }> = {
    earthquake: { label: t("notif.earthquake", "Deprem Uyarıları (M3+)"), emoji: "🔴" },
    fire_risk: { label: t("notif.fire", "Yüksek Yangın Riski"), emoji: "🔥" },
    flood_warning: { label: t("notif.flood", "Sel / Taşkın Uyarısı"), emoji: "🌊" },
    social_crisis: { label: t("notif.social", "Sosyal Medya Krizi"), emoji: "📡" },
    daily_brief: { label: t("notif.daily", "Günlük Özet (08:00)"), emoji: "📰" },
  };

  const bellLabel = isGranted
    ? t("notif.title", "Bildirim Tercihleri")
    : t("notif.enable", "Bildirimleri Etkinleştir");
  const selectedCount = Object.values(preferences).filter(Boolean).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={bellLabel}
        title={bellLabel}
        className={`relative p-1.5 rounded-md border border-border/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          open ? "bg-muted/50 text-foreground" : "bg-muted/15 hover:bg-muted/35 text-muted-foreground"
        }`}
      >
        {isDenied ? (
          <BellOff size={14} className="text-muted-foreground/50" aria-hidden="true" />
        ) : hasActive ? (
          <>
            <BellRing size={14} className="text-primary" aria-hidden="true" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </>
        ) : (
          <Bell size={14} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("notif.title", "Bildirim Tercihleri")}
          className="absolute top-full right-0 mt-1.5 w-64 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/20">
            <span className="text-[11px] font-mono font-bold text-foreground">
              {t("notif.title", "Bildirim Tercihleri")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={isEn ? "Close notification preferences" : "Bildirim tercihlerini kapat"}
              className="p-0.5 rounded hover:text-foreground text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>

          <div className="p-2.5 space-y-1">
            {!isGranted ? (
              isDenied ? (
                <div className="text-[10px] font-mono text-muted-foreground text-center py-4">
                  <BellOff size={20} className="mx-auto mb-2 opacity-40" aria-hidden="true" />
                  {isEn
                    ? "Enable notifications in your browser settings."
                    : "Tarayıcı ayarlarından bildirimleri etkinleştirin."}
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-[10px] font-mono text-muted-foreground mb-3">
                    {isEn
                      ? "Allow browser alerts for earthquakes, fires, and emergencies."
                      : "Deprem, yangın ve kriz bildirimlerini almak için izin verin."}
                  </p>
                  <button
                    type="button"
                    onClick={handleEnable}
                    className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded bg-primary/20 text-primary text-[10px] font-mono font-bold hover:bg-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Bell size={12} aria-hidden="true" /> {t("notif.enable", "Bildirimleri Etkinleştir")}
                  </button>
                </div>
              )
            ) : (
              <>
                <p className="text-[9px] font-mono text-muted-foreground mb-2">
                  {isEn ? "Choose which alerts to receive:" : "Hangi uyarıları almak istediğinizi seçin:"}
                </p>
                {(
                  Object.entries(prefLabels) as [
                    keyof NotificationPreferences,
                    (typeof prefLabels)[keyof NotificationPreferences]
                  ][]
                ).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    role="switch"
                    aria-checked={preferences[key]}
                    aria-label={cfg.label}
                    onClick={() => updatePreferences({ [key]: !preferences[key] })}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div
                      className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 flex items-center ${
                        preferences[key] ? "bg-primary/60" : "bg-muted/40"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${
                          preferences[key] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-mono flex-1">
                      <span aria-hidden="true">{cfg.emoji}</span> {cfg.label}
                    </span>
                  </button>
                ))}
                <div className="pt-1 border-t border-border mt-2">
                  <p className="text-[9px] font-mono text-muted-foreground text-center">
                    {isEn
                      ? `${selectedCount} preferences enabled`
                      : `${selectedCount} tercih seçili`}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
