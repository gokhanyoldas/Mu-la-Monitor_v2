import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import {
  INITIAL_LIVING_LEXICON,
  loadLivingLexicon,
  appendToLivingLexicon,
  extractLexiconMatches,
} from "@/services/livingLexiconService";
import { DISTRICTS, getDistrictBySlug } from "@/data/districts";
import { getDistrictBaselineFeed } from "@/data/districtSocialBaselines";
import {
  analyzeAndArbitrateFieldSubmission,
  FIELD_INGESTION_PRESETS,
} from "@/services/fieldArbitrationEngine";

describe("Unified Intelligence & Arbitration Hub", () => {
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

  describe("1. Append-Only LivingLexicon (4-Layer Cumulative Vocabulary)", () => {
    it("seeds all 4 layers (core, micro_geo, protocol_subtext, field_jargon) and never deletes existing terms", () => {
      const initial = loadLivingLexicon();
      const layers = new Set(initial.map((e) => e.layer));
      expect(layers.has("core")).toBe(true);
      expect(layers.has("micro_geo")).toBe(true);
      expect(layers.has("protocol_subtext")).toBe(true);
      expect(layers.has("field_jargon")).toBe(true);
      expect(initial.length).toBeGreaterThanOrEqual(INITIAL_LIVING_LEXICON.length);

      const coreCountBefore = initial.filter((e) => e.layer === "core").length;

      const { nextEntries, addedCount } = appendToLivingLexicon(initial, [
        { term: "İçmeler Eski Belediye Kavşağı", layer: "micro_geo", district: "Marmaris" },
        { term: "kilit taş göçmesi", layer: "field_jargon", district: "Marmaris" },
      ]);

      expect(addedCount).toBe(2);
      expect(nextEntries.length).toBe(initial.length + 2);
      expect(nextEntries.filter((e) => e.layer === "core").length).toBe(coreCountBefore);

      const duplicate = appendToLivingLexicon(nextEntries, [
        { term: "İçmeler Eski Belediye Kavşağı", layer: "micro_geo", district: "Marmaris" },
      ]);
      expect(duplicate.addedCount).toBe(0);
      expect(duplicate.nextEntries.length).toBe(nextEntries.length);

      const reloaded = loadLivingLexicon();
      expect(reloaded.length).toBe(nextEntries.length);
      expect(extractLexiconMatches("İçmeler Eski Belediye Kavşağı önünde kilit taş göçmesi", reloaded).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("2. All 13 Districts Live Feed Coverage (Zero Empty States)", () => {
    it("resolves all 13 districts including Yatağan and Kavaklıdere and guarantees non-empty baseline feeds", () => {
      expect(DISTRICTS.length).toBe(13);
      for (const district of DISTRICTS) {
        const bySlug = getDistrictBySlug(district.slug);
        expect(bySlug?.name).toBe(district.name);
        const feed = getDistrictBaselineFeed(district.slug);
        expect(feed.length).toBeGreaterThanOrEqual(2);
      }

      // Explicitly verify Turkish-character & ASCII routes for Yatağan and Kavaklıdere
      expect(getDistrictBySlug("yatagan")?.slug).toBe("yatağan");
      expect(getDistrictBySlug("yatağan")?.slug).toBe("yatağan");
      expect(getDistrictBySlug("kavaklidere")?.slug).toBe("kavaklidere");
      expect(getDistrictBySlug("kavaklıdere")?.slug).toBe("kavaklidere");

      expect(getDistrictBaselineFeed("yatagan").length).toBeGreaterThanOrEqual(3);
      expect(getDistrictBaselineFeed("kavaklidere").length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("3. Marmaris Facebook Multi-Issue Decomposition, Subtext & Cross-Tab Arbitration", () => {
    it("decomposes >= 5 distinct issues, decodes all implicit subtexts, matches protocol officials, and updates all target tabs", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ ok: false }),
      } as Response);

      try {
        const preset = FIELD_INGESTION_PRESETS[0];
        const event = await analyzeAndArbitrateFieldSubmission({
          text: preset.text,
          lexiconTerms: INITIAL_LIVING_LEXICON.map((e) => e.term),
          tomtomHotspots: [{ name: "Marmaris", lat: 36.85, lng: 28.27, density: 35, speed: 42 }],
        });

        expect(event.districtName).toBe("Marmaris");
        expect(event.issues.length).toBeGreaterThanOrEqual(5);

        const subtextJoined = event.implicitSubtext.map((s) => `${s.phrase} ${s.hiddenMeaning}`).join(" ").toLocaleLowerCase("tr-TR");
        expect(subtextJoined).toContain("selfie");
        expect(subtextJoined).toContain("akraba");
        expect(subtextJoined).toContain("mayıs");

        const matchedActors = event.protocolLinks.map((p) => p.actorName.toLocaleLowerCase("tr-TR"));
        expect(matchedActors.some((a) => a.includes("ahmet aras"))).toBe(true);
        expect(matchedActors.some((a) => a.includes("acar ünlü"))).toBe(true);

        expect(event.dossier.code).toMatch(/^ODİT-MAR-\d+$/);
        expect(event.graphNodes.length).toBeGreaterThanOrEqual(4);
        expect(event.graphLinks.length).toBeGreaterThanOrEqual(3);

        expect(event.energyOutageDelta).toBe(1);
        expect(event.energyAlert).toBeDefined();
        expect(event.envWaterAlert?.isFlood).toBe(true);
        expect(event.floodSecurityAlert?.riskLevel).toBe("YÜKSEK");
        expect(event.tourismRiskAlert).toBeDefined();
        expect(event.budgetAlert?.municipalityNames).toContain("Marmaris Belediyesi");
        expect(event.budgetAlert?.projects.length).toBeGreaterThanOrEqual(3);
        expect(event.updatedTabs.length).toBeGreaterThanOrEqual(6);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe("4. Instagram Aksaz Traffic Preset vs TomTom Sensor Discrepancy Arbitrator", () => {
    it("detects TomTom blindspot and emits the exact verdict string when TomTom density is low", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ ok: false }),
      } as Response);

      try {
        const preset = FIELD_INGESTION_PRESETS[1];
        const event = await analyzeAndArbitrateFieldSubmission({
          text: preset.text,
          lexiconTerms: INITIAL_LIVING_LEXICON.map((e) => e.term),
          tomtomHotspots: [{ name: "Marmaris", lat: 36.85, lng: 28.27, density: 28, speed: 46 }],
        });

        expect(event.districtSlug).toBe("marmaris");
        expect(event.trafficPatch).toBeDefined();
        expect(event.trafficPatch?.sensorDiscrepancy).toBe(true);
        expect(event.trafficPatch?.verdictMessage).toBe(
          "SENSÖR UYUŞMAZLIĞI / KÖR NOKTA TESPİT EDİLDİ (İşini Doğru Yap TomTom!)"
        );
        expect(event.trafficPatch?.reportedSeverity).toBeGreaterThanOrEqual(80);
        expect(event.trafficPatch?.tomtomDensity).toBe(28);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe("5. React Cross-Tab Surface Integration", () => {
    it("mounts UnifiedIntelligenceProvider with TrafficDensityMap, EnergyConsumptionPanel, EmergencyPanel, ProtocolSection, AISummaryCard, and AlertPanel cleanly", async () => {
      vi.resetModules();
      vi.doMock("@/integrations/supabase/client", () => ({
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
            chain.order = vi.fn().mockResolvedValue({ data: null, error: null });
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

      const { UnifiedIntelligenceProvider } = await import("@/contexts/UnifiedIntelligenceContext");
      const { AuthProvider } = await import("@/hooks/useAuth");
      const { I18nProvider } = await import("@/hooks/useTranslation");
      const { TrafficDensityMap } = await import("@/components/dashboard/sections/TrafficDensityMap");
      const { EnergyConsumptionPanel } = await import("@/components/dashboard/sections/EnergySection");
      const { EmergencyPanel } = await import("@/components/dashboard/sections/SecuritySection");
      const { ProtocolSection } = await import("@/components/dashboard/sections/ProtocolSection");
      const { AISummaryCard } = await import("@/components/AISummaryCard");
      const { AlertPanel } = await import("@/components/dashboard/AlertPanel");

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

      render(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(
            QueryClientProvider,
            { client: qc },
            React.createElement(
              I18nProvider,
              null,
              React.createElement(
                AuthProvider,
                null,
                React.createElement(
                  UnifiedIntelligenceProvider,
                  null,
                  React.createElement(AlertPanel),
                  React.createElement(AISummaryCard, { type: "pulse" }),
                  React.createElement(TrafficDensityMap),
                  React.createElement(EnergyConsumptionPanel),
                  React.createElement(EmergencyPanel),
                  React.createElement(ProtocolSection)
                )
              )
            )
          )
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/Trafik Yoğunluk Haritası|Traffic Density Map/i)).toBeTruthy();
        expect(screen.getByText(/Enerji & Tüketim|Energy/i)).toBeTruthy();
        expect(screen.getByText(/Acil Durum & Kriz|Emergency/i)).toBeTruthy();
        expect(screen.getByText(/Şehir Nabzı|City Pulse/i)).toBeTruthy();
      });
    });
  });

  describe("6. Vercel /api Routing, 3-Tier Client Fallback & social_keywords Schema Sync", () => {
    it("excludes /api/* from SPA index.html rewrite and maps /api/(.*) to serverless functions in vercel.json", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const raw = fs.readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8");
      const vercelCfg = JSON.parse(raw) as { rewrites: Array<{ source: string; destination: string }> };

      expect(Array.isArray(vercelCfg.rewrites)).toBe(true);
      expect(vercelCfg.rewrites.length).toBeGreaterThanOrEqual(2);

      const spaRule = vercelCfg.rewrites[0];
      expect(spaRule.destination).toBe("/index.html");
      const spaRegex = new RegExp(`^${spaRule.source}$`);

      // SPA routes still hit index.html
      expect(spaRegex.test("/")).toBe(true);
      expect(spaRegex.test("/ilce/marmaris")).toBe(true);
      // /api/* and static assets must NOT rewrite to /index.html
      expect(spaRegex.test("/api/intel/analyze-post")).toBe(false);
      expect(spaRegex.test("/api/intel/district-grounding")).toBe(false);
      expect(spaRegex.test("/assets/index-abc.js")).toBe(false);

      const apiRule = vercelCfg.rewrites.find((r) => r.source === "/api/(.*)");
      expect(apiRule).toBeDefined();
      expect(apiRule?.destination).toBe("/api/$1");
    });

    it("falls back from Tier 1 (404) -> Tier 3 deterministic NLP when VITE_GEMINI_API_KEY is missing, and -> Tier 2 @google/genai when key is defined", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Not Found" }),
      } as Response);

      try {
        // Case A: 404 + no VITE_GEMINI_API_KEY -> Tier 3 without crashing
        vi.stubEnv("VITE_GEMINI_API_KEY", "");
        vi.stubEnv("GEMINI_API_KEY", "");
        vi.resetModules();

        const { analyzeAndArbitrateFieldSubmission: analyzeNoKey } = await import("@/services/fieldArbitrationEngine");
        const { fetchDistrictSearchGroundedFeed: groundNoKey } = await import("@/data/districtSocialBaselines");

        const tier3Event = await analyzeNoKey({
          text: "Marmaris Adaköy yolunda asfalt bozukluğu ve elektrik kesintisi var.",
          lexiconTerms: ["Marmaris", "Adaköy"],
        });
        expect(tier3Event.analysisSource).toBe("local-nlp-arbitrator");
        expect(tier3Event.issues.length).toBeGreaterThanOrEqual(1);

        const tier3Ground = await groundNoKey({
          districtSlug: "marmaris",
          districtName: "Marmaris",
          aliases: ["Adaköy"],
          lexiconTerms: ["asfalt"],
        });
        expect(tier3Ground.usedLiveSearch).toBe(false);
        expect(tier3Ground.posts).toEqual([]);

        // Case B: 404 + VITE_GEMINI_API_KEY defined -> Tier 2 @google/genai multimodal & search grounding
        vi.stubEnv("VITE_GEMINI_API_KEY", "test-client-gemini-key");
        const generateContentMock = vi.fn().mockImplementation(async (req: { config?: { tools?: unknown[] } }) => {
          if (req?.config?.tools) {
            return {
              text: JSON.stringify({
                posts: [
                  {
                    platform: "twitter",
                    author: "@MuglaSaha",
                    content: "Datça Palamutbükü yolunda bakım çalışması tamamlandı.",
                    sentiment: "positive",
                    url: "https://x.com/MuglaSaha/status/1",
                    topics: ["Datça", "Palamutbükü"],
                  },
                ],
              }),
              candidates: [
                {
                  groundingMetadata: {
                    groundingChunks: [
                      { web: { uri: "https://x.com/MuglaSaha/status/1", title: "Muğla Saha" } },
                    ],
                  },
                },
              ],
            };
          }
          return {
            text: JSON.stringify({
              summary: "Tier-2 Gemini istemci analizi tamamlandı.",
              districtName: "Datça",
              sentiment: "negative",
              sentimentScore: 0.78,
              issues: [
                {
                  topic: "Yol Bakım ve Altyapı",
                  category: "altyapi_yol",
                  locality: "Palamutbükü",
                  severity: "yuksek",
                  summary: "Sahil bağlantı yolunda yüzey bozulması tespit edildi.",
                },
              ],
              implicitSubtext: [],
              extractedLocalities: ["Palamutbükü"],
              extractedActors: ["Büyükşehir Fen İşleri"],
              extractedProjects: ["Sahil Bağlantı Yolu"],
              extractedJargon: ["yüzey bozulması"],
              reportedTrafficAnomaly: { detected: true, location: "Palamutbükü", reason: "Tek şerit daralma" },
            }),
          };
        });

        vi.resetModules();
        vi.doMock("@google/genai", () => ({
          GoogleGenAI: class {
            models = { generateContent: generateContentMock };
          },
        }));

        const { analyzeAndArbitrateFieldSubmission: analyzeWithKey } = await import("@/services/fieldArbitrationEngine");
        const { fetchDistrictSearchGroundedFeed: groundWithKey } = await import("@/data/districtSocialBaselines");

        const tier2Event = await analyzeWithKey({
          text: "Datça Palamutbükü yolunda daralma var.",
          lexiconTerms: ["Datça", "Palamutbükü"],
        });
        expect(tier2Event.analysisSource).toBe("gemini-multimodal");
        expect(tier2Event.districtName).toBe("Datça");
        expect(tier2Event.extractedLexiconTerms.some((t) => t.term === "Palamutbükü")).toBe(true);

        const tier2Ground = await groundWithKey({
          districtSlug: "datca",
          districtName: "Datça",
          aliases: ["Palamutbükü"],
          lexiconTerms: ["yol"],
        });
        expect(tier2Ground.usedLiveSearch).toBe(true);
        expect(tier2Ground.posts.length).toBe(1);
        expect(tier2Ground.groundingSources[0]?.uri).toBe("https://x.com/MuglaSaha/status/1");
        expect(generateContentMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.doUnmock("@google/genai");
        vi.unstubAllEnvs();
        fetchSpy.mockRestore();
      }
    });

    it("builds exact social_keywords upsert payload and syncs with onConflict: term", async () => {
      const { buildSocialKeywordUpsertRows } = await import("@/services/livingLexiconService");

      const rows = buildSocialKeywordUpsertRows(
        [
          {
            term: "Yalancıboğaz Marina",
            normalized: "yalancibogaz marina",
            layer: "micro_geo",
            district: "Marmaris",
            addedAt: "2026-11-18T00:00:00.000Z",
            hitCount: 3,
            source: "field_ingested",
            isNewlyLearned: true,
          },
        ],
        "user-uuid-123"
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        term: "Yalancıboğaz Marina",
        keyword: "Yalancıboğaz Marina",
        layer: "micro_geo",
        category: "micro_geo",
        district: "Marmaris",
        weight: 3,
        is_learned: true,
        source_context: "field_ingested",
        user_id: "user-uuid-123",
      });
      expect(typeof rows[0].updated_at).toBe("string");

      // Verify runtime upsert calls Supabase with { onConflict: "term" } when authenticated
      const upsertMock = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.resetModules();
      vi.doMock("@/integrations/supabase/client", () => ({
        supabase: {
          auth: {
            getSession: vi.fn().mockResolvedValue({
              data: { session: { access_token: "tok", user: { id: "user-uuid-123" } } },
              error: null,
            }),
          },
          from: vi.fn(() => ({ upsert: upsertMock })),
        },
        isSupabaseClientConfigured: true,
      }));

      try {
        const { loadLivingLexicon: loadFresh, appendToLivingLexicon: appendFresh } = await import(
          "@/services/livingLexiconService"
        );
        const current = loadFresh();
        appendFresh(current, [
          {
            term: "Turgutreis Liman Yolu",
            layer: "micro_geo",
            district: "Bodrum",
            source: "unit_test",
          },
        ]);

        await waitFor(() => {
          expect(upsertMock).toHaveBeenCalledTimes(1);
        });
        const [payload, opts] = upsertMock.mock.calls[0];
        expect(opts).toEqual({ onConflict: "term" });
        expect(payload[0]).toMatchObject({
          term: "Turgutreis Liman Yolu",
          layer: "micro_geo",
          category: "micro_geo",
          district: "Bodrum",
          is_learned: true,
          source_context: "unit_test",
        });
      } finally {
        vi.doUnmock("@/integrations/supabase/client");
      }
    });
  });
});

