import { supabase } from "@/integrations/supabase/client";

export type DataCategory =
  | "weather" | "economy" | "tourism" | "environment"
  | "transport" | "social" | "security" | "energy"
  | "demographics" | "health" | "agriculture" | "culture";

export interface IntelligenceData {
  category: DataCategory;
  timestamp: number;
  data: any;
  isLive: boolean;
  source?: string;
}

export interface AnomalyAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: DataCategory;
  title: string;
  description: string;
  timestamp: number;
  metadata?: any;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class IntelligenceHub {
  private isRunning = false;
  private dataCache: Map<DataCategory, CacheEntry> = new Map();
  private anomalyAlerts: AnomalyAlert[] = [];
  private subscribers: Map<DataCategory, Set<Function>> = new Map();
  private anomalySubscribers: Set<Function> = new Set();
  private refreshIntervals: Map<DataCategory, NodeJS.Timeout> = new Map();

  private categoryTTL: Record<DataCategory, number> = {
    weather: 15 * 60 * 1000,
    economy: 30 * 60 * 1000,
    tourism: 60 * 60 * 1000,
    environment: 20 * 60 * 1000,
    transport: 10 * 60 * 1000,
    social: 5 * 60 * 1000,
    security: 30 * 60 * 1000,
    energy: 15 * 60 * 1000,
    demographics: 24 * 60 * 60 * 1000,
    health: 60 * 60 * 1000,
    agriculture: 60 * 60 * 1000,
    culture: 24 * 60 * 60 * 1000,
  };

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("Intelligence Hub started");

    this.loadFromCache();
    this.initializeAnomalyDetectors();
    this.startDataCollection();
  }

  stop() {
    this.isRunning = false;
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
    console.log("Intelligence Hub stopped");
  }

  private loadFromCache() {
    const categories: DataCategory[] = [
      "weather", "economy", "tourism", "environment",
      "transport", "social", "security", "energy",
      "demographics", "health", "agriculture", "culture"
    ];

    categories.forEach(category => {
      try {
        const cached = localStorage.getItem(`ih_${category}`);
        if (cached) {
          const entry = JSON.parse(cached);
          if (Date.now() - entry.timestamp < entry.ttl) {
            this.dataCache.set(category, entry);
            this.notifySubscribers(category, entry.data, false);
          } else {
            localStorage.removeItem(`ih_${category}`);
          }
        }
      } catch (err) {
        console.error(`Failed to load cache for ${category}:`, err);
      }
    });
  }

  private startDataCollection() {
    const categories: DataCategory[] = [
      "weather", "economy", "tourism", "environment",
      "transport", "social", "security", "energy",
      "demographics", "health", "agriculture", "culture"
    ];

    categories.forEach(category => {
      this.fetchAndCacheData(category);

      const interval = setInterval(() => {
        if (this.isRunning) {
          this.fetchAndCacheData(category);
        }
      }, this.categoryTTL[category]);

      this.refreshIntervals.set(category, interval);
    });
  }

  // ── Edge Function routing ──────────────────────────────────────────────────
  // reference-data: demographics, health, agriculture, culture
  // data-scrape: weather, air_quality, earthquakes, economy, news,
  //              trends, dams, tourism, energy, real_estate, road_works
  // social  → query social_posts DB (no Edge Function call)
  // security → no handler yet; skip silently
  // environment → alias to air_quality
  // transport → alias to road_works

  private static readonly REFERENCE_CATEGORIES = new Set<DataCategory>([
    "demographics", "health", "agriculture", "culture",
  ]);

  private static readonly SCRAPE_ALIAS: Partial<Record<DataCategory, string>> = {
    environment: "air_quality",
    transport: "road_works",
  };

  private async fetchSocialFromDB(): Promise<any> {
    const { data } = await supabase
      .from("social_posts")
      .select("platform,sentiment,content,author,url,published_at,keywords_matched")
      .order("published_at", { ascending: false })
      .limit(100);
    const posts = data ?? [];
    return {
      posts,
      total: posts.length,
      negative: posts.filter((p: any) => p.sentiment === "negative").length,
      positive: posts.filter((p: any) => p.sentiment === "positive").length,
      neutral: posts.filter((p: any) => p.sentiment === "neutral").length,
    };
  }

  private async fetchAndCacheData(category: DataCategory) {
    try {
      // social: read from DB directly
      if (category === "social") {
        const socialData = await this.fetchSocialFromDB().catch(() => null);
        if (!socialData) return;
        const intel: IntelligenceData = {
          category, timestamp: Date.now(), data: socialData, isLive: true,
        };
        this.cacheData(intel);
        this.notifySubscribers(category, socialData, true);
        return;
      }

      // security: no backend yet
      if (category === "security") return;

      const functionName = IntelligenceHub.REFERENCE_CATEGORIES.has(category)
        ? "reference-data"
        : "data-scrape";
      const typeParam = (IntelligenceHub.SCRAPE_ALIAS as Record<string, string>)[category] ?? category;

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { type: typeParam },
      });

      if (error) {
        console.error(`Data fetch error for ${category}:`, error);
        return;
      }

      const intelligenceData: IntelligenceData = {
        category,
        timestamp: Date.now(),
        data: data?.data ?? data,
        isLive: true,
      };

      this.cacheData(intelligenceData);
      this.analyzeForAnomalies(intelligenceData);
      this.notifySubscribers(category, intelligenceData.data, true);
    } catch (err) {
      console.error(`Error fetching data for ${category}:`, err);
    }
  }

  private cacheData(intelligence: IntelligenceData) {
    const ttl = this.categoryTTL[intelligence.category];
    const entry: CacheEntry = {
      data: intelligence.data,
      timestamp: intelligence.timestamp,
      ttl,
    };

    this.dataCache.set(intelligence.category, entry);

    try {
      localStorage.setItem(
        `ih_${intelligence.category}`,
        JSON.stringify(entry)
      );
    } catch (err) {
      console.error(`Failed to cache ${intelligence.category}:`, err);
    }
  }

  private initializeAnomalyDetectors() {
    // Baseline anomaly detection thresholds
    this.anomalyAlerts = [];
  }

  private analyzeForAnomalies(intelligence: IntelligenceData) {
    const alerts: AnomalyAlert[] = [];

    switch (intelligence.category) {
      case "weather":
        if (intelligence.data?.humidity < 15) {
          alerts.push({
            id: `weather_${Date.now()}`,
            severity: "critical",
            category: "weather",
            title: "Kritik Nem Seviyeleri Tespit Edildi",
            description: `Nem oranı çok düşük: ${intelligence.data?.humidity}%. Yangın riski yüksek.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        if (intelligence.data?.temperature > 40) {
          alerts.push({
            id: `weather_temp_${Date.now()}`,
            severity: "warning",
            category: "weather",
            title: "Yüksek Sıcaklık Uyarısı",
            description: `Sıcaklık ${intelligence.data?.temperature}°C'ye ulaştı.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "social":
        if (intelligence.data?.crisis_mentions > 10) {
          alerts.push({
            id: `social_crisis_${Date.now()}`,
            severity: "critical",
            category: "social",
            title: "Sosyal Kriz Sinyalleri",
            description: `Sosyal medyada ${intelligence.data?.crisis_mentions} kriz belirteci tespit edildi.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "security":
        if (intelligence.data?.threat_level > 7) {
          alerts.push({
            id: `security_threat_${Date.now()}`,
            severity: "critical",
            category: "security",
            title: "Güvenlik Tehdidi Seviyesi Yüksek",
            description: `Tehdit seviyesi ${intelligence.data?.threat_level}/10 olarak tespit edildi.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "environment":
        if (intelligence.data?.aqi > 150) {
          alerts.push({
            id: `env_aqi_${Date.now()}`,
            severity: "warning",
            category: "environment",
            title: "Hava Kalitesi Düşürüldü",
            description: `Hava Kalitesi Endeksi ${intelligence.data?.aqi} - Sağlık riski.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "economy":
        if (intelligence.data?.unemployment_rate > 15) {
          alerts.push({
            id: `eco_unemployment_${Date.now()}`,
            severity: "warning",
            category: "economy",
            title: "İşsizlik Oranı Arttı",
            description: `İşsizlik oranı ${intelligence.data?.unemployment_rate}% olarak kaydedildi.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "transport":
        if (intelligence.data?.traffic_density > 0.8) {
          alerts.push({
            id: `transport_traffic_${Date.now()}`,
            severity: "warning",
            category: "transport",
            title: "Ağır Trafik Uyarısı",
            description: `Trafik yoğunluğu kritik seviyede (${(intelligence.data?.traffic_density * 100).toFixed(0)}%).`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "energy":
        if (intelligence.data?.consumption_peak > 0.95) {
          alerts.push({
            id: `energy_peak_${Date.now()}`,
            severity: "warning",
            category: "energy",
            title: "Enerji Tüketim Zirve",
            description: `Enerji tüketimi zirve kapasitesine yakın (${(intelligence.data?.consumption_peak * 100).toFixed(0)}%).`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;
    }

    alerts.forEach(alert => this.addAnomalyAlert(alert));
  }

  private addAnomalyAlert(alert: AnomalyAlert) {
    this.anomalyAlerts.unshift(alert);
    if (this.anomalyAlerts.length > 50) {
      this.anomalyAlerts.pop();
    }

    this.notifyAnomalySubscribers(alert);
    this.persistAnomalyAlert(alert);
  }

  private persistAnomalyAlert(alert: AnomalyAlert) {
    try {
      const stored = localStorage.getItem("ih_anomalies");
      const alerts = stored ? JSON.parse(stored) : [];
      alerts.unshift(alert);
      if (alerts.length > 100) alerts.pop();
      localStorage.setItem("ih_anomalies", JSON.stringify(alerts));
    } catch (err) {
      console.error("Failed to persist anomaly alert:", err);
    }
  }

  subscribe(category: DataCategory, callback: (data: any, isLive: boolean) => void) {
    if (!this.subscribers.has(category)) {
      this.subscribers.set(category, new Set());
    }
    this.subscribers.get(category)!.add(callback);

    return () => {
      this.subscribers.get(category)?.delete(callback);
    };
  }

  subscribeToAnomalies(callback: (alert: AnomalyAlert) => void) {
    this.anomalySubscribers.add(callback);
    return () => {
      this.anomalySubscribers.delete(callback);
    };
  }

  private notifySubscribers(category: DataCategory, data: any, isLive: boolean) {
    const subscribers = this.subscribers.get(category);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data, isLive);
        } catch (err) {
          console.error("Subscriber error:", err);
        }
      });
    }
  }

  private notifyAnomalySubscribers(alert: AnomalyAlert) {
    this.anomalySubscribers.forEach(callback => {
      try {
        callback(alert);
      } catch (err) {
        console.error("Anomaly subscriber error:", err);
      }
    });
  }

  getData(category: DataCategory) {
    return this.dataCache.get(category)?.data ?? null;
  }

  getAnomalies(filter?: { severity?: string; category?: DataCategory }) {
    let alerts = [...this.anomalyAlerts];

    if (filter?.severity) {
      alerts = alerts.filter(a => a.severity === filter.severity);
    }
    if (filter?.category) {
      alerts = alerts.filter(a => a.category === filter.category);
    }

    return alerts;
  }

  clearAnomalies() {
    this.anomalyAlerts = [];
    localStorage.removeItem("ih_anomalies");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      cachedCategories: Array.from(this.dataCache.keys()),
      activeAnomalies: this.anomalyAlerts.length,
    };
  }
}

export const intelligenceHub = new IntelligenceHub();
