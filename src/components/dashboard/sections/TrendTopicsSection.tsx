import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { MiniChart } from "../MiniChart";
import { TrendingUp, Flame, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

type TrendItem = {
  keyword: string;
  mentions: number;
  change: number;
  sentiment: "positive" | "negative" | "neutral";
};

const fallbackTrends: TrendItem[] = [
  { keyword: "#Bodrum", mentions: 4820, change: 45, sentiment: "positive" },
  { keyword: "Muğla Turizm", mentions: 3200, change: 22, sentiment: "positive" },
  { keyword: "#Fethiye", mentions: 2980, change: 34, sentiment: "positive" },
  { keyword: "#Marmaris", mentions: 2340, change: 18, sentiment: "positive" },
  { keyword: "Datça", mentions: 1560, change: 28, sentiment: "positive" },
  { keyword: "Dalaman", mentions: 1240, change: 12, sentiment: "neutral" },
  { keyword: "#Milas", mentions: 890, change: 8, sentiment: "neutral" },
  { keyword: "#Köyceğiz", mentions: 650, change: 15, sentiment: "positive" },
];

const trendChartFallback = [
  { name: "Pzt", value: 3200 }, { name: "Sal", value: 4100 }, { name: "Çar", value: 3800 },
  { name: "Per", value: 5200 }, { name: "Cum", value: 4600 }, { name: "Cmt", value: 6100 },
  { name: "Paz", value: 5800 },
];

const formatCount = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

export const TrendTopicsSection = () => {
  const { data: liveTrends, isLoading, isError, dataUpdatedAt } = useLiveData<any>("trends", { refetchInterval: 15 * 60 * 1000 });

  const trends: TrendItem[] = Array.isArray(liveTrends) && liveTrends.length > 0
    ? liveTrends.map((t: any) => ({
        keyword: t.keyword || "",
        mentions: t.mentions || 0,
        change: t.change || 0,
        sentiment: (t.sentiment as TrendItem["sentiment"]) || "neutral",
      }))
    : fallbackTrends;

  const isLive = Array.isArray(liveTrends) && liveTrends.length > 0;

  // Build chart data from top trends
  const chartData = isLive
    ? trends.slice(0, 7).map((t) => ({ name: t.keyword.replace("#", "").slice(0, 6), value: t.mentions }))
    : trendChartFallback;

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="space-y-3">
      <DashboardPanel title="Trend Konular" icon={<TrendingUp size={14} />} badge={isLive ? "CANLI" : "ÖNBELLEK"} badgeVariant={isLive ? "live" : "info"} count={trends.length}>
        <div className="text-[9px] font-mono text-muted-foreground mb-2 flex items-center gap-2">
          <span>Kaynak: Firecrawl Web Arama</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground" />
          <span>Her 15 dk güncellenir</span>
          {lastUpdate && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground" />
              <span>Son: {lastUpdate}</span>
            </>
          )}
          {isLoading && <Loader2 size={10} className="animate-spin" />}
          {isError && <AlertTriangle size={10} className="text-destructive" />}
          {isLive && <RefreshCw size={9} className="text-success" />}
        </div>

        {/* Trend list */}
        <div className="space-y-1.5">
          {trends.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                {i < 3 && <Flame size={10} className="text-destructive shrink-0" />}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.sentiment === "positive" ? "bg-success" :
                  item.sentiment === "negative" ? "bg-destructive" : "bg-accent"
                }`} />
                <span className="text-xs font-mono text-foreground truncate">{item.keyword}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-mono text-muted-foreground">{formatCount(item.mentions)}</span>
                <span className={`text-[10px] font-mono font-bold min-w-[40px] text-right ${
                  item.change > 0 ? "text-success" : item.change < 0 ? "text-destructive" : "text-muted-foreground"
                }`}>
                  {item.change > 0 ? "▲" : item.change < 0 ? "▼" : "—"} {Math.abs(item.change)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Bahsetme Dağılımı</div>
          <MiniChart data={chartData} color="hsl(160, 60%, 45%)" height={50} showAxis />
        </div>

        <div className="text-[8px] font-mono text-muted-foreground mt-2 text-right">
          {trends.length} trend • {isLive ? "Web'den canlı çekildi" : "Önbellek verisi"}
        </div>
      </DashboardPanel>
    </div>
  );
};
