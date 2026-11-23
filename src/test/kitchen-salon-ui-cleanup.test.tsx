import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import {
  formatPlainTrafficNotice,
  TrafficDensityMap,
} from "@/components/dashboard/sections/TrafficDensityMap";
import { SocialIntelSection } from "@/components/dashboard/sections/SocialIntelSection";
import { InvestigationHub } from "@/components/investigation/InvestigationHub";
import {
  loadLivingLexicon,
  appendToLivingLexicon,
} from "@/services/livingLexiconService";
import { AISummaryCard } from "@/components/AISummaryCard";
import { FIELD_INGESTION_PRESETS } from "@/services/fieldArbitrationEngine";
import { UnifiedIntelligenceProvider, useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { I18nProvider } from "@/hooks/useTranslation";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  normalizeAgentFindings,
  buildSupabasePayloads,
  DISTRICT_GROUPS,
} from "../../scripts/run-autonomous-agent.mjs";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain;
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
  isSupabaseClientConfigured: false,
}));

const renderWithProviders = (node: React.ReactNode) => {
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

// Helper component that injects a VERIFIED traffic discrepancy silently in the background once
const TrafficPatchSeeder = () => {
  const { ingestFieldSubmission } = useUnifiedIntelligence();
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void ingestFieldSubmission({
      text: "Aksaz yol ayrımında yoğun trafik ve uzun araç kuyruğu var, Yalancıboğaz yönü kilitlendi.",
      sourceUrl: "https://mugla.bel.tr/duyurular/aksaz-yol-yogunlugu",
      corroborationCount: 2,
      tomtomHotspots: [{ name: "Marmaris", lat: 36.85, lng: 28.27, density: 20, speed: 50 }],
    });
  }, [ingestFieldSubmission]);
  return null;
};

// Helper component that attempts an UNVERIFIED social submission and displays resulting counts
const UnverifiedSubmissionProbe = () => {
  const {
    ingestFieldSubmission,
    arbitratedEvents,
    groundTruthPatches,
    cityPulseInjections,
    tabNotifications,
  } = useUnifiedIntelligence();
  const ranRef = React.useRef(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      await ingestFieldSubmission({
        text: FIELD_INGESTION_PRESETS[1].text,
        tomtomHotspots: [{ name: "Marmaris", lat: 36.85, lng: 28.27, density: 20, speed: 50 }],
      });
      setDone(true);
    })();
  }, [ingestFieldSubmission]);

  return (
    <div data-testid="unverified-probe">
      <span data-testid="probe-done">{String(done)}</span>
      <span data-testid="probe-events">{arbitratedEvents.length}</span>
      <span data-testid="probe-patches">{groundTruthPatches.length}</span>
      <span data-testid="probe-pulses">{cityPulseInjections.length}</span>
      <span data-testid="probe-notifs">{tabNotifications.length}</span>
    </div>
  );
};

describe("Mutfak (Arka Plan) — Salon (Arayüz) UI Temizliği", () => {
  beforeEach(() => {
    window.localStorage.clear();
    if (typeof globalThis.ResizeObserver === "undefined") {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    }
  });

  it("formats traffic warnings into a single plain Turkish sentence without technical jargon", () => {
    const notice = formatPlainTrafficNotice({
      id: "tp-1",
      districtSlug: "marmaris",
      districtName: "Marmaris",
      location: "Aksaz yol ayrımı",
      lat: 36.84,
      lng: 28.31,
      tomtomDensity: 20,
      reportedSeverity: 88,
      sensorDiscrepancy: true,
      verdictMessage: "SENSÖR UYUŞMAZLIĞI / KÖR NOKTA TESPİT EDİLDİ (İşini Doğru Yap TomTom!)",
      reason: "Araç kuyruğu",
      timestamp: new Date().toISOString(),
      dossierCode: "ODİT-MAR-99",
    });

    expect(notice).toMatch(/Aksaz/i);
    expect(notice).toMatch(/yoğunluk bildirildi/i);
    expect(notice).not.toMatch(/TomTom|Sensör|Hakemlik|ODİT|Kör Nokta/i);
  });

  it("renders a clean clickable ! marker on TrafficDensityMap instead of technical TomTom/discrepancy banners", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false }),
    } as Response);

    try {
      renderWithProviders(
        <>
          <TrafficPatchSeeder />
          <TrafficDensityMap />
        </>
      );

      await waitFor(() => {
        const markers = document.querySelectorAll('[data-testid^="traffic-warning-marker-"]');
        expect(markers.length).toBeGreaterThanOrEqual(1);
      });

      // Must NOT show any developer/system jargon
      expect(screen.queryByText(/İşini Doğru Yap TomTom/i)).toBeNull();
      expect(screen.queryByText(/SENSÖR UYUŞMAZLIĞI/i)).toBeNull();
      expect(screen.queryByText(/SAHA YAMASI/i)).toBeNull();
      expect(screen.queryByText(/Hakemlik/i)).toBeNull();

      // Clicking the simple ! warning marker reveals a plain single-sentence notice
      const marker = document.querySelector('[data-testid^="traffic-warning-marker-"]') as Element;
      fireEvent.click(marker);

      const noticeBox = await screen.findByTestId("traffic-plain-notice");
      expect(noticeBox.textContent).toMatch(/yoğunluk bildirildi/i);
      expect(noticeBox.textContent).not.toMatch(/TomTom|Sensör|ODİT/i);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("keeps SocialIntelSection clean without FieldIngestionConsole or lexicon drawer buttons while LivingLexicon works in background", () => {
    renderWithProviders(<SocialIntelSection />);

    expect(screen.getByText(/Sosyal Medya Gündemi/i)).toBeTruthy();
    expect(screen.queryByText(/Söz Dağarcığı Havuzu/i)).toBeNull();
    expect(screen.queryByText(/Sahadan Paylaşım Besle/i)).toBeNull();
    expect(screen.queryByText(/YAŞAYAN SÖZLÜK/i)).toBeNull();
    expect(screen.queryByText(/LivingLexicon/i)).toBeNull();

    // Background LivingLexicon service still operates append-only
    const initial = loadLivingLexicon();
    const { nextEntries, addedCount } = appendToLivingLexicon(initial, [
      { term: "Selimiye Liman Caddesi", layer: "micro_geo", district: "Marmaris" },
    ]);
    expect(addedCount).toBe(1);
    expect(nextEntries.length).toBe(initial.length + 1);
  });

  it("keeps InvestigationHub free of FieldIngestionConsole and OSINT/ODİT jargon", () => {
    renderWithProviders(<InvestigationHub />);

    expect(screen.getByText(/Haber Doğrulama Merkezi/i)).toBeTruthy();
    expect(screen.queryByText(/OSINT & KULİS/i)).toBeNull();
    expect(screen.queryByText(/Sahadan Paylaşım \/ Görsel Besle/i)).toBeNull();
    expect(screen.queryByText(/SORGU HÜKMÜ/i)).toBeNull();
  });

  it("purges legacy v1 unverified localStorage alerts and never renders Güncel Şehir Notları / Çapraz Doğrulama in AISummaryCard", () => {
    // Seed legacy v1 cache with the exact unverified Marmaris Aksaz warning from screenshot
    window.localStorage.setItem(
      "mugla_unified_hub_events_v1",
      JSON.stringify([
        {
          id: "evt-legacy-1",
          pulseLine:
            "🚨 [ÇAPRAZ DOĞRULAMA · ODİT-MAR-01] Marmaris (Aksaz Yol Ayrımı - Yalancıboğaz): SENSÖR UYUŞMAZLIĞI / KÖR NOKTA TESPİT EDİLDİ (İşini Doğru Yap TomTom!)",
        },
      ])
    );

    renderWithProviders(<AISummaryCard type="pulse" />);

    expect(window.localStorage.getItem("mugla_unified_hub_events_v1")).toBeNull();
    expect(screen.queryByText(/Güncel Şehir Notları/i)).toBeNull();
    expect(screen.queryByText(/ÇAPRAZ DOĞRULAMA/i)).toBeNull();
    expect(screen.queryByText(/SENSÖR UYUŞMAZLIĞI/i)).toBeNull();
    expect(screen.queryByText(/İşini Doğru Yap TomTom/i)).toBeNull();
  });

  it("blocks unverified / single-source social reports from creating events, map patches, pulse notes, or notifications", async () => {
    renderWithProviders(<UnverifiedSubmissionProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("probe-done").textContent).toBe("true");
    });

    expect(screen.getByTestId("probe-events").textContent).toBe("0");
    expect(screen.getByTestId("probe-patches").textContent).toBe("0");
    expect(screen.getByTestId("probe-pulses").textContent).toBe("0");
    expect(screen.getByTestId("probe-notifs").textContent).toBe("0");
  });

  it("prevents the autonomous agent from emitting unverified posts, keywords, or alerts without external source URLs or grounding chunks", () => {
    const groupB = DISTRICT_GROUPS[1];
    const unverifiedFindings = normalizeAgentFindings(
      {
        posts: [
          {
            title: "Marmaris Aksaz yol ayrımında söylenti trafik iddiası",
            summary: "Doğrulanmamış tekil sosyal medya paylaşımı.",
            district: "Marmaris",
            category: "ulasim",
            sentiment: "negative",
            severity: "critical",
            source_name: "Anonim Hesap",
            source_url: null,
            keywords: ["aksaz", "tomtom"],
          },
        ],
        new_keywords: [{ keyword: "teyitsiz-etiket", category: "ulasim", district: "Marmaris" }],
        alerts: [
          {
            title: "Teyitsiz Marmaris Trafik Uyarısı",
            body: "Kaynak URL olmadan üretilmiş uyarı.",
            district: "Marmaris",
            severity: "critical",
            type: "trafik",
          },
        ],
      },
      groupB,
      []
    );

    expect(unverifiedFindings.posts).toHaveLength(0);
    expect(unverifiedFindings.keywords).toHaveLength(0);
    expect(unverifiedFindings.alerts).toHaveLength(0);

    const payloads = buildSupabasePayloads({
      findings: unverifiedFindings,
      group: groupB,
    });
    expect(payloads.postRows).toHaveLength(0);
    expect(payloads.keywordRows).toHaveLength(0);
    expect(payloads.alertRows).toHaveLength(0);
  });
});
