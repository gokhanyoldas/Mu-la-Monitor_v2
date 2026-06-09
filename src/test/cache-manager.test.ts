// cache-manager.test.ts — CacheManager unit tests (8 test cases)
import { describe, it, expect, beforeEach } from "vitest";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

const TTL_SHORT = 100;
class CacheManager {
  constructor(private prefix = "test_") {}
  private k(key: string) { return `${this.prefix}${key}`; }
  set<T>(key: string, data: T, ttl = 5000): void {
    localStorage.setItem(this.k(key), JSON.stringify({ data, timestamp: Date.now(), ttl }));
  }
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.k(key)); if (!raw) return null;
      const { data, timestamp, ttl } = JSON.parse(raw);
      if (ttl !== Infinity && Date.now() - timestamp > ttl) { this.delete(key); return null; }
      return data as T;
    } catch { return null; }
  }
  getMeta<T>(key: string): { data: T; ageMs: number } | null {
    try {
      const raw = localStorage.getItem(this.k(key)); if (!raw) return null;
      const { data, timestamp, ttl } = JSON.parse(raw);
      if (ttl !== Infinity && Date.now() - timestamp > ttl) { this.delete(key); return null; }
      return { data: data as T, ageMs: Date.now() - timestamp };
    } catch { return null; }
  }
  isFresh(key: string): boolean { return this.get(key) !== null; }
  delete(key: string): void { localStorage.removeItem(this.k(key)); }
  stats() {
    let total = 0, expired = 0, bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k?.startsWith(this.prefix)) continue;
      total++; const raw = localStorage.getItem(k) ?? ""; bytes += raw.length * 2;
      try { const { timestamp, ttl } = JSON.parse(raw); if (ttl !== Infinity && Date.now() - timestamp > ttl) expired++; } catch {}
    }
    return { totalKeys: total, expiredKeys: expired, sizeKB: Math.round(bytes / 1024) };
  }
}

describe("CacheManager", () => {
  let cache: CacheManager;
  beforeEach(() => { localStorageMock.clear(); cache = new CacheManager("test_"); });

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
