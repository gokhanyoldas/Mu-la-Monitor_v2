import { describe, it, expect } from "vitest";
import { MUGLA_NETWORK_NODES, MUGLA_NETWORK_LINKS, LINK_TYPE_COLORS } from "@/data/muglaNetworkData";

describe("Muğla Network Relationship Topology", () => {
  it("should have all 13 Muğla districts plus key infrastructure nodes", () => {
    expect(MUGLA_NETWORK_NODES.length).toBeGreaterThanOrEqual(13);

    const districtIds = [
      "mentese", "bodrum", "marmaris", "fethiye", "milas",
      "dalaman", "ula", "ortaca", "datca", "koycegiz",
      "seydikemer", "yatagan", "kavaklidere"
    ];

    districtIds.forEach((id) => {
      const node = MUGLA_NETWORK_NODES.find(n => n.id === id);
      expect(node).toBeDefined();
      expect(node!.name).toBeTruthy();
      expect(node!.role).toBeTruthy();
      expect(typeof node!.x).toBe("number");
      expect(typeof node!.y).toBe("number");
    });
  });

  it("should have Menteşe as the central coordinate (0, 0)", () => {
    const mentese = MUGLA_NETWORK_NODES.find(n => n.id === "mentese");
    expect(mentese).toBeDefined();
    expect(mentese!.x).toBe(0);
    expect(mentese!.y).toBe(0);
  });

  it("should define valid solid and dashed relationship links", () => {
    expect(MUGLA_NETWORK_LINKS.length).toBeGreaterThan(10);

    MUGLA_NETWORK_LINKS.forEach((link) => {
      expect(link.source).toBeTruthy();
      expect(link.target).toBeTruthy();
      expect(["solid", "dashed"]).toContain(link.style);
      expect(link.description).toBeTruthy();
      expect(LINK_TYPE_COLORS[link.type]).toBeDefined();
    });
  });

  it("should connect Bodrum and Milas through infrastructure water and highway links", () => {
    const bodrumMilasLinks = MUGLA_NETWORK_LINKS.filter(
      l => (l.source === "milas" && l.target === "bodrum") || 
           (l.source === "geyik_baraji" && l.target === "bodrum")
    );
    expect(bodrumMilasLinks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Faz 4: Kriz & Protokol Komuta Zinciri", () => {
  it("should have complete crisis protocol chains for all 13 districts and infrastructure hubs", async () => {
    const { CRISIS_PROTOCOL_CHAINS, getNodeCrisisChain } = await import("@/data/crisisProtocolChain");

    const keyNodes = [
      "mentese", "bodrum", "marmaris", "fethiye", "milas",
      "dalaman", "datca", "ortaca", "koycegiz", "ula",
      "yatagan", "seydikemer", "kavaklidere", "geyik_baraji", "sakar_rampasi"
    ];

    keyNodes.forEach((nodeId) => {
      const chain = getNodeCrisisChain(nodeId);
      expect(chain).toBeDefined();
      expect(chain.nodeName).toBeTruthy();
      expect(chain.emergencyCode).toMatch(/^MU-/);
      expect(chain.contacts.length).toBeGreaterThanOrEqual(3);
      expect(chain.keyRisks.length).toBeGreaterThanOrEqual(1);
      expect(chain.contingencyRoutes.length).toBeGreaterThanOrEqual(1);

      // Mülki İdare Amiri doğrulaması
      const primary = chain.contacts.find(c => c.isPrimary);
      expect(primary).toBeDefined();
      expect(primary!.isim).toBeTruthy();
      expect(primary!.telefon).toBeTruthy();
    });
  });

  it("should generate formatted crisis dispatch text with emergency code and phone numbers", async () => {
    const { getNodeCrisisChain, generateCrisisDispatchText } = await import("@/data/crisisProtocolChain");
    const bodrumChain = getNodeCrisisChain("bodrum");
    const dispatchText = generateCrisisDispatchText(bodrumChain);

    expect(dispatchText).toContain("MU-BDR-01");
    expect(dispatchText).toContain("Bodrum");
    expect(dispatchText).toContain("Mülki İdare Amiri");
    expect(dispatchText).toContain("Tahliye");
  });
});

