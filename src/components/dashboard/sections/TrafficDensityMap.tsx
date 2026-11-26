import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Map, Loader2, AlertTriangle, X } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import type { GroundTruthTrafficPatch } from "@/services/fieldArbitrationEngine";

type DistrictZone = {
  name: string;
  lat: number;
  lng: number;
  density: number;
  speed?: number;
  freeFlow?: number;
  confidence?: number;
};

const fallbackZones: DistrictZone[] = [
  { name: "Bodrum", lat: 37.04, lng: 27.43, density: 78 },
  { name: "Fethiye", lat: 36.65, lng: 29.12, density: 62 },
  { name: "Marmaris", lat: 36.85, lng: 28.27, density: 71 },
  { name: "Milas", lat: 37.32, lng: 27.78, density: 45 },
  { name: "Muğla Merkez", lat: 37.22, lng: 28.36, density: 55 },
  { name: "Datça", lat: 36.73, lng: 27.69, density: 25 },
  { name: "Dalaman", lat: 36.77, lng: 28.80, density: 52 },
  { name: "Ortaca", lat: 36.84, lng: 28.76, density: 38 },
  { name: "Köyceğiz", lat: 36.97, lng: 28.68, density: 22 },
  { name: "Yatağan", lat: 37.34, lng: 28.13, density: 35 },
  { name: "Ula", lat: 37.10, lng: 28.41, density: 30 },
  { name: "Kavaklıdere", lat: 37.44, lng: 28.38, density: 15 },
  { name: "Seydikemer", lat: 36.65, lng: 29.35, density: 28 },
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

/**
 * Arka plandaki çapraz doğrulama çıktısını teknik jargondan tamamen arındırıp
 * her yaş grubunun anlayacağı tek cümlelik günlük trafik uyarısına çevirir (TR/EN).
 */
export function formatPlainTrafficNotice(
  patch: GroundTruthTrafficPatch,
  lang: "tr" | "en" | "de" = "tr"
): string {
  const isEn = lang === "en";
  const place = (patch.location || patch.districtName || (isEn ? "Area" : "Bölgede")).trim();
  const reasonLow = `${patch.reason || ""} ${place}`.toLocaleLowerCase("tr-TR");
  if (reasonLow.includes("kaza")) {
    return isEn
      ? `Slowdown reported along ${place} due to a traffic accident.`
      : `${place} güzergahında trafik kazası nedeniyle yavaşlama bildirildi.`;
  }
  if (
    reasonLow.includes("çalışma") ||
    reasonLow.includes("asfalt") ||
    reasonLow.includes("kazı") ||
    reasonLow.includes("çukur")
  ) {
    return isEn
      ? `Congestion reported around ${place} due to roadworks.`
      : `${place} çevresinde yol çalışması nedeniyle yoğunluk bildirildi.`;
  }
  if (
    reasonLow.includes("kapalı") ||
    reasonLow.includes("kapan") ||
    reasonLow.includes("sel") ||
    reasonLow.includes("su")
  ) {
    return isEn
      ? `Water accumulation or lane closure reported along ${place}.`
      : `${place} hattında su baskını veya yol daralması bildirildi.`;
  }
  if (place.toLocaleLowerCase("tr-TR").includes("yol")) {
    return isEn
      ? `Traffic congestion reported around ${place}.`
      : `${place} çevresinde yoğunluk bildirildi.`;
  }
  if (
    !patch.districtName ||
    place.toLocaleLowerCase("tr-TR") === patch.districtName.toLocaleLowerCase("tr-TR")
  ) {
    return isEn
      ? `Traffic congestion reported toward ${place}.`
      : `${place} yönünde trafik yoğunluğu bildirildi.`;
  }
  return isEn
    ? `Traffic congestion reported toward ${place} (${patch.districtName}).`
    : `${place} (${patch.districtName}) yönünde trafik yoğunluğu bildirildi.`;
}

export const TrafficDensityMap = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const dateLocale = isEn ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const { data: trafficData, isLoading } = useLiveData<any>("traffic_density", {
    refetchInterval: 5 * 60 * 1000,
  });

  const rawZones = trafficData?.hotspots ?? trafficData?.zones;
  const districtZones: DistrictZone[] =
    Array.isArray(rawZones) && rawZones.length
      ? rawZones.map((z: Record<string, unknown>) => ({
          name: String(z.name ?? ""),
          lat: Number(z.lat ?? 0),
          lng: Number(z.lng ?? z.lon ?? 0),
          density: Math.min(100, Math.max(0, Math.round(Number(z.density ?? 0)))),
          speed: z.speed != null ? Number(z.speed) : undefined,
          freeFlow: z.freeFlow != null ? Number(z.freeFlow) : undefined,
          confidence: z.confidence != null ? Number(z.confidence) : undefined,
        }))
      : fallbackZones;
  const isLive = !!trafficData?.hotspots?.length || !!trafficData?.zones?.length;
  const hub = useOptionalUnifiedIntelligence();
  const groundTruthPatches = hub?.groundTruthPatches ?? [];
  const selectedPatch = groundTruthPatches.find((p) => p.id === selectedPatchId) ?? null;

  const mapWidth = 420;
  const mapHeight = 300;
  const minLat = 36.5,
    maxLat = 37.55;
  const minLng = 27.2,
    maxLng = 29.5;

  const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (mapWidth - 40) + 20;
  const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * (mapHeight - 40) + 20;

  const avgDensity = Math.round(
    districtZones.reduce((a, z) => a + z.density, 0) / districtZones.length
  );
  const worstZone = districtZones.reduce(
    (a, z) => (z.density > a.density ? z : a),
    districtZones[0]
  );

  return (
    <DashboardPanel title="Trafik Yoğunluk Haritası" icon={<Map size={14} />} badge="CANLI" badgeVariant="live">
      {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatCard
          label="Ort. Yoğunluk"
          value={`${avgDensity}`}
          unit="%"
          variant="primary"
          info={isEn ? "Live average traffic density across 13 districts" : "13 ilçenin anlık ortalama trafik yoğunluğu"}
        />
        <StatCard
          label="En Yoğun Bölge"
          value={worstZone?.name ?? "—"}
          unit={worstZone ? `%${worstZone.density}` : ""}
          info={isEn ? "District with highest congestion right now" : "Şu an en yoğun trafik görülen ilçe"}
        />
        <StatCard
          label="Yoğun Nokta"
          value={String(districtZones.filter((z) => z.density >= 70).length)}
          variant="destructive"
          info={isEn ? "Number of areas with 70%+ traffic density" : "Yoğunluğu %70 üzerindeki bölge sayısı"}
        />
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
            <g
              key={i}
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
                fill={
                  hoveredZone === zone.name
                    ? "hsl(var(--foreground))"
                    : "hsl(var(--muted-foreground))"
                }
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

          {groundTruthPatches.map((patch) => {
            const px = toX(patch.lng);
            const py = toY(patch.lat);
            const isSelected = selectedPatchId === patch.id;
            return (
              <g
                key={patch.id}
                role="button"
                tabIndex={0}
                aria-label={formatPlainTrafficNotice(patch, lang)}
                data-testid={`traffic-warning-marker-${patch.id}`}
                className="cursor-pointer"
                onClick={() => setSelectedPatchId((prev) => (prev === patch.id ? null : patch.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPatchId((prev) => (prev === patch.id ? null : patch.id));
                  }
                }}
              >
                <circle
                  cx={px}
                  cy={py}
                  r={isSelected ? 11 : 9}
                  fill="hsl(var(--warning) / 0.25)"
                  stroke="hsl(var(--warning))"
                  strokeWidth={isSelected ? "2" : "1.5"}
                />
                <circle
                  cx={px}
                  cy={py}
                  r={5.5}
                  fill="hsl(var(--warning))"
                  stroke="hsl(var(--background))"
                  strokeWidth="1"
                />
                <text
                  x={px}
                  y={py + 2.3}
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="sans-serif"
                  fontWeight="bold"
                  fill="hsl(var(--background))"
                >
                  !
                </text>
              </g>
            );
          })}
        </svg>

        {selectedPatch && (
          <div
            data-testid="traffic-plain-notice"
            className="absolute bottom-2 left-2 right-2 bg-card/95 border border-warning/50 rounded-md px-3 py-2 shadow-lg flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={14} className="text-warning shrink-0" aria-hidden="true" />
              <p className="text-xs font-sans text-foreground leading-snug">
                {formatPlainTrafficNotice(selectedPatch, lang)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPatchId(null)}
              className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={isEn ? "Dismiss notice" : "Uyarıyı kapat"}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {hoveredZone &&
          !selectedPatch &&
          (() => {
            const zone = districtZones.find((z) => z.name === hoveredZone)!;
            return (
              <div className="absolute top-2 right-2 bg-card border border-border rounded-md px-3 py-2 shadow-lg">
                <div className="text-xs font-mono font-bold text-foreground">{zone.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {isEn ? "Congestion" : "Yoğunluk"}:{" "}
                  <span className="font-bold" style={{ color: getDensityColor(zone.density) }}>
                    {zone.density}%
                  </span>
                </div>
                {zone.speed != null && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {isEn ? "Live Speed" : "Anlık Hız"}:{" "}
                    <span className="font-bold">
                      {zone.speed} {isEn ? "km/h" : "km/s"}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
      </div>

      <div className="flex items-center justify-center gap-3 mt-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {isEn ? "Heavy (70%+)" : "Yoğun (%70+)"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-warning" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {isEn ? "Moderate (50-70%)" : "Orta (%50-70)"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {isEn ? "Light (30-50%)" : "Hafif (%30-50)"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-[9px] font-mono text-muted-foreground">
            {isEn ? "Clear (<30%)" : "Akıcı (<%30)"}
          </span>
        </div>
      </div>

      {isLive && (
        <div className="tech-meta-only text-[9px] font-mono text-muted-foreground mt-2 text-center">
          {isEn ? "Last updated" : "Son güncelleme"}:{" "}
          {new Date(trafficData?.updated_at ?? Date.now()).toLocaleTimeString(dateLocale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </DashboardPanel>
  );
};
