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
import { useMonitorStore, parseMonitorDataRow } from "@/store/useMonitorStore";
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
        source: "otonom-ajan",
        district_name: "Menteşe",
        category: "ekonomi",
        sentiment: "neutral",
        content: JSON.stringify({
          tabKey: "ekonomi",
          title: "Ekonomi & Bütçe",
          metrics: { combinedTotalBillionTry: 44.8, budgetYear: 2026 },
          summary: "Toplam yerel yönetim bütçesi 44.8 Milyar ₺",
          updatedAt: "2026-11-27T08:00:00.000Z",
        }),
        created_at: "2026-11-27T08:00:00.000Z",
      },
      {
        source: "karayollari-bulteni",
        district_name: "Marmaris",
        category: "ulasim",
        sentiment: "neutral",
        content: "Marmaris-Datça yolunda bakım çalışmaları nedeniyle trafik kontrollü akıyor.",
        created_at: "2026-11-27T07:45:00.000Z",
      },
    ],
    districts: [
      { id: 1, name: "Menteşe", lat: 37.2153, lng: 28.3636 },
      { id: 2, name: "Bodrum", lat: 37.0344, lng: 27.4305 },
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

  it("1. runAutonomousAgent canlı Supabase şemasıyla (region, lng, 6 sütunlu monitor_data, 9 sütunlu alert_events) 7 çekirdek tabloya yazar", async () => {
    const writesByTable = new Map<string, Array<{ url: string; body: unknown; auth: string }>>();
    const writeOrder: string[] = [];
    const socialPostsSelectUrls: string[] = [];

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
        socialPostsSelectUrls.push(url);
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
              region: "Bodrum",
              keywords_matched: ["elektrik kesintisi", "ADM Elektrik"],
              raw_metadata: { district: "Bodrum", category: "enerji" },
              url: "https://example.org/adm-bodrum-kesinti",
              published_at: "2026-11-27T06:00:00Z",
              collected_at: "2026-11-27T06:05:00Z",
            },
            {
              id: "sp-2",
              platform: "news",
              author: "AFAD",
              content: "Marmaris açıklarında 4.2 büyüklüğünde deprem kaydedildi, olumsuzluk yok.",
              sentiment: "neutral",
              region: "Marmaris",
              keywords_matched: ["deprem", "AFAD"],
              raw_metadata: { district: "Marmaris", category: "guvenlik" },
              url: "https://example.org/afad-marmaris",
              published_at: "2026-11-27T07:00:00Z",
              collected_at: "2026-11-27T07:05:00Z",
            },
          ],
        } as unknown as Response;
      }

      if (method === "GET" && url.includes("/rest/v1/districts")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { id: 48, name: "Menteşe" },
            { id: 49, name: "Bodrum" },
          ],
        } as unknown as Response;
      }

      if (method === "GET") {
        return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      }

      const match = url.match(/\/rest\/v1\/([^?]+)/);
      const table = match ? decodeURIComponent(match[1]) : "unknown";
      writeOrder.push(table);
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

    // social_posts sorgusu gerçek `region`, `keywords_matched`, `raw_metadata` sütunlarını kullanmalı
    expect(socialPostsSelectUrls.some((u) => u.includes("region") && u.includes("raw_metadata"))).toBe(
      true
    );
    expect(socialPostsSelectUrls.some((u) => u.includes(",district,"))).toBe(false);

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

    // districts: mevcut 2 ilçe kendi sayısal id'siyle (48, 49) güncellenmeli;
    // kalan 11 ilçe id alanı gönderilmeden yalnızca name/lat/lng ile eklenmeli (ASLA metin id yok)
    const districtWrites = writesByTable.get("districts")!;
    expect(districtWrites).toHaveLength(2);
    const updatedDistricts = districtWrites[0].body as Array<Record<string, unknown>>;
    const insertedDistricts = districtWrites[1].body as Array<Record<string, unknown>>;
    expect(updatedDistricts).toHaveLength(2);
    expect(updatedDistricts.map((d) => ({ id: d.id, name: d.name }))).toEqual([
      { id: 48, name: "Menteşe" },
      { id: 49, name: "Bodrum" },
    ]);
    for (const row of updatedDistricts) {
      expect(typeof row.id).toBe("number");
      expect(Number.isInteger(row.id)).toBe(true);
      expect(Object.keys(row).sort()).toEqual(["id", "lat", "lng", "name"]);
    }
    expect(insertedDistricts).toHaveLength(11);
    for (const row of insertedDistricts) {
      expect("id" in row).toBe(false);
      expect(Object.keys(row).sort()).toEqual(["lat", "lng", "name"]);
    }

    // FK sırası: tüm districts yazımları monitor_data insert'inden ÖNCE tamamlanmış olmalı
    const lastDistrictWriteIdx = writeOrder.lastIndexOf("districts");
    const firstMonitorWriteIdx = writeOrder.indexOf("monitor_data");
    expect(lastDistrictWriteIdx).toBeGreaterThanOrEqual(0);
    expect(firstMonitorWriteIdx).toBeGreaterThan(lastDistrictWriteIdx);

    // monitor_data payload'ı YALNIZCA 6 gerçek sütun içermeli, varchar(20) ve FK (districts.name) sınırına uymalı
    const validDistrictSet = new Set(VERIFIED_DISTRICTS_SEED.map((d: { name: string }) => d.name));
    const monitorPayload = writesByTable.get("monitor_data")![0].body as Array<Record<string, unknown>>;
    expect(monitorPayload).toHaveLength(11);
    for (const row of monitorPayload) {
      expect(Object.keys(row).sort()).toEqual([
        "category",
        "content",
        "created_at",
        "district_name",
        "sentiment",
        "source",
      ]);
      expect(row.source).toBe("otonom-ajan");
      expect(String(row.source).length).toBeLessThanOrEqual(20);
      expect(String(row.district_name).length).toBeLessThanOrEqual(20);
      expect(String(row.sentiment).length).toBeLessThanOrEqual(20);
      expect(String(row.category).length).toBeLessThanOrEqual(20);
      // monitor_data_district_name_fkey: ASLA "Muğla" veya "Muğla Geneli" gönderilmemeli
      expect(row.district_name).not.toBe("Muğla");
      expect(row.district_name).not.toBe("Muğla Geneli");
      expect(validDistrictSet.has(String(row.district_name))).toBe(true);
      expect(typeof row.content).toBe("string");
      const parsed = JSON.parse(row.content as string);
      expect(parsed.tabKey).toBe(row.category);
    }
    // İl geneli özet sekmeleri (ör. genel, ekonomi) "Menteşe" ile eşleşmeli
    const genelRow = monitorPayload.find((r) => r.category === "genel");
    expect(genelRow?.district_name).toBe("Menteşe");

    // alert_events payload'ı birebir 9 canlı sütun içermeli
    const alertPayload = writesByTable.get("alert_events")![0].body as Array<Record<string, unknown>>;
    expect(alertPayload.length).toBeGreaterThanOrEqual(2);
    for (const row of alertPayload) {
      expect(Object.keys(row).sort()).toEqual([
        "body",
        "created_at",
        "lat",
        "lon",
        "metadata",
        "severity",
        "source",
        "title",
        "type",
      ]);
    }

    // social_posts yazımı da `region` + `raw_metadata` kullanmalı (district yok)
    const socialPostWrite = writesByTable.get("social_posts")?.[0]?.body as Array<
      Record<string, unknown>
    >;
    expect(socialPostWrite?.length).toBeGreaterThanOrEqual(1);
    expect(socialPostWrite[0].region).toBe("Menteşe");
    expect("district" in socialPostWrite[0]).toBe(false);

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
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
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

    try {
      const result = await runAutonomousAgent({
        now: new Date("2026-11-27T08:00:00Z"),
        env: {
          SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        },
        fetchImpl: mockFetch,
        retryDelayMs: 0,
        skipOpenRssFallback: true,
      });

      expect(result.status).toBe("ok");
      expect(result.errors).toHaveLength(0);
      expect(result.quotaFallbackUsed).toBe(true);
      expect(writtenTables.has("monitor_data")).toBe(true);
      expect(writtenTables.has("districts")).toBe(true);
      expect(writtenTables.has("protocol_members")).toBe(true);
      expect(writtenTables.has("protocol_changes")).toBe(true);
      expect(writtenTables.has("ai_summaries")).toBe(true);
      expect(writtenTables.has("live_data_cache")).toBe(true);
      expect(result.inserted.districts).toBe(VERIFIED_DISTRICTS_SEED.length);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("3. Supabase yazım hatalarını asla sessizce yutmaz, tablo adıyla raporlar ve CLI çıkış kodunu non-zero yapar", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
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
        skipOpenRssFallback: true,
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
      warnSpy.mockRestore();
    }
  });

  it("4. api/intel/_supabaseBridge.ts doğrulanan konu çıktısını canlı monitor_data 6 sütunu ve FK uyumlu ilçe adıyla Supabase'e yazar", async () => {
    const writes: Array<{ table: string; body: unknown }> = [];
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "GET" && url.includes("/rest/v1/districts")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ name: "Menteşe" }, { name: "Bodrum" }, { name: "Marmaris" }],
        } as unknown as Response;
      }
      const match = url.match(/\/rest\/v1\/([^?]+)/);
      if (match) {
        writes.push({
          table: decodeURIComponent(match[1]),
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        });
      }
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
    expect(writes.map((w) => w.table)).toEqual(["live_data_cache", "monitor_data", "protocol_changes"]);

    const monitorBody = writes.find((w) => w.table === "monitor_data")?.body as Record<string, unknown>;
    expect(Object.keys(monitorBody).sort()).toEqual([
      "category",
      "content",
      "created_at",
      "district_name",
      "sentiment",
      "source",
    ]);
    expect("metrics" in monitorBody).toBe(false);
    expect(monitorBody.source).toBe("konu-dogrulama");
    expect(monitorBody.district_name).toBe("Menteşe");
    expect(String(monitorBody.source).length).toBeLessThanOrEqual(20);
    expect(String(monitorBody.district_name).length).toBeLessThanOrEqual(20);
    expect(String(monitorBody.sentiment).length).toBeLessThanOrEqual(20);
    expect(String(monitorBody.category).length).toBeLessThanOrEqual(20);
  });

  it("5. useSupabaseRealtimeSync monitor_data.content alanını hem JSON hem düz metin olarak güvenle okur ve districts.lng eşler", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <HydrationHarness />
      </QueryClientProvider>
    );

    // Tekil kanal doğrulaması
    expect(syncMockState.channelCalls).toEqual([SINGLETON_REALTIME_CHANNEL_NAME]);

    // Başlangıç hydration doğrulaması (JSON + düz metin monitor_data + lng districts)
    await waitFor(() => {
      const state = useMonitorStore.getState();
      expect(state.monitorTabs.ekonomi?.metrics?.combinedTotalBillionTry).toBe(44.8);
      expect(state.monitorTabs.ulasim?.summary).toContain("Marmaris-Datça yolunda bakım");
      expect(state.monitorTabs.ulasim?.districtName).toBe("Marmaris");
      expect(state.districtsRegistry).toHaveLength(2);
      expect(state.districtsRegistry[0]?.lng).toBe(28.3636);
      expect(state.protocolMembers[0]?.isim).toBe("Seddar YAVUZ");
      expect(state.aiSummaries.daily?.summary).toContain("günlük özet");
    });

    // Canlı Realtime monitor_data JSON güncellemesi
    act(() => {
      syncMockState.tableHandlers.get("monitor_data")?.({
        eventType: "INSERT",
        new: {
          source: "autonomous-intel-agent",
          district_name: "Bodrum",
          category: "turizm",
          sentiment: "positive",
          content: JSON.stringify({
            tabKey: "turizm",
            title: "Turizm & Konaklama",
            metrics: { hotelOccupancyPct: 84.2 },
            summary: "Doluluk %84.2 seviyesine ulaştı.",
            updatedAt: "2026-11-27T10:00:00.000Z",
          }),
          created_at: "2026-11-27T10:00:00.000Z",
        },
      });
    });

    expect(useMonitorStore.getState().monitorTabs.turizm?.metrics?.hotelOccupancyPct).toBe(84.2);

    // Canlı Realtime monitor_data düz metin güncellemesi (parse hatası vermeden özet olarak işlenmeli)
    act(() => {
      syncMockState.tableHandlers.get("monitor_data")?.({
        eventType: "INSERT",
        new: {
          source: "afad-akisi",
          district_name: "Fethiye",
          category: "guvenlik",
          sentiment: "neutral",
          content: "Fethiye açıklarında 3.4 büyüklüğünde sarsıntı hissedildi.",
          created_at: "2026-11-27T10:05:00.000Z",
        },
      });
    });

    expect(useMonitorStore.getState().monitorTabs.guvenlik?.summary).toContain("Fethiye açıklarında");

    // parseMonitorDataRow birim doğrulaması
    const plainParsed = parseMonitorDataRow({
      category: "enerji",
      district_name: "Milas",
      source: "adm",
      sentiment: "negative",
      content: "Milas merkezde planlı bakım.",
      created_at: "2026-11-27T11:00:00.000Z",
    });
    expect(plainParsed?.tabKey).toBe("enerji");
    expect(plainParsed?.summary).toBe("Milas merkezde planlı bakım.");
    expect(plainParsed?.metrics).toEqual({});

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

  it("6. Gemini 429 RESOURCE_EXHAUSTED kotasında exit code 1 ile kırılmaz, [UYARI] loglayıp ücretsiz RSS + social_posts ile tüm tabloları günceller", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const writtenTables = new Set<string>();
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel>
        <item>
          <title>Bodrum'da MUSKİ su kesintisi ve ana hat bakım çalışması - Muğla Gazetesi</title>
          <link>https://example.org/rss-bodrum-muski</link>
          <pubDate>Fri, 27 Nov 2026 07:30:00 GMT</pubDate>
          <source>Muğla Gazetesi</source>
        </item>
        <item>
          <title>Menteşe'de Muğla Büyükşehir 2026 yatırım bütçesi açıklandı - Kent TV</title>
          <link>https://example.org/rss-mentese-butce</link>
          <pubDate>Fri, 27 Nov 2026 07:45:00 GMT</pubDate>
          <source>Kent TV</source>
        </item>
      </channel></rss>`;

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();

      // Gemini 429 RESOURCE_EXHAUSTED simülasyonu
      if (url.includes("generativelanguage.googleapis.com")) {
        return {
          ok: false,
          status: 429,
          text: async () =>
            JSON.stringify({
              error: {
                code: 429,
                status: "RESOURCE_EXHAUSTED",
                message: "Quota exceeded for quota metric",
              },
            }),
        } as unknown as Response;
      }

      // Ücretsiz açık kaynak Google News RSS fallback
      if (url.includes("news.google.com/rss")) {
        return {
          ok: true,
          status: 200,
          text: async () => rssXml,
        } as unknown as Response;
      }

      if (method === "GET" && url.includes("/rest/v1/social_posts")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "sp-quota-1",
              platform: "news",
              author: "AFAD",
              content: "Datça açıklarında 4.1 büyüklüğünde deprem kaydedildi.",
              sentiment: "neutral",
              region: "Datça",
              keywords_matched: ["deprem"],
              raw_metadata: { district: "Datça" },
              url: "https://example.org/datca-deprem",
              published_at: "2026-11-27T07:00:00Z",
              collected_at: "2026-11-27T07:10:00Z",
            },
          ],
        } as unknown as Response;
      }

      if (method === "GET") {
        return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      }

      const match = url.match(/\/rest\/v1\/([^?]+)/);
      if (match) writtenTables.add(decodeURIComponent(match[1]));
      return { ok: true, status: 201, json: async () => [], text: async () => "" } as unknown as Response;
    });

    try {
      const result = await runAutonomousAgent({
        now: new Date("2026-11-27T08:00:00Z"),
        groupOverride: "A",
        env: {
          GEMINI_API_KEY: "quota-exhausted-key",
          SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        },
        fetchImpl: mockFetch,
        retryDelayMs: 0,
      });

      // 429 kotasında ajan çökmez (errors boş, exit code 0)
      expect(result.status).toBe("ok");
      expect(result.quotaFallbackUsed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(
        result.warnings.some((w: { step?: string }) =>
          String(w.step || "").includes("429 RESOURCE_EXHAUSTED")
        )
      ).toBe(true);
      expect(warnSpy).toHaveBeenCalled();

      // Ücretsiz RSS + social_posts üzerinden tüm kritik tablolar güncellenmiş olmalı
      expect(writtenTables.has("monitor_data")).toBe(true);
      expect(writtenTables.has("districts")).toBe(true);
      expect(writtenTables.has("protocol_members")).toBe(true);
      expect(writtenTables.has("protocol_changes")).toBe(true);
      expect(writtenTables.has("alert_events")).toBe(true);
      expect(writtenTables.has("ai_summaries")).toBe(true);
      expect(writtenTables.has("live_data_cache")).toBe(true);
      expect(result.inserted.monitor_data).toBe(11);
      expect(result.inserted.districts).toBe(13);
      expect(result.inserted.alert_events).toBeGreaterThanOrEqual(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("7. districts.id sequence yoksa null-id hatasında 1..13 sayısal id yedeğiyle yazar (asla metin id göndermez)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const districtPostBodies: Array<Array<Record<string, unknown>>> = [];
    let districtPostCount = 0;

    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "GET") {
        return { ok: true, status: 200, json: async () => [] } as unknown as Response;
      }
      if (url.includes("/rest/v1/districts")) {
        districtPostCount += 1;
        const parsed = JSON.parse(String(init?.body || "[]")) as Array<Record<string, unknown>>;
        districtPostBodies.push(parsed);
        if (districtPostCount === 1) {
          return {
            ok: false,
            status: 400,
            text: async () =>
              JSON.stringify({
                code: "23502",
                message: 'null value in column "id" of relation "districts" violates not-null constraint',
              }),
          } as unknown as Response;
        }
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
        skipOpenRssFallback: true,
      });

      expect(result.status).toBe("ok");
      expect(result.errors).toHaveLength(0);
      expect(result.inserted.districts).toBe(13);
      expect(districtPostBodies).toHaveLength(2);
      // İlk deneme id'siz, ikinci deneme 1..13 integer id'li olmalı
      expect(districtPostBodies[0].every((r) => !("id" in r))).toBe(true);
      expect(
        districtPostBodies[1].every(
          (r) => typeof r.id === "number" && Number.isInteger(r.id) && r.id >= 1 && r.id <= 13
        )
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
