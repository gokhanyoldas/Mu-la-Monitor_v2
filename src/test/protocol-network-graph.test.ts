import { describe, it, expect, vi, afterEach } from "vitest";
import {
  INITIAL_PROTOCOL_NODES,
  INITIAL_PROTOCOL_LINKS,
  NODE_GROUP_META,
  LINK_RELATION_META,
  getFirstDegreeNeighborhood,
  matchesProtocolFilter,
} from "@/data/protocolNetworkGraphData";
import { analyzeProtocolNodeWithGemini } from "@/services/protocolNetworkGeminiService";

const EXPECTED_13_DISTRICTS = [
  "Menteşe",
  "Bodrum",
  "Fethiye",
  "Marmaris",
  "Milas",
  "Seydikemer",
  "Ortaca",
  "Dalaman",
  "Köyceğiz",
  "Ula",
  "Yatağan",
  "Datça",
  "Kavaklıdere",
];

describe("Protokol ve Veri Ağı (Test) — Topoloji ve Gemini Analizi", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("4 düğüm grubunun tümünü ve Muğla'nın 13 ilçesini eksiksiz içerir", () => {
    const groups = new Set(INITIAL_PROTOCOL_NODES.map((n) => n.group));
    expect(groups.has("protokol_merkez")).toBe(true);
    expect(groups.has("ilce")).toBe(true);
    expect(groups.has("paydas")).toBe(true);
    expect(groups.has("olay")).toBe(true);

    const ilceLabels = INITIAL_PROTOCOL_NODES.filter((n) => n.group === "ilce").map(
      (n) => n.label
    );
    expect(ilceLabels).toHaveLength(13);
    for (const district of EXPECTED_13_DISTRICTS) {
      expect(ilceLabels).toContain(district);
    }
  });

  it("4 farklı ilişki türünü ve 1-5 arası bağlantı ağırlıklarını barındırır", () => {
    const relations = new Set(INITIAL_PROTOCOL_LINKS.map((l) => l.relation));
    expect(relations.has("Protokol Koordinasyonu")).toBe(true);
    expect(relations.has("Saha Denetimi")).toBe(true);
    expect(relations.has("OSINT Haber Bağlantısı")).toBe(true);
    expect(relations.has("İdari Bağ")).toBe(true);

    for (const link of INITIAL_PROTOCOL_LINKS) {
      expect(link.weight).toBeGreaterThanOrEqual(1);
      expect(link.weight).toBeLessThanOrEqual(5);
      expect(NODE_GROUP_META).toBeDefined();
      expect(LINK_RELATION_META[link.relation]).toBeDefined();
    }
  });

  it("1. derece komşuluk fonksiyonu doğrudan bağlı düğüm ve bağlantıları doğru ayırır", () => {
    const result = getFirstDegreeNeighborhood(
      "valilik",
      INITIAL_PROTOCOL_NODES,
      INITIAL_PROTOCOL_LINKS
    );

    expect(result.neighborIds.has("valilik")).toBe(true);
    expect(result.neighborIds.has("mbb")).toBe(true);
    expect(result.neighborIds.has("afad")).toBe(true);
    expect(result.neighborIds.has("paydas_kaymakamliklar")).toBe(true);
    expect(result.connections.length).toBeGreaterThanOrEqual(5);
    // Ağırlığa göre azalan sıralama
    for (let i = 1; i < result.connections.length; i++) {
      expect(result.connections[i - 1].link.weight).toBeGreaterThanOrEqual(
        result.connections[i].link.weight
      );
    }
  });

  it("kategori filtresi Tümü, Protokol, İlçeler ve Olaylar düğümlerini doğru süzer", () => {
    const allCount = INITIAL_PROTOCOL_NODES.filter((n) =>
      matchesProtocolFilter(n, "all")
    ).length;
    const protokolCount = INITIAL_PROTOCOL_NODES.filter((n) =>
      matchesProtocolFilter(n, "protokol")
    ).length;
    const ilceCount = INITIAL_PROTOCOL_NODES.filter((n) =>
      matchesProtocolFilter(n, "ilce")
    ).length;
    const olayCount = INITIAL_PROTOCOL_NODES.filter((n) =>
      matchesProtocolFilter(n, "olay")
    ).length;

    expect(allCount).toBe(INITIAL_PROTOCOL_NODES.length);
    expect(protokolCount).toBe(8); // 5 merkez kurum + 3 paydaş
    expect(ilceCount).toBe(13);
    expect(olayCount).toBe(4);
  });

  it("Gemini API anahtarı yokken bile seçili düğüm için 3 maddelik yerel bağlantı özeti döndürür", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");

    const valilik = INITIAL_PROTOCOL_NODES.find((n) => n.id === "valilik")!;
    const { connections } = getFirstDegreeNeighborhood(
      "valilik",
      INITIAL_PROTOCOL_NODES,
      INITIAL_PROTOCOL_LINKS
    );

    const analysis = await analyzeProtocolNodeWithGemini(valilik, connections);
    expect(analysis.nodeId).toBe("valilik");
    expect(analysis.source).toBe("local-topology-fallback");
    expect(analysis.bullets).toHaveLength(3);
    expect(analysis.bullets.every((b) => typeof b === "string" && b.length > 10)).toBe(true);
  });

  it("Gemini API anahtarı varken API yanıtını 3 maddede ayrıştırır", async () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-gemini-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          analysis: {
            bullets: [
              "Bodrum ve Marmaris ile koordinasyon yüksek.",
              "AFAD ve MBB saha denetimleri aktif.",
              "OSINT gündem yoğunluğu izleniyor.",
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const valilik = INITIAL_PROTOCOL_NODES.find((n) => n.id === "valilik")!;
    const { connections } = getFirstDegreeNeighborhood(
      "valilik",
      INITIAL_PROTOCOL_NODES,
      INITIAL_PROTOCOL_LINKS
    );

    const analysis = await analyzeProtocolNodeWithGemini(valilik, connections);
    expect(analysis.source).toBe("gemini-api");
    expect(analysis.bullets).toHaveLength(3);
    expect(analysis.bullets[0]).toContain("Bodrum");
  });
});
