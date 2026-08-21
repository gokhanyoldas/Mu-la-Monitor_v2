// LiveIncidentMap — Leaflet + OSM üzerinde canlı olay yoğunluğu.
// Pin clustering (markercluster) + dinamik heatmap (leaflet.heat) katmanları;
// social_posts'tan gelen NLP-etiketli olayları ve alert_events'i çizer.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.heat";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { Layers, Flame, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const MUGLA_CENTER: [number, number] = [37.05, 28.25];

const CATEGORY_COLORS: Record<string, string> = {
  fire_disaster: "#ef4444",
  infrastructure_transport: "#f59e0b",
  tourism: "#22d3ee",
  governance: "#a78bfa",
  general: "#94a3b8",
};

const CATEGORY_LABELS: Record<string, string> = {
  fire_disaster: "Yangın/Afet",
  infrastructure_transport: "Altyapı/Ulaşım",
  tourism: "Turizm",
  governance: "Yönetim",
  general: "Genel",
};

interface IncidentPoint {
  id: string;
  lat: number;
  lon: number;
  category: string;
  district: string | null;
  sentiment: string | null;
  content: string;
  platform: string;
  published_at: string;
}

type LayerMode = "cluster" | "heat" | "both";

function useIncidentPoints(districtFilter: string | null) {
  return useQuery({
    queryKey: ["incident-points", districtFilter],
    queryFn: async (): Promise<IncidentPoint[]> => {
      let q = supabase
        .from("social_posts")
        .select("id, lat, lon, category, district, sentiment, content, platform, published_at")
        .not("lat", "is", null)
        .not("lon", "is", null)
        .gte("published_at", new Date(Date.now() - 24 * 3600e3).toISOString())
        .order("published_at", { ascending: false })
        .limit(500);
      if (districtFilter) q = q.eq("district", districtFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as IncidentPoint[];
    },
    refetchInterval: 60e3,
    staleTime: 30e3,
  });
}

const markerIcon = (category: string, sentiment: string | null) => {
  const base = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general;
  const ring = sentiment === "negative" ? "#ef4444" : sentiment === "positive" ? "#22c55e" : base;
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${base};border:2.5px solid ${ring};box-shadow:0 0 6px ${base}80"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

export function LiveIncidentMap({ districtFilter = null, className }: { districtFilter?: string | null; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const [mode, setMode] = useState<LayerMode>("both");
  const { data: points } = useIncidentPoints(districtFilter);
  const { alerts } = useRealtimeAlerts({ minSeverity: "high" });

  // Haritayı bir kez kur
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: MUGLA_CENTER,
      zoom: 9,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Katmanları güncelle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !points) return;

    // Eski katmanları temizle
    if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null; }
    if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }

    const showCluster = mode !== "heat";
    const showHeat = mode !== "cluster";

    if (showHeat && points.length > 0) {
      const heatPoints = points.map(p => {
        const intensity = p.sentiment === "negative" ? 1.0 : p.category === "fire_disaster" ? 0.9 : 0.5;
        return [p.lat, p.lon, intensity] as [number, number, number];
      });
      // @ts-expect-error — leaflet.heat L.heatLayer ekler
      heatRef.current = L.heatLayer(heatPoints, {
        radius: 28, blur: 22, maxZoom: 12, minOpacity: 0.25,
        gradient: { 0.2: "#22d3ee", 0.5: "#f59e0b", 0.8: "#ef4444", 1.0: "#dc2626" },
      }).addTo(map);
    }

    if (showCluster) {
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 48,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (c) => {
          const n = c.getChildCount();
          const size = n < 10 ? 34 : n < 50 ? 42 : 50;
          const color = n < 10 ? "#2563eb" : n < 50 ? "#f59e0b" : "#ef4444";
          return L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}cc;border:2px solid ${color};color:#fff;display:flex;align-items:center;justify-content:center;font:700 12px/1 ui-monospace,monospace;box-shadow:0 0 12px ${color}60">${n}</div>`,
            className: "",
            iconSize: [size, size],
          });
        },
      });

      for (const p of points) {
        const marker = L.marker([p.lat, p.lon], { icon: markerIcon(p.category, p.sentiment) });
        const sentLabel = p.sentiment === "negative" ? "🔴 Olumsuz" : p.sentiment === "positive" ? "🟢 Olumlu" : "⚪ Nötr";
        marker.bindPopup(`
          <div style="font:12px/1.5 system-ui;max-width:260px">
            <div style="font-weight:700;margin-bottom:4px">${CATEGORY_LABELS[p.category] ?? "Genel"} — ${p.district ?? "Muğla"}</div>
            <div style="opacity:.8">${(p.content ?? "").slice(0, 180)}${(p.content ?? "").length > 180 ? "…" : ""}</div>
            <div style="margin-top:6px;font-size:10px;opacity:.6">${sentLabel} · ${p.platform} · ${new Date(p.published_at).toLocaleString("tr-TR")}</div>
          </div>`);
        cluster.addLayer(marker);
      }

      // Kritik Realtime uyarıları (koordinatlı olanlar)
      for (const a of alerts) {
        if (a.lat == null || a.lon == null) continue;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 0 14px #dc2626;animation:pulse 1.2s infinite"></div>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        });
        L.marker([a.lat, a.lon], { icon, zIndexOffset: 1000 })
          .bindPopup(`<b style="font:700 12px system-ui">${a.title}</b><br/><span style="font:11px system-ui">${a.body ?? ""}</span>`)
          .addTo(cluster);
      }

      cluster.addTo(map);
      clusterRef.current = cluster;
    }
  }, [points, alerts, mode]);

  const negativeCount = useMemo(() => (points ?? []).filter(p => p.sentiment === "negative").length, [points]);

  return (
    <div className={cn("relative w-full rounded-xl overflow-hidden border border-border/40 bg-card", className)}>
      {/* Katman geçiş çubuğu */}
      <div className="absolute top-3 right-3 z-[1000] flex gap-1 bg-background/90 backdrop-blur border border-border/50 rounded-lg p-1">
        {([
          { key: "cluster" as const, icon: MapPin, label: "Küme" },
          { key: "heat" as const, icon: Flame, label: "Isı" },
          { key: "both" as const, icon: Layers, label: "İkisi" },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-mono transition-colors",
              mode === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      {/* Canlı sayaç */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur border border-border/50 rounded-lg px-3 py-2 flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {points?.length ?? 0} olay / 24 sa
        </span>
        <span className="text-[10px] font-mono text-red-400">{negativeCount} olumsuz</span>
      </div>

      <div ref={containerRef} className="w-full h-[420px]" />
    </div>
  );
}
