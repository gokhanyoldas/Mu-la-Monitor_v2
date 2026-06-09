// M4: Bildirim Zil Butonu + Tercihler Paneli (Header'a eklenir)
import { useState, useRef, useEffect } from "react";
import { Bell, BellOff, BellRing, X, Check } from "lucide-react";
import { useNotifications, type NotificationPreferences } from "@/hooks/useNotifications";

const PREF_LABELS: Record<keyof NotificationPreferences, { label: string; emoji: string }> = {
  earthquake:    { label: "Deprem Uyarıları (M3+)",   emoji: "🔴" },
  fire_risk:     { label: "Yüksek Yangın Riski",       emoji: "🔥" },
  flood_warning: { label: "Sel / Taşkın Uyarısı",     emoji: "🌊" },
  social_crisis: { label: "Sosyal Medya Krizi",        emoji: "📡" },
  daily_brief:   { label: "Günlük Özet (08:00)",       emoji: "📰" },
};

export const NotificationBell = () => {
  const {
    isSupported, permission, preferences,
    requestPermission, updatePreferences, showLocalNotification,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!isSupported) return null;

  const isGranted = permission === "granted";
  const isDenied  = permission === "denied";
  const hasActive = isGranted && Object.values(preferences).some(Boolean);

  const handleEnable = async () => {
    const ok = await requestPermission();
    if (ok) {
      await showLocalNotification("Muğla Monitör", "Bildirimler aktif! Deprem, yangın ve kriz uyarılarını alacaksınız.", {
        tag: "onboarding", severity: "info",
      });
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative p-1.5 rounded transition-colors ${
          open ? "bg-muted/50" : "hover:bg-muted/30"
        }`}
        title={isGranted ? "Bildirim tercihleri" : "Bildirimleri etkinleştir"}
      >
        {isDenied ? (
          <BellOff size={14} className="text-muted-foreground/50" />
        ) : hasActive ? (
          <>
            <BellRing size={14} className="text-primary" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </>
        ) : (
          <Bell size={14} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-64 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/20">
            <span className="text-[11px] font-mono font-bold text-foreground">Bildirim Tercihleri</span>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:text-foreground text-muted-foreground">
              <X size={12} />
            </button>
          </div>

          <div className="p-2.5 space-y-1">
            {!isGranted ? (
              isDenied ? (
                <div className="text-[10px] font-mono text-muted-foreground text-center py-4">
                  <BellOff size={20} className="mx-auto mb-2 opacity-40" />
                  Tarayıcı ayarlarından bildirimleri etkinleştirin.
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-[10px] font-mono text-muted-foreground mb-3">
                    Deprem, yangın ve kriz bildirimlerini almak için izin verin.
                  </p>
                  <button
                    onClick={handleEnable}
                    className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded bg-primary/20 text-primary text-[10px] font-mono font-bold hover:bg-primary/30 transition-colors"
                  >
                    <Bell size={12} /> Bildirimleri Etkinleştir
                  </button>
                </div>
              )
            ) : (
              <>
                <p className="text-[9px] font-mono text-muted-foreground mb-2">
                  Hangi uyarıları almak istediğinizi seçin:
                </p>
                {(Object.entries(PREF_LABELS) as [keyof NotificationPreferences, typeof PREF_LABELS[keyof NotificationPreferences]][]).map(
                  ([key, cfg]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer group"
                    >
                      <div
                        onClick={() => updatePreferences({ [key]: !preferences[key] })}
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
                        {cfg.emoji} {cfg.label}
                      </span>
                    </label>
                  )
                )}
                <div className="pt-1 border-t border-border mt-2">
                  <p className="text-[8px] font-mono text-muted-foreground text-center">
                    ✅ Bildirimler aktif · {Object.values(preferences).filter(Boolean).length} tercih seçili
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
