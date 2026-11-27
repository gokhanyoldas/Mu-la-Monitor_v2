// Presentational sentiment chart for the parent-filtered social analysis dataset.
import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid, BarChart, Bar,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";

interface DayBucket {
  date: string; // "15/05" format
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface PlatformBucket {
  platform: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface AnalysisForChart {
  platform: string;
  sentiment: string;
  collected_at?: string;
  published_at?: string;
  analyzed_at?: string;
}

export function buildSentimentHistory(analyses: AnalysisForChart[]) {
  const dayMap: Record<string, DayBucket> = {};
  const platformMap: Record<string, PlatformBucket> = {};

  for (const item of analyses) {
    const sentiment = (["positive", "negative", "neutral"].includes(item.sentiment)
      ? item.sentiment
      : "neutral") as "positive" | "negative" | "neutral";
    const timestamp = item.published_at || item.collected_at || item.analyzed_at;
    if (timestamp && Number.isFinite(Date.parse(timestamp))) {
      const day = new Date(timestamp).toLocaleDateString("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit",
      });
      if (!dayMap[day]) dayMap[day] = { date: day, positive: 0, negative: 0, neutral: 0, total: 0 };
      dayMap[day][sentiment]++;
      dayMap[day].total++;
    }

    const platform = item.platform || "other";
    if (!platformMap[platform]) platformMap[platform] = { platform, positive: 0, negative: 0, neutral: 0, total: 0 };
    platformMap[platform][sentiment]++;
    platformMap[platform].total++;
  }

  return {
    daily: Object.values(dayMap),
    platforms: Object.values(platformMap).sort((a, b) => b.total - a.total),
  };
}

const PLATFORM_LABELS: Record<string, string> = {
  google_news: "Google News", reddit: "Reddit", eksisozluk: "Ekşi Sözlük",
  local_rss: "Yerel Gazete", email_alerts: "Haber Alarmı",
  twitter: "Twitter", youtube: "YouTube", bluesky: "Bluesky", mastodon: "Mastodon",
};

export const SentimentHistoryChart = ({ analyses }: { analyses: AnalysisForChart[] }) => {
  const [view, setView] = useState<"daily" | "platform">("daily");
  const { daily, platforms } = useMemo(() => buildSentimentHistory(analyses), [analyses]);
  const totalPosts = analyses.length;

  const positiveTotal = daily.reduce((s, d) => s + d.positive, 0);
  const negativeTotal = daily.reduce((s, d) => s + d.negative, 0);
  const neutralTotal  = daily.reduce((s, d) => s + d.neutral, 0);

  const tooltip = {
    contentStyle: {
      backgroundColor: "hsl(var(--background))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 6, fontSize: 10, fontFamily: "monospace",
    },
  };

  return (
    <DashboardPanel
      title="Filtrelenmiş Duygu Trendi"
      icon={<TrendingUp size={14} />}
      badge={`${totalPosts} İÇERİK`}
      badgeVariant="default"
    >
      {totalPosts === 0 ? (
        <div className="flex items-center justify-center h-36 text-[10px] font-mono text-muted-foreground/50">
          Henüz yeterli veri yok — her gün 08:00'de otomatik eklenir
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="flex gap-3 mb-3">
            {[
              { label: "Pozitif", count: positiveTotal, color: "text-green-500" },
              { label: "Nötr",    count: neutralTotal,  color: "text-gray-400" },
              { label: "Negatif", count: negativeTotal, color: "text-red-500" },
            ].map(s => (
              <div key={s.label} className="flex-1 rounded bg-muted/20 px-2 py-1 text-center">
                <div className={`text-xs font-mono font-bold ${s.color}`}>{s.count}</div>
                <div className="text-[8px] font-mono text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-1 mb-2">
            {(["daily", "platform"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${
                  view === v
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "daily" ? "Günlük Trend" : "Platforma Göre"}
              </button>
            ))}
          </div>

          {view === "daily" ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  {[
                    { id: "pos30", color: "#22c55e" },
                    { id: "neg30", color: "#ef4444" },
                    { id: "neu30", color: "#6b7280" },
                  ].map(g => (
                    <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={g.color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 8, fontFamily: "monospace" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fontFamily: "monospace" }} allowDecimals={false} />
                <Tooltip
                  {...tooltip}
                  formatter={(val: number, name: string) => [
                    val,
                    name === "positive" ? "✅ Pozitif" : name === "negative" ? "❌ Negatif" : "⚪ Nötr",
                  ]}
                />
                <Legend
                  formatter={v => v === "positive" ? "Pozitif" : v === "negative" ? "Negatif" : "Nötr"}
                  wrapperStyle={{ fontSize: 9, fontFamily: "monospace" }}
                />
                <Area type="monotone" dataKey="neutral"  stroke="#6b7280" fill="url(#neu30)" strokeWidth={1} />
                <Area type="monotone" dataKey="positive" stroke="#22c55e" fill="url(#pos30)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="negative" stroke="#ef4444" fill="url(#neg30)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={platforms} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 8, fontFamily: "monospace" }} />
                <YAxis
                  type="category"
                  dataKey="platform"
                  tick={{ fontSize: 8, fontFamily: "monospace" }}
                  tickFormatter={v => PLATFORM_LABELS[v] ?? v}
                  width={60}
                />
                <Tooltip
                  {...tooltip}
                  formatter={(val: number, name: string) => [
                    val,
                    name === "positive" ? "✅ Pozitif" : name === "negative" ? "❌ Negatif" : "⚪ Nötr",
                  ]}
                />
                <Bar dataKey="positive" stackId="a" fill="#22c55e" />
                <Bar dataKey="neutral"  stackId="a" fill="#6b7280" />
                <Bar dataKey="negative" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="text-[8px] font-mono text-muted-foreground text-right mt-1">
            Kaynak: Sayfadaki filtrelenmiş social_posts kayıtları
          </div>
        </>
      )}
    </DashboardPanel>
  );
};
