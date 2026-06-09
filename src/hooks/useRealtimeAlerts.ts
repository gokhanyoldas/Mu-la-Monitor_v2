// useRealtimeAlerts.ts
// Supabase Realtime WebSocket subscription for critical events.
// Replaces 5-minute polling for deprem/yangın/kriz channels with instant push.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const channelRef = useRef<RealtimeChannel | null>(null);

  const addAlert = useCallback((alert: RealtimeAlert) => {
    if (SEVERITY_ORDER[alert.severity] < SEVERITY_ORDER[minSeverity]) return;
    setAlerts((prev) => {
      const deduped = prev.filter((a) => a.id !== alert.id);
      return [alert, ...deduped].slice(0, maxAlerts);
    });
    if (alert.severity === "critical") onCritical?.(alert);
  }, [minSeverity, maxAlerts, onCritical]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  const clearDismissed = useCallback(() => {
    setAlerts((prev) => prev.filter((a) => !a.dismissed));
  }, []);

  useEffect(() => {
    const channel = supabase.channel("mugla-critical-alerts", {
      config: { broadcast: { ack: false } },
    });

    channel
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "social_analyses", filter: "sentiment=eq.critical",
      }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        addAlert({
          id: `social_${row.id ?? Date.now()}`,
          type: "social", severity: "critical",
          title: String(row.title ?? "Kritik Sosyal Medya Uyarısı"),
          body: String(row.summary ?? row.content ?? ""),
          source: String(row.source ?? "Sosyal Medya"),
          timestamp: String(row.created_at ?? new Date().toISOString()),
        });
      })
      .on("broadcast", { event: "earthquake_alert" }, ({ payload }) => {
        const p = payload as Record<string, unknown>;
        addAlert({
          id: `eq_${p.eventId ?? Date.now()}`,
          type: "earthquake",
          severity: Number(p.magnitude) >= 5 ? "critical" : "high",
          title: `M${p.magnitude} Deprem — ${p.location}`,
          body: `Derinlik: ${p.depth}km`,
          source: "AFAD / USGS",
          timestamp: String(p.time ?? new Date().toISOString()),
          lat: Number(p.lat), lon: Number(p.lon),
        });
      })
      .on("broadcast", { event: "fire_alert" }, ({ payload }) => {
        const p = payload as Record<string, unknown>;
        addAlert({
          id: `fire_${p.id ?? Date.now()}`,
          type: "fire",
          severity: String(p.level) === "extreme" ? "critical" : "high",
          title: `Yangın Uyarısı — ${p.district ?? "Muğla"}`,
          body: String(p.message ?? ""),
          source: "OGM / Orman Genel Müdürlüğü",
          timestamp: String(p.timestamp ?? new Date().toISOString()),
        });
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); setIsConnected(false); };
  }, [addAlert]);

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  return {
    alerts: activeAlerts, allAlerts: alerts, isConnected,
    dismissAlert, clearDismissed,
    criticalCount: activeAlerts.filter((a) => a.severity === "critical").length,
  };
}
