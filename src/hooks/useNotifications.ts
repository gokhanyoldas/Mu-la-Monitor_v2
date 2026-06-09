// M4: Push Bildirim Sistemi — useNotifications hook
// Service Worker + Push API (tarayıcı tabanlı, ücretsiz)
import { useState, useEffect, useCallback } from "react";

export type NotificationPermission = "granted" | "denied" | "default" | "unsupported";

export interface NotificationPreferences {
  earthquake: boolean;    // M3+ depremler
  fire_risk: boolean;     // Yüksek yangın riski
  flood_warning: boolean; // Sel uyarısı
  social_crisis: boolean; // Sosyal medya kriz tespiti
  daily_brief: boolean;   // Günlük özet (08:00)
}

const DEFAULT_PREFS: NotificationPreferences = {
  earthquake: true,
  fire_risk: true,
  flood_warning: true,
  social_crisis: false,
  daily_brief: false,
};

const PREFS_KEY = "mugla-notification-prefs";
const SW_PATH = "/sw.js";

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch { return DEFAULT_PREFS; }
  });

  useEffect(() => {
    const supported = "Notification" in window && "serviceWorker" in navigator;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  // Register SW
  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then(reg => {
      setSwRegistration(reg);
    }).catch(() => {
      // SW not yet registered — try
      navigator.serviceWorker.register(SW_PATH).then(reg => {
        setSwRegistration(reg);
      }).catch(console.warn);
    });
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermission);
    return result === "granted";
  }, [isSupported]);

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...prefs };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Local notification trigger (for testing / on-device alerts without push server)
  const showLocalNotification = useCallback(async (
    title: string,
    body: string,
    options?: { tag?: string; severity?: "info" | "warning" | "critical"; url?: string }
  ) => {
    if (permission !== "granted") return;
    if (swRegistration) {
      await swRegistration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        tag: options?.tag ?? "mugla-alert",
        requireInteraction: options?.severity === "critical",
        vibrate: options?.severity === "critical" ? [500, 200, 500] : [200, 100, 200],
        data: { url: options?.url ?? "/" },
      });
    } else {
      new Notification(title, { body, icon: "/favicon.ico" });
    }
  }, [permission, swRegistration]);

  return {
    isSupported,
    permission,
    swRegistration,
    preferences,
    requestPermission,
    updatePreferences,
    showLocalNotification,
  };
};
