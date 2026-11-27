import { describe, expect, it } from "vitest";
import { buildSentimentHistory } from "@/components/social/SentimentHistoryChart";
import { generateRegionMapData } from "@/components/social/SocialRegionMap";
import { filterSocialAnalyses, normalizeSocialPost } from "@/pages/SocialIntel";
import type { SocialFilters } from "@/components/social/FilterPanel";

const now = new Date("2026-11-28T12:00:00.000Z");
const defaults: SocialFilters = {
  platform: "all",
  sentiment: "all",
  region: "",
  dateRange: "all",
  keyword: "",
};

describe("Social Intel normalized dataset and filters", () => {
  it("prefers stored district, falls back to legacy region, and never detects from text", () => {
    const canonical = normalizeSocialPost({
      district: "Bodrum",
      region: "Menteşe",
      content: "Datça ile ilgili bir duyuru",
      platform: "twitter",
      sentiment_score: -0.72,
      sentiment_confidence: 0.91,
    });
    const legacy = normalizeSocialPost({ region: "Ula", content: "Bodrum haberi" });
    const untagged = normalizeSocialPost({ content: "Bodrum haberi" });

    expect(canonical.region).toBe("Bodrum");
    expect(legacy.region).toBe("Ula");
    expect(untagged.region).toBeUndefined();
  });

  it("keeps signed sentiment score separate from confidence", () => {
    const item = normalizeSocialPost({
      platform: "reddit",
      content: "Şikayet",
      sentiment_score: -0.72,
      sentiment_confidence: 0.91,
    });

    expect(item.sentiment_score).toBe(-0.72);
    expect(item.sentiment_confidence).toBe(0.91);
  });

  it("applies date, platform, sentiment, region, and keyword predicates together", () => {
    const recent = normalizeSocialPost({
      id: "recent",
      platform: "twitter",
      content: "Bodrum su kesintisi",
      sentiment: "negative",
      sentiment_score: -0.6,
      sentiment_confidence: 0.8,
      district: "Bodrum",
      category: "infrastructure",
      entities: [{ name: "water" }],
      published_at: "2026-11-28T11:30:00.000Z",
    });
    const old = normalizeSocialPost({
      id: "old",
      platform: "twitter",
      content: "Bodrum su kesintisi",
      sentiment: "negative",
      district: "Bodrum",
      published_at: "2026-11-28T09:00:00.000Z",
    });
    const otherPlatform = normalizeSocialPost({
      id: "other",
      platform: "reddit",
      content: "Bodrum su kesintisi",
      sentiment: "negative",
      district: "Bodrum",
      published_at: "2026-11-28T11:30:00.000Z",
    });
    const filters: SocialFilters = {
      ...defaults,
      platform: "twitter",
      sentiment: "negative",
      region: "Bodrum",
      dateRange: "1h",
      keyword: "WATER",
    };

    expect(filterSocialAnalyses([recent, old, otherPlatform], filters, null, now)).toEqual([recent]);
  });

  it("builds the chart and map from the exact filtered dataset", () => {
    const filtered = filterSocialAnalyses([
      normalizeSocialPost({
        id: "in-scope",
        platform: "twitter",
        content: "Bodrum sakin",
        sentiment: "positive",
        district: "Bodrum",
        published_at: "2026-11-28T11:30:00.000Z",
      }),
      normalizeSocialPost({
        id: "out-of-scope",
        platform: "reddit",
        content: "Marmaris yoğun",
        sentiment: "negative",
        district: "Marmaris",
        published_at: "2026-11-28T11:30:00.000Z",
      }),
    ], { ...defaults, platform: "twitter" }, null, now);
    const history = buildSentimentHistory(filtered);
    const map = generateRegionMapData(filtered);

    expect(history.platforms).toHaveLength(1);
    expect(history.platforms[0]).toMatchObject({ platform: "twitter", positive: 1, total: 1 });
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({ name: "Bodrum", mentionCount: 1, sentiment: "positive" });
  });
});
