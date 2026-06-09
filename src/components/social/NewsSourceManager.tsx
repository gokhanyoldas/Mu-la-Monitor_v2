import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Newspaper, Rss, Globe, Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NewsSource {
  id: string;
  name: string;
  url: string;
  rss_url: string | null;
  category: string;
  region: string | null;
  is_active: boolean;
  created_by: string;
}

interface NewsSourceManagerProps {
  onSourcesChange?: (sources: NewsSource[]) => void;
}

const categories = [
  { value: "newspaper", label: "Gazete",  icon: "📰" },
  { value: "portal",    label: "Portal",  icon: "🌐" },
  { value: "blog",      label: "Blog",    icon: "✍️" },
  { value: "agency",    label: "Ajans",   icon: "📡" },
];

export const NewsSourceManager = ({ onSourcesChange }: NewsSourceManagerProps) => {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", rss_url: "", category: "newspaper", region: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news_sources")
      .select("*")
      .order("region", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (!error && data) {
      setSources(data);
      onSourcesChange?.(data.filter(s => s.is_active));
    }
    setLoading(false);
  };

  const addSource = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setAdding(true);

    const { error } = await supabase.from("news_sources").insert({
      name:       form.name.trim(),
      url:        form.url.trim().replace(/\/$/, ""),
      rss_url:    form.rss_url.trim() || null,
      category:   form.category,
      region:     form.region.trim() || null,
      created_by: "user",
      is_active:  true,
    });

    if (error) {
      toast({
        title: error.code === "23505" ? "Bu kaynak zaten mevcut" : "Hata: " + error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: `"${form.name}" eklendi` });
      setForm({ name: "", url: "", rss_url: "", category: "newspaper", region: "" });
      setShowForm(false);
      await fetchSources();
    }
    setAdding(false);
  };

  const toggleSource = async (id: string, current: boolean) => {
    await supabase.from("news_sources").update({ is_active: !current }).eq("id", id);
    await fetchSources();
  };

  const deleteSource = async (id: string, name: string, createdBy: string) => {
    if (createdBy === "system") {
      toast({ title: "Sistem kaynakları silinemez, devre dışı bırakabilirsiniz", variant: "destructive" });
      return;
    }
    await supabase.from("news_sources").delete().eq("id", id);
    toast({ title: `"${name}" silindi` });
    await fetchSources();
  };

  const activeCount = sources.filter(s => s.is_active).length;
  const rssCount = sources.filter(s => s.is_active && s.rss_url).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground">Kaynaklar yükleniyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Newspaper size={9} />
            {activeCount} aktif kaynak
          </span>
          <span className="flex items-center gap-1">
            <Rss size={9} className="text-orange-400" />
            {rssCount} RSS beslemesi
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={fetchSources}
            className="text-[9px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
            title="Yenile"
          >
            <RefreshCw size={8} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-[9px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 flex items-center gap-1"
          >
            <Plus size={8} />
            Kaynak ekle
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Kaynak adı (örn: Muğla Gazetesi)"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="col-span-2 text-[10px] font-mono px-2 py-1.5 rounded bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
            <input
              type="url"
              placeholder="Ana URL (https://...)"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              className="text-[10px] font-mono px-2 py-1.5 rounded bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
            <input
              type="url"
              placeholder="RSS URL (opsiyonel)"
              value={form.rss_url}
              onChange={e => setForm({ ...form, rss_url: e.target.value })}
              className="text-[10px] font-mono px-2 py-1.5 rounded bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="text-[10px] font-mono px-2 py-1.5 rounded bg-muted/30 border border-border/50 text-foreground"
            >
              {categories.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            <input
              type="text"
              placeholder="Bölge (opsiyonel, örn: Bodrum)"
              value={form.region}
              onChange={e => setForm({ ...form, region: e.target.value })}
              className="text-[10px] font-mono px-2 py-1.5 rounded bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="text-[9px] font-mono px-2 py-1 rounded text-muted-foreground hover:text-foreground"
            >İptal</button>
            <button
              onClick={addSource}
              disabled={adding || !form.name.trim() || !form.url.trim()}
              className="text-[9px] font-mono px-3 py-1 rounded bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-40 flex items-center gap-1"
            >
              {adding ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}
              Ekle
            </button>
          </div>
        </div>
      )}

      {/* Source list */}
      <div className="space-y-1 max-h-52 overflow-y-auto">
        {sources.length === 0 && (
          <div className="text-[10px] font-mono text-muted-foreground/60 text-center py-3">
            Henüz kaynak yok
          </div>
        )}
        {sources.map(src => (
          <div
            key={src.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
              src.is_active ? "border-border/40 bg-muted/10" : "border-border/20 bg-muted/5 opacity-50"
            }`}
          >
            {/* Status indicator */}
            <button onClick={() => toggleSource(src.id, src.is_active)} title={src.is_active ? "Devre dışı bırak" : "Aktif et"}>
              {src.is_active
                ? <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                : <XCircle size={10} className="text-muted-foreground/40 shrink-0" />
              }
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-medium truncate">{src.name}</span>
                {src.rss_url && <Rss size={8} className="text-orange-400 shrink-0" title="RSS beslemesi mevcut" />}
                {src.region && (
                  <span className="text-[8px] font-mono text-muted-foreground/60 border border-border/30 px-1 rounded shrink-0">
                    {src.region}
                  </span>
                )}
              </div>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[8px] font-mono text-muted-foreground/50 hover:text-primary truncate block"
              >
                {src.url.replace(/^https?:\/\//, "")}
              </a>
            </div>

            {/* Category badge */}
            <span className="text-[8px] font-mono text-muted-foreground/50 shrink-0">
              {categories.find(c => c.value === src.category)?.icon}
            </span>

            {/* Delete (user-added only) */}
            {src.created_by === "user" && (
              <button
                onClick={() => deleteSource(src.id, src.name, src.created_by)}
                className="text-muted-foreground/40 hover:text-destructive shrink-0"
              >
                <X size={9} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
