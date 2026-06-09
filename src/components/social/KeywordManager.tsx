import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Tag, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Keyword {
  id: string;
  keyword: string;
  category: string;
  region: string | null;
  is_active: boolean;
  created_by: string;
}

interface KeywordManagerProps {
  onKeywordsChange?: (keywords: string[]) => void;
}

const categories = [
  { value: "general", label: "Genel", color: "border-cyan-500/40 text-cyan-400" },
  { value: "crisis", label: "Kriz", color: "border-red-500/40 text-red-400" },
  { value: "tourism", label: "Turizm", color: "border-green-500/40 text-green-400" },
  { value: "economy", label: "Ekonomi", color: "border-yellow-500/40 text-yellow-400" },
  { value: "environment", label: "Çevre", color: "border-emerald-500/40 text-emerald-400" },
];

export const KeywordManager = ({ onKeywordsChange }: KeywordManagerProps) => {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  // Fetch keywords from DB
  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("social_keywords")
      .select("*")
      .order("category", { ascending: true })
      .order("keyword", { ascending: true });

    if (error) {
      console.error("Keywords fetch error:", error);
      // Fallback to default
      setKeywords([]);
    } else {
      setKeywords(data || []);
      const activeKws = (data || []).filter(k => k.is_active).map(k => k.keyword);
      onKeywordsChange?.(activeKws);
    }
    setLoading(false);
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    setAdding(true);

    const { error } = await supabase
      .from("social_keywords")
      .insert({
        keyword: newKeyword.trim(),
        category: newCategory,
        created_by: "user",
        is_active: true,
      });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Bu keyword zaten mevcut", variant: "destructive" });
      } else {
        toast({ title: "Hata", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: `"${newKeyword.trim()}" eklendi` });
      setNewKeyword("");
      await fetchKeywords();
    }
    setAdding(false);
  };

  const toggleKeyword = async (id: string, currentState: boolean) => {
    await supabase
      .from("social_keywords")
      .update({ is_active: !currentState })
      .eq("id", id);
    await fetchKeywords();
  };

  const deleteKeyword = async (id: string, keyword: string) => {
    await supabase
      .from("social_keywords")
      .delete()
      .eq("id", id);
    toast({ title: `"${keyword}" silindi` });
    await fetchKeywords();
  };

  const activeCount = keywords.filter(k => k.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add keyword input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          placeholder="Yeni anahtar kelime..."
          className="flex-1 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="text-[10px] font-mono px-2 py-1.5 rounded-lg bg-muted/30 border border-border/50 text-foreground"
        >
          {categories.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <button
          onClick={addKeyword}
          disabled={adding || !newKeyword.trim()}
          className="text-[10px] font-mono px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 disabled:opacity-40 flex items-center gap-1"
        >
          {adding ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="text-[9px] font-mono text-muted-foreground">
        {activeCount} aktif / {keywords.length} toplam keyword
      </div>

      {/* Keyword tags grouped by category */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {categories.map(cat => {
          const catKeywords = keywords.filter(k => k.category === cat.value);
          if (catKeywords.length === 0) return null;

          return (
            <div key={cat.value}>
              <span className="text-[8px] font-mono text-muted-foreground/60 uppercase">{cat.label}</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {catKeywords.map(kw => (
                  <div
                    key={kw.id}
                    className={`inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                      kw.is_active ? cat.color : "border-border/20 text-muted-foreground/40 line-through"
                    }`}
                  >
                    <button
                      onClick={() => toggleKeyword(kw.id, kw.is_active)}
                      className="hover:opacity-70"
                      title={kw.is_active ? "Devre dışı bırak" : "Aktif et"}
                    >
                      {kw.keyword}
                    </button>
                    {kw.created_by === "user" && (
                      <button
                        onClick={() => deleteKeyword(kw.id, kw.keyword)}
                        className="hover:text-destructive ml-0.5"
                      >
                        <X size={8} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
