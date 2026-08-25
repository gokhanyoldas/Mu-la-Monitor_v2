import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardHeader, type DashboardTab } from "@/components/dashboard/DashboardHeader";
import { EconomySection } from "@/components/dashboard/sections/EconomySection";
import { EnvironmentSection } from "@/components/dashboard/sections/EnvironmentSection";
import { TourismSection } from "@/components/dashboard/sections/TourismSection";
import { SocialSection } from "@/components/dashboard/sections/SocialSection";
import { TransportSection } from "@/components/dashboard/sections/TransportSection";
import { FlightTrackerSection } from "@/components/dashboard/sections/FlightTrackerSection";
import { BusScheduleSection } from "@/components/dashboard/sections/BusScheduleSection";
import { EnergySection } from "@/components/dashboard/sections/EnergySection";
import { SecuritySection } from "@/components/dashboard/sections/SecuritySection";
import { CultureAgriSection } from "@/components/dashboard/sections/CultureAgriSection";
import { SocialIntelSection } from "@/components/dashboard/sections/SocialIntelSection";
import { GastronomySection } from "@/components/dashboard/sections/GastronomySection";
import { TrafficDensityMap } from "@/components/dashboard/sections/TrafficDensityMap";
import { ProtocolSection } from "@/components/dashboard/sections/ProtocolSection";
import { TrendTopicsSection } from "@/components/dashboard/sections/TrendTopicsSection";
import { LocalGovBudgetSection } from "@/components/dashboard/sections/LocalGovBudgetSection";
import { useLiveData } from "@/hooks/useLiveData";
import { SmartCard } from "@/components/intelligence/SmartCard";
import { LiveIndicator } from "@/components/intelligence/LiveIndicator";
// M10: Deprem Erken Uyarı Banner
import { EarthquakeAlertBanner } from "@/components/EarthquakeAlertBanner";
// M11: Yangın Risk Göstergesi
import { FireRiskIndicator } from "@/components/FireRiskIndicator";
// M9: Turizm Tahmin Modeli
import { TourismForecastPanel } from "@/components/TourismForecastPanel";
// M15: Kullanıcı Profil Paneli
import { UserProfilePanel } from "@/components/UserProfilePanel";
import { ProactiveBrainSection } from "@/components/dashboard/sections/ProactiveBrainSection";
// Şehir Nabzı: tüm canlı veri katmanlarını birleştiren AI brifingi
import { AISummaryCard } from "@/components/AISummaryCard";

const sectionComponents: Record<Exclude<DashboardTab, "genel">, React.FC[]> = {
  ekonomi: [EconomySection],
  cevre: [EnvironmentSection],
  turizm: [TourismSection, GastronomySection, CultureAgriSection],
  ulasim: [TrafficDensityMap, FlightTrackerSection, BusScheduleSection, TransportSection],
  sosyal: [TrendTopicsSection, SocialIntelSection, SocialSection],
  guvenlik: [SecuritySection, LocalGovBudgetSection],
  enerji: [EnergySection],
  protokol: [ProtocolSection],
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("genel");
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["ekonomi","cevre","turizm","ulasim","sosyal","guvenlik","enerji","protokol"].includes(tab)) {
      setActiveTab(tab as DashboardTab);
    }
  }, [searchParams]);

  const [liveStatuses, setLiveStatuses] = useState<Record<string, boolean>>({});

  const { data: weatherData } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
  const { data: ecoData } = useLiveData<any>("economy", { refetchInterval: 30 * 60 * 1000 });
  const { data: aqData } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
  const { data: damData } = useLiveData<any>("dams", { refetchInterval: 60 * 60 * 1000 });
  const { data: tourismData } = useLiveData<any>("tourism", { refetchInterval: 60 * 60 * 1000 });
  const { data: demoData } = useLiveData<any>("demographics", { refetchInterval: 24 * 60 * 60 * 1000 });

  const population     = demoData?.population ?? "1.02M";
  const annualTourists = tourismData?.annual_tourists ?? "3.8M";
  const unemployment   = ecoData?.unemployment_rate ? `${ecoData.unemployment_rate}%` : "11.2%";
  const temperature    = weatherData?.temperature ? `${weatherData.temperature}°C` : "14°C";
  const aqi            = aqData?.aqi ?? 42;
  const hotelOccupancy = tourismData?.hotel_occupancy ? `${tourismData.hotel_occupancy}%` : "38%";
  const dams           = Array.isArray(damData) ? damData : damData?.dams || [];
  const avgDam         = dams.length > 0
    ? `${Math.round(dams.reduce((a: number, d: any) => a + (d.occupancy_rate ?? d.rate ?? 50), 0) / dams.length)}%`
    : "54%";

  const isGenel = activeTab === "genel";

  return (
    <div className="min-h-screen bg-background scanline">
      <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* M10: Earthquake banner — always visible above main content */}
      <EarthquakeAlertBanner />

      <main className="p-3 max-w-[1800px] mx-auto">
        {/* Top summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {[
            { label: "Nüfus",       value: population,     color: "text-primary",     category: "demographics" },
            { label: "Turist/Yıl",  value: annualTourists, color: "text-accent",      category: "tourism" },
            { label: "İşsizlik",    value: unemployment,   color: "text-warning",     category: "economy" },
            { label: "Hava",        value: temperature,    color: "text-foreground",  category: "weather" },
            { label: "AQI",         value: String(aqi),    color: "text-success",     category: "air_quality" },
            { label: "Otel Doluluk",value: hotelOccupancy, color: "text-accent",      category: "tourism" },
            { label: "Baraj",       value: avgDam,         color: "text-warning",     category: "dams" },
            { label: "Güvenlik",    value: "78/100",       color: "text-primary",     category: "security" },
          ].map((item) => (
            <SmartCard key={item.label} category={item.category as any} onDataUpdate={(_, isLive) => {
              setLiveStatuses(prev => ({ ...prev, [item.label]: isLive }));
            }}>
              <div className="bg-secondary/30 border border-border/50 rounded-md px-2.5 py-1.5 text-center group relative">
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</div>
                <div className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</div>
                {liveStatuses[item.label] && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            </SmartCard>
          ))}
        </div>

        {isGenel ? (
          <div className="space-y-3">
            <AISummaryCard type="pulse" />
            <ProactiveBrainSection />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {/* Col 1 — Economy + Social */}
              <div className="space-y-3">
                <SmartCard category="economy"><EconomySection /></SmartCard>
                <SmartCard category="social"><SocialIntelSection /></SmartCard>
                <SmartCard category="social"><SocialSection /></SmartCard>
              </div>
              {/* Col 2 — Environment + FireRisk + Energy + Security */}
              <div className="space-y-3">
                <SmartCard category="environment"><EnvironmentSection /></SmartCard>
                {/* M11: Fire risk indicator */}
                <FireRiskIndicator />
                <SmartCard category="energy"><EnergySection /></SmartCard>
                <SmartCard category="security"><SecuritySection /></SmartCard>
              </div>
              {/* Col 3 — TourismForecast + Tourism + Culture + Transport */}
              <div className="space-y-3">
                {/* M9: Tourism forecast */}
                <TourismForecastPanel />
                <SmartCard category="tourism"><TourismSection /></SmartCard>
                <SmartCard category="culture"><CultureAgriSection /></SmartCard>
                <SmartCard category="transport"><TransportSection /></SmartCard>
              </div>
            </div>
          </div>
        ) : activeTab === "cevre" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SmartCard category="environment"><EnvironmentSection /></SmartCard>
            {/* M11: Fire risk in environment tab — self-start: hücre içeriği
                kadar yükseklik kaplar, altında boşluk kalmaz */}
            <div className="self-start">
              <FireRiskIndicator />
            </div>
          </div>
        ) : activeTab === "turizm" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
            {/* M9: Forecast first in tourism tab */}
            <TourismForecastPanel />
            <SmartCard category="tourism"><TourismSection /></SmartCard>
            <SmartCard category="tourism"><GastronomySection /></SmartCard>
            <SmartCard category="culture"><CultureAgriSection /></SmartCard>
            {/* Boşluk kapatıcı: 4 öğe 3 sütunda 2. satırda 1 hücre boş kalır;
                Tarım/Kültür panelleriyle aynı hizada denge sağlar */}
            <div className="hidden xl:block" aria-hidden="true" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {sectionComponents[activeTab as Exclude<DashboardTab, "genel">]?.map((Section, i) => (
              <div key={i} className="space-y-3">
                <SmartCard category={activeTab as any}><Section /></SmartCard>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-4 py-3 border-t border-border/50 text-center">
          <p className="text-[10px] font-mono text-muted-foreground">
            MUĞLA MONİTÖR v1.0 — Bölgesel İstihbarat Paneli — Intelligence Hub Powered ◆ Canlı veri akışı aktif
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
