// useRealtimeAlerts.ts
// Supabase Realtime WebSocket subscription for critical events.
// Replaces 5-minute polling for deprem/yangın/kriz channels with instant push.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import {
  subscribeToRealtimeTable,
  subscribeToRealtimeBroadcast,
  subscribeToRealtimeStatus,
} from "@/lib/supabase-realtime-singleton";

export type AlertSeverity = "critical" | "high" | "medium" | "info";

export interface RealtimeAlert {
  id: string;
  type: "earthquake" | "fire" | "flood" | "crisis" | "social" | "system";
  severity: AlertSeverity;
  title: string;
  body: string;
  source: string;
  timestamp: string;
  lat?: number;
  lon?: number;
  dismissed?: boolean;
}

interface UseRealtimeAlertsOptions {
  minSeverity?: AlertSeverity;
  maxAlerts?: number;
  onCritical?: (alert: RealtimeAlert) => void;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 4, high: 3, medium: 2, info: 1,
};

export function useRealtimeAlerts(options: UseRealtimeAlertsOptions = {}) {
  const { minSeverity = "high", maxAlerts = 50, onCritical } = options;
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addAlert = useCallback((alert: RealtimeAlert) => {
    if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[minSeverity]) return;
    setAlerts((prev) => {
      const deduped = prev.filter((a) => a.id !== alert.id);
      return [alert, ...deduped].slice(0, maxAlerts);
    });
    if (alert.severity === "critical") onCritical?.(alert);
  }, [minSeverity, maxAlerts, onCritical]);

  const addAlertRef = useRef(addAlert);
  addAlertRef.current = addAlert;

  const dismissAlert = useCallback((id: string) => {
    // Kapatılan uyarılar localStorage'da kalıcı — yenilemede geri gelmez
    try {
      const dismissed = JSON.parse(localStorage.getItem("rta_dismissed") ?? "[]") as string[];
      localStorage.setItem("rta_dismissed", JSON.stringify([...new Set([...dismissed, id])].slice(-200)));
    } catch { /* storage doluysa sessiz geç */ }
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  const clearDismissed = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.dismissed));
  }, []);

  useEffect(() => {
    if (!isSupabaseClientConfigured) return;
    // Recent alert history — the feed shouldn't start empty on first paint.
    // Demo Veri kaynaklı uyarılar history'de gösterilmez (kullanıcı tercihi).
    supabase
      .from("alert_events")
      .select("*")
      .neq("source", "Demo Veri")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        let dismissed: string[] = [];
        try { dismissed = JSON.parse(localStorage.getItem("rta_dismissed") ?? "[]"); } catch { /* yoksay */ }
        data?.forEach((row: Record<string, unknown>) => {
          if (dismissed.includes(`evt_${row.id}`)) return; // kullanıcı bunu kapatmıştı
          addAlertRef.current({
            id: `evt_${row.id}`,
            type: (row.type as RealtimeAlert["type"]) ?? "system",
            severity: (row.severity as AlertSeverity) ?? "high",
            title: String(row.title ?? "Uyarı"),
            body: String(row.body ?? ""),
            source: String(row.source ?? "Sistem"),
            timestamp: String(row.created_at ?? new Date().toISOString()),
            lat: row.lat != null ? Number(row.lat) : undefined,
            lon: row.lon != null ? Number(row.lon) : undefined,
          });
        });
      });

    // Tekil singleton kanal üzerinden dinle; state değişiminde yeni soket join yapılmaz.
    const unsubAlertEvents = subscribeToRealtimeTable("alert_events", (payload) => {
      const row = (payload.new ?? {}) as Record<string, unknown>;
      if (row.source === "Demo Veri") return; // demo uyarılar gerçek akışı kirletmez
      addAlertRef.current({
        id: `evt_${row.id ?? Date.now()}`,
        type: (row.type as RealtimeAlert["type"]) ?? "system",
        severity: (row.severity as AlertSeverity) ?? "high",
        title: String(row.title ?? "Uyarı"),
        body: String(row.body ?? ""),
        source: String(row.source ?? "Sistem"),
        timestamp: String(row.created_at ?? new Date().toISOString()),
        lat: row.lat != null ? Number(row.lat) : undefined,
        lon: row.lon != null ? Number(row.lon) : undefined,
      });
    });

    const unsubSocialPosts = subscribeToRealtimeTable("social_posts", (payload) => {
      const row = (payload.new ?? {}) as Record<string, unknown>;
      if (row.sentiment !== "negative") return;
      addAlertRef.current({
        id: `social_${row.id ?? Date.now()}`,
        type: "social",
        severity: "high",
        title: String(row.author ? `${row.author} — Sosyal Medya Bildirimi` : "Kritik Sosyal Medya Uyarısı"),
        body: String(row.content ?? ""),
        source: String(row.platform ? `Sosyal (${row.platform})` : "Sosyal Medya"),
        timestamp: String(row.published_at ?? row.created_at ?? new Date().toISOString()),
      });
    });

    const unsubQuakeBroadcast = subscribeToRealtimeBroadcast("earthquake_alert", ({ payload }) => {
      const p = payload ?? {};
      addAlertRef.current({
        id: `eq_${p.eventId ?? Date.now()}`,
        type: "earthquake",
        severity: Number(p.magnitude) >= 5 ? "critical" : "high",
        title: `M${p.magnitude} Deprem — ${p.location}`,
        body: `Derinlik: ${p.depth}km`,
        source: "AFAD / USGS",
        timestamp: String(p.time ?? new Date().toISOString()),
        lat: Number(p.lat),
        lon: Number(p.lon),
      });
    });

    const unsubFireBroadcast = subscribeToRealtimeBroadcast("fire_alert", ({ payload }) => {
      const p = payload ?? {};
      addAlertRef.current({
        id: `fire_${p.id ?? Date.now()}`,
        type: "fire",
        severity: String(p.level) === "extreme" ? "critical" : "high",
        title: `Yangın Uyarısı — ${p.district ?? "Muğla"}`,
        body: String(p.message ?? ""),
        source: "OGM / Orman Genel Müdürlüğü",
        timestamp: String(p.timestamp ?? new Date().toISOString()),
      });
    });

    const unsubStatus = subscribeToRealtimeStatus(setIsConnected);

    return () => {
      unsubAlertEvents();
      unsubSocialPosts();
      unsubQuakeBroadcast();
      unsubFireBroadcast();
      unsubStatus();
      setIsConnected(false);
    };
  }, []);

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  return {
    alerts: activeAlerts, allAlerts: alerts, isConnected,
    dismissAlert, clearDismissed,
    criticalCount: activeAlerts.filter((a) => a.severity === "critical").length,
  };
}
