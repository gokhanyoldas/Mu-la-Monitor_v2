// Madde 7: İlçe bazlı mini dashboard sayfası
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DISTRICTS, getDistrictBySlug } from "@/data/districts";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusList } from "@/components/dashboard/StatusList";
import { MapPin, ArrowLeft, Users, TrendingUp, Newspaper, AlertTriangle } from "lucide-react";

interface PostItem {
  id: string;
  content: string;
  platform: string;
  sentiment: string;
  published_at: string;
  url?: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-green-500",
  negative: "text-red-500",
  neutral:  "text-gray-400",
};
const SENTIMENT_LABELS: Record<string, string> = {
  positive: "✅ Pozitif",
  negative: "❌ Negatif",
  neutral:  "⚪ Nötr",
};

const DistrictPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const district = getDistrictBySlug(slug ?? "");
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [stats, setStats] = useState({ positive: 0, negative: 0, neutral: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!district) return;
    const load = async () => {
      setIsLoading(true);
      // Search for posts matching any alias (OR conditions)
      const { data } = await supabase
        .from("social_posts")
        .select("id, content, platform, sentiment, published_at, url")
        .order("published_at", { ascending: false })
        .limit(300);

      if (data) {
        const aliases = district.aliases.map(a => a.toLocaleLowerCase("tr-TR"));
        const matched = data.filter(p =>
          p.content &&
          aliases.some(a => (p.content as string).toLocaleLowerCase("tr-TR").includes(a))
        );
        setPosts(matched.slice(0, 50));
        const pos = matched.filter(p => p.sentiment === "positive").length;
        const neg = matched.filter(p => p.sentiment === "negative").length;
        const neu = matched.filter(p => p.sentiment === "neutral").length;
        setStats({ positive: pos, negative: neg, neutral: neu, total: matched.length });
      }
      setIsLoading(false);
    };
    load();
  }, [district]);

  if (!district) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="font-mono text-sm text-muted-foreground">İlçe bulunamadı: <code>{slug}</code></p>
        <button onClick={() => navigate("/")} className="text-primary text-xs font-mono hover:underline flex items-center gap-1">
          <ArrowLeft size={12} /> Ana sayfaya dön
        </button>
      </div>
    );
  }

  const sentimentRatio = stats.total > 0
    ? Math.round((stats.positive / stats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-secondary/20 sticky top-0 z-50 px-4 py-2 flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-1 rounded hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft size={14} className="text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{district.emoji}</span>
          <div>
            <h1 className="font-mono text-sm font-bold">
              <span className="text-primary">{district.name.toUpperCase()}</span>
              <span className="text-muted-foreground text-xs ml-2">/ MUĞLA</span>
            </h1>
            <p className="text-[9px] font-mono text-muted-foreground">{district.description}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          {district.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[8px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary rounded">
              {t}
            </span>
          ))}
        </div>
      </header>

      {/* District selector strip */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-thin border-b border-border/30 bg-secondary/10">
        {DISTRICTS.map(d => (
          <button
            key={d.slug}
            onClick={() => navigate(`/ilce/${d.slug}`)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap transition-colors ${
              d.slug === slug
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span>{d.emoji}</span> {d.name}
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

        {/* Col 1 — Demographics */}
        <div className="space-y-3">
          <DashboardPanel title="İlçe Bilgileri" icon={<MapPin size={14} />}>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatCard label="Nüfus" value={district.population.toLocaleString("tr-TR")} variant="primary" />
              <StatCard label="Yüzölçümü" value={district.area_km2.toLocaleString("tr-TR")} unit="km²" />
              <StatCard label="Tür" value={district.type === "coastal" ? "Kıyı" : "İç Kesimleri"} />
              <StatCard label="Koordinat" value={`${district.lat.toFixed(2)}, ${district.lng.toFixed(2)}`} />
            </div>
            <StatusList items={[
              { label: "Toplam Gönderi", value: String(stats.total), status: stats.total > 10 ? "ok" : "warning" },
              { label: "Pozitif Oran", value: `${sentimentRatio}%`, status: sentimentRatio >= 50 ? "ok" : "warning" },
              ...(district.tags.map(t => ({ label: "Etiket", value: t, status: "info" as const }))).slice(0, 3),
            ]} />
          </DashboardPanel>

          <DashboardPanel title="Sosyal Duygu Özeti" icon={<TrendingUp size={14} />} badge="CANLI" badgeVariant="live">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center">
                <div className="text-base font-mono font-bold text-green-500">{stats.positive}</div>
                <div className="text-[8px] font-mono text-muted-foreground">Pozitif</div>
              </div>
              <div className="text-center">
                <div className="text-base font-mono font-bold text-gray-400">{stats.neutral}</div>
                <div className="text-[8px] font-mono text-muted-foreground">Nötr</div>
              </div>
              <div className="text-center">
                <div className="text-base font-mono font-bold text-red-500">{stats.negative}</div>
                <div className="text-[8px] font-mono text-muted-foreground">Negatif</div>
              </div>
            </div>
            {/* Sentiment bar */}
            <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden flex mt-1">
              <div className="bg-green-500 h-full" style={{ width: `${stats.total > 0 ? (stats.positive / stats.total) * 100 : 0}%` }} />
              <div className="bg-gray-400 h-full" style={{ width: `${stats.total > 0 ? (stats.neutral / stats.total) * 100 : 0}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${stats.total > 0 ? (stats.negative / stats.total) * 100 : 0}%` }} />
            </div>
            {stats.total === 0 && !isLoading && (
              <p className="text-[9px] font-mono text-muted-foreground mt-2 text-center">
                Bu ilçeye ait sosyal medya verisi bulunamadı
              </p>
            )}
          </DashboardPanel>
        </div>

        {/* Col 2 & 3 — Social posts */}
        <div className="xl:col-span-2 space-y-3">
          <DashboardPanel
            title={`${district.name} Sosyal Medya Akışı`}
            icon={<Newspaper size={14} />}
            badge={isLoading ? "YÜKLENİYOR" : `${posts.length} POST`}
            badgeVariant="live"
          >
            {isLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <AlertTriangle size={24} className="text-muted-foreground/30" />
                <p className="text-[10px] font-mono text-muted-foreground">
                  Bu ilçeye ait sosyal medya içeriği henüz toplanmadı
                </p>
                <p className="text-[9px] font-mono text-muted-foreground/60">
                  Aranılan anahtar kelimeler: {district.aliases.join(", ")}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto scrollbar-thin">
                {posts.map(p => (
                  <div key={p.id} className="px-2.5 py-2 rounded bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {p.platform}
                      </span>
                      <span className={`text-[8px] font-mono ${SENTIMENT_COLORS[p.sentiment] ?? "text-gray-400"}`}>
                        {SENTIMENT_LABELS[p.sentiment] ?? "⚪ Nötr"}
                      </span>
                      <span className="text-[8px] font-mono text-muted-foreground ml-auto">
                        {p.published_at
                          ? new Date(p.published_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-foreground/80 line-clamp-2 leading-relaxed">
                      {p.content}
                    </p>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] font-mono text-primary/70 hover:text-primary mt-0.5 block truncate"
                      >
                        🔗 {p.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 px-4 py-2 flex items-center justify-between">
        <p className="text-[8px] font-mono text-muted-foreground">
          Muğla Monitör — {district.name} İlçe Sayfası
        </p>
        <button
          onClick={() => navigate("/")}
          className="text-[8px] font-mono text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={10} /> Ana Panele Dön
        </button>
      </div>
    </div>
  );
};

export default DistrictPage;
