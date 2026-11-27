import { describe, expect, it } from "vitest";
import {
  isTrafficNews,
  mergeTrafficHotspots,
  toTrafficNewsItem,
  type TrafficHotspot,
} from "../../supabase/functions/_shared/traffic";

describe("traffic transport data helpers", () => {
  it("maps actual social_posts columns into linked traffic news", () => {
    const item = toTrafficNewsItem({
      content: "Bodrum yolu kaza nedeniyle kapandı",
      platform: "Yerel Haber",
      url: "https://example.test/traffic",
      district: "Bodrum",
      published_at: "2026-11-28T09:15:00.000Z",
    });

    expect(item).toMatchObject({
      district: "Bodrum",
      source: "Yerel Haber",
      link: "https://example.test/traffic",
      published_at: "2026-11-28T09:15:00.000Z",
    });
    expect(item && isTrafficNews(item, ["trafik", "kaza", "yol"])).toBe(true);
    expect(isTrafficNews({ ...item!, text: "Yolcu sayısı arttı" }, ["yol"])).toBe(false);
    expect(toTrafficNewsItem({ content: "", published_at: "2026-11-28T09:15:00.000Z" })).toBeNull();
    expect(toTrafficNewsItem({
      content: "Yol kapalı",
      url: "javascript:alert(1)",
      published_at: "2026-11-28T09:15:00.000Z",
    })?.link).toBeNull();
  });

  it("merges fresh districts with last-good values and records coverage", () => {
    const expected: TrafficHotspot[] = [
      { name: "Bodrum", lat: 37.03, lon: 27.43, density: 0 },
      { name: "Datça", lat: 36.73, lon: 27.74, density: 0 },
    ];
    const previous: TrafficHotspot[] = [
      { name: "Bodrum", lat: 37.03, lon: 27.43, density: 40, speed: 30 },
      { name: "Datça", lat: 36.73, lon: 27.74, density: 15, speed: 45 },
    ];

    const result = mergeTrafficHotspots(
      expected,
      [{ name: "Bodrum", density: 55, speed: 20 }],
      previous,
      "2026-11-28T10:00:00.000Z",
    );

    expect(result.hotspots).toMatchObject([
      { name: "Bodrum", density: 55, stale: false, fetched_at: "2026-11-28T10:00:00.000Z" },
      { name: "Datça", density: 15, speed: 45, stale: true, lat: 36.73, lon: 27.74 },
    ]);
    expect(result.coverage).toMatchObject({ expected: 2, fresh: 1, stale: 1, missing: 0 });
  });

  it("preserves every prior district as stale when no fresh samples arrive", () => {
    const expected: TrafficHotspot[] = [{ name: "Marmaris", lat: 36.85, lon: 28.27, density: 0 }];
    const result = mergeTrafficHotspots(
      expected,
      [],
      [{ name: "Marmaris", density: 62, speed: 12 }],
      "2026-11-28T10:00:00.000Z",
    );

    expect(result.hotspots).toEqual([
      { ...expected[0], density: 62, speed: 12, stale: true },
    ]);
    expect(result.coverage).toMatchObject({ expected: 1, fresh: 0, stale: 1, missing: 0 });
  });
});
