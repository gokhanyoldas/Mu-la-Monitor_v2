import { DataQualityMetricSchema, type DataQualityMetric, type DataSource } from "./data-schemas";

interface DataQualityStatus {
  category: string;
  lastUpdate: number;
  age: number;
  isFresh: boolean;
  hasRealSource: boolean;
  validationStatus: "valid" | "invalid" | "partial" | "unknown";
  source: string;
  lastError?: string;
}

class DataQualityTracker {
  private metrics: Map<string, DataQualityMetric> = new Map();
  private sources: Map<string, DataSource> = new Map();
  private refreshIntervals: Map<string, number> = new Map();

  private sourceRegistry: Record<string, { name: string; isFree: boolean; isReliable: boolean; refreshMinutes: number }> = {
    "open-meteo": { name: "Open-Meteo", isFree: true, isReliable: true, refreshMinutes: 15 },
    "turkish-statistics": { name: "Turkish Statistics Institute", isFree: false, isReliable: true, refreshMinutes: 1440 },
    "tourism-board": { name: "Muğla Tourism Board", isFree: false, isReliable: true, refreshMinutes: 1440 },
    "manual-observation": { name: "Manual Observation", isFree: true, isReliable: false, refreshMinutes: 60 },
    "rss-feeds": { name: "RSS News Feeds", isFree: true, isReliable: false, refreshMinutes: 15 },
    "manual-survey": { name: "Manual Survey", isFree: true, isReliable: false, refreshMinutes: 10080 },
  };

  registerDataFetch(
    category: string,
    sourceId: string,
    isSuccess: boolean,
    errorMessage?: string
  ) {
    const now = Date.now();
    const sourceInfo = this.sourceRegistry[sourceId];

    if (!sourceInfo) {
      console.warn(`Unknown source: ${sourceId}`);
      return;
    }

    const metric: DataQualityMetric = {
      category,
      timestamp: now,
      data_age_minutes: 0,
      is_fresh: true,
      has_real_source: sourceInfo.isFree,
      validation_status: isSuccess ? "valid" : "invalid",
      source: sourceInfo.name,
      last_error: errorMessage,
    };

    this.metrics.set(category, metric);

    const source: DataSource = {
      category,
      source_name: sourceInfo.name,
      is_free: sourceInfo.isFree,
      is_reliable: sourceInfo.isReliable,
      refresh_interval_minutes: sourceInfo.refreshMinutes,
      last_update: now,
      health_status: isSuccess ? "healthy" : "failing",
      error_message: errorMessage,
    };

    this.sources.set(category, source);
    this.persistMetric(metric);
  }

  getQualityStatus(category: string): DataQualityStatus {
    const metric = this.metrics.get(category);
    const now = Date.now();

    if (!metric) {
      return {
        category,
        lastUpdate: 0,
        age: -1,
        isFresh: false,
        hasRealSource: false,
        validationStatus: "unknown",
        source: "Unknown",
      };
    }

    const ageMinutes = (now - metric.timestamp) / (1000 * 60);
    const sourceInfo = this.sourceRegistry[metric.source.toLowerCase()] || this.sourceRegistry["manual-observation"];
    const isFresh = ageMinutes < sourceInfo.refreshMinutes * 2;

    return {
      category,
      lastUpdate: metric.timestamp,
      age: Math.round(ageMinutes),
      isFresh,
      hasRealSource: metric.has_real_source,
      validationStatus: metric.validation_status,
      source: metric.source,
      lastError: metric.last_error,
    };
  }

  getAllMetrics() {
    return Array.from(this.metrics.values());
  }

  getHealthSummary() {
    const metrics = Array.from(this.metrics.values());
    const now = Date.now();

    const summary = {
      total_sources: metrics.length,
      healthy: 0,
      degraded: 0,
      failing: 0,
      avg_age_minutes: 0,
      free_sources: 0,
      last_updated: now,
    };

    let totalAge = 0;

    metrics.forEach((metric) => {
      const ageMinutes = (now - metric.timestamp) / (1000 * 60);
      totalAge += ageMinutes;

      if (metric.validation_status === "valid") {
        summary.healthy += 1;
      } else if (metric.validation_status === "partial") {
        summary.degraded += 1;
      } else {
        summary.failing += 1;
      }

      if (metric.has_real_source) {
        summary.free_sources += 1;
      }
    });

    summary.avg_age_minutes = Math.round(totalAge / metrics.length);

    return summary;
  }

  private persistMetric(metric: DataQualityMetric) {
    try {
      const stored = localStorage.getItem("dq_metrics");
      const metrics = stored ? JSON.parse(stored) : {};
      metrics[metric.category] = metric;
      localStorage.setItem("dq_metrics", JSON.stringify(metrics));
    } catch (err) {
      console.error("Failed to persist quality metric:", err);
    }
  }

  loadPersistedMetrics() {
    try {
      const stored = localStorage.getItem("dq_metrics");
      if (stored) {
        const metrics = JSON.parse(stored);
        Object.entries(metrics).forEach(([key, value]) => {
          this.metrics.set(key, value as DataQualityMetric);
        });
      }
    } catch (err) {
      console.error("Failed to load persisted metrics:", err);
    }
  }

  getSourceRegistry() {
    return this.sourceRegistry;
  }

  addSourceInfo(sourceId: string, info: { name: string; isFree: boolean; isReliable: boolean; refreshMinutes: number }) {
    this.sourceRegistry[sourceId] = info;
  }

  getFreeSourcesOnly() {
    return Array.from(this.metrics.values()).filter((m) => m.has_real_source);
  }

  getUnreliableSources() {
    return Array.from(this.metrics.values()).filter((m) => m.validation_status === "invalid");
  }

  clearMetrics() {
    this.metrics.clear();
    this.sources.clear();
    localStorage.removeItem("dq_metrics");
  }
}

export const dataQualityTracker = new DataQualityTracker();
