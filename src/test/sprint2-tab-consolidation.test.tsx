import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvestigationHub } from "@/components/investigation/InvestigationHub";
import Index, { DEFAULT_COLUMNS } from "@/pages/Index";
import { UnifiedIntelligenceProvider } from "@/contexts/UnifiedIntelligenceContext";
import { I18nProvider } from "@/hooks/useTranslation";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { TooltipProvider } from "@/components/ui/tooltip";

// Polyfill ResizeObserver for Recharts ResponsiveContainer in jsdom
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
      chain.upsert = async () => ({ data: null, error: null });
      chain.maybeSingle = async () => ({ data: null, error: null });
      return chain;
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  },
  isSupabaseClientConfigured: false,
}));

const renderWithProviders = (node: React.ReactNode, initialEntries: string[] = ["/"]) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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

describe("Sprint 2 — Tekilleştirme ve Sekme Mimarisi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-view-mode");
  });

  it("üst navigasyon çubuğunda (Test) etiketi ve ayrı Protokol ve Veri Ağı sekmesi bulunmaz", () => {
    renderWithProviders(<DashboardHeader activeTab="genel" />);

    expect(screen.queryByText(/\(Test\)/i)).toBeNull();
    expect(screen.queryByText(/Protokol ve Veri Ağı/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Genel Bakış" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Diyagram" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Muğla Protokol" })).toBeTruthy();

    // Sade Modda erişilebilir sade sekme adları görünür.
    fireEvent.click(screen.getByTestId("view-mode-toggle"));
    expect(screen.getByRole("button", { name: "Olay Doğrulama" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "İl Yöneticileri" })).toBeTruthy();
  });

  it("InvestigationHub tek merkezde haber doğrulama ve 13 ilçe bağlantı haritası geçişi sunar", async () => {
    renderWithProviders(<InvestigationHub />);

    expect(screen.getByTestId("hub-toggle-verification").textContent).toContain("Haber Doğrulama");
    expect(screen.getByTestId("hub-toggle-network").textContent).toContain("13 İlçe Bağlantı Haritası");

    fireEvent.click(screen.getByTestId("hub-toggle-network"));

    // 13 ilçe bağlantı haritası açılır ve eski kullanıcı-facing test etiketi yoktur.
    await waitFor(() => {
      expect(screen.getByText(/13 İlçe Bağlantı Haritası/i)).toBeTruthy();
    });
    expect(screen.queryByText(/\(Test\)/i)).toBeNull();

    // Tekrar haber doğrulama görünümüne dönülebilir
    fireEvent.click(screen.getByTestId("hub-toggle-verification"));
    expect(screen.getByText(/Haber Doğrulama Merkezi/i)).toBeTruthy();
  });

  it("Genel Bakış yalnızca 8 özet kutusunu, Şehir Nabzı'nı ve ilk satırdaki 3 ana özet kartını (Trafik, Ekonomi, Turizm) içerir; kopya alt panelleri barındırmaz", () => {
    expect(DEFAULT_COLUMNS).toEqual({
      col1: ["traffic_summary"],
      col2: ["economy"],
      col3: ["tourism_general"],
    });

    // Eski v7 layout localStorage'da olsa bile kopya paneller geri gelmez
    window.localStorage.setItem(
      "mugla_dashboard_columns_v7",
      JSON.stringify({
        col1: ["traffic", "weather", "health"],
        col2: ["economy", "dams", "education"],
        col3: ["tourism_forecast", "security", "heritage"],
      })
    );

    renderWithProviders(<Index />);

    // 8 özet kutusu mevcut
    for (const label of [
      "Nüfus",
      "Turist/Yıl",
      "İşsizlik",
      "Hava",
      "AQI",
      "Otel Doluluk",
      "Baraj",
      "Güvenlik",
    ]) {
      expect(screen.getByTestId(`overview-metric-${label}`)).toBeTruthy();
    }

    // İlk satırdaki 3 ana özet kartı görünür
    expect(screen.getByText(/Ulaşım & Trafik Akışı/i)).toBeTruthy();
    expect(screen.getByText(/Ekonomi & İstihdam/i)).toBeTruthy();
    expect(screen.getAllByText(/^Turizm$/i).length).toBeGreaterThan(0);

    // Diğer sekmelerin kopya büyük kartları Genel Bakış'ta bulunmaz
    expect(screen.queryByText(/Su & Barajlar/i)).toBeNull();
    expect(screen.queryByText(/Enerji & Tüketim/i)).toBeNull();
    expect(screen.queryByText(/Kültürel Miras/i)).toBeNull();
    expect(screen.queryByText(/Güvenlik & Asayiş/i)).toBeNull();
  });

  it("Genel Bakış özet kutularına (Baraj, AQI, Hava, Güvenlik) tıklanınca doğrudan ilgili uzmanlık sekmesine geçer", async () => {
    renderWithProviders(<Index />);

    // Baraj kutusuna tıkla -> Çevre sekmesi (Su & Barajlar açılır)
    fireEvent.click(screen.getByTestId("overview-metric-Baraj"));
    await waitFor(() => {
      expect(screen.getByText(/Su & Barajlar/i)).toBeTruthy();
    });

    // Güvenlik kutusuna tıkla -> Güvenlik sekmesi
    fireEvent.click(screen.getByTestId("overview-metric-Güvenlik"));
    await waitFor(() => {
      expect(screen.getByText(/Güvenlik & Asayiş/i)).toBeTruthy();
    });

    // AQI kutusuna tıkla -> tekrar Çevre sekmesi
    fireEvent.click(screen.getByTestId("overview-metric-AQI"));
    await waitFor(() => {
      expect(screen.getByText(/Hava Kalitesi/i)).toBeTruthy();
    });
  });

  it("eski /?tab=ag_grafigi URL bağlantısı geriye dönük uyumlu olarak Diyagram > 13 İlçe Bağlantı Haritası görünümünü açar", async () => {
    renderWithProviders(<Index />, ["/?tab=ag_grafigi"]);

    await waitFor(() => {
      expect(screen.getByText(/13 İlçe Bağlantı Haritası/i)).toBeTruthy();
    });
    expect(screen.queryByText(/\(Test\)/i)).toBeNull();
  });
});
