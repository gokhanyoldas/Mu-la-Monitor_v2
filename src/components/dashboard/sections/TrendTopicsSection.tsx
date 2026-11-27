import { useState, useEffect, useMemo } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { MiniChart } from "../MiniChart";
import { TrendingUp, Flame, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useTranslation } from "@/hooks/useTranslation";
import {
  socialIntelService,
  computeSocialTrendsFromPosts,
} from "@/services/social-intel-service";
import { useMonitorStore, selectSocialFeed } from "@/store/useMonitorStore";

type TrendItem = {
  keyword: string;
  mentions: number;
  change: number;
  sentiment: "positive" | "negative" | "neutral";
};

const formatCount = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

export const TrendTopicsSection = () => {
  const { lang, t } = useTranslation();
  const isEn = lang === "en";
  const dateLocale = isEn ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";
  const { data: liveTrends, isLoading, isError, dataUpdatedAt } = useLiveData<any>("trends", {
    refetchInterval: 15 * 60 * 1000,
  });
  const socialFeed = useMonitorStore(selectSocialFeed);

  const [dbTrends, setDbTrends] = useState<{
    trends: TrendItem[];
    chartData: Array<{ name: string; value: number }>;
    totalMentions: number;
    isLiveDb: boolean;
  }>({ trends: [], chartData: [], totalMentions: 0, isLiveDb: false });

  useEffect(() => {
    let isMounted = true;
    socialIntelService.getLiveTrends().then((res) => {
      if (isMounted) {
        setDbTrends({
          trends: res.trends,
          chartData: res.chartData,
          totalMentions: res.totalMentions,
          isLiveDb: res.isLiveDb,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const storeComputed = useMemo(
    () => computeSocialTrendsFromPosts(socialFeed.items),
    [socialFeed.items]
  );

  const effectiveDb =
    dbTrends.trends.length > 0
      ? dbTrends
      : storeComputed.trends.length > 0
      ? {
          trends: storeComputed.trends,
          chartData: storeComputed.chartData,
          totalMentions: storeComputed.totalMentions,
          isLiveDb: true,
        }
      : dbTrends;

  const rawLive = Array.isArray(liveTrends)
    ? liveTrends
    : Array.isArray(liveTrends?.trending_topics)
    ? liveTrends.trending_topics
    : [];

  const hasLive = rawLive.length > 0;

  const trends: TrendItem[] =
    Array.isArray(effectiveDb.trends) &&
    effectiveDb.trends.length > 0 &&
    effectiveDb.trends.some((item) => item.mentions > 0)
      ? effectiveDb.trends
      : hasLive
      ? rawLive.map((item: any) => ({
          keyword: item.keyword?.startsWith("#") ? item.keyword : `#${item.keyword || "Muğla"}`,
          mentions: item.mentions || item.count || 1,
          change: item.change || 10,
          sentiment: (item.sentiment as TrendItem["sentiment"]) || "neutral",
        }))
      : [];

  const isLive = hasLive || effectiveDb.isLiveDb;

  const chartData =
    Array.isArray(effectiveDb.chartData) &&
    effectiveDb.chartData.length > 0 &&
    effectiveDb.chartData.some((d) => d.value > 0)
      ? effectiveDb.chartData
      : trends
          .slice(0, 7)
          .map((item) => ({ name: item.keyword.replace("#", "").slice(0, 6), value: item.mentions }));

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-3">
      <DashboardPanel
        title="Trend Konular"
        icon={<TrendingUp size={14} />}
        badge={hasLive ? "CANLI / RSS" : effectiveDb.isLiveDb ? "CANLI / DB" : "GÜNCEL"}
        badgeVariant={isLive ? "live" : "info"}
        count={trends.length}
      >
        <div className="tech-meta-only text-[9px] font-mono text-muted-foreground mb-2 flex items-center gap-2 flex-wrap">
          <span>
            {hasLive
              ? isEn
                ? "Source: Google News & Press Scan"
                : "Kaynak: Google News & Basın Taraması"
              : isEn
              ? "Source: Local Press & Social Stream"
              : "Kaynak: Canlı Yerel Basın & Sosyal Akış"}
          </span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
          <span>
            {isEn
              ? `Live Signal: ${effectiveDb.totalMentions} posts`
              : `Canlı Sinyal: ${effectiveDb.totalMentions} gönderi`}
          </span>
          {lastUpdate && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground" />
              <span>
                {isEn ? "Last" : "Son"}: {lastUpdate}
              </span>
            </>
          )}
          {isLoading && <Loader2 size={10} className="animate-spin" />}
          {isError && <AlertTriangle size={10} className="text-destructive" />}
          {isLive && <RefreshCw size={9} className="text-success" />}
        </div>

        {/* Trend list */}
        {trends.length > 0 ? (
          <div className="space-y-1.5">
            {trends.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground w-4 text-right shrink-0 tabular-nums-stat">
                    {i + 1}
                  </span>
                  {i < 3 && <Flame size={10} className="text-destructive shrink-0" aria-hidden="true" />}
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.sentiment === "positive"
                        ? "bg-success"
                        : item.sentiment === "negative"
                        ? "bg-destructive"
                        : "bg-accent"
                    }`}
                  />
                  <span className="text-xs font-mono text-foreground truncate">{item.keyword}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums-stat">
                    {formatCount(item.mentions)}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold min-w-[40px] text-right tabular-nums-stat ${
                      item.change > 0 ? "text-success" : item.change < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {item.change > 0 ? "▲" : item.change < 0 ? "▼" : "—"} {Math.abs(item.change)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[10px] font-mono text-muted-foreground">
            {isEn
              ? "Analyzing live Muğla headlines and social topics…"
              : "Muğla canlı haber ve sosyal başlıkları analiz ediliyor…"}
          </div>
        )}

        <div className="mt-3">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
            {t("Bahsetme Dağılımı")}
          </div>
          <MiniChart data={chartData} color="hsl(160, 60%, 45%)" height={50} showAxis />
        </div>

        <div className="tech-meta-only text-[8px] font-mono text-muted-foreground mt-2 text-right">
          {trends.length} {isEn ? "trends" : "trend"} •{" "}
          {isLive ? (isEn ? "Live stream" : "Canlı akış") : isEn ? "Syncing" : "Senkronize ediliyor"}
        </div>
      </DashboardPanel>
    </div>
  );
};
