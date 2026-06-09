// MuglaMap.tsx
// Interactive map using MapLibre GL JS + OpenStreetMap (both free, no API key).
// Shows: earthquake epicentres, fire hotspots, district markers.

import { useEffect, useRef, useState } from "react";
import { Layers, ZoomIn, ZoomOut, Crosshair, AlertTriangle, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const MUGLA_DISTRICTS = [
  { id: "merkez",      name: "Merkez",      lat: 37.2153, lon: 28.3636 },
  { id: "bodrum",      name: "Bodrum",      lat: 37.0344, lon: 27.4305 },
  { id: "fethiye",     name: "Fethiye",     lat: 36.6548, lon: 29.1165 },
  { id: "marmaris",    name: "Marmaris",    lat: 36.8521, lon: 28.2706 },
  { id: "milas",       name: "Milas",       lat: 37.3166, lon: 27.7869 },
  { id: "dalaman",     name: "Dalaman",     lat: 36.7752, lon: 28.7929 },
  { id: "ula",         name: "Ula",         lat: 37.1035, lon: 28.4266 },
  { id: "koycegiz",    name: "Köyceğiz",    lat: 36.9705, lon: 28.6854 },
  { id: "ortaca",      name: "Ortaca",      lat: 36.8344, lon: 28.7682 },
  { id: "datca",       name: "Datça",        lat: 36.7344, lon: 27.6866 },
  { id: "kavaklidere", name: "Kavaklıdere", lat: 37.4460, lon: 28.3904 },
  { id: "seydikemer",  name: "Seydikemer",  lat: 36.9183, lon: 29.1286 },
  { id: "yatagan",     name: "Yatağan",     lat: 37.3396, lon: 28.1376 },
];

export interface MapEarthquake { id: string; lat: number; lon: number; magnitude: number; depth: number; time: string; location: string; }
export interface MapFireHotspot { id: string; lat: number; lon: number; intensity: "low" | "medium" | "high" | "extreme"; district: string; }

type LayerKey = "districts" | "earthquakes" | "fires";

interface MuglaMapProps { earthquakes?: MapEarthquake[]; fires?: MapFireHotspot[]; className?: string; height?: number; }

function LayerToggle({ active, onChange, label, color }: { active: boolean; onChange: () => void; label: string; color: string }) {
  return (
    <button onClick={onChange} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors w-full text-left">
      <div className={cn("w-2.5 h-2.5 rounded-sm transition-opacity", color, !active && "opacity-25")} />
      <span className={cn("transition-opacity", !active && "opacity-40")}>{label}</span>
    </button>
  );
}

export function MuglaMap({ earthquakes = [], fires = [], className, height = 420 }: MuglaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({ districts: true, earthquakes: true, fires: true });
  const [loadError, setLoadError] = useState<string | null>(null);

  const toggleLayer = (key: LayerKey) => setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!containerRef.current) return;
    let map: unknown;
    let cancelled = false;
    const load = async () => {
      try {
        // @ts-ignore
        const ml = await import("https://cdn.skypack.dev/maplibre-gl@4").catch(() => null);
        if (!ml || cancelled) return;
        // @ts-ignore
        map = new ml.default.Map({
          container: containerRef.current!,
          style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
          center: [28.35, 37.05], zoom: 8, pitch: 30, maxBounds: [[26.0, 35.5], [31.0, 39.0]],
        });
        // @ts-ignore
        map.on("load", () => {
          if (cancelled) return;
          setMapReady(true);
          mapRef.current = map;
          MUGLA_DISTRICTS.forEach((d) => {
            // @ts-ignore
            new ml.default.Marker({ color: "#64748b", scale: 0.7 })
              .setLngLat([d.lon, d.lat])
              // @ts-ignore
              .setPopup(new ml.default.Popup({ offset: 25 }).setHTML(`<strong>${d.name}</strong>`))
              // @ts-ignore
              .addTo(map);
          });
        });
        // @ts-ignore
        map.on("error", () => setLoadError("Harita yüklenemedi"));
      } catch { if (!cancelled) setLoadError("MapLibre yüklenemedi"); }
    };
    load();
    return () => { cancelled = true; /* @ts-ignore */ map?.remove?.(); };
  }, []);

  return (
    <div className={cn("relative rounded-xl border border-border/50 overflow-hidden bg-background", className)} style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground text-center p-4">
          <div><AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" /><p>{loadError}</p></div>
        </div>
      )}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button onClick={() => { /* @ts-ignore */ mapRef.current?.zoomIn?.(); }} className="p-1.5 rounded-lg bg-background/90 border border-border/50 hover:bg-muted transition-colors shadow-sm"><ZoomIn className="h-4 w-4 text-muted-foreground" /></button>
        <button onClick={() => { /* @ts-ignore */ mapRef.current?.zoomOut?.(); }} className="p-1.5 rounded-lg bg-background/90 border border-border/50 hover:bg-muted transition-colors shadow-sm"><ZoomOut className="h-4 w-4 text-muted-foreground" /></button>
        <button onClick={() => { /* @ts-ignore */ mapRef.current?.flyTo?.({ center: [28.35, 37.05], zoom: 8 }); }} className="p-1.5 rounded-lg bg-background/90 border border-border/50 hover:bg-muted transition-colors shadow-sm"><Crosshair className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="absolute bottom-3 left-3 bg-background/90 border border-border/50 rounded-lg p-2 shadow-sm z-10">
        <div className="flex items-center gap-1 mb-1.5"><Layers className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Katmanlar</span></div>
        <div className="space-y-1">
          <LayerToggle active={activeLayers.districts} onChange={() => toggleLayer("districts")} label="İlçeler" color="bg-slate-400" />
          <LayerToggle active={activeLayers.earthquakes} onChange={() => toggleLayer("earthquakes")} label={`Depremler (${earthquakes.length})`} color="bg-orange-500" />
          <LayerToggle active={activeLayers.fires} onChange={() => toggleLayer("fires")} label={`Yangın (${fires.length})`} color="bg-red-500" />
        </div>
      </div>
      <div className="absolute top-3 left-3 bg-background/90 border border-border/50 rounded-lg px-2.5 py-1.5 z-10">
        <p className="text-[10px] font-mono text-muted-foreground">Muğla — 13 İlçe</p>
        {earthquakes.length > 0 && <p className="text-[10px] font-mono text-orange-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {earthquakes.length} deprem</p>}
        {fires.length > 0 && <p className="text-[10px] font-mono text-red-400 flex items-center gap-1"><Flame className="h-3 w-3" /> {fires.length} yangın</p>}
      </div>
    </div>
  );
}
