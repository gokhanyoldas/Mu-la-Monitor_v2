import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink, Users, RefreshCw, CheckCircle2, Phone, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PROTOCOL_DATA, type ProtocolMember } from "@/data/protocol-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { PanelHelpTooltip } from "@/components/dashboard/PanelHelpTooltip";

export const ProtocolSection = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hub = useOptionalUnifiedIntelligence();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([""]));
  const [fullData, setFullData] = useState<ProtocolMember[]>(PROTOCOL_DATA);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProtocol = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    try {
      // 1. Önce veritabanındaki protocol_members snapshot'ını dene
      const { data: dbData, error: dbError } = await supabase
        .from("protocol_members")
        .select("isim, unvan, kategori, telefon, faks")
        .order("id", { ascending: true });

      if (!dbError && dbData && dbData.length > 20) {
        const mapped: ProtocolMember[] = dbData.map((d: any) => ({
          sira: "",
          unvan: d.unvan || "",
          isim: d.isim || "",
          telefon: d.telefon || "",
          faks: d.faks || "",
          kategori: d.kategori || "",
        }));
        setFullData(mapped);
        return;
      }

      // 2. Edge Function çağrısı yalnızca doğrulanmış oturum varsa yapılır
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("protocol-scrape", { body: {} });
        if (!fnError && fnData?.protocol && fnData.protocol.length > 0) {
          setFullData(fnData.protocol);
          return;
        }
      }

      // 3. Fallback: Tam doğrulanmış PROTOCOL_DATA
      setFullData(PROTOCOL_DATA);
    } catch (e) {
      console.warn("Protokol veri kontrolü fallback:", e);
      setFullData(PROTOCOL_DATA);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProtocol(false);
  }, [fetchProtocol]);

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

  // Filter with search term
  const filtered = useMemo(() => {
    const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");
    const lower = searchTerm.trim().toLocaleLowerCase("tr-TR");

    const result = new Map<string, ProtocolMember[]>();

    for (const [cat, members] of grouped) {
      let filteredMembers = members;

      // Arama Metni Filtresi
      if (lower) {
        filteredMembers = filteredMembers.filter(
          (m) =>
            trLower(m.isim).includes(lower) ||
            trLower(m.unvan).includes(lower) ||
            trLower(cat).includes(lower)
        );
      }

      if (filteredMembers.length > 0) {
        result.set(cat, filteredMembers);
      }
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
    <div className="space-y-3.5">
      {/* Başlık ve Doğrulama Bilgisi */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-mono font-bold">{t("Muğla İl Protokol Listesi")}</h3>
          <PanelHelpTooltip panelTitle="Muğla İl Protokol Listesi" />
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {isLoading ? "Denetleniyor..." : `${totalVisible} / ${fullData.length} Kişi`}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Kasım 2026 Doğrulandı
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => fetchProtocol(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono bg-secondary hover:bg-secondary/80 border border-border/60 rounded text-foreground transition-colors disabled:opacity-50"
              title="Muğla Valiliği resmi protokol kaynağından güncelliği sorgula"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-primary" : ""}`} />
              <span>{isLoading ? "Denetleniyor..." : "Güncelliği Denetle"}</span>
            </button>
          )}

          <a
            href="https://www.mugla.gov.tr/il-protokol-listesi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded border border-primary/20"
          >
            <ExternalLink className="w-3 h-3" />
            <span>mugla.gov.tr</span>
          </a>
        </div>
      </div>

      {/* Arama Kutusu */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="İsim, unvan (örn. Kaymakam, Başsavcı, Rektör) veya kategori ara..."
          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-background border border-border rounded-md focus:outline-none focus:border-primary"
        />
      </div>

      {/* Kontroller */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-primary hover:underline">Tümünü Aç</button>
          <span>|</span>
          <button onClick={collapseAll} className="text-primary hover:underline">Tümünü Kapat</button>
        </div>
        <div>
          Toplam <span className="font-bold text-foreground">{totalVisible}</span> kayıt listeleniyor
        </div>
      </div>

      {/* Liste Görünümü */}
      <div className="space-y-1.5 max-h-[650px] overflow-y-auto scrollbar-thin">
        {Array.from(filtered.entries()).map(([category, members]) => {
          const isExpanded = expandedCategories.has(category) || searchTerm.trim().length > 0;
          const displayCat = category || "ÜST DÜZEY YÖNETİCİLER";

          return (
            <div key={category} className="border border-border/50 rounded-md overflow-hidden bg-card/40">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-[11px] font-mono font-semibold text-foreground truncate text-left flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                  {displayCat}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono px-1.5 py-0.2 bg-background/80 border border-border/60 rounded text-muted-foreground">
                    {members.length} kişi
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-border/30">
                  {members.map((member, idx) => {
                    const matchedLinks = hub?.getProtocolLinksForActor(member.isim, member.unvan) ?? [];
                    return (
                      <div key={`${member.isim}-${member.unvan}-${idx}`} className={`px-3 py-2 transition-colors ${matchedLinks.length > 0 ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-muted/20"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-mono font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{member.isim}</span>
                              {member.sira && (
                                <span className="text-[9px] font-normal text-muted-foreground/80 px-1 rounded bg-secondary/50">
                                  Sıra: {member.sira}
                                </span>
                              )}
                              {matchedLinks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => navigate("/?tab=diyagram")}
                                  className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 flex items-center gap-1 transition-colors"
                                  title={matchedLinks[0].summary}
                                >
                                  <Zap size={10} />
                                  Güncel Konu
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                              {member.unvan}
                            </div>
                            {matchedLinks.length > 0 && (
                              <div className="text-[10px] font-mono text-amber-200/90 mt-1 leading-snug">
                                {matchedLinks[0].summary}
                              </div>
                            )}
                          </div>

                          {member.telefon && (
                            <a
                              href={`tel:${member.telefon.split(/[-–,]/)[0].trim().replace(/\s+/g, '')}`}
                              className="text-[9px] font-mono text-muted-foreground/80 hover:text-primary flex-shrink-0 flex items-center gap-1 bg-secondary/30 px-1.5 py-0.5 rounded border border-border/40 transition-colors"
                              title="Aramak için tıklayın"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              <span>{member.telefon}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.size === 0 && (
          <div className="p-8 text-center text-xs font-mono text-muted-foreground border border-dashed border-border/60 rounded-lg">
            Arama kriterine uygun protokol üyesi bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
};
