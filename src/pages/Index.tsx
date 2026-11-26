import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { DashboardHeader, type DashboardTab } from "@/components/dashboard/DashboardHeader";
import { useMonitorUrlState } from "@/hooks/useMonitorUrlState";
import {
  TourismMovementPanel,
  AccommodationPanel,
  VisitorProfilePanel,
} from "@/components/dashboard/sections/TourismSection";
import {
  DemographicsPanel,
  EducationPanel,
  HealthPanel,
  LifeQualityPanel,
} from "@/components/dashboard/sections/SocialSection";
import {
  TrafficSummaryPanel,
  InfrastructureProjectsPanel,
} from "@/components/dashboard/sections/TransportSection";
import { FlightTrackerSection } from "@/components/dashboard/sections/FlightTrackerSection";
import { BusScheduleSection } from "@/components/dashboard/sections/BusScheduleSection";
import {
  EnergyConsumptionPanel,
  RenewableEnergyPanel,
  SustainabilityPanel,
} from "@/components/dashboard/sections/EnergySection";
import {
  SecurityOverviewPanel,
  RadarTrafficMapPanel,
  EmergencyPanel,
  LocalGovQuickPanel,
} from "@/components/dashboard/sections/SecuritySection";
import { SocialIntelSection } from "@/components/dashboard/sections/SocialIntelSection";
import { GastronomySection } from "@/components/dashboard/sections/GastronomySection";
import { TrafficDensityMap } from "@/components/dashboard/sections/TrafficDensityMap";
import { ProtocolSection } from "@/components/dashboard/sections/ProtocolSection";
import { TrendTopicsSection } from "@/components/dashboard/sections/TrendTopicsSection";
import { LocalGovBudgetSection } from "@/components/dashboard/sections/LocalGovBudgetSection";
import { useLiveData } from "@/hooks/useLiveData";
import { SmartCard } from "@/components/intelligence/SmartCard";
// M10: Deprem Erken Uyarı Banner
import { EarthquakeAlertBanner } from "@/components/EarthquakeAlertBanner";
// M11: Yangın Risk Göstergesi
import { FireRiskIndicator } from "@/components/FireRiskIndicator";
// M9: Turizm Tahmin Modeli
import { TourismForecastPanel } from "@/components/TourismForecastPanel";
// Şehir Özeti: güncel şehir durumunu tek kartta toplar
import { AISummaryCard } from "@/components/AISummaryCard";
import { InvestigationHub } from "@/components/investigation/InvestigationHub";

import { EconomyOverviewPanel, RealEstatePanel } from "@/components/dashboard/sections/EconomySection";
import { WeatherClimatePanel, AirQualityPanel, WaterDamsPanel } from "@/components/dashboard/sections/EnvironmentSection";
import {
  useDamIntelligence,
  useTourismIntelligence,
  useEconomyIntelligence,
  useSecurityIntelligence,
} from "@/services/topicGroundingService";
import { AgriculturePanel, CultureEventsPanel, CulturalHeritagePanel } from "@/components/dashboard/sections/CultureAgriSection";

// Her sekme yalnızca kendi ana konusunu tekrarsız ve bol boşluklu gösterir
const getTwoColumnTabContent = (tab: Exclude<DashboardTab, "genel" | "protokol" | "diyagram">): { col1: React.ReactNode[]; col2: React.ReactNode[] } => {
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

// Genel Bakış Yönetici Özeti: yalnızca ilk satırdaki 3 ana özet kartı (kopya alt paneller yok)
export type ColumnLayout = {
  col1: string[];
  col2: string[];
  col3: string[];
};

export const DEFAULT_COLUMNS: ColumnLayout = {
  col1: ["traffic_summary"],
  col2: ["economy"],
  col3: ["tourism_general"],
};

const PANEL_REGISTRY: Record<string, { title: string; category: string; component: React.ReactNode }> = {
  traffic_summary: { title: "Trafik Özeti", category: "transport", component: <TrafficSummaryPanel /> },
  economy: { title: "Ekonomi Özeti", category: "economy", component: <EconomyOverviewPanel /> },
  tourism_general: { title: "Turizm Özeti", category: "tourism", component: <TourismMovementPanel /> },
};

const COLUMNS_STORAGE_KEY = "mugla_dashboard_columns_v8";

const sanitizeColumns = (raw: unknown): ColumnLayout => {
  if (!raw || typeof raw !== "object") return DEFAULT_COLUMNS;
  const candidate = raw as Partial<ColumnLayout>;
  const filterValid = (list: unknown): string[] =>
    Array.isArray(list) ? list.filter((id): id is string => typeof id === "string" && id in PANEL_REGISTRY) : [];
  const next: ColumnLayout = {
    col1: filterValid(candidate.col1),
    col2: filterValid(candidate.col2),
    col3: filterValid(candidate.col3),
  };
  const total = next.col1.length + next.col2.length + next.col3.length;
  return total === Object.keys(PANEL_REGISTRY).length ? next : DEFAULT_COLUMNS;
};

const DEFAULT_METRIC_ORDER = [
  "Nüfus", "Turist/Yıl", "İşsizlik", "Hava", "AQI", "Otel Doluluk", "Baraj", "Güvenlik"
];

const Index = () => {
  const { t, translate } = useTranslation();
  const {
    activeTab,
    hubInitialView,
    activeDistrict,
    setActiveTab,
    setActiveDistrict,
  } = useMonitorUrlState();

  // Apple Stili Düzenleme Modu (Genel Bakış)
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Genel Bakış için 3 ana yönetici özeti kartı yerleşimi
  const [columns, setColumns] = useState<ColumnLayout>(() => {
    try {
      localStorage.removeItem("mugla_dashboard_columns_v7");
      const savedV8 = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (savedV8) return sanitizeColumns(JSON.parse(savedV8));
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
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(newCols));
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
  const { data: aqData } = useLiveData<any>("air_quality", { refetchInterval: 30 * 60 * 1000 });
  const damIntel = useDamIntelligence();
  const tourismIntel = useTourismIntelligence();
  const ecoIntel = useEconomyIntelligence();
  const secIntel = useSecurityIntelligence();
  const { data: demoData } = useLiveData<any>("demographics", { refetchInterval: 24 * 60 * 60 * 1000 });

  const population     = demoData?.population ?? "1.07M";
  const annualTourists = tourismIntel.annualTourists ?? "—";
  const unemployment   = ecoIntel.unemploymentRate !== null ? `${ecoIntel.unemploymentRate}%` : "—";
  const temperature    = weatherData?.temperature ? `${weatherData.temperature}°C` : "—";
  const aqi            = aqData?.aqi !== undefined && aqData?.aqi !== null ? String(aqData.aqi) : "—";
  const hotelOccupancy = tourismIntel.hotelOccupancyPct !== null ? `${tourismIntel.hotelOccupancyPct}%` : "—";
  const avgDam         = damIntel.avgOccupancy !== null ? `${damIntel.avgOccupancy}%` : "—";

  const allMetricsMap: Record<
    string,
    { label: string; value: string; color: string; category: string; targetTab: DashboardTab; sourceNote?: string }
  > = {
    "Nüfus": { label: "Nüfus", value: population, color: "text-primary", category: "demographics", targetTab: "sosyal" },
    "Turist/Yıl": {
      label: "Turist/Yıl",
      value: annualTourists,
      color: "text-accent",
      category: "tourism",
      targetTab: "turizm",
      sourceNote: tourismIntel.movementSourceSummary,
    },
    "İşsizlik": {
      label: "İşsizlik",
      value: unemployment,
      color: "text-warning",
      category: "economy",
      targetTab: "ekonomi",
      sourceNote: ecoIntel.latestSourceSummary,
    },
    "Hava": { label: "Hava", value: temperature, color: "text-foreground", category: "weather", targetTab: "cevre" },
    "AQI": { label: "AQI", value: aqi, color: "text-success", category: "air_quality", targetTab: "cevre" },
    "Otel Doluluk": {
      label: "Otel Doluluk",
      value: hotelOccupancy,
      color: "text-accent",
      category: "tourism",
      targetTab: "turizm",
      sourceNote: tourismIntel.occupancySourceSummary,
    },
    "Baraj": {
      label: "Baraj",
      value: avgDam,
      color: "text-warning",
      category: "dams",
      targetTab: "cevre",
      sourceNote: damIntel.latestSourceSummary,
    },
    "Güvenlik": {
      label: "Güvenlik",
      value: secIntel.overviewValue,
      color: "text-primary",
      category: "security",
      targetTab: "guvenlik",
      sourceNote: secIntel.latestSourceSummary,
    },
  };

  const isGenel = activeTab === "genel";

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
            + {t("Buraya Yerleştir")} (#{idx + 1})
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
                  aria-label={t("Sola / Önceki sütuna taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Sola / Önceki sütuna taşı")}
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => moveWithinCol(colKey, idx, -1)}
                  disabled={idx === 0}
                  aria-label={t("Yukarı taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Yukarı taşı")}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveWithinCol(colKey, idx, 1)}
                  disabled={idx === totalCount - 1}
                  aria-label={t("Aşağı taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Aşağı taşı")}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => shiftCol(colKey, 1, widgetId)}
                  disabled={colKey === "col3"}
                  aria-label={t("Sağa / Sonraki sütuna taşı")}
                  className="px-1 py-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-20 text-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title={t("Sağa / Sonraki sütuna taşı")}
                >
                  ▶
                </button>
                <select
                  value={colKey}
                  aria-label={t("Doğrudan sütun seç")}
                  onChange={(e) => moveToCol(colKey, e.target.value as "col1" | "col2" | "col3", widgetId)}
                  className="bg-background/90 border border-border/70 rounded px-1 py-0.5 text-[9px] text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  title={t("Doğrudan sütun seç")}
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
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeDistrict={activeDistrict}
        onDistrictChange={setActiveDistrict}
      />

      {/* M10: Earthquake banner — always visible above main content */}
      <EarthquakeAlertBanner />

      <main className="p-4 sm:p-5 max-w-[1680px] mx-auto">
        {/* Sade Üst Özet Çubuğu — her kutu doğrudan ilgili uzmanlık sekmesine yönlendirir */}
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
                <SmartCard category={item.category as any}>
                  <button
                    type="button"
                    data-testid={`overview-metric-${item.label}`}
                    data-source-summary={item.sourceNote ? translate(item.sourceNote) : undefined}
                    aria-label={`${t(item.label)}: ${translate(item.value)}`}
                    onClick={() => {
                      if (!isEditMode) {
                        setActiveTab(item.targetTab);
                      }
                    }}
                    title={item.sourceNote ? `${t(item.label)} · ${translate(item.sourceNote)}` : `${t(item.label)}`}
                    className={`w-full bg-secondary/25 border border-border/50 rounded-lg px-2.5 py-2 text-center transition-colors ${
                      isEditMode
                        ? "cursor-grab"
                        : "cursor-pointer hover:border-primary/60 hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    }`}
                  >
                    <div className="text-[10px] font-mono text-muted-foreground tracking-wide">
                      {t(item.label)}
                    </div>
                    <div className={`text-sm font-mono font-bold tabular-nums-stat mt-0.5 ${item.color}`}>
                      {translate(item.value)}
                    </div>
                    {item.label === "Otel Doluluk" && tourismIntel.hasVerifiedOccupancy && (
                      <div className="text-[8px] font-mono text-muted-foreground/80 truncate mt-0.5">
                        {translate(tourismIntel.occupancySourceSummary)}
                      </div>
                    )}
                  </button>
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
              <InvestigationHub initialView={hubInitialView} />
            </div>
          ) : activeTab === "protokol" ? (
            <div className="space-y-5">
              <SmartCard category="protocol">
                <ProtocolSection />
              </SmartCard>
            </div>
          ) : (
            (() => {
              const content = getTwoColumnTabContent(activeTab as Exclude<DashboardTab, "genel" | "protokol" | "diyagram">);
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
          <span>{t("Muğla Monitör · Şehir Bilgi Platformu")}</span>
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
