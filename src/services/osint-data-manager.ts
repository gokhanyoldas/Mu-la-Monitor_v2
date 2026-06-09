import { dataQualityTracker } from "@/lib/data-quality";

export interface IntelligenceItem {
  id: string;
  title: string;
  source: string;
  category: "news" | "social" | "alert" | "threat" | "opportunity";
  sentiment: "positive" | "neutral" | "negative" | "critical";
  importance: "critical" | "high" | "medium" | "low";
  date: number;
  content?: string;
  link?: string;
  location?: string;
  tags: string[];
  confidence: number;
}

export interface DataSourceConfig {
  name: string;
  type: "rss" | "gmail" | "api" | "manual";
  isFree: boolean;
  refreshMinutes: number;
  url?: string;
  endpoint?: string;
}

class OsintDataManager {
  private feeds: Map<string, IntelligenceItem[]> = new Map();
  private sources: Map<string, DataSourceConfig> = new Map();
  private cacheKey = "osint_feeds";
  private retryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
  };

  constructor() {
    this.initializeSources();
    this.loadFromCache();
  }

  private initializeSources() {
    this.sources.set("google_alerts", {
      name: "Google Alerts (Gmail)",
      type: "gmail",
      isFree: true,
      refreshMinutes: 5,
      endpoint: "https://mail.google.com/mail/feed/atom",
    });

    this.sources.set("rss_news", {
      name: "RSS News Feeds",
      type: "rss",
      isFree: true,
      refreshMinutes: 15,
      url: "https://news.google.com/rss",
    });

    this.sources.set("twitter_x", {
      name: "X (Twitter) - Trending",
      type: "api",
      isFree: false,
      refreshMinutes: 5,
    });

    this.sources.set("talkwalker", {
      name: "Talkwalker Alerts",
      type: "api",
      isFree: false,
      refreshMinutes: 10,
    });

    this.sources.set("manual_input", {
      name: "Manual Intelligence Input",
      type: "manual",
      isFree: true,
      refreshMinutes: 0,
    });
  }

  async fetchIntelligenceWithRetry(
    sourceId: string,
    fetchFn: () => Promise<IntelligenceItem[]>,
    timeout = 10000
  ): Promise<{ success: boolean; data?: IntelligenceItem[]; error?: string }> {
    let lastError: string = "";
    let delay = this.retryConfig.initialDelay;

    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise<IntelligenceItem[]>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeout)
        );

        const data = await Promise.race([fetchFn(), timeoutPromise]);

        if (data && Array.isArray(data)) {
          dataQualityTracker.registerDataFetch(sourceId, sourceId, true);
          return { success: true, data };
        }

        throw new Error("Invalid data format");
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);

        if (attempt < this.retryConfig.maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= this.retryConfig.backoffMultiplier;
        }
      }
    }

    dataQualityTracker.registerDataFetch(sourceId, sourceId, false, lastError);
    return {
      success: false,
      error: lastError,
    };
  }

  addIntelligenceItem(sourceId: string, items: IntelligenceItem[]) {
    if (!this.feeds.has(sourceId)) {
      this.feeds.set(sourceId, []);
    }

    const feed = this.feeds.get(sourceId)!;
    items.forEach((item) => {
      const exists = feed.some((i) => i.id === item.id);
      if (!exists) {
        feed.unshift(item);
      }
    });

    if (feed.length > 100) {
      feed.splice(100);
    }

    this.persistFeeds();
  }

  private persistFeeds() {
    try {
      const data = Object.fromEntries(this.feeds);
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (err) {
      console.error("Failed to persist OSINT feeds:", err);
    }
  }

  private loadFromCache() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        Object.entries(data).forEach(([key, value]) => {
          this.feeds.set(key, value as IntelligenceItem[]);
        });
      }
    } catch (err) {
      console.error("Failed to load OSINT feeds from cache:", err);
    }
  }

  getIntelligenceFeed(sourceId?: string): IntelligenceItem[] {
    if (sourceId) {
      return this.feeds.get(sourceId) || [];
    }

    const allItems: IntelligenceItem[] = [];
    this.feeds.forEach((items) => {
      allItems.push(...items);
    });

    return allItems.sort((a, b) => b.date - a.date);
  }

  filterByImportance(importance: string[]): IntelligenceItem[] {
    return this.getIntelligenceFeed().filter((item) =>
      importance.includes(item.importance)
    );
  }

  filterBySentiment(sentiment: string[]): IntelligenceItem[] {
    return this.getIntelligenceFeed().filter((item) =>
      sentiment.includes(item.sentiment)
    );
  }

  searchIntelligence(query: string): IntelligenceItem[] {
    const q = query.toLowerCase();
    return this.getIntelligenceFeed().filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.content?.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q)) ||
        item.source.toLowerCase().includes(q)
    );
  }

  getSourceStats() {
    const stats: Record<string, number> = {};
    this.feeds.forEach((items, sourceId) => {
      stats[sourceId] = items.length;
    });
    return stats;
  }

  getCriticalItems(): IntelligenceItem[] {
    return this.getIntelligenceFeed().filter(
      (item) =>
        item.importance === "critical" || item.sentiment === "critical"
    );
  }

  clearOldItems(olderThanHours: number = 24) {
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    this.feeds.forEach((items, sourceId) => {
      const filtered = items.filter((item) => item.date > cutoff);
      this.feeds.set(sourceId, filtered);
    });
    this.persistFeeds();
  }

  getSources() {
    return Array.from(this.sources.entries()).map(([id, config]) => ({
      id,
      ...config,
    }));
  }

  getSourceConfig(sourceId: string) {
    return this.sources.get(sourceId);
  }

  addManualIntelligence(item: Omit<IntelligenceItem, "id" | "date">) {
    const newItem: IntelligenceItem = {
      ...item,
      id: `manual_${Date.now()}`,
      date: Date.now(),
    };

    this.addIntelligenceItem("manual_input", [newItem]);
    return newItem;
  }

  clearAllFeeds() {
    this.feeds.clear();
    localStorage.removeItem(this.cacheKey);
  }

  getHealthStatus() {
    const status: Record<string, any> = {};
    this.feeds.forEach((items, sourceId) => {
      const source = this.sources.get(sourceId);
      status[sourceId] = {
        name: source?.name || sourceId,
        itemCount: items.length,
        lastUpdate: items.length > 0 ? items[0].date : null,
        isFree: source?.isFree ?? false,
      };
    });
    return status;
  }
}

export const osintDataManager = new OsintDataManager();
