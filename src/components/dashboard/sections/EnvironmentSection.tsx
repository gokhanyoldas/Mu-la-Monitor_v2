import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Gauge } from "../Gauge";
import { StatusList } from "../StatusList";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";
import { TreePine, Droplets, Wind, Flame, ShieldAlert, Loader as Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";

// Doğrulanmış liste: Wikipedia "Kategori:Muğla ilindeki barajlar" (8 baraj)
const defaultDams = [
  { name: "Mumcular Barajı",       rate: 35, capacity: "70.2 hm³" },
  { name: "Marmaris Barajı",       rate: 33, capacity: "32.1 hm³" },
  { name: "Geyik Barajı",          rate: 31, capacity: "48.5 hm³" },
  { name: "Akgedik Barajı",        rate: 30, capacity: "15.3 hm³" },
  { name: "Akköprü Barajı ve HES", rate: 38, capacity: "310 hm³" },
  { name: "Bayır Barajı",          rate: 34, capacity: "22.7 hm³" },
  { name: "Eşen 1 Barajı ve HES",  rate: 37, capacity: "41.2 hm³" },
  { name: "Eşen 2 Barajı ve HES",  rate: 36, capacity: "38.9 hm³" },
];

const defaultWeather = { temperature: 14, humidity: 68, wind_speed: 22, windspeed: 22, uv_index: 3, sea_temp: 16, condition: 'Açık' };

// Safe display value: returns String(v) if defined/non-null, else fallback
const sv = (v: any, fallback: number | string) =>
  v !== undefined && v !== null ? String(v) : String(fallback);
const defaultAirQuality = { aqi: 42, pm25: 15, pm10: 28, quality_label: "İyi" };

export const EnvironmentSection = () => {
  const { data: weatherData, isLoading: wLoading } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
  const { data: airData, isLoading: aLoading } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
  const { data: damData, isLoading: dLoading } = useLiveData<any>("dams", { refetchInterval: 60 * 60 * 1000 });

  // Son 24 saatteki yangın/çevre sosyal ve basın sinyalleri (çapraz teyit döngüsü)
  const [fireSignals, setFireSignals] = useState<{ count: number; latestHeadline?: string }>({ count: 0 });

  useEffect(() => {
    const fetchFireSignals = async () => {
      try {
        const since = new Date(Date.now() - 24 * 3600e3).toISOString();
        const { data } = await supabase
          .from("social_posts")
          .select("title, content, published_at")
          .gte("published_at", since)
          .order("published_at", { ascending: false })
          .limit(100);

        if (data && data.length > 0) {
          const keywords = ["yangın", "orman yangını", "duman", "alev", "itfaiye", "soğutma"];
          const matched = data.filter((p: any) => {
            const txt = `${p.title ?? ""} ${p.content ?? ""}`.toLowerCase();
            return keywords.some((kw) => txt.includes(kw));
          });
          setFireSignals({
            count: matched.length,
            latestHeadline: matched[0]?.title || matched[0]?.content?.slice(0, 50),
          });
        }
      } catch {
        // Sessiz hata yönetimi
      }
    };
    fetchFireSignals();
  }, []);

  const w = weatherData || defaultWeather;
  const aq = airData || defaultAirQuality;
  const dams = (Array.isArray(damData) ? damData : damData?.dams || damData) || defaultDams;
  const damList = Array.isArray(dams) && dams.length > 0
    ? dams.map((d: any) => ({
        name: d.name,
        rate: d.occupancy_rate ?? d.rate ?? 50,
        capacity: d.capacity_hm3 ? `${d.capacity_hm3} hm³` : d.capacity ?? "",
        district: d.district ?? "",
        estimated: d.estimated ?? false,
      }))
    : defaultDams;
  const isEstimated = damList.some((d: any) => d.estimated);

  const LiveBadge = ({ loading }: { loading: boolean }) =>
    loading ? <Loader2 size={10} className="animate-spin text-muted-foreground inline ml-1" /> : null;

  return (
    <div className="space-y-3">
      <WeatherClimatePanel />
      <AirQualityPanel />
      <WaterDamsPanel />
    </div>
  );
};

export const WeatherClimatePanel = () => {
  const { data: weatherData, isLoading: wLoading } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
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
  const { data: airData, isLoading: aLoading } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
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
  const { data: damData, isLoading: dLoading } = useLiveData<any>("dams", { refetchInterval: 60 * 60 * 1000 });
  const { data: weatherData } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
  const w = weatherData || defaultWeather;
  const hub = useOptionalUnifiedIntelligence();
  const waterAlerts = (hub?.arbitratedEvents ?? [])
    .map((e) => e.envWaterAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const [fireSignals, setFireSignals] = useState<{ count: number; latestHeadline?: string }>({ count: 0 });
  useEffect(() => {
    supabase.from("social_posts").select("title, content, published_at")
      .gte("published_at", new Date(Date.now() - 24 * 3600e3).toISOString())
      .limit(100).then(({ data }) => {
        if (data) {
          const keywords = ["yangın", "orman yangını", "duman", "alev", "itfaiye"];
          const matched = data.filter((p: any) => keywords.some(k => `${p.title} ${p.content}`.toLowerCase().includes(k)));
          setFireSignals({ count: matched.length, latestHeadline: matched[0]?.title });
        }
      }).catch(() => {});
  }, []);

  const dams = (Array.isArray(damData) ? damData : damData?.dams || damData) || defaultDams;
  const damList = Array.isArray(dams) && dams.length > 0
    ? dams.map((d: any) => ({
        name: d.name,
        rate: d.occupancy_rate ?? d.rate ?? 50,
        capacity: d.capacity_hm3 ? `${d.capacity_hm3} hm³` : d.capacity ?? "",
        district: d.district ?? "",
        estimated: d.estimated ?? false,
      }))
    : defaultDams;
  const isEstimated = damList.some((d: any) => d.estimated);

  return (
    <div className="relative">
      <DashboardPanel title="Su & Barajlar" icon={<Droplets size={14} />} badge={isEstimated ? "TAHMİN" : "DSİ"} badgeVariant={isEstimated ? "warning" : "info"}>
        <div className="space-y-1.5 mb-3">
          {damList.map((dam: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/20">
              <span className="text-[10px] font-mono text-foreground/80 w-28 truncate shrink-0">{t(dam.name)}</span>
              <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    dam.rate >= 60 ? "bg-success" : dam.rate >= 45 ? "bg-warning" : "bg-destructive"
                  }`}
                  style={{ width: `${dam.rate}%` }}
                />
              </div>
              <span className={`text-[10px] font-mono font-bold w-8 text-right ${
                dam.rate >= 60 ? "text-success" : dam.rate >= 45 ? "text-warning" : "text-destructive"
              }`}>{dam.rate}%</span>
              <span className="text-[9px] font-mono text-muted-foreground w-14 text-right">{dam.capacity}</span>
            </div>
          ))}
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
        <p className="text-[8px] font-mono text-muted-foreground/70 mt-2">
          Kaynak: DSİ baraj işletme verileri (saatlik) {isEstimated && "· yağış tahminli dönem"}
        </p>
      </DashboardPanel>
    </div>
  );
};

