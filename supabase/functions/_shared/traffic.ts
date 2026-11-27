export interface TrafficSocialPost {
  content?: string | null;
  platform?: string | null;
  url?: string | null;
  district?: string | null;
  published_at?: string | null;
}

export interface TrafficNewsItem {
  district: string | null;
  text: string;
  source: string;
  link: string | null;
  published_at: string;
}

export interface TrafficHotspot {
  name: string;
  lat?: number;
  lon?: number;
  density: number;
  [key: string]: unknown;
}

function safeHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function toTrafficNewsItem(post: TrafficSocialPost): TrafficNewsItem | null {
  const text = String(post.content ?? "").trim();
  const publishedAt = String(post.published_at ?? "").trim();
  if (!text || !publishedAt) return null;
  return {
    district: post.district?.trim() || null,
    text: text.slice(0, 600),
    source: post.platform?.trim() || "Sosyal medya",
    link: safeHttpUrl(post.url),
    published_at: publishedAt,
  };
}

export function isTrafficNews(item: TrafficNewsItem, keywords: string[]): boolean {
  const text = item.text.toLocaleLowerCase("tr-TR");
  return keywords.some((keyword) => {
    const escaped = keyword.toLocaleLowerCase("tr-TR").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "u").test(text);
  });
}

export function mergeTrafficHotspots(
  expectedDistricts: TrafficHotspot[],
  freshHotspots: TrafficHotspot[],
  previousHotspots: TrafficHotspot[],
  fetchedAt: string,
) {
  const freshByDistrict = new Map(freshHotspots.map((hotspot) => [hotspot.name, hotspot]));
  const previousByDistrict = new Map(previousHotspots.map((hotspot) => [hotspot.name, hotspot]));
  const hotspots = expectedDistricts.flatMap((district) => {
    const fresh = freshByDistrict.get(district.name);
    if (fresh) return [{ ...district, ...fresh, stale: false, fetched_at: fetchedAt }];
    const previous = previousByDistrict.get(district.name);
    return previous ? [{ ...district, ...previous, stale: true }] : [];
  });
  const freshDistricts = expectedDistricts
    .filter((district) => freshByDistrict.has(district.name))
    .map((district) => district.name);
  const staleDistricts = hotspots.filter((hotspot) => hotspot.stale).map((hotspot) => hotspot.name);
  const missingDistricts = expectedDistricts
    .filter((district) => !freshByDistrict.has(district.name) && !previousByDistrict.has(district.name))
    .map((district) => district.name);

  return {
    hotspots,
    coverage: {
      expected: expectedDistricts.length,
      fresh: freshDistricts.length,
      stale: staleDistricts.length,
      missing: missingDistricts.length,
      fresh_districts: freshDistricts,
      stale_districts: staleDistricts,
      missing_districts: missingDistricts,
    },
  };
}
