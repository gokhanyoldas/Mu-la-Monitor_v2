import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import {
  MUGLA_DAMS_REGISTRY,
  TOPIC_GROUNDING_QUERIES,
  extractDamUpdatesFromNewsText,
  mergeDamIntelligence,
  formatShortTurkishDate,
  writeLocalTopicCache,
} from "@/services/topicGroundingService";
import { WaterDamsPanel } from "@/components/dashboard/sections/EnvironmentSection";
import { UnifiedIntelligenceProvider } from "@/contexts/UnifiedIntelligenceContext";
import { I18nProvider } from "@/hooks/useTranslation";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SECTOR_TOPIC_QUERIES,
  normalizeAgentFindings,
  DISTRICT_GROUPS,
} from "../../scripts/run-autonomous-agent.mjs";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => {
      const ch: Record<string, any> = {};
      ch.on = vi.fn(() => ch);
      ch.subscribe = vi.fn(() => ch);
      return ch;
    }),
    removeChannel: vi.fn(),
    from: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
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

describe("Konu Bazlı Grounding ve Gerçek Baraj Verileri", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses verified DSİ capacities for Muğla dams (Mumcular = 18.6 hm³, never 70.2 hm³)", () => {
    const mumcular = MUGLA_DAMS_REGISTRY.find((d) => d.id === "mumcular");
    const geyik = MUGLA_DAMS_REGISTRY.find((d) => d.id === "geyik");
    const akgedik = MUGLA_DAMS_REGISTRY.find((d) => d.id === "akgedik");
    const marmaris = MUGLA_DAMS_REGISTRY.find((d) => d.id === "marmaris");

    expect(MUGLA_DAMS_REGISTRY).toHaveLength(8);
    expect(mumcular?.capacityHm3).toBe(18.6);
    expect(geyik?.capacityHm3).toBe(40.8);
    expect(akgedik?.capacityHm3).toBe(26.3);
    expect(marmaris?.capacityHm3).toBe(30.0);
  });

  it("extracts verified Turkish press dam percentages and rejects untrusted claims", () => {
    const extracted = extractDamUpdatesFromNewsText({
      text: "Son yağışların ardından Mumcular Barajı doluluk %80'i aştı, Geyik Barajı yüzde 64,5 seviyesine çıktı.",
      sourceName: "Anter Haber",
      sourceUrl: "https://anterhaber.com/mumcular-baraji-doluluk-80",
      publishedAt: "2026-11-18T09:30:00Z",
    });

    expect(extracted).toHaveLength(2);
    expect(extracted[0]).toMatchObject({
      damId: "mumcular",
      occupancyRate: 80,
      sourceName: "Anter Haber",
      confidence: "high",
    });
    expect(extracted[1]).toMatchObject({
      damId: "geyik",
      occupancyRate: 64.5,
    });

    // Untrusted anonymous claim without URL must be rejected
    const rejected = extractDamUpdatesFromNewsText({
      text: "Mumcular Barajı %99 doluymuş diyorlar",
      sourceName: "Anonim",
    });
    expect(rejected).toHaveLength(0);
  });

  it("discards legacy synthetic seasonal cache (70.2 hm³) and applies newer verified press/grounding measurements with short Turkish date", () => {
    expect(formatShortTurkishDate("2026-11-18T10:00:00Z")).toBe("18 Kas");

    const snapshot = mergeDamIntelligence({
      cacheData: {
        source: "DSİ (Devlet Su İşleri) — Sezonsal Model",
        dams: [
          { name: "Mumcular Barajı", capacity_hm3: 70.2, occupancy_rate: 35 },
          { name: "Geyik Barajı", capacity_hm3: 48.5, occupancy_rate: 31 },
        ],
      },
      groundedUpdates: [
        {
          damId: "mumcular",
          damName: "Mumcular Barajı",
          occupancyRate: 80,
          sourceName: "Yerel Basın/DSİ",
          sourceUrl: "https://anterhaber.com/mumcular-80",
          measuredAt: "2026-11-18T11:00:00Z",
          confidence: "high",
        },
      ],
    });

    const mumcular = snapshot.dams.find((d) => d.id === "mumcular");
    const geyik = snapshot.dams.find((d) => d.id === "geyik");

    expect(mumcular?.capacityLabel).toBe("18.6 hm³");
    expect(mumcular?.occupancyRate).toBe(80);
    // Geyik had only synthetic seasonal cache -> must stay null instead of fake 31%
    expect(geyik?.occupancyRate).toBeNull();
    expect(snapshot.avgOccupancy).toBe(80);
    expect(snapshot.latestSourceSummary).toBe("Kaynak: Yerel Basın/DSİ • 18 Kas");
  });

  it("renders WaterDamsPanel with verified 18.6 hm³ capacity, live grounded percentage, and honest source/date note (never 70.2 hm³ or fake hourly DSİ)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    writeLocalTopicCache("environment_dams", {
      topic: "environment_dams",
      fetchedAt: new Date().toISOString(),
      damUpdates: [
        {
          damId: "mumcular",
          damName: "Mumcular Barajı",
          occupancyRate: 80,
          sourceName: "Anter Haber",
          sourceUrl: "https://anterhaber.com/mumcular-baraji-doluluk-80",
          measuredAt: "2026-11-18T10:00:00Z",
          confidence: "high",
        },
      ],
      groundingSources: [{ uri: "https://anterhaber.com/mumcular-baraji-doluluk-80", title: "Anter Haber" }],
    });

    try {
      renderWithProviders(<WaterDamsPanel />);

      await waitFor(() => {
        expect(screen.getByText("80%")).toBeTruthy();
      });

      expect(screen.getByText("18.6 hm³")).toBeTruthy();
      expect(screen.getByTestId("dam-source-note").textContent).toBe("Kaynak: Anter Haber • 18 Kas");
      expect(screen.queryByText(/70\.2 hm³/i)).toBeNull();
      expect(screen.queryByText(/saatlik/i)).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("shows honest awaiting-measurement state instead of fake hourly DSİ label when no live observation exists", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ ok: false }),
    } as Response);

    try {
      renderWithProviders(<WaterDamsPanel />);

      await waitFor(() => {
        expect(screen.getByTestId("dam-source-note").textContent).toMatch(/Canlı resmi ölçüm yok/i);
      });

      expect(screen.getByText("18.6 hm³")).toBeTruthy();
      expect(screen.queryByText(/70\.2 hm³/i)).toBeNull();
      expect(screen.queryByText(/saatlik/i)).toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("configures sector topic queries and enforces source URL verification on autonomous agent dam updates", () => {
    expect(TOPIC_GROUNDING_QUERIES.environment_dams.query).toContain("Mumcular Barajı");
    expect(TOPIC_GROUNDING_QUERIES.environment_dams.query).toContain("Geyik Barajı");
    expect(TOPIC_GROUNDING_QUERIES.transport_infra.query).toContain("isale hattı patladı");

    expect(SECTOR_TOPIC_QUERIES.environment_dams).toBe(TOPIC_GROUNDING_QUERIES.environment_dams.query);
    expect(SECTOR_TOPIC_QUERIES.transport_infra).toBe(TOPIC_GROUNDING_QUERIES.transport_infra.query);

    const groupA = DISTRICT_GROUPS[0];
    // Without verified source URL -> dropped
    const rejected = normalizeAgentFindings(
      {
        dam_updates: [
          { dam_name: "Mumcular Barajı", occupancy_rate: 82, source_name: "Anonim", source_url: null },
        ],
      },
      groupA,
      []
    );
    expect(rejected.damUpdates).toHaveLength(0);

    // With verified source URL -> accepted with real capacity 18.6 hm³
    const accepted = normalizeAgentFindings(
      {
        dam_updates: [
          {
            dam_name: "Mumcular Barajı",
            occupancy_rate: 82,
            source_name: "Anter Haber",
            source_url: "https://anterhaber.com/mumcular-82",
            published_date: "2026-11-18",
          },
        ],
      },
      groupA,
      []
    );
    expect(accepted.damUpdates).toHaveLength(1);
    expect(accepted.damUpdates[0]).toMatchObject({
      damId: "mumcular",
      capacityHm3: 18.6,
      occupancyRate: 82,
      sourceName: "Anter Haber",
    });
  });
});
