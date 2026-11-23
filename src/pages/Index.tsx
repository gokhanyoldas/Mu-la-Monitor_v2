import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { DashboardHeader, type DashboardTab } from "@/components/dashboard/DashboardHeader";
import { EconomySection } from "@/components/dashboard/sections/EconomySection";
import { EnvironmentSection } from "@/components/dashboard/sections/EnvironmentSection";
import {
  TourismSection,
  TourismMovementPanel,
  AccommodationPanel,
  VisitorProfilePanel,
} from "@/components/dashboard/sections/TourismSection";
import {
  SocialSection,
  DemographicsPanel,
  EducationPanel,
  HealthPanel,
  LifeQualityPanel,
} from "@/components/dashboard/sections/SocialSection";
import {
  TransportSection,
  TrafficSummaryPanel,
  AirportsSummaryPanel,
  InfrastructureProjectsPanel,
} from "@/components/dashboard/sections/TransportSection";
import { FlightTrackerSection } from "@/components/dashboard/sections/FlightTrackerSection";
import { BusScheduleSection } from "@/components/dashboard/sections/BusScheduleSection";
import {
  EnergySection,
  EnergyConsumptionPanel,
  RenewableEnergyPanel,
  SustainabilityPanel,
} from "@/components/dashboard/sections/EnergySection";
import {
  SecuritySection,
  SecurityOverviewPanel,
  RadarTrafficMapPanel,
  EmergencyPanel,
  LocalGovQuickPanel,
} from "@/components/dashboard/sections/SecuritySection";
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
// Şehir Özeti: güncel şehir durumunu tek kartta toplar
import { AISummaryCard } from "@/components/AISummaryCard";
import { InvestigationHub } from "@/components/investigation/InvestigationHub";
import { MuglaNetworkDiagram } from "@/components/dashboard/MuglaNetworkDiagram";
import { ProtocolNetworkGraph } from "@/components/network/ProtocolNetworkGraph";

import { EconomyOverviewPanel, RealEstatePanel } from "@/components/dashboard/sections/EconomySection";
import { WeatherClimatePanel, AirQualityPanel, WaterDamsPanel } from "@/components/dashboard/sections/EnvironmentSection";
import { useDamIntelligence } from "@/services/topicGroundingService";
import { AgriculturePanel, CultureEventsPanel, CulturalHeritagePanel } from "@/components/dashboard/sections/CultureAgriSection";

// Her sekme yalnızca kendi ana konusunu tekrarsız ve bol boşluklu gösterir
const getTwoColumnTabContent = (tab: Exclude<DashboardTab, "genel" | "protokol" | "diyagram" | "ag_grafigi">): { col1: React.ReactNode[]; col2: React.ReactNode[] } => {
  switch (tab) {
    case "ekonomi":
      return {
        col1: [
          <SmartCard key="eco-main" category="economy"><EconomyOverviewPanel /></SmartCard>,
          <SmartCard key="eco-agri" category="culture"><AgriculturePanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="eco-re" category="economy"><RealEstatePanel /></SmartCard>,
          <SmartCard key="eco-budget" category="economy"><LocalGovBudgetSection /></SmartCard>,
        ],
      };
    case "cevre":
      return {
        col1: [
          <SmartCard key="env-weather" category="weather"><WeatherClimatePanel /></SmartCard>,
          <SmartCard key="env-aq" category="air_quality"><AirQualityPanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="env-dams" category="dams"><WaterDamsPanel /></SmartCard>,
          <SmartCard key="env-fire" category="environment"><FireRiskIndicator /></SmartCard>,
        ],
      };
    case "turizm":
      return {
        col1: [
          <SmartCard key="tour-main" category="tourism"><TourismMovementPanel /></SmartCard>,
          <SmartCard key="tour-acc" category="tourism"><AccommodationPanel /></SmartCard>,
          <SmartCard key="tour-forecast" category="tourism"><TourismForecastPanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="tour-visitor" category="tourism"><VisitorProfilePanel /></SmartCard>,
          <SmartCard key="tour-gastro" category="tourism"><GastronomySection /></SmartCard>,
          <SmartCard key="tour-heritage" category="culture"><CulturalHeritagePanel /></SmartCard>,
        ],
      };
    case "ulasim":
      return {
        col1: [
          <SmartCard key="trans-traffic" category="transport"><TrafficDensityMap /></SmartCard>,
          <SmartCard key="trans-works" category="transport"><InfrastructureProjectsPanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="trans-flight" category="transport"><FlightTrackerSection /></SmartCard>,
          <SmartCard key="trans-bus" category="transport"><BusScheduleSection /></SmartCard>,
        ],
      };
    case "sosyal":
      return {
        col1: [
          <SmartCard key="soc-intel" category="social"><SocialIntelSection /></SmartCard>,
          <SmartCard key="soc-trend" category="social"><TrendTopicsSection /></SmartCard>,
          <SmartCard key="soc-demo" category="demographics"><DemographicsPanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="soc-edu" category="demographics"><EducationPanel /></SmartCard>,
          <SmartCard key="soc-health" category="demographics"><HealthPanel /></SmartCard>,
          <SmartCard key="soc-life" category="demographics"><LifeQualityPanel /></SmartCard>,
          <SmartCard key="soc-events" category="culture"><CultureEventsPanel /></SmartCard>,
        ],
      };
    case "guvenlik":
      return {
        col1: [
          <SmartCard key="sec-overview" category="security"><SecurityOverviewPanel /></SmartCard>,
          <SmartCard key="sec-emergency" category="security"><EmergencyPanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="sec-radar" category="security"><RadarTrafficMapPanel /></SmartCard>,
          <SmartCard key="sec-localgov" category="economy"><LocalGovQuickPanel /></SmartCard>,
        ],
      };
    case "enerji":
      return {
        col1: [
          <SmartCard key="en-consumption" category="energy"><EnergyConsumptionPanel /></SmartCard>,
          <SmartCard key="en-sust" category="energy"><SustainabilityPanel /></SmartCard>,
        ],
        col2: [
          <SmartCard key="en-renew" category="energy"><RenewableEnergyPanel /></SmartCard>,
        ],
      };
  }
};

// Genel Bakış için Sütun 1 - 2 - 3 Ferah Özet Düzeni (tekrarsız 6 temel gösterge)
export type ColumnLayout = {
  col1: string[];
  col2: string[];
  col3: string[];
};

export const DEFAULT_COLUMNS: ColumnLayout = {
  col1: ["traffic", "weather"],
  col2: ["economy", "dams"],
  col3: ["tourism_forecast", "social_trends"],
};

const PANEL_REGISTRY: Record<string, { title: string; category: string; component: React.ReactNode }> = {
  // Saha, Çevre & Meteoroloji
  traffic: { title: "Trafik Yoğunluk Haritası", category: "transport", component: <TrafficDensityMap /> },
  weather: { title: "Hava & İklim", category: "weather", component: <WeatherClimatePanel /> },
  air_quality: { title: "Hava Kalitesi (AQI)", category: "air_quality", component: <AirQualityPanel /> },
  fire_risk: { title: "Yangın Riski Göstergesi", category: "environment", component: <FireRiskIndicator /> },
  dams: { title: "Su & Barajlar", category: "dams", component: <WaterDamsPanel /> },

  // Ekonomi, Bütçe & Tarım
  economy: { title: "Ekonomi & İstihdam", category: "economy", component: <EconomyOverviewPanel /> },
  real_estate: { title: "Gayrimenkul & İlanlar", category: "economy", component: <RealEstatePanel /> },
  agriculture: { title: "Tarım & Üretim", category: "culture", component: <AgriculturePanel /> },
  local_budget: { title: "Yerel Yönetim Bütçeleri", category: "economy", component: <LocalGovBudgetSection /> },

  // Turizm, Kültür & Ulaşım (Ayrıştırılmış Bağımsız Göstergeler)
  tourism_forecast: { title: "Turizm Tahmin Modeli", category: "tourism", component: <TourismForecastPanel /> },
  tourism_general: { title: "Turizm Hareketliliği", category: "tourism", component: <TourismMovementPanel /> },
  accommodation: { title: "Konaklama & Oteller", category: "tourism", component: <AccommodationPanel /> },
  visitor_profile: { title: "Ziyaretçi Profili", category: "tourism", component: <VisitorProfilePanel /> },
  gastronomy: { title: "Muğla Gastronomisi", category: "tourism", component: <GastronomySection /> },
  flight_tracker: { title: "Canlı Uçuş Takibi", category: "transport", component: <FlightTrackerSection /> },
  traffic_summary: { title: "Ulaşım & Trafik Özeti", category: "transport", component: <TrafficSummaryPanel /> },
  airports: { title: "Havalimanları (DLM/BJV)", category: "transport", component: <AirportsSummaryPanel /> },
  transport_works: { title: "Yol & Altyapı Projeleri", category: "transport", component: <InfrastructureProjectsPanel /> },
  bus_schedule: { title: "Şehirlerarası Otobüs Seferleri", category: "transport", component: <BusScheduleSection /> },

  // Toplum, Enerji & Miras (Ayrıştırılmış Bağımsız Göstergeler)
  energy_consumption: { title: "Enerji & Tüketim", category: "energy", component: <EnergyConsumptionPanel /> },
  renewable_energy: { title: "Yenilenebilir Enerji", category: "energy", component: <RenewableEnergyPanel /> },
  sustainability: { title: "Sürdürülebilirlik", category: "energy", component: <SustainabilityPanel /> },
  energy: { title: "Enerji & Tüketim", category: "energy", component: <EnergyConsumptionPanel /> },
  social_trends: { title: "Sosyal İstihbarat", category: "social", component: <SocialIntelSection /> },
  trend_topics: { title: "Gündemdeki Başlıklar", category: "social", component: <TrendTopicsSection /> },
  demographics: { title: "Nüfus & Demografi", category: "demographics", component: <DemographicsPanel /> },
  education: { title: "Eğitim", category: "demographics", component: <EducationPanel /> },
  health: { title: "Sağlık", category: "demographics", component: <HealthPanel /> },
  life_quality: { title: "Yaşam Kalitesi", category: "demographics", component: <LifeQualityPanel /> },
  culture_events: { title: "Kültür & Etkinlikler", category: "culture", component: <CultureEventsPanel /> },
  heritage: { title: "Kültürel Miras", category: "culture", component: <CulturalHeritagePanel /> },

  // Güvenlik & Protokol (Ayrıştırılmış Bağımsız Göstergeler)
  security: { title: "Asayiş & Güvenlik", category: "security", component: <SecurityOverviewPanel /> },
  radar_map: { title: "Radar & Trafik Denetim Haritası", category: "security", component: <RadarTrafficMapPanel /> },
  emergency: { title: "Acil Durum & Kriz", category: "security", component: <EmergencyPanel /> },
  local_gov_quick: { title: "Yerel Yönetim", category: "economy", component: <LocalGovQuickPanel /> },
  protocol: { title: "Muğla İl Protokol Listesi", category: "protocol", component: <ProtocolSection /> },
  network_diagram: { title: "Kentsel Ağ & İstihbarat Merkezi", category: "transport", component: <InvestigationHub /> },
};

const DEFAULT_METRIC_ORDER = [
  "Nüfus", "Turist/Yıl", "İşsizlik", "Hava", "AQI", "Otel Doluluk", "Baraj", "Güvenlik"
];

const Index = () => {
  const { t, translate } = useTranslation();
  const [activeTab, setActiveTab] = useState<DashboardTab>("genel");
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["ekonomi","cevre","turizm","ulasim","sosyal","guvenlik","enerji","protokol","diyagram","ag_grafigi"].includes(tab)) {
      setActiveTab(tab as DashboardTab);
    }
  }, [searchParams]);

  const [liveStatuses, setLiveStatuses] = useState<Record<string, boolean>>({});

  // Apple Stili Düzenleme Modu (Genel Bakış)
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Genel Bakış için ferah Sütun 1 - 2 - 3 yerleşim durumu
  const [columns, setColumns] = useState<ColumnLayout>(() => {
    try {
      const savedV7 = localStorage.getItem("mugla_dashboard_columns_v7");
      if (savedV7) return JSON.parse(savedV7);
    } catch {}
    return DEFAULT_COLUMNS;
  });

  // Üst Sayaç Göstergeleri Sıralaması
  const [metricOrder, setMetricOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("mugla_metric_order_v3");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_METRIC_ORDER;
  });

  const [draggedWidget, setDraggedWidget] = useState<{
    fromCol: "col1" | "col2" | "col3";
    fromIdx: number;
    widgetId: string;
  } | null>(null);

  const [dragOverTarget, setDragOverTarget] = useState<{
    colKey: "col1" | "col2" | "col3";
    targetIdx: number;
  } | null>(null);

  const [draggedMetricIndex, setDraggedMetricIndex] = useState<number | null>(null);

  const saveColumns = (newCols: ColumnLayout) => {
    setColumns(newCols);
    try {
      localStorage.setItem("mugla_dashboard_columns_v7", JSON.stringify(newCols));
    } catch {}
  };

  const saveMetricOrder = (newOrder: string[]) => {
    setMetricOrder(newOrder);
    try {
      localStorage.setItem("mugla_metric_order_v3", JSON.stringify(newOrder));
    } catch {}
  };

  // Sütun içinde yukarı / aşağı taşıma
  const moveWithinCol = (colKey: "col1" | "col2" | "col3", index: number, delta: number) => {
    const list = [...columns[colKey]];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
    saveColumns({ ...columns, [colKey]: list });
  };

  // Farklı bir sütuna taşıma
  const moveToCol = (fromCol: "col1" | "col2" | "col3", toCol: "col1" | "col2" | "col3", widgetId: string) => {
    if (fromCol === toCol) return;
    const fromList = columns[fromCol].filter(id => id !== widgetId);
    const toList = [...columns[toCol], widgetId];
    saveColumns({
      ...columns,
      [fromCol]: fromList,
      [toCol]: toList,
    });
  };

  // Sütunlar arası tek tıkla kaydırma (Mobil / Dokunmatik dostu)
  const shiftCol = (fromCol: "col1" | "col2" | "col3", direction: -1 | 1, widgetId: string) => {
    const colOrder: Array<"col1" | "col2" | "col3"> = ["col1", "col2", "col3"];
    const curIdx = colOrder.indexOf(fromCol);
    const targetIdx = curIdx + direction;
    if (targetIdx >= 0 && targetIdx < colOrder.length) {
      moveToCol(fromCol, colOrder[targetIdx], widgetId);
    }
  };

  // Genel Bakış düzenini varsayılana sıfırlama
  const resetToDefaultColumns = () => {
    saveColumns(DEFAULT_COLUMNS);
    saveMetricOrder(DEFAULT_METRIC_ORDER);
    setDragOverTarget(null);
    setDraggedWidget(null);
  };

  // Sürükle ve Bırak Olayları (Apple Stili Görsel Geri Bildirim)
  const handleWidgetDragStart = (
    e: React.DragEvent,
    fromCol: "col1" | "col2" | "col3",
    fromIdx: number,
    widgetId: string
  ) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "widget", fromCol, fromIdx, widgetId }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedWidget({ fromCol, fromIdx, widgetId });
  };

  const handleWidgetDragOver = (
    e: React.DragEvent,
    colKey: "col1" | "col2" | "col3",
    targetIdx: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverTarget?.colKey !== colKey || dragOverTarget?.targetIdx !== targetIdx) {
      setDragOverTarget({ colKey, targetIdx });
    }
  };

  const handleWidgetDrop = (
    e: React.DragEvent,
    targetCol: "col1" | "col2" | "col3",
    targetIdx?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let dragData = draggedWidget;
    if (!dragData) {
      try {
        const raw = e.dataTransfer.getData("text/plain");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.type === "widget") dragData = parsed;
        }
      } catch {}
    }

    setDragOverTarget(null);
    if (!dragData) return;
    const { fromCol, fromIdx, widgetId } = dragData;

    if (fromCol === targetCol) {
      if (targetIdx === undefined || targetIdx === fromIdx) {
        setDraggedWidget(null);
        return;
      }
      const list = [...columns[fromCol]];
      const [item] = list.splice(fromIdx, 1);
      list.splice(targetIdx, 0, item);
      saveColumns({ ...columns, [fromCol]: list });
    } else {
      const fromList = columns[fromCol].filter((_, i) => i !== fromIdx);
      const toList = [...columns[targetCol]];
      const insertAt = targetIdx !== undefined ? targetIdx : toList.length;
      toList.splice(insertAt, 0, widgetId);
      saveColumns({
        ...columns,
        [fromCol]: fromList,
        [targetCol]: toList,
      });
    }

    setDraggedWidget(null);
  };

  // Üst gösterge sürükleme fonksiyonları
  const handleMetricDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "metric", index }));
    e.dataTransfer.effectAllowed = "move";
    setDraggedMetricIndex(index);
  };

  const handleMetricDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    let fromIndex = draggedMetricIndex;
    if (fromIndex === null) {
      try {
        const raw = e.dataTransfer.getData("text/plain");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.type === "metric") fromIndex = parsed.index;
        }
      } catch {}
    }

    if (fromIndex === null || fromIndex === targetIndex) return;

    const newOrder = [...metricOrder];
    const [moved] = newOrder.splice(fromIndex!, 1);
    newOrder.splice(targetIndex, 0, moved);
    saveMetricOrder(newOrder);
    setDraggedMetricIndex(null);
  };

  const { data: weatherData } = useLiveData<any>("weather", { refetchInterval: 15 * 60 * 1000 });
  const { data: ecoData } = useLiveData<any>("economy", { refetchInterval: 30 * 60 * 1000 });
  const { data: aqData } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
  const damIntel = useDamIntelligence();
  const { data: tourismData } = useLiveData<any>("tourism", { refetchInterval: 60 * 60 * 1000 });
  const { data: demoData } = useLiveData<any>("demographics", { refetchInterval: 24 * 60 * 60 * 1000 });

  const population     = demoData?.population ?? "1.02M";
  const annualTourists = tourismData?.annual_tourists ?? "3.8M";
  const unemployment   = ecoData?.unemployment_rate ? `${ecoData.unemployment_rate}%` : "11.2%";
  const temperature    = weatherData?.temperature ? `${weatherData.temperature}°C` : "14°C";
  const aqi            = aqData?.aqi ?? 42;
  const hotelOccupancy = tourismData?.hotel_occupancy ? `${tourismData.hotel_occupancy}%` : "38%";
  const avgDam         = damIntel.avgOccupancy !== null ? `${damIntel.avgOccupancy}%` : "—";

  const allMetricsMap: Record<string, { label: string; value: string; color: string; category: string }> = {
    "Nüfus": { label: "Nüfus", value: population, color: "text-primary", category: "demographics" },
    "Turist/Yıl": { label: "Turist/Yıl", value: annualTourists, color: "text-accent", category: "tourism" },
    "İşsizlik": { label: "İşsizlik", value: unemployment, color: "text-warning", category: "economy" },
    "Hava": { label: "Hava", value: temperature, color: "text-foreground", category: "weather" },
    "AQI": { label: "AQI", value: String(aqi), color: "text-success", category: "air_quality" },
    "Otel Doluluk": { label: "Otel Doluluk", value: hotelOccupancy, color: "text-accent", category: "tourism" },
    "Baraj": { label: "Baraj", value: avgDam, color: "text-warning", category: "dams" },
    "Güvenlik": { label: "Güvenlik", value: "78/100", color: "text-primary", category: "security" },
  };

  const isGenel = activeTab === "genel";
  const totalGenelWidgets = columns.col1.length + columns.col2.length + columns.col3.length;

  // Bağımsız Gösterge Kutucuğu Render Fonksiyonu
  const renderWidget = (
    colKey: "col1" | "col2" | "col3",
    widgetId: string,
    idx: number,
    totalCount: number
  ) => {
    const panelDef = PANEL_REGISTRY[widgetId];
    if (!panelDef) return null;

    const isBeingDragged = draggedWidget?.widgetId === widgetId;
    const isTargetSlot = dragOverTarget?.colKey === colKey && dragOverTarget?.targetIdx === idx;

    return (
      <div key={widgetId} className="flex flex-col">
        {/* Apple Stili Sürükleme Hedefi Çizgisi / Yeri */}
        {isTargetSlot && !isBeingDragged && (
          <div className="h-10 border-2 border-dashed border-cyan-400/90 bg-cyan-500/15 rounded-lg flex items-center justify-center text-[10px] font-mono text-cyan-300 font-bold animate-pulse mb-2 shadow-sm">
            + Buraya Yerleştir (#{idx + 1})
          </div>
        )}

        <div
          onDragOver={(e) => handleWidgetDragOver(e, colKey, idx)}
          onDrop={(e) => handleWidgetDrop(e, colKey, idx)}
          className={`group relative rounded-lg flex flex-col justify-between transition-all duration-200 ${
            isBeingDragged
              ? "opacity-35 scale-95 border border-dashed border-primary"
              : isEditMode
              ? "border border-primary/50 shadow-md ring-1 ring-primary/30 bg-card/85"
              : ""
          }`}
        >
          {/* Sürükle-bırak kontrol çubuğu yalnızca düzenleme modunda görünür (çift başlık gürültüsünü önler) */}
          {isEditMode && (
            <div
              draggable={true}
              onDragStart={(e) => handleWidgetDragStart(e, colKey, idx, widgetId)}
              className="flex items-center justify-between px-2.5 py-1.5 bg-secondary/60 hover:bg-secondary/90 border-b border-border/40 rounded-t-lg text-[10px] font-mono text-muted-foreground select-none cursor-grab active:cursor-grabbing transition-colors"
              title={t("Sürüklemek için bu başlıktan tutun", "Sürüklemek için bu başlıktan tutun")}
            >
              <span className="flex items-center gap-1.5 font-medium text-foreground/90">
                <span className="cursor-grab active:cursor-grabbing text-xs text-primary/80 hover:text-primary">⋮⋮</span>
                <span className="font-semibold">{t(panelDef.title)}</span>
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftCol(colKey, -1, widgetId)}
                  disabled={colKey === "col1"}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors"
                  title="Sola / Önceki sütuna taşı"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => moveWithinCol(colKey, idx, -1)}
                  disabled={idx === 0}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors"
                  title="Yukarı taşı"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveWithinCol(colKey, idx, 1)}
                  disabled={idx === totalCount - 1}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors"
                  title="Aşağı taşı"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => shiftCol(colKey, 1, widgetId)}
                  disabled={colKey === "col3"}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors"
                  title="Sağa / Sonraki sütuna taşı"
                >
                  ▶
                </button>
                <select
                  value={colKey}
                  onChange={(e) => moveToCol(colKey, e.target.value as "col1" | "col2" | "col3", widgetId)}
                  className="bg-background/90 border border-border/70 rounded px-1 py-0.5 text-[9px] text-foreground/90 focus:outline-none cursor-pointer"
                  title="Doğrudan sütun seç"
                >
                  <option value="col1">S.1</option>
                  <option value="col2">S.2</option>
                  <option value="col3">S.3</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex-1">
            <SmartCard category={panelDef.category as any}>
              {panelDef.component}
            </SmartCard>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background scanline">
      <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {/* M10: Earthquake banner — always visible above main content */}
      <EarthquakeAlertBanner />

      <main className="p-4 sm:p-5 max-w-[1680px] mx-auto">
        {/* Sade Üst Özet Çubuğu */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-5">
          {metricOrder.map((key, index) => {
            const item = allMetricsMap[key];
            if (!item) return null;
            return (
              <div
                key={item.label}
                draggable={isEditMode}
                onDragStart={(e) => handleMetricDragStart(e, index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => handleMetricDrop(e, index)}
                className={isEditMode ? "cursor-grab active:cursor-grabbing transition-transform hover:-translate-y-0.5" : ""}
              >
                <SmartCard category={item.category as any} onDataUpdate={(_, isLive) => {
                  setLiveStatuses(prev => ({ ...prev, [item.label]: isLive }));
                }}>
                  <div className="bg-secondary/25 border border-border/50 rounded-lg px-2.5 py-2 text-center hover:border-primary/40 transition-colors">
                    <div className="text-[10px] font-mono text-muted-foreground tracking-wide">
                      {t(item.label)}
                    </div>
                    <div className={`text-sm font-mono font-bold tabular-nums-stat mt-0.5 ${item.color}`}>{translate(item.value)}</div>
                  </div>
                </SmartCard>
              </div>
            );
          })}
        </div>

        <div className="space-y-5">
          {/* Genel Bakış: Sade Şehir Özeti + 3 Sütunlu Ferah Özet Kartları */}
          {isGenel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("Genel Bakış")}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(v => !v)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                      isEditMode
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {isEditMode ? t("Bitti (Koru)") : t("Düzeni Özelleştir")}
                  </button>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={resetToDefaultColumns}
                      className="px-2.5 py-1 rounded text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border/60"
                    >
                      {t("Düzeni Sıfırla")}
                    </button>
                  )}
                </div>
              </div>
              <AISummaryCard type="pulse" />
            </div>
          )}

          {isGenel ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
              {/* SÜTUN 1 */}
              <div
                className="flex flex-col space-y-5 min-h-[240px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => handleWidgetDrop(e, "col1", columns.col1.length)}
              >
                {columns.col1.map((widgetId, idx) =>
                  renderWidget("col1", widgetId, idx, columns.col1.length)
                )}

                {columns.col1.length === 0 && (
                  <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-border/40 rounded-lg text-xs text-muted-foreground">
                    {t("Göstergeyi buraya sürükleyin")}
                  </div>
                )}
              </div>

              {/* SÜTUN 2 */}
              <div
                className="flex flex-col space-y-5 min-h-[240px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => handleWidgetDrop(e, "col2", columns.col2.length)}
              >
                {columns.col2.map((widgetId, idx) =>
                  renderWidget("col2", widgetId, idx, columns.col2.length)
                )}

                {columns.col2.length === 0 && (
                  <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-border/40 rounded-lg text-xs text-muted-foreground">
                    {t("Göstergeyi buraya sürükleyin")}
                  </div>
                )}
              </div>

              {/* SÜTUN 3 */}
              <div
                className="flex flex-col space-y-5 min-h-[240px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => handleWidgetDrop(e, "col3", columns.col3.length)}
              >
                {columns.col3.map((widgetId, idx) =>
                  renderWidget("col3", widgetId, idx, columns.col3.length)
                )}

                {columns.col3.length === 0 && (
                  <div className="flex-1 flex items-center justify-center p-6 border border-dashed border-border/40 rounded-lg text-xs text-muted-foreground">
                    {t("Göstergeyi buraya sürükleyin")}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "diyagram" ? (
            <div className="space-y-5">
              <InvestigationHub />
            </div>
          ) : activeTab === "protokol" ? (
            <div className="space-y-5">
              <SmartCard category="protocol">
                <ProtocolSection />
              </SmartCard>
            </div>
          ) : activeTab === "ag_grafigi" ? (
            <div className="space-y-5">
              <ProtocolNetworkGraph />
            </div>
          ) : (
            (() => {
              const content = getTwoColumnTabContent(activeTab as Exclude<DashboardTab, "genel" | "protokol" | "diyagram" | "ag_grafigi">);
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  <div className="flex flex-col space-y-5">
                    {content.col1.map((node, i) => (
                      <div key={i}>{node}</div>
                    ))}
                  </div>
                  <div className="flex flex-col space-y-5">
                    {content.col2.map((node, i) => (
                      <div key={i}>{node}</div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Sade Footer + Tek Göze Batmayan Geliştirici Sistem Durumu Bağlantısı */}
        <footer className="mt-8 pt-4 pb-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans text-muted-foreground">
          <span>Muğla Monitör · Şehir Bilgi Platformu</span>
          <button
            type="button"
            data-testid="footer-system-status-btn"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-data-quality-agent", { detail: { tab: "quality" } }));
              }
            }}
            className="text-[11px] text-muted-foreground/70 hover:text-foreground underline-offset-4 hover:underline transition-colors"
          >
            {t("Sistem Durumu")}
          </button>
        </footer>
      </main>
    </div>
  );
};

export default Index;
