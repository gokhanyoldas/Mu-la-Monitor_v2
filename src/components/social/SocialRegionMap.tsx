// src/components/social/SocialRegionMap.tsx
// Presentational heat map for the parent-filtered social analysis dataset.
// Crisis districts pulse red; other districts use their aggregate sentiment.

import { useMemo } from "react";

// ─── Crisis keywords ──────────────────────────────────────────────────────────
const CRISIS_KEYWORDS = [
  "yangın", "yanıyor", "ateş", "alev",
  "kaza", "çarpışma", "trafik kazası",
  "duman", "boğuluyor",
  "sel", "su baskını", "taşkın",
  "deprem", "sarsıntı",
  "patlama", "bomba",
  "ölü", "yaralı", "ölüm",
  "acil", "ambulans", "itfaiye", "kurtarma",
  "kalabalık", "izdiham",
];

function isCrisis(content: string): boolean {
  const lower = content.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── District coordinates ─────────────────────────────────────────────────────
const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  "Muğla Merkez": { lat: 37.215, lng: 28.364 },
  "Bodrum":       { lat: 37.034, lng: 27.427 },
  "Marmaris":     { lat: 36.852, lng: 28.269 },
  "Fethiye":      { lat: 36.654, lng: 29.123 },
  "Datça":        { lat: 36.730, lng: 27.687 },
  "Dalaman":      { lat: 36.767, lng: 28.802 },
  "Milas":        { lat: 37.278, lng: 27.783 },
  "Köyceğiz":     { lat: 36.968, lng: 28.685 },
  "Ortaca":       { lat: 36.838, lng: 28.767 },
  "Menteşe":      { lat: 37.215, lng: 28.364 },
  "Yatağan":      { lat: 37.340, lng: 28.135 },
  "Kavaklıdere":  { lat: 37.425, lng: 28.378 },
  "Seydikemer":   { lat: 36.624, lng: 29.357 },
};

const MAP_BOUNDS = { minLat: 36.5, maxLat: 37.5, minLng: 27.2, maxLng: 29.5 };

function latLngToXY(lat: number, lng: number, w: number, h: number) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * w;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * h;
  return { x, y };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface RegionPoint {
  name: string;
  lat: number;
  lng: number;
  mentionCount: number;
  sentiment: "positive" | "negative" | "neutral";
}

interface AnalysisForMap {
  content: string;
  sentiment: string;
  region?: string;
}

interface RegionStats {
  count: number;
  pos: number;
  neg: number;
  neu: number;
  hasCrisis: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SocialRegionMapProps {
  analyses: AnalysisForMap[];
}

export const SocialRegionMap = ({ analyses }: SocialRegionMapProps) => {
  const W = 320;
  const H = 180;

  const activeData = useMemo(() => generateRegionMapData(analyses), [analyses]);
  const maxCount = Math.max(...activeData.map(p => p.mentionCount), 1);

  // Crisis districts set (for pulsing)
  const crisisDistricts = useMemo(() => {
    const set = new Set<string>();
    for (const p of analyses) {
      if (!isCrisis(p.content)) continue;
      if (p.region) set.add(p.region);
    }
    return set;
  }, [analyses]);

  const getColor = (p: RegionPoint) => {
    if (crisisDistricts.has(p.name)) return "#ef4444";
    switch (p.sentiment) {
      case "positive": return "#22c55e";
      case "negative": return "#f97316";
      default:         return "#eab308";
    }
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: "180px" }}>
        {/* Background */}
        <rect width={W} height={H} fill="hsl(var(--muted))" opacity={0.08} rx={8} />

        {/* Grid */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={`h${f}`} x1={0} y1={H * f} x2={W} y2={H * f} stroke="hsl(var(--border))" strokeWidth={0.3} opacity={0.25} />
        ))}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={`v${f}`} x1={W * f} y1={0} x2={W * f} y2={H} stroke="hsl(var(--border))" strokeWidth={0.3} opacity={0.25} />
        ))}

        {/* All district dots (inactive) */}
        {Object.entries(DISTRICT_COORDS).map(([name, coords]) => {
          const { x, y } = latLngToXY(coords.lat, coords.lng, W, H);
          const hasData = activeData.some(p => p.name === name);
          if (hasData) return null;
          return (
            <g key={name}>
              <circle cx={x} cy={y} r={2.5} fill="hsl(var(--muted-foreground))" opacity={0.12} />
              <text x={x} y={y + 7} textAnchor="middle" fontSize={4.5} fill="hsl(var(--muted-foreground))" opacity={0.25} fontFamily="monospace">{name}</text>
            </g>
          );
        })}

        {/* Active data points */}
        {activeData.map(p => {
          const { x, y } = latLngToXY(p.lat, p.lng, W, H);
          const r = Math.max(5, (p.mentionCount / maxCount) * 14);
          const color = getColor(p);
          const isCrisisDistrict = crisisDistricts.has(p.name);

          return (
            <g key={p.name}>
              {/* Crisis outer pulse ring (double frequency) */}
              {isCrisisDistrict && (
                <>
                  <circle cx={x} cy={y} r={r + 8} fill={color} opacity={0}>
                    <animate attributeName="r" values={`${r + 4};${r + 14};${r + 4}`} dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r={r + 4} fill={color} opacity={0}>
                    <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="1.2s" begin="0.3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" begin="0.3s" repeatCount="indefinite" />
                  </circle>
                </>
              )}

              {/* Normal pulse ring */}
              <circle cx={x} cy={y} r={r + 3} fill={color} opacity={0.1}>
                <animate attributeName="r" values={`${r + 2};${r + 6};${r + 2}`} dur={isCrisisDistrict ? "1.2s" : "2.5s"} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.2;0.05;0.2" dur={isCrisisDistrict ? "1.2s" : "2.5s"} repeatCount="indefinite" />
              </circle>

              {/* Main circle */}
              <circle cx={x} cy={y} r={r} fill={color} opacity={isCrisisDistrict ? 0.85 : 0.6}
                stroke={color} strokeWidth={isCrisisDistrict ? 1.5 : 0.8} />

              {/* Crisis ⚠ icon */}
              {isCrisisDistrict && (
                <text x={x} y={y - r - 3} textAnchor="middle" fontSize={8} fill="#ef4444" fontFamily="monospace">⚠</text>
              )}

              {/* Count */}
              <text x={x} y={y + 3} textAnchor="middle" fontSize={6} fill="white" fontFamily="monospace" fontWeight="bold">{p.mentionCount}</text>

              {/* Name */}
              <text x={x} y={y + r + 8} textAnchor="middle" fontSize={5.5} fill="hsl(var(--foreground))" fontFamily="monospace" opacity={0.7}>{p.name}</text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${W - 82}, 6)`}>
          <rect x={-4} y={-4} width={78} height={46} rx={3} fill="hsl(var(--background))" opacity={0.7} />
          <circle cx={4} cy={4}  r={3} fill="#22c55e" />
          <text x={11} y={7}  fontSize={5} fill="hsl(var(--muted-foreground))" fontFamily="monospace">Pozitif</text>
          <circle cx={4} cy={16} r={3} fill="#f97316" />
          <text x={11} y={19} fontSize={5} fill="hsl(var(--muted-foreground))" fontFamily="monospace">Negatif</text>
          <circle cx={4} cy={28} r={3} fill="#eab308" />
          <text x={11} y={31} fontSize={5} fill="hsl(var(--muted-foreground))" fontFamily="monospace">Nötr</text>
          <circle cx={4} cy={40} r={3} fill="#ef4444" opacity={0.9}>
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <text x={11} y={43} fontSize={5} fill="#ef4444" fontFamily="monospace">KRİZ ⚠</text>
        </g>

        {/* Scope indicator */}
        <g transform={`translate(8, 8)`}>
          <circle cx={0} cy={0} r={3} fill="#a78bfa" />
          <text x={7} y={3} fontSize={5} fill="#a78bfa" fontFamily="monospace">FİLTRELİ</text>
        </g>
      </svg>
    </div>
  );
};

// ─── Static data helper (kept for backward compat) ────────────────────────────
export function generateRegionMapData(
  analyses: AnalysisForMap[]
): RegionPoint[] {
  const regionMap = new Map<string, RegionStats>();
  for (const item of analyses) {
    if (!item.region) continue;
    if (!regionMap.has(item.region)) regionMap.set(item.region, { count: 0, pos: 0, neg: 0, neu: 0, hasCrisis: false });
    const entry = regionMap.get(item.region)!;
    entry.count++;
    if (item.sentiment === "positive") entry.pos++;
    else if (item.sentiment === "negative") entry.neg++;
    else entry.neu++;
    if (item.content && isCrisis(item.content)) entry.hasCrisis = true;
  }
  return Array.from(regionMap.entries()).map(([name, data]) => {
    const coords = DISTRICT_COORDS[name];
    let sentiment: "positive" | "negative" | "neutral" = "neutral";
    if (data.hasCrisis || data.neg > data.pos) sentiment = "negative";
    else if (data.pos > data.neg && data.pos > data.neu) sentiment = "positive";
    if (!coords) return null;
    return { name, lat: coords.lat, lng: coords.lng, mentionCount: data.count, sentiment };
  }).filter((point): point is RegionPoint => point !== null);
}
