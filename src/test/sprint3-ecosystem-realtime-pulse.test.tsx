import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import {
  formatQuakeLocationTr,
  buildDynamicCityPulse,
} from "@/hooks/useAISummary";
import { AISummaryCard } from "@/components/AISummaryCard";
import {
  useSupabaseRealtimeSync,
  REALTIME_SYNC_EVENT,
} from "@/hooks/useSupabaseRealtimeSync";
import {
  UnifiedIntelligenceProvider,
  useUnifiedIntelligence,
} from "@/contexts/UnifiedIntelligenceContext";
import { I18nProvider } from "@/hooks/useTranslation";
import { AuthProvider } from "@/hooks/useAuth";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { TooltipProvider } from "@/components/ui/tooltip";

// @ts-expect-error ESM worker helper exports
import {
  DISTRICT_GROUPS,
  SECTOR_TOPIC_QUERIES,
  GROUP_TOPIC_ASSIGNMENTS,
  selectTopicsForGroup,
  buildGroundingPrompt,
  normalizeAgentFindings,
  buildSupabasePayloads,
  calculateMonthlyQuotaUsage,
} from "../../scripts/run-autonomous-agent.mjs";

type PostgresHandler = (payload: { eventType: string; new?: Record<string, unknown> }) => void;

const registeredListeners: Array<{
  table: string;
  event: string;
  filter?: string;
  callback: PostgresHandler;
}> = [];

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseClientConfigured: true,
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
      chain.neq = () => chain;
      chain.limit = () => chain;
      chain.order = async () => ({ data: [], error: null });
      chain.upsert = async () => ({ data: null, error: null });
      chain.maybeSingle = async () => ({ data: null, error: null });
      return chain;
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
    channel: () => {
      const ch: Record<string, any> = {};
      ch.on = (
        type: string,
        filter: { table?: string; event?: string; filter?: string },
        cb: PostgresHandler
      ) => {
        if (type === "postgres_changes" && filter?.table) {
          registeredListeners.push({
            table: filter.table,
            event: filter.event || "*",
            filter: filter.filter,
            callback: cb,
          });
        }
        return ch;
      };
      ch.subscribe = () => ch;
      return ch;
    },
    removeChannel: () => {},
  },
}));

const RealtimeProbe: React.FC = () => {
  useSupabaseRealtimeSync(true);
  const { lexicon } = useUnifiedIntelligence();
  return (
    <div>
      <span data-testid="lexicon-count">{lexicon.length}</span>
      <span data-testid="lexicon-terms">{lexicon.map((l) => l.term).join("|")}</span>
    </div>
  );
};

describe("Sprint 3 — Dinamik Şehir Nabzı, Supabase Realtime ve 7/24 Ekosistem İşçisi", () => {
  beforeEach(() => {
    window.localStorage.clear();
    registeredListeners.length = 0;
  });

  it("1. City Pulse: sabit %44 baraj, %41 otel ve İngilizce Dinar kalıntısını asla üretmez; eksik veride dürüst bekleme mesajı gösterir", () => {
    const emptyPulse = buildDynamicCityPulse({
      weather: null,
      airQuality: null,
      traffic: null,
      dams: {
        avgOccupancy: null,
        verifiedCount: 0,
        latestSourceSummary: "Canlı resmi ölçüm yok · Yerel basın/DSİ teyidi bekleniyor",
        latestMeasuredAt: null,
      },
      tourism: {
        hotelOccupancyPct: null,
        annualTourists: null,
        occupancySourceSummary: "Canlı otel doluluk verisi yok · TÜRSAB/BODER taraması bekleniyor",
        latestMeasuredAt: null,
      },
      security: {
        latestQuake: null,
        publicOrderEvents: [],
        latestSourceSummary: "Canlı AFAD/Kandilli veya asayiş verisi yok · Tarama bekleniyor",
        latestMeasuredAt: null,
      },
    });

    expect(emptyPulse.summary).not.toContain("%44");
    expect(emptyPulse.summary).not.toContain("%41");
    expect(emptyPulse.summary).not.toContain("Dinar");
    expect(emptyPulse.summary).toContain("Barajlar için güncel ölçüm bekleniyor");
    expect(emptyPulse.summary).toContain("Turizmde güncel otel doluluğu verisi bekleniyor");
  });

  it("1b. City Pulse: canlı baraj, turizm ve M4.2 Bodrum/Ege depremini Türkçe formatta ve KPI kutularıyla çelişmeden yansıtır", () => {
    expect(formatQuakeLocationTr("10 km WSW of Bodrum, Turkey")).toBe(
      "Bodrum (10 km batı-güneybatısı)"
    );
    expect(formatQuakeLocationTr("15 km NE of Marmaris, Turkey")).toBe(
      "Marmaris (15 km kuzeydoğusu)"
    );

    const livePulse = buildDynamicCityPulse({
      weather: { temperature: 21.4, condition: "Güneşli" },
      airQuality: { aqi: 26, aqi_label: "İyi" },
      traffic: {
        hotspots: [
          { name: "Bodrum", density: 38 },
          { name: "Marmaris", density: 22 },
        ],
      },
      dams: {
        avgOccupancy: 80,
        verifiedCount: 1,
        latestSourceSummary: "Kaynak: Anter Haber • 18 Kas",
        latestMeasuredAt: "2026-11-18T08:00:00Z",
      },
      tourism: {
        hotelOccupancyPct: 68,
        annualTourists: "4.1M",
        occupancySourceSummary: "Kaynak: BODER • 18 Kas",
        latestMeasuredAt: "2026-11-18T09:00:00Z",
      },
      security: {
        latestQuake: {
          id: "eq-bodrum",
          magnitude: 4.2,
          location: "12 km WSW of Bodrum, Turkey",
          depthKm: 7.5,
          occurredAt: "2026-11-18T10:00:00Z",
          sourceName: "AFAD",
        },
        publicOrderEvents: [],
        latestSourceSummary: "Kaynak: AFAD • 18 Kas",
        latestMeasuredAt: "2026-11-18T10:00:00Z",
      },
    });

    expect(livePulse.summary).toContain("21.4°C (Güneşli)");
    expect(livePulse.summary).toContain("EAQI 26 (İyi)");
    expect(livePulse.summary).toContain("%80");
    expect(livePulse.summary).toContain("Anter Haber • 18 Kas");
    expect(livePulse.summary).toContain("%68");
    expect(livePulse.summary).toContain("Bodrum (12 km batı-güneybatısı) — M4.2 (7.5 km derinlik)");
    expect(livePulse.summary).not.toContain("Dinar");
    expect(livePulse.summary).not.toContain("%44");
    expect(livePulse.summary).not.toContain("%41");
  });

  it("2. Supabase Realtime: social_keywords ve live_data_cache güncellemeleri sayfa yenilemeden ve 0 Gemini çağrısıyla UI'ya yansır", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const syncEvents: string[] = [];
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      syncEvents.push(detail?.table || "");
    };
    window.addEventListener(REALTIME_SYNC_EVENT, onSync);

    try {
      render(
        <MemoryRouter>
          <QueryClientProvider client={qc}>
            <TooltipProvider>
              <AccessibilityProvider>
                <I18nProvider>
                  <AuthProvider>
                    <UnifiedIntelligenceProvider>
                      <RealtimeProbe />
                      <AISummaryCard type="pulse" />
                    </UnifiedIntelligenceProvider>
                  </AuthProvider>
                </I18nProvider>
              </AccessibilityProvider>
            </TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Dinleyiciler social_keywords, social_posts, alert_events ve live_data_cache için kuruldu
      const subscribedTables = new Set(registeredListeners.map((l) => l.table));
      expect(subscribedTables.has("social_keywords")).toBe(true);
      expect(subscribedTables.has("social_posts")).toBe(true);
      expect(subscribedTables.has("alert_events")).toBe(true);
      expect(subscribedTables.has("live_data_cache")).toBe(true);

      // İlk açılış sorguları tamamlansın
      await waitFor(() => {
        expect(qc.isFetching()).toBe(0);
      });
      const callsBeforePush = fetchSpy.mock.calls.length;

      // 2a. Arka plan işçisi yeni bir social_keywords kaydı eklediğinde LivingLexicon anında güncellenir
      const kwListener = registeredListeners.find((l) => l.table === "social_keywords");
      expect(kwListener).toBeTruthy();

      act(() => {
        kwListener!.callback({
          eventType: "INSERT",
          new: {
            keyword: "Mumcular Terfi Merkezi",
            category: "altyapi",
            region: "Bodrum",
            is_active: true,
          },
        });
      });

      expect(screen.getByTestId("lexicon-terms").textContent).toContain("Mumcular Terfi Merkezi");

      // 2b. Arka plan işçisi live_data_cache'e topic_grounding:environment_dams yazdığında
      // Şehir Nabzı sayfa yenilemeden ve yeni Gemini fetch çağrısı yapmadan %82 değerini yansıtır
      const cacheListener = registeredListeners.find(
        (l) => l.table === "live_data_cache" && !l.filter
      );
      expect(cacheListener).toBeTruthy();

      act(() => {
        cacheListener!.callback({
          eventType: "UPDATE",
          new: {
            data_type: "topic_grounding:environment_dams",
            data: {
              topic: "environment_dams",
              fetchedAt: "2026-11-23T08:00:00Z",
              damUpdates: [
                {
                  damId: "mumcular",
                  damName: "Mumcular Barajı",
                  occupancyRate: 82,
                  sourceName: "Anter Haber",
                  sourceUrl: "https://anterhaber.com/mumcular-82",
                  measuredAt: "2026-11-23T08:00:00Z",
                  confidence: "high",
                },
              ],
            },
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/%82/)).toBeTruthy();
        expect(screen.getByText(/Anter Haber/)).toBeTruthy();
      });
      expect(syncEvents).toContain("social_keywords");
      expect(syncEvents).toContain("live_data_cache");
      // Realtime güncellemesi sırasında ek HTTP/Gemini isteği yapılmadı
      expect(fetchSpy.mock.calls.length).toBe(callsBeforePush);
    } finally {
      window.removeEventListener(REALTIME_SYNC_EVENT, onSync);
      fetchSpy.mockRestore();
    }
  });

  it("3. 7/24 İşçi Betiği: 4 bölgesel grup 13 ilçeyi ve 7 topic-grounding sorgusunun tamamını kotayı aşmadan kapsar; CI workflow’ları korunur", () => {
    // Tüm 7 topic-grounding sorgusu 4 bölgesel grup içinde eksiksiz kapsanır
    const coveredTopics = new Set(
      DISTRICT_GROUPS.flatMap((g: { id: string }) => selectTopicsForGroup(g))
    );
    for (const key of Object.keys(SECTOR_TOPIC_QUERIES)) {
      expect(coveredTopics.has(key)).toBe(true);
    }
    expect(Object.keys(GROUP_TOPIC_ASSIGNMENTS)).toEqual(["A", "B", "C", "D"]);

    // Aylık kota %15'in altında (120/1500 = %8)
    const quota = calculateMonthlyQuotaUsage();
    expect(quota.monthlyCalls).toBe(120);
    expect(quota.withinBudget).toBe(true);

    // Grup B prompt'u enerji ve turizm topic-grounding sorgularını içerir
    const promptB = buildGroundingPrompt(DISTRICT_GROUPS[1]);
    expect(promptB).toContain("energy_outages");
    expect(promptB).toContain("tourism_occupancy");
    expect(promptB).toContain("ADM Elektrik");

    // Doğrulanmış topic-grounding çıktıları live_data_cache satırlarına dönüşür
    const findings = normalizeAgentFindings(
      {
        posts: [],
        new_keywords: [],
        alerts: [],
        energy_outages: [
          {
            district: "Marmaris",
            neighborhoods: "Armutalan",
            type: "planli",
            status: "planli",
            summary: "ADM Elektrik bakım çalışması",
            source_name: "ADM Elektrik",
            source_url: "https://admelektrik.com.tr/kesinti-marmaris",
            published_date: "2026-11-23",
          },
        ],
        tourism_metrics: {
          hotel_occupancy_pct: 64,
          annual_tourists: "4.2M",
          source_name: "GETOB",
          source_url: "https://getob.org.tr/doluluk-2026",
          published_date: "2026-11-23",
        },
      },
      DISTRICT_GROUPS[1],
      []
    );

    const payloads = buildSupabasePayloads({
      findings,
      group: DISTRICT_GROUPS[1],
      now: new Date("2026-11-23T06:00:00Z"),
    });

    const cacheTypes = payloads.cacheRows.map((r: { data_type: string }) => r.data_type);
    expect(cacheTypes).toContain("topic_grounding:energy_outages");
    expect(cacheTypes).toContain("topic_grounding:tourism_occupancy");

    // Production release ve güvenlik kontrolleri için CI workflow’ları repository’de bulunur.
    const workflowsDir = path.resolve(process.cwd(), ".github/workflows");
    expect(fs.existsSync(workflowsDir)).toBe(true);
  });
});
