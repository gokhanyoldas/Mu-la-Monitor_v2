// Append-Only Cumulative Living Lexicon Engine (Yaşayan Söz Dağarcığı)
// Eski terimleri asla silmez (append-only); her yeni sosyal paylaşım, görsel veya tarama sonucu sözlüğü büyütür.

import { supabase } from "@/integrations/supabase/client";
import { safeStorage } from "@/lib/safe-storage";

export type LexiconLayer =
  | "core"             // (a) Çekirdek Sözlük: 13 ilçe, resmi kurumlar, temel sektörler (asla silinmez)
  | "micro_geo"        // (b) Mikro-Coğrafya & Mevki Havuzu
  | "protocol_subtext" // (c) Protokol, Unvan ve Dolaylı İma Kalıpları
  | "field_jargon";    // (d) Saha Jargonu & Projeler

export interface LexiconEntry {
  term: string;
  normalized: string;
  layer: LexiconLayer;
  district?: string;
  addedAt: string;
  source: "seed" | "ingested" | "grounding" | "manual";
  isNewlyLearned?: boolean;
  hitCount: number;
}

export const LEXICON_LAYER_META: Record<
  LexiconLayer,
  { label: string; shortLabel: string; description: string; badgeClass: string }
> = {
  core: {
    label: "a) Çekirdek Sözlük (Değişmez)",
    shortLabel: "Çekirdek",
    description: "13 ilçe, resmi kurumlar (Büyükşehir, Valilik, MUSKİ, Aydem, MUTTAŞ) ve temel sektörler",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  micro_geo: {
    label: "b) Mikro-Coğrafya & Mevki Havuzu",
    shortLabel: "Mikro-Coğrafya",
    description: "Mahalleler, mevkiler, yol ayrımları, koylar ve saha noktaları",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  protocol_subtext: {
    label: "c) Protokol, Unvan & Dolaylı İma",
    shortLabel: "Protokol & İma",
    description: "Siyasi aktörler, müdürlükler, hitaplar ve dolaylı eleştiri kalıpları",
    badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  field_jargon: {
    label: "d) Saha Jargonu & Projeler",
    shortLabel: "Saha & Proje",
    description: "Vatandaş sahadaki somut şikayet terimleri, kazı/altyapı ve belediye projeleri",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
};

export const LEXICON_STORAGE_KEY = "mugla_living_lexicon_v1";

export function normalizeLexiconTerm(term: string): string {
  return term
    .trim()
    .replace(/^#+/, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ");
}

const SEED_TIME = "2026-11-01T00:00:00.000Z";

function seedList(
  terms: Array<string | { term: string; district?: string }>,
  layer: LexiconLayer
): LexiconEntry[] {
  return terms.map((item) => {
    const raw = typeof item === "string" ? item : item.term;
    const district = typeof item === "string" ? undefined : item.district;
    return {
      term: raw,
      normalized: normalizeLexiconTerm(raw),
      layer,
      district,
      addedAt: SEED_TIME,
      source: "seed",
      isNewlyLearned: false,
      hitCount: 1,
    };
  });
}

export const INITIAL_LIVING_LEXICON: LexiconEntry[] = [
  // (a) Çekirdek Sözlük (Asla silinmez)
  ...seedList(
    [
      "Muğla", "Bodrum", "Marmaris", "Fethiye", "Milas", "Menteşe", "Muğla Merkez",
      "Datça", "Köyceğiz", "Ortaca", "Dalaman", "Seydikemer", "Ula", "Yatağan", "Kavaklıdere",
      "Muğla Büyükşehir Belediyesi", "Büyükşehir", "Muğla Valiliği", "Valilik", "Kaymakamlık",
      "MUSKİ", "Aydem", "MUTTAŞ", "KGM", "Karayolları", "AFAD", "DSİ", "ADM Elektrik",
      "YİKOB", "Çevre Şehircilik", "Orman Bölge Müdürlüğü",
      "turizm", "altyapı", "içme suyu", "ulaşım", "enerji", "baraj", "orman yangını", "marina",
      "imar", "çevre", "tarım", "zeytincilik", "kültür", "asayiş", "belediye bütçesi", "kruvaziyer",
    ],
    "core"
  ),

  // (b) Mikro-Coğrafya & Mevki Havuzu
  ...seedList(
    [
      { term: "Adaköy", district: "Marmaris" },
      { term: "Yalancıboğaz Marina", district: "Marmaris" },
      { term: "Aksaz yol ayrımı", district: "Marmaris" },
      { term: "İçmeler", district: "Marmaris" },
      { term: "Turunç Dağı", district: "Marmaris" },
      { term: "Bozburun", district: "Marmaris" },
      { term: "Selimiye", district: "Marmaris" },
      { term: "Armutalan", district: "Marmaris" },
      { term: "Kötekli", district: "Muğla Merkez" },
      { term: "Yeniköy", district: "Muğla Merkez" },
      { term: "Düğerek", district: "Muğla Merkez" },
      { term: "Bayır", district: "Muğla Merkez" },
      { term: "Akbelen", district: "Milas" },
      { term: "İkizköy", district: "Milas" },
      { term: "Güllük", district: "Milas" },
      { term: "Ören", district: "Milas" },
      { term: "Torba", district: "Bodrum" },
      { term: "Yalıkavak", district: "Bodrum" },
      { term: "Konacık", district: "Bodrum" },
      { term: "Turgutreis", district: "Bodrum" },
      { term: "Gümüşlük", district: "Bodrum" },
      { term: "Gündoğan", district: "Bodrum" },
      { term: "Göcek", district: "Fethiye" },
      { term: "Ölüdeniz", district: "Fethiye" },
      { term: "Çalış Plajı", district: "Fethiye" },
      { term: "Akyaka", district: "Ula" },
      { term: "Sakar Geçidi", district: "Ula" },
      { term: "Dalyan Kanalı", district: "Ortaca" },
      { term: "İztuzu", district: "Ortaca" },
      { term: "Balıkaşıran", district: "Datça" },
      { term: "Stratonikeia", district: "Yatağan" },
      { term: "Eskihisar", district: "Yatağan" },
      { term: "Bozarmut", district: "Yatağan" },
      { term: "Salkım Mahallesi", district: "Kavaklıdere" },
      { term: "Çayboyu", district: "Kavaklıdere" },
      { term: "Saklıkent Kanyonu", district: "Seydikemer" },
    ],
    "micro_geo"
  ),

  // (c) Protokol, Unvan ve Dolaylı İma Kalıpları
  ...seedList(
    [
      "Sn Aras", "Ahmet Aras", "Sn Ünlü", "Acar Ünlü", "Sn Mete", "Kadem Mete",
      "Dr. İdris Akbıyık", "Nurullah Kaya", "Gonca Köksal Aras", "Tamer Mandalinci",
      "Alim Karaca", "Mesut Günay", "Mehmet Demir", "Fevzi Topuz",
      "Yol Hizmetleri Daire Başkanı", "Süleyman Bey", "Fen İşleri Müdürü", "Temizlik İşleri",
      "ithal müdür", "akraba kontenjanı", "selfie fotoları", "hizmet lazım",
      "3 müdürlük sahibi", "sosyal medya belediyeciliği", "sıva mermer izliyor",
      "meclis kararı", "ihale komisyonu", "kaymakamlık koordinesi",
    ],
    "protocol_subtext"
  ),

  // (d) Saha Jargonu & Projeler
  ...seedList(
    [
      "çamur çukur", "lacivert asfalt", "dere kapandı", "evleri su bastı",
      "Aydem kazı kapama", "cam kumbarası", "kapaksız konteynır", "moloz",
      "Kent Meydanı", "Çok katlı Otopark", "İçmeler Belediye binası", "Huzurevi",
      "#BodrumSusuz", "patlayan isale hattı", "basınç düşüklüğü", "taşkın riski",
      "kilit parke", "hafriyat dökümü", "tek şerit daralma", "kör nokta trafik",
      "fiyat fahişliği", "termik kül sahası", "mermer ocağı tozu", "orman yolu bakımı",
      "tahliye kanalı tıkanıklığı", "yazlık şantiye yasağı", "turizm sezonu hazırlığı",
    ],
    "field_jargon"
  ),
];

function mergeAppendOnly(
  existing: LexiconEntry[],
  additions: Array<{
    term: string;
    layer: LexiconLayer;
    district?: string;
    source?: LexiconEntry["source"];
    isNewlyLearned?: boolean;
  }>
): { entries: LexiconEntry[]; addedCount: number; newlyAddedTerms: LexiconEntry[] } {
  const byNorm = new Map<string, LexiconEntry>();

  // First guarantee every core & existing item stays (NEVER deleted)
  for (const item of INITIAL_LIVING_LEXICON) {
    byNorm.set(item.normalized, { ...item });
  }
  for (const item of existing) {
    const norm = normalizeLexiconTerm(item.term);
    if (!norm) continue;
    const prev = byNorm.get(norm);
    if (prev) {
      byNorm.set(norm, {
        ...prev,
        ...item,
        normalized: norm,
        hitCount: Math.max(prev.hitCount, item.hitCount || 1),
      });
    } else {
      byNorm.set(norm, { ...item, normalized: norm });
    }
  }

  let addedCount = 0;
  const newlyAddedTerms: LexiconEntry[] = [];
  const nowIso = new Date().toISOString();

  for (const add of additions) {
    const clean = add.term.trim();
    if (clean.length < 2) continue;
    const norm = normalizeLexiconTerm(clean);
    if (!norm) continue;

    const existingItem = byNorm.get(norm);
    if (existingItem) {
      byNorm.set(norm, {
        ...existingItem,
        hitCount: (existingItem.hitCount || 1) + 1,
        district: existingItem.district || add.district,
      });
    } else {
      const created: LexiconEntry = {
        term: clean,
        normalized: norm,
        layer: add.layer,
        district: add.district,
        addedAt: nowIso,
        source: add.source || "ingested",
        isNewlyLearned: add.isNewlyLearned ?? true,
        hitCount: 1,
      };
      byNorm.set(norm, created);
      addedCount++;
      newlyAddedTerms.push(created);
    }
  }

  return {
    entries: Array.from(byNorm.values()),
    addedCount,
    newlyAddedTerms,
  };
}

export function loadLivingLexicon(): LexiconEntry[] {
  if (typeof window === "undefined") return [...INITIAL_LIVING_LEXICON];
  try {
    const raw = window.safeStorage.getItem(LEXICON_STORAGE_KEY);
    if (!raw) {
      window.safeStorage.setItem(LEXICON_STORAGE_KEY, JSON.stringify(INITIAL_LIVING_LEXICON));
      return [...INITIAL_LIVING_LEXICON];
    }
    const parsed = JSON.parse(raw) as LexiconEntry[];
    if (!Array.isArray(parsed)) return [...INITIAL_LIVING_LEXICON];
    // Reconcile against INITIAL_LIVING_LEXICON append-only
    const { entries } = mergeAppendOnly(parsed, []);
    return entries;
  } catch {
    return [...INITIAL_LIVING_LEXICON];
  }
}

export function saveLivingLexicon(entries: LexiconEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.safeStorage.setItem(LEXICON_STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("living-lexicon-updated", { detail: { total: entries.length } }));
  } catch {
    // ignore quota errors safely
  }
}

export function appendToLivingLexicon(
  current: LexiconEntry[],
  additions: Array<{
    term: string;
    layer: LexiconLayer;
    district?: string;
    source?: LexiconEntry["source"];
    isNewlyLearned?: boolean;
  }>
): { nextEntries: LexiconEntry[]; addedCount: number; newlyAddedTerms: LexiconEntry[] } {
  const { entries, addedCount, newlyAddedTerms } = mergeAppendOnly(current, additions);
  saveLivingLexicon(entries);

  // Best-effort non-blocking sync to Supabase only when user holds authenticated session
  if (newlyAddedTerms.length > 0 && typeof window !== "undefined") {
    void syncNewlyLearnedTermsToSupabase(newlyAddedTerms);
  }

  return { nextEntries: entries, addedCount, newlyAddedTerms };
}

export interface SocialKeywordUpsertRow {
  term: string;
  keyword: string;
  layer: LexiconLayer;
  category: string;
  district: string | null;
  weight: number;
  is_learned: boolean;
  source_context: string;
  updated_at: string;
  is_active: boolean;
  user_id?: string | null;
}

export function buildSocialKeywordUpsertRows(
  terms: LexiconEntry[],
  userId?: string | null
): SocialKeywordUpsertRow[] {
  const updatedAt = new Date().toISOString();
  const seen = new Set<string>();
  const rows: SocialKeywordUpsertRow[] = [];

  for (const t of terms.slice(0, 15)) {
    const cleanTerm = t.term.trim();
    if (!cleanTerm || seen.has(cleanTerm)) continue;
    seen.add(cleanTerm);

    const row: SocialKeywordUpsertRow = {
      term: cleanTerm,
      keyword: cleanTerm,
      layer: t.layer,
      category: t.layer,
      district: t.district ?? null,
      weight: Number((Math.max(1, t.hitCount || 1)).toFixed(2)),
      is_learned: Boolean(t.isNewlyLearned ?? true),
      source_context: t.source || "ingested",
      updated_at: updatedAt,
      is_active: true,
    };
    if (userId) {
      row.user_id = userId;
    }
    rows.push(row);
  }

  return rows;
}

async function syncNewlyLearnedTermsToSupabase(terms: LexiconEntry[]): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const rows = buildSocialKeywordUpsertRows(terms, session.user?.id ?? null);
    if (rows.length === 0) return;
    await supabase.from("social_keywords").upsert(rows, { onConflict: "term" });
  } catch {
    // Graceful no-op when unauthenticated or offline
  }
}

export function extractLexiconMatches(text: string, entries: LexiconEntry[]): LexiconEntry[] {
  if (!text) return [];
  const normText = normalizeLexiconTerm(text);
  return entries.filter((entry) => normText.includes(entry.normalized));
}
