import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/hooks/useTranslation";
import { UnifiedIntelligenceProvider } from "@/contexts/UnifiedIntelligenceContext";
import { useMonitorStore } from "@/store/useMonitorStore";
import { computeSocialTrendsFromPosts } from "@/services/social-intel-service";
import { buildReferenceFlightsPayload } from "../../api/flights";

function renderWithProviders(ui: React.ReactElement, initialRoute = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <I18nProvider>
          <TooltipProvider>
            <UnifiedIntelligenceProvider>{ui}</UnifiedIntelligenceProvider>
          </TooltipProvider>
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("10 Sekme Ekran Tutarlılık ve Boş Alan Düzeltmeleri", () => {
  beforeEach(() => {
    localStorage.clear();
    useMonitorStore.getState().resetStore();
    if (typeof globalThis.ResizeObserver === "undefined") {
      (globalThis as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Boş '—' kalan Ekonomi, Turizm, Çevre (8 baraj) ve Enerji kartlarını doğrulanmış REFERANS VERİ ile doldurur", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, fallback: true }),
    } as Response);

    const { EconomyOverviewPanel } = await import("@/components/dashboard/sections/EconomySection");
    const { TourismMovementPanel, AccommodationPanel } = await import(
      "@/components/dashboard/sections/TourismSection"
    );
    const { WaterDamsPanel } = await import("@/components/dashboard/sections/EnvironmentSection");
    const { EnergyConsumptionPanel } = await import("@/components/dashboard/sections/EnergySection");

    const { container } = renderWithProviders(
      <>
        <EconomyOverviewPanel />
        <TourismMovementPanel />
        <AccommodationPanel />
        <WaterDamsPanel />
        <EnergyConsumptionPanel />
      </>
    );

    await waitFor(() => {
      expect(screen.getAllByText("REFERANS VERİ").length).toBeGreaterThanOrEqual(4);
    });

    const text = container.textContent ?? "";
    // Ekonomi
    expect(text).toContain("7.4");
    expect(text).toContain("142.8");
    // Turizm
    expect(text).toContain("3.74M");
    expect(text).toContain("9.9M");
    expect(text).toContain("218");
    expect(text).toContain("242K");
    expect(text).toContain("68");
    // Çevre (8 gerçek baraj — Ören/Akgün/Yazır YOK)
    expect(text).toContain("48%");
    expect(text).toContain("54%");
    expect(text).toContain("62%");
    expect(text).toContain("71%");
    expect(text).not.toMatch(/Ören Barajı|Akgün Barajı|Yazır Barajı/i);
    // Enerji
    expect(text).toContain("11.8");
  });

  it("2. Sosyal sekmesi canlı social_posts varken çelişkili 'Henüz doğrulanabilir sosyal içerik alınamadı' mesajı göstermez", async () => {
    const samplePosts = [
      {
        id: "sp-1",
        platform: "news",
        content: "Bodrum Mumcular Barajı su seviyesi ve MUSKİ altyapı çalışmaları değerlendirildi",
        sentiment: "negative",
        district: "Bodrum",
        author: "Muğla Gazetesi",
        publishedAt: new Date().toISOString(),
        url: "https://example.com/1",
        engagementScore: 42,
        category: "cevre",
      },
      {
        id: "sp-2",
        platform: "news",
        content: "Fethiye ve Marmaris turizm sezonunda otel doluluk oranları yükseldi",
        sentiment: "positive",
        district: "Fethiye",
        author: "Anter Haber",
        publishedAt: new Date().toISOString(),
        url: "https://example.com/2",
        engagementScore: 68,
        category: "turizm",
      },
      {
        id: "sp-3",
        platform: "x",
        content: "Menteşe ulaşım ve MUTTAŞ yeni otobüs saatleri açıklandı",
        sentiment: "neutral",
        district: "Menteşe",
        author: "@muglamonitor",
        publishedAt: new Date().toISOString(),
        url: "https://example.com/3",
        engagementScore: 25,
        category: "ulasim",
      },
    ];

    const computed = computeSocialTrendsFromPosts(samplePosts);
    expect(computed.totalMentions).toBe(3);
    expect(computed.trends.length).toBeGreaterThan(0);
    expect(computed.platformBreakdown.length).toBeGreaterThan(0);

    useMonitorStore.setState({
      socialFeed: {
        items: samplePosts,
        totalCount: 3,
        sentiment: { positive: 1, negative: 1, neutral: 1 },
        updatedAt: new Date().toISOString(),
      },
    });

    const { SocialIntelSection } = await import("@/components/dashboard/sections/SocialIntelSection");
    const { TrendTopicsSection } = await import("@/components/dashboard/sections/TrendTopicsSection");

    const { container } = renderWithProviders(
      <>
        <SocialIntelSection />
        <TrendTopicsSection />
      </>
    );

    await waitFor(() => {
      const text = container.textContent ?? "";
      expect(text).not.toContain("Henüz doğrulanabilir sosyal içerik alınamadı");
      expect(text).not.toContain("Henüz yeterli doğrulanabilir içerik yok");
    });
  });

  it("3. Diyagram sekmesi sahte DEMO / Sorgu Odası Transkripti / #BodrumSusuz içeriği barındırmaz", async () => {
    useMonitorStore.setState({
      socialFeed: {
        items: [
          {
            id: "real-1",
            platform: "news",
            content: "Muğla Büyükşehir Belediyesi Bodrum içme suyu hattı bakımını tamamladı",
            sentiment: "positive",
            district: "Bodrum",
            author: "MBB Basın",
            publishedAt: new Date().toISOString(),
            url: "https://mugla.bel.tr/duyuru",
            engagementScore: 15,
            category: "altyapi",
          },
        ],
        totalCount: 1,
        sentiment: { positive: 1, negative: 0, neutral: 0 },
        updatedAt: new Date().toISOString(),
      },
      protocolMembers: [
        {
          id: "pm-1",
          isim: "Seddar Yavuz",
          unvan: "Muğla Valisi",
          kategori: "Mülki İdare",
          district: "Menteşe",
        },
      ],
    });

    const { InvestigationHub } = await import("@/components/investigation/InvestigationHub");
    const { container } = renderWithProviders(<InvestigationHub />);

    await waitFor(() => {
      expect(screen.getByTestId("hub-toggle-verification")).toBeTruthy();
    });

    const text = container.textContent ?? "";
    expect(text).not.toContain("Örnek Konular");
    expect(text).not.toContain("Sorgu Odası Transkripti");
    expect(text).not.toContain("#BodrumSusuz");
    expect(text).not.toContain("Bot Dalgası");
  });

  it("4. Güvenlik sekmesinde alakasız Yerel Yönetim Bütçeleri kartı yer almaz", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false }),
    } as Response);

    const { SecuritySection } = await import("@/components/dashboard/sections/SecuritySection");
    const { container } = renderWithProviders(<SecuritySection />);

    await waitFor(() => {
      expect(container.textContent).toContain("Güvenlik");
    });

    expect(container.textContent ?? "").not.toContain("Yerel Yönetim Bütçeleri");
  });

  it("5. Uçuş Takip bileşeni /api/flights kullanır, hata durumunda temiz referans veriye düşer ve asla 'adsb.fi'ye erişim hatası' göstermez", async () => {
    const refPayload = buildReferenceFlightsPayload("DLM");
    expect(refPayload.ok).toBe(true);
    expect(refPayload.airports.DLM.flights.length).toBeGreaterThan(0);
    expect(refPayload.airports.BJV.flights.length).toBeGreaterThan(0);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const { FlightTrackerSection } = await import(
      "@/components/dashboard/sections/FlightTrackerSection"
    );
    const { container } = renderWithProviders(<FlightTrackerSection />);

    await waitFor(() => {
      expect(container.textContent ?? "").toContain("Dalaman");
    });

    const text = container.textContent ?? "";
    expect(text).not.toContain("adsb.fi'ye erişim hatası");
    expect(text).not.toContain("adsb.fi");
  });

  it("6. Genel Bakış nabız özeti hava verisi senkronuyla 'canlı meteoroloji ölçümü bekleniyor' mesajı üretmez", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false }),
    } as Response);

    const { AISummaryCard } = await import("@/components/AISummaryCard");
    const { container } = renderWithProviders(<AISummaryCard type="pulse" />);

    await waitFor(() => {
      expect((container.textContent ?? "").length).toBeGreaterThan(20);
    });

    expect(container.textContent ?? "").not.toContain("canlı meteoroloji ölçümü bekleniyor");
  });
});
