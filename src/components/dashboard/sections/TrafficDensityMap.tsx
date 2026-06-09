import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Map, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

type DistrictZone = {
  name: string;
  lat: number;
  lng: number;
  density: number;
  vehicles: string;
};

const fallbackZones: DistrictZone[] = [
  { name: "Bodrum", lat: 37.04, lng: 27.43, density: 78, vehicles: "48K" },
  { name: "Fethiye", lat: 36.65, lng: 29.12, density: 62, vehicles: "32K" },
  { name: "Marmaris", lat: 36.85, lng: 28.27, density: 71, vehicles: "38K" },
  { name: "Milas", lat: 37.32, lng: 27.78, density: 45, vehicles: "22K" },
  { name: "Muğla Merkez", lat: 37.22, lng: 28.36, density: 55, vehicles: "28K" },
  { name: "Datça", lat: 36.73, lng: 27.69, density: 25, vehicles: "8K" },
  { name: "Dalaman", lat: 36.77, lng: 28.80, density: 52, vehicles: "18K" },
  { name: "Ortaca", lat: 36.84, lng: 28.76, density: 38, vehicles: "14K" },
  { name: "Köyceğiz", lat: 36.97, lng: 28.68, density: 22, vehicles: "6K" },
  { name: "Yatağan", lat: 37.34, lng: 28.13, density: 35, vehicles: "12K" },
  { name: "Ula", lat: 37.10, lng: 28.41, density: 30, vehicles: "10K" },
  { name: "Kavaklıdere", lat: 37.44, lng: 28.38, density: 15, vehicles: "4K" },
  { name: "Seydikemer", lat: 36.65, lng: 29.35, density: 28, vehicles: "9K" },
];

const getDensityColor = (density: number) => {
  if (density >= 70) return "hsl(var(--destructive))";
  if (density >= 50) return "hsl(var(--warning))";
  if (density >= 30) return "hsl(var(--accent))";
  return "hsl(var(--success))";
};

const getDensityOpacity = (density: number) => {
  return 0.2 + (density / 100) * 0.5;
};

export const TrafficDensityMap = () => {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const { data: trafficData, isLoading } = useLiveData<any>("traffic_density", { refetchInterval: 5 * 60 * 1000 });

  const districtZones: DistrictZone[] = trafficData?.zones || fallbackZones;
  const isLive = !!trafficData?.zones;

  const mapWidth = 420;
  const mapHeight = 300;
  const minLat = 36.5, maxLat = 37.55;
  const minLng = 27.2, maxLng = 29.5;

  const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (mapWidth - 40) + 20;
  const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * (mapHeight - 40) + 20;

  const avgDensity = Math.round(districtZones.reduce((a, z) => a + z.density, 0) / districtZones.length);
  const totalVehicles = "285K";

  return (
    <DashboardPanel title="Trafik Yoğunluk Haritası" icon={<Map size={14} />} badge="CANLI" badgeVariant="live">
      {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatCard label="Ort. Yoğunluk" value={`${avgDensity}`} unit="%" variant="primary" />
        <StatCard label="Günlük Araç" value={totalVehicles} />
        <StatCard label="Kritik Bölge" value={String(districtZones.filter(z => z.density >= 70).length)} variant="destructive" />
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-auto" style={{ minHeight: 220 }}>
          <rect width={mapWidth} height={mapHeight} fill="hsl(var(--background))" rx="4" />
          <path
            d={`M ${toX(27.4)} ${toY(37.4)} 
                L ${toX(28.0)} ${toY(37.5)} 
                L ${toX(28.5)} ${toY(37.45)} 
                L ${toX(29.0)} ${toY(37.2)} 
                L ${toX(29.4)} ${toY(36.8)} 
                L ${toX(29.2)} ${toY(36.55)} 
                L ${toX(28.7)} ${toY(36.6)} 
                L ${toX(28.2)} ${toY(36.75)} 
                L ${toX(27.8)} ${toY(36.65)} 
                L ${toX(27.3)} ${toY(36.7)} 
                L ${toX(27.3)} ${toY(37.0)} 
                Z`}
            fill="hsl(var(--muted) / 0.2)"
            stroke="hsl(var(--border))"
            strokeWidth="0.8"
          />
          {districtZones.map((zone, i) => (
            <g key={i}
              onMouseEnter={() => setHoveredZone(zone.name)}
              onMouseLeave={() => setHoveredZone(null)}
              className="cursor-pointer"
            >
              <circle
                cx={toX(zone.lng)}
                cy={toY(zone.lat)}
                r={12 + (zone.density / 100) * 12}
                fill={getDensityColor(zone.density)}
                opacity={getDensityOpacity(zone.density)}
                className={zone.density >= 70 ? "animate-pulse" : ""}
              />
              <circle
                cx={toX(zone.lng)}
                cy={toY(zone.lat)}
                r="4"
                fill={getDensityColor(zone.density)}
                stroke="hsl(var(--background))"
                strokeWidth="1"
              />
              <text
                x={toX(zone.lng)}
                y={toY(zone.lat) - 10 - (zone.density / 100) * 8}
                textAnchor="middle"
                fontSize="5.5"
                fontFamily="monospace"
                fontWeight={hoveredZone === zone.name ? "bold" : "normal"}
                fill={hoveredZone === zone.name ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
              >
                {zone.name}
              </text>
              <text
                x={toX(zone.lng)}
                y={toY(zone.lat) + 3}
                textAnchor="middle"
                fontSize="5"
                fontFamily="monospace"
                fontWeight="bold"
                fill="hsl(var(--foreground))"
              >
                {zone.density}%
              </text>
            </g>
          ))}
        </svg>

        {hoveredZone && (() => {
          const zone = districtZones.find(z => z.name === hoveredZone)!;
          return (
            <div className="absolute top-2 right-2 bg-card border border-border rounded-md px-3 py-2 shadow-lg">
              <div className="text-xs font-mono font-bold text-foreground">{zone.name}</div>
              <div className="text-[10px] font-mono text-muted-foreground">Yoğunluk: <span className="font-bold" style={{ color: getDensityColor(zone.density) }}>{zone.density}%</span></div>
              <div className="text-[10px] font-mono text-muted-foreground">Günlük Araç: {zone.vehicles}</div>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center justify-center gap-3 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-[9px] font-mono text-muted-foreground">Yoğun (70%+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-warning" />
          <span className="text-[9px] font-mono text-muted-foreground">Orta (50-70%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span className="text-[9px] font-mono text-muted-foreground">Hafif (30-50%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-[9px] font-mono text-muted-foreground">Düşük (&lt;30%)</span>
        </div>
      </div>

      {isLive && (
        <div className="text-[8px] font-mono text-muted-foreground mt-2 text-center">
          Kaynak: {trafficData.source} • Güncelleme: {new Date(trafficData.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </DashboardPanel>
  );
};
