import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { Link, useNavigate } from "react-router-dom";
import { socialIntelService } from "@/services/social-intel-service";
import { OSINTCenter } from "@/components/social/OSINTCenter";
import {
  Radio, TrendingUp, Hash, ArrowLeft, RefreshCw, Globe, Sparkles,
  BarChart3, AlertTriangle, Newspaper, MapPin, Shield, Calendar,
  Loader2, ExternalLink, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/services/notification-service";
import { FilterPanel, SocialFilters } from "@/components/social/FilterPanel";
import { KeywordManager } from "@/components/social/KeywordManager";
import { NewsSourceManager } from "@/components/social/NewsSourceManager";
import { TrendChart, generateTrendFromAnalyses } from "@/components/social/TrendChart";
import { SentimentHistoryChart } from "@/components/social/SentimentHistoryChart";
import { NewsDataCorrelation } from "@/components/social/NewsDataCorrelation";
import { SourceReliability, calculateReliability } from "@/components/social/SourceReliability";
import { WeeklyComparison, generateComparisonData } from "@/components/social/WeeklyComparison";
import { LiveFeedIndicator } from "@/components/social/LiveFeedIndicator";
import { relativeTime, detectRegion } from "@/lib/time-utils";
import { SocialRegionMap, generateRegionMapData } from "@/components/social/SocialRegionMap";
import { ProtocolMentionPanel } from "@/components/social/ProtocolMentionPanel";
import { MonitoredAccountsPanel } from "@/components/social/MonitoredAccountsPanel";
import { supabase } from "@/integrations/supabase/client";

type AnalysisItem = {
  platform: string;
  content: string;
  sentiment: string;
  sentiment_score: number;
  source_author: string;
  engagement_count: number;
  summary?: string;
  source_url?: string;
  region?: string;
  collected_at?: string;
};

const platformLabels: Record<string, string> = {
  twitter: "X (Twitter)",
  reddit: "Reddit",
  eksisozluk: "Ekşi Sözlük",
  news: "Haberler",
  web: "Web",
  all: "Tümü",
};

const platformIcons: Record<string, React.ReactNode> = {
  news: <Newspaper size={10} />,
  reddit: <Globe size={10} />,
  eksisozluk: <Hash size={10} />,
  twitter: <Radio size={10} />,
};

const SocialIntel = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<"feed" | "osint">("feed");
  const [keywords, setKeywords] = useState<string[]>(["Muğla", "Bodrum", "Fethiye", "Marmaris"]);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<SocialFilters>({
    platform: "all",
    sentiment: "all",
    region: "",
    dateRange: "all",
    keyword: "",
  });
  const { toast } = useToast();

  // Map social_posts row → AnalysisItem
  const mapPostToItem = useCallback((p: Record<string, unknown>): AnalysisItem => ({
    platform: p.platform as string,
    content: p.content as string,
    sentiment: (p.sentiment as string) || "neutral",
    sentiment_score: (p.sentiment_confidence as number) || 0,
    source_author: (p.author as string) || "",
    engagement_count: 0,
    summary: undefined,
    source_url: (p.url as string) || undefined,
    region: detectRegion(p.content as string) || (p.region as string) || undefined,
    collected_at: (p.published_at as string) || (p.collected_at as string) || undefined,
  }), []);

  // Load existing posts directly from social_posts table
  const loadFromDB = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("social_posts")
        .select("id,platform,content,author,url,published_at,collected_at,sentiment,sentiment_confidence,keywords_matched")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (data && data.length > 0) {
        setAnalyses(data.map(mapPostToItem));
        setLastUpdate(new Date());
      }
    } catch (e) {
      // silently fall through — collectData will be called too
    }
  }, [mapPostToItem]);

  // Collect and analyze data
  const collectData = useCallback(async () => {
    if (isCollecting) return;
    const activeKeywords = keywords.length > 0 ? keywords : ["Muğla", "Bodrum", "Fethiye", "Marmaris"];
    setIsCollecting(true);

    try {
      // Collect new posts (inserts to DB via social-collect Edge Function)
      const result = await socialIntelService.collectAndAnalyze(activeKeywords, "all");

      // After collection completes, reload ALL posts from DB (historical + new batch).
      // This avoids replacing the full history with only the just-collected slice.
      await loadFromDB();
      setLastUpdate(new Date());

      // Surface critical alerts
      const criticals = result.alerts.filter(a => a.severity === "critical");
      for (const alert of criticals) {
        toast({
          title: "⚠️ " + alert.label,
          description: alert.value,
          variant: "destructive",
        });
        notificationService.sendAlert({
          title: "⚠️ " + alert.label,
          body: alert.value,
          severity: "critical",
          url: "/sosyal-istihbarat",
        });
      }
    } catch (e) {
      toast({ title: "Veri toplama hatası", variant: "destructive" });
    } finally {
      setIsCollecting(false);
    }
  }, [keywords, isCollecting, toast, loadFromDB]);


  // Init notifications
  useEffect(() => {
    notificationService.init();
  }, []);

  // Initial load: fetch existing DB rows from social_posts (instant display).
  // collectData() is only called manually or via auto-refresh — NOT on mount —
  // to prevent it from overwriting the historical posts with only the latest batch.
  useEffect(() => {
    loadFromDB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time subscription — new posts appear without refresh
  useEffect(() => {
    const channel = supabase
      .channel("social_posts_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "social_posts" },
        (payload) => {
          const newPost = payload.new as Record<string, unknown>;
          setAnalyses((prev) => [mapPostToItem(newPost), ...prev]);
          setLastUpdate(new Date());
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mapPostToItem]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(collectData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, collectData]);

  // Filtered results
  // Turkish-safe lowercase for protocol filter matching
  const trLower = (s: string) => s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();

  const filtered = useMemo(() => {
    return analyses.filter(item => {
      if (filters.platform !== "all" && item.platform !== filters.platform) return false;
      if (filters.sentiment !== "all" && item.sentiment !== filters.sentiment) return false;
      if (filters.region && item.region !== filters.region) return false;
      if (filters.keyword && !item.content.toLowerCase().includes(filters.keyword.toLowerCase())) return false;
      // Protocol member filter (set when user clicks a member in ProtocolMentionPanel)
      if (protocolFilter) {
        const hay = trLower(item.content);
        const parts = trLower(protocolFilter).split(/\s+/);
        const surname = parts[parts.length - 1];
        if (!hay.includes(trLower(protocolFilter)) && (surname.length < 4 || !hay.includes(surname))) return false;
      }
      return true;
    });
  }, [analyses, filters, protocolFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const positive = filtered.filter(a => a.sentiment === "positive").length;
    const negative = filtered.filter(a => a.sentiment === "negative").length;
    const neutral = filtered.filter(a => a.sentiment === "neutral").length;
    const regions = new Set(filtered.map(a => a.region).filter(Boolean));
    return { total, positive, negative, neutral, regionCount: regions.size };
  }, [filtered]);

  // Trend data
  const trendData = useMemo(() => generateTrendFromAnalyses(filtered), [filtered]);

  // Source reliability
  const sourceReliability = useMemo(
    () => calculateReliability(analyses.map(a => ({ author: a.source_author, platform: a.platform, sentiment: a.sentiment }))),
    [analyses]
  );

  // Region map data
  const regionMapData = useMemo(() => generateRegionMapData(filtered), [filtered]);
  // Weekly comparison (simulated since we don't have historical data yet)
  const comparisonData = useMemo(() => {
    const currentByRegion: Record<string, { count: number; sentimentAvg: number }> = {};
    for (const item of filtered) {
      const region = item.region || "Diğer";
      if (!currentByRegion[region]) currentByRegion[region] = { count: 0, sentimentAvg: 0 };
      currentByRegion[region].count++;
      currentByRegion[region].sentimentAvg += item.sentiment === "positive" ? 1 : item.sentiment === "negative" ? -1 : 0;
    }
    // Normalize sentiment avg
    for (const r of Object.values(currentByRegion)) {
      r.sentimentAvg = r.count > 0 ? r.sentimentAvg / r.count : 0;
    }
    // Mock previous week (slightly different)
    const prevByRegion: Record<string, { count: number; sentimentAvg: number }> = {};
    for (const [region, data] of Object.entries(currentByRegion)) {
      prevByRegion[region] = {
        count: Math.max(0, data.count + Math.floor((Math.random() - 0.5) * 4)),
        sentimentAvg: Math.max(-1, Math.min(1, data.sentimentAvg + (Math.random() - 0.5) * 0.3)),
      };
    }
    return generateComparisonData(currentByRegion, prevByRegion);
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader activeTab="sosyal" onTabChange={(tab) => navigate(tab === "sosyal" ? "/social-intel" : "/?tab=" + tab)} />

      <div className="p-3 sm:p-4 space-y-4">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-primary">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h2 className="text-sm font-mono font-bold text-foreground flex items-center gap-2">
                <Sparkles size={14} className="text-primary" />
                Sosyal Medya İstihbarat Merkezi
              </h2>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
                Gerçek zamanlı veri toplama, AI duygu analizi, bölgesel izleme
              </p>
            </div>
          </div>

          {/* Section toggle */}
          <div className="flex items-center gap-1.5 mr-2">
            <button
              onClick={() => setActiveSection("feed")}
              className={`flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-1.5 rounded border transition-colors ${
                activeSection === "feed"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <Radio size={11} />Sosyal Akış
            </button>
            <button
              onClick={() => setActiveSection("osint")}
              className={`flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-1.5 rounded border transition-colors ${
                activeSection === "osint"
                  ? "bg-cyan-600/20 text-cyan-300 border-cyan-500/40"
                  : "text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <Eye size={11} />OSINT Merkezi
            </button>
          </div>

          <div className="flex items-center gap-2">
            <LiveFeedIndicator lastUpdate={lastUpdate} itemCount={analyses.length} isCollecting={isCollecting} />
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-[9px] font-mono px-2 py-1.5 rounded border ${
                autoRefresh
                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                  : "text-muted-foreground border-border/30 hover:text-foreground"
              }`}
            >
              {autoRefresh ? "OTO: AÇIK" : "OTO: KAPALI"}
            </button>
            <button
              onClick={collectData}
              disabled={isCollecting}
              className="text-[10px] font-mono px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-40 flex items-center gap-1.5"
            >
              {isCollecting ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Topla & Analiz Et
            </button>
          </div>
        </div>

        {activeSection === "osint" && (
          <OSINTCenter />
        )}

        {activeSection === "feed" && (
          <>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="px-3 py-2 rounded-lg bg-muted/10 border border-border/30">
            <span className="text-[9px] font-mono text-muted-foreground">TOPLAM</span>
            <p className="text-lg font-mono font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20">
            <span className="text-[9px] font-mono text-green-500/70">POZİTİF</span>
            <p className="text-lg font-mono font-bold text-green-500">{stats.positive}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
            <span className="text-[9px] font-mono text-red-500/70">NEGATİF</span>
            <p className="text-lg font-mono font-bold text-red-500">{stats.negative}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <span className="text-[9px] font-mono text-yellow-500/70">NÖTR</span>
            <p className="text-lg font-mono font-bold text-yellow-500">{stats.neutral}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
            <span className="text-[9px] font-mono text-cyan-500/70">BÖLGE</span>
            <p className="text-lg font-mono font-bold text-cyan-400">{stats.regionCount}</p>
          </div>
        </div>

        {/* Filter Panel */}
        <FilterPanel filters={filters} onChange={setFilters} activeCount={filtered.length} />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Trend Chart */}
            <DashboardPanel title="📈 Mention & Duygu Trendi" subtitle="Zaman serisi">
              <SentimentHistoryChart />
              <NewsDataCorrelation />
              <TrendChart data={trendData} title="Mevcut Oturum Trendi" />
            </DashboardPanel>

            {/* Feed */}
            <DashboardPanel title="📰 Canlı Feed" subtitle={`${filtered.length} sonuç`}>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="text-center py-6 text-[10px] font-mono text-muted-foreground/50">
                    {isCollecting ? "Veriler toplanıyor..." : "Filtre kriterlerine uygun sonuç bulunamadı"}
                  </div>
                ) : (
                  filtered.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border/30 bg-muted/5 hover:bg-muted/10 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {platformIcons[item.platform] || <Globe size={10} />}
                            <span className="text-[9px] font-mono text-muted-foreground">
                              {platformLabels[item.platform] || item.platform}
                            </span>
                            <span className="text-[8px] font-mono text-muted-foreground/50">•</span>
                            <span className="text-[9px] font-mono text-muted-foreground/60">
                              {item.source_author}
                            </span>
                            {item.region && (
                              <>
                                <span className="text-[8px] font-mono text-muted-foreground/50">•</span>
                                <span className="text-[9px] font-mono text-cyan-400 flex items-center gap-0.5">
                                  <MapPin size={8} /> {item.region}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-foreground/90 leading-relaxed line-clamp-2">
                            {item.content}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            item.sentiment === "positive" ? "bg-green-500/10 text-green-500" :
                            item.sentiment === "negative" ? "bg-red-500/10 text-red-500" :
                            "bg-yellow-500/10 text-yellow-500"
                          }`}>
                            {item.sentiment === "positive" ? "+" : item.sentiment === "negative" ? "−" : "○"}
                            {Math.round(item.sentiment_score * 100)}%
                          </span>
                          {item.source_url && (
                            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                              className="text-muted-foreground/40 hover:text-primary">
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                      {item.collected_at && (
                        <span className="text-[8px] font-mono text-muted-foreground/40 mt-1 block">
                          {relativeTime(item.collected_at)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </DashboardPanel>
          </div>

          {/* Right column: Panels */}
          <div className="space-y-4">
            {/* Keyword Manager */}
            <DashboardPanel title="🏷️ Anahtar Kelime Yönetimi" subtitle="Ekle/Kaldır">
              <KeywordManager onKeywordsChange={(kws) => setKeywords(kws.length > 0 ? kws : ["Muğla", "Bodrum", "Fethiye", "Marmaris", "Datça", "Dalaman"])} />
            </DashboardPanel>

            {/* News Source Manager */}
            <DashboardPanel title="🏛️ Protokol Üyesi Analizi" subtitle="İsim eşleştirme · tıkla filtrele">
              <ProtocolMentionPanel
                analyses={analyses}
                onMemberFilter={setProtocolFilter}
              />
            </DashboardPanel>

                        <DashboardPanel title="📱 Sosyal Medya Hesaplarım" subtitle="Hesap izle · keyword eşleştir">
              <MonitoredAccountsPanel />
            </DashboardPanel>

            <DashboardPanel title="📰 Yerel Haber Kaynakları" subtitle="Gazete & RSS takibi">
              <NewsSourceManager />
            </DashboardPanel>

            {/* Source Reliability */}
            {/* Region Map */}
            <DashboardPanel title="📍 Bölge Haritası" subtitle="İlçe bazlı mention">
              <SocialRegionMap data={regionMapData} />
            </DashboardPanel>

            <DashboardPanel title="🛡️ Kaynak Güvenilirlik" subtitle="Puan tablosu">
              <SourceReliability sources={sourceReliability} />
            </DashboardPanel>

            {/* Weekly Comparison */}
            <DashboardPanel title="📊 Haftalık Karşılaştırma" subtitle="Bu hafta vs Geçen hafta">
              <WeeklyComparison data={comparisonData} />
            </DashboardPanel>

            {/* Auto Summary */}
            <DashboardPanel title="🤖 AI Günlük Özet" subtitle="Otomatik rapor">
              <div className="space-y-2">
                {analyses.length > 0 ? (
                  <>
                    <p className="text-[10px] font-mono text-foreground/80 leading-relaxed">
                      <span className="text-primary font-bold">Bugün Muğla'da:</span>{" "}
                      {analyses.length} sosyal medya içeriği analiz edildi.{" "}
                      {stats.positive > stats.negative
                        ? "Genel duygu olumlu — bölgede pozitif gelişmeler ağırlıkta."
                        : stats.negative > stats.positive
                        ? "Dikkat gerektiren konular mevcut — olumsuz içerik oranı yüksek."
                        : "Dengeli bir içerik dağılımı gözlendi."
                      }
                    </p>
                    {stats.regionCount > 0 && (
                      <p className="text-[9px] font-mono text-muted-foreground">
                        📍 {stats.regionCount} farklı bölgeden içerik tespit edildi
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[...new Set(analyses.map(a => a.region).filter(Boolean))].slice(0, 5).map(r => (
                        <span key={r} className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                          {r}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] font-mono text-muted-foreground/50">
                    Veri toplandıktan sonra otomatik özet oluşturulacak
                  </p>
                )}
              </div>
            </DashboardPanel>
          </div>
        </div>
          </>
        )}

      </div>
    </div>
  );
};

export default SocialIntel;
