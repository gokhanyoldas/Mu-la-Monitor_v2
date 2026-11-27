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
import {
  useMonitorStore,
  selectDams,
  selectActiveDistrict,
} from "@/store/useMonitorStore";
import { DataOriginBadge } from "../DataOriginBadge";
import {
  DEFAULT_WEATHER_SNAPSHOT,
  DEFAULT_AQI_SNAPSHOT,
  OFFICIAL_DAM_REFERENCE_OCCUPANCY,
  eaqiToTurkishLabel,
} from "@/data/officialReferenceData";

// Safe display value: returns String(v) if defined/non-null, else fallback
const sv = (v: any, fallback: number | string) =>
  v !== undefined && v !== null ? String(v) : String(fallback);

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
  const { lang, t } = useTranslation();
  const isEn = lang === "en";
  const { data: weatherData } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
  const w = weatherData || DEFAULT_WEATHER_SNAPSHOT;
  const isLiveWeather = Boolean(weatherData && !weatherData.isReference);

  return (
    <div className="relative">
      <DashboardPanel
        title="Hava & İklim"
        icon={<Wind size={14} />}
        badge={isLiveWeather ? "CANLI" : "REFERANS VERİ"}
        badgeVariant={isLiveWeather ? "live" : "info"}
      >
        <div className="absolute top-2 right-12 opacity-75">
          <DataFreshnessIndicator category="weather" size="sm" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard
            label="Sıcaklık"
            value={sv(w.temperature, DEFAULT_WEATHER_SNAPSHOT.temperature)}
            unit="°C"
            variant="primary"
            info={isEn ? "Open-Meteo live weather station (Muğla center). Updated every 15 min." : "Open-Meteo güncel hava istasyonu (Muğla merkez). 15 dakikada bir güncellenir."}
          />
          <StatCard
            label="Nem"
            value={sv(w.humidity, DEFAULT_WEATHER_SNAPSHOT.humidity)}
            unit="%"
            info={isEn ? "Open-Meteo relative humidity. Updated every 15 min." : "Open-Meteo bağıl nem. 15 dakikada bir güncellenir."}
          />
          <StatCard
            label="Rüzgar"
            value={sv(w.windspeed ?? w.wind_speed, DEFAULT_WEATHER_SNAPSHOT.windspeed)}
            unit={isEn ? "km/h" : "km/sa"}
            info={isEn ? "Open-Meteo 10m wind speed. Updated every 15 min." : "Open-Meteo 10m rüzgar hızı. 15 dakikada bir güncellenir."}
          />
          <StatCard
            label="UV İndeksi"
            value={sv(w.uv_index, DEFAULT_WEATHER_SNAPSHOT.uv_index)}
            variant="accent"
            info={isEn ? "Open-Meteo UV index (0-11+). Daily maximum." : "Open-Meteo UV indeksi (0-11+). Günlük maksimum."}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard
            label="Deniz Suyu"
            value={sv(w.sea_temp, DEFAULT_WEATHER_SNAPSHOT.sea_temp)}
            unit="°C"
            variant="accent"
            info={isEn ? "Open-Meteo sea surface temperature (Aegean). Daily update." : "Open-Meteo deniz yüzey sıcaklığı (Ege). Günlük güncellenir."}
          />
          <StatCard
            label="Durum"
            value={t(w.condition || DEFAULT_WEATHER_SNAPSHOT.condition)}
            info={isEn ? "Live WMO weather condition." : "Open-Meteo WMO hava kodu çevirisi. Anlık durum."}
          />
        </div>
        {w.districts && Array.isArray(w.districts) && w.districts.length > 0 && (
          <>
            <span className="text-[9px] font-mono text-muted-foreground uppercase mb-2 block">
              {t("İlçe Sıcaklıkları")}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-2">
              {w.districts.map((d: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-muted/20">
                  <span className="text-[10px] font-mono text-foreground/80">{d.name}</span>
                  <span className="text-[10px] font-mono font-bold text-primary tabular-nums-stat">
                    {d.temperature}°C
                  </span>
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
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const { data: airData } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
  const aq = airData || DEFAULT_AQI_SNAPSHOT;
  const aqiVal = Number(aq.aqi ?? DEFAULT_AQI_SNAPSHOT.aqi);
  const resolvedLabel = aq.aqi_label ?? aq.quality_label ?? eaqiToTurkishLabel(aqiVal);

  return (
    <div className="relative">
      <DashboardPanel
        title="Hava Kalitesi"
        badge={resolvedLabel}
        badgeVariant={aqiVal <= 40 ? "active" : aqiVal <= 60 ? "warning" : "alert"}
      >
        <div className="absolute top-2 right-12 opacity-75">
          <DataFreshnessIndicator category="air_quality" size="sm" />
        </div>
        <div className="flex justify-around">
          <Gauge value={aqiVal} max={100} label="AQI" variant="primary" />
          <Gauge value={Number(aq.pm25 ?? DEFAULT_AQI_SNAPSHOT.pm25)} max={50} label="PM2.5" variant="primary" />
          <Gauge value={Number(aq.pm10 ?? DEFAULT_AQI_SNAPSHOT.pm10)} max={100} label="PM10" variant="primary" />
        </div>
        <p className="tech-meta-only text-[8px] font-mono text-muted-foreground/75 mt-2 text-center">
          {isEn
            ? "Source: Open-Meteo Air Quality API (30m) · European AQI standard"
            : "Kaynak: Open-Meteo Air Quality API (30 dk) · Avrupa AQI standardı"}
        </p>
      </DashboardPanel>
    </div>
  );
};

export const WaterDamsPanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const damQuery = useDamIntelligence();
  const storeDams = useMonitorStore(selectDams);
  const activeDistrict = useMonitorStore(selectActiveDistrict);

  const useStoreRecords =
    storeDams.records.length > 0 &&
    (storeDams.hasVerifiedLiveData || !damQuery.hasVerifiedLiveData);
  const dams = useStoreRecords ? storeDams.records : damQuery.dams;
  const hasVerifiedLiveData = useStoreRecords
    ? storeDams.hasVerifiedLiveData
    : damQuery.hasVerifiedLiveData;
  const latestSourceSummary = useStoreRecords
    ? storeDams.latestSourceSummary
    : damQuery.latestSourceSummary;
  const isLoading = damQuery.isLoading;

  const hub = useOptionalUnifiedIntelligence();
  const waterAlerts = (hub?.arbitratedEvents ?? [])
    .map((e) => e.envWaterAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="relative">
      <DashboardPanel
        title="Su & Barajlar"
        icon={<Droplets size={14} />}
        badge={hasVerifiedLiveData ? "GÜNCEL" : "REFERANS VERİ"}
        badgeVariant={hasVerifiedLiveData ? "active" : "info"}
      >
        <DataOriginBadge origin={hasVerifiedLiveData ? "live" : "reference"} className="mb-2" />
        {isLoading && !hasVerifiedLiveData && (
          <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
        )}
        <div className="space-y-1.5 mb-3">
          {dams.map((dam) => {
            const isDamLive = dam.occupancyRate !== null;
            const refRate = OFFICIAL_DAM_REFERENCE_OCCUPANCY[dam.id] ?? null;
            const effectiveRate = isDamLive ? dam.occupancyRate : refRate;
            const hasRate = effectiveRate !== null;
            const rate = effectiveRate ?? 0;
            const shortDate = formatShortTurkishDate(dam.measuredAt);
            const localizedCap = t(dam.capacityLabel);
            const isDistrictMatch =
              Boolean(activeDistrict) &&
              dam.district.toLocaleLowerCase("tr-TR").includes(activeDistrict!);
            const rowTitle = isDamLive
              ? `${t(dam.name)}: %${dam.occupancyRate} · ${dam.sourceName || (isEn ? "Local Press/DSİ" : "Yerel Basın/DSİ")}${shortDate ? ` (${translate(shortDate)})` : ""}`
              : hasRate
              ? `${t(dam.name)} (${localizedCap}): %${effectiveRate} · ${isEn ? "DSİ / MUSKİ 2024 Reference Data" : "DSİ / MUSKİ 2024 Referans Verisi"}`
              : `${t(dam.name)} (${localizedCap}) · ${isEn ? "Awaiting official live measurement" : "Canlı resmi ölçüm bekleniyor"}`;

            return (
              <div
                key={dam.id}
                title={rowTitle}
                className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
                  isDistrictMatch
                    ? "bg-primary/15 border border-primary/40"
                    : "bg-muted/20"
                }`}
              >
                <span className="text-[10px] font-mono text-foreground/80 w-28 truncate shrink-0">
                  {t(dam.name)}
                </span>
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  {hasRate && (
                    <div
                      className={`h-full rounded-full transition-all ${
                        rate >= 60 ? "bg-success" : rate >= 45 ? "bg-warning" : "bg-destructive"
                      } ${!isDamLive ? "opacity-75" : ""}`}
                      style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] font-mono font-bold tabular-nums-stat w-9 text-right ${
                    !hasRate
                      ? "text-muted-foreground"
                      : rate >= 60
                      ? "text-success"
                      : rate >= 45
                      ? "text-warning"
                      : "text-destructive"
                  }`}
                >
                  {hasRate ? `${effectiveRate}%` : "—"}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground w-20 text-right shrink-0">
                  {localizedCap}
                </span>
              </div>
            );
          })}
        </div>
        {waterAlerts.length > 0 && (
          <div className="mb-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-2 space-y-1">
            {waterAlerts.slice(0, 2).map((wa, idx) => (
              <div key={idx} className="text-[10px] font-mono leading-snug">
                <span className="font-bold text-cyan-300">
                  💧 {translate(wa.title)} ({wa.districtName}):{" "}
                </span>
                <span className="text-foreground/90">{translate(wa.detail)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[8px] font-mono text-muted-foreground/75 mt-2" data-testid="dam-source-note">
          {hasVerifiedLiveData
            ? translate(latestSourceSummary)
            : isEn
            ? "No live official measurement · Showing DSİ / MUSKİ 2024 reference levels (8 verified Muğla dams)"
            : "Canlı resmi ölçüm yok · DSİ / MUSKİ 2024 referans doluluk verileri gösteriliyor (8 doğrulamalı Muğla barajı)"}
        </p>
      </DashboardPanel>
    </div>
  );
};
