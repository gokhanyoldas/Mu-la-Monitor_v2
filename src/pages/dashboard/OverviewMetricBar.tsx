// src/pages/dashboard/OverviewMetricBar.tsx
// "Genel Bakış" üst özet göstergesi (8 kutucuk). Index.tsx'ten ayrıştırıldı; davranış birebir korunur.

import type { DragEvent } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { SmartCard } from "@/components/intelligence/SmartCard";
import { useLiveData } from "@/hooks/useLiveData";
import type { DashboardTab } from "@/components/dashboard/DashboardHeader";
import {
  useDamIntelligence,
  useTourismIntelligence,
  useEconomyIntelligence,
  useSecurityIntelligence,
} from "@/services/topicGroundingService";

interface OverviewMetricBarProps {
  metricOrder: string[];
  isEditMode: boolean;
  onMetricDragStart: (e: DragEvent, index: number) => void;
  onMetricDrop: (e: DragEvent, targetIndex: number) => void;
  onSelectTab: (tab: DashboardTab) => void;
}

export const OverviewMetricBar = ({
  metricOrder,
  isEditMode,
  onMetricDragStart,
  onMetricDrop,
  onSelectTab,
}: OverviewMetricBarProps) => {
  const { t, translate } = useTranslation();

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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-5">
      {metricOrder.map((key, index) => {
        const item = allMetricsMap[key];
        if (!item) return null;
        return (
          <div
            key={item.label}
            draggable={isEditMode}
            onDragStart={(e) => onMetricDragStart(e, index)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => onMetricDrop(e, index)}
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
                    onSelectTab(item.targetTab);
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
  );
};
