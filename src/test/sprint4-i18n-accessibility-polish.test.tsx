import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { AccessibilityProvider, simplifyCitizenText } from "@/contexts/AccessibilityContext";
import { I18nProvider, translateText, useTranslation } from "@/hooks/useTranslation";
import { UnifiedIntelligenceProvider } from "@/contexts/UnifiedIntelligenceContext";
import { AuthProvider } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DataOriginBadge } from "@/components/dashboard/DataOriginBadge";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { EarthquakeAlertBanner } from "@/components/EarthquakeAlertBanner";
import { TrafficSummaryPanel } from "@/components/dashboard/sections/TransportSection";
import { EconomyOverviewPanel } from "@/components/dashboard/sections/EconomySection";
import { buildDynamicCityPulse, formatQuakeLocation } from "@/hooks/useAISummary";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
    ResizeObserverMock;
}

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseClientConfigured: false,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => {
      const chain: Record<string, any> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.gte = () => chain;
      chain.limit = () => chain;
      chain.order = async () => ({ data: [], error: null });
      chain.upsert = async () => ({ data: null, error: null });
      chain.maybeSingle = async () => ({ data: null, error: null });
      return chain;
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  },
}));

vi.mock("@/hooks/useLiveData", () => ({
  useLiveData: (dataType: string) => {
    if (dataType === "traffic_density") {
      return {
        data: {
          hotspots: Array.from({ length: 13 }, (_, idx) => ({
            name: idx === 0 ? "Bodrum" : `District ${idx + 1}`,
            density: idx === 0 ? 58 : 20,
          })),
        },
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
      };
    }
    return { data: null, isLoading: false, isError: false, dataUpdatedAt: 0 };
  },
}));

const renderWrapped = (node: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <AccessibilityProvider>
            <I18nProvider>
              <AuthProvider>
                <UnifiedIntelligenceProvider>{node}</UnifiedIntelligenceProvider>
              </AuthProvider>
            </I18nProvider>
          </AccessibilityProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const CitizenTermsProbe: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div>
      <span data-testid="term-aqi">{t("Hava Kalitesi (AQI)")}</span>
      <span data-testid="term-hm3">{t("185 hm³")}</span>
      <span data-testid="term-diagram">{t("Diyagram")}</span>
      <span data-testid="term-traffic">{t("Trafik Yoğunluğu %")}</span>
    </div>
  );
};

describe("Sprint 4 — Tam TR/EN Dil Birliği, Sade Mod ve Üst Çubuk Erişilebilirlik", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-view-mode");
    document.documentElement.removeAttribute("data-font-scale");
    document.documentElement.classList.remove("high-contrast-mode");
  });

  it("1. EN modunda başlık, deprem bandı, trafik, ekonomi ve City Pulse içinde Türkçe kelime kalmaz", async () => {
    window.localStorage.setItem("mugla-lang", "en");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "eq-1",
            properties: {
              mag: 4.3,
              place: "12 km WSW of Bodrum, Turkey",
              time: Date.now() - 5 * 60 * 1000,
              url: "https://earthquake.usgs.gov/earthquakes/eventpage/eq-1",
            },
            geometry: { coordinates: [27.3, 37.0, 8.2] },
          },
        ],
      }),
    } as unknown as Response);

    try {
      const { container } = renderWrapped(
        <>
          <DashboardHeader activeTab="genel" />
          <EarthquakeAlertBanner />
          <TrafficSummaryPanel />
          <EconomyOverviewPanel />
          <DataOriginBadge origin="reference" />
        </>
      );

      await waitFor(() => {
        expect(container.textContent || "").toContain("1 CRITICAL EARTHQUAKE IN LAST 24H");
      });

      const text = container.textContent || "";

      // EN modunda yasaklı Türkçe sızıntılar bulunmamalı
      expect(text).not.toMatch(/SON 24 SAATTE/i);
      expect(text).not.toMatch(/KRİTİK DEPREM/i);
      expect(text).not.toMatch(/ORT\.\s*TRAFFIC/i);
      expect(text).not.toMatch(/13 İlçe/i);
      expect(text).not.toMatch(/EN YOĞUN İLÇE/i);
      expect(text).not.toMatch(/ALTYAPI \/ YOL DURUMU/i);
      expect(text).not.toMatch(/BÜTÇE \/ İHALE/i);
      expect(text).not.toMatch(/REFERANS VERİ/i);
      expect(text).not.toMatch(/Canlı yol\/altyapı duyurusu/i);

      // EN karşılıkları görünmeli
      expect(text).toContain("1 CRITICAL EARTHQUAKE IN LAST 24H");
      expect(text).toContain("13");
      expect(text).toContain("districts");
      expect(text).toContain("Busiest District");
      expect(text).toContain("REFERENCE DATA");
    } finally {
      fetchSpy.mockRestore();
    }

    // City Pulse EN çıktısı tamamen İngilizce üretilir
    const pulseEn = buildDynamicCityPulse(
      {
        weather: { temperature: 22.1, condition: "Güneşli" },
        airQuality: { aqi: 24, aqi_label: "İyi" },
        traffic: { hotspots: [{ name: "Bodrum", density: 35 }] },
        dams: {
          avgOccupancy: 78,
          verifiedCount: 1,
          latestSourceSummary: "Kaynak: Anter Haber • 18 Kas",
          latestMeasuredAt: "2026-11-18T08:00:00Z",
        },
        tourism: {
          hotelOccupancyPct: null,
          annualTourists: null,
          occupancySourceSummary: "Canlı otel doluluk verisi yok · TÜRSAB/BODER taraması bekleniyor",
          latestMeasuredAt: null,
        },
        security: {
          latestQuake: {
            id: "eq-en",
            magnitude: 4.1,
            location: "10 km WSW of Bodrum, Turkey",
            depthKm: 7.0,
            occurredAt: "2026-11-18T10:00:00Z",
            sourceName: "AFAD",
          },
          publicOrderEvents: [],
          latestSourceSummary: "Kaynak: AFAD • 18 Kas",
          latestMeasuredAt: "2026-11-18T10:00:00Z",
        },
      },
      "en"
    );

    expect(pulseEn.summary).toContain("22.1°C (Sunny)");
    expect(pulseEn.summary).toContain("EAQI 24 (Good)");
    expect(pulseEn.summary).toContain("78%");
    expect(pulseEn.summary).toContain("Bodrum (10 km west-southwest) — M4.1 (7 km depth)");
    expect(pulseEn.summary).not.toMatch(/Muğla genelinde|Barajlar|Turizmde|batı-güneybatısı/i);
  });

  it("1b. TR modunda İngilizce kalıntılar (Updated, IN PROGRESS, Across Muğla, Air quality, WSW of) temizlenir", () => {
    expect(translateText("Updated: 12:30", "tr")).toBe("Güncellendi: 12:30");
    expect(translateText("IN PROGRESS", "tr")).toBe("DEVAM");
    expect(translateText("Across Muğla", "tr")).toBe("Muğla genelinde");
    expect(translateText("Air quality: İyi", "tr")).toBe("Hava kalitesi: İyi");
    expect(formatQuakeLocation("12 km WSW of Bodrum, Turkey", "tr")).toBe(
      "Bodrum (12 km batı-güneybatısı)"
    );
    expect(formatQuakeLocation("12 km WSW of Bodrum, Turkey", "en")).toBe(
      "Bodrum (12 km west-southwest)"
    );
  });

  it("2. Sade Mod teknik kısaltmaları günlük dile çevirir ve teknik etiketleri .tech-meta-only ile işaretler", () => {
    const { container } = renderWrapped(
      <>
        <DashboardHeader activeTab="genel" />
        <CitizenTermsProbe />
        <DashboardPanel title="Hava Kalitesi (AQI)" badge="REFERANS · 2024">
          <DataOriginBadge origin="reference" />
          <DataSourceBadge type="estimate" />
        </DashboardPanel>
      </>
    );

    // Sade Moda geç
    fireEvent.click(screen.getByTestId("view-mode-toggle"));
    expect(document.documentElement.dataset.viewMode).toBe("citizen");

    // TR Sade Mod çevirileri
    expect(screen.getByTestId("term-aqi").textContent).toBe("Hava Kalitesi");
    expect(screen.getByTestId("term-hm3").textContent).toBe("185 Milyon m³");
    expect(screen.getByTestId("term-diagram").textContent).toBe("Olay Doğrulama");
    expect(screen.getByTestId("term-traffic").textContent).toBe("Yol Durumu");

    // EN Sade Mod çevirileri
    expect(simplifyCitizenText("AQI / EAQI 185 hm³", "en")).toBe("Air Quality / Air Quality 185 Million m³");
    expect(simplifyCitizenText("Traffic Congestion %", "en")).toBe("Road Conditions");
    expect(simplifyCitizenText("Diagram", "en")).toBe("Event Verification");

    // Teknik sensör/referans rozetleri .tech-meta-only sınıfına sahip (CSS ile Sade Modda gizlenir)
    expect(container.querySelectorAll(".tech-meta-only").length).toBeGreaterThanOrEqual(3);
  });

  it("3. Üst çubuk Görünüm menüsünü açıp kapatır ve ikon butonları aria-label + focus-visible taşır", () => {
    renderWrapped(<DashboardHeader activeTab="genel" />);

    const trigger = screen.getByTestId("display-menu-trigger");
    const panel = screen.getByTestId("display-menu-panel");

    expect(trigger.getAttribute("aria-label")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.className).toContain("focus-visible:ring-2");
    expect(panel.className).toContain("hidden");

    // Görünüm menüsünü aç
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel.className).not.toContain("hidden");

    // Dil butonları aria-label + focus-visible taşır (TR modunda Türkçe, EN modunda İngilizce)
    const langEn = screen.getByTestId("lang-en");
    const langTr = screen.getByTestId("lang-tr");
    expect(langEn.getAttribute("aria-label")).toContain("İngilizce");
    expect(langTr.getAttribute("aria-label")).toContain("Türkçe");
    expect(langEn.className).toContain("focus-visible:ring-2");

    // EN diline geçince Görünüm menüsü ve dil butonları tamamen İngilizce olur
    fireEvent.click(langEn);
    expect(trigger.textContent).toContain("Display");
    expect(trigger.getAttribute("aria-label")).toContain("Display");
    expect(langEn.getAttribute("aria-label")).toContain("English");
  });
});
