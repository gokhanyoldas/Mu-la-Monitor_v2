import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Gauge } from "../Gauge";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";
import { Droplets, Wind, Loader as Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useTranslation } from "@/hooks/useTranslation";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import {
  useDamIntelligence,
  formatShortTurkishDate,
} from "@/services/topicGroundingService";

const defaultWeather = { temperature: 14, humidity: 68, wind_speed: 22, windspeed: 22, uv_index: 3, sea_temp: 16, condition: 'Açık' };

// Safe display value: returns String(v) if defined/non-null, else fallback
const sv = (v: any, fallback: number | string) =>
  v !== undefined && v !== null ? String(v) : String(fallback);
const defaultAirQuality = { aqi: 42, pm25: 15, pm10: 28, quality_label: "İyi" };

export const EnvironmentSection = () => {
  return (
    <div className="space-y-3">
      <WeatherClimatePanel />
      <AirQualityPanel />
      <WaterDamsPanel />
    </div>
  );
};

export const WeatherClimatePanel = () => {
  const { data: weatherData } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
  const w = weatherData || defaultWeather;

  return (
    <div className="relative">
      <DashboardPanel title="Hava & İklim" icon={<Wind size={14} />} badge="CANLI" badgeVariant="live">
        <div className="absolute top-2 right-12 opacity-75">
          <DataFreshnessIndicator category="weather" size="sm" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard label="Sıcaklık" value={sv(w.temperature, 14)} unit="°C" variant="primary"
            info="Open-Meteo güncel hava istasyonu (Muğla merkez). 15 dakikada bir güncellenir." />
          <StatCard label="Nem" value={sv(w.humidity, 68)} unit="%"
            info="Open-Meteo bağıl nem. 15 dakikada bir güncellenir." />
          <StatCard label="Rüzgar" value={sv(w.windspeed ?? w.wind_speed, 22)} unit="km/h"
            info="Open-Meteo 10m rüzgar hızı. 15 dakikada bir güncellenir." />
          <StatCard label="UV İndeksi" value={sv(w.uv_index, 0)} variant="accent"
            info="Open-Meteo UV indeksi (0-11+). Günlük maksimum." />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Deniz Suyu" value={sv(w.sea_temp, 16)} unit="°C" variant="accent"
            info="Open-Meteo deniz yüzey sıcaklığı (Ege). Günlük güncellenir." />
          <StatCard label="Durum" value={w.condition || 'Açık'}
            info="Open-Meteo WMO hava kodu çevirisi. Anlık durum." />
        </div>
        {w.districts && Array.isArray(w.districts) && w.districts.length > 0 && (
          <>
            <span className="text-[9px] font-mono text-muted-foreground uppercase mb-2 block">İlçe Sıcaklıkları</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-2">
              {w.districts.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-muted/20">
                  <span className="text-[10px] font-mono text-foreground/80">{d.name}</span>
                  <span className="text-[10px] font-mono font-bold text-primary">{d.temperature}°C</span>
                </div>
              ))}
            </div>
          </>
        )}
      </DashboardPanel>
    </div>
  );
};

export const AirQualityPanel = () => {
  const { data: airData } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
  const aq = airData || defaultAirQuality;

  return (
    <div className="relative">
      <DashboardPanel title="Hava Kalitesi" badge={aq.aqi_label ?? aq.quality_label ?? "ORTA"} badgeVariant={aq.aqi <= 50 ? "active" : aq.aqi <= 100 ? "warning" : "alert"}>
        <div className="absolute top-2 right-12 opacity-75">
          <DataFreshnessIndicator category="air_quality" size="sm" />
        </div>
        <div className="flex justify-around">
          <Gauge value={aq.aqi} max={100} label="AQI" variant="primary" />
          <Gauge value={aq.pm25} max={50} label="PM2.5" variant="primary" />
          <Gauge value={aq.pm10} max={100} label="PM10" variant="primary" />
        </div>
        <p className="text-[8px] font-mono text-muted-foreground/70 mt-2 text-center">
          Kaynak: Open-Meteo Air Quality API (30 dk) · Avrupa AQI standardı
        </p>
      </DashboardPanel>
    </div>
  );
};

export const WaterDamsPanel = () => {
  const { t } = useTranslation();
  const {
    dams,
    hasVerifiedLiveData,
    latestSourceSummary,
    isLoading,
  } = useDamIntelligence();
  const hub = useOptionalUnifiedIntelligence();
  const waterAlerts = (hub?.arbitratedEvents ?? [])
    .map((e) => e.envWaterAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="relative">
      <DashboardPanel
        title="Su & Barajlar"
        icon={<Droplets size={14} />}
        badge={hasVerifiedLiveData ? "GÜNCEL" : "ÖLÇÜM BEKLENİYOR"}
        badgeVariant={hasVerifiedLiveData ? "active" : "warning"}
      >
        {isLoading && !hasVerifiedLiveData && (
          <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
        )}
        <div className="space-y-1.5 mb-3">
          {dams.map((dam) => {
            const hasRate = dam.occupancyRate !== null;
            const rate = dam.occupancyRate ?? 0;
            const shortDate = formatShortTurkishDate(dam.measuredAt);
            const rowTitle = hasRate
              ? `${dam.name}: %${dam.occupancyRate} · ${dam.sourceName || "Yerel Basın/DSİ"}${shortDate ? ` (${shortDate})` : ""}`
              : `${dam.name} (${dam.capacityLabel}) · Canlı resmi ölçüm bekleniyor`;

            return (
              <div
                key={dam.id}
                title={rowTitle}
                className="flex items-center gap-2 px-2 py-1 rounded bg-muted/20"
              >
                <span className="text-[10px] font-mono text-foreground/80 w-28 truncate shrink-0">
                  {t(dam.name)}
                </span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  {hasRate && (
                    <div
                      className={`h-full rounded-full transition-all ${
                        rate >= 60 ? "bg-success" : rate >= 45 ? "bg-warning" : "bg-destructive"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] font-mono font-bold w-9 text-right ${
                    !hasRate
                      ? "text-muted-foreground"
                      : rate >= 60
                      ? "text-success"
                      : rate >= 45
                      ? "text-warning"
                      : "text-destructive"
                  }`}
                >
                  {hasRate ? `${dam.occupancyRate}%` : "—"}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground w-16 text-right shrink-0">
                  {dam.capacityLabel}
                </span>
              </div>
            );
          })}
        </div>
        {waterAlerts.length > 0 && (
          <div className="mb-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-2 space-y-1">
            {waterAlerts.slice(0, 2).map((wa, idx) => (
              <div key={idx} className="text-[10px] font-mono leading-snug">
                <span className="font-bold text-cyan-300">💧 {wa.title} ({wa.districtName}): </span>
                <span className="text-foreground/90">{wa.detail}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[8px] font-mono text-muted-foreground/70 mt-2" data-testid="dam-source-note">
          {latestSourceSummary}
        </p>
      </DashboardPanel>
    </div>
  );
};
