import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/notification-service";
import { subscribeToRealtimeTable } from "@/lib/supabase-realtime-singleton";

export type DataCategory =
  | "weather" | "economy" | "tourism" | "environment"
  | "transport" | "social" | "security" | "energy"
  | "demographics" | "health" | "agriculture" | "culture";

// Veri kökeni sözleşmesi: hiçbir türetilmiş çıktı, gerçek kaynağı olmadan
// "canlı istihbarat" gibi sunulmaz. Boşluklar açıkça "unavailable" işaretlenir.
export type DataProvenance = "live" | "cache" | "reference" | "unavailable";

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

export type SensitivityMode = "sensitive" | "balanced" | "high";

export interface FireProtocolStatus {
  isActive: boolean;
  isTriggered: boolean;
  riskScore: number | null;
  riskLevel: "Düşük" | "Orta" | "Yüksek" | "Kritik" | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  thresholds: {
    tempThreshold: number;
    humidityThreshold: number;
    windThreshold: number;
  };
  actionsTaken: string[];
  lastEvaluatedAt: number;
  provenance: DataProvenance;
}

export interface IntegratedMobilityData {
  timestamp: number;
  provenance: DataProvenance;
  corridors: Array<{
    id: string;
    corridor: string;
    trafficDensity: number;
    hotelOccupancy: number | null;
    pressureScore: number;
    status: "normal" | "dense" | "critical";
    recommendation: string;
  }>;
  averagePressure: number | null;
  activeHotspotsCount: number;
  smartRoutingDirective: string;
}

export interface DailyEconomicSummary {
  date: string;
  generatedAt: number;
  provenance: DataProvenance;
  summary: string;
  macroIndicators: Array<{ name: string; value: string; change?: string; note: string }>;
  localIndicators: Array<{ name: string; value: string; note: string }>;
  sectorNotes: Array<{ title: string; detail: string; status: "positive" | "warning" | "neutral" }>;
  recommendations: string[];
}

export interface PresidentialBriefing {
  id: string;
  date: string;
  time: string;
  targetOffice: string;
  executiveSummary: string;
  urgencyLevel: "Normal" | "Dikkat" | "Teyakkuz" | "Kritik";
  provenance: DataProvenance;
  weatherAndFire: {
    temp: number | null;
    humidity: number | null;
    wind: number | null;
    fireRiskScore: number | null;
    fireRiskLevel: string | null;
  };
  waterAndDams: {
    avgOccupancy: number | null;
    damCount: number;
    outlook: string;
  };
  transportAndMobility: {
    congestionAvg: number | null;
    activeCorridorsCount: number;
    chokePoints: string[];
  };
  economyAndTourism: {
    usdTry: string;
    eurTry: string;
    hotelOccupancy: number | null;
    annualTourismEst: string;
  };
  socialPulse: {
    topIssues: string[];
    sentimentSummary: string;
  };
  actionDirectives: string[];
  generatedAt: number;
}

export interface MLModelSnapshot {
  version: string;
  lastTrainedAt: number;
  sensitivity: SensitivityMode;
  categoriesTrained: number;
  sampleSize: number;
  provenance: DataProvenance;
  baselines: Record<string, { mean: number | null; stdDev: number | null; threshold: number }>;
}

export interface RealtimeSocialStatus {
  isConnected: boolean;
  provenance: DataProvenance;
  activeKeywords: string[];
  pollIntervalSec: number;
  recentPostCount: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  lastSyncAt: number;
}

class IntelligenceHub {
  private isRunning = false;
  private dataCache: Map<DataCategory, CacheEntry> = new Map();
  private anomalyAlerts: AnomalyAlert[] = [];
  private subscribers: Map<DataCategory, Set<Function>> = new Map();
  private anomalySubscribers: Set<Function> = new Set();
  private refreshIntervals: Map<DataCategory, NodeJS.Timeout> = new Map();
  private anomalyUnsubscribe: (() => void) | null = null;
  private socialRealtimeUnsubscribe: (() => void) | null = null;
  private sensitivityMode: SensitivityMode = "balanced";
  private isSocialRealtimeActive = false;
  private fireProtocolAutomationActive = false;

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
    this.syncServerAnomalies();
  }

  stop() {
    this.isRunning = false;
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
    if (this.anomalyUnsubscribe) {
      this.anomalyUnsubscribe();
      this.anomalyUnsubscribe = null;
    }
    if (this.socialRealtimeUnsubscribe) {
      this.socialRealtimeUnsubscribe();
      this.socialRealtimeUnsubscribe = null;
    }
    console.log("Intelligence Hub stopped");
  }

  // ── Server-side anomaly engine (anomaly-scan edge function) ─────────────
  // Loads active anomalies once, then streams updates via Realtime so
  // server-detected anomalies appear even while the user is idle.
  private syncServerAnomalies() {
    const toAlert = (row: any): AnomalyAlert => ({
      id: `db_${row.id}`,
      severity: row.severity,
      category: row.category,
      title: row.title,
      description: row.description ?? "",
      timestamp: new Date(row.detected_at).getTime(),
      metadata: { value: row.value_num, baseline: row.baseline_num, source: "anomaly-scan" },
    });

    const ingest = (alert: AnomalyAlert) => {
      const existing = this.anomalyAlerts.findIndex(a => a.id === alert.id);
      if (existing >= 0) {
        this.anomalyAlerts[existing] = alert;
      } else {
        this.anomalyAlerts.unshift(alert);
        if (this.anomalyAlerts.length > 50) this.anomalyAlerts.pop();
      }
      this.notifyAnomalySubscribers(alert);
    };

    supabase
      .from("anomaly_alerts")
      .select("*")
      .eq("is_active", true)
      .order("detected_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        data?.forEach(row => ingest(toAlert(row)));
      });

    if (this.anomalyUnsubscribe) {
      this.anomalyUnsubscribe();
    }
    this.anomalyUnsubscribe = subscribeToRealtimeTable("anomaly_alerts", (payload) => {
      const row = payload.new as any;
      if (!row?.id) return;
      if (row.is_active === false) {
        this.anomalyAlerts = this.anomalyAlerts.filter(a => a.id !== `db_${row.id}`);
        return;
      }
      const alert = toAlert(row);
      const isNew = !this.anomalyAlerts.some(a => a.id === alert.id);
      ingest(alert);
      // Critical server-side anomalies trigger a native notification (once)
      if (isNew && alert.severity === "critical") {
        notificationService.sendAlert({
          title: alert.title,
          body: alert.description,
          severity: "critical",
          tag: alert.id,
        });
      }
    });
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

      // transport: canlı live_data_cache kontrolü önceliklidir
      if (category === "transport") {
        try {
          const { data: cacheRow } = await supabase
            .from("live_data_cache")
            .select("data, fetched_at")
            .eq("data_type", "traffic_density")
            .maybeSingle();

          if (cacheRow?.data) {
            const intelligenceData: IntelligenceData = {
              category: "transport",
              timestamp: Date.now(),
              data: cacheRow.data,
              isLive: true,
              source: "live_data_cache",
            };
            this.cacheData(intelligenceData);
            this.notifySubscribers(category, intelligenceData.data, true);
            return;
          }
        } catch {
          // Edge Function çağrısına devam et
        }
      }

      const functionName = IntelligenceHub.REFERENCE_CATEGORIES.has(category)
        ? "reference-data"
        : "data-scrape";
      const typeParam = (IntelligenceHub.SCRAPE_ALIAS as Record<string, string>)[category] ?? category;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const cacheType = category === "transport" ? "traffic_density" : typeParam;
        const { data: cacheRow } = await supabase
          .from("live_data_cache")
          .select("data, fetched_at")
          .eq("data_type", cacheType)
          .maybeSingle();

        if (cacheRow?.data) {
          const intelligenceData: IntelligenceData = {
            category,
            timestamp: Date.now(),
            data: cacheRow.data,
            isLive: true,
            source: "live_data_cache",
          };
          this.cacheData(intelligenceData);
          this.notifySubscribers(category, intelligenceData.data, true);
          return;
        }

        const cached = this.dataCache.get(category);
        if (cached?.data) {
          this.notifySubscribers(category, cached.data, false);
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { type: typeParam },
      });

      if (error) {
        console.warn(`Data fetch notice for ${category}: ${error.message || "fetch failed"}`);
        const cached = this.dataCache.get(category);
        if (cached?.data) {
          this.notifySubscribers(category, cached.data, false);
          return;
        }

        if (category === "transport") {
          // Uydurma baz değer üretme: canlı veri ve önbellek yoksa açıkça "unavailable" bildir.
          const unavailableTransport = {
            hotspots: [],
            averageCongestion: null,
            activeCorridors: null,
            status: "unavailable",
            provenance: "unavailable" as const,
          };
          this.notifySubscribers(category, unavailableTransport, false);
        }
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
      console.warn(`Notice while fetching data for ${category}:`, err);
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
    const mode = this.sensitivityMode;

    // Eşik çarpanları: Hassas modda daha erken uyarı, Yüksek modda sadece ekstrem değerler
    const tempThreshold = mode === "sensitive" ? 34 : mode === "balanced" ? 38 : 42;
    const humidityThreshold = mode === "sensitive" ? 25 : mode === "balanced" ? 18 : 12;
    const trafficThreshold = mode === "sensitive" ? 0.65 : mode === "balanced" ? 0.78 : 0.88;
    const crisisThreshold = mode === "sensitive" ? 5 : mode === "balanced" ? 10 : 15;
    const aqiThreshold = mode === "sensitive" ? 100 : mode === "balanced" ? 130 : 160;

    switch (intelligence.category) {
      case "weather":
        if (intelligence.data?.humidity && intelligence.data.humidity < humidityThreshold) {
          alerts.push({
            id: `weather_${Date.now()}`,
            severity: "critical",
            category: "weather",
            title: "Kritik Nem Seviyeleri Tespit Edildi",
            description: `Nem oranı kritik seviyede: %${intelligence.data.humidity} (Eşik: <%${humidityThreshold}). Yangın riski yüksek.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        if (intelligence.data?.temperature && intelligence.data.temperature > tempThreshold) {
          alerts.push({
            id: `weather_temp_${Date.now()}`,
            severity: "warning",
            category: "weather",
            title: "Yüksek Sıcaklık Uyarısı",
            description: `Sıcaklık ${intelligence.data.temperature}°C'ye ulaştı (Eşik: >${tempThreshold}°C).`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "social":
        if (intelligence.data?.crisis_mentions && intelligence.data.crisis_mentions > crisisThreshold) {
          alerts.push({
            id: `social_crisis_${Date.now()}`,
            severity: "critical",
            category: "social",
            title: "Sosyal Kriz Sinyalleri",
            description: `Sosyal medyada ${intelligence.data.crisis_mentions} kriz belirteci tespit edildi.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "security":
        if (intelligence.data?.threat_level && intelligence.data.threat_level > 7) {
          alerts.push({
            id: `security_threat_${Date.now()}`,
            severity: "critical",
            category: "security",
            title: "Güvenlik Tehdidi Seviyesi Yüksek",
            description: `Tehdit seviyesi ${intelligence.data.threat_level}/10 olarak tespit edildi.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "environment":
        if (intelligence.data?.aqi && intelligence.data.aqi > aqiThreshold) {
          alerts.push({
            id: `env_aqi_${Date.now()}`,
            severity: "warning",
            category: "environment",
            title: "Hava Kalitesi Düşürüldü",
            description: `Hava Kalitesi Endeksi ${intelligence.data.aqi} - Sağlık riski (Eşik: >${aqiThreshold}).`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "economy":
        if (intelligence.data?.unemployment_rate && intelligence.data.unemployment_rate > 15) {
          alerts.push({
            id: `eco_unemployment_${Date.now()}`,
            severity: "warning",
            category: "economy",
            title: "İşsizlik Oranı Arttı",
            description: `İşsizlik oranı %${intelligence.data.unemployment_rate} olarak kaydedildi.`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "transport":
        if (intelligence.data?.traffic_density && intelligence.data.traffic_density > trafficThreshold) {
          alerts.push({
            id: `transport_traffic_${Date.now()}`,
            severity: "warning",
            category: "transport",
            title: "Ağır Trafik Uyarısı",
            description: `Trafik yoğunluğu kritik seviyede (%${(intelligence.data.traffic_density * 100).toFixed(0)}).`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;

      case "energy":
        if (intelligence.data?.consumption_peak && intelligence.data.consumption_peak > 0.92) {
          alerts.push({
            id: `energy_peak_${Date.now()}`,
            severity: "warning",
            category: "energy",
            title: "Enerji Tüketim Zirve",
            description: `Enerji tüketimi zirve kapasitesine yakın (%${(intelligence.data.consumption_peak * 100).toFixed(0)}).`,
            timestamp: Date.now(),
            metadata: intelligence.data,
          });
        }
        break;
    }

    alerts.forEach(alert => this.addAnomalyAlert(alert));
  }

  public addAnomalyAlert(alert: AnomalyAlert) {
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

  // ─── 5 Strateji Uygulama Motoru (AI Strategy Action Engine) ──────────

  public setSensitivity(mode: SensitivityMode) {
    this.sensitivityMode = mode;
    try {
      localStorage.setItem("ih_sensitivity_mode", mode);
    } catch (e) {
      console.debug("Failed to set sensitivity:", e);
    }
  }

  public getSensitivity(): SensitivityMode {
    try {
      const stored = localStorage.getItem("ih_sensitivity_mode") as SensitivityMode;
      if (stored && ["sensitive", "balanced", "high"].includes(stored)) {
        this.sensitivityMode = stored;
      }
    } catch (e) {
      console.debug("Failed to get sensitivity:", e);
    }
    return this.sensitivityMode;
  }

  // 1. Sosyal Medya Trendlerini Gerçek Zamanlı İzleme
  public async setRealtimeSocialTracking(
    active: boolean,
    customKeywords?: string[]
  ): Promise<RealtimeSocialStatus> {
    this.isSocialRealtimeActive = active;

    // Dinamik dikkat çeken konuları ve etiketleri gerçek postlardan çıkar.
    // Veri yoksa sıfır değerlerle dönülür; uydurma gönderi/his dağılımı üretilmez.
    let dynamicKeywords: string[] = [];
    let postCount = 0;
    let sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
    let hasLiveData = false;

    try {
      const { data } = await supabase
        .from("social_posts")
        .select("content, keywords_matched, sentiment, region")
        .order("published_at", { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        hasLiveData = true;
        postCount = data.length;
        const pos = data.filter((p: any) => p.sentiment === "positive").length;
        const neg = data.filter((p: any) => p.sentiment === "negative").length;
        const neu = data.filter((p: any) => p.sentiment === "neutral").length;
        sentimentDistribution = { positive: pos, neutral: neu, negative: neg };

        // Frekans ve dikkat çeken başlık analizi
        const freqMap: Record<string, number> = {};
        for (const p of data) {
          // 1. Hashtagler
          const text = `${p.content || ""}`;
          const tags = text.match(/#[a-zA-Z0-9çğıöşüÇĞİÖŞÜ_]+/g) || [];
          tags.forEach(t => {
            const clean = t.trim();
            if (clean.length > 2) freqMap[clean] = (freqMap[clean] || 0) + 2;
          });

          // 2. Eşleşen anahtar kelimeler
          if (Array.isArray(p.keywords_matched)) {
            p.keywords_matched.forEach((k: string) => {
              const clean = k.trim().startsWith("#") ? k.trim() : `#${k.trim()}`;
              if (clean.length > 2) freqMap[clean] = (freqMap[clean] || 0) + 1;
            });
          }

          // 3. Bölge etiketleri
          if (p.region) {
            const rTag = `#${p.region.replace(/\s+/g, "")}`;
            freqMap[rTag] = (freqMap[rTag] || 0) + 1;
          }

          // 4. Kritik kentsel dikkat çeken terimler (öne çıkan konular)
          const attentionTerms = [
            "yangın", "su", "trafik", "elektrik", "turizm", "ulaşım", "deprem", 
            "imar", "altyapı", "fırtına", "baraj", "deniz", "kaza", "temizlik"
          ];
          attentionTerms.forEach(term => {
            if (text.toLowerCase().includes(term)) {
              const tag = `#${term.charAt(0).toUpperCase() + term.slice(1)}`;
              freqMap[tag] = (freqMap[tag] || 0) + 1.5;
            }
          });
        }

        // En çok dikkat çeken ve öne çıkan etiketleri dinamik sırala
        dynamicKeywords = Object.entries(freqMap)
          .sort((a, b) => b[1] - a[1])
          .map(([kw]) => kw)
          .slice(0, 10);
      }
    } catch (e) {
      console.debug("Failed to extract dynamic attention keywords:", e);
    }

    const hasCustom = Boolean(customKeywords && customKeywords.length > 0);
    const keywords = hasCustom ? customKeywords! : dynamicKeywords;

    const provenance: DataProvenance = hasCustom
      ? "reference"
      : hasLiveData
      ? "live"
      : "unavailable";

    if (active) {
      if (!this.socialRealtimeUnsubscribe) {
        this.socialRealtimeUnsubscribe = subscribeToRealtimeTable("social_posts", (payload) => {
          const newPost = payload.new as any;
          if (newPost?.content) {
            const alert = notificationService.checkAndAlert(newPost.content, newPost.platform || "social");
            if (alert && alert.severity === "critical") {
              this.addAnomalyAlert({
                id: `social_rt_${Date.now()}`,
                severity: "critical",
                category: "social",
                title: alert.title,
                description: alert.body,
                timestamp: Date.now(),
                metadata: newPost,
              });
            }
          }
        });
      }
    } else if (this.socialRealtimeUnsubscribe) {
      this.socialRealtimeUnsubscribe();
      this.socialRealtimeUnsubscribe = null;
    }

    const status: RealtimeSocialStatus = {
      isConnected: active,
      provenance,
      activeKeywords: keywords,
      pollIntervalSec: active ? 30 : 300,
      recentPostCount: postCount,
      sentimentDistribution,
      lastSyncAt: Date.now(),
    };

    try {
      localStorage.setItem("ih_social_realtime_status", JSON.stringify(status));
    } catch (e) {
      console.debug("Failed to store social realtime status:", e);
    }

    return status;
  }

  // 2. İklim Uyarılarına Göre Yangın Önleme Protokolü Otomasyonu
  public async automateFirePreventionProtocol(): Promise<FireProtocolStatus> {
    this.fireProtocolAutomationActive = true;

    const thresholds = {
      tempThreshold: 32,
      humidityThreshold: 25,
      windThreshold: 30,
    };

    const weather = this.getData("weather");
    const temp = weather?.temperature != null ? Number(weather.temperature) : null;
    const humidity = weather?.humidity != null ? Number(weather.humidity) : null;
    const windRaw = weather?.windspeed ?? weather?.wind_speed;
    const wind = windRaw != null ? Number(windRaw) : null;

    const hasWeather =
      temp != null && Number.isFinite(temp) &&
      humidity != null && Number.isFinite(humidity) &&
      wind != null && Number.isFinite(wind);

    if (!hasWeather) {
      // Canlı meteoroloji verisi yok: risk hesaplanamaz, saha aksiyonu iddia edilmez.
      return {
        isActive: true,
        isTriggered: false,
        riskScore: null,
        riskLevel: null,
        temperature: temp,
        humidity,
        windSpeed: wind,
        thresholds,
        actionsTaken: [],
        lastEvaluatedAt: Date.now(),
        provenance: "unavailable",
      };
    }

    // Yangın Tehlike İndeksi (FHI) — gerçek sıcaklık/nem/rüzgar verisinden hesaplanır.
    const rawScore = (temp * 1.5) + (wind * 1.1) + ((100 - humidity) * 0.75);
    const riskScore = Math.min(100, Math.max(8, Math.round(rawScore / 2.2)));

    let riskLevel: "Düşük" | "Orta" | "Yüksek" | "Kritik" = "Düşük";
    if (riskScore >= 75) riskLevel = "Kritik";
    else if (riskScore >= 52) riskLevel = "Yüksek";
    else if (riskScore >= 32) riskLevel = "Orta";

    const isTriggered =
      riskLevel === "Yüksek" || riskLevel === "Kritik" ||
      temp > thresholds.tempThreshold ||
      humidity < thresholds.humidityThreshold ||
      wind > thresholds.windThreshold;

    // Yalnızca sistemin gerçekten yaptığı işler listelenir; saha operasyonu iddia edilmez.
    const actionsTaken: string[] = [
      "Gerçek zamanlı hava verisiyle yangın risk indeksi (FHI) hesaplandı",
    ];
    if (isTriggered) {
      actionsTaken.push("Risk eşiği aşıldığı için kritik istihbarat kaydı oluşturuldu");
    }

    const protocolStatus: FireProtocolStatus = {
      isActive: true,
      isTriggered,
      riskScore,
      riskLevel,
      temperature: temp,
      humidity,
      windSpeed: wind,
      thresholds,
      actionsTaken,
      lastEvaluatedAt: Date.now(),
      provenance: "live",
    };

    if (isTriggered) {
      this.addAnomalyAlert({
        id: `fire_proto_${Date.now()}`,
        severity: riskLevel === "Kritik" ? "critical" : "warning",
        category: "weather",
        title: "Yangın Risk Eşiği Aşıldı (Otomatik Değerlendirme)",
        description: `Muğla geneli hesaplanan yangın risk skoru %${riskScore} (${riskLevel}). Sıcaklık: ${temp}°C, Nem: %${humidity}, Rüzgar: ${wind} km/h.`,
        timestamp: Date.now(),
        metadata: protocolStatus,
      });
    }

    try {
      localStorage.setItem("ih_fire_protocol", JSON.stringify(protocolStatus));
    } catch (e) {
      console.debug("Failed to store fire protocol:", e);
    }

    return protocolStatus;
  }

  // 3. Turist Yoğunluğu ve Trafik Yönetimi Entegrasyonu
  public async getIntegratedMobilityIndex(): Promise<IntegratedMobilityData> {
    const traffic = this.getData("transport");
    const tourism = this.getData("tourism");

    const hotspots: any[] = Array.isArray(traffic?.hotspots) ? traffic.hotspots : [];
    const hotelOcc = tourism?.hotel_occupancy != null ? Number(tourism.hotel_occupancy) : null;
    const hasHotel = hotelOcc != null && Number.isFinite(hotelOcc);

    if (hotspots.length === 0) {
      // Canlı trafik verisi yoksa kurgusal koridor yoğunluğu üretme.
      return {
        timestamp: Date.now(),
        provenance: "unavailable",
        corridors: [],
        averagePressure: null,
        activeHotspotsCount: 0,
        smartRoutingDirective:
          "Canlı trafik yoğunluk verisi bulunamadı; entegre mobilite indeksi bu döngüde üretilemedi.",
      };
    }

    const corridors = hotspots.map((h) => {
      const density = Number(h.congestion) || 0;
      const occupancy = hasHotel ? Math.min(95, Math.round(hotelOcc)) : null;
      const pressureScore =
        occupancy == null ? Math.round(density) : Math.round(density * 0.6 + occupancy * 0.4);
      const status: "normal" | "dense" | "critical" =
        pressureScore >= 75 ? "critical" : pressureScore >= 55 ? "dense" : "normal";
      return {
        id: `corridor_${String(h.district ?? "bilinmeyen").toLocaleLowerCase("tr-TR")}`,
        corridor: String(h.district ?? "Bilinmeyen İlçe"),
        trafficDensity: density,
        hotelOccupancy: occupancy,
        pressureScore,
        status,
        recommendation:
          status === "critical"
            ? "Öncelikli trafik yönetimi değerlendirmesi gerekli (canlı yoğunluk verisi)."
            : status === "dense"
            ? "Yoğunluk izlenmeli (canlı yoğunluk verisi)."
            : "Olağan akış.",
      };
    });

    const averagePressure = Math.round(
      corridors.reduce((acc, c) => acc + c.pressureScore, 0) / corridors.length
    );

    const mobilityData: IntegratedMobilityData = {
      timestamp: Date.now(),
      provenance: hasHotel ? "live" : "reference",
      corridors,
      averagePressure,
      activeHotspotsCount: corridors.filter(c => c.status !== "normal").length,
      smartRoutingDirective: hasHotel
        ? "Canlı trafik yoğunluğu ve otel doluluk verisi entegre edildi; en yüksek baskı skorlu ilçeler önceliklendirildi."
        : "Canlı trafik yoğunluğu kullanıldı; otel doluluk verisi bulunamadığı için baskı skoru yalnızca trafiğe dayalı hesaplandı.",
    };

    try {
      localStorage.setItem("ih_integrated_mobility", JSON.stringify(mobilityData));
    } catch (e) {
      console.debug("Failed to store mobility data:", e);
    }

    return mobilityData;
  }

  // 4. Ekonomik Göstergeler İçin Günlük Özet Rapor
  public async generateDailyEconomicSummary(): Promise<DailyEconomicSummary> {
    const eco = this.getData("economy");
    const re = this.getData("real_estate" as DataCategory);

    const num = (v: any): number | null => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const usdTry = num(eco?.usd_try);
    const eurTry = num(eco?.eur_try);
    const inflation = num(eco?.inflation_cpi);
    const tourismRev = num(eco?.tourism_revenue_usd_m);
    const bodrumM2 = num(re?.avg_price_per_m2_try?.bodrum);

    const hasEco = usdTry != null || eurTry != null || inflation != null || tourismRev != null;
    const hasRe = bodrumM2 != null;

    const todayStr = new Date().toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const summary: DailyEconomicSummary = {
      date: todayStr,
      generatedAt: Date.now(),
      provenance: hasEco || hasRe ? "live" : "unavailable",
      summary:
        "Özet yalnızca mevcut canlı/doğrulanmış göstergelerden derlenmiştir. Kaynağı bulunmayan kalemler '—' olarak işaretlenir; türetilmiş değişim oranı üretilmez.",
      macroIndicators: [
        { name: "USD / TRY", value: usdTry == null ? "—" : `${usdTry.toFixed(2)} ₺`, note: "ECB / Frankfurter Canlı Kur" },
        { name: "EUR / TRY", value: eurTry == null ? "—" : `${eurTry.toFixed(2)} ₺`, note: "Avrupa Merkez Bankası Referans" },
        { name: "TÜFE Enflasyon", value: inflation == null ? "—" : `%${inflation}`, note: "TÜİK Yıllık Resmi Oran" },
      ],
      localIndicators: [
        {
          name: "Turizm Geliri",
          value: tourismRev == null ? "—" : `$${(tourismRev / 1000).toFixed(1)} Milyar`,
          note: "Kültür-Turizm Bk. Muğla Yıllık Katkı",
        },
        {
          name: "Bodrum Ort. Konut m²",
          value: bodrumM2 == null ? "—" : `${bodrumM2.toLocaleString("tr-TR")} ₺`,
          note: "REIDIN-GYODER 2024",
        },
      ],
      sectorNotes: [],
      recommendations: [],
    };

    try {
      localStorage.setItem("ih_daily_economic_summary", JSON.stringify(summary));
    } catch (e) {
      console.debug("Failed to store economic summary:", e);
    }

    return summary;
  }

  // 4B. Başkanlık Sabah Brifingi ve İcra Raporu
  public async generatePresidentialBriefing(): Promise<PresidentialBriefing> {
    const weather = this.getData("weather");
    const dams = this.getData("dams" as DataCategory);
    const tourism = this.getData("tourism");
    const eco = this.getData("economy");
    const transport = this.getData("transport");
    const socialStatus = await this.setRealtimeSocialTracking(true);

    const num = (v: any): number | null => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // ── Hava & Yangın ──
    const temp = num(weather?.temperature);
    const humidity = num(weather?.humidity);
    const wind = num(weather?.windspeed ?? weather?.wind_speed);
    let fireRiskScore: number | null = null;
    let fireRiskLevel: string | null = null;
    if (temp != null && humidity != null && wind != null) {
      const rawScore = (temp * 1.5) + (wind * 1.1) + ((100 - humidity) * 0.75);
      fireRiskScore = Math.min(100, Math.max(8, Math.round(rawScore / 2.2)));
      fireRiskLevel =
        fireRiskScore >= 75 ? "Kritik" : fireRiskScore >= 52 ? "Yüksek" : fireRiskScore >= 32 ? "Orta" : "Düşük";
    }

    // ── Barajlar ──
    const damList: any[] = Array.isArray(dams) ? dams : Array.isArray(dams?.dams) ? dams.dams : [];
    const damRatings = damList
      .map((d: any) => num(d?.rate ?? d?.occupancy_rate))
      .filter((n): n is number => n != null);
    const avgDam =
      damRatings.length > 0
        ? Math.round(damRatings.reduce((a, b) => a + b, 0) / damRatings.length)
        : null;

    // ── Ulaşım ──
    const hotspots: any[] = Array.isArray(transport?.hotspots) ? transport.hotspots : [];
    const congestions = hotspots
      .map((h: any) => num(h?.congestion))
      .filter((n): n is number => n != null);
    const congestionAvg =
      congestions.length > 0 ? Math.round(congestions.reduce((a, b) => a + b, 0) / congestions.length) : null;
    const chokePoints = [...hotspots]
      .filter((h: any) => num(h?.congestion) != null)
      .sort((a: any, b: any) => num(b.congestion) - num(a.congestion))
      .slice(0, 3)
      .map((h: any) => String(h.district ?? "Bilinmeyen"));

    // ── Ekonomi & Turizm ──
    const usdTry = num(eco?.usd_try);
    const eurTry = num(eco?.eur_try);
    const tourismRev = num(eco?.tourism_revenue_usd_m);
    const hotelOcc = num(tourism?.hotel_occupancy);

    const now = new Date();
    const dateStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
    const timeStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    const urgencyLevel: PresidentialBriefing["urgencyLevel"] =
      fireRiskScore == null ? "Normal" : fireRiskScore >= 75 ? "Kritik" : fireRiskScore >= 52 ? "Teyakkuz" : fireRiskScore >= 32 ? "Dikkat" : "Normal";

    const hasLive =
      temp != null || humidity != null || congestionAvg != null || usdTry != null || hotelOcc != null || socialStatus.provenance === "live";

    const actionDirectives: string[] = [];
    if (fireRiskScore != null && fireRiskScore >= 52) {
      actionDirectives.push(
        `Hesaplanan yangın risk skoru %${fireRiskScore} (${fireRiskLevel}); orman arayüzü devriye ve erken uyarı planlaması gözden geçirilmeli.`
      );
    }
    if (congestionAvg != null && congestionAvg >= 55) {
      actionDirectives.push(
        `Ortalama trafik yoğunluğu %${congestionAvg}; en yoğun akslar (${chokePoints.join(", ") || "—"}) için sinyalizasyon optimizasyonu değerlendirilmeli.`
      );
    }

    const briefing: PresidentialBriefing = {
      id: `briefing_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      targetOffice: "T.C. Muğla Büyükşehir Belediye Başkanlığı & İl Koordinasyon Kurulu",
      executiveSummary:
        "Brifing yalnızca canlı veri kaynaklarından derlenmiştir. Veri bulunmayan başlıklar '—' olarak işaretlenir; kurgusal değer üretilmez.",
      urgencyLevel,
      provenance: hasLive ? "live" : "unavailable",
      weatherAndFire: {
        temp,
        humidity,
        wind,
        fireRiskScore,
        fireRiskLevel,
      },
      waterAndDams: {
        avgOccupancy: avgDam,
        damCount: damList.length,
        outlook:
          damList.length > 0
            ? `${damList.length} baraj kaydı canlı veriden okundu.`
            : "Canlı baraj verisi bulunamadı.",
      },
      transportAndMobility: {
        congestionAvg,
        activeCorridorsCount: hotspots.length,
        chokePoints,
      },
      economyAndTourism: {
        usdTry: usdTry == null ? "—" : usdTry.toFixed(2),
        eurTry: eurTry == null ? "—" : eurTry.toFixed(2),
        hotelOccupancy: hotelOcc,
        annualTourismEst: tourismRev == null ? "—" : `$${(tourismRev / 1000).toFixed(1)} Milyar`,
      },
      socialPulse: {
        topIssues: socialStatus.activeKeywords.slice(0, 5),
        sentimentSummary:
          socialStatus.provenance === "unavailable"
            ? "Veri bekleniyor"
            : `Son ${socialStatus.recentPostCount} gönderide ${socialStatus.sentimentDistribution.positive} pozitif / ${socialStatus.sentimentDistribution.negative} negatif`,
      },
      actionDirectives,
      generatedAt: Date.now(),
    };

    try {
      localStorage.setItem("ih_presidential_briefing", JSON.stringify(briefing));
    } catch (e) {
      console.debug("Failed to store presidential briefing:", e);
    }

    return briefing;
  }

  // 5. Anomali Eşiklerini Ayarlama ve Gerçek Veri Bazlı Eşik Kalibrasyonu
  public async retrainModelBaselines(
    sensitivity?: SensitivityMode
  ): Promise<MLModelSnapshot> {
    if (sensitivity) {
      this.setSensitivity(sensitivity);
    }

    const currentMode = this.getSensitivity();
    const modeMultiplier = currentMode === "sensitive" ? 0.85 : currentMode === "balanced" ? 1.0 : 1.25;

    // Deterministik politika eşikleri (analyzeForAnomalies ile aynı kaynak).
    // "Öğrenilmiş model" iddiası yoktur; bunlar politika eşikleridir.
    const policyThresholds: Record<string, number> = {
      weather_temperature: Math.round(38 * modeMultiplier),
      weather_humidity: Math.round(18 / modeMultiplier),
      traffic_congestion: Number((0.78 * modeMultiplier).toFixed(2)),
      air_quality_aqi: Math.round(125 * modeMultiplier),
      dam_occupancy: Math.round(20 / modeMultiplier),
      social_crisis_mentions: Math.round(10 * modeMultiplier),
      energy_grid_load: Number((0.92 * modeMultiplier).toFixed(2)),
      economic_fx_volatility: Number((0.15 * modeMultiplier).toFixed(2)),
    };

    // Gözlem olmadıkça mean/stdDev null bırakılır (uydurma istatistik üretilmez).
    const baselines: Record<string, { mean: number | null; stdDev: number | null; threshold: number }> = {};
    for (const [key, threshold] of Object.entries(policyThresholds)) {
      baselines[key] = { mean: null, stdDev: null, threshold };
    }

    // Gerçek gözlem: son 30 günlük sosyal rollup'tan günlük negatif hacmin p95 değeri.
    let sampleSize = 0;
    let socialObserved = false;
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("social_posts_daily_rollup")
        .select("day, sentiment, post_count")
        .gte("day", since);

      if (Array.isArray(data) && data.length > 0) {
        const dailyTotals: Record<string, number> = {};
        const dailyNegative: Record<string, number> = {};
        for (const row of data as any[]) {
          const day = String(row.day);
          const c = Number(row.post_count) || 0;
          dailyTotals[day] = (dailyTotals[day] || 0) + c;
          if (row.sentiment === "negative") {
            dailyNegative[day] = (dailyNegative[day] || 0) + c;
          }
        }
        const days = Object.keys(dailyTotals);
        sampleSize = days.length;
        if (sampleSize > 0) {
          const totals = days.map((d) => dailyTotals[d]);
          const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
          const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length;
          const negSorted = days.map((d) => dailyNegative[d] || 0).sort((a, b) => a - b);
          const p95 = negSorted[Math.min(negSorted.length - 1, Math.max(0, Math.ceil(0.95 * negSorted.length) - 1))];
          baselines.social_crisis_mentions = {
            mean: Number(mean.toFixed(1)),
            stdDev: Number(Math.sqrt(variance).toFixed(1)),
            threshold: p95,
          };
          socialObserved = true;
        }
      }
    } catch (e) {
      console.debug("Rollup baseline query failed:", e);
    }

    const snapshot: MLModelSnapshot = {
      version: "policy-thresholds+p95",
      lastTrainedAt: Date.now(),
      sensitivity: currentMode,
      categoriesTrained: Object.keys(baselines).length,
      sampleSize,
      provenance: socialObserved ? "live" : "reference",
      baselines,
    };

    try {
      localStorage.setItem("ih_ml_model_snapshot", JSON.stringify(snapshot));
    } catch (e) {
      console.debug("Failed to store ML model snapshot:", e);
    }

    // Yalnızca gerçek gözlemle kalibre edildiğinde bilgilendirme kaydı üret.
    if (socialObserved) {
      this.addAnomalyAlert({
        id: `ml_retrain_${Date.now()}`,
        severity: "info",
        category: "environment",
        title: "Anomali Eşikleri Gerçek Veriyle Kalibre Edildi",
        description: `Sosyal kriz eşiği son 30 günün p95 değeri (${baselines.social_crisis_mentions.threshold}) ile güncellendi. Referans: ${sampleSize} günlük gözlem. Hassasiyet: ${currentMode.toUpperCase()}.`,
        timestamp: Date.now(),
        metadata: snapshot,
      });
    }

    return snapshot;
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
