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
import {
  useMonitorStore,
  selectProtocolOverride,
  resolveProtocolMembers,
} from "@/store/useMonitorStore";

type ProtocolDisplayMember = ProtocolMember & { district?: string | null };
type ProtocolScrapeStatus = {
  scrapedAt: string | null;
  memberCount: number | null;
  complete: boolean | null;
};

const PROTOCOL_DISTRICTS = [
  "Bodrum", "Datça", "Dalaman", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris",
  "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan",
];

const normalizeProtocolText = (value: string) =>
  value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();

const getMemberDistrict = (member: ProtocolDisplayMember) =>
  member.district ||
  PROTOCOL_DISTRICTS.find((district) =>
    normalizeProtocolText(member.unvan).includes(normalizeProtocolText(district))
  ) ||
  "";

const getMemberRole = (member: ProtocolDisplayMember) => {
  const title = normalizeProtocolText(member.unvan);
  if (title.includes("kaymakam")) return "kaymakam";
  if (title.includes("belediye baskan")) return "municipal";
  if (
    title.includes("vali") ||
    title.includes("mudur") ||
    title.includes("bassavci") ||
    title.includes("komutan") ||
    title.includes("muftu")
  ) return "institution";
  return "other";
};

export const ProtocolSection = () => {
  const { isAuthenticated } = useAuth();
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const navigate = useNavigate();
  const hub = useOptionalUnifiedIntelligence();
  const [searchTerm, setSearchTerm] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([""]));
  const [fullData, setFullData] = useState<ProtocolDisplayMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataOrigin, setDataOrigin] = useState<"empty" | "database" | "live" | "reference">("empty");
  const [scrapeStatus, setScrapeStatus] = useState<ProtocolScrapeStatus>({
    scrapedAt: null,
    memberCount: null,
    complete: null,
  });

  const protocolOverride = useMonitorStore(selectProtocolOverride);
  const resolvedMembers = useMemo(
    () => resolveProtocolMembers(fullData, protocolOverride.roleOverrides),
    [fullData, protocolOverride.roleOverrides]
  );

  const protocolIntel = useProtocolActivityIntelligence(resolvedMembers);

  const fetchProtocol = useCallback(async (runScrape = false) => {
    setIsLoading(true);
    try {
      if (runScrape) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          const { data: fnData, error: fnError } = await supabase.functions.invoke("protocol-scrape", { body: {} });
          if (fnError) throw fnError;
          if (fnData?.success && Array.isArray(fnData.protocol)) {
            setFullData(fnData.protocol as ProtocolDisplayMember[]);
            setDataOrigin("live");
            setScrapeStatus({
              scrapedAt: typeof fnData.scraped_at === "string" ? fnData.scraped_at : null,
              memberCount: Number.isFinite(fnData.member_count) ? fnData.member_count : fnData.protocol.length,
              complete: fnData.complete === true,
            });
            return;
          }
          throw new Error(fnData?.error || "Protocol scrape was rejected");
        }
      }

      const { data: dbData, error: dbError } = await supabase
        .from("protocol_members")
        .select("isim, unvan, kategori, telefon, faks, district")
        .order("id", { ascending: true });

      const { data: statusRow } = await (supabase as any)
        .from("protocol_scrape_status")
        .select("scraped_at, member_count, complete")
        .eq("id", true)
        .maybeSingle();

      if (!dbError && dbData && dbData.length > 0) {
        const mapped: ProtocolDisplayMember[] = dbData.map((d) => ({
          sira: "",
          unvan: d.unvan || "",
          isim: d.isim || "",
          telefon: d.telefon || "",
          faks: d.faks || "",
          kategori: d.kategori || "",
          district: d.district || null,
        }));
        setFullData(mapped);
        setDataOrigin("database");
        const countMatches = statusRow?.member_count === dbData.length;
        setScrapeStatus({
          scrapedAt: typeof statusRow?.scraped_at === "string" ? statusRow.scraped_at : null,
          memberCount: Number.isFinite(statusRow?.member_count) ? statusRow.member_count : null,
          complete: statusRow?.complete === true && countMatches,
        });
        return;
      }

      setFullData(PROTOCOL_DATA);
      setDataOrigin("reference");
      setScrapeStatus({ scrapedAt: null, memberCount: null, complete: null });
    } catch (e) {
      console.warn("Protokol veri kontrolü fallback:", e);
      setFullData((current) => current.length ? current : PROTOCOL_DATA);
      setDataOrigin((current) => current === "empty" ? "reference" : current);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProtocol();
  }, [fetchProtocol]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProtocolMember[]>();
    for (const m of resolvedMembers) {
      const key = m.kategori || "ÜST DÜZEY YÖNETİCİLER";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [resolvedMembers]);

  const filtered = useMemo(() => {
    const lower = normalizeProtocolText(searchTerm);

    const result = new Map<string, ProtocolMember[]>();

    for (const [cat, members] of grouped) {
      let filteredMembers = members;

      if (lower) {
        filteredMembers = filteredMembers.filter(
          (m) =>
            normalizeProtocolText(m.isim).includes(lower) ||
            normalizeProtocolText(m.unvan).includes(lower) ||
            normalizeProtocolText(cat).includes(lower) ||
            normalizeProtocolText(getMemberDistrict(m)).includes(lower)
        );
      }
      if (districtFilter) {
        filteredMembers = filteredMembers.filter((member) =>
          normalizeProtocolText(getMemberDistrict(member)) === normalizeProtocolText(districtFilter)
        );
      }
      if (roleFilter) {
        filteredMembers = filteredMembers.filter((member) =>
          getMemberRole(member) === roleFilter
        );
      }

      if (filteredMembers.length > 0) {
        result.set(cat, filteredMembers);
      }
    }

    return result;
  }, [districtFilter, grouped, roleFilter, searchTerm]);

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
  const scrapeDate = scrapeStatus.scrapedAt ? new Date(scrapeStatus.scrapedAt) : null;
  const validScrapeDate = scrapeDate && Number.isFinite(scrapeDate.getTime()) ? scrapeDate : null;
  const scrapeIsStale = validScrapeDate
    ? Date.now() - validScrapeDate.getTime() > 48 * 60 * 60 * 1000
    : false;
  const scrapeTime = validScrapeDate
    ? validScrapeDate.toLocaleString(isEn ? "en-US" : "tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="space-y-3.5">
      {/* Başlık ve Canlı 24s Protokol Taraması */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-mono font-bold">{t("Muğla İl Protokol Listesi")}</h3>
          <PanelHelpTooltip panelTitle="Muğla İl Protokol Listesi" />
          <span className="text-[10px] font-mono tabular-nums-stat text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
            {isLoading
              ? t("Denetleniyor...")
              : dataOrigin === "reference"
                ? `${isEn ? "Reference list" : t("Referans liste")} · ${fullData.length} ${isEn ? "entries" : t("Kişi")}`
                : `${fullData.length} ${isEn ? "loaded members" : t("yüklenmiş kişi")} · ${totalVisible} ${isEn ? "visible" : t("görünür")}`}
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
              onClick={() => fetchProtocol(true)}
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
      <p
        className={`text-[9px] font-mono ${scrapeIsStale || scrapeStatus.complete === false ? "text-amber-400" : "text-muted-foreground/80"}`}
        data-testid="protocol-scrape-status"
      >
        {dataOrigin === "reference"
          ? isEn
            ? "Showing the local reference list; no verified scrape time is available."
            : t("Yerel referans listesi gösteriliyor; doğrulanmış yükleme zamanı yok.")
          : scrapeTime
            ? `${isEn ? "Last successful source scrape" : t("Son başarılı kaynak taraması")}: ${scrapeTime}${scrapeIsStale ? ` · ${isEn ? "stale" : t("eski")}` : ""}${scrapeStatus.complete === false ? ` · ${isEn ? "completeness unverified" : t("tamlık doğrulanamadı")}` : ""}`
            : isEn
              ? "No successful scrape time is available; snapshot completeness is unverified."
              : t("Yüklenen verinin başarılı tarama zamanı bulunmuyor; tamlık doğrulanamadı.")}
        {dataOrigin === "database" && scrapeStatus.memberCount !== null && scrapeStatus.memberCount !== fullData.length
          ? ` · ${isEn ? "Count mismatch" : t("Kayıt sayısı uyuşmuyor")}: ${scrapeStatus.memberCount}/${fullData.length}`
          : ""}
      </p>

      {/* Arama Kutusu */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={t("İlçe, isim veya unvan ara...", "Search district, name, or title...")}
          placeholder={t("İlçe, isim veya unvan ara...", "Search district, name, or title...")}
          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-background border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={districtFilter}
          onChange={(event) => setDistrictFilter(event.target.value)}
          aria-label={t("İlçeye göre filtrele", "Filter by district")}
          className="min-w-36 px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">{t("Tüm ilçeler")}</option>
          {PROTOCOL_DISTRICTS.map((district) => <option key={district} value={district}>{district}</option>)}
        </select>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          aria-label={t("Göreve göre filtrele", "Filter by role")}
          className="min-w-40 px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">{t("Tüm görevler", "All roles")}</option>
          <option value="kaymakam">{t("Kaymakamlık", "District Governor")}</option>
          <option value="municipal">{t("Belediye Başkanlığı", "Mayor")}</option>
          <option value="institution">{t("Kurum yöneticileri", "Institution leaders")}</option>
          <option value="other">{t("Diğer görevler", "Other roles")}</option>
        </select>
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
          const isExpanded = expandedCategories.has(category) || searchTerm.trim().length > 0 || Boolean(districtFilter || roleFilter);
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
