// cache-manager.ts
// Centralized localStorage management with TTL, versioning, and namespacing.
// Replaces 15 scattered localStorage usages across the app.

const CACHE_VERSION = "v1";
const CACHE_PREFIX = `mugla_monitor_${CACHE_VERSION}_`;

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

// TTL presets (ms)
export const TTL = {
  REALTIME: 1 * 60 * 1000,        //  1 min  — deprem, yangın
  SHORT: 5 * 60 * 1000,           //  5 min  — hava, uçuş
  MEDIUM: 15 * 60 * 1000,         // 15 min  — haber, sosyal
  LONG: 60 * 60 * 1000,           //  1 hr   — döviz, turizm
  DAILY: 24 * 60 * 60 * 1000,     //  1 day  — demografi, referans
  PERMANENT: Infinity,            //  —      — kullanıcı tercihleri
} as const;

export const CACHE_KEYS = {
  WEATHER: "weather",
  AIR_QUALITY: "air_quality",
  EARTHQUAKES: "earthquakes",
  FLIGHTS: "flights",
  BUS_SCHEDULE: "bus_schedule",
  ECONOMY: "economy",
  NEWS: "news",
  SOCIAL_FEED: "social_feed",
  FOREST_FIRE: "forest_fire",
  TRAFFIC: "traffic",
  TOURISM_FORECAST: "tourism_forecast",
  LANGUAGE: "user_language",
  THEME: "user_theme",
  DASHBOARD_LAYOUT: "dashboard_layout",
  DISMISSED_ALERTS: "dismissed_alerts",
  OSINT_SCAN_RESULTS: "osint_scan_results",
} as const;

export type CacheKey = (typeof CACHE_KEYS)[keyof typeof CACHE_KEYS];

class CacheManager {
  private prefix: string;
  constructor(prefix = CACHE_PREFIX) { this.prefix = prefix; }
  private buildKey(key: string): string { return `${this.prefix}${key}`; }

  set<T>(key: string, data: T, ttl: number = TTL.MEDIUM): void {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
      localStorage.setItem(this.buildKey(key), JSON.stringify(entry));
    } catch (e) {
      console.warn("[CacheManager] write failed:", key, e);
    }
  }

  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.buildKey(key));
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.ttl !== Infinity && Date.now() - entry.timestamp > entry.ttl) {
        this.delete(key); return null;
      }
      return entry.data;
    } catch { return null; }
  }

  getMeta<T>(key: string): { data: T; ageMs: number } | null {
    try {
      const raw = localStorage.getItem(this.buildKey(key));
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.ttl !== Infinity && Date.now() - entry.timestamp > entry.ttl) {
        this.delete(key); return null;
      }
      return { data: entry.data, ageMs: Date.now() - entry.timestamp };
    } catch { return null; }
  }

  isFresh(key: string): boolean { return this.get(key) !== null; }
  delete(key: string): void { localStorage.removeItem(this.buildKey(key)); }

  invalidateDataFeeds(): void {
    const preferenceKeys = [CACHE_KEYS.LANGUAGE, CACHE_KEYS.THEME, CACHE_KEYS.DASHBOARD_LAYOUT];
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.prefix)) {
        const shortKey = k.slice(this.prefix.length);
        if (!preferenceKeys.includes(shortKey as CacheKey)) toDelete.push(k);
      }
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  }

  clearAll(): void {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.prefix)) toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  }

  migrateOldKeys(): void {
    const legacyMappings: Record<string, string> = {
      language: CACHE_KEYS.LANGUAGE,
      theme: CACHE_KEYS.THEME,
      dismissedAlerts: CACHE_KEYS.DISMISSED_ALERTS,
    };
    Object.entries(legacyMappings).forEach(([oldKey, newKey]) => {
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        try { this.set(newKey, JSON.parse(val), TTL.PERMANENT); }
        catch { this.set(newKey, val, TTL.PERMANENT); }
        localStorage.removeItem(oldKey);
      }
    });
  }

  stats(): { totalKeys: number; expiredKeys: number; sizeKB: number } {
    let totalKeys = 0, expiredKeys = 0, sizeBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(this.prefix)) continue;
      totalKeys++;
      const raw = localStorage.getItem(k) ?? "";
      sizeBytes += raw.length * 2;
      try {
        const entry = JSON.parse(raw) as CacheEntry<unknown>;
        if (entry.ttl !== Infinity && Date.now() - entry.timestamp > entry.ttl) expiredKeys++;
      } catch { /* corrupt */ }
    }
    return { totalKeys, expiredKeys, sizeKB: Math.round(sizeBytes / 1024) };
  }
}

export const cacheManager = new CacheManager();
cacheManager.migrateOldKeys();
