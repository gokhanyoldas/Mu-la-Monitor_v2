// Madde 7: İlçe bazlı mini dashboard sayfası
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DISTRICTS, getDistrictBySlug } from "@/data/districts";
import { PROTOCOL_DATA } from "@/data/protocol-data";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusList } from "@/components/dashboard/StatusList";
import { MapPin, ArrowLeft, TrendingUp, Newspaper, Phone, Landmark, Globe, Loader2, Sparkles, Radio } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import {
  getDistrictBaselineFeed,
  fetchDistrictSearchGroundedFeed,
  type DistrictFeedItem,
} from "@/data/districtSocialBaselines";
import { extractLexiconMatches } from "@/services/livingLexiconService";
import { toast } from "sonner";

interface PostItem {
  id: string;
  content: string;
  platform: string;
  sentiment: string;
  published_at: string;
  url?: string;
  author?: string;
  sourceKind?: DistrictFeedItem["sourceKind"];
  matchedTerms?: string[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-green-500",
  negative: "text-red-500",
  neutral:  "text-gray-400",
};

const DistrictPage = () => {
  const { lang, t, translate } = useTranslation();
  const { slug, ilceId } = useParams<{ slug?: string; ilceId?: string }>();
  const param = slug ?? ilceId ?? "";
  const navigate = useNavigate();
  const district = getDistrictBySlug(param);

  const {
    lexicon,
    ingestedDistrictPosts,
    getProtocolLinksForActor,
  } = useUnifiedIntelligence();

  const [dbPosts, setDbPosts] = useState<PostItem[]>([]);
  const [groundedPosts, setGroundedPosts] = useState<DistrictFeedItem[]>([]);
  const [groundingSources, setGroundingSources] = useState<Array<{ uri: string; title: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGrounding, setIsGrounding] = useState(false);

  const sentimentLabels: Record<string, string> = {
    positive: `✅ ${t("Pozitif", "Pozitif")}`,
    negative: `❌ ${t("Negatif", "Negatif")}`,
    neutral:  `⚪ ${t("Nötr", "Nötr")}`,
  };

  useEffect(() => {
    if (!district) return;
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setGroundedPosts([]);
      setGroundingSources([]);
      try {
        const { data } = await supabase
          .from("social_posts")
          .select("id, content, platform, sentiment, published_at, url, author")
          .order("published_at", { ascending: false })
          .limit(300);

        if (mounted && data) {
          const districtLexiconTerms = lexicon
            .filter((l) => l.district && l.district.toLocaleLowerCase("tr-TR") === district.name.toLocaleLowerCase("tr-TR"))
            .map((l) => l.term.toLocaleLowerCase("tr-TR"));
          const aliases = Array.from(
            new Set([
              ...district.aliases.map((a) => a.toLocaleLowerCase("tr-TR")),
              district.name.toLocaleLowerCase("tr-TR"),
              ...districtLexiconTerms,
            ])
          );
          const matched = data.filter(
            (p) =>
              p.content &&
              aliases.some((a) => (p.content as string).toLocaleLowerCase("tr-TR").includes(a))
          );
          setDbPosts(
            matched.slice(0, 50).map((m) => ({
              id: m.id,
              content: m.content,
              platform: m.platform,
              sentiment: m.sentiment || "neutral",
              published_at: m.published_at,
              url: m.url || undefined,
              author: m.author || undefined,
              sourceKind: "db",
            }))
          );
        }
      } catch {
        // graceful fallback to curated baseline + ingested posts
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [district, lexicon]);

  const handleRunSearchGrounding = async () => {
    if (!district || isGrounding) return;
    setIsGrounding(true);
    try {
      const districtLexicon = lexicon
        .filter((l) => !l.district || l.district.toLocaleLowerCase("tr-TR") === district.name.toLocaleLowerCase("tr-TR"))
        .slice(0, 12)
        .map((l) => l.term);

      const res = await fetchDistrictSearchGroundedFeed({
        districtSlug: district.slug,
        districtName: district.name,
        aliases: district.aliases,
        lexiconTerms: districtLexicon,
      });

      if (res.usedLiveSearch && res.posts.length > 0) {
        setGroundedPosts(res.posts);
        setGroundingSources(res.groundingSources);
        toast.success(`${district.name} için ${res.posts.length} güncel haber eklendi.`);
      } else {
        toast.info(`${district.name} için güncel yerel kayıtlar gösteriliyor.`);
      }
    } finally {
      setIsGrounding(false);
    }
  };

  // Merge: Ingested field posts -> Search Grounding -> Supabase DB -> Curated 13-District Baseline
  const posts = useMemo<PostItem[]>(() => {
    if (!district) return [];
    const matchingIngested = ingestedDistrictPosts
      .filter((p) => p.districtSlug === district.slug)
      .map((p) => ({
        ...p,
        sourceKind: "field-ingested" as const,
      }));
    const baseline = getDistrictBaselineFeed(district.slug);
    const combined = [...matchingIngested, ...groundedPosts, ...dbPosts, ...baseline];

    const seen = new Set<string>();
    const deduped: PostItem[] = [];
    for (const item of combined) {
      const key = item.content.slice(0, 80).toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);
      const lexMatches =
        item.matchedTerms && item.matchedTerms.length > 0
          ? item.matchedTerms
          : extractLexiconMatches(item.content, lexicon).map((m) => m.term);
      deduped.push({
        ...item,
        matchedTerms: lexMatches.slice(0, 4),
      });
    }
    return deduped;
  }, [district, ingestedDistrictPosts, groundedPosts, dbPosts, lexicon]);

  const stats = useMemo(() => {
    const positive = posts.filter((p) => p.sentiment === "positive").length;
    const negative = posts.filter((p) => p.sentiment === "negative").length;
    const neutral = posts.filter((p) => p.sentiment === "neutral").length;
    return { positive, negative, neutral, total: posts.length };
  }, [posts]);

  if (!district) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="font-mono text-sm text-muted-foreground">İlçe bulunamadı: <code>{param}</code></p>
        <button onClick={() => navigate("/")} className="text-primary text-xs font-mono hover:underline flex items-center gap-1">
          <ArrowLeft size={12} /> {t("Ana sayfaya dön", "Ana sayfaya dön")}
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
            <p className="text-[9px] font-mono text-muted-foreground">{translate(district.description)}</p>
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          {district.tags.slice(0, 3).map(tTag => (
            <span key={tTag} className="text-[8px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary rounded">
              {t(tTag, tTag)}
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
              d.slug === district.slug
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

        {/* Col 1 — Demographics + Protokol */}
        <div className="space-y-3">
          <DashboardPanel title="İlçe Bilgileri" icon={<MapPin size={14} />}>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatCard label="Nüfus" value={district.population.toLocaleString(lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR")} variant="primary" />
              <StatCard label="Yüzölçümü" value={district.area_km2.toLocaleString(lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR")} unit="km²" />
              <StatCard label="Tür" value={district.type === "coastal" ? t("Kıyı", "Kıyı") : t("İç Kesimleri", "İç Kesimleri")} />
              <StatCard label="Koordinat" value={`${district.lat.toFixed(2)}, ${district.lng.toFixed(2)}`} />
            </div>
            <StatusList items={[
              { label: "Toplam Gönderi", value: String(stats.total), status: stats.total > 2 ? "ok" : "warning" },
              { label: "Pozitif Oran", value: `${sentimentRatio}%`, status: sentimentRatio >= 40 ? "ok" : "warning" },
              ...(district.tags.map(tTag => ({ label: "Etiket", value: t(tTag, tTag), status: "info" as const }))).slice(0, 3),
            ]} />
          </DashboardPanel>

          <DashboardPanel title="Sosyal Duygu Özeti" icon={<TrendingUp size={14} />} badge="CANLI" badgeVariant="live">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center">
                <div className="text-base font-mono font-bold text-green-500">{stats.positive}</div>
                <div className="text-[8px] font-mono text-muted-foreground">{t("Pozitif", "Pozitif")}</div>
              </div>
              <div className="text-center">
                <div className="text-base font-mono font-bold text-gray-400">{stats.neutral}</div>
                <div className="text-[8px] font-mono text-muted-foreground">{t("Nötr", "Nötr")}</div>
              </div>
              <div className="text-center">
                <div className="text-base font-mono font-bold text-red-500">{stats.negative}</div>
                <div className="text-[8px] font-mono text-muted-foreground">{t("Negatif", "Negatif")}</div>
              </div>
            </div>
            {/* Sentiment bar */}
            <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden flex mt-1">
              <div className="bg-green-500 h-full" style={{ width: `${stats.total > 0 ? (stats.positive / stats.total) * 100 : 0}%` }} />
              <div className="bg-gray-400 h-full" style={{ width: `${stats.total > 0 ? (stats.neutral / stats.total) * 100 : 0}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${stats.total > 0 ? (stats.negative / stats.total) * 100 : 0}%` }} />
            </div>
          </DashboardPanel>

          {/* Protokol — Kaymakam & Belediye Başkanı (valilik listesi + Aktif Saha Gündemi bağlantısı) */}
          {(() => {
            const lookupName = district.name === "Kavaklidere" ? "Kavaklıdere" : district.name === "Muğla Merkez" ? "Menteşe" : district.name;
            const officials = PROTOCOL_DATA.filter(m =>
              m.unvan.toLocaleLowerCase("tr-TR") === `${lookupName} kaymakamı`.toLocaleLowerCase("tr-TR") ||
              m.unvan.toLocaleLowerCase("tr-TR") === `${lookupName} belediye başkanı`.toLocaleLowerCase("tr-TR") ||
              m.unvan.toLocaleLowerCase("tr-TR").includes(`${lookupName} kaymakamı`.toLocaleLowerCase("tr-TR"))
            );
            if (officials.length === 0) return null;
            return (
              <DashboardPanel title="İlçe Protokolü" icon={<Landmark size={14} />} badge="RESMİ" badgeVariant="info">
                <div className="space-y-2">
                  {officials.map(o => {
                    const agendaLinks = getProtocolLinksForActor(o.isim, o.unvan, district.name);
                    return (
                      <div key={o.unvan} className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[9px] font-mono text-muted-foreground uppercase">{o.unvan}</div>
                          {agendaLinks.length > 0 && (
                            <button
                              type="button"
                              onClick={() => navigate("/?tab=diyagram")}
                              className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
                              title={agendaLinks[0].summary}
                            >
                              Güncel Konu
                            </button>
                          )}
                        </div>
                        <div className="text-xs font-bold text-foreground mt-0.5">{o.isim}</div>
                        {o.telefon && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-primary mt-1">
                            <Phone size={10} /> (0252) {o.telefon.split("-")[0].trim()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <a
                    href="https://www.mugla.gov.tr/il-protokol-listesi"
                    target="_blank" rel="noopener noreferrer"
                    className="block text-[9px] font-mono text-muted-foreground hover:text-primary text-center pt-1 transition-colors"
                  >
                    Kaynak: mugla.gov.tr il protokol listesi ↗
                  </a>
                </div>
              </DashboardPanel>
            );
          })()}
        </div>

        {/* Col 2 & 3 — Social posts + Google Search Grounding */}
        <div className="xl:col-span-2 space-y-3">
          <DashboardPanel
            title={`${district.name} Sosyal Medya Akışı`}
            subtitle="Yerel Basın ve Sosyal Medya Akışı"
            icon={<Newspaper size={14} />}
            badge={isLoading ? "YÜKLENİYOR" : `${posts.length} POST`}
            badgeVariant="live"
          >
            {/* Canlı Tarama Araç Çubuğu */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-border/40">
              <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <Radio size={11} className="text-emerald-400" />
                <span>Aranan terimler: {district.aliases.slice(0, 5).join(", ")}</span>
              </div>
              <button
                type="button"
                onClick={handleRunSearchGrounding}
                disabled={isGrounding}
                className="px-2.5 py-1 rounded border border-primary/40 bg-primary/15 hover:bg-primary/25 text-primary text-[10px] font-mono font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isGrounding ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
                <span>{isGrounding ? "Güncel Haberler Aranıyor..." : "Güncel Haberleri Tara"}</span>
              </button>
            </div>

            {isLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-[540px] overflow-y-auto scrollbar-thin">
                {posts.map(p => (
                  <div key={p.id} className={`px-3 py-2 rounded border transition-colors ${
                    p.sourceKind === "field-ingested"
                      ? "bg-rose-950/20 border-rose-500/40"
                      : p.sourceKind === "search-grounding"
                      ? "bg-emerald-950/20 border-emerald-500/40"
                      : "bg-muted/20 border-border/30 hover:bg-muted/30"
                  }`}>
                    <div className="flex items-center flex-wrap gap-1.5 mb-1">
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                        {p.platform}
                      </span>
                      {p.author && (
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {p.author}
                        </span>
                      )}
                      {p.sourceKind === "search-grounding" && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-0.5">
                          <Sparkles size={8} /> Web Kaynağı
                        </span>
                      )}
                      {p.sourceKind === "field-ingested" && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                          Yerel Bildirim
                        </span>
                      )}
                      <span className={`text-[8px] font-mono ${SENTIMENT_COLORS[p.sentiment] ?? "text-gray-400"}`}>
                        {sentimentLabels[p.sentiment] ?? `⚪ ${t("Nötr", "Nötr")}`}
                      </span>
                      <span className="text-[8px] font-mono text-muted-foreground ml-auto">
                        {p.published_at
                          ? new Date(p.published_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })
                          : "—"}
                      </span>
                    </div>
                    <p className="text-[11px] font-sans text-foreground/90 leading-relaxed">
                      {p.content}
                    </p>
                    {p.matchedTerms && p.matchedTerms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.matchedTerms.map((term) => (
                          <span key={term} className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50">
                            #{term}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] font-mono text-primary/70 hover:text-primary mt-1 block truncate"
                      >
                        🔗 {p.url}
                      </a>
                    )}
                  </div>
                ))}

                {groundingSources.length > 0 && (
                  <div className="p-2 rounded border border-emerald-500/30 bg-emerald-950/15 mt-2">
                    <div className="text-[9px] font-mono font-bold text-emerald-300 mb-1">
                      Kaynak Bağlantıları:
                    </div>
                    <div className="space-y-0.5">
                      {groundingSources.slice(0, 4).map((src, idx) => (
                        <a
                          key={idx}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[9px] font-mono text-emerald-200/80 hover:underline truncate"
                        >
                          ↗ {src.title || src.uri}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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
