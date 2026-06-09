import { supabase } from "@/integrations/supabase/client";

export interface SyncStatus {
  isRefreshing: boolean;
  lastSync: number | null;
  nextSync: number | null;
  error: string | null;
  itemsCount: number;
  fromCache: boolean;
  dataAge: "fresh" | "slightly_old" | "old" | "very_old";
}

class DataSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private status: SyncStatus = {
    isRefreshing: false,
    lastSync: null,
    nextSync: null,
    error: null,
    itemsCount: 0,
    fromCache: false,
    dataAge: "very_old",
  };

  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private refreshIntervalMs = 5 * 60 * 1000; // 5 minutes

  async startSync(intervalMs?: number) {
    if (intervalMs) {
      this.refreshIntervalMs = intervalMs;
    }

    await this.performSync();

    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.refreshIntervalMs);

    this.notifyListeners();
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async performSync(): Promise<SyncStatus> {
    this.status.isRefreshing = true;
    this.status.error = null;
    this.notifyListeners();

    try {
      // Fetch live data from Supabase Edge Functions
      const [weatherResult, newsResult, economyResult] = await Promise.allSettled([
        supabase.functions.invoke("data-scrape", { body: { type: "weather" } }),
        supabase.functions.invoke("data-scrape", { body: { type: "news" } }),
        supabase.functions.invoke("data-scrape", { body: { type: "economy" } }),
      ]);

      let itemsCount = 0;
      if (weatherResult.status === "fulfilled" && weatherResult.value.data) itemsCount++;
      if (newsResult.status === "fulfilled" && newsResult.value.data) itemsCount++;
      if (economyResult.status === "fulfilled" && economyResult.value.data) itemsCount++;

      this.status.itemsCount = itemsCount;
      this.status.lastSync = Date.now();
      this.status.nextSync = Date.now() + this.refreshIntervalMs;
      this.status.fromCache = false;
      this.updateDataAge();

      return this.status;
    } catch (error) {
      this.status.error = error instanceof Error ? error.message : "Sync error";
      return this.status;
    } finally {
      this.status.isRefreshing = false;
      this.notifyListeners();
    }
  }

  private updateDataAge() {
    if (this.status.lastSync) {
      const age = Date.now() - this.status.lastSync;
      if (age < 60000) {
        this.status.dataAge = "fresh";
      } else if (age < 300000) {
        this.status.dataAge = "slightly_old";
      } else if (age < 3600000) {
        this.status.dataAge = "old";
      } else {
        this.status.dataAge = "very_old";
      }
    }
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => { this.listeners.delete(listener); };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener({ ...this.status }));
  }

  manualRefresh() {
    return this.performSync();
  }

  setRefreshInterval(ms: number) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.refreshIntervalMs = ms;
      this.syncInterval = setInterval(() => {
        this.performSync();
      }, this.refreshIntervalMs);
    }
  }
}

export const dataSyncService = new DataSyncService();
