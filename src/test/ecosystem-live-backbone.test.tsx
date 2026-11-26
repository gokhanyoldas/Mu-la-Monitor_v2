import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { I18nProvider } from "@/hooks/useTranslation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UnifiedIntelligenceProvider } from "@/contexts/UnifiedIntelligenceContext";
import {
  useMonitorStore,
  resolveProtocolMembers,
} from "@/store/useMonitorStore";
import {
  getDynamicQueryYears as getClientDynamicYears,
  buildTopicGroundingQueries,
  MUGLA_DAMS_REGISTRY,
  VERIFIED_BUDGET_SEED,
} from "@/services/topicGroundingService";
import {
  getDynamicQueryYears as getApiDynamicYears,
  buildPromptForTopic,
} from "../../api/intel/topic-grounding";
import {
  getDynamicQueryYears as getAgentDynamicYears,
  buildSectorTopicQueries,
  buildGroundingPrompt,
  DISTRICT_GROUPS,
} from "../../scripts/run-autonomous-agent.mjs";
import { PROTOCOL_DATA } from "@/data/protocol-data";
import { INSTITUTION_CATALOG } from "@/services/institution-reputation";
import { INVESTIGATION_NODES } from "@/data/investigationData";
import { loadLivingLexicon } from "@/services/livingLexiconService";
import { LocalGovBudgetSection } from "@/components/dashboard/sections/LocalGovBudgetSection";
import { EconomyOverviewPanel } from "@/components/dashboard/sections/EconomySection";
import { InvestigationHub } from "@/components/investigation/InvestigationHub";
import { DistrictDetailedAnalysisPanel } from "@/components/dashboard/DistrictDetailedAnalysisPanel";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <AccessibilityProvider>
            <I18nProvider>
              <AuthProvider>
                <UnifiedIntelligenceProvider>{ui}</UnifiedIntelligenceProvider>
              </AuthProvider>
            </I18nProvider>
          </AccessibilityProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("Muğla Monitör v2 — 11-Sekme Canlı Veri Omurgası, Dinamik Yıl Sürekliliği & Doğrulanmış Tohumlar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useMonitorStore.getState().resetStore();
  });

  it("1. Dinamik yıl mantığı 2027, 2028 ve 2030 yıllarında sabit yıl olmadan çalışır (API, Client ve Otonom Ajan)", () => {
    for (const year of [2027, 2028, 2030]) {
      const sampleDate = new Date(`${year}-05-15T10:00:00Z`);

      expect(getClientDynamicYears(sampleDate)).toEqual({
        currentYear: year,
        nextYear: year + 1,
      });
      expect(getApiDynamicYears(sampleDate)).toEqual({
        currentYear: year,
        nextYear: year + 1,
      });
      expect(getAgentDynamicYears(sampleDate)).toEqual({
        currentYear: year,
        nextYear: year + 1,
      });

      const clientQueries = buildTopicGroundingQueries(sampleDate);
      expect(clientQueries.economy_budget.query).toContain(`${year} OR ${year + 1}`);
      expect(clientQueries.economy_budget.query).not.toContain("2026");
      expect(clientQueries.tourism_occupancy.query).toContain(`${year}`);
      expect(clientQueries.protocol_activity.query).toContain("Seddar Yavuz");
      expect(clientQueries.protocol_activity.query).not.toContain("İdris Akbıyık");

      const apiEcoPrompt = buildPromptForTopic("economy_budget", sampleDate);
      expect(apiEcoPrompt).toContain(`${year} OR ${year + 1}`);
      expect(apiEcoPrompt).toContain(`"budgetYear": ${year}`);
      expect(apiEcoPrompt).not.toContain("2026");

      const apiProtoPrompt = buildPromptForTopic("protocol_activity", sampleDate);
      expect(apiProtoPrompt).toContain("Seddar Yavuz");
      expect(apiProtoPrompt).not.toContain("İdris Akbıyık");

      const agentQueries = buildSectorTopicQueries(sampleDate);
      expect(agentQueries.economy_budget).toContain(`${year} OR ${year + 1}`);
      expect(agentQueries.tourism_occupancy).toContain(`${year}`);
      expect(agentQueries.protocol_activity).toContain("Seddar Yavuz");
      expect(agentQueries.protocol_activity).not.toContain("İdris Akbıyık");

      const agentPrompt = buildGroundingPrompt(DISTRICT_GROUPS[2], sampleDate);
      expect(agentPrompt).toContain(`${year}/${year + 1}`);
      expect(agentPrompt).not.toContain('"budget_year": 2026');
    }
  });

  it("2. Muğla Protokol, Kurum İtibar, Sözlük ve Soruşturma verilerinde aktif Vali Seddar Yavuz'dur ve eski vali yer almaz", () => {
    const vali = PROTOCOL_DATA.find((m) => m.unvan === "VALİ");
    expect(vali?.isim).toBe("Seddar YAVUZ");
    expect(PROTOCOL_DATA.some((m) => /akbıyık/i.test(m.isim))).toBe(false);

    const valilik = INSTITUTION_CATALOG.find((i) => i.id === "mugla-valilik");
    expect(valilik?.leader).toBe("Seddar Yavuz");
    expect(valilik?.keywords).toContain("seddar yavuz");

    const serializedInvestigation = JSON.stringify(INVESTIGATION_NODES);
    expect(serializedInvestigation).toContain("Seddar Yavuz");
    expect(serializedInvestigation).not.toMatch(/İdris Akbıyık/i);

    const lexicon = loadLivingLexicon();
    expect(lexicon.some((e) => e.term === "Seddar Yavuz")).toBe(true);
    expect(lexicon.some((e) => /akbıyık/i.test(e.term))).toBe(false);
  });

  it("3. 8 resmi Muğla barajı envanteri ve 26 Kasım 2026 bütçe tohumu (44.8 Milyar ₺ + MUTTAŞ 1.12 Milyar ₺) tutarlıdır", () => {
    expect(MUGLA_DAMS_REGISTRY).toHaveLength(8);
    expect(MUGLA_DAMS_REGISTRY.map((d) => d.id)).toEqual([
      "mumcular",
      "geyik",
      "akgedik",
      "marmaris",
      "akkopru",
      "bayir",
      "esen1",
      "esen2",
    ]);

    expect(VERIFIED_BUDGET_SEED.mbbBillionTry).toBe(24.3);
    expect(VERIFIED_BUDGET_SEED.muskiBillionTry).toBe(20.5);
    expect(VERIFIED_BUDGET_SEED.combinedBillionTry).toBe(44.8);
    expect(VERIFIED_BUDGET_SEED.yoyChangePct).toBe(30.35);
    expect(VERIFIED_BUDGET_SEED.muttasCapitalIncreaseTry).toBe(1_116_639_124);
  });

  it("4. useMonitorStore.liveOverrides çakışma kuralı: canlı veri varsayılanı ezer, boş fallback canlı veriyi silemez, idempotent tekilleştirme çalışır", () => {
    const store = useMonitorStore.getState();

    // Canlı doğrulanmış ekonomi güncellemesi yaz
    store.setEconomyOverride(
      {
        unemploymentRate: 7.4,
        unemploymentPeriod: "2027/Ç1",
        tourismRevenueBn: null,
        newCompanies: null,
        budgetItems: [],
        municipalBudgets: [
          {
            institution: "Büyükşehir Belediyesi",
            amountBillionTry: 29.5,
            year: 2027,
            yoyChangePct: 21.4,
            investmentBillionTry: 11.2,
            sourceName: "Muğla Büyükşehir",
            sourceUrl: "https://www.mugla.bel.tr/haber/2027-butce",
            publishedAt: "2026-11-26T10:00:00Z",
          },
        ],
        combinedTotalBillionTry: 54.0,
        budgetYear: 2027,
        budgetYoyChangePct: 20.5,
        budgetSourceSummary: "Kaynak: Muğla Büyükşehir • 26 Kas",
        hasVerifiedBudgetUpdate: true,
        hasVerifiedLiveData: true,
        latestSourceSummary: "Kaynak: Muğla Büyükşehir • 26 Kas",
        latestMeasuredAt: "2026-11-26T10:00:00Z",
      },
      "2026-11-26T10:00:00Z"
    );

    expect(useMonitorStore.getState().liveOverrides.economy?.combinedTotalBillionTry).toBe(54.0);
    expect(useMonitorStore.getState().liveOverrides.diagramEvents.length).toBeGreaterThanOrEqual(1);

    // Boş fallback güncellemesi canlı veriyi ASLA ezemez
    useMonitorStore.getState().setEconomyOverride({
      unemploymentRate: null,
      unemploymentPeriod: null,
      tourismRevenueBn: null,
      newCompanies: null,
      budgetItems: [],
      municipalBudgets: [],
      combinedTotalBillionTry: null,
      budgetYear: null,
      budgetYoyChangePct: null,
      budgetSourceSummary: "Veri bekleniyor",
      hasVerifiedBudgetUpdate: false,
      hasVerifiedLiveData: false,
      latestSourceSummary: "Veri bekleniyor",
      latestMeasuredAt: null,
    });
    expect(useMonitorStore.getState().liveOverrides.economy?.combinedTotalBillionTry).toBe(54.0);

    // Aynı olayı iki kez kaydetmek mükerrer kayıt oluşturmaz
    const beforeCount = useMonitorStore.getState().liveOverrides.diagramEvents.length;
    useMonitorStore.getState().recordDiagramEvents([
      {
        id: "dup-1",
        tab: "ekonomi",
        district: "Muğla",
        title: "Büyükşehir Belediyesi: 29.5 Milyar ₺ (2027)",
        sourceName: "Muğla Büyükşehir",
        sourceUrl: "https://www.mugla.bel.tr/haber/2027-butce",
        publishedAt: "2026-11-26T10:00:00Z",
      },
    ]);
    expect(useMonitorStore.getState().liveOverrides.diagramEvents.length).toBe(beforeCount);

    // Görev değişikliği kararı protokol listesini otomatik günceller
    useMonitorStore.getState().setProtocolActivitiesOverride([
      {
        id: "decree-1",
        actorName: "Yeni Bodrum Kaymakamı Örnek",
        actorTitle: "Bodrum Kaymakamı",
        category: "gorev_degisikligi",
        summary: "Resmî Gazete kararnamesi ile Bodrum Kaymakamlığına atandı.",
        sourceName: "Resmî Gazete",
        sourceUrl: "https://www.resmigazete.gov.tr/ornek",
        publishedAt: "2026-11-26T11:00:00Z",
      },
    ]);
    const resolved = resolveProtocolMembers(
      PROTOCOL_DATA,
      useMonitorStore.getState().liveOverrides.protocol.roleOverrides
    );
    const bodrumKaymakam = resolved.find((m) =>
      m.unvan.toLocaleLowerCase("tr-TR").includes("bodrum kaymakamı")
    );
    expect(bodrumKaymakam?.isim).toBe("Yeni Bodrum Kaymakamı Örnek");
  });

  it("5. Ekonomi ve Diyagram arayüzü doğrulanmış 44.8 Milyar ₺ / MUTTAŞ 1.12 Milyar ₺ tohumunu gösterir ve mutfak/geliştirici jargonu sızdırmaz", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, fallback: true }),
    } as Response);

    try {
      // Store'a bir canlı sinyal yazıp Diyagram'a otomatik yansıdığını doğrula
      useMonitorStore.getState().recordDiagramEvents([
        {
          id: "live-sig-1",
          tab: "ulasim",
          district: "Bodrum",
          title: "Bodrum çevre yolunda bakım çalışması tamamlandı",
          sourceName: "KGM",
          sourceUrl: "https://www.kgm.gov.tr/",
          publishedAt: new Date().toISOString(),
        },
      ]);

      const { container } = renderWithProviders(
        <>
          <LocalGovBudgetSection />
          <EconomyOverviewPanel />
          <InvestigationHub />
          <DistrictDetailedAnalysisPanel
            selectedDistrictId="bodrum"
            onSelectDistrict={() => {}}
            incidents={[]}
          />
        </>
      );

      await waitFor(() => {
        expect(screen.getByTestId("diagram-live-signals")).toBeTruthy();
      });

      const text = container.textContent ?? "";
      // Doğrulanmış bütçe tohumları görünür, eski 8.2 Milyar yok
      expect(text).toContain("44.8");
      expect(text).toContain("24.3");
      expect(text).toContain("20.5");
      expect(text).toContain("MUTTAŞ Sermaye Artışı");
      expect(text).not.toContain("8.2 Milyar ₺");

      // Diyagram canlı sinyali gösterir ve DEMO / mutfak jargonu içermez
      expect(text).toContain("Bodrum çevre yolunda bakım çalışması tamamlandı");
      expect(text).not.toMatch(/ÖRNEK \/ DEMO/i);
      expect(text).not.toMatch(/social-collect/i);
      expect(text).not.toMatch(/Supabase DB/i);
      expect(text).not.toMatch(/LivingLexicon/i);
      expect(text).not.toMatch(/AutonomousPulseEngine/i);
      expect(text).not.toMatch(/İşini Doğru Yap TomTom/i);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
