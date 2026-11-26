import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  TOPIC_GROUNDING_QUERIES,
  writeLocalTopicCache,
  resetTopicGroundingClientState,
  mergeEconomyIntelligence,
  mergeTourismIntelligence,
  mergeSecurityIntelligence,
} from "@/services/topicGroundingService";
import {
  executeTopicGrounding,
  isValidTopicKey,
  resetTopicGroundingRuntimeState,
} from "../../api/intel/topic-grounding";
import {
  SECTOR_TOPIC_QUERIES,
  normalizeAgentFindings,
  buildSupabasePayloads,
  DISTRICT_GROUPS,
} from "../../scripts/run-autonomous-agent.mjs";
import { I18nProvider } from "@/hooks/useTranslation";
import { AuthProvider } from "@/hooks/useAuth";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => {
      const chain: Record<string, any> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.gte = () => chain;
      chain.limit = () => chain;
      chain.order = async () => ({ data: [], error: null });
      chain.maybeSingle = async () => ({ data: null, error: null });
      return chain;
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  },
  isSupabaseClientConfigured: false,
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <I18nProvider>
          <AuthProvider>{ui}</AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("Sectoral Grounding v2: Ekonomi (Bütçe/MUSKİ), Turizm (Doluluk/Yolcu), Güvenlik (Asayiş/Kaza/Yangın)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetTopicGroundingClientState();
    resetTopicGroundingRuntimeState();
    vi.restoreAllMocks();
    if (typeof globalThis.ResizeObserver === "undefined") {
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as any;
    }
  });

  it("matches the exact required queries across frontend service and autonomous agent", () => {
    expect(TOPIC_GROUNDING_QUERIES.economy_budget.query).toContain('"MUSKİ"');
    expect(TOPIC_GROUNDING_QUERIES.economy_budget.query).toContain("bütçe milyar TL OR ihale 2026 OR 2027");
    expect(SECTOR_TOPIC_QUERIES.economy_budget).toBe(TOPIC_GROUNDING_QUERIES.economy_budget.query);

    expect(TOPIC_GROUNDING_QUERIES.tourism_occupancy.query).toContain("Dalaman Havalimanı yolcu 2026");
    expect(SECTOR_TOPIC_QUERIES.tourism_occupancy).toBe(TOPIC_GROUNDING_QUERIES.tourism_occupancy.query);

    expect(TOPIC_GROUNDING_QUERIES.security_quakes.query).toContain("trafik kazası");
    expect(TOPIC_GROUNDING_QUERIES.security_quakes.query).toContain("yangın");
    expect(SECTOR_TOPIC_QUERIES.security_quakes).toBe(TOPIC_GROUNDING_QUERIES.security_quakes.query);

    expect(isValidTopicKey("economy_budget")).toBe(true);
    expect(isValidTopicKey("invalid_topic")).toBe(false);
  });

  it("1. Ekonomi: parses Muğla BB 24.3B + MUSKİ 20.5B (total 44.8B, +30.35%) in API & agent and updates LocalGovBudgetSection, LocalGovQuickPanel, and EconomyOverviewPanel", async () => {
    const apiPayload = await executeTopicGrounding("economy_budget", "test-key", {
      spacingMs: 0,
      generateContent: async () => ({
        text: JSON.stringify({
          budgetYear: 2026,
          combinedTotalBillionTry: 44.8,
          budgetYoyChangePct: 30.35,
          sourceName: "Muğla Büyükşehir Belediyesi",
          sourceUrl: "https://mugla.bel.tr/haber/2026-butce-44-8-milyar",
          publishedDate: "2026-11-24",
          municipalBudgets: [
            {
              institution: "Muğla Büyükşehir Belediyesi",
              amountBillionTry: 24.3,
              year: 2026,
              yoyChangePct: 30.35,
              sourceName: "Muğla Büyükşehir",
              sourceUrl: "https://mugla.bel.tr/haber/2026-butce-44-8-milyar",
              publishedDate: "2026-11-24",
            },
            {
              institution: "MUSKİ",
              amountBillionTry: 20.5,
              year: 2026,
              yoyChangePct: 30.35,
              sourceName: "MUSKİ",
              sourceUrl: "https://muski.gov.tr/2026-butcesi",
              publishedDate: "2026-11-24",
            },
          ],
          items: [
            {
              institution: "Muğla Büyükşehir Belediyesi",
              category: "butce",
              title: "MBB ve MUSKİ 2026 bütçesi 44,8 milyar TL olarak kabul edildi",
              amountLabel: "44.8 Milyar ₺",
              sourceName: "Muğla Büyükşehir",
              sourceUrl: "https://mugla.bel.tr/haber/2026-butce-44-8-milyar",
              publishedDate: "2026-11-24",
            },
          ],
        }),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://mugla.bel.tr/haber/2026-butce-44-8-milyar", title: "MBB Bütçe" } },
              ],
            },
          },
        ],
      }),
    });

    expect(apiPayload.ok).toBe(true);
    const merged = mergeEconomyIntelligence({
      groundedEconomy: apiPayload.economyUpdates as any,
    });
    expect(merged.combinedTotalBillionTry).toBe(44.8);
    expect(merged.budgetYoyChangePct).toBe(30.35);
    expect(merged.budgetYear).toBe(2026);
    expect(merged.municipalBudgets).toHaveLength(2);
    expect(merged.hasVerifiedBudgetUpdate).toBe(true);
    expect(merged.budgetSourceSummary).toContain("24 Kas");

    writeLocalTopicCache("economy_budget", {
      topic: "economy_budget",
      fetchedAt: new Date().toISOString(),
      economyUpdates: apiPayload.economyUpdates as any,
    });

    const { LocalGovBudgetSection } = await import("@/components/dashboard/sections/LocalGovBudgetSection");
    const { EconomyOverviewPanel } = await import("@/components/dashboard/sections/EconomySection");
    const { LocalGovQuickPanel } = await import("@/components/dashboard/sections/SecuritySection");

    const { container } = renderWithProviders(
      <>
        <LocalGovBudgetSection />
        <EconomyOverviewPanel />
        <LocalGovQuickPanel />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId("budget-source-note").textContent).toContain("24 Kas");
    });

    const text = container.textContent ?? "";
    expect(text).toContain("44.8");
    expect(text).toContain("24.3");
    expect(text).toContain("20.5");
    expect(text).toContain("MUSKİ");
    expect(text).toContain("30.35");
    expect(screen.getByTestId("localgov-quick-source-note").textContent).toContain("24 Kas");
    expect(screen.getByTestId("economy-source-note").textContent).toContain("24 Kas");
  });

  it("2. Turizm: updates Genel Bakış Otel Doluluk and TourismSection with Dalaman passengers & occupancy, and shows dash when unverified", async () => {
    const emptyTourism = mergeTourismIntelligence({});
    expect(emptyTourism.hotelOccupancyPct).toBeNull();
    expect(emptyTourism.airportPassengers).toBeNull();

    const apiPayload = await executeTopicGrounding("tourism_occupancy", "test-key", {
      spacingMs: 0,
      generateContent: async () => ({
        text: JSON.stringify({
          hotelOccupancyPct: 74,
          annualTourists: "4.3M",
          airportPassengers: "5.8M",
          sourceName: "BODER / DHMİ",
          sourceUrl: "https://anterhaber.com/mugla-2026-turizm-doluluk",
          publishedDate: "2026-11-25",
          districtRates: [
            {
              district: "Bodrum",
              occupancyPct: 78,
              sourceName: "BODER",
              sourceUrl: "https://anterhaber.com/mugla-2026-turizm-doluluk",
              publishedDate: "2026-11-25",
            },
          ],
          headlines: [
            {
              title: "Dalaman Havalimanı 2026 yolcu trafiğinde 5.8 milyona ulaştı",
              district: "Dalaman",
              sourceName: "DHMİ / AA",
              sourceUrl: "https://www.aa.com.tr/dalaman-2026-yolcu",
              publishedDate: "2026-11-25",
            },
          ],
        }),
      }),
    });

    expect(apiPayload.ok).toBe(true);
    const merged = mergeTourismIntelligence({
      groundedTourism: apiPayload.tourismMetrics as any,
    });
    expect(merged.hotelOccupancyPct).toBe(74);
    expect(merged.airportPassengers).toBe("5.8M");
    expect(merged.annualTourists).toBe("4.3M");
    expect(merged.occupancySourceSummary).toContain("BODER / DHMİ");
    expect(merged.occupancySourceSummary).toContain("25 Kas");

    writeLocalTopicCache("tourism_occupancy", {
      topic: "tourism_occupancy",
      fetchedAt: new Date().toISOString(),
      tourismMetrics: apiPayload.tourismMetrics as any,
    });

    const { TourismMovementPanel, AccommodationPanel } = await import(
      "@/components/dashboard/sections/TourismSection"
    );
    const { container } = renderWithProviders(
      <>
        <TourismMovementPanel />
        <AccommodationPanel />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId("tourism-occupancy-source-note").textContent).toContain("25 Kas");
    });
    const text = container.textContent ?? "";
    expect(text).toContain("5.8M");
    expect(text).toContain("4.3M");
    expect(text).toContain("74");
    expect(screen.getByTestId("tourism-headlines").textContent).toContain("Dalaman Havalimanı");
  });

  it("3. Güvenlik: ingests daily asayiş, trafik kazası, Sahil Güvenlik, and yangın incidents and updates SecurityOverviewPanel & EmergencyPanel with zero static 485/128", async () => {
    const apiPayload = await executeTopicGrounding("security_quakes", "test-key", {
      spacingMs: 0,
      generateContent: async () => ({
        text: JSON.stringify({
          events: [
            {
              category: "yangin",
              title: "Milas kırsalında çıkan makilik yangını havadan müdahale ile kontrol altında",
              district: "Milas",
              severity: "yuksek",
              sourceName: "OGM / AA",
              sourceUrl: "https://www.aa.com.tr/milas-yangin",
              publishedDate: "2026-11-25",
              confidence: "high",
            },
            {
              category: "trafik_kazasi",
              title: "Muğla-Marmaris Sakar Geçidi'nde zincirleme trafik kazası",
              district: "Ula",
              severity: "normal",
              sourceName: "Yerel Basın",
              sourceUrl: "https://muglagazetesi.com.tr/sakar-kaza",
              publishedDate: "2026-11-25",
              confidence: "high",
            },
            {
              category: "deniz_guvenligi",
              title: "Datça açıklarında Sahil Güvenlik ekipleri 24 kişiyi kurtardı",
              district: "Datça",
              severity: "normal",
              sourceName: "Sahil Güvenlik",
              sourceUrl: "https://www.sg.gov.tr/datca-kurtarma",
              publishedDate: "2026-11-25",
              confidence: "high",
            },
          ],
        }),
      }),
    });

    expect(apiPayload.ok).toBe(true);
    const merged = mergeSecurityIntelligence({
      groundedEvents: apiPayload.securityEvents as any,
    });
    expect(merged.publicOrderCount).toBe(3);
    expect(merged.fireEvents).toHaveLength(1);
    expect(merged.trafficAccidentEvents).toHaveLength(1);
    expect(merged.fireRiskLevel).toBe("YÜKSEK");
    expect(merged.activeAlertCount).toBeGreaterThanOrEqual(1);

    writeLocalTopicCache("security_quakes", {
      topic: "security_quakes",
      fetchedAt: new Date().toISOString(),
      securityEvents: apiPayload.securityEvents as any,
    });

    const { SecurityOverviewPanel, EmergencyPanel } = await import(
      "@/components/dashboard/sections/SecuritySection"
    );
    const { container } = renderWithProviders(
      <>
        <SecurityOverviewPanel />
        <EmergencyPanel />
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId("security-incident-stream").textContent).toContain("Milas");
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Yangın");
    expect(text).toContain("Kaza");
    expect(text).toContain("Sahil Güv.");
    expect(text).toContain("YANGIN UYARISI");
    expect(text).not.toContain("485");
    expect(text).not.toContain("128");
  });

  it("4. Autonomous Agent normalizes and builds Supabase cache payloads for new budget, airport passenger, and accident/fire security fields", () => {
    const groupC = DISTRICT_GROUPS[2];
    const findings = normalizeAgentFindings(
      {
        economy_updates: {
          budget_year: 2026,
          combined_total_billion_try: 44.8,
          budget_yoy_change_pct: 30.35,
          source_name: "Muğla Büyükşehir",
          source_url: "https://mugla.bel.tr/2026-butce",
          published_date: "2026-11-25",
          municipal_budgets: [
            {
              institution: "Muğla Büyükşehir Belediyesi",
              amount_billion_try: 24.3,
              year: 2026,
              yoy_change_pct: 30.35,
              source_url: "https://mugla.bel.tr/2026-butce",
            },
            {
              institution: "MUSKİ",
              amount_billion_try: 20.5,
              year: 2026,
              source_url: "https://muski.gov.tr/2026-butce",
            },
          ],
          items: [],
        },
        tourism_metrics: {
          hotel_occupancy_pct: 71,
          annual_tourists: "4.2M",
          airport_passengers: "5.7M",
          source_name: "DHMİ / BODER",
          source_url: "https://dhmi.gov.tr/dalaman-2026",
          published_date: "2026-11-25",
        },
        security_events: [
          {
            category: "trafik_kazasi",
            title: "Fethiye-Göcek tünel çıkışı trafik kazası",
            district: "Fethiye",
            severity: "yuksek",
            source_name: "AA",
            source_url: "https://www.aa.com.tr/fethiye-kaza",
            published_date: "2026-11-25",
          },
          {
            category: "yangin",
            title: "Dalaman orman alanında yangın söndürme çalışması",
            district: "Dalaman",
            severity: "kritik",
            source_name: "OGM",
            source_url: "https://www.ogm.gov.tr/dalaman-yangin",
            published_date: "2026-11-25",
          },
        ],
      },
      groupC,
      [{ web: { uri: "https://mugla.bel.tr/2026-butce", title: "MBB" } }]
    );

    expect(findings.economyUpdates?.combinedTotalBillionTry).toBe(44.8);
    expect(findings.economyUpdates?.municipalBudgets).toHaveLength(2);
    expect(findings.tourismMetrics?.airportPassengers).toBe("5.7M");
    expect(findings.securityEvents.map((e: any) => e.category)).toEqual(["trafik_kazasi", "yangin"]);

    const payloads = buildSupabasePayloads({ findings, group: groupC });
    const types = payloads.cacheRows.map((r: any) => r.data_type);
    expect(types).toContain("topic_grounding:economy_budget");
    expect(types).toContain("topic_grounding:tourism_occupancy");
    expect(types).toContain("topic_grounding:security_quakes");
  });
});
