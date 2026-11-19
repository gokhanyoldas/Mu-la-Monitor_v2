import { describe, it, expect, vi, afterEach } from "vitest";
import {
  checkSupabaseConfigured,
  getSupabaseClient,
  invokeSocialCollect,
  fetchDistrictIntel,
  syncIntelData,
} from "@/services/supabaseService";
import {
  buildTomTomLayerUrls,
  isTomTomConfigured,
  TOMTOM_MISSING_KEY_MESSAGE,
} from "@/services/tomtomMapService";

describe("Supabase Servis Katmanı (social-collect & ilçe istihbaratı)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Supabase anahtarları yoksa checkSupabaseConfigured false döner ve istemci çökmez", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    expect(checkSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it("invokeSocialCollect anahtar yokken yerel Muğla istihbaratına düşer", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    const res = await invokeSocialCollect("Bodrum", "Bodrum");
    expect(res.ok).toBe(true);
    expect(res.source).toBe("local-fallback");
    expect(res.configured).toBe(false);
    expect(res.posts.length).toBeGreaterThan(0);
    expect(
      res.posts.some(
        (p) => p.region === "Bodrum" || p.content.toLowerCase().includes("bodrum")
      )
    ).toBe(true);
  });

  it("fetchDistrictIntel ve syncIntelData 13 ilçe için tutarlı sonuç döner", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    const intel = await fetchDistrictIntel("Marmaris");
    expect(intel.ok).toBe(true);
    expect(intel.records.length).toBeGreaterThan(0);

    const synced = await syncIntelData("Fethiye");
    expect(synced.ok).toBe(true);
    expect(synced.records.length).toBeGreaterThan(0);
    expect(synced.district).toBe("Fethiye");
  });
});

describe("TomTom Harita & Canlı Trafik Servisi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("VITE_TOMTOM_API_KEY varlığını doğru algılar", () => {
    vi.stubEnv("VITE_TOMTOM_API_KEY", "");
    expect(isTomTomConfigured()).toBe(false);

    vi.stubEnv("VITE_TOMTOM_API_KEY", "tt-test-key");
    expect(isTomTomConfigured()).toBe(true);
  });

  it("TomTom Flow, Incidents ve Night tile URL şablonlarını doğru üretir", () => {
    const urls = buildTomTomLayerUrls("demo-key-123");

    expect(urls.trafficFlow).toBe(
      "https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=demo-key-123&tileSize=256"
    );
    expect(urls.trafficIncidents).toBe(
      "https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=demo-key-123&tileSize=256"
    );
    expect(urls.tomtomNight).toBe(
      "https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=demo-key-123&tileSize=256"
    );
    expect(TOMTOM_MISSING_KEY_MESSAGE).toContain("VITE_TOMTOM_API_KEY");
  });
});
