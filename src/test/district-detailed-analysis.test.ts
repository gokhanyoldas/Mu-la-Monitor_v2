import { describe, it, expect } from "vitest";
import { DISTRICT_DETAILED_METRICS } from "@/data/districtDetailedMetrics";

describe("District Detailed Metrics Analysis", () => {
  it("should have detailed metrics defined for all 13 Muğla districts", () => {
    const keys = Object.keys(DISTRICT_DETAILED_METRICS);
    expect(keys).toHaveLength(13);

    const requiredDistricts = [
      "bodrum", "fethiye", "milas", "mentese", "marmaris",
      "seydikemer", "ortaca", "dalaman", "yatagan", "koycegiz",
      "ula", "datca", "kavaklidere"
    ];

    requiredDistricts.forEach((distId) => {
      expect(DISTRICT_DETAILED_METRICS[distId]).toBeDefined();
      const dist = DISTRICT_DETAILED_METRICS[distId];

      // Nüfus kontrolleri (TÜİK ADNKS)
      expect(dist.population).toBeGreaterThan(5000);
      expect(dist.summerPopulationPeak).toBeGreaterThanOrEqual(dist.population);

      // Turizm kontrolleri (0-100)
      expect(dist.tourismScore).toBeGreaterThanOrEqual(0);
      expect(dist.tourismScore).toBeLessThanOrEqual(100);
      expect(dist.hotelBedCapacity).toBeGreaterThan(0);

      // Çok boyutlu risk kontrolleri (0-100)
      expect(dist.compositeRiskScore).toBeGreaterThanOrEqual(0);
      expect(dist.compositeRiskScore).toBeLessThanOrEqual(100);
      expect(dist.riskBreakdown.fireRisk).toBeGreaterThanOrEqual(0);
      expect(dist.riskBreakdown.seismicRisk).toBeGreaterThanOrEqual(0);
      expect(dist.riskBreakdown.trafficCongestion).toBeGreaterThanOrEqual(0);
      expect(dist.riskBreakdown.waterStress).toBeGreaterThanOrEqual(0);

      // Altyapı kontrolleri
      expect(dist.criticalInfrastructure.length).toBeGreaterThanOrEqual(2);
      expect(dist.operationalSummary).toBeTruthy();
    });
  });

  it("should have Bodrum and Marmaris with highest summer population surge", () => {
    const bodrum = DISTRICT_DETAILED_METRICS.bodrum;
    const marmaris = DISTRICT_DETAILED_METRICS.marmaris;

    expect(bodrum.summerPopulationPeak).toBeGreaterThan(1000000);
    expect(marmaris.summerPopulationPeak).toBeGreaterThan(500000);
    expect(bodrum.tourismScore).toBeGreaterThanOrEqual(90);
    expect(marmaris.tourismScore).toBeGreaterThanOrEqual(90);
  });
});
