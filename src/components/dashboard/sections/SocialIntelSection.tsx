import { useState, useEffect, useMemo } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { MiniChart } from "../MiniChart";
import { Gauge } from "../Gauge";
import { Radio, MessageCircle, Hash, Loader2, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLiveData } from "@/hooks/useLiveData";
import {
  socialIntelService,
  computeSocialTrendsFromPosts,
  type ComputedSocialTrends,
} from "@/services/social-intel-service";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { formatRelativeTime } from "@/lib/time-utils";
import {
  useMonitorStore,
  selectSocialFeed,
  selectActiveDistrict,
  selectMonitorTabs,
} from "@/store/useMonitorStore";

export const SocialIntelSection = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const { data: trendsData, isLoading: liveLoading } = useLiveData<any>("trends", { refetchInterval: 15 * 60 * 1000 });
  const { lexicon, arbitratedEvents } = useUnifiedIntelligence();
  const socialFeed = useMonitorStore(selectSocialFeed);
  const activeDistrict = useMonitorStore(selectActiveDistrict);
  const monitorTabs = useMonitorStore(selectMonitorTabs);

  const [dbData, setDbData] = useState<ComputedSocialTrends>({
    trends: [],
    chartData: [],
    platformBreakdown: [],
    recentHeadlines: [],
    totalMentions: 0,
    positiveRatio: 0,
    negativeRatio: 0,
    isLiveDb: false,
  });

  useEffect(() => {
    let isMounted = true;
    socialIntelService.getLiveTrends().then((res) => {
      if (isMounted) {
        setDbData(res);
        if (res.isLiveDb || res.totalMentions > 0) {
          useMonitorStore.getState().setSocialFeed({
            totalMentions: res.totalMentions,
            positiveRatio: res.positiveRatio,
            negativeRatio: res.negativeRatio,
            lastUpdatedAt: new Date().toISOString(),
          });
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Store'daki gerçek social_posts kayıtlarından anlık hesaplama (getLiveTrends ile çelişkiyi tamamen önler)
  const storeComputed = useMemo(
    () => computeSocialTrendsFromPosts(socialFeed.items),
    [socialFeed.items]
  );

  const effectiveSocial = useMemo(() => {
    if (dbData.totalMentions > 0) return dbData;
    if (storeComputed.totalMentions > 0) return storeComputed;
    return dbData;
  }, [dbData, storeComputed]);

  const rawLive = Array.isArray(trendsData)
    ? trendsData
    : Array.isArray(trendsData?.trending_topics)
    ? trendsData.trending_topics
    : [];

  const hasLiveFeed = rawLive.length > 0;
  const isLive =
    hasLiveFeed ||
    effectiveSocial.isLiveDb ||
    socialFeed.totalMentions > 0 ||
    socialFeed.items.length > 0 ||
    arbitratedEvents.length > 0;

  const baseMentions =
    effectiveSocial.totalMentions > 0
      ? effectiveSocial.totalMentions
      : socialFeed.totalMentions > 0
      ? socialFeed.totalMentions
      : hasLiveFeed
      ? rawLive.reduce((a: number, t: any) => a + (t.mentions || t.count || 0), 0)
      : 0;
  const totalMentions = baseMentions + arbitratedEvents.length;

  // Step 1: Cumulative append-only LivingLexicon replaces fixed 8 fallback
  const activeKeywords = lexicon.length;

  const positiveRate =
    effectiveSocial.totalMentions > 0 ? effectiveSocial.positiveRatio : socialFeed.positiveRatio;
  const negativeRate =
    effectiveSocial.totalMentions > 0 ? effectiveSocial.negativeRatio : socialFeed.negativeRatio;

  const mentionTrend =
    Array.isArray(effectiveSocial.chartData) &&
    effectiveSocial.chartData.length > 0 &&
    effectiveSocial.chartData.some((d) => d.value > 0)
      ? effectiveSocial.chartData
      : [];

  const sentimentTrend = mentionTrend.map((d) => ({
    name: d.name,
    value: positiveRate,
  }));

  const platformBreakdown =
    Array.isArray(effectiveSocial.platformBreakdown) && effectiveSocial.platformBreakdown.length > 0
      ? effectiveSocial.platformBreakdown
      : totalMentions > 0
      ? [{ label: "Yerel Basın & Sosyal Akış", value: `${totalMentions} içerik`, status: "ok" as const }]
      : [];

  const summaryText =
    monitorTabs?.sosyal?.summary ||
    (effectiveSocial.recentHeadlines.length > 0
      ? `Son ${totalMentions} içerikte öne çıkan başlıklar: ${effectiveSocial.recentHeadlines
          .slice(0, 2)
          .map((h) => h.title)
          .join(" • ")}`
      : null);

  return (
    <div className="space-y-3">
      <DashboardPanel
        title="Sosyal Medya Gündemi"
        icon={<Radio size={14} />}
        badge={isLive ? "CANLI" : "AKTİF"}
        badgeVariant={isLive ? "live" : "active"}
      >
        {liveLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard
            label="Toplam Paylaşım"
            value={totalMentions >= 1000 ? `${(totalMentions / 1000).toFixed(1)}K` : String(totalMentions)}
            change={totalMentions > 0 ? Math.max(1, Math.min(25, Math.round(totalMentions / 20))) : undefined}
            variant="primary"
            icon={<MessageCircle size={12} />}
          />
          <StatCard
            label="İzlenen Konular"
            value={`${activeKeywords}+`}
            unit="konu"
            variant="accent"
            icon={<Hash size={12} />}
            info="13 ilçe ve yerel gündem başlıklarını kapsayan aktif takip kapsamı"
          />
        </div>

        {summaryText && (
          <div
            data-testid="social-live-summary"
            className="mb-3 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-2 text-[10px] font-sans text-foreground/90 leading-snug"
          >
            {summaryText}
          </div>
        )}

        <div className="mb-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
            Haftalık Bahsetme Trendi
          </div>
          <MiniChart data={mentionTrend} color="hsl(200, 80%, 50%)" height={50} showAxis />
        </div>

        <div className="flex justify-around mb-3">
          <Gauge value={positiveRate} max={100} label="Pozitif Oran" variant="primary" />
          <Gauge value={negativeRate} max={100} label="Negatif Oran" variant="destructive" />
        </div>

        {platformBreakdown.length > 0 ? (
          <StatusList items={platformBreakdown} />
        ) : (
          <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[10px] font-mono text-muted-foreground">
            {isEn
              ? "Connecting to live Muğla social & local press stream…"
              : "Muğla sosyal medya ve yerel basın akışı senkronize ediliyor…"}
          </div>
        )}

        <div className="mt-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
            Duygu Analizi Trendi
          </div>
          <MiniChart data={sentimentTrend} color="hsl(160, 60%, 45%)" height={50} showAxis />
        </div>

        {socialFeed.lastUpdatedAt && (
          <p className="mt-2 text-[9px] font-mono text-muted-foreground/75 text-right">
            {isEn ? "Updated" : "Son güncelleme"}: {formatRelativeTime(socialFeed.lastUpdatedAt, lang)}
          </p>
        )}

        <Link
          to={activeDistrict ? `/ilce/${activeDistrict}` : "/social-intel"}
          className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-mono text-primary hover:text-primary/90 transition-colors py-2 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 font-semibold"
        >
          <BarChart3 size={13} />
          SOSYAL MEDYA & KAMUOYU AKIŞINI GÖRÜNTÜLE →
        </Link>
      </DashboardPanel>
    </div>
  );
};
