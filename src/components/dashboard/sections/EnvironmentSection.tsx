import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Gauge } from "../Gauge";
import { StatusList } from "../StatusList";
import { DataFreshnessIndicator } from "@/components/DataFreshnessIndicator";
import { TreePine, Droplets, Wind, Loader as Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

const defaultDams = [
  { name: "Mumcular Barajı", rate: 48, capacity: "55 hm³" },
  { name: "Yedigöller Barajı", rate: 62, capacity: "42 hm³" },
  { name: "Geyik Barajı", rate: 71, capacity: "28 hm³" },
  { name: "Dalaman Barajı", rate: 58, capacity: "120 hm³" },
  { name: "Akköprü Barajı", rate: 44, capacity: "310 hm³" },
  { name: "Kemer Barajı", rate: 67, capacity: "178 hm³" },
  { name: "Yılanlı Barajı", rate: 53, capacity: "36 hm³" },
  { name: "Çamiçi Barajı", rate: 39, capacity: "18 hm³" },
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

  const w = weatherData || defaultWeather;
  const aq = airData || defaultAirQuality;
  const dams = (Array.isArray(damData) ? damData : damData?.dams || damData) || defaultDams;
  const damList = Array.isArray(dams) && dams.length > 0
    ? dams.map((d: any) => ({ name: d.name, rate: d.occupancy_rate ?? d.rate ?? 50, capacity: d.capacity ?? "", estimated: d.estimated ?? false }))
    : defaultDams;
  const isEstimated = damList.some((d: any) => d.estimated);

  const LiveBadge = ({ loading }: { loading: boolean }) =>
    loading ? <Loader2 size={10} className="animate-spin text-muted-foreground inline ml-1" /> : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <DashboardPanel title="Hava & İklim" icon={<Wind size={14} />} badge="CANLI" badgeVariant="live">
          <div className="absolute top-2 right-12 opacity-75">
            <DataFreshnessIndicator category="weather" size="sm" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard label="Sıcaklık" value={sv(w.temperature, 14)} unit="°C" variant="primary" />
          <StatCard label="Nem" value={sv(w.humidity, 68)} unit="%" />
          <StatCard label="Rüzgar" value={sv(w.windspeed ?? w.wind_speed, 22)} unit="km/h" />
          <StatCard label="UV İndeksi" value={sv(w.uv_index, 0)} variant="accent" />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Deniz Suyu" value={sv(w.sea_temp, 16)} unit="°C" variant="accent" />
          <StatCard label="Durum" value={w.condition || 'Açık'} />
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
          <LiveBadge loading={wLoading} />
        </DashboardPanel>
      </div>

      <div className="relative">
        <DashboardPanel title="Hava Kalitesi" badge={aq.quality_label || "İYİ"} badgeVariant="active">
          <div className="absolute top-2 right-12 opacity-75">
            <DataFreshnessIndicator category="air_quality" size="sm" />
          </div>
        <div className="flex justify-around">
          <Gauge value={aq.aqi} max={100} label="AQI" variant="primary" />
          <Gauge value={aq.pm25} max={50} label="PM2.5" variant="primary" />
          <Gauge value={aq.pm10} max={100} label="PM10" variant="primary" />
        </div>
          <LiveBadge loading={aLoading} />
        </DashboardPanel>
      </div>

      <div className="relative">
        <DashboardPanel title="Su & Orman" icon={<Droplets size={14} />} badge="CANLI" badgeVariant="live">
          <div className="absolute top-2 right-12 opacity-75">
            <DataFreshnessIndicator category="dams" size="sm" />
          </div>
        <div className="flex justify-around mb-3">
          <Gauge value={72} max={100} label="Orman Alan" unit="%" variant="primary" />
        </div>
         <span className="text-[9px] font-mono text-muted-foreground uppercase mb-2 block">
           Baraj Doluluk Oranları {isEstimated && <span className="text-warning">(Yağış Tahmini)</span>} <LiveBadge loading={dLoading} />
         </span>
        <div className="space-y-1.5 mb-3">
          {damList.map((dam: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/20">
              <span className="text-[10px] font-mono text-foreground/80 w-28 truncate shrink-0">{dam.name}</span>
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
        <StatusList items={[
          { label: "Yangın Riski", value: "DÜŞÜK", status: "ok" },
          { label: "Koruma Alanları", value: "12 bölge", status: "info" },
          { label: "Geri Dönüşüm Oranı", value: "34%", status: "warning" },
        ]} />
        </DashboardPanel>
      </div>

      <DashboardPanel title="Biyoçeşitlilik" icon={<TreePine size={14} />}>
        <StatusList items={[
          { label: "Endemik Türler", value: "156", status: "info" },
          { label: "Koruma Altında", value: "43 tür", status: "ok" },
          { label: "Caretta Caretta Yuvalama", value: "AKTİF", status: "ok" },
          { label: "Mavi Bayraklı Plaj", value: "87", status: "ok" },
        ]} />
      </DashboardPanel>
    </div>
  );
};
