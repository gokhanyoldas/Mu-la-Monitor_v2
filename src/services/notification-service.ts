// Push notification helper for critical alerts
// Uses the native Notification API + Service Worker

export type AlertSeverity = "info" | "warning" | "critical";

interface PushAlert {
  title: string;
  body: string;
  severity: AlertSeverity;
  tag?: string;
  url?: string;
}

class NotificationService {
  private permission: NotificationPermission = "default";
  private swRegistration: ServiceWorkerRegistration | null = null;

  async init() {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      return false;
    }

    this.permission = Notification.permission;

    // Register service worker (not supported on StackBlitz/bolt.new — silently skip)
    if ("serviceWorker" in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register("/sw.js");
        console.log("SW registered for notifications");
      } catch (e) {
        // Service Workers are not available in WebContainer/bolt.new environments.
        // Notifications will still work via Notification API without a SW.
        console.debug("SW not available in this environment:", (e as Error).message);
      }
    }

    return this.permission === "granted";
  }

  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) return false;
    
    const result = await Notification.requestPermission();
    this.permission = result;
    return result === "granted";
  }

  isEnabled(): boolean {
    return this.permission === "granted";
  }

  async sendAlert(alert: PushAlert) {
    if (this.permission !== "granted") {
      // Try to request
      const granted = await this.requestPermission();
      if (!granted) return;
    }

    const options: NotificationOptions = {
      body: alert.body,
      icon: "/icons/icon-192.png",
      tag: alert.tag || `alert-${Date.now()}`,
      requireInteraction: alert.severity === "critical",
      silent: alert.severity === "info",
    };

    if (this.swRegistration) {
      // Use SW for better lifecycle management
      await this.swRegistration.showNotification(alert.title, {
        ...options,
        vibrate: alert.severity === "critical" ? [500, 200, 500] : [200],
        data: { url: alert.url || "/" },
        actions: [
          { action: "open", title: "Detay" },
          { action: "dismiss", title: "Kapat" },
        ],
      });
    } else {
      // Fallback to basic Notification
      new Notification(alert.title, options);
    }
  }

  // Auto-check critical keywords and trigger notification
  checkAndAlert(content: string, platform: string): PushAlert | null {
    const criticalPatterns = [
      { keywords: ["deprem", "earthquake"], title: "🚨 Deprem Uyarısı", severity: "critical" as AlertSeverity },
      { keywords: ["yangın", "orman yangını", "fire"], title: "🔥 Yangın Uyarısı", severity: "critical" as AlertSeverity },
      { keywords: ["sel", "taşkın", "flood"], title: "🌊 Sel Uyarısı", severity: "critical" as AlertSeverity },
      { keywords: ["tsunami"], title: "🌊 Tsunami Uyarısı", severity: "critical" as AlertSeverity },
      { keywords: ["patlama", "bomba", "terör"], title: "⚠️ Güvenlik Uyarısı", severity: "critical" as AlertSeverity },
      { keywords: ["kaza", "trafik kazası"], title: "🚗 Kaza Bildirimi", severity: "warning" as AlertSeverity },
      { keywords: ["kesinti", "elektrik kesintisi", "su kesintisi"], title: "⚡ Kesinti Bildirimi", severity: "warning" as AlertSeverity },
    ];

    const lower = content.toLowerCase();
    
    for (const pattern of criticalPatterns) {
      if (pattern.keywords.some(kw => lower.includes(kw))) {
        return {
          title: pattern.title,
          body: `${platform.toUpperCase()}: ${content.slice(0, 100)}...`,
          severity: pattern.severity,
          tag: `${pattern.keywords[0]}-${Date.now()}`,
          url: "/sosyal-istihbarat",
        };
      }
    }

    return null;
  }
}

export const notificationService = new NotificationService();
