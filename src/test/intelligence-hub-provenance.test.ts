import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Supabase istemcisini boş veri dönecek şekilde taklit et:
// - auth.getSession() -> oturum yok (edge function çağrısı yok)
// - from() -> her sorgu { data: null, error: null } ile çözülür
vi.mock("@/integrations/supabase/client", () => {
  const makeChain = () => {
    const chain: Record<string, any> = {};
    for (const m of [
      "select", "eq", "neq", "gte", "gt", "lt", "lte", "or", "in",
      "is", "order", "limit", "range", "upsert", "insert", "update",
    ]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.maybeSingle = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject);
    return chain;
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(() => makeChain()),
      channel: vi.fn(() => {
        const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch) };
        return ch;
      }),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
    isSupabaseClientConfigured: false,
  };
});

const VALID_PROVENANCE = ["live", "cache", "reference", "unavailable"] as const;

describe("Intelligence Hub — Truthful Data Provenance Guardrail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("her türetilmiş çıktı geçerli bir provenance alanı döndürür (canlı veri yokken)", async () => {
    const { intelligenceHub } = await import("@/lib/intelligence-hub");

    const social = await intelligenceHub.setRealtimeSocialTracking(false);
    expect(VALID_PROVENANCE).toContain(social.provenance);
    expect(social.provenance).toBe("unavailable");
    expect(social.recentPostCount).toBe(0);
    expect(social.sentimentDistribution).toEqual({ positive: 0, neutral: 0, negative: 0 });
    expect(social.activeKeywords).toEqual([]);

    const fire = await intelligenceHub.automateFirePreventionProtocol();
    expect(VALID_PROVENANCE).toContain(fire.provenance);
    expect(fire.provenance).toBe("unavailable");
    expect(fire.riskScore).toBeNull();
    expect(fire.riskLevel).toBeNull();
    expect(fire.isTriggered).toBe(false);
    expect(fire.actionsTaken).toEqual([]);

    const mobility = await intelligenceHub.getIntegratedMobilityIndex();
    expect(VALID_PROVENANCE).toContain(mobility.provenance);
    expect(mobility.provenance).toBe("unavailable");
    expect(mobility.corridors).toEqual([]);
    expect(mobility.averagePressure).toBeNull();

    const eco = await intelligenceHub.generateDailyEconomicSummary();
    expect(VALID_PROVENANCE).toContain(eco.provenance);
    expect(eco.provenance).toBe("unavailable");
    expect(eco.macroIndicators.every((m) => m.value === "—")).toBe(true);
    expect(eco.localIndicators.every((m) => m.value === "—")).toBe(true);
    expect(eco.sectorNotes).toEqual([]);
    expect(eco.recommendations).toEqual([]);

    const briefing = await intelligenceHub.generatePresidentialBriefing();
    expect(VALID_PROVENANCE).toContain(briefing.provenance);
    expect(briefing.provenance).toBe("unavailable");
    expect(briefing.weatherAndFire.temp).toBeNull();
    expect(briefing.weatherAndFire.fireRiskScore).toBeNull();
    expect(briefing.waterAndDams.avgOccupancy).toBeNull();
    expect(briefing.waterAndDams.damCount).toBe(0);
    expect(briefing.transportAndMobility.congestionAvg).toBeNull();
    expect(briefing.economyAndTourism.usdTry).toBe("—");
    expect(briefing.economyAndTourism.eurTry).toBe("—");

    const snap = await intelligenceHub.retrainModelBaselines();
    expect(VALID_PROVENANCE).toContain(snap.provenance);
    expect(snap.provenance).toBe("reference");
    expect(snap.sampleSize).toBe(0);
    expect(snap.version).toBe("policy-thresholds+p95");
    // Gözlem yokken uydurma ortalama/stdDev üretilmemeli
    for (const b of Object.values(snap.baselines)) {
      expect(b.mean).toBeNull();
      expect(b.stdDev).toBeNull();
      expect(typeof b.threshold).toBe("number");
    }
    // Üretilen uydurma "öğrenme yakınsama" alanı tamamen kaldırıldı
    expect((snap as unknown as Record<string, unknown>).convergenceRate).toBeUndefined();
  });

  it("kaynak kodda uydurma metrik değişmezleri (fabricated literals) bulunmaz", () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/intelligence-hub.ts"),
      "utf8"
    );

    const forbidden = [
      "convergenceRate",
      "EWMA-Dynamic",
      "hotelOcc ?? 38",
      "avgDam ?? 34",
      "postCount = 84",
      "temperature: 19",
      "humidity: 62",
      "Bodrum: 68",
      "Marmaris: 54",
      "$4.8 Milyar",
      "+0.15%",
      "+0.22%",
      "-0.8%",
      "342 adet/ay",
      "42.500 ₺",
      "95.000 ₺",
    ];

    for (const token of forbidden) {
      expect(src.includes(token)).toBe(false);
    }

    // Sahte "saha operasyonu" iddiaları kaldırılmalı
    expect(src.includes("AKOM")).toBe(false);
    expect(src.includes("İHA ve yangın gözetleme kuleleri")).toBe(false);
    // Risk eşiği koşulsuz tetiklenmemeli
    expect(src.includes("isTriggered: true")).toBe(false);
  });
});
