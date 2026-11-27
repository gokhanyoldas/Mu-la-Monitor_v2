// Correlates the shared, already-filtered Social dataset with metric categories.
import { useState } from "react";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CorrelatedEvent {
  id: string;
  event_time: string;
  content: string;
  platform: string;
  sentiment: string;
  category: string;    // 'weather', 'social', 'news'
  metric_hint?: string; // e.g. "AQI yükselişi sırasında"
  url?: string;
}

interface SocialCorrelationPost {
  id?: string;
  published_at?: string;
  content: string;
  platform: string;
  sentiment: string;
  category?: string;
  source_url?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  environment: "🌿", earthquake: "🔴", economy: "💰",
  tourism: "⛵", weather: "🌤️", transport: "🚗",
  energy: "⚡", security: "🛡️", genel: "📰",
};

const SENTIMENT_ICON: Record<string, React.ReactNode> = {
  positive: <TrendingUp size={10} className="text-green-500" />,
  negative: <TrendingDown size={10} className="text-red-500" />,
  neutral:  <Minus size={10} className="text-gray-400" />,
};

export const NewsDataCorrelation = ({ analyses }: { analyses: SocialCorrelationPost[] }) => {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const events: CorrelatedEvent[] = analyses
    .filter((post) => post.category && post.category !== "general")
    .map((post, index) => ({
      id: post.id ?? `social-${index}`,
      event_time: post.published_at ?? "",
      content: post.content,
      platform: post.platform,
      sentiment: post.sentiment,
      category: post.category ?? "genel",
      url: post.source_url,
    }));

  const categories = ["all", ...Array.from(new Set(events.map(e => e.category)))];

  const filtered = activeCategory === "all"
    ? events
    : events.filter(e => e.category === activeCategory);

  // Category summary counts
  const catCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardPanel
      title="Haber × Veri Korelasyonu"
      icon={<Zap size={14} />}
      badge={`${events.length} OLAY`}
      badgeVariant={events.filter(e => e.sentiment === "negative").length > 5 ? "alert" : "live"}
    >
      {events.length === 0 ? (
        <p className="text-[10px] font-mono text-muted-foreground text-center py-6">
          Filtrelenmiş sosyal içerikte kategorize edilmiş olay bulunamadı
        </p>
      ) : (
        <>
          {/* Category filter chips */}
          <div className="flex flex-wrap gap-1 mb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-0.5 text-[8px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                  activeCategory === cat
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat === "all"
                  ? `Tümü (${events.length})`
                  : `${CATEGORY_ICONS[cat] ?? "•"} ${cat} (${catCounts[cat] ?? 0})`}
              </button>
            ))}
          </div>

          {/* Event list */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
            {filtered.slice(0, 30).map(e => (
              <div key={e.id} className="flex items-start gap-2 px-2.5 py-1.5 rounded bg-muted/20 hover:bg-muted/30 transition-colors">
                <span className="text-sm flex-shrink-0 mt-0.5">
                  {CATEGORY_ICONS[e.category] ?? "📰"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    {SENTIMENT_ICON[e.sentiment]}
                    {e.metric_hint && (
                      <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-primary/10 text-primary">
                        {e.metric_hint}
                      </span>
                    )}
                    <span className="text-[8px] font-mono text-muted-foreground ml-auto">
                      {e.event_time
                        ? new Date(e.event_time).toLocaleString("tr-TR", {
                            timeZone: "Europe/Istanbul",
                            day: "2-digit", month: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-foreground/80 line-clamp-1">{e.content}</p>
                  <span className="text-[8px] font-mono text-muted-foreground/60">{e.platform}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardPanel>
  );
};
