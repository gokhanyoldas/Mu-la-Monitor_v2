import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatQuakeLocation } from "@/hooks/useAISummary";
import { formatRelativeTime } from "@/lib/time-utils";
import { useMonitorStore } from "@/store/useMonitorStore";

interface QuakeEvent {
  id: string;
  mag: number;
  place: string;
  time: number;
  depth_km: number;
  lat: number;
  lng: number;
  url: string;
}

// Muğla merkez koordinatları
const MUGLA_LAT = 37.2153;
const MUGLA_LNG = 28.3636;
const RADIUS_KM = 300; // 300km yarıçap (Ege + yakın çevre)

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function severityClass(mag: number): string {
  if (mag >= 5.0) return "border-red-500 bg-red-950/60 text-red-300";
  if (mag >= 4.0) return "border-orange-500 bg-orange-950/50 text-orange-300";
  if (mag >= 3.0) return "border-yellow-500 bg-yellow-950/40 text-yellow-200";
  return "border-blue-500/40 bg-blue-950/20 text-blue-200";
}

function magnitudeEmoji(mag: number): string {
  if (mag >= 5.0) return "🔴";
  if (mag >= 4.0) return "🟠";
  if (mag >= 3.0) return "🟡";
  return "🔵";
}

export const EarthquakeAlertBanner = () => {
  const { lang, t } = useTranslation();
  const isEn = lang === "en";
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchQuakes = useCallback(async () => {
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // USGS GeoJSON feed — free, no API key
      const res = await fetch(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&minmagnitude=2.5&maxradiuskm=${RADIUS_KM}&latitude=${MUGLA_LAT}&longitude=${MUGLA_LNG}&orderby=time`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return;
      const data = await res.json();
      const features: QuakeEvent[] = (data.features ?? [])
        .map((f: any) => ({
          id: f.id,
          mag: f.properties?.mag ?? 0,
          place: f.properties?.place ?? (isEn ? "Unknown" : "Bilinmiyor"),
          time: f.properties?.time ?? 0,
          depth_km: (f.geometry?.coordinates?.[2] ?? 0) as number,
          lat: f.geometry?.coordinates?.[1] ?? 0,
          lng: f.geometry?.coordinates?.[0] ?? 0,
          url: f.properties?.url ?? "#",
        }))
        .filter((q: QuakeEvent) => q.mag >= 2.5);
      setQuakes(features);
      const nowDate = new Date();
      setLastFetch(nowDate);
      useMonitorStore.getState().setEarthquakes(
        features.map((f) => ({
          id: f.id,
          magnitude: f.mag,
          location: f.place,
          depthKm: f.depth_km,
          occurredAt: new Date(f.time).toISOString(),
          lat: f.lat,
          lng: f.lng,
          url: f.url,
          sourceName: "USGS",
        })),
        nowDate.toISOString()
      );
    } catch {
      /* silent */
    }
  }, [isEn]);

  useEffect(() => {
    fetchQuakes();
    const interval = setInterval(fetchQuakes, 5 * 60 * 1000); // refresh every 5min
    return () => clearInterval(interval);
  }, [fetchQuakes]);

  const visible = quakes.filter((q) => !dismissed.has(q.id));
  if (visible.length === 0) return null;

  const topQuake = visible[0];
  const criticalCount = visible.filter((q) => q.mag >= 4.0).length;
  const showCount = expanded ? visible.length : 1;

  const headerTitle =
    criticalCount > 0
      ? isEn
        ? `⚠️ ${criticalCount} CRITICAL EARTHQUAKE${criticalCount > 1 ? "S" : ""} IN LAST 24H`
        : `⚠️ SON 24 SAATTE ${criticalCount} KRİTİK DEPREM`
      : isEn
      ? `${visible.length} EARTHQUAKE EVENT${visible.length > 1 ? "S" : ""} IN LAST 24H`
      : `SON 24 SAATTE ${visible.length} DEPREM AKTİVİTESİ`;

  const moreCount = visible.length - 1;
  const showMoreLabel = isEn
    ? `+ Show ${moreCount} more earthquake${moreCount > 1 ? "s" : ""}`
    : `+ ${moreCount} deprem daha göster`;

  return (
    <div
      role="region"
      aria-label={isEn ? "Earthquake alerts" : "Deprem uyarıları"}
      className={`mx-3 mb-2 rounded-lg border overflow-hidden ${severityClass(topQuake.mag)}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle size={14} className="flex-shrink-0 animate-pulse" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-mono font-bold">{headerTitle}</span>
          <span className="ml-2 text-[9px] opacity-75">
            {lastFetch ? `${t("updated")}: ${formatRelativeTime(lastFetch, lang)}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {visible.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={
                isEn
                  ? expanded
                    ? "Collapse earthquake list"
                    : "Expand earthquake list"
                  : expanded
                  ? "Deprem listesini daralt"
                  : "Deprem listesini genişlet"
              }
              className="p-1 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set([...prev, ...visible.map((q) => q.id)]))}
            aria-label={isEn ? "Dismiss earthquake alert" : "Deprem uyarısını kapat"}
            className="p-1 rounded hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Earthquake list */}
      <div className="border-t border-current/20 divide-y divide-current/10">
        {visible.slice(0, showCount).map((q) => {
          const dist = Math.round(distanceKm(MUGLA_LAT, MUGLA_LNG, q.lat, q.lng));
          const ageLabel = formatRelativeTime(q.time, lang);
          const formattedPlace = formatQuakeLocation(q.place, isEn ? "en" : "tr");
          return (
            <div key={q.id} className="flex items-center gap-3 px-3 py-1.5">
              <span className="text-base" aria-hidden="true">
                {magnitudeEmoji(q.mag)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono font-bold tabular-nums-stat">M{q.mag.toFixed(1)}</span>
                  <span className="text-[10px] font-mono opacity-85 truncate">{formattedPlace}</span>
                </div>
                <div className="flex gap-2 text-[9px] font-mono opacity-70">
                  <span>
                    {t("quake.depth")}: {q.depth_km.toFixed(0)} km
                  </span>
                  <span>·</span>
                  <span>Muğla: ~{dist} km</span>
                  <span>·</span>
                  <span>{ageLabel}</span>
                </div>
              </div>
              <a
                href={q.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono underline opacity-75 hover:opacity-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                USGS →
              </a>
            </div>
          );
        })}
        {!expanded && visible.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full text-center text-[9px] font-mono py-1.5 opacity-75 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current"
          >
            {showMoreLabel}
          </button>
        )}
      </div>
    </div>
  );
};
