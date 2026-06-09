import { useEffect, useState } from "react";
import { osintDataManager } from "@/services/osint-data-manager";
import { dataSyncService, SyncStatus } from "@/services/data-sync-service";
import { getCategoryStats } from "@/services/sample-data-service";
import { IntelligenceFeed } from "@/components/intelligence/IntelligenceFeed";
import { LiveMap } from "@/components/intelligence/LiveMap";
import { AnomalyAlertSystem } from "@/components/intelligence/AnomalyAlertSystem";
import { CategoryCard } from "@/components/intelligence/CategoryCard";
import { CircleAlert as AlertCircle, RefreshCw, Database, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OSINTDashboard() {
  const [stats, setStats] = useState({
    totalItems: 0,
    criticalItems: 0,
    sourceCount: 0,
    lastUpdate: Date.now(),
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRefreshing: false,
    lastSync: null,
    nextSync: null,
    error: null,
    itemsCount: 0,
    fromCache: false,
    dataAge: "very_old",
  });
  const [categoryStats, setCategoryStats] = useState(
    getCategoryStats(osintDataManager.getIntelligenceFeed())
  );

  useEffect(() => {
    // Start data sync service
    dataSyncService.startSync();

    // Subscribe to sync status changes
    const unsubscribe = dataSyncService.subscribe((status) => {
      setSyncStatus(status);
      updateStats();
    });

    // Update stats
    updateStats();
    const interval = setInterval(updateStats, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      dataSyncService.stopSync();
    };
  }, []);

  const updateStats = () => {
    const feed = osintDataManager.getIntelligenceFeed();
    const critical = osintDataManager.getCriticalItems();
    const sources = osintDataManager.getSources();

    setStats({
      totalItems: feed.length,
      criticalItems: critical.length,
      sourceCount: sources.length,
      lastUpdate: Date.now(),
    });

    setCategoryStats(getCategoryStats(feed));
  };

  const handleManualRefresh = async () => {
    await dataSyncService.manualRefresh();
    updateStats();
  };

  const getDataAgeLabel = (age: string): string => {
    switch (age) {
      case "fresh":
        return "Canlı";
      case "slightly_old":
        return "Az eski";
      case "old":
        return "Eski";
      case "very_old":
      default:
        return "Çok eski";
    }
  };

  const getDataAgeBadgeColor = (age: string): string => {
    switch (age) {
      case "fresh":
        return "bg-green-600";
      case "slightly_old":
        return "bg-yellow-600";
      case "old":
        return "bg-orange-600";
      case "very_old":
      default:
        return "bg-red-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <AnomalyAlertSystem />

      {syncStatus.error && (
        <div className="mb-4 p-3 rounded-lg bg-yellow-950/50 border border-yellow-700/50 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-300">Veri Uyarısı</p>
            <p className="text-xs text-yellow-200/70 mt-0.5">{syncStatus.error}</p>
            {syncStatus.fromCache && (
              <p className="text-xs text-yellow-200/60 mt-1">
                Son başarılı veriler gösteriliyor.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              Muğla Monitör
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              OSINT & Yerel İstihbarat Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleManualRefresh}
              disabled={syncStatus.isRefreshing}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${syncStatus.isRefreshing ? "animate-spin" : ""}`}
              />
              {syncStatus.isRefreshing ? "Yenileniyor..." : "Yenile"}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Toplam Bildirim
            </p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {stats.totalItems}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-red-950/50 border border-red-700/50">
            <p className="text-xs font-semibold text-red-300 uppercase">
              Kritik Uyarılar
            </p>
            <p className="text-2xl font-bold text-red-400 mt-1">
              {stats.criticalItems}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase">
              Aktif Kaynaklar
            </p>
            <p className="text-2xl font-bold text-slate-100 mt-1">
              {stats.sourceCount}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-blue-950/50 border border-blue-700/50">
            <p className="text-xs font-semibold text-blue-300 uppercase">
              Veri Durumu
            </p>
            <Badge
              className={`mt-1 text-xs ${getDataAgeBadgeColor(syncStatus.dataAge)}`}
            >
              {getDataAgeLabel(syncStatus.dataAge)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Grid: Map and Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 h-96">
          <LiveMap />
        </div>
        <div className="h-96">
          <IntelligenceFeed />
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CategoryCard
          title="Güvenlik & Tehdit"
          icon={<AlertCircle className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-orange-950/20 via-orange-950/10 to-transparent"
          borderColor="border-orange-700/30 hover:border-orange-700/50"
          items={categoryStats.security.items}
          category="security"
        />

        <CategoryCard
          title="Hava Durumu"
          icon={<AlertCircle className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-blue-950/20 via-blue-950/10 to-transparent"
          borderColor="border-blue-700/30 hover:border-blue-700/50"
          items={categoryStats.weather.items}
          category="weather"
        />

        <CategoryCard
          title="Ekonomi & Turizm"
          icon={<AlertCircle className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-green-950/20 via-green-950/10 to-transparent"
          borderColor="border-green-700/30 hover:border-green-700/50"
          items={categoryStats.economy.items}
          category="economy"
        />

        <CategoryCard
          title="Sağlık & Kamu"
          icon={<AlertCircle className="w-5 h-5" />}
          bgColor="bg-gradient-to-br from-red-950/20 via-red-950/10 to-transparent"
          borderColor="border-red-700/30 hover:border-red-700/50"
          items={categoryStats.health.items}
          category="health"
        />
      </div>

      {/* System Info Footer */}
      <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <p className="font-semibold text-slate-300">Sistem Bilgileri</p>
        </div>
        <ul className="list-disc list-inside space-y-1 ml-6">
          <li>Veri kaynakları: Google Apps Script, Gmail Alerts, RSS Feeds</li>
          <li>
            Güncelleme aralığı: Her{" "}
            {Math.round(dataSyncService.getStatus().nextSync ? (dataSyncService.getStatus().nextSync - Date.now()) / 1000 / 60 : 0) || 5} dakika
          </li>
          <li>Son güncelleme: {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleTimeString("tr-TR") : "Hiç"}</li>
          <li>Duygu analizi: Client-side işleme</li>
          <li>Anomali tespiti: Real-time</li>
          <li>Veri saklama: localStorage + Supabase</li>
        </ul>
      </div>
    </div>
  );
}
