import { useState, useMemo, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink, Users, RefreshCw } from "lucide-react";
import { PROTOCOL_DATA, type ProtocolMember } from "@/data/protocol-data";
import { supabase } from "@/integrations/supabase/client";

export const ProtocolSection = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([""]));
  const [fullData, setFullData] = useState<ProtocolMember[]>(PROTOCOL_DATA);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch full protocol from Edge Function on mount
  useEffect(() => {
    const fetchFull = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("protocol-scrape", { body: {} });
        if (!error && data?.protocol && data.protocol.length > 0) {
          setFullData(data.protocol);
        }
      } catch (e) {
        console.error("Protocol fetch error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFull();
  }, []);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, ProtocolMember[]>();
    for (const m of fullData) {
      const key = m.kategori || "ÜST DÜZEY YÖNETİCİLER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [fullData]);

  // Filter
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return grouped;
    // Turkish-locale case fold: handles İ→i, I→ı, Ş→ş, Ğ→ğ correctly
    const lower = searchTerm.toLocaleLowerCase('tr-TR');
    const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
    const result = new Map<string, ProtocolMember[]>();
    for (const [cat, members] of grouped) {
      const matches = members.filter(
        (m) =>
          trLower(m.isim).includes(lower) ||
          trLower(m.unvan).includes(lower) ||
          trLower(cat).includes(lower)
      );
      if (matches.length > 0) result.set(cat, matches);
    }
    return result;
  }, [grouped, searchTerm]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const expandAll = () => setExpandedCategories(new Set(filtered.keys()));
  const collapseAll = () => setExpandedCategories(new Set());

  const totalVisible = Array.from(filtered.values()).reduce((s, a) => s + a.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-mono font-bold">İl Protokol Listesi</h3>
          <span className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {isLoading ? "..." : `${totalVisible} / ${fullData.length}`} kişi
          </span>
        </div>
        <a
          href="https://www.mugla.gov.tr/il-protokol-listesi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-mono text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          mugla.gov.tr
        </a>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="İsim, unvan veya kategori ara..."
          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-background border border-border rounded-md focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={expandAll} className="text-[9px] font-mono text-primary hover:underline">Tümünü Aç</button>
        <span className="text-[9px] text-muted-foreground">|</span>
        <button onClick={collapseAll} className="text-[9px] font-mono text-primary hover:underline">Tümünü Kapat</button>
      </div>

      <div className="space-y-1 max-h-[600px] overflow-y-auto scrollbar-thin">
        {Array.from(filtered.entries()).map(([category, members]) => {
          const isExpanded = expandedCategories.has(category) || searchTerm.trim().length > 0;
          const displayCat = category || "ÜST DÜZEY YÖNETİCİLER";

          return (
            <div key={category} className="border border-border/50 rounded-md overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-[10px] font-mono font-semibold text-foreground truncate text-left">
                  {displayCat}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono text-muted-foreground">{members.length}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-border/30">
                  {members.map((member, idx) => (
                    <div key={`${member.isim}-${idx}`} className="px-2.5 py-1.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-mono font-medium text-foreground truncate">{member.isim}</div>
                          <div className="text-[9px] font-mono text-muted-foreground truncate">{member.unvan}</div>
                        </div>
                        {member.telefon && (
                          <div className="text-[8px] font-mono text-muted-foreground/70 flex-shrink-0">
                            📞 {member.telefon}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
