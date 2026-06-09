import { useMemo, useState, useEffect } from "react";
import { Users, TrendingUp, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { PROTOCOL_DATA, type ProtocolMember } from "@/data/protocol-data";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────
interface AnalysisItem {
  platform: string;
  content: string;
  sentiment: string;
  sentiment_score: number;
  source_author: string;
  engagement_count: number;
  summary?: string;
  source_url?: string;
  region?: string;
  collected_at?: string;
}

interface MentionResult {
  member: ProtocolMember;
  mentions: AnalysisItem[];
  positive: number;
  negative: number;
  neutral: number;
}

interface Props {
  analyses: AnalysisItem[];
  /** When set, parent feed will be filtered to this member's name */
  onMemberFilter?: (nameQuery: string | null) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const TITLE_PREFIXES = [
  "dr.", "doç.dr.", "doç.", "prof.dr.", "prof.", "op.dr.", "op.",
  "uzm.dr.", "uzm.", "yrd.doç.dr.", "yrd.doç.", "avukat", "av.",
  "mühendis", "müh.", "flt.kom.", "tüm.", "tuğ.", "org.", "kor.",
  "j.general", "j.tuğg.", "j.kor.", "j.tüm.",
];

/**
 * Strip Turkish academic/military titles and return searchable name.
 * "Dr. İdris AKBIYIK" → "idris akbıyık"
 */
function extractSearchName(rawName: string): string {
  let name = rawName.toLowerCase().trim();
  for (const t of TITLE_PREFIXES) {
    // Remove title at word boundary start
    if (name.startsWith(t + " ")) name = name.slice(t.length).trim();
    if (name.startsWith(t)) name = name.slice(t.length).trim();
  }
  return name;
}

/**
 * Turkish-safe case fold: handles İ/I/ı/i
 */
function turkishLower(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

/**
 * Returns true if any part of the post content mentions the member.
 * Strategy: full name match first, surname match as fallback (min 4 chars).
 */
function mentionsMember(content: string, searchName: string): boolean {
  const haystack = turkishLower(content);
  const needle = turkishLower(searchName);
  if (haystack.includes(needle)) return true;
  // Surname (last word, must be ≥4 chars to avoid false positives)
  const parts = needle.split(/\s+/);
  const surname = parts[parts.length - 1];
  if (surname.length >= 4 && haystack.includes(surname)) return true;
  return false;
}

// ── Component ──────────────────────────────────────────────────────────────
export const ProtocolMentionPanel = ({ analyses, onMemberFilter }: Props) => {
  const [members, setMembers] = useState<ProtocolMember[]>(PROTOCOL_DATA);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Fetch full protocol list from Edge Function (same as ProtocolSection)
  useEffect(() => {
    supabase.functions
      .invoke("protocol-scrape", { body: {} })
      .then(({ data, error }) => {
        if (!error && data?.protocol?.length > 0) {
          setMembers(data.protocol as ProtocolMember[]);
        }
      })
      .catch(() => {/* fallback to PROTOCOL_DATA */});
  }, []);

  // ── Sync protocol member names into social_keywords (top officials only)
  useEffect(() => {
    if (members.length === 0) return;
    const priorityCategories = new Set([
      "",                            // Vali (no kategori)
      "T.B.M.M ÜYELERİ",
      "BÜYÜKŞEHİR BELEDİYE BAŞKANI, BAKAN YARDIMCISI, İL BELEDİYE BAŞKANI",
      "VALİ YARDIMCILARI, KAYMAKAMLAR, İL GENEL KOLLUĞUN EN ÜST AMİRLERİ İLE İLÇE BELEDİYE BAŞKANLARI",
    ]);
    const priorityNames = members
      .filter((m) => priorityCategories.has(m.kategori ?? ""))
      .map((m) => {
        const clean = extractSearchName(m.isim);
        // Normalise: capitalise each word
        return clean
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      })
      .filter((n) => n.length >= 4);

    // Upsert into social_keywords (ignore conflicts)
    if (priorityNames.length > 0) {
      const rows = priorityNames.map((k) => ({
        keyword: k,
        category: "protocol",
        is_active: true,
      }));
      supabase
        .from("social_keywords")
        .upsert(rows, { onConflict: "keyword", ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) console.debug("Protocol keyword sync:", error.message);
        });
    }
  }, [members]);

  // ── Compute mentions per member ──────────────────────────────────────────
  const results = useMemo((): MentionResult[] => {
    if (!analyses.length || !members.length) return [];

    return members
      .map((member) => {
        const searchName = extractSearchName(member.isim);
        if (searchName.length < 4) return null;
        const mentions = analyses.filter((a) => mentionsMember(a.content, searchName));
        if (mentions.length === 0) return null;
        return {
          member,
          mentions,
          positive: mentions.filter((m) => m.sentiment === "positive").length,
          negative: mentions.filter((m) => m.sentiment === "negative").length,
          neutral:  mentions.filter((m) => m.sentiment === "neutral").length,
        };
      })
      .filter((r): r is MentionResult => r !== null)
      .sort((a, b) => b.mentions.length - a.mentions.length);
  }, [analyses, members]);

  const totalMentionedMembers = results.length;
  const totalMentions = results.reduce((s, r) => s + r.mentions.length, 0);
  const displayList = expanded ? results : results.slice(0, 8);

  const handleSelect = (member: ProtocolMember) => {
    const searchName = extractSearchName(member.isim);
    if (selected === member.isim) {
      setSelected(null);
      onMemberFilter?.(null);
    } else {
      setSelected(member.isim);
      onMemberFilter?.(searchName);
    }
  };

  if (!results.length) {
    return (
      <div className="text-center py-6 text-[10px] font-mono text-muted-foreground/50">
        {analyses.length === 0
          ? "Gönderi yükleniyor…"
          : `${members.length} protokol üyesi tarıyorum — henüz eşleşme bulunamadı`}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary strip */}
      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground px-0.5">
        <span>
          <span className="text-foreground font-bold">{totalMentionedMembers}</span> üye anılıyor ·{" "}
          <span className="text-foreground font-bold">{totalMentions}</span> mention
        </span>
        {selected && (
          <button
            onClick={() => { setSelected(null); onMemberFilter?.(null); }}
            className="text-primary hover:text-primary/80 underline"
          >
            Filtreyi temizle
          </button>
        )}
      </div>

      {/* Member rows */}
      {displayList.map((r) => {
        const posRatio = r.mentions.length ? (r.positive / r.mentions.length) : 0;
        const negRatio = r.mentions.length ? (r.negative / r.mentions.length) : 0;
        const neuRatio = r.mentions.length ? (r.neutral  / r.mentions.length) : 0;
        const isActive = selected === r.member.isim;

        return (
          <div
            key={r.member.isim}
            onClick={() => handleSelect(r.member)}
            className={`p-2 rounded-lg border cursor-pointer transition-colors ${
              isActive
                ? "border-primary/50 bg-primary/5"
                : "border-border/30 bg-muted/5 hover:bg-muted/10"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Name */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-foreground truncate">
                    {r.member.isim}
                  </span>
                  <span className="text-[9px] font-mono text-primary font-bold shrink-0">
                    {r.mentions.length}
                  </span>
                </div>
                {/* Title + Category */}
                <div className="text-[9px] font-mono text-muted-foreground truncate mt-0.5">
                  {r.member.unvan}
                  {r.member.kategori ? ` · ${r.member.kategori.split(",")[0].trim()}` : ""}
                </div>
                {/* Sentiment bar */}
                <div className="flex h-1 rounded-full overflow-hidden mt-1.5 gap-px">
                  {posRatio > 0 && (
                    <div className="bg-green-500" style={{ width: `${posRatio * 100}%` }} />
                  )}
                  {neuRatio > 0 && (
                    <div className="bg-yellow-500/60" style={{ width: `${neuRatio * 100}%` }} />
                  )}
                  {negRatio > 0 && (
                    <div className="bg-red-500" style={{ width: `${negRatio * 100}%` }} />
                  )}
                </div>
                {/* Sentiment counts */}
                <div className="flex gap-2 mt-1 text-[8px] font-mono text-muted-foreground">
                  {r.positive > 0 && (
                    <span className="text-green-500">+{r.positive}</span>
                  )}
                  {r.neutral > 0 && (
                    <span className="text-yellow-500">{r.neutral}≈</span>
                  )}
                  {r.negative > 0 && (
                    <span className="text-red-500">−{r.negative}</span>
                  )}
                </div>
              </div>

              {/* Latest post source link */}
              {r.mentions[0]?.source_url && (
                <a
                  href={r.mentions[0].source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/40 hover:text-primary shrink-0 mt-1"
                >
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        );
      })}

      {/* Show more / less */}
      {results.length > 8 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground hover:text-primary py-1"
        >
          {expanded ? (
            <><ChevronUp size={10} /> Daha az göster</>
          ) : (
            <><ChevronDown size={10} /> Tümünü gör ({results.length})</>
          )}
        </button>
      )}
    </div>
  );
};
