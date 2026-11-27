import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeText,
  normalizeTr,
  DISTRICTS,
  DISTRICT_COORDS,
} from "../../supabase/functions/_shared/nlp";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// 1) Birleşik (unified) NLP motoru davranışı
// ═══════════════════════════════════════════════════════════════════════════
describe("Unified NLP — _shared/nlp.ts (tek doğruluk kaynağı)", () => {
  describe("normalizeTr — Türkçe küçük harf + diakritik katlama", () => {
    it("Türkçe karakterleri ASCII aramaya indirger", () => {
      expect(normalizeTr("Göcek")).toBe("gocek");
      expect(normalizeTr("MUĞLA")).toBe("mugla");
      expect(normalizeTr("İçmeler")).toBe("icmeler");
      expect(normalizeTr("Yatağan")).toBe("yatagan");
      expect(normalizeTr("Datça")).toBe("datca");
    });
  });

  describe("Kanonik ilçe kümesi", () => {
    it("tam olarak 13 kanonik ilçe içerir (Menteşe dâhil, 'Muğla Merkez' değil)", () => {
      expect(DISTRICTS).toHaveLength(13);
      expect(DISTRICTS).toContain("Menteşe");
      expect(DISTRICTS).not.toContain("Muğla Merkez");
      for (const d of [
        "Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz",
        "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan",
      ]) {
        expect(DISTRICTS).toContain(d);
        expect(DISTRICT_COORDS[d]).toHaveLength(2);
      }
    });
  });

  describe("Kelime sınırı eşleştirmesi (alt-dize yanlış pozitifleri)", () => {
    it("`milaspor` → Milas SAYILMAZ", () => {
      const r = analyzeText("Milaspor maçı kazandı");
      expect(r.district).toBeNull();
      expect(r.entities).toHaveLength(0);
    });

    it("`yolcu` → `yol` kategorisi SAYILMAZ", () => {
      const r = analyzeText("Yolcu gemisi limana yanaştı");
      expect(r.district).toBeNull();
      expect(r.category).not.toBe("infrastructure_transport");
      expect(r.category).toBe("general");
    });

    it("noktalama/apostrof sonrası gerçek eşleşme çalışır (Bodrum.)", () => {
      const r = analyzeText("Bodrum. İtfaiye müdahale ediyor.");
      expect(r.district).toBe("Bodrum");
    });
  });

  describe("Kanonik ilçe çözümlemesi (çakışan takma adlar düzeltildi)", () => {
    it("göcek → Fethiye (Dalaman DEĞİL)", () => {
      const r = analyzeText("Göcek'te tekne turları başladı");
      expect(r.district).toBe("Fethiye");
      expect(r.districtConfidence).toBeCloseTo(0.99, 2);
    });

    it("akyaka → Ula (Menteşe DEĞİL)", () => {
      const r = analyzeText("Akyaka'da deniz temiz");
      expect(r.district).toBe("Ula");
    });

    it("muğla → Menteşe ('Muğla Merkez' DEĞİL)", () => {
      const r = analyzeText("Muğla'da belediye meclisi toplandı");
      expect(r.district).toBe("Menteşe");
      // İl adı düşük özgüllükte bir sinyaldir → güven 0.85 civarı
      expect(r.districtConfidence).toBeCloseTo(0.85, 2);
    });
  });

  describe("Çok ilçeli metinde özgüllük ağırlıklı çoğunluk oyu + güven skoru", () => {
    it("daha çok anılan ilçe kazanır ve güven düşer", () => {
      const r = analyzeText(
        "Milas yangını büyüdü. Milas'ta ekipler çalışıyor. Bodrum'a sıçradı."
      );
      expect(r.district).toBe("Milas");
      expect(r.districtConfidence).toBeGreaterThan(0.4);
      expect(r.districtConfidence).toBeLessThan(0.9);
    });

    it("spesifik mahalle/mevki, düz ilçe adına göre daha yüksek özgüllükte ağırlık alır", () => {
      const r = analyzeText("Datça yarımadasında, Göcek koyunda");
      // Datça (1×1) vs göcek→Fethiye (1×2) → Fethiye öne geçer
      expect(r.district).toBe("Fethiye");
      expect(r.districtConfidence).toBeCloseTo(0.67, 2);
      const names = r.entities.map((e) => e.name);
      expect(names).toContain("Datça");
      expect(names).toContain("göcek");
    });

    it("eşleşme yoksa district null ve güven 0 olur", () => {
      const r = analyzeText("herhangi bir metin");
      expect(r.district).toBeNull();
      expect(r.districtConfidence).toBe(0);
      expect(r.lat).toBeNull();
      expect(r.lon).toBeNull();
    });
  });

  describe("Kategori sınıflandırması", () => {
    it("afet/yangın metni → fire_disaster ve negatif duygu", () => {
      const r = analyzeText("Bodrum'da yangın var. İtfaiye müdahale ediyor.");
      expect(r.category).toBe("fire_disaster");
      expect(r.sentiment).toBe("negative");
      expect(r.sentimentScore).toBeLessThan(0);
    });

    it("turizm metni → tourism", () => {
      const r = analyzeText("Fethiye'de otel doluluk oranı arttı");
      expect(r.district).toBe("Fethiye");
      expect(r.category).toBe("tourism");
    });

    it("yönetim metni → governance", () => {
      const r = analyzeText("Menteşe belediye meclisi toplandı, ihale karar");
      expect(r.district).toBe("Menteşe");
      expect(r.category).toBe("governance");
    });
  });

  describe("Duygu analizi", () => {
    it("olumlu metin pozitif skor üretir", () => {
      const r = analyzeText("Harika bir gelişme");
      expect(r.sentiment).toBe("positive");
      expect(r.sentimentScore).toBeGreaterThan(0);
      expect(r.sentimentConfidence).toBeGreaterThanOrEqual(0.5);
    });

    it("olumsuz metin negatif skor üretir", () => {
      const r = analyzeText("Yol tıkalı, rezalet");
      expect(r.sentiment).toBe("negative");
      expect(r.sentimentScore).toBeLessThan(0);
    });

    it("nötr metin 0 skor ve 0.5 güven verir", () => {
      const r = analyzeText("Sokak lambası direği");
      expect(r.sentiment).toBe("neutral");
      expect(r.sentimentScore).toBe(0);
      expect(r.sentimentConfidence).toBe(0.5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2) Tek kaynak bağlama (wiring) doğrulaması — dört edge function
// ═══════════════════════════════════════════════════════════════════════════
describe("NLP tek kaynak bağlaması (edge functions)", () => {
  const FUNCS = [
    "supabase/functions/news-scrape/index.ts",
    "supabase/functions/social-collect/index.ts",
    "supabase/functions/twitter-collect/index.ts",
    "supabase/functions/social-analyze/index.ts",
  ];

  it("dört edge function da analyzeText'i _shared/nlp.ts'ten import eder", () => {
    for (const f of FUNCS) {
      const src = read(f);
      expect(src, f).toContain('from "../_shared/nlp.ts"');
      expect(src, f).toContain("analyzeText");
    }
  });

  it("social-collect eski REGION_MAP/detectRegion kopyasını artık içermez", () => {
    const src = read("supabase/functions/social-collect/index.ts");
    expect(src).not.toMatch(/const\s+REGION_MAP/);
    expect(src).not.toMatch(/function\s+detectRegion/);
    // Çakışan nesne-literal eşlemesi (göcek→Dalaman) bulunmamalı
    expect(src).not.toMatch(/göcek\s*:\s*["']Dalaman["']/);
  });

  it("social-analyze kendi duygu sözlüğünü tanımlamaz (tek kaynaktan beslenir)", () => {
    const src = read("supabase/functions/social-analyze/index.ts");
    expect(src).not.toMatch(/const\s+negativeWords\s*=\s*new\s+Set/);
    expect(src).not.toMatch(/const\s+positiveWords\s*=\s*new\s+Set/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3) Idempotent NLP backfill script'i + npm wiring
// ═══════════════════════════════════════════════════════════════════════════
describe("Idempotent NLP backfill (scripts/backfill-nlp.ts)", () => {
  it("`npm run backfill:nlp` doğru script'e bağlıdır", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["backfill:nlp"]).toBe("tsx scripts/backfill-nlp.ts");
  });

  it("tek doğruluk kaynağı olan _shared/nlp.ts'ten analyzeText'i kullanır", () => {
    const src = read("scripts/backfill-nlp.ts");
    expect(src).toContain("_shared/nlp");
    expect(src).toContain("analyzeText");
  });

  it("idempotenttir: yalnızca `district IS NULL` satırları seçer", () => {
    const src = read("scripts/backfill-nlp.ts");
    expect(src).toContain("district=is.null");
  });

  it("PATCH gövdesi SADECE 4 alan yazar; zaman damgalarına dokunmaz", () => {
    const src = read("scripts/backfill-nlp.ts");
    const body = src.match(/body:\s*\{([\s\S]*?)\}/);
    expect(body, "PATCH body bloğu bulunamadı").not.toBeNull();
    const bodyBlock = body![1];
    for (const key of ["district", "category", "sentiment_score", "entities"]) {
      expect(bodyBlock, key).toContain(`${key}:`);
    }
    expect(bodyBlock).not.toMatch(/collected_at|analyzed_at|published_at/);
    expect(bodyBlock).not.toMatch(/_at\s*:/);
  });

  it("harici AI/API çağrısı tetiklemez (0 maliyet, tamamen yerel)", () => {
    const src = read("scripts/backfill-nlp.ts");
    expect(src).not.toMatch(/gemini|openai|huggingface|firecrawl/i);
  });
});
