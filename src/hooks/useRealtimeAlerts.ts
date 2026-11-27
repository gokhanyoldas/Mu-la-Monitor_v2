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

export type RealtimeAlertType =
  | "earthquake"
  | "fire"
  | "flood"
  | "crisis"
  | "social"
  | "energy"
  | "security"
  | "transport"
  | "environment"
  | "system";

export interface RealtimeAlert {
  id: string;
  type: RealtimeAlertType;
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
  critical: 4,
  high: 3,
  medium: 2,
  info: 1,
};

function normalizeKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export function normalizeAlertSeverity(raw: unknown): AlertSeverity {
  const key = normalizeKey(raw);
  if (key === "critical" || key === "kritik" || key === "urgent" || key === "acil" || key === "extreme") {
    return "critical";
  }
  if (key === "high" || key === "yuksek" || key === "severe" || key === "error") {
    return "high";
  }
  if (key === "medium" || key === "orta" || key === "warning" || key === "warn" || key === "moderate") {
    return "medium";
  }
  if (key === "info" || key === "low" || key === "dusuk" || key === "normal") {
    return "info";
  }
  return "high";
}

export function normalizeAlertType(raw: unknown): RealtimeAlertType {
  const key = normalizeKey(raw);
  if (!key) return "system";
  if (key === "earthquake" || key.includes("deprem") || key.includes("quake") || key.includes("sismik")) {
    return "earthquake";
  }
  if (key === "fire" || key.includes("yangin") || key.includes("orman")) {
    return "fire";
  }
  if (key === "flood" || key.includes("sel") || key.includes("taskin") || key.includes("firtina")) {
    return "flood";
  }
  if (key === "energy" || key.includes("enerji") || key.includes("elektrik") || key.includes("kesinti") || key.includes("adm")) {
    return "energy";
  }
  if (key === "security" || key.includes("guvenlik") || key.includes("asayis") || key.includes("emniyet") || key.includes("jandarma")) {
    return "security";
  }
  if (key === "transport" || key.includes("ulasim") || key.includes("trafik") || key.includes("yol") || key.includes("altyapi")) {
    return "transport";
  }
  if (key === "environment" || key.includes("cevre") || key.includes("baraj") || key.includes("muski") || key.includes("su")) {
    return "environment";
  }
  if (key === "crisis" || key.includes("kriz") || key.includes("acil") || key.includes("anomali")) {
    return "crisis";
  }
  if (key === "social" || key.includes("sosyal") || key.includes("kamuoyu")) {
    return "social";
  }
  return "system";
}

function readDismissedAlertIds(): string[] {
  try {
    const raw = localStorage.getItem("rta_dismissed");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function toSafeRealtimeAlert(row: Record<string, unknown>, fallbackId: string): RealtimeAlert {
  const rawLat = row.lat != null ? Number(row.lat) : undefined;
  const rawLon = row.lon != null ? Number(row.lon) : undefined;
  return {
    id: `evt_${row.id ?? fallbackId}`,
    type: normalizeAlertType(row.type ?? row.category),
    severity: normalizeAlertSeverity(row.severity),
    title: String(row.title ?? "Uyarı"),
    body: String(row.body ?? row.description ?? ""),
    source: String(row.source ?? "Sistem"),
    timestamp: String(row.created_at ?? new Date().toISOString()),
    lat: rawLat !== undefined && Number.isFinite(rawLat) ? rawLat : undefined,
    lon: rawLon !== undefined && Number.isFinite(rawLon) ? rawLon : undefined,
  };
}

export function useRealtimeAlerts(options: UseRealtimeAlertsOptions = {}) {
  const { minSeverity = "high", maxAlerts = 50, onCritical } = options;
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addAlert = useCallback((alert: RealtimeAlert) => {
    const safeSeverity = normalizeAlertSeverity(alert?.severity);
    const safeType = normalizeAlertType(alert?.type);
    const normalizedMin = normalizeAlertSeverity(minSeverity);
    const alertRank = SEVERITY_ORDER[safeSeverity] ?? SEVERITY_ORDER.info;
    const minRank = SEVERITY_ORDER[normalizedMin] ?? SEVERITY_ORDER.high;
    if (alertRank < minRank) return;

    const safeAlert: RealtimeAlert = {
      ...alert,
      id: String(alert?.id || `alert_${Date.now()}`),
      type: safeType,
      severity: safeSeverity,
      title: String(alert?.title ?? "Uyarı"),
      body: String(alert?.body ?? ""),
      source: String(alert?.source ?? "Sistem"),
      timestamp: String(alert?.timestamp ?? new Date().toISOString()),
    };

    setAlerts((prev) => {
      const deduped = prev.filter((a) => a.id !== safeAlert.id);
      return [safeAlert, ...deduped].slice(0, maxAlerts);
    });
    if (safeSeverity === "critical") onCritical?.(safeAlert);
  }, [minSeverity, maxAlerts, onCritical]);

  const addAlertRef = useRef(addAlert);
  addAlertRef.current = addAlert;

  const dismissAlert = useCallback((id: string) => {
    // Kapatılan uyarılar localStorage'da kalıcı — yenilemede geri gelmez
    try {
      const dismissed = readDismissedAlertIds();
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
    try {
      const query = supabase
        .from("alert_events")
        .select("*")
        .neq("source", "Demo Veri")
        .order("created_at", { ascending: false })
        .limit(20);

      Promise.resolve(query)
        .then((res) => {
          const data = res?.data;
          if (!Array.isArray(data)) return;
          const dismissed = readDismissedAlertIds();
          data.forEach((rawRow, idx) => {
            try {
              if (!rawRow || typeof rawRow !== "object") return;
              const row = rawRow as Record<string, unknown>;
              const alertId = `evt_${row.id ?? idx}`;
              if (dismissed.includes(alertId)) return; // kullanıcı bunu kapatmıştı
              addAlertRef.current(toSafeRealtimeAlert(row, String(idx)));
            } catch {
              /* bozuk satırı sessizce atla */
            }
          });
        })
        .catch(() => {
          /* ağ / sorgu hatasında sessizce devam et */
        });
    } catch {
      /* istemci hazır değilse sessizce devam et */
    }

    // Tekil singleton kanal üzerinden dinle; state değişiminde yeni soket join yapılmaz.
    const unsubAlertEvents = subscribeToRealtimeTable("alert_events", (payload) => {
      try {
        const row = (payload?.new ?? {}) as Record<string, unknown>;
        if (!row || typeof row !== "object") return;
        if (row.source === "Demo Veri") return; // demo uyarılar gerçek akışı kirletmez
        addAlertRef.current(toSafeRealtimeAlert(row, String(Date.now())));
      } catch {
        /* bozuk payload'ı sessizce atla */
      }
    });

    const unsubSocialPosts = subscribeToRealtimeTable("social_posts", (payload) => {
      try {
        const row = (payload?.new ?? {}) as Record<string, unknown>;
        if (!row || typeof row !== "object") return;
        if (normalizeKey(row.sentiment) !== "negative") return;
        addAlertRef.current({
          id: `social_${row.id ?? Date.now()}`,
          type: "social",
          severity: "high",
          title: String(row.author ? `${row.author} — Sosyal Medya Bildirimi` : "Kritik Sosyal Medya Uyarısı"),
          body: String(row.content ?? ""),
          source: String(row.platform ? `Sosyal (${row.platform})` : "Sosyal Medya"),
          timestamp: String(row.published_at ?? row.created_at ?? new Date().toISOString()),
        });
      } catch {
        /* bozuk payload'ı sessizce atla */
      }
    });

    const unsubQuakeBroadcast = subscribeToRealtimeBroadcast("earthquake_alert", ({ payload }) => {
      try {
        const p = payload ?? {};
        addAlertRef.current({
          id: `eq_${p.eventId ?? Date.now()}`,
          type: "earthquake",
          severity: Number(p.magnitude) >= 5 ? "critical" : "high",
          title: `M${p.magnitude ?? "?"} Deprem — ${p.location ?? "Muğla"}`,
          body: `Derinlik: ${p.depth ?? "?"}km`,
          source: "AFAD / USGS",
          timestamp: String(p.time ?? new Date().toISOString()),
          lat: Number.isFinite(Number(p.lat)) ? Number(p.lat) : undefined,
          lon: Number.isFinite(Number(p.lon)) ? Number(p.lon) : undefined,
        });
      } catch {
        /* sessiz geç */
      }
    });

    const unsubFireBroadcast = subscribeToRealtimeBroadcast("fire_alert", ({ payload }) => {
      try {
        const p = payload ?? {};
        addAlertRef.current({
          id: `fire_${p.id ?? Date.now()}`,
          type: "fire",
          severity: normalizeKey(p.level) === "extreme" ? "critical" : "high",
          title: `Yangın Uyarısı — ${p.district ?? "Muğla"}`,
          body: String(p.message ?? ""),
          source: "OGM / Orman Genel Müdürlüğü",
          timestamp: String(p.timestamp ?? new Date().toISOString()),
        });
      } catch {
        /* sessiz geç */
      }
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
