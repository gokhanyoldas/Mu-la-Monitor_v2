import { describe, it, expect, vi, afterEach } from "vitest";
import {
  backoffDelayMs,
  fetchWithRetry,
  mapWithConcurrency,
} from "../../supabase/functions/_shared/fetch";

describe("Scraper Resilience — _shared/fetch.ts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mapWithConcurrency (bounded concurrency)", () => {
    it("sonuçları girdi sırasıyla döner ve eşzamanlılığı limitin üstüne çıkarmaz", async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const items = Array.from({ length: 10 }, (_, i) => i);

      const results = await mapWithConcurrency(items, 3, async (n) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return n * 2;
      });

      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
      expect(maxInFlight).toBeLessThanOrEqual(3);
      expect(maxInFlight).toBeGreaterThan(1);
    });

    it("boş liste ve geçersiz limit durumlarında güvenli çalışır", async () => {
      expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
      const single = await mapWithConcurrency([42], 0, async (n) => n + 1);
      expect(single).toEqual([43]);
    });
  });

  describe("backoffDelayMs (exponential + jitter)", () => {
    it("üstel artar ve üst sınırı aşmaz", () => {
      const a1 = backoffDelayMs(1, 400, 8_000);
      expect(a1).toBeGreaterThanOrEqual(200);
      expect(a1).toBeLessThanOrEqual(400);

      const a10 = backoffDelayMs(10, 400, 8_000);
      expect(a10).toBeLessThanOrEqual(8_000);
      expect(a10).toBeGreaterThanOrEqual(4_000);
    });
  });

  describe("fetchWithRetry (timeout + retry on transient failures)", () => {
    it("geçici 5xx hatasında yeniden dener ve başarıyla döner", async () => {
      let calls = 0;
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        calls++;
        if (calls < 3) {
          return { ok: false, status: 503, text: async () => "busy" } as Response;
        }
        return { ok: true, status: 200, text: async () => "<rss>ok</rss>" } as Response;
      });

      const outcome = await fetchWithRetry("https://example.com/feed", {
        retries: 2,
        baseDelayMs: 1,
        maxDelayMs: 2,
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.status).toBe(200);
      expect(outcome.body).toBe("<rss>ok</rss>");
      expect(outcome.attempts).toBe(3);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("kalıcı 4xx hatasında yeniden denemez (tek deneme)", async () => {
      let calls = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        calls++;
        return { ok: false, status: 404, text: async () => "not found" } as Response;
      });

      const outcome = await fetchWithRetry("https://example.com/missing", {
        retries: 3,
        baseDelayMs: 1,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.status).toBe(404);
      expect(calls).toBe(1);
    });

    it("ağ hatasında (throw) yeniden dener ve hatalı sonuç döner (fırlatmaz)", async () => {
      let calls = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        calls++;
        throw new Error("network down");
      });

      const outcome = await fetchWithRetry("https://example.com/down", {
        retries: 1,
        baseDelayMs: 1,
        maxDelayMs: 2,
      });

      expect(outcome.ok).toBe(false);
      expect(outcome.status).toBe(0);
      expect(outcome.attempts).toBe(2);
      expect(calls).toBe(2);
      expect(outcome.error).toContain("network down");
    });
  });
});
