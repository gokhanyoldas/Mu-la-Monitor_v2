// src/pages/dashboard/overviewLayout.tsx
// "Genel Bakış" sekmesinin 3 sütunlu düzen yapılandırması ve kalıcılık yardımcıları.
// Layout ve panel kayıtları burada tek yerde tutulur; Index.tsx yalnızca kompoze eder.

import type { ReactNode } from "react";
import { TrafficSummaryPanel } from "@/components/dashboard/sections/TransportSection";
import { EconomyOverviewPanel } from "@/components/dashboard/sections/EconomySection";
import { TourismMovementPanel } from "@/components/dashboard/sections/TourismSection";

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

export const PANEL_REGISTRY: Record<string, { title: string; category: string; component: ReactNode }> = {
  traffic_summary: { title: "Trafik Özeti", category: "transport", component: <TrafficSummaryPanel /> },
  economy: { title: "Ekonomi Özeti", category: "economy", component: <EconomyOverviewPanel /> },
  tourism_general: { title: "Turizm Özeti", category: "tourism", component: <TourismMovementPanel /> },
};

export const COLUMNS_STORAGE_KEY = "mugla_dashboard_columns_v8";
export const METRIC_ORDER_STORAGE_KEY = "mugla_metric_order_v3";

export const DEFAULT_METRIC_ORDER = [
  "Nüfus", "Turist/Yıl", "İşsizlik", "Hava", "AQI", "Otel Doluluk", "Baraj", "Güvenlik"
];

export const sanitizeColumns = (raw: unknown): ColumnLayout => {
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
