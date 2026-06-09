import { supabase } from "@/integrations/supabase/client";

export interface SocialPost {
  id: string;
  platform: string;
  content: string;
  author: string;
  url: string;
  published_at: string;
  keywords_matched: string[];
  sentiment: string | null;
  sentiment_confidence: number | null;
  sentiment_method: string | null;
  collected_at: string;
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

    return data || [];
  }

  getConnectionStatus() {
    return {
      isConnected: true,
      source: "Supabase Edge Functions",
      lastUpdate: new Date().toLocaleTimeString("tr-TR"),
      dataSource: "Google News RSS + Reddit + Ekşi Sözlük + HuggingFace AI",
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
    const { data, error } = await supabase.functions.invoke("social-cron", { body: {} });
    if (error) return { success: false };
    return { success: true, collected: data?.collected, analyzed: data?.analyzed };
  }
}

export const socialIntelService = new SocialIntelService();
