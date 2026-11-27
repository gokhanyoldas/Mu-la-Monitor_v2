// M11: EFFIS Yangın Riski Göstergesi
// Kaynak: Open-Meteo AQI API (ücretsiz) + Hesaplanan FWI (Fire Weather Index)
// EFFIS/Copernicus verisi doğrudan JSON endpoint olarak erişilebilir değil (WMS only)
// Bu yüzden Türkiye orman yangın riski = Open-Meteo hava verisi ile hesaplanan FWI kullanıyoruz
// FWI bileşenleri: FFMC, DMC, DC, ISI, BUI → ağırlıklı skor

import { useEffect, useState } from "react";
import { Flame, Wind, Droplets, Thermometer, Info } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { useTranslation } from "@/hooks/useTranslation";

interface FireRiskData {
  fwi_score: number;     // 0-100 hesaplanan skor
  danger_level: "çok düşük" | "düşük" | "orta" | "yüksek" | "çok yüksek" | "aşırı";
  temperature: number;
  relative_humidity: number;
  wind_speed: number;
  precipitation: number; // last 24h mm
  lastUpdated: string;
  source: string;
}

// Simplified Fire Weather Index calculation
// Based on Canadian FWI system components adapted for Aegean Turkey
function calculateFWI(temp: number, rh: number, wind: number, precip: number): number {
  const ffmc = Math.max(0, Math.min(100,
    (temp * 0.65) + ((100 - rh) * 0.35) - precip * 8
  ));

  const isi = wind * 0.4 + Math.max(0, ffmc - 50) * 0.2;

  const month = new Date().getMonth(); // 0=Jan
  const seasonFactor = [0.3, 0.3, 0.4, 0.5, 0.7, 0.85, 1.0, 1.0, 0.9, 0.6, 0.4, 0.3][month];
  const bui = seasonFactor * 100 * Math.max(0, 1 - rh / 100);

  const fwi = (isi * 0.4 + bui * 0.6) * seasonFactor;
  return Math.round(Math.min(fwi, 100));
}

function fwiToLevel(score: number): FireRiskData["danger_level"] {
  if (score >= 80) return "aşırı";
  if (score >= 65) return "çok yüksek";
  if (score >= 45) return "yüksek";
  if (score >= 25) return "orta";
  if (score >= 10) return "düşük";
  return "çok düşük";
}

const LEVEL_CONFIG = {
  "çok düşük": { color: "text-blue-400", bg: "bg-blue-500/20", bar: "bg-blue-400", emoji: "🟦" },
  "düşük":     { color: "text-green-400", bg: "bg-green-500/20", bar: "bg-green-400", emoji: "🟢" },
  "orta":      { color: "text-yellow-400", bg: "bg-yellow-500/20", bar: "bg-yellow-400", emoji: "🟡" },
  "yüksek":    { color: "text-orange-400", bg: "bg-orange-500/20", bar: "bg-orange-400", emoji: "🟠" },
  "çok yüksek":{ color: "text-red-400", bg: "bg-red-500/20", bar: "bg-red-400", emoji: "🔴" },
  "aşırı":     { color: "text-red-300", bg: "bg-red-700/40", bar: "bg-red-500", emoji: "🔥" },
};

export const FireRiskIndicator = () => {
  const { t, translate } = useTranslation();
  const [data, setData] = useState<FireRiskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await window.fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=37.2153&longitude=28.3636" +
          "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation" +
          "&daily=precipitation_sum&timezone=Europe%2FIstanbul&forecast_days=1",
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return;
        const d = await res.json();
        const cur = d.current ?? {};
        const temp   = cur.temperature_2m ?? 25;
        const rh     = cur.relative_humidity_2m ?? 40;
        const wind   = cur.wind_speed_10m ?? 10;
        const precip = cur.precipitation ?? 0;
        const score  = calculateFWI(temp, rh, wind, precip);
        setData({
          fwi_score: score,
          danger_level: fwiToLevel(score),
          temperature: temp,
          relative_humidity: rh,
          wind_speed: wind,
          precipitation: precip,
          lastUpdated: new Date().toISOString(),
          source: "Open-Meteo + FWI Modeli",
        });
      } catch { /* silent */ }
      finally { setIsLoading(false); }
    };
    fetch();
    const iv = setInterval(fetch, 30 * 60 * 1000); // 30 min
    return () => clearInterval(iv);
  }, []);

  const normalizedDangerLevel = String(data?.danger_level ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR") as FireRiskData["danger_level"];
  const level = data ? (LEVEL_CONFIG[normalizedDangerLevel] ?? LEVEL_CONFIG["orta"]) : null;

  return (
    <DashboardPanel
      title="Orman Yangın Risk Göstergesi"
      icon={<Flame size={14} />}
      badge={data?.danger_level ? t(data.danger_level.toUpperCase()) : ""}
      badgeVariant={
        data
          ? data.fwi_score >= 65 ? "live"
          : data.fwi_score >= 25 ? "warning"
          : "active"
        : "info"
      }
    >
      {isLoading ? (
        <div className="space-y-1.5">
          {[1,2,3].map(i => <div key={i} className="h-6 rounded bg-muted/20 animate-pulse" />)}
        </div>
      ) : data && level ? (
        <>
          {/* Risk bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xl font-mono font-bold ${level.color}`}>
                {level.emoji} {t(data.danger_level.toUpperCase())}
              </span>
              <span className={`text-xs font-mono font-bold ${level.color}`}>
                FWI {data.fwi_score}/100
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${level.bar}`}
                style={{ width: `${data.fwi_score}%` }}
              />
            </div>
            {/* Scale labels */}
            <div className="flex justify-between mt-0.5 text-[7px] font-mono text-muted-foreground">
              <span>{t("ÇOK DÜŞÜK", "Çok Düşük")}</span>
              <span>{t("ORTA", "Orta")}</span>
              <span>{t("YÜKSEK", "Yüksek")}</span>
              <span>{t("AŞIRI", "Aşırı")}</span>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { icon: <Thermometer size={10} />, label: t("Sıcaklık"), value: `${data.temperature}°C` },
              { icon: <Droplets size={10} />,    label: t("Nem"),       value: `${data.relative_humidity}%` },
              { icon: <Wind size={10} />,        label: t("Rüzgar"),    value: `${data.wind_speed} km/h` },
              { icon: <Droplets size={10} />,    label: t("Yağış"),     value: `${data.precipitation} mm` },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/20">
                <span className="text-muted-foreground">{m.icon}</span>
                <div>
                  <div className="text-[8px] font-mono text-muted-foreground">{m.label}</div>
                  <div className="text-[10px] font-mono font-bold">{m.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Seasonal warning */}
          {new Date().getMonth() >= 5 && new Date().getMonth() <= 8 && (
            <div className="flex items-start gap-1.5 p-2 rounded bg-orange-500/10 border border-orange-500/20">
              <Info size={10} className="text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] font-mono text-orange-300/80">
                {translate("Haziran–Eylül arasında Muğla'da yangın riski yüksektir. AFAD uyarılarını takip edin.")}
              </p>
            </div>
          )}

          <div className="tech-meta-only flex items-center justify-between mt-2">
            <DataSourceBadge type="estimate" lastUpdated={data.lastUpdated} />
            <span className="text-[8px] font-mono text-muted-foreground">
              {t("source", "Kaynak")}: {translate(data.source.replace("FWI Modeli", t("FWI Modeli", "FWI Model")))}
            </span>
          </div>
        </>
      ) : (
        <p className="text-[10px] font-mono text-muted-foreground text-center py-4">
          {t("no_data", "Veri alınamadı")}
        </p>
      )}
    </DashboardPanel>
  );
};
