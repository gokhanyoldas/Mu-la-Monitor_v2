// cache-manager.test.ts — gerçek CacheManager unit testleri
// (el yazımı kopya yerine @ alias üzerinden gerçek sınıfı test eder)
import { describe, it, expect, beforeEach } from "vitest";
import { cacheManager as cache } from "@/lib/cache-manager";

const TTL_SHORT = 100;

describe("CacheManager", () => {
  beforeEach(() => { localStorage.clear(); });

  it("veri yazar ve okur", () => {
    cache.set("weather", { temp: 28 }); expect(cache.get("weather")).toEqual({ temp: 28 });
  });
  it("TTL dolunca null döner", async () => {
    cache.set("news", ["item1"], TTL_SHORT);
    await new Promise((r) => setTimeout(r, TTL_SHORT + 10));
    expect(cache.get("news")).toBeNull();
  });
  it("isFresh — taze veri için true", () => {
    cache.set("flights", [1, 2, 3], 5000); expect(cache.isFresh("flights")).toBe(true);
  });
  it("isFresh — süresi dolmuş veri için false", async () => {
    cache.set("flights", [1, 2, 3], TTL_SHORT);
    await new Promise((r) => setTimeout(r, TTL_SHORT + 10));
    expect(cache.isFresh("flights")).toBe(false);
  });
  it("getMeta ageMs pozitif değer döner", () => {
    cache.set("eq", { mag: 3.2 });
    const meta = cache.getMeta<{ mag: number }>("eq");
    expect(meta).not.toBeNull(); expect(meta!.ageMs).toBeGreaterThanOrEqual(0); expect(meta!.data.mag).toBe(3.2);
  });
  it("delete anahtarı siler", () => {
    cache.set("test", "value"); cache.delete("test"); expect(cache.get("test")).toBeNull();
  });
  it("Infinity TTL asla expire olmaz", async () => {
    cache.set("lang", "tr", Infinity);
    await new Promise((r) => setTimeout(r, 50));
    expect(cache.get("lang")).toBe("tr");
  });
  it("stats total/expired sayılarını döner", async () => {
    cache.set("a", 1, 5000); cache.set("b", 2, TTL_SHORT);
    await new Promise((r) => setTimeout(r, TTL_SHORT + 10));
    const { totalKeys, expiredKeys } = cache.stats();
    expect(totalKeys).toBe(2); expect(expiredKeys).toBe(1);
  });
});
