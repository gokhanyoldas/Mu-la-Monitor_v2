import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, ChevronDown, ChevronUp, ExternalLink, Users, RefreshCw, Phone, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PROTOCOL_DATA, type ProtocolMember } from "@/data/protocol-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { PanelHelpTooltip } from "@/components/dashboard/PanelHelpTooltip";
import {
  useProtocolActivityIntelligence,
  getProtocolMemberKey,
} from "@/services/topicGroundingService";

export const ProtocolSection = () => {
  const { isAuthenticated } = useAuth();
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const navigate = useNavigate();
  const hub = useOptionalUnifiedIntelligence();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([""]));
  const [fullData, setFullData] = useState<ProtocolMember[]>(PROTOCOL_DATA);
  const [isLoading, setIsLoading] = useState(false);

  const protocolIntel = useProtocolActivityIntelligence(fullData);

  const fetchProtocol = useCallback(async () => {
    setIsLoading(true);
    try {
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

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke("protocol-scrape", { body: {} });
        if (!fnError && fnData?.protocol && fnData.protocol.length > 0) {
          setFullData(fnData.protocol);
          return;
        }
      }

      setFullData(PROTOCOL_DATA);
    } catch (e) {
      console.warn("Protokol veri kontrolü fallback:", e);
      setFullData(PROTOCOL_DATA);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProtocol();
  }, [fetchProtocol]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProtocolMember[]>();
    for (const m of fullData) {
      const key = m.kategori || "ÜST DÜZEY YÖNETİCİLER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [fullData]);

  const filtered = useMemo(() => {
    const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");
    const lower = searchTerm.trim().toLocaleLowerCase("tr-TR");

    const result = new Map<string, ProtocolMember[]>();

    for (const [cat, members] of grouped) {
      let filteredMembers = members;

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
      {/* Başlık ve Canlı 24s Protokol Taraması */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-mono font-bold">{t("Muğla İl Protokol Listesi")}</h3>
          <PanelHelpTooltip panelTitle="Muğla İl Protokol Listesi" />
          <span className="text-[10px] font-mono tabular-nums-stat text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {isLoading ? t("Denetleniyor...") : `${totalVisible} / ${fullData.length} ${t("Kişi")}`}
          </span>
          {protocolIntel.hasVerifiedLiveData && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              <Zap className="w-3 h-3" aria-hidden="true" />
              {isEn
                ? `${protocolIntel.matchedMemberCount} live 24h updates`
                : `Son 24s: ${protocolIntel.matchedMemberCount} güncel kayıt`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => fetchProtocol()}
              disabled={isLoading}
              aria-label={t("Güncelliği Denetle")}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono bg-secondary hover:bg-secondary/80 border border-border/60 rounded text-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={t("Muğla Valiliği resmi protokol kaynağından güncelliği sorgula")}
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-primary" : ""}`} aria-hidden="true" />
              <span>{isLoading ? t("Denetleniyor...") : t("Güncelliği Denetle")}</span>
            </button>
          )}

          <a
            href="https://www.mugla.gov.tr/il-protokol-listesi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1 rounded border border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            <span>mugla.gov.tr</span>
          </a>
        </div>
      </div>

      <p className="text-[9px] font-mono text-muted-foreground/80" data-testid="protocol-source-note">
        {translate(protocolIntel.latestSourceSummary)}
      </p>

      {/* Arama Kutusu */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={t("İsim, unvan (örn. Kaymakam, Başsavcı, Rektör) veya kategori ara...")}
          placeholder={t("İsim, unvan (örn. Kaymakam, Başsavcı, Rektör) veya kategori ara...")}
          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-background border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {/* Kontroller */}
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("Tümünü Aç")}
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("Tümünü Kapat")}
          </button>
        </div>
        <div>
          {t("Toplam")} <span className="font-bold text-foreground tabular-nums-stat">{totalVisible}</span>{" "}
          {t("kayıt listeleniyor")}
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
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="text-[11px] font-mono font-semibold text-foreground truncate text-left flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                  {translate(displayCat)}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono tabular-nums-stat px-1.5 py-0.2 bg-background/80 border border-border/60 rounded text-muted-foreground">
                    {members.length} {isEn ? "people" : "kişi"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-border/30">
                  {members.map((member, idx) => {
                    const matchedLinks = hub?.getProtocolLinksForActor(member.isim, member.unvan) ?? [];
                    const liveActs = protocolIntel.byMemberKey.get(getProtocolMemberKey(member)) ?? [];
                    const hasActivity = matchedLinks.length > 0 || liveActs.length > 0;
                    return (
                      <div
                        key={`${member.isim}-${member.unvan}-${idx}`}
                        className={`px-3 py-2 transition-colors ${
                          hasActivity ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-mono font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{member.isim}</span>
                              {member.sira && (
                                <span className="text-[9px] font-normal text-muted-foreground/80 px-1 rounded bg-secondary/50">
                                  {t("Sıra")}: {member.sira}
                                </span>
                              )}
                              {matchedLinks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => navigate("/?tab=diyagram")}
                                  className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  title={matchedLinks[0].summary}
                                >
                                  <Zap size={10} aria-hidden="true" />
                                  {t("Güncel Konu")}
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                              {member.unvan}
                            </div>
                            {matchedLinks.length > 0 && (
                              <div className="text-[10px] font-mono text-amber-200/90 mt-1 leading-snug">
                                {translate(matchedLinks[0].summary)}
                              </div>
                            )}
                            {liveActs.length > 0 && (
                              <a
                                href={liveActs[0].sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[10px] font-mono text-emerald-300/90 hover:underline mt-1 leading-snug"
                              >
                                • {translate(liveActs[0].summary)} ({liveActs[0].sourceName})
                              </a>
                            )}
                          </div>

                          {member.telefon && (
                            <a
                              href={`tel:${member.telefon.split(/[-–,]/)[0].trim().replace(/\s+/g, "")}`}
                              className="text-[9px] font-mono text-muted-foreground/80 hover:text-primary flex-shrink-0 flex items-center gap-1 bg-secondary/30 px-1.5 py-0.5 rounded border border-border/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              title={t("Aramak için tıklayın")}
                              aria-label={`${member.isim} — ${member.telefon}`}
                            >
                              <Phone className="w-2.5 h-2.5" aria-hidden="true" />
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
            {t("Arama kriterine uygun protokol üyesi bulunamadı.")}
          </div>
        )}
      </div>
    </div>
  );
};
