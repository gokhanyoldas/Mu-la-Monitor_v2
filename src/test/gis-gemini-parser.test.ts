import { describe, it, expect } from "vitest";
import { parseUnstructuredTextWithGemini } from "@/services/geminiParser";
import { MUGLA_DISTRICTS } from "@/data/muglaDistricts";

describe("GIS & Gemini Parser", () => {
  it("should have all 13 Muğla districts defined with valid coordinates", () => {
    expect(MUGLA_DISTRICTS).toHaveLength(13);
    MUGLA_DISTRICTS.forEach((district) => {
      expect(district.name).toBeTruthy();
      expect(district.lat).toBeGreaterThan(36);
      expect(district.lat).toBeLessThan(38);
      expect(district.lon).toBeGreaterThan(27);
      expect(district.lon).toBeLessThan(30);
    });
  });

  it("should extract district and category correctly using local heuristic parser", async () => {
    const rawText = "Bodrum Torba kavşağında kaza sebebiyle trafik kilitlendi.";
    const result = await parseUnstructuredTextWithGemini(rawText);

    expect(result.district_id).toBe("bodrum");
    expect(result.district_name).toBe("Bodrum");
    expect(result.category).toBe("Trafik");
    expect(result.lat).toBeCloseTo(37.0344, 2);
    expect(result.lon).toBeCloseTo(27.4305, 2);
  });

  it("should categorize fire incidents and assign severity correctly", async () => {
    const rawText = "Marmaris İçmeler ormanlık alanda çıkan yangın kontrol altına alınmaya çalışılıyor.";
    const result = await parseUnstructuredTextWithGemini(rawText);

    expect(result.district_id).toBe("marmaris");
    expect(result.category).toBe("Yangın/Afet");
  });

  it("should have complete and valid GeoJSON feature collection for 13 districts", async () => {
    const { MUGLA_DISTRICTS_GEOJSON } = await import("@/data/muglaDistrictsGeoJSON");
    expect(MUGLA_DISTRICTS_GEOJSON.type).toBe("FeatureCollection");
    expect(MUGLA_DISTRICTS_GEOJSON.features).toHaveLength(13);

    MUGLA_DISTRICTS_GEOJSON.features.forEach((feature) => {
      expect(feature.type).toBe("Feature");
      expect(feature.geometry.type).toBe("Polygon");
      expect(feature.geometry.coordinates[0].length).toBeGreaterThan(4);
      expect(feature.properties.id).toBeTruthy();
      expect(feature.properties.name).toBeTruthy();
      expect(feature.properties.population).toBeGreaterThan(5000);
      expect(feature.properties.center[0]).toBeGreaterThan(36);
      expect(feature.properties.center[0]).toBeLessThan(38);
    });
  });
});
