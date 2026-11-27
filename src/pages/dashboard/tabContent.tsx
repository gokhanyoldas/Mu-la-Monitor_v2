// src/pages/dashboard/tabContent.tsx
// Sekme başına iki sütunlu içerik düzeni. Index.tsx'ten ayrıştırıldı; davranış birebir korunur.

import type { ReactNode } from "react";
import type { DashboardTab } from "@/components/dashboard/DashboardHeader";
import { SmartCard } from "@/components/intelligence/SmartCard";
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
import { InfrastructureProjectsPanel } from "@/components/dashboard/sections/TransportSection";
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
import { TrendTopicsSection } from "@/components/dashboard/sections/TrendTopicsSection";
import { LocalGovBudgetSection } from "@/components/dashboard/sections/LocalGovBudgetSection";
import { FireRiskIndicator } from "@/components/FireRiskIndicator";
import { TourismForecastPanel } from "@/components/TourismForecastPanel";
import { EconomyOverviewPanel, RealEstatePanel } from "@/components/dashboard/sections/EconomySection";
import {
  WeatherClimatePanel,
  AirQualityPanel,
  WaterDamsPanel,
} from "@/components/dashboard/sections/EnvironmentSection";
import {
  AgriculturePanel,
  CultureEventsPanel,
  CulturalHeritagePanel,
} from "@/components/dashboard/sections/CultureAgriSection";

// Her sekme yalnızca kendi ana konusunu tekrarsız ve bol boşluklu gösterir
export const getTwoColumnTabContent = (
  tab: Exclude<DashboardTab, "genel" | "protokol" | "diyagram">
): { col1: ReactNode[]; col2: ReactNode[] } => {
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
