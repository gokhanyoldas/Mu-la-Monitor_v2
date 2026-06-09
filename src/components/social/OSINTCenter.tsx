// src/components/social/OSINTCenter.tsx
// Sosyal Medya İstihbarat (OSINT) Merkezi
// ─ Username/Account lookup across 12 platforms (no API keys)
// ─ Muğla Geo-Monitor: live feed filtered by district
// ─ Search History: persisted in Supabase osint_searches
//
// How it works:
//   Username Lookup → calls supabase function osint-lookup → returns platform presence
//   Geo Monitor     → queries social_posts table directly with district filter
//   History         → reads osint_searches table

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Eye, MapPin, Clock, ExternalLink, Loader2,
  AlertCircle, CheckCircle2, XCircle, HelpCircle,
  Trash2, RefreshCw, User, Globe, Shield, Radio,
  ChevronDown, ChevronUp, Terminal, Flame, Camera, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { relativeTime } from "@/lib/time-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformResult {
  platform: string;
  label: string;
  icon: string;
  profileUrl: string;
  status: "found" | "not_found" | "link_only" | "error";
  method: "api" | "head" | "link";
}

interface LookupResult {
  username: string;
  results: PlatformResult[];
  found_count: number;
  searched_at: string;
}

interface SearchHistoryRow {
  id: string;
  query: string;
  results: PlatformResult[];
  found_count: number;
  platform_count: number;
  searched_at: string;
}

interface GeoPost {
  id: string;
  platform: string;
  content: string;
  author: string;
  url: string;
  published_at: string;
  region?: string | null;
  sentiment?: string | null;
  keywords_matched?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MUGLA_DISTRICTS = [
  "Tümü", "Muğla Merkez", "Bodrum", "Fethiye", "Marmaris",
  "Datça", "Dalaman", "Milas", "Köyceğiz", "Ortaca",
  "Menteşe", "Yatağan", "Seydikemer",
];

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  found:     { icon: <CheckCircle2 size={12} />, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", label: "Bulundu" },
  not_found: { icon: <XCircle size={12} />,      color: "text-red-400 border-red-500/30 bg-red-500/10",             label: "Yok" },
  link_only: { icon: <ExternalLink size={12} />, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",          label: "Bağlantı" },
  error:     { icon: <HelpCircle size={12} />,   color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",   label: "Bilinmiyor" },
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-emerald-400 bg-emerald-500/10",
  negative: "text-red-400 bg-red-500/10",
  neutral:  "text-slate-400 bg-slate-500/10",
};

const PLATFORM_COLORS: Record<string, string> = {
  news:        "bg-blue-500/20 text-blue-300",
  reddit:      "bg-orange-500/20 text-orange-300",
  eksisozluk:  "bg-green-500/20 text-green-300",
  twitter:     "bg-sky-500/20 text-sky-300",
  talkwalker:  "bg-purple-500/20 text-purple-300",
  google_alerts: "bg-yellow-500/20 text-yellow-300",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TerminalHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
      </div>
      <div>
        <p className="text-xs font-mono font-bold text-cyan-400 tracking-wider">{title}</p>
        <p className="text-[9px] font-mono text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function ScanLine() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg opacity-20">
      <div className="animate-scan-line h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Username Lookup Panel ────────────────────────────────────────────────────

function UsernameLookup() {
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<LookupResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});

  const handleSearch = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("osint-lookup", {
        body: { username: query.trim().replace(/^@/, "") },
      });
      if (fnErr) throw new Error(fnErr.message);
      setResult(data as LookupResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Arama başarısız");
    } finally {
      setLoading(false);
    }
  }, [query, loading]);

  const foundResults  = result?.results.filter(r => r.status === "found")  ?? [];
  const linkResults   = result?.results.filter(r => r.status === "link_only") ?? [];
  const notFound      = result?.results.filter(r => r.status === "not_found") ?? [];

  return (
    <div className="relative rounded-lg border border-cyan-500/20 bg-slate-950/80 p-4 overflow-hidden">
      <ScanLine />
      <TerminalHeader
        title="[KULLANICI ADI TARAMA]"
        subtitle="12 platformda ücretsiz kullanıcı tespiti — API anahtarı gerekmez"
      />

      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500 w-3.5 h-3.5" />
          <Input
            placeholder="kullanıcı_adı gir..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="pl-8 font-mono text-xs bg-slate-900 border-cyan-500/30 text-cyan-100 placeholder:text-slate-600 focus:border-cyan-400 h-8"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          size="sm"
          className="h-8 px-3 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-300 font-mono text-xs"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {loading ? "TARANYOR..." : "TARA"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 rounded border border-red-500/30 bg-red-950/30 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <p className="text-[10px] font-mono text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-slate-700">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-xs text-cyan-300 font-bold">@{result.username}</span>
            <span className="font-mono text-[10px] text-slate-400 ml-auto">
              {foundResults.length} platforma <span className="text-emerald-400">doğrulandı</span>
              {" · "}{linkResults.length} <span className="text-cyan-400">link</span>
              {" · "}{notFound.length} <span className="text-red-400">yok</span>
            </span>
          </div>

          {/* Confirmed found */}
          {foundResults.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-emerald-400 mb-1.5 uppercase tracking-widest flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" /> Doğrulanmış Hesaplar ({foundResults.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {foundResults.map(r => (
                  <a key={r.platform} href={r.profileUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 transition-colors group">
                    <span className="text-base leading-none">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-mono font-semibold text-emerald-300 truncate">{r.label}</p>
                      <StatusBadge status={r.status} />
                    </div>
                    <ExternalLink className="w-3 h-3 text-emerald-600 group-hover:text-emerald-400 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Link-only platforms */}
          {linkResults.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(e => ({ ...e, links: !e.links }))}
                className="text-[9px] font-mono text-cyan-500 mb-1.5 uppercase tracking-widest flex items-center gap-1 hover:text-cyan-400"
              >
                <Globe className="w-2.5 h-2.5" />
                Profil Linkleri ({linkResults.length})
                {expanded.links ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expanded.links && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {linkResults.map(r => (
                    <a key={r.platform} href={r.profileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded border border-cyan-500/20 bg-cyan-950/10 hover:bg-cyan-950/30 transition-colors group">
                      <span className="text-base leading-none">{r.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-mono text-cyan-300 truncate">{r.label}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <ExternalLink className="w-3 h-3 text-cyan-700 group-hover:text-cyan-400 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {!result && !loading && !error && (
        <div className="text-center py-6">
          <User className="w-8 h-8 text-cyan-800 mx-auto mb-2" />
          <p className="text-[10px] font-mono text-slate-600">Bir kullanıcı adı girerek 12 platformda tarama başlat</p>
          <p className="text-[9px] font-mono text-slate-700 mt-1">API anahtarı gerekmez</p>
        </div>
      )}
    </div>
  );
}

// ─── Geo Monitor Panel ────────────────────────────────────────────────────────

function GeoMonitor() {
  const [district, setDistrict]   = useState("Tümü");
  const [posts, setPosts]         = useState<GeoPost[]>([]);
  const [loading, setLoading]     = useState(false);
  const [total, setTotal]         = useState(0);

  const loadPosts = useCallback(async (selectedDistrict: string) => {
    setLoading(true);
    try {
      let q = supabase
        .from("social_posts")
        .select("id,platform,content,author,url,published_at,region,sentiment,keywords_matched")
        .order("published_at", { ascending: false })
        .limit(40);

      if (selectedDistrict !== "Tümü") {
        q = q.eq("region", selectedDistrict);
      } else {
        // Show all posts that have a region (geo-tagged)
        q = q.not("region", "is", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      setPosts((data as GeoPost[]) ?? []);

      // Count total
      let cq = supabase.from("social_posts").select("id", { count: "exact", head: true });
      if (selectedDistrict !== "Tümü") cq = cq.eq("region", selectedDistrict);
      else cq = cq.not("region", "is", null);
      const { count } = await cq;
      setTotal(count ?? 0);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(district); }, [district, loadPosts]);

  return (
    <div className="relative rounded-lg border border-purple-500/20 bg-slate-950/80 p-4 overflow-hidden">
      <ScanLine />
      <TerminalHeader
        title="[COĞRAFİ İZLEME — MUĞLA]"
        subtitle="Koordinat bazlı sosyal medya akışı — ilçe filtreli"
      />

      {/* District selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {MUGLA_DISTRICTS.map(d => (
          <button
            key={d}
            onClick={() => setDistrict(d)}
            className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors whitespace-nowrap ${
              district === d
                ? "bg-purple-600/30 text-purple-300 border-purple-500/50"
                : "bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300 hover:border-slate-600"
            }`}
          >
            {d === "Tümü" ? "🗺 " + d : "📍 " + d}
          </button>
        ))}
        <button
          onClick={() => loadPosts(district)}
          className="ml-auto text-[9px] font-mono px-2 py-1 rounded border border-purple-500/30 text-purple-400 hover:bg-purple-950/30 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 inline-block mr-1 ${loading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mb-3 px-2 py-1.5 rounded bg-slate-900/50 border border-slate-800">
        <div className="text-[9px] font-mono text-purple-400">
          <span className="text-white font-bold">{total}</span> gönderi
        </div>
        <div className="text-[9px] font-mono text-slate-500">
          📍 {district === "Tümü" ? "Tüm Muğla" : district}
        </div>
        {loading && <Loader2 className="w-3 h-3 text-purple-400 animate-spin ml-auto" />}
      </div>

      {/* Feed */}
      <ScrollArea className="h-80">
        {posts.length === 0 && !loading ? (
          <div className="text-center py-10">
            <MapPin className="w-8 h-8 text-purple-800 mx-auto mb-2" />
            <p className="text-[10px] font-mono text-slate-600">
              {district !== "Tümü" ? `${district} için konum etiketli gönderi bulunamadı` : "Coğrafi etiketli gönderi yok"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 pr-2">
            {posts.map(p => (
              <div key={p.id} className="rounded border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-colors p-2.5 group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${PLATFORM_COLORS[p.platform] ?? "bg-slate-500/20 text-slate-300"}`}>
                      {p.platform}
                    </span>
                    {p.region && (
                      <span className="text-[9px] font-mono text-purple-400 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />{p.region}
                      </span>
                    )}
                    {p.sentiment && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${SENTIMENT_COLORS[p.sentiment] ?? SENTIMENT_COLORS.neutral}`}>
                        {p.sentiment === "positive" ? "+" : p.sentiment === "negative" ? "−" : "○"}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-slate-600 whitespace-nowrap flex-shrink-0">
                    <Clock className="w-2.5 h-2.5 inline-block mr-0.5" />
                    {relativeTime(new Date(p.published_at))}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-300 line-clamp-2 leading-relaxed mb-1">
                  {p.content}
                </p>
                {p.url && p.url !== "#" && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] font-mono text-cyan-600 hover:text-cyan-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-2.5 h-2.5" /> Kaynağa git
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Search History Panel ─────────────────────────────────────────────────────

function SearchHistory() {
  const [rows, setRows]       = useState<SearchHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("osint_searches")
      .select("id,query,results,found_count,platform_count,searched_at")
      .order("searched_at", { ascending: false })
      .limit(20);
    setRows((data as SearchHistoryRow[]) ?? []);
    setLoading(false);
  }, []);

  const deleteRow = useCallback(async (id: string) => {
    await supabase.from("osint_searches").delete().eq("id", id);
    setRows(r => r.filter(x => x.id !== id));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <p className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">Geçmiş Aramalar</p>
        </div>
        <button onClick={loadHistory} className="text-[9px] font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="text-[10px] font-mono text-slate-600 text-center py-4">Henüz arama yapılmadı</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(row => (
            <div key={row.id} className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-slate-900/30 hover:bg-slate-900/60 transition-colors group">
              <User className="w-3 h-3 text-slate-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-400">@{row.query}</span>
                  <span className="text-[9px] font-mono text-emerald-400">{row.found_count} bulundu</span>
                </div>
                <span className="text-[9px] font-mono text-slate-600">
                  {new Date(row.searched_at).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{row.platform_count} platform
                </span>
              </div>
              <div className="flex items-center gap-1">
                {(row.results as PlatformResult[] | null)
                  ?.filter(r => r.status === "found")
                  .slice(0, 3)
                  .map(r => (
                    <a key={r.platform} href={r.profileUrl} target="_blank" rel="noopener noreferrer"
                      title={r.label} className="text-sm hover:scale-125 transition-transform">
                      {r.icon}
                    </a>
                  ))}
              </div>
              <button
                onClick={() => deleteRow(row.id)}
                className="ml-2 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-400 transition-all flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Crisis Image Intel Panel ─────────────────────────────────────────────────
// No API key required: keyword scan on post content for crisis signals.
// Extracts image URLs from content where present; flags all crisis posts.

const CRISIS_KW = [
  "yangın", "yanıyor", "alev", "ateş",
  "kaza", "çarpışma",
  "duman", "boğuluyor",
  "sel", "taşkın",
  "deprem", "sarsıntı",
  "patlama", "bomba",
  "ölü", "yaralı", "ölüm",
  "acil", "ambulans", "itfaiye", "kurtarma",
  "kalabalık", "izdiham",
];

const CRISIS_LABELS: Record<string, string> = {
  yangın: "🔥 Yangın", yanıyor: "🔥 Yangın", alev: "🔥 Yangın", ateş: "🔥 Yangın",
  kaza: "💥 Kaza", çarpışma: "💥 Kaza",
  duman: "💨 Duman", boğuluyor: "💨 Duman",
  sel: "🌊 Sel", taşkın: "🌊 Sel",
  deprem: "🌍 Deprem", sarsıntı: "🌍 Deprem",
  patlama: "💣 Patlama", bomba: "💣 Patlama",
  ölü: "☠️ Kayıp", yaralı: "🩺 Yaralı", ölüm: "☠️ Kayıp",
  acil: "🚨 Acil", ambulans: "🚑 Ambulans", itfaiye: "🚒 İtfaiye", kurtarma: "⛑️ Kurtarma",
  kalabalık: "👥 Kalabalık", izdiham: "👥 İzdiham",
};

function detectCrisisLabels(content: string): string[] {
  const lower = content.toLowerCase();
  const found = new Set<string>();
  for (const kw of CRISIS_KW) {
    if (lower.includes(kw) && CRISIS_LABELS[kw]) found.add(CRISIS_LABELS[kw]);
  }
  return Array.from(found);
}

function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  // Markdown images: ![alt](url)
  const mdImages = content.matchAll(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|gif|webp)[^)]*)\)/gi);
  for (const m of mdImages) urls.push(m[1]);
  // Plain http image links
  const plainImages = content.matchAll(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s"'<>]*)?/gi);
  for (const m of plainImages) if (!urls.includes(m[0])) urls.push(m[0]);
  return urls.slice(0, 2);
}

interface CrisisPost {
  id?: string;
  platform: string;
  content: string;
  author?: string | null;
  url?: string | null;
  published_at?: string | null;
  crisis_labels: string[];
  image_urls: string[];
}

function ImageIntel() {
  const [posts, setPosts]     = useState<CrisisPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal]     = useState(0);

  const loadCrisisPosts = useCallback(async () => {
    setLoading(true);
    try {
      // Build OR filter for crisis keywords
      const kws = ["yangın", "kaza", "deprem", "sel", "patlama", "duman", "ölü", "yaralı", "acil", "itfaiye"];
      const orFilter = kws.map(kw => `content.ilike.%${kw}%`).join(",");

      const { data, error } = await supabase
        .from("social_posts")
        .select("id,platform,content,author,url,published_at")
        .or(orFilter)
        .order("published_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const mapped: CrisisPost[] = (data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        platform: p.platform as string,
        content: p.content as string,
        author: p.author as string | null,
        url: p.url as string | null,
        published_at: p.published_at as string | null,
        crisis_labels: detectCrisisLabels(p.content as string),
        image_urls: extractImageUrls(p.content as string),
      }));

      setPosts(mapped);
      setTotal(mapped.length);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrisisPosts();

    // Real-time subscription for new crisis posts
    const channel = supabase
      .channel("crisis_intel_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_posts" }, (payload) => {
        const p = payload.new as Record<string, unknown>;
        const labels = detectCrisisLabels(p.content as string);
        if (labels.length === 0) return; // not a crisis post
        setPosts(prev => [{
          id: p.id as string,
          platform: p.platform as string,
          content: p.content as string,
          author: p.author as string | null,
          url: p.url as string | null,
          published_at: p.published_at as string | null,
          crisis_labels: labels,
          image_urls: extractImageUrls(p.content as string),
        }, ...prev.slice(0, 29)]);
        setTotal(t => t + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadCrisisPosts]);

  return (
    <div className="relative rounded-lg border border-red-500/20 bg-slate-950/80 p-4 overflow-hidden">
      <ScanLine />
      <TerminalHeader
        title="[GÖRSEL & İÇERİK İSTİHBARATI]"
        subtitle="Kriz anahtar kelime tarama — API gerektirmez — gerçek zamanlı"
      />

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-3 px-2 py-1.5 rounded bg-slate-900/50 border border-red-800/30">
        <Flame className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        <span className="text-[9px] font-mono text-red-300">
          <span className="font-bold text-white">{total}</span> KRİZ İÇERİĞİ TESPİT EDİLDİ
        </span>
        <button onClick={loadCrisisPosts} className="ml-auto text-[9px] font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
        <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />CANLI
        </span>
      </div>

      {posts.length === 0 && !loading ? (
        <div className="text-center py-8">
          <Camera className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-[10px] font-mono text-slate-600">Kriz anahtar kelimesi içeren gönderi bulunamadı</p>
          <p className="text-[9px] font-mono text-slate-700 mt-1">yangın · kaza · deprem · sel · patlama · duman</p>
        </div>
      ) : (
        <ScrollArea className="h-80">
          <div className="space-y-2 pr-2">
            {posts.map((p, idx) => (
              <div key={p.id ?? idx}
                className="rounded border border-red-900/40 bg-red-950/10 hover:bg-red-950/20 transition-colors p-2.5 group">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap gap-1">
                    {p.crisis_labels.map(label => (
                      <span key={label} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/15 text-red-300 font-bold">
                        {label}
                      </span>
                    ))}
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${PLATFORM_COLORS[p.platform] ?? "bg-slate-500/20 text-slate-300"}`}>
                      {p.platform}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">
                    <Clock className="w-2.5 h-2.5 inline-block mr-0.5" />
                    {p.published_at ? relativeTime(new Date(p.published_at)) : "?"}
                  </span>
                </div>

                {/* Content */}
                <p className="text-[10px] font-mono text-slate-200 line-clamp-3 leading-relaxed mb-1.5">
                  {p.content}
                </p>

                {/* Extracted images */}
                {p.image_urls.length > 0 && (
                  <div className="flex gap-2 mb-1.5">
                    {p.image_urls.map((imgUrl, i) => (
                      <a key={i} href={imgUrl} target="_blank" rel="noopener noreferrer"
                        className="relative group/img">
                        <img src={imgUrl} alt="crisis" loading="lazy"
                          className="h-16 w-24 object-cover rounded border border-red-500/30 opacity-80 group-hover/img:opacity-100 transition-opacity" />
                        <span className="absolute top-1 left-1 text-[8px] font-mono bg-red-900/80 text-red-300 px-1 rounded">
                          ⚠ KRİZ
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                {/* Severity bar */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {Array.from({ length: Math.min(p.crisis_labels.length, 5) }).map((_, i) => (
                      <div key={i} className="h-1 rounded-full bg-red-500/60 flex-1" />
                    ))}
                    {Array.from({ length: Math.max(0, 5 - p.crisis_labels.length) }).map((_, i) => (
                      <div key={i} className="h-1 rounded-full bg-slate-700 flex-1" />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono text-red-400">SEVİYE {p.crisis_labels.length}/5</span>
                  {p.url && p.url !== "#" && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] font-mono text-cyan-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function OSINTCenter() {
  const [activePanel, setActivePanel] = useState<"username" | "geo" | "history" | "crisis">("username");

  const panels = [
    { id: "username" as const, label: "Kullanıcı Tarama",  icon: <User className="w-3.5 h-3.5" />,   color: "cyan" },
    { id: "geo"      as const, label: "Coğrafi İzleme",    icon: <MapPin className="w-3.5 h-3.5" />, color: "purple" },
    { id: "history"  as const, label: "Geçmiş Aramalar",   icon: <Clock className="w-3.5 h-3.5" />,  color: "slate" },
    { id: "crisis"   as const, label: "Kriz İstihbaratı",   icon: <Flame className="w-3.5 h-3.5" />,  color: "red" },
  ];

  return (
    <div className="space-y-4">
      {/* OSINT Header */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-cyan-500/20 bg-gradient-to-r from-slate-950 via-cyan-950/20 to-slate-950">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
          <Eye className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xs font-mono font-bold text-cyan-300 tracking-wider uppercase">
            Sosyal Medya İstihbarat Merkezi
          </h2>
          <p className="text-[9px] font-mono text-slate-500">
            Open Source Intelligence (OSINT) · Ücretsiz · API Anahtarı Gerektirmez
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5">
          <span className="status-dot-live w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-mono text-emerald-400">CANLI</span>
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1.5">
        {panels.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePanel(p.id)}
            className={`flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded border transition-colors ${
              activePanel === p.id
                ? p.color === "cyan"   ? "bg-cyan-600/20 text-cyan-300 border-cyan-500/40"
                : p.color === "purple" ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                : p.color === "red"    ? "bg-red-600/20 text-red-300 border-red-500/40"
                :                        "bg-slate-600/20 text-slate-300 border-slate-500/40"
                : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
            }`}
          >
            {p.icon}{p.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {activePanel === "username" && <UsernameLookup />}
      {activePanel === "geo"      && <GeoMonitor />}
      {activePanel === "history"  && <SearchHistory />}
      {activePanel === "crisis"   && <ImageIntel />}
    </div>
  );
}
