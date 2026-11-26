import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  TOPIC_GROUNDING_QUERIES,
  fetchTopicGrounding,
  resetTopicGroundingClientState,
  mergeEnergyIntelligence,
  mergeSecurityIntelligence,
  mergeTourismIntelligence,
  mergeEconomyIntelligence,
  matchProtocolActivitiesToMembers,
  getProtocolMemberKey,
} from "@/services/topicGroundingService";
import {
  executeTopicGrounding,
  isGeminiRateLimitError,
  resetTopicGroundingRuntimeState,
} from "../../api/intel/topic-grounding";
import { PROTOCOL_DATA } from "@/data/protocol-data";
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

describe("Extended Sector Topic Grounding (Enerji, Güvenlik, Turizm, Ekonomi, Protokol)", () => {
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

  it("defines grounding queries for all 7 sector topics", () => {
    expect(TOPIC_GROUNDING_QUERIES.energy_outages.query).toContain("ADM Elektrik");
    expect(TOPIC_GROUNDING_QUERIES.security_quakes.query).toContain("AFAD");
    expect(TOPIC_GROUNDING_QUERIES.tourism_occupancy.query).toContain("otel doluluk");
    expect(TOPIC_GROUNDING_QUERIES.economy_budget.query).toContain("Muğla Büyükşehir");
    expect(TOPIC_GROUNDING_QUERIES.protocol_activity.query).toContain("son 24 saat");
  });

  it("1. Enerji: returns null (dash) with no fake 1.8/3 when ADM data is absent, and merges verified ADM outages with districts and source/date", () => {
    const empty = mergeEnergyIntelligence({});
    expect(empty.dailyConsumptionGwh).toBeNull();
    expect(empty.activeOutageCount).toBeNull();
    expect(empty.hasVerifiedLiveData).toBe(false);
    expect(empty.latestSourceSummary).toContain("Canlı ADM Elektrik");

    const live = mergeEnergyIntelligence({
      groundedOutages: [
        {
          id: "eo-1",
          district: "Bodrum",
          neighborhoods: "Gümbet, Bitez",
          type: "planli",
          status: "planli",
          summary: "09:00-15:00 arası şebeke bakım çalışması",
          sourceName: "ADM Elektrik",
          sourceUrl: "https://www.admelektrik.com.tr/kesinti-duyurusu",
          publishedAt: "2026-11-23T08:00:00.000Z",
          confidence: "high",
        },
        {
          id: "eo-2",
          district: "Marmaris",
          neighborhoods: "Armutalan",
          type: "ariza",
          status: "aktif",
          summary: "Trafo arızası giderme çalışması",
          sourceName: "ADM Elektrik",
          sourceUrl: "https://www.admelektrik.com.tr/ariza-marmaris",
          publishedAt: "2026-11-23T09:30:00.000Z",
          confidence: "high",
        },
        {
          // Invalid URL must be filtered out
          id: "eo-bad",
          district: "Datça",
          neighborhoods: "İskele",
          type: "ariza",
          status: "aktif",
          summary: "Doğrulanmamış kesinti",
          sourceName: "Bilinmiyor",
          sourceUrl: "",
          publishedAt: "2026-11-23T10:00:00.000Z",
          confidence: "medium",
        },
      ],
    });

    expect(live.activeOutageCount).toBe(2);
    expect(live.affectedDistricts).toEqual(["Bodrum", "Marmaris"]);
    expect(live.hasVerifiedLiveData).toBe(true);
    expect(live.latestSourceSummary).toContain("Kaynak: ADM Elektrik");
    expect(live.latestSourceSummary).toContain("23 Kas");
  });

  it("2. Güvenlik: returns dash overview when empty and merges live AFAD/Kandilli quakes + maritime/asayiş events", () => {
    const empty = mergeSecurityIntelligence({});
    expect(empty.overviewValue).toBe("—");
    expect(empty.quakeCount).toBeNull();
    expect(empty.publicOrderCount).toBeNull();

    const live = mergeSecurityIntelligence({
      earthquakeCache: [
        {
          id: "eq-1",
          magnitude: 3.6,
          location: "Datça Açıkları (Ege Denizi)",
          depth_km: 8.4,
          time: "2026-11-23T06:15:00.000Z",
          source: "AFAD",
        },
      ],
      groundedEvents: [
        {
          id: "sq-1",
          category: "deniz_guvenligi",
          title: "Bodrum açıklarında Sahil Güvenlik kurtarma operasyonu",
          district: "Bodrum",
          severity: "normal",
          sourceName: "Sahil Güvenlik",
          sourceUrl: "https://www.sg.gov.tr/bodrum-operasyon",
          publishedAt: "2026-11-23T09:00:00.000Z",
          confidence: "high",
        },
      ],
    });

    expect(live.quakeCount).toBe(1);
    expect(live.maxMagnitude).toBe(3.6);
    expect(live.publicOrderCount).toBe(1);
    expect(live.overviewValue).toBe("M3.6");
    expect(live.latestSourceSummary).toContain("Kaynak: Sahil Güvenlik");
    expect(live.latestSourceSummary).toContain("23 Kas");
  });

  it("3. Turizm: rejects synthetic seasonal 41% cache and displays verified local occupancy with source/date", () => {
    const syntheticOnly = mergeTourismIntelligence({
      tourismCache: {
        hotel_occupancy: 41,
        source: "TÜRSAB / Kültür ve Turizm Bakanlığı · sezonsal model",
      },
    });
    expect(syntheticOnly.hotelOccupancyPct).toBeNull();
    expect(syntheticOnly.hasVerifiedOccupancy).toBe(false);
    expect(syntheticOnly.occupancySourceSummary).toContain("Canlı otel doluluk verisi yok");

    const grounded = mergeTourismIntelligence({
      groundedTourism: {
        hotelOccupancyPct: 64,
        annualTourists: "4.1M",
        sourceName: "BODER / Anter Haber",
        sourceUrl: "https://anterhaber.com/bodrum-otel-doluluk",
        measuredAt: "2026-11-21T12:00:00.000Z",
        districtRates: [
          {
            district: "Bodrum",
            occupancyPct: 68,
            sourceName: "BODER",
            sourceUrl: "https://anterhaber.com/bodrum-otel-doluluk",
            measuredAt: "2026-11-21T12:00:00.000Z",
          },
          {
            district: "Marmaris",
            occupancyPct: 60,
            sourceName: "GETOB",
            sourceUrl: "https://marmarisgundem.com/doluluk",
            measuredAt: "2026-11-21T11:00:00.000Z",
          },
        ],
      },
    });

    expect(grounded.hotelOccupancyPct).toBe(64);
    expect(grounded.annualTourists).toBe("4.1M");
    expect(grounded.hasVerifiedOccupancy).toBe(true);
    expect(grounded.districtRates).toHaveLength(2);
    expect(grounded.occupancySourceSummary).toContain("Kaynak: BODER / Anter Haber");
    expect(grounded.occupancySourceSummary).toContain("21 Kas");
  });

  it("4. Ekonomi: returns null when empty and merges Muğla municipality budget/tender items + TÜİK labor rate with source date", () => {
    const empty = mergeEconomyIntelligence({});
    expect(empty.unemploymentRate).toBeNull();
    expect(empty.tourismRevenueBn).toBeNull();
    expect(empty.budgetItems).toHaveLength(0);

    const live = mergeEconomyIntelligence({
      groundedEconomy: {
        unemploymentRate: 8.1,
        unemploymentPeriod: "TÜİK 2025/Ç2",
        unemploymentSource: "TÜİK",
        sourceName: "Muğla Büyükşehir",
        sourceUrl: "https://mugla.bel.tr/butce-2026",
        measuredAt: "2026-11-22T10:00:00.000Z",
        items: [
          {
            id: "eb-1",
            institution: "Muğla Büyükşehir Belediyesi",
            category: "butce",
            title: "2026 Mali Yılı Performans ve Yatırım Bütçesi onaylandı",
            amountLabel: "14.2 Milyar ₺",
            sourceName: "Muğla Büyükşehir",
            sourceUrl: "https://mugla.bel.tr/butce-2026",
            publishedAt: "2026-11-22T10:00:00.000Z",
          },
        ],
      },
    });

    expect(live.unemploymentRate).toBe(8.1);
    expect(live.unemploymentPeriod).toBe("TÜİK 2025/Ç2");
    expect(live.budgetItems).toHaveLength(1);
    expect(live.latestSourceSummary).toContain("Kaynak: Muğla Büyükşehir");
    expect(live.latestSourceSummary).toContain("22 Kas");
  });

  it("5. Protokol: matches last-24h official visits/statements/role changes against the protocol list by name and title", () => {
    expect(PROTOCOL_DATA.length).toBeGreaterThan(50);
    const vali = PROTOCOL_DATA.find((m) => m.unvan.toLocaleLowerCase("tr-TR").includes("vali") && !m.unvan.toLocaleLowerCase("tr-TR").includes("yardımcı"));
    const baskan = PROTOCOL_DATA.find((m) => m.unvan.toLocaleLowerCase("tr-TR").includes("büyükşehir belediye başkanı"));
    expect(vali).toBeTruthy();
    expect(baskan).toBeTruthy();

    const matched = matchProtocolActivitiesToMembers(PROTOCOL_DATA, [
      {
        id: "pa-1",
        actorName: vali!.isim,
        actorTitle: "Muğla Valisi",
        category: "ziyaret",
        summary: "Bodrum sağlık yatırımları sahasında inceleme ziyareti gerçekleştirdi.",
        sourceName: "Muğla Valiliği",
        sourceUrl: "https://www.mugla.gov.tr/haber-ziyaret",
        publishedAt: "2026-11-23T09:00:00.000Z",
      },
      {
        id: "pa-2",
        actorName: "",
        actorTitle: "Muğla Büyükşehir Belediye Başkanı",
        category: "aciklama",
        summary: "Altyapı ve su yatırımları hakkında basın açıklaması yaptı.",
        sourceName: "MBB",
        sourceUrl: "https://www.mugla.bel.tr/aciklama",
        publishedAt: "2026-11-23T08:00:00.000Z",
      },
    ]);

    expect(matched.matchedMemberCount).toBeGreaterThanOrEqual(2);
    expect(matched.byMemberKey.get(getProtocolMemberKey(vali!))?.[0].category).toBe("ziyaret");
    expect(matched.byMemberKey.get(getProtocolMemberKey(baskan!))?.[0].category).toBe("aciklama");
    expect(matched.latestSourceSummary).toContain("Kaynak: Muğla Valiliği");
    expect(matched.latestSourceSummary).toContain("23 Kas");
  });

  it("renders all 5 sector panels cleanly with honest dashes when live topic grounding returns fallback/empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, fallback: true }),
    } as Response);

    const { EnergyConsumptionPanel } = await import("@/components/dashboard/sections/EnergySection");
    const { SecurityOverviewPanel } = await import("@/components/dashboard/sections/SecuritySection");
    const { AccommodationPanel } = await import("@/components/dashboard/sections/TourismSection");
    const { EconomyOverviewPanel } = await import("@/components/dashboard/sections/EconomySection");
    const { ProtocolSection } = await import("@/components/dashboard/sections/ProtocolSection");

    const { container } = renderWithProviders(
      <>
        <EnergyConsumptionPanel />
        <SecurityOverviewPanel />
        <AccommodationPanel />
        <EconomyOverviewPanel />
        <ProtocolSection />
      </>
    );

    await waitFor(() => {
      // Kaynak yokken paneller canlı metrik yerine açıkça referans veri modunu gösterir.
      expect(screen.getAllByText("REFERANS VERİ").length).toBeGreaterThanOrEqual(3);
    });

    const text = container.textContent ?? "";
    // Referans dönem metrikleri gösterilebilir; kritik sözleşme, bunların canlı gibi etiketlenmemesidir.
    expect(text).toContain("REFERANS");
    expect(text).toContain("—");
  });

  it("detects Gemini 429 RESOURCE_EXHAUSTED errors and short-circuits queued server calls without error spam", async () => {
    const quotaErr = new Error(
      '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED"}}'
    );
    expect(isGeminiRateLimitError(quotaErr)).toBe(true);
    expect(isGeminiRateLimitError({ status: 429 })).toBe(true);
    expect(isGeminiRateLimitError(new Error("network timeout"))).toBe(false);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const generateContent = vi.fn().mockRejectedValue(quotaErr);

    const [r1, r2, r3, r4] = await Promise.all([
      executeTopicGrounding("environment_dams", "test-key", { generateContent, spacingMs: 0 }),
      executeTopicGrounding("tourism_occupancy", "test-key", { generateContent, spacingMs: 0 }),
      executeTopicGrounding("economy_budget", "test-key", { generateContent, spacingMs: 0 }),
      executeTopicGrounding("security_quakes", "test-key", { generateContent, spacingMs: 0 }),
    ]);

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    for (const res of [r1, r2, r3, r4]) {
      expect(res.ok).toBe(false);
      expect(res.fallback).toBe(true);
      expect(res.rateLimited).toBe(true);
      expect(Number(res.retryAfterMs)).toBeGreaterThan(0);
    }
  });

  it("deduplicates concurrent client requests and honors server 429 cooldown without re-fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: false,
        fallback: true,
        rateLimited: true,
        retryAfterMs: 10 * 60 * 1000,
      }),
    } as Response);

    const [a, b] = await Promise.all([
      fetchTopicGrounding("environment_dams"),
      fetchTopicGrounding("environment_dams"),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a.damUpdates).toEqual([]);
    expect(b.damUpdates).toEqual([]);

    // Subsequent call for another topic must short-circuit via persisted cooldown
    const c = await fetchTopicGrounding("tourism_occupancy");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(c.tourismMetrics).toBeNull();
  });
});
