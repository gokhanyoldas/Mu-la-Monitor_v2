import { describe, it, expect } from "vitest";
import {
  INVESTIGATION_DOSSIERS,
  INVESTIGATION_NODES,
  INVESTIGATION_LINKS
} from "@/data/investigationData";
import { interrogateIntelligence } from "@/services/investigationService";

describe("Muğla İstihbarat & Çapraz Sorgu Odası (OSINT Nexus)", () => {
  it("should contain complete investigation dossiers across key Muğla districts", () => {
    expect(INVESTIGATION_DOSSIERS.length).toBeGreaterThanOrEqual(4);

    INVESTIGATION_DOSSIERS.forEach((dos) => {
      expect(dos.id).toBeTruthy();
      expect(dos.code).toMatch(/^DOSYA-/);
      expect(dos.title).toBeTruthy();
      expect(dos.summary).toBeTruthy();
      expect(dos.interrogationPromptQuestions.length).toBeGreaterThanOrEqual(2);
      expect(dos.nodeIds.length).toBeGreaterThanOrEqual(3);
      expect(dos.linkIds.length).toBeGreaterThanOrEqual(2);
      expect(typeof dos.verdictScore).toBe("number");
    });
  });

  it("should have diverse investigation nodes covering rumors, local news, and official statements", () => {
    expect(INVESTIGATION_NODES.length).toBeGreaterThanOrEqual(10);

    const types = new Set(INVESTIGATION_NODES.map(n => n.type));
    expect(types.has("kulis_dedikodu")).toBe(true);
    expect(types.has("yerel_haber")).toBe(true);
    expect(types.has("resmi_teyit")).toBe(true);

    INVESTIGATION_NODES.forEach((node) => {
      expect(node.title).toBeTruthy();
      expect(node.source).toBeTruthy();
      expect(node.credibilityScore).toBeGreaterThanOrEqual(0);
      expect(node.credibilityScore).toBeLessThanOrEqual(100);
      expect(node.claimSummary).toBeTruthy();
      expect(typeof node.x).toBe("number");
      expect(typeof node.y).toBe("number");
    });
  });

  it("should have contradiction and evidence links between rumors and facts", () => {
    expect(INVESTIGATION_LINKS.length).toBeGreaterThanOrEqual(8);

    const contradictions = INVESTIGATION_LINKS.filter(l => l.isContradiction);
    expect(contradictions.length).toBeGreaterThanOrEqual(3);

    INVESTIGATION_LINKS.forEach((link) => {
      expect(link.source).toBeTruthy();
      expect(link.target).toBeTruthy();
      expect(link.evidenceQuote).toBeTruthy();
      expect(link.confidence).toBeGreaterThan(0);
    });
  });

  it("should interrogate Bodrum water tender rumor and return verdict with contradictions", async () => {
    const result = await interrogateIntelligence("Bodrum su kesintisi ihale usulsüzlüğü dedikodusu doğru mu?");
    expect(result).toBeDefined();
    expect(result.matchedDossier?.districtId).toBe("bodrum");
    expect(result.verdict).toBe("YALANLANDI / DEZENFORMASYON");
    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(result.chainOfEvidence.length).toBeGreaterThan(0);
    expect(result.interrogationTranscript.length).toBeGreaterThan(0);
    expect(result.highlightedNodeIds.length).toBeGreaterThan(0);
  });

  it("should interrogate Datça Balıkaşıran road closure rumor and identify intentional disinformation", async () => {
    const result = await interrogateIntelligence("Datça Balıkaşıran geçidi 3 gün kapatılacak mı?");
    expect(result).toBeDefined();
    expect(result.matchedDossier?.districtId).toBe("datca");
    expect(result.verdict).toBe("YALANLANDI / DEZENFORMASYON");
    expect(result.verdictScore).toBe(0);
    expect(result.recommendedAction).toBeTruthy();
  });
});
