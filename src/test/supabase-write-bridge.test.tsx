import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  runAutonomousAgent,
  buildBridgeTablePayloads,
  VERIFIED_DISTRICTS_SEED,
  VERIFIED_PROTOCOL_MEMBERS_SEED,
  OFFICIAL_MUGLA_DAMS_SEED,
  MONITOR_TAB_KEYS,
} from "../../scripts/run-autonomous-agent.mjs";
import { persistTopicGroundingToSupabase } from "../../api/intel/_supabaseBridge";
import { useMonitorStore } from "@/store/useMonitorStore";
import {
  resetRealtimeSingleton,
  SINGLETON_REALTIME_CHANNEL_NAME,
} from "@/lib/supabase-realtime-singleton";
import { useSupabaseRealtimeSync } from "@/hooks/useSupabaseRealtimeSync";

const syncMockState = {
  tableHandlers: new Map<string, (payload: unknown) => void>(),
  channelCalls: [] as string[],
  selectTables: [] as string[],
  tableRows: {
    monitor_data: [
      {
        id: "ekonomi",
        tab_key: "ekonomi",
        title: "Ekonomi & Bütçe",
        metrics: { combinedTotalBillionTry: 44.8, budgetYear: 2026 },
        summary: "Toplam yerel yönetim bütçesi 44.8 Milyar ₺",
        source: "autonomous-intel-agent",
        updated_at: "2026-11-27T08:00:00.000Z",
      },
    ],
    districts: [
      { id: "mentese", name: "Menteşe", lat: 37.2153, lon: 28.3636, population: 121831 },
      { id: "bodrum", name: "Bodrum", lat: 37.0344, lon: 27.4305, population: 198335 },
    ],
    protocol_members: [
      {
        id: "proto-vali",
        isim: "Seddar YAVUZ",
        unvan: "Muğla Valisi",
        kategori: "Mülki İdare",
        telefon: "0252 214 10 01",
        faks: "",
        district: "Menteşe",
        updated_at: "2026-11-27T08:00:00.000Z",
      },
    ],
    protocol_changes: [
      {
        unvan: "Muğla Valisi",
        isim_new: "Seddar YAVUZ",
        scraped_at: "2026-11-27T08:00:00.000Z",
      },
    ],
    ai_summaries: [
      {
        type: "daily",
        date: "2026-11-27",
        summary: "Muğla günlük özet raporu başarıyla oluşturuldu.",
        generated_at: "2026-11-27T08:00:00.000Z",
      },
    ],
    live_data_cache: [] as Array<Record<string, unknown>>,
  } as Record<string, Array<Record<string, unknown>>>,
};

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseClientConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => {
        syncMockState.selectTables.push(table);
        return chain;
      });
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(async () => ({
        data: syncMockState.tableRows[table] ?? [],
        error: null,
      }));
      return chain;
    }),
    removeAllChannels: vi.fn(async () => []),
    channel: vi.fn((name: string) => {
      syncMockState.channelCalls.push(name);
      const ch: Record<string, unknown> = { name, state: "closed" };
      ch.on = vi.fn((type: string, filter: { table?: string }, cb: (payload: unknown) => void) => {
        if (type === "postgres_changes" && filter?.table) {
          syncMockState.tableHandlers.set(filter.table, cb);
        }
        return ch;
      });
      ch.subscribe = vi.fn((cb?: (status: string) => void) => {
        ch.state = "joined";
        cb?.("SUBSCRIBED");
        return ch;
      });
      return ch;
    }),
    removeChannel: vi.fn(async () => "ok"),
  },
}));

const HydrationHarness: React.FC = () => {
  useSupabaseRealtimeSync(true);
  return <div data-testid="hydration-ok">ok</div>;
};

describe("7-Tablolu Supabase Yazım Köprüsü ve Canlı Senkronizasyon", () => {
  beforeEach(() => {
    resetRealtimeSingleton();
    useMonitorStore.getState().resetStore();
    syncMockState.tableHandlers.clear();
    syncMockState.channelCalls = [];
    syncMockState.selectTables = [];
  });

  afterEach(() => {
    resetRealtimeSingleton();
    useMonitorStore.getState().resetStore();
  });

  it("1. runAutonomousAgent SUPABASE_SERVICE_ROLE_KEY ile 7 çekirdek tablonun tamamına gerçek upsert/insert yazar", async () => {
    const writesByTable = new Map<string, Array<{ url: string; body: unknown; auth: string }>>();
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      const headers = (init?.headers ?? {}) as Record<string, string>;

      if (url.includes("generativelanguage.googleapis.com")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        posts: [
                          {
                            title: "Muğla Büyükşehir ve MUSKİ 2026 bütçesi 44.8 Milyar TL",
                            summary: "Meclis onaylı 2026 konsolide bütçe toplamı 44.8 Milyar TL oldu.",
                            district: "Menteşe",
                            category: "ekonomi",
                            sentiment: "positive",
                            severity: "medium",
                            source_name: "Muğla Büyükşehir",
                            source_url: "https://mugla.bel.tr/butce-2026",
                            keywords: ["Muğla bütçe"],
                          },
                        ],
                        new_keywords: [
                          { keyword: "2026 konsolide bütçe", category: "ekonomi", district: "Menteşe" },
                        ],
                        alerts: [],
                        dam_updates: [
                          {
                            dam_name: "Geyik Barajı",
                            occupancy_rate: 62.5,
                            source_name: "MUSKİ",
                            source_url: "https://mugla.bel.tr/baraj-2026",
                            published_date: "2026-11-26",
                            confidence: "high",
                          },
                        ],
                      }),
                    },
                  ],
                },
                groundingMetadata: {
                  groundingChunks: [
                    { web: { uri: "https://mugla.bel.tr/butce-2026", title: "Muğla Büyükşehir" } },
                  ],
                },
              },
            ],
          }),
        } as unknown as Response;
      }

      if (method === "GET" && url.includes("/rest/v1/social_posts")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "sp-1",
              platform: "news",
              author: "ADM Elektrik",
              content: "Bodrum ilçesinde ADM Elektrik planlı elektrik kesintisi ve trafo bakımı bildirildi.",
              sentiment: "negative",
              district: "Bodrum",
              category: "enerji",
              url: "https://example.org/adm-bodrum-kesinti",
              published_at: "2026-11-27T06:00:00Z",
            },
            {
              id: "sp-2",
              platform: "news",
              author: "AFAD",
              content: "Marmaris açıklarında 4.2 büyüklüğünde deprem kaydedildi, olumsuzluk yok.",
              sentiment: "neutral",
              district: "Marmaris",
              category: "guvenlik",
              url: "https://example.org/afad-marmaris",
              published_at: "2026-11-27T07:00:00Z",
            },
          ],
        } as unknown as Response;
      }

      if (method === "GET") {
        return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      }

      const match = url.match(/\/rest\/v1\/([^?]+)/);
      const table = match ? decodeURIComponent(match[1]) : "unknown";
      const parsedBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const list = writesByTable.get(table) ?? [];
      list.push({ url, body: parsedBody, auth: headers.Authorization || "" });
      writesByTable.set(table, list);

      return {
        ok: true,
        status: 201,
        json: async () => [],
        text: async () => "",
      } as unknown as Response;
    });

    const result = await runAutonomousAgent({
      now: new Date("2026-11-27T08:00:00Z"),
      groupOverride: "A",
      env: {
        GEMINI_API_KEY: "test-gemini-key",
        SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-xyz",
      },
      fetchImpl: mockFetch,
      retryDelayMs: 0,
    });

    expect(result.status).toBe("ok");
    expect(result.errors).toHaveLength(0);

    // 7 çekirdek tablonun tamamına yazım yapılmış olmalıdır
    const requiredTables = [
      "monitor_data",
      "districts",
      "protocol_members",
      "protocol_changes",
      "alert_events",
      "ai_summaries",
      "live_data_cache",
    ];
    for (const table of requiredTables) {
      expect(writesByTable.has(table)).toBe(true);
      const firstWrite = writesByTable.get(table)![0];
      expect(firstWrite.auth).toBe("Bearer service-role-secret-xyz");
    }

    // Satır sayısı doğrulamaları
    expect(result.inserted.monitor_data).toBe(11);
    expect(result.inserted.districts).toBe(13);
    expect(result.inserted.protocol_members).toBe(VERIFIED_PROTOCOL_MEMBERS_SEED.length);
    expect(result.inserted.protocol_changes).toBeGreaterThanOrEqual(1);
    expect(result.inserted.alert_events).toBeGreaterThanOrEqual(2); // ADM kesinti + AFAD 4.2 deprem
    expect(result.inserted.ai_summaries).toBe(2); // daily + pulse
    expect(result.inserted.live_data_cache).toBeGreaterThanOrEqual(6);

    // districts payload'ında generated ALWAYS `geom` kolonu olmamalı
    const districtsPayload = writesByTable.get("districts")![0].body as Array<Record<string, unknown>>;
    expect(districtsPayload).toHaveLength(13);
    expect(districtsPayload.every((d) => !("geom" in d))).toBe(true);

    // protocol_members içinde Muğla Valisi Seddar YAVUZ bulunmalı
    const protoPayload = writesByTable.get("protocol_members")![0].body as Array<Record<string, unknown>>;
    expect(protoPayload.some((m) => m.unvan === "Muğla Valisi" && m.isim === "Seddar YAVUZ")).toBe(true);

    // live_data_cache dams kaydı 8 doğrulanmış Muğla barajını içermeli
    const damsCacheWrite = writesByTable
      .get("live_data_cache")!
      .find((w) => (w.body as Record<string, unknown>)?.data_type === "dams");
    expect(damsCacheWrite).toBeDefined();
    expect(OFFICIAL_MUGLA_DAMS_SEED).toHaveLength(8);
    expect(MONITOR_TAB_KEYS).toHaveLength(11);
  });

  it("2. GEMINI_API_KEY eksik olsa bile mevcut social_posts ve idempotent seed ile 7 tabloyu doldurur", async () => {
    const writtenTables = new Set<string>();
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "GET") {
        return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      }
      const match = url.match(/\/rest\/v1\/([^?]+)/);
      if (match) writtenTables.add(decodeURIComponent(match[1]));
      return { ok: true, status: 201, json: async () => [], text: async () => "" } as unknown as Response;
    });

    const result = await runAutonomousAgent({
      now: new Date("2026-11-27T08:00:00Z"),
      env: {
        SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
      fetchImpl: mockFetch,
      retryDelayMs: 0,
    });

    expect(result.status).toBe("ok");
    expect(writtenTables.has("monitor_data")).toBe(true);
    expect(writtenTables.has("districts")).toBe(true);
    expect(writtenTables.has("protocol_members")).toBe(true);
    expect(writtenTables.has("protocol_changes")).toBe(true);
    expect(writtenTables.has("ai_summaries")).toBe(true);
    expect(writtenTables.has("live_data_cache")).toBe(true);
    expect(result.inserted.districts).toBe(VERIFIED_DISTRICTS_SEED.length);
  });

  it("3. Supabase yazım hatalarını asla sessizce yutmaz, tablo adıyla raporlar ve CLI çıkış kodunu non-zero yapar", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "GET") {
        return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      }
      if (url.includes("/rest/v1/monitor_data")) {
        return {
          ok: false,
          status: 403,
          text: async () => JSON.stringify({ message: "new row violates row-level security policy" }),
        } as unknown as Response;
      }
      return { ok: true, status: 201, json: async () => [], text: async () => "" } as unknown as Response;
    });

    try {
      const result = await runAutonomousAgent({
        now: new Date("2026-11-27T08:00:00Z"),
        env: {
          SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        },
        fetchImpl: mockFetch,
        retryDelayMs: 0,
      });

      expect(result.status).toBe("partial_ok");
      const monitorErr = result.errors.find(
        (e: { table?: string; status?: number }) => e.table === "monitor_data"
      );
      expect(monitorErr).toBeDefined();
      expect(monitorErr.status).toBe(403);
      expect(errSpy).toHaveBeenCalled();

      // CLI katmanında result.errors.length > 0 durumunda process.exitCode = 1 ayarlandığını doğrula
      const scriptSrc = readFileSync(
        resolve(process.cwd(), "scripts/run-autonomous-agent.mjs"),
        "utf-8"
      );
      expect(scriptSrc).toContain("process.exitCode = 1");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("4. api/intel/_supabaseBridge.ts doğrulanan konu çıktısını live_data_cache, monitor_data ve protocol_changes tablolarına yazar", async () => {
    const postedTables: string[] = [];
    const mockFetch = vi.fn(async (url: string) => {
      const match = url.match(/\/rest\/v1\/([^?]+)/);
      if (match) postedTables.push(decodeURIComponent(match[1]));
      return { ok: true, status: 201, text: async () => "" } as unknown as Response;
    });

    const bridgeRes = await persistTopicGroundingToSupabase(
      "protocol_activity",
      {
        ok: true,
        fetchedAt: "2026-11-27T09:00:00.000Z",
        protocolActivities: [
          {
            id: "pa-1",
            actorName: "Seddar YAVUZ",
            actorTitle: "Muğla Valisi",
            category: "gorev_degisikligi",
            summary: "Resmi Gazete atama kararnamesi yayımlandı.",
            sourceName: "Resmi Gazete",
            sourceUrl: "https://resmigazete.gov.tr",
            publishedAt: "2026-11-27T09:00:00.000Z",
          },
        ],
      },
      {
        env: {
          SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "srv-key",
        },
        fetchImpl: mockFetch,
      }
    );

    expect(bridgeRes.skipped).toBe(false);
    expect(bridgeRes.errors).toHaveLength(0);
    expect(postedTables).toEqual(["live_data_cache", "monitor_data", "protocol_changes"]);
  });

  it("5. useSupabaseRealtimeSync başlangıçta Supabase tablolarından useMonitorStore'u besler ve tekil mugla-monitor-sync kanalıyla canlı günceller", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <HydrationHarness />
      </QueryClientProvider>
    );

    // Tekil kanal doğrulaması
    expect(syncMockState.channelCalls).toEqual([SINGLETON_REALTIME_CHANNEL_NAME]);

    // Başlangıç hydration doğrulaması
    await waitFor(() => {
      const state = useMonitorStore.getState();
      expect(state.monitorTabs.ekonomi?.metrics?.combinedTotalBillionTry).toBe(44.8);
      expect(state.districtsRegistry).toHaveLength(2);
      expect(state.protocolMembers[0]?.isim).toBe("Seddar YAVUZ");
      expect(state.aiSummaries.daily?.summary).toContain("günlük özet");
    });

    // Canlı Realtime monitor_data güncellemesi
    act(() => {
      syncMockState.tableHandlers.get("monitor_data")?.({
        eventType: "UPDATE",
        new: {
          id: "turizm",
          tab_key: "turizm",
          title: "Turizm & Konaklama",
          metrics: { hotelOccupancyPct: 84.2 },
          summary: "Doluluk %84.2 seviyesine ulaştı.",
          updated_at: "2026-11-27T10:00:00.000Z",
        },
      });
    });

    expect(useMonitorStore.getState().monitorTabs.turizm?.metrics?.hotelOccupancyPct).toBe(84.2);

    // Payload builder smoke check (11 sekme + 13 ilçe)
    const dryPayload = buildBridgeTablePayloads({
      findings: { protocolActivities: [], damUpdates: [], alerts: [] },
      group: { id: "A", districts: ["Bodrum", "Milas", "Menteşe"] },
      recentSocialPosts: [],
      now: new Date("2026-11-27T08:00:00Z"),
    });
    expect(dryPayload.monitorDataRows).toHaveLength(11);
    expect(dryPayload.districtsRows).toHaveLength(13);
  });
});
