import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockSupabaseState = vi.hoisted(() => ({
  alertRows: [] as Array<Record<string, unknown>>,
  tableRows: {} as Record<string, Array<Record<string, unknown>>>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeQueryBuilder = (table: string) => {
    const resolveRows = () => {
      if (table === "alert_events") return mockSupabaseState.alertRows;
      return mockSupabaseState.tableRows[table] ?? [];
    };
    const builder = {
      select: () => builder,
      neq: () => builder,
      order: () => builder,
      eq: () => builder,
      limit: () => Promise.resolve({ data: resolveRows(), error: null }),
      maybeSingle: () => Promise.resolve({ data: resolveRows()[0] ?? null, error: null }),
    };
    return builder;
  };

  return {
    isSupabaseClientConfigured: true,
    supabase: {
      from: (table: string) => makeQueryBuilder(table),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
  };
});

vi.mock("@/lib/supabase-realtime-singleton", () => ({
  subscribeToRealtimeTable: vi.fn(() => () => {}),
  subscribeToRealtimeBroadcast: vi.fn(() => () => {}),
  subscribeToRealtimeStatus: vi.fn((cb: (connected: boolean) => void) => {
    cb(true);
    return () => {};
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    canGenerateAI: false,
    canManageData: false,
    user: null,
  }),
}));

vi.mock("@/hooks/useAISummary", () => ({
  useAISummary: () => ({
    data: {
      summary: "Muğla geneli canlı özet doğrulandı.",
      generated_at: new Date().toISOString(),
      sourceLabel: "Canlı Şehir Nabzı",
      isStale: false,
    },
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

import {
  RealtimeAlertBanner,
  AlertCard,
  resolveAlertTypeConfig,
} from "@/components/RealtimeAlertBanner";
import {
  normalizeAlertType,
  normalizeAlertSeverity,
  type RealtimeAlert,
} from "@/hooks/useRealtimeAlerts";
import { AISummaryCard } from "@/components/AISummaryCard";
import { DataSourceBadge, type DataSourceType } from "@/components/DataSourceBadge";
import { cacheManager } from "@/lib/cache-manager";
import { useSupabaseRealtimeSync } from "@/hooks/useSupabaseRealtimeSync";
import { useMonitorStore } from "@/store/useMonitorStore";
import { I18nProvider } from "@/hooks/useTranslation";

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>
  );
}

describe("Runtime icon & Supabase schema resilience", () => {
  beforeEach(() => {
    localStorage.clear();
    mockSupabaseState.alertRows = [];
    mockSupabaseState.tableRows = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes Turkish, uppercase, unknown, and null alert types/severities without throwing", () => {
    expect(normalizeAlertType("enerji")).toBe("energy");
    expect(normalizeAlertType("DEPREM")).toBe("earthquake");
    expect(normalizeAlertType("güvenlik")).toBe("security");
    expect(normalizeAlertType("BILINMEYEN_TUR")).toBe("system");
    expect(normalizeAlertType(undefined)).toBe("system");
    expect(normalizeAlertType(null)).toBe("system");

    expect(normalizeAlertSeverity("HIGH")).toBe("high");
    expect(normalizeAlertSeverity("CRITICAL")).toBe("critical");
    expect(normalizeAlertSeverity("kritik")).toBe("critical");
    expect(normalizeAlertSeverity("yuksek")).toBe("high");
    expect(normalizeAlertSeverity("orta")).toBe("medium");
    expect(normalizeAlertSeverity("LOW")).toBe("info");
    expect(normalizeAlertSeverity("UNKNOWN_LEVEL")).toBe("high");

    const unknownCfg = resolveAlertTypeConfig("BILINMEYEN_KATEGORI");
    expect(unknownCfg).toBeDefined();
    expect(unknownCfg.icon).toBeDefined();
  });

  it("renders RealtimeAlertBanner safely with live Supabase alert_events rows having unknown/Turkish/uppercase types and corrupt localStorage", async () => {
    // Bozuk localStorage kaydı uygulamanın açılışını bozmamalı
    localStorage.setItem("rta_dismissed", "{corrupt-json");

    mockSupabaseState.alertRows = [
      {
        id: 101,
        type: "enerji",
        severity: "HIGH",
        title: "ADM Elektrik Planlı Kesinti — Menteşe",
        body: "09:00–13:00 arası bakım çalışması.",
        source: "otonom-ajan",
        created_at: new Date().toISOString(),
      },
      {
        id: 102,
        type: "BILINMEYEN_TUR",
        severity: "CRITICAL",
        title: "Bilinmeyen Türde Acil Bildirim",
        body: "Sözlükte olmayan tip ile güvenli fallback testi.",
        source: "Supabase Canlı",
        created_at: "gecersiz-tarih",
      },
      {
        id: 103,
        type: null,
        category: "deprem",
        severity: "yuksek",
        title: "Ege Denizi 3.8 Sarsıntı",
        body: "Derinlik 7.2 km",
        source: "AFAD",
        created_at: new Date().toISOString(),
      },
      {
        id: 104,
        type: "guvenlik",
        severity: "CRITICAL",
        title: "Sahil Güvenlik Denetimi",
        body: "Bodrum açıklarında yoğun kontrol.",
        source: "Sahil Güvenlik",
        created_at: new Date().toISOString(),
      },
    ];

    renderWithProviders(<RealtimeAlertBanner />);

    await waitFor(() => {
      expect(screen.getByText("ADM Elektrik Planlı Kesinti — Menteşe")).toBeInTheDocument();
      expect(screen.getByText("Bilinmeyen Türde Acil Bildirim")).toBeInTheDocument();
      expect(screen.getByText("Ege Denizi 3.8 Sarsıntı")).toBeInTheDocument();
      expect(screen.getByText("Sahil Güvenlik Denetimi")).toBeInTheDocument();
    });
  });

  it("renders AlertCard directly even when passed unnormalized runtime payload", () => {
    const weirdAlert = {
      id: "weird-1",
      type: "COK_YENI_BIR_TIP",
      severity: "KRITIK",
      title: "Beklenmedik Uyarı Şekli",
      body: "Çökmeden render edilmeli.",
      source: "Test",
      timestamp: "invalid-date",
    } as unknown as RealtimeAlert;

    renderWithProviders(<AlertCard alert={weirdAlert} onDismiss={vi.fn()} />);

    expect(screen.getByText("Beklenmedik Uyarı Şekli")).toBeInTheDocument();
    expect(screen.getByText("KRİTİK")).toBeInTheDocument();
  });

  it("renders AISummaryCard and DataSourceBadge safely with unknown or uppercase type values", () => {
    renderWithProviders(
      <div>
        <AISummaryCard type={"UNKNOWN_SUMMARY" as never} />
        <DataSourceBadge type={"LIVE" as unknown as DataSourceType} />
        <DataSourceBadge type={"UNKNOWN_SOURCE" as unknown as DataSourceType} />
      </div>
    );

    expect(screen.getByText("Muğla geneli canlı özet doğrulandı.")).toBeInTheDocument();
    expect(screen.getByText("CANLI")).toBeInTheDocument();
    expect(screen.getByText("ÖNBELLEK")).toBeInTheDocument();
  });

  it("handles corrupted localStorage values in cacheManager without throwing", () => {
    localStorage.setItem("mugla_monitor_v1_corrupt_json", "{invalid");
    localStorage.setItem("mugla_monitor_v1_null_entry", "null");
    localStorage.setItem("mugla_monitor_v1_number_entry", "42");
    localStorage.setItem("mugla_monitor_v1_missing_fields", JSON.stringify({ foo: "bar" }));

    expect(cacheManager.get("corrupt_json")).toBeNull();
    expect(cacheManager.get("null_entry")).toBeNull();
    expect(cacheManager.get("number_entry")).toBeNull();
    expect(cacheManager.get("missing_fields")).toBeNull();
    expect(cacheManager.getMeta("null_entry")).toBeNull();
    expect(() => cacheManager.stats()).not.toThrow();
  });

  it("hydrates useSupabaseRealtimeSync safely with malformed monitor_data, districts, protocol_members, and live_data_cache rows", async () => {
    mockSupabaseState.tableRows = {
      monitor_data: [
        {
          source: "otonom-ajan",
          district_name: "Menteşe",
          content: JSON.stringify({ tabKey: "ekonomi", metrics: { dolar: 38.5 }, summary: "Ekonomi güncel" }),
          sentiment: "neutral",
          category: "ekonomi",
          created_at: new Date().toISOString(),
        },
        {
          source: "otonom-ajan",
          district_name: "Bodrum",
          content: "{bozuk-json-duz-metin",
          sentiment: "UNKNOWN",
          category: "BILINMEYEN_KAT",
          created_at: new Date().toISOString(),
        },
      ],
      districts: [
        { id: 1, name: "Menteşe", lat: 37.2153, lng: 28.3636 },
        { id: null, name: null, lat: "NaN", lng: undefined },
      ],
      protocol_members: [
        { id: "p1", isim: "Seddar Yavuz", unvan: "Muğla Valisi", kategori: "Valilik", updated_at: new Date().toISOString() },
        { id: null, isim: undefined, unvan: null },
      ],
      protocol_changes: [
        { unvan: "Muğla Valisi", isim_new: "Seddar Yavuz", scraped_at: new Date().toISOString() },
        { unvan: null, isim_new: null },
      ],
      ai_summaries: [
        { type: "UNKNOWN_AI_TYPE", date: "2026-11-27", summary: "Özet metni", generated_at: new Date().toISOString() },
      ],
      live_data_cache: [
        { data_type: "topic_grounding:environment_dams", data: "not-an-object", fetched_at: new Date().toISOString() },
        { data_type: "unknown_cache_key", data: { ok: true }, fetched_at: new Date().toISOString() },
      ],
    };

    function Harness() {
      useSupabaseRealtimeSync(true);
      return <div data-testid="sync-ok">ok</div>;
    }

    renderWithProviders(<Harness />);

    await waitFor(() => {
      const state = useMonitorStore.getState();
      expect(state.districtsRegistry.some((d) => d.name === "Menteşe")).toBe(true);
      expect(state.protocolMembers.some((m) => m.isim === "Seddar Yavuz")).toBe(true);
    });

    expect(screen.getByTestId("sync-ok")).toHaveTextContent("ok");
  });
});
