import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { subscribeToRealtimeTable } from "@/lib/supabase-realtime-singleton";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { socialIntelService } from "@/services/social-intel-service";
import { OSINTCenter } from "@/components/social/OSINTCenter";
import {
  Radio, TrendingUp, Hash, ArrowLeft, RefreshCw, Globe, Sparkles,
  BarChart3, AlertTriangle, Newspaper, MapPin, Shield, Calendar,
  Loader2, ExternalLink, Eye, CheckCircle2
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
import { relativeTime } from "@/lib/time-utils";
import { SocialRegionMap } from "@/components/social/SocialRegionMap";
import { ProtocolMentionPanel, mentionsMember } from "@/components/social/ProtocolMentionPanel";
import { MonitoredAccountsPanel } from "@/components/social/MonitoredAccountsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { useMonitorStore } from "@/store/useMonitorStore";

export type AnalysisItem = {
  id?: string;
  platform: string;
  content: string;
  sentiment: string;
  sentiment_score: number;
  sentiment_confidence: number | null;
  district?: string;
  category?: string;
  entities: unknown;
  source_author: string;
  engagement_count: number;
  summary?: string;
  source_url?: string;
  region?: string;
  collected_at?: string;
  published_at?: string;
  analyzed_at?: string;
  timestamp?: number;
  source_type?: string;
  source_instance?: string;
  verification_status?: string;
  verification_score?: number;
  corroboration_count?: number;
};

export function normalizeSocialPost(post: Record<string, unknown>): AnalysisItem {
  const asText = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;
  const district = asText(post.district) || asText(post.region);
  const publishedAt = asText(post.published_at);
  const collectedAt = asText(post.collected_at);
  const analyzedAt = asText(post.analyzed_at);

  const eventTimestamp = publishedAt || collectedAt || analyzedAt;
  const parsedTimestamp = eventTimestamp ? Date.parse(eventTimestamp) : Number.NaN;

  return {
    id: asText(post.id),
    platform: asText(post.platform) || "unknown",
    content: asText(post.content) || "",
    sentiment: asText(post.sentiment) || "neutral",
    sentiment_score: typeof post.sentiment_score === "number" ? post.sentiment_score : 0,
    sentiment_confidence: typeof post.sentiment_confidence === "number" ? post.sentiment_confidence : null,
    district,
    category: asText(post.category),
    entities: post.entities ?? [],
    source_author: asText(post.author) || "",
    engagement_count: 0,
    source_url: asText(post.url),
    region: district,
    collected_at: collectedAt,
    published_at: publishedAt,
    analyzed_at: analyzedAt,
    timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : undefined,
    source_type: asText(post.source_type),
    source_instance: asText(post.source_instance),
    verification_status: asText(post.verification_status) || "unverified",
    verification_score: typeof post.verification_score === "number" ? post.verification_score : 0,
    corroboration_count: typeof post.corroboration_count === "number" ? post.corroboration_count : 0,
  };
}

const dateRangeMs: Record<SocialFilters["dateRange"], number> = {
  all: Number.POSITIVE_INFINITY,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function filterSocialAnalyses(
  analyses: AnalysisItem[],
  filters: SocialFilters,
  protocolFilter: string | null,
  now: Date | number = Date.now(),
): AnalysisItem[] {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const maxAge = dateRangeMs[filters.dateRange];
  const keyword = filters.keyword.trim().toLocaleLowerCase("tr-TR");

  return analyses.filter((item) => {
    if (filters.platform !== "all" && item.platform !== filters.platform) return false;
    if (filters.sentiment !== "all" && item.sentiment !== filters.sentiment) return false;
    if (filters.region && item.region !== filters.region) return false;
    if (maxAge !== Number.POSITIVE_INFINITY) {
      const timestamp = item.timestamp ?? Number.NaN;
      const age = nowMs - timestamp;
      if (!Number.isFinite(timestamp) || age < 0 || age > maxAge) return false;
    }
    if (keyword) {
      const searchable = `${item.content} ${item.category ?? ""} ${JSON.stringify(item.entities)}`
        .toLocaleLowerCase("tr-TR");
      if (!searchable.includes(keyword)) return false;
    }
    if (protocolFilter && !mentionsMember(item.content, protocolFilter)) return false;
    return true;
  });
}

type IntelSection = "feed" | "osint";

const platformLabels: Record<string, string> = {
  twitter: "X (Twitter)",
  reddit: "Reddit",
  eksisozluk: "Ekşi Sözlük",
  news: "Haberler",
  google_news: "Google News",
  local_rss: "Yerel RSS",
  email_alerts: "Haber Alarmı",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  youtube: "YouTube",
  web: "Web",
  all: "Tümü",
};

const platformIcons: Record<string, React.ReactNode> = {
  news: <Newspaper size={10} />,
  reddit: <Globe size={10} />,
  eksisozluk: <Hash size={10} />,
  twitter: <Radio size={10} />,
  bluesky: <Globe size={10} />,
  mastodon: <Radio size={10} />,
};

const SocialIntel = () => {
  const { lang } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<IntelSection>("feed");

  useEffect(() => {
    const sec = searchParams.get("section");
    if (sec && ["feed", "osint"].includes(sec)) {
      setActiveSection(sec as IntelSection);
    }
  }, [searchParams]);
  const [keywords, setKeywords] = useState<string[]>(["Muğla", "Bodrum", "Fethiye", "Marmaris"]);
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [dataState, setDataState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [dataError, setDataError] = useState<string | null>(null);
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

  // Load the canonical social_posts dataset once for all Social UI panels.
  const loadFromDB = useCallback(async () => {
    setDataState("loading");
    setDataError(null);
    try {
      const { data, error } = await supabase
        .from("social_posts")
        .select("id,platform,content,author,url,published_at,collected_at,analyzed_at,sentiment,sentiment_score,sentiment_confidence,district,category,entities,region,keywords_matched,source_type,source_instance,verification_status,verification_score,corroboration_count")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const mapped = (data ?? []).map((post) => normalizeSocialPost(post as Record<string, unknown>));
      setAnalyses(mapped);
      if (mapped.length === 0) {
        setDataState("empty");
        setLastUpdate(null);
        return;
      }

      const nowIso = new Date().toISOString();
      setDataState("ready");
      setLastUpdate(new Date(nowIso));
      const pos = mapped.filter((item) => item.sentiment === "positive").length;
      const neg = mapped.filter((item) => item.sentiment === "negative").length;
      useMonitorStore.getState().setSocialFeed({
        items: mapped.slice(0, 60).map((item, idx) => ({
          id: item.id || `social-${idx}`,
          platform: item.platform,
          content: item.content,
          sentiment: item.sentiment,
          districtName: item.region,
          author: item.source_author,
          url: item.source_url,
          publishedAt: item.published_at || item.collected_at || "",
        })),
        totalMentions: mapped.length,
        positiveRatio: Math.round((pos / mapped.length) * 100),
        negativeRatio: Math.round((neg / mapped.length) * 100),
        lastUpdatedAt: nowIso,
      });
    } catch (error) {
      setAnalyses([]);
      setLastUpdate(null);
      setDataState("error");
      setDataError(error instanceof Error ? error.message : "Social posts could not be loaded.");
    }
  }, []);

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

  // Tekil singleton kanal üzerinden yeni paylaşımları dinle (bağımlılık dizisi sabit: [])
  useEffect(() => {
    return subscribeToRealtimeTable("social_posts", (payload) => {
      const newPost = (payload.new ?? {}) as Record<string, unknown>;
      const mapped = normalizeSocialPost(newPost);
      const nowIso = new Date().toISOString();
      setAnalyses((prev) => [mapped, ...prev.filter((item) => item.id !== mapped.id)].slice(0, 200));
      setDataState("ready");
      setDataError(null);
      setLastUpdate(new Date(nowIso));
      useMonitorStore.getState().prependSocialPost({
        id: mapped.id || `rt-${Date.now()}`,
        platform: mapped.platform,
        content: mapped.content,
        sentiment: mapped.sentiment,
        districtName: mapped.region,
        author: mapped.source_author,
        url: mapped.source_url,
        publishedAt: mapped.published_at || mapped.collected_at || "",
      });
    });
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(collectData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, collectData]);

  // Filtered results

  const filtered = useMemo(() => {
    return filterSocialAnalyses(analyses, filters, protocolFilter);
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

  // Real Weekly comparison from Supabase database
  const [dbWeeklyHistory, setDbWeeklyHistory] = useState<{
    prevByRegion: Record<string, { count: number; sentimentAvg: number }>;
    hasHistoricalData: boolean;
  }>({ prevByRegion: {}, hasHistoricalData: false });

  useEffect(() => {
    let isMounted = true;
    socialIntelService.getLiveWeeklyComparison().then((res) => {
      if (isMounted) {
        setDbWeeklyHistory({
          prevByRegion: res.prevByRegion,
          hasHistoricalData: res.hasHistoricalData,
        });
      }
    });
    return () => { isMounted = false; };
  }, [analyses.length]);

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

    // Gerçek geçmiş hafta verisi (Veritabanından, ASLA Math.random() YOK)
    const prevByRegion = dbWeeklyHistory.prevByRegion;
    return generateComparisonData(currentByRegion, prevByRegion);
  }, [filtered, dbWeeklyHistory]);

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

          {/* Section toggle - Sade ve Odaklı */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
            <button
              onClick={() => setActiveSection("feed")}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                activeSection === "feed"
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                  : "text-muted-foreground border-border hover:text-foreground bg-secondary/30"
              }`}
            >
              <Radio size={12} />
              <span>Sosyal Akış & Trendler</span>
            </button>

            <button
              onClick={() => setActiveSection("osint")}
              className={`flex items-center gap-1.5 text-[10px] font-mono px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
                activeSection === "osint"
                  ? "bg-cyan-600 text-white border-cyan-500 font-bold shadow-sm"
                  : "text-muted-foreground border-border hover:text-foreground bg-secondary/30"
              }`}
            >
              <Eye size={12} />
              <span>OSINT & Açık İstihbarat</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <LiveFeedIndicator lastUpdate={lastUpdate} itemCount={analyses.length} isCollecting={isCollecting} />
            {isAuthenticated ? (
              <>
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
              </>
            ) : null}
          </div>
        </div>

        {/* Global Living City Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="px-3 py-2 rounded-lg bg-muted/10 border border-border/30">
            <span className="text-[9px] font-mono text-muted-foreground">TOPLAM PAYLAŞIM</span>
            <p className="text-base font-mono font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20">
            <span className="text-[9px] font-mono text-green-500/70">OLUMLU</span>
            <p className="text-base font-mono font-bold text-green-500">{stats.positive}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20">
            <span className="text-[9px] font-mono text-red-500/70">ŞİKAYET / TEPKİ</span>
            <p className="text-base font-mono font-bold text-red-500">{stats.negative}</p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <span className="text-[9px] font-mono text-yellow-500/70">BİLGİLENDİRME</span>
            <p className="text-base font-mono font-bold text-yellow-500">{stats.neutral}</p>
          </div>
        </div>

        {/* Active Section View Render */}
        {activeSection === "osint" && (
          <OSINTCenter />
        )}

        {activeSection === "feed" && (
          <>

        {/* Filter Panel */}
        <FilterPanel filters={filters} onChange={setFilters} activeCount={filtered.length} />
        {dataState === "error" && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[10px] font-mono text-destructive">
            social_posts verileri yüklenemedi. {dataError}
          </div>
        )}
        {dataState === "empty" && (
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-[10px] font-mono text-muted-foreground">
            social_posts sorgusu başarılı, ancak tabloda gösterilecek kayıt yok.
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left column: Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Trend Chart */}
            <DashboardPanel title="📈 Mention & Duygu Trendi" subtitle="Zaman serisi">
              <SentimentHistoryChart analyses={filtered} />
              <NewsDataCorrelation analyses={filtered} />
              <TrendChart data={trendData} title="Mevcut Oturum Trendi" />
            </DashboardPanel>

            {/* Feed */}
            <DashboardPanel title="📰 Canlı Feed" subtitle={`${filtered.length} sonuç`}>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="text-center py-6 text-[10px] font-mono text-muted-foreground/50">
                    {isCollecting || dataState === "loading"
                      ? "Veriler yükleniyor..."
                      : dataState === "error"
                      ? "Veritabanı hatası nedeniyle akış gösterilemiyor."
                      : dataState === "empty"
                      ? "social_posts tablosunda henüz kayıt yok."
                      : "Filtre kriterlerine uygun sonuç bulunamadı"}
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
                            {item.source_instance && (
                              <span className="text-[8px] text-muted-foreground/50">· {item.source_instance}</span>
                            )}
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
                            Skor {item.sentiment_score.toFixed(2)}
                          </span>
                          {item.source_url && (
                            <a href={item.source_url} target="_blank" rel="noopener noreferrer"
                              className="text-muted-foreground/40 hover:text-primary">
                              <ExternalLink size={10} />
                            </a>
                          )}
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                            item.verification_status === "corroborated" ? "bg-green-500/10 text-green-500" :
                            item.verification_status === "disputed" ? "bg-red-500/10 text-red-500" :
                            item.verification_status === "corroborating" ? "bg-cyan-500/10 text-cyan-400" :
                            "bg-yellow-500/10 text-yellow-500"
                          }`}>
                            {item.verification_status === "corroborated" ? "TEYİT EDİLDİ" :
                             item.verification_status === "corroborating" ? "DESTEKLENİYOR" :
                             item.verification_status === "disputed" ? "İHTİLAFLI" : "DOĞRULANMADI"}
                          </span>
                        </div>
                      </div>
                      {(item.published_at || item.collected_at || item.analyzed_at) && (
                        <span className="text-[8px] font-mono text-muted-foreground/40 mt-1 block">
                          {relativeTime(item.published_at || item.collected_at || item.analyzed_at, lang)}
                        </span>
                      )}
                      <div className="flex gap-2 text-[8px] font-mono text-muted-foreground/50 mt-1">
                        <span>Duygu güveni: {item.sentiment_confidence === null ? "—" : `%${Math.round(item.sentiment_confidence * 100)}`}</span>
                        <span>Teyit puanı: %{Math.round((item.verification_score ?? 0) * 100)}</span>
                        <span>Bağımsız destek: {item.corroboration_count ?? 0}</span>
                      </div>
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

            <DashboardPanel title="📱 Sosyal Medya Hesaplarım" subtitle="Otomatik hedef takibi · tıkla profile git">
              <MonitoredAccountsPanel />
            </DashboardPanel>

            <DashboardPanel title="📰 Yerel Haber Kaynakları" subtitle="Gazete & RSS takibi">
              <NewsSourceManager />
            </DashboardPanel>

            {/* Source Reliability */}
            {/* Region Map */}
            <DashboardPanel title="📍 Bölge Haritası" subtitle="İlçe bazlı mention">
              <SocialRegionMap analyses={filtered} />
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
