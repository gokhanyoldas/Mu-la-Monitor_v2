import { supabase } from "@/integrations/supabase/client";

export interface SocialPost {
  id: string;
  platform: string;
  source_type: string | null;
  source_instance: string | null;
  content: string;
  author: string;
  url: string;
  published_at: string;
  keywords_matched: string[];
  sentiment: string | null;
  sentiment_confidence: number | null;
  sentiment_method: string | null;
  collected_at: string;
  verification_status: "unverified" | "corroborating" | "corroborated" | "disputed" | null;
  verification_score: number | null;
  corroboration_count: number | null;
  verified_at: string | null;
}

export interface CollectionResult {
  posts: SocialPost[];
  total: number;
  platforms_queried: string[];
  keywords_used: string[];
  collected_at: string;
}

export interface SentimentSummary {
  total: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  positive_ratio: number;
  negative_ratio: number;
  neutral_ratio: number;
  avg_confidence: number;
  overall_sentiment: string;
  method: string;
}

export interface AnalysisResult {
  results: Array<{
    text: string;
    sentiment: string;
    confidence: number;
    method: string;
  }>;
  summary: SentimentSummary;
  analyzed_at: string;
}

export interface LocalAnalysisItem {
  platform: string;
  content: string;
  sentiment: string;
  sentiment_score: number;
  source_author: string;
  engagement_count: number;
  summary?: string;
  source_url?: string;
}

export interface LocalAlertItem {
  label: string;
  value: string;
  severity: string;
}

export interface LocalTrendSummary {
  mention_count: number;
  positive_ratio: number;
  negative_ratio: number;
  neutral_ratio: number;
  top_topics: string[];
  overall_sentiment: string;
  key_insights: string;
}

export interface LocalCollectedItem {
  platform: string;
  content: string;
  description?: string;
  source_author: string;
  source_url?: string;
  matched_keywords?: string[];
}

class SocialIntelService {
  // ─── Collect real data from edge function ───
  async collectData(keywords: string[], platforms: string[] = ["news", "reddit", "eksisozluk"]): Promise<LocalCollectedItem[]> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return [];

      const { data, error } = await supabase.functions.invoke("social-collect", {
        body: { keywords, platforms },
      });

      if (error) {
        console.error("social-collect error:", error);
        return [];
      }

      const posts = data?.data?.posts || [];
      
      // Map to LocalCollectedItem format for UI compatibility
      return posts.map((post: any) => ({
        platform: post.platform,
        content: post.content,
        description: `${post.platform.toUpperCase()} - ${new Date(post.published_at).toLocaleDateString("tr-TR")}`,
        source_author: post.author,
        source_url: post.url,
        matched_keywords: post.keywords_matched,
      }));
    } catch (e) {
      console.error("Collection failed:", e);
      return [];
    }
  }

  // ─── Analyze sentiment via edge function ───
  async analyzeSentiment(texts: string[]): Promise<AnalysisResult | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const { data, error } = await supabase.functions.invoke("social-analyze", {
        body: { texts },
      });

      if (error) {
        console.error("social-analyze error:", error);
        return null;
      }

      return data?.data || null;
    } catch (e) {
      console.error("Analysis failed:", e);
      return null;
    }
  }

  // ─── Combined collect + analyze (replaces old mock flow) ───
  async collectAndAnalyze(
    keywords: string[],
    platform: string = "all"
  ): Promise<{
    collectedItems: LocalCollectedItem[];
    analyses: LocalAnalysisItem[];
    alerts: LocalAlertItem[];
    trend_summary: LocalTrendSummary;
  }> {
    // Determine platforms
    const platforms = platform === "all" 
      ? ["news", "reddit", "eksisozluk"] 
      : [platform];

    // Step 1: Collect
    const collectedItems = await this.collectData(keywords, platforms);

    if (collectedItems.length === 0) {
      return {
        collectedItems: [],
        analyses: [],
        alerts: [{ label: "Veri Bulunamadı", value: "Kaynaklardan veri çekilemedi", severity: "warning" }],
        trend_summary: this.emptyTrendSummary(),
      };
    }

    // Step 2: Analyze sentiment
    const texts = collectedItems.map(item => item.content);
    const analysisResult = await this.analyzeSentiment(texts);

    // Step 3: Map to UI format
    const analyses: LocalAnalysisItem[] = collectedItems.map((item, i) => {
      const sentimentResult = analysisResult?.results?.[i];
      return {
        platform: item.platform,
        content: item.content,
        sentiment: sentimentResult?.sentiment || "neutral",
        sentiment_score: sentimentResult?.confidence || 0.5,
        source_author: item.source_author,
        engagement_count: 0, // Real engagement not available from RSS/Reddit free
        summary: this.generateItemSummary(sentimentResult?.sentiment || "neutral"),
        source_url: item.source_url,
      };
    });

    // Step 4: Calculate alerts
    const alerts = this.generateAlerts(analyses, analysisResult?.summary);

    // Step 5: Build trend summary
    const trend_summary = this.buildTrendSummary(analyses, analysisResult?.summary, keywords);

    return { collectedItems, analyses, alerts, trend_summary };
  }

  private generateItemSummary(sentiment: string): string {
    switch (sentiment) {
      case "positive": return "Olumlu gelişme tespit edildi";
      case "negative": return "Olumsuz içerik, dikkat gerekli";
      default: return "Bilgi niteliğinde içerik";
    }
  }

  private generateAlerts(analyses: LocalAnalysisItem[], summary?: SentimentSummary | null): LocalAlertItem[] {
    const alerts: LocalAlertItem[] = [];
    
    if (summary) {
      if (summary.negative_ratio > 0.5) {
        alerts.push({
          label: "Yüksek Negatif Duygu",
          value: `%${Math.round(summary.negative_ratio * 100)}`,
          severity: "warning",
        });
      }
      if (summary.method === "keyword_fallback") {
        alerts.push({
          label: "AI Model Kullanılamadı",
          value: "Keyword analiz aktif",
          severity: "info",
        });
      }
    }

    const criticalKeywords = ["yangın", "deprem", "sel", "kaza", "ölüm", "terör"];
    const hasCritical = analyses.some(a => 
      criticalKeywords.some(kw => a.content.toLowerCase().includes(kw))
    );
    if (hasCritical) {
      alerts.push({
        label: "Kritik İçerik Tespit Edildi",
        value: "Acil dikkat gerekebilir",
        severity: "critical",
      });
    }

    return alerts;
  }

  private buildTrendSummary(analyses: LocalAnalysisItem[], summary: SentimentSummary | null | undefined, keywords: string[]): LocalTrendSummary {
    const total = analyses.length || 1;
    const positiveRatio = summary?.positive_ratio || analyses.filter(a => a.sentiment === "positive").length / total;
    const negativeRatio = summary?.negative_ratio || analyses.filter(a => a.sentiment === "negative").length / total;
    const neutralRatio = summary?.neutral_ratio || analyses.filter(a => a.sentiment === "neutral").length / total;
    const overallSentiment = summary?.overall_sentiment || "neutral";

    // Extract top topics from content
    const topTopics = this.extractTopics(analyses, keywords);

    return {
      mention_count: analyses.length,
      positive_ratio: positiveRatio,
      negative_ratio: negativeRatio,
      neutral_ratio: neutralRatio,
      top_topics: topTopics,
      overall_sentiment: overallSentiment,
      key_insights: this.generateInsights(analyses.length, overallSentiment, topTopics, summary?.method || "unknown"),
    };
  }

  private extractTopics(analyses: LocalAnalysisItem[], keywords: string[]): string[] {
    const freq: Record<string, number> = {};
    
    for (const a of analyses) {
      for (const kw of keywords) {
        if (a.content.toLowerCase().includes(kw.toLowerCase())) {
          freq[kw] = (freq[kw] || 0) + 1;
        }
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);
  }

  private generateInsights(total: number, sentiment: string, topics: string[], method: string): string {
    let insight = `${total} adet gerçek içerik analiz edildi (${method === "ai" ? "AI BERT modeli" : "gelişmiş keyword analizi"} ile). `;

    if (sentiment === "positive") {
      insight += "Genel duygu OLUMLU. Bölgede pozitif gelişmeler ön planda. ";
    } else if (sentiment === "negative") {
      insight += "Genel duygu OLUMSUZ. Dikkat gerektiren konular mevcut. ";
    } else {
      insight += "Genel duygu NÖTR. Dengeli bir haber/içerik dağılımı var. ";
    }

    if (topics.length > 0) {
      insight += `Öne çıkan konular: ${topics.join(", ")}.`;
    }

    return insight;
  }

  private emptyTrendSummary(): LocalTrendSummary {
    return {
      mention_count: 0,
      positive_ratio: 0,
      negative_ratio: 0,
      neutral_ratio: 0,
      top_topics: [],
      overall_sentiment: "neutral",
      key_insights: "Henüz veri toplanmadı.",
    };
  }

  // ─── Get recent posts from DB (for cached view) ───
  async getRecentPosts(limit: number = 50): Promise<SocialPost[]> {
    const { data, error } = await supabase
      .from("social_posts")
      .select("*")
      .order("collected_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("DB fetch error:", error);
      return [];
    }

    return (data as unknown as SocialPost[]) || [];
  }

  getConnectionStatus() {
    return {
      isConnected: true,
      source: "Supabase Edge Functions",
      lastUpdate: new Date().toLocaleTimeString("tr-TR"),
      dataSource: "Bluesky + Mastodon + Google News RSS + Reddit + Supabase verifier",
    };
  }

  // ─── Get trend data from DB ───
  async getTrendData(periodType = "hourly", limit = 24) {
    const { data, error } = await supabase
      .from("social_trends")
      .select("period_start, mention_count, positive_count, negative_count, neutral_count")
      .eq("period_type", periodType)
      .order("period_start", { ascending: false })
      .limit(limit);
    if (error) { console.error("Trend fetch error:", error); return []; }
    return (data || []).reverse();
  }

  // ─── Live Trends & Frequency from real social_posts ───
  async getLiveTrends(): Promise<{
    trends: Array<{ keyword: string; mentions: number; change: number; sentiment: "positive" | "negative" | "neutral" }>;
    chartData: Array<{ name: string; value: number }>;
    totalMentions: number;
    positiveRatio: number;
    negativeRatio: number;
    platformBreakdown: Array<{ label: string; value: string; status: "ok" | "info" }>;
    recentHeadlines: Array<{ title: string; platform: string; sentiment: string; region?: string }>;
    isLiveDb: boolean;
  }> {
    const defaultData = {
      trends: [],
      chartData: [],
      totalMentions: 0,
      positiveRatio: 0,
      negativeRatio: 0,
      platformBreakdown: [],
      recentHeadlines: [],
      isLiveDb: false,
    };

    const runWithTimeout = async <T,>(promise: PromiseLike<T>, ms = 6000): Promise<T | null> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      });
      try {
        return await Promise.race([
          Promise.resolve(promise).finally(() => {
            if (timer) clearTimeout(timer);
          }),
          timeoutPromise,
        ]);
      } catch {
        if (timer) clearTimeout(timer);
        return null;
      }
    };

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Öncelik: Son 7 günde yayınlanan social_posts kayıtları
      const recentRes = await runWithTimeout(
        supabase
          .from("social_posts")
          .select("content, keywords_matched, sentiment, published_at, collected_at, region, platform")
          .gte("published_at", sevenDaysAgo)
          .order("published_at", { ascending: false })
          .limit(500)
      );

      let posts: any[] =
        recentRes && !recentRes.error && Array.isArray(recentRes.data) ? recentRes.data : [];

      // 2. Fallback: Son 7 gün boşsa (published_at null veya daha eski tarihli ise)
      // tarih kısıtı olmadan en güncel 300 social_posts kaydını çek
      if (posts.length === 0) {
        const latestRes = await runWithTimeout(
          supabase
            .from("social_posts")
            .select("content, keywords_matched, sentiment, published_at, collected_at, region, platform")
            .order("collected_at", { ascending: false })
            .limit(300)
        );
        if (latestRes && !latestRes.error && Array.isArray(latestRes.data)) {
          posts = latestRes.data;
        }
      }

      // 3. Fallback (collected_at sütunu yoksa published_at sırası ile tarih kısıtsız çek)
      if (posts.length === 0) {
        const fallbackRes = await runWithTimeout(
          supabase
            .from("social_posts")
            .select("content, keywords_matched, sentiment, published_at, region, platform")
            .order("published_at", { ascending: false })
            .limit(300)
        );
        if (fallbackRes && !fallbackRes.error && Array.isArray(fallbackRes.data)) {
          posts = fallbackRes.data;
        }
      }

      if (posts.length === 0) {
        return defaultData;
      }

      return computeSocialTrendsFromPosts(posts);
    } catch (e) {
      console.warn("Notice: Live trends query skipped:", e);
      return defaultData;
    }
  }

  // ─── Real Two-Week Comparison from Supabase ───
  async getLiveWeeklyComparison(): Promise<{
    currentByRegion: Record<string, { count: number; sentimentAvg: number }>;
    prevByRegion: Record<string, { count: number; sentimentAvg: number }>;
    hasHistoricalData: boolean;
  }> {
    try {
      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

      // Current week: last 7 days
      const { data: currentPosts } = await supabase
        .from("social_posts")
        .select("region, sentiment")
        .gte("published_at", sevenDaysAgo);

      // Previous week: 7 to 14 days ago
      const { data: prevPosts } = await supabase
        .from("social_posts")
        .select("region, sentiment")
        .gte("published_at", fourteenDaysAgo)
        .lt("published_at", sevenDaysAgo);

      const currentByRegion: Record<string, { count: number; sentimentAvg: number }> = {};
      const prevByRegion: Record<string, { count: number; sentimentAvg: number }> = {};

      for (const p of (currentPosts || [])) {
        const reg = p.region || "Menteşe";
        if (!currentByRegion[reg]) currentByRegion[reg] = { count: 0, sentimentAvg: 0 };
        currentByRegion[reg].count++;
        currentByRegion[reg].sentimentAvg += p.sentiment === "positive" ? 1 : p.sentiment === "negative" ? -1 : 0;
      }

      for (const r of Object.values(currentByRegion)) {
        r.sentimentAvg = r.count > 0 ? r.sentimentAvg / r.count : 0;
      }

      const hasHistoricalData = !!(prevPosts && prevPosts.length > 0);

      if (hasHistoricalData && prevPosts) {
        for (const p of prevPosts) {
          const reg = p.region || "Menteşe";
          if (!prevByRegion[reg]) prevByRegion[reg] = { count: 0, sentimentAvg: 0 };
          prevByRegion[reg].count++;
          prevByRegion[reg].sentimentAvg += p.sentiment === "positive" ? 1 : p.sentiment === "negative" ? -1 : 0;
        }
        for (const r of Object.values(prevByRegion)) {
          r.sentimentAvg = r.count > 0 ? r.sentimentAvg / r.count : 0;
        }
      }

      return {
        currentByRegion,
        prevByRegion,
        hasHistoricalData,
      };
    } catch (e) {
      console.error("Weekly comparison DB query failed:", e);
      return {
        currentByRegion: {},
        prevByRegion: {},
        hasHistoricalData: false,
      };
    }
  }

  // ─── Get source reliability from DB ───
  async getSourceReliability(limit = 15) {
    const { data, error } = await supabase
      .from("source_reliability")
      .select("platform, source_name, total_posts, reliability_score")
      .order("reliability_score", { ascending: false })
      .limit(limit);
    if (error) { console.error("Source reliability error:", error); return []; }
    return data || [];
  }

  // ─── Trigger cron collection ───
  async triggerCronCollection() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { success: false };
    const { data, error } = await supabase.functions.invoke("social-cron", { body: {} });
    if (error) return { success: false };
    return { success: true, collected: data?.collected, analyzed: data?.analyzed };
  }
}

const MUGLA_TOPIC_LEXICON: Array<{ needle: string; label: string }> = [
  { needle: "bodrum", label: "Bodrum" },
  { needle: "marmaris", label: "Marmaris" },
  { needle: "fethiye", label: "Fethiye" },
  { needle: "menteşe", label: "Menteşe" },
  { needle: "mentese", label: "Menteşe" },
  { needle: "milas", label: "Milas" },
  { needle: "datça", label: "Datça" },
  { needle: "datca", label: "Datça" },
  { needle: "dalaman", label: "Dalaman" },
  { needle: "ortaca", label: "Ortaca" },
  { needle: "köyceğiz", label: "Köyceğiz" },
  { needle: "koycegiz", label: "Köyceğiz" },
  { needle: "yatağan", label: "Yatağan" },
  { needle: "yatagan", label: "Yatağan" },
  { needle: "seydikemer", label: "Seydikemer" },
  { needle: "kavaklıdere", label: "Kavaklıdere" },
  { needle: "ula", label: "Ula" },
  { needle: "su kesinti", label: "SuKesintisi" },
  { needle: "baraj", label: "Barajlar" },
  { needle: "muski", label: "MUSKİ" },
  { needle: "trafik", label: "Trafik" },
  { needle: "turizm", label: "Turizm" },
  { needle: "deprem", label: "Deprem" },
  { needle: "yangın", label: "Yangın" },
  { needle: "elektrik", label: "Enerji" },
  { needle: "aydem", label: "ADM_Elektrik" },
  { needle: "belediye", label: "Belediye" },
  { needle: "altyapı", label: "Altyapı" },
  { needle: "ulaşım", label: "Ulaşım" },
  { needle: "muttaş", label: "MUTTAŞ" },
  { needle: "sağlık", label: "Sağlık" },
  { needle: "tarım", label: "Tarım" },
  { needle: "ekonomi", label: "Ekonomi" },
  { needle: "kıyı", label: "KıyıKoruma" },
  { needle: "havalimanı", label: "Havalimanı" },
];

const PLATFORM_DISPLAY_LABELS: Record<string, string> = {
  news: "Yerel Basın / Google News",
  google_news: "Yerel Basın / Google News",
  rss: "Yerel Basın / RSS",
  yerel_basin: "Yerel Basın",
  twitter: "X / Twitter",
  x: "X / Twitter",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  reddit: "Reddit",
  eksisozluk: "Ekşi Sözlük",
  instagram: "Instagram",
  facebook: "Facebook",
  sikayetvar: "Şikayetvar",
  youtube: "YouTube",
};

export interface ComputedSocialTrends {
  trends: Array<{
    keyword: string;
    mentions: number;
    change: number;
    sentiment: "positive" | "negative" | "neutral";
  }>;
  chartData: Array<{ name: string; value: number }>;
  totalMentions: number;
  positiveRatio: number;
  negativeRatio: number;
  platformBreakdown: Array<{ label: string; value: string; status: "ok" | "info" }>;
  recentHeadlines: Array<{ title: string; platform: string; sentiment: string; region?: string }>;
  isLiveDb: boolean;
}

export function computeSocialTrendsFromPosts(
  posts: Array<{
    content?: string | null;
    keywords_matched?: string[] | null;
    sentiment?: string | null;
    published_at?: string | null;
    collected_at?: string | null;
    publishedAt?: string | null;
    region?: string | null;
    districtName?: string | null;
    platform?: string | null;
  }>
): ComputedSocialTrends {
  const effectivePosts = Array.isArray(posts)
    ? posts.filter((p) => p && typeof p.content === "string" && p.content.trim().length > 0)
    : [];

  if (effectivePosts.length === 0) {
    return {
      trends: [],
      chartData: [],
      totalMentions: 0,
      positiveRatio: 0,
      negativeRatio: 0,
      platformBreakdown: [],
      recentHeadlines: [],
      isLiveDb: false,
    };
  }

  const totalMentions = effectivePosts.length;
  const keywordFreq: Record<string, { count: number; pos: number; neg: number }> = {};

  for (const p of effectivePosts) {
    const words = new Set<string>();
    const sent = String(p.sentiment || "neutral").toLowerCase();

    if (Array.isArray(p.keywords_matched)) {
      p.keywords_matched.forEach((k) => {
        if (typeof k === "string" && k.trim().length >= 3) words.add(k.trim());
      });
    }
    const regionVal = p.region || p.districtName;
    if (typeof regionVal === "string" && regionVal.trim().length >= 3) {
      words.add(regionVal.trim());
    }

    const text = String(p.content || "");
    const tags = text.match(/#[a-zA-Z0-9çğıöşüÇĞİÖŞÜ_]+/g) || [];
    tags.forEach((t) => words.add(t));

    // Metin başlık/içerik taraması — keywords_matched boş olsa bile gerçek konular çıkar
    const lowerText = text.toLocaleLowerCase("tr-TR");
    for (const entry of MUGLA_TOPIC_LEXICON) {
      if (lowerText.includes(entry.needle)) {
        words.add(entry.label);
      }
    }

    for (const w of words) {
      if (!w || w.length < 3) continue;
      const key = w.startsWith("#") ? w : `#${w.replace(/\s+/g, "")}`;
      if (!keywordFreq[key]) {
        keywordFreq[key] = { count: 0, pos: 0, neg: 0 };
      }
      keywordFreq[key].count++;
      if (sent === "positive") keywordFreq[key].pos++;
      if (sent === "negative") keywordFreq[key].neg++;
    }
  }

  const sorted = Object.entries(keywordFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const trends = sorted.map(([kw, stats]) => {
    const sentiment: "positive" | "negative" | "neutral" =
      stats.pos > stats.neg ? "positive" : stats.neg > stats.pos ? "negative" : "neutral";
    const change = Math.round((stats.count / Math.max(1, totalMentions)) * 100);
    return {
      keyword: kw,
      mentions: stats.count,
      change: Math.max(5, change),
      sentiment,
    };
  });

  const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const dayCounts: Record<string, number> = { Pzt: 0, Sal: 0, Çar: 0, Per: 0, Cum: 0, Cmt: 0, Paz: 0 };

  for (const p of effectivePosts) {
    const ts = p.published_at || p.publishedAt || p.collected_at;
    if (ts) {
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) {
        const dayName = dayNames[d.getDay()];
        if (dayCounts[dayName] !== undefined) {
          dayCounts[dayName]++;
        }
      }
    }
  }

  const chartData = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((name) => ({
    name,
    value: dayCounts[name] || 0,
  }));

  const posCount = effectivePosts.filter((p) => String(p.sentiment || "").toLowerCase() === "positive").length;
  const negCount = effectivePosts.filter((p) => String(p.sentiment || "").toLowerCase() === "negative").length;
  const positiveRatio = Math.round((posCount / totalMentions) * 100);
  const negativeRatio = Math.round((negCount / totalMentions) * 100);

  const platMap: Record<string, number> = {};
  for (const p of effectivePosts) {
    const rawPlat = String(p.platform || "news").trim().toLowerCase();
    const label = PLATFORM_DISPLAY_LABELS[rawPlat] || (rawPlat ? rawPlat.toUpperCase() : "Yerel Basın");
    platMap[label] = (platMap[label] || 0) + 1;
  }

  const platformBreakdown = Object.entries(platMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({
      label,
      value: `${count} içerik`,
      status: (count >= 5 ? "ok" : "info") as "ok" | "info",
    }));

  const recentHeadlines = effectivePosts.slice(0, 3).map((p) => ({
    title: String(p.content || "").replace(/\s+/g, " ").trim().slice(0, 120),
    platform: PLATFORM_DISPLAY_LABELS[String(p.platform || "news").toLowerCase()] || String(p.platform || "Basın"),
    sentiment: String(p.sentiment || "neutral").toLowerCase(),
    region: p.region || p.districtName || undefined,
  }));

  return {
    trends:
      trends.length > 0
        ? trends
        : [{ keyword: "#Muğla", mentions: totalMentions, change: 10, sentiment: "neutral" }],
    chartData,
    platformBreakdown,
    recentHeadlines,
    totalMentions,
    positiveRatio,
    negativeRatio,
    isLiveDb: true,
  };
}

export const socialIntelService = new SocialIntelService();
