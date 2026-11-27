// _shared/nlp.ts — Muğla'ya özgü NLP & mekânsal analiz motoru
// Edge function'larda API anahtarı olmadan çalışır (deterministik kural tabanlı):
// 13 ilçe NER + mahalle çözümleme, kategori sınıflandırma, duygu analizi.
//
// ⚠️ TEK DOĞRULUK KAYNAĞI (single source of truth)
// Bu modül; news-scrape, social-collect, twitter-collect ve social-analyze
// tarafından paylaşılır. Başka hiçbir edge function kendi ilçe/mahalle haritasını
// ya da duygu sözlüğünü TUTMAZ — çelişkili kopyalar (örn. göcek→Dalaman,
// akyaka→Menteşe, muğla→"Muğla Merkez") bu modüle taşınarak tekilleştirildi.
//
// Eşleştirme, Türkçe'ye duyarlı "kelime sınırı + çekim eki" mantığıyla yapılır:
//   • "milaspor" → Milas DEĞİL   (yapım eki -por reddedilir)
//   • "yolcu"    → yol  DEĞİL    (yapım eki -cu  reddedilir)
//   • "yolunda"  → yol  ✓        (çekim eki -unda kabul edilir)
// Böylece alt-dizi (substring) tabanlı yanlış eşleşmeler ortadan kalkar.

export type Category =
  | 'infrastructure_transport'
  | 'fire_disaster'
  | 'tourism'
  | 'governance'
  | 'general';

export type Sentiment = 'positive' | 'negative' | 'neutral';

/** Mekân eşleşmesinin türü — spesifiklik ağırlığını belirler. */
export type EntityKind = 'locality' | 'district' | 'province';

export interface GeoEntity {
  name: string;
  district: string;
  lat: number;
  lon: number;
  /** 'locality' (mahalle/mevki) > 'district' (ilçe) > 'province' (il geneli) */
  kind: EntityKind;
  /** Spesifiklik ağırlığı: locality 3, district 2, province 1 */
  weight: number;
  /** Metinde kaç kez geçtiği */
  count: number;
}

export interface NlpResult {
  district: string | null;
  entities: GeoEntity[];
  category: Category;
  sentiment: Sentiment;
  sentimentScore: number; // -1 .. +1
  /** Duygu analizinin güveni (0..1) */
  sentimentConfidence: number;
  /** İlçe atamasının güveni (0..1) */
  districtConfidence: number;
  /** Genel analiz güveni (0..1) — ilçe + duygu güvenlerinin ortalaması */
  confidence: number;
  lat: number | null;
  lon: number | null;
}

// ─── 13 ilçe merkezi (kanonik adlar) ────────────────────────────────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  'Bodrum': [37.0344, 27.4305], 'Dalaman': [36.7666, 28.8030],
  'Datça': [36.7308, 27.6861], 'Fethiye': [36.6216, 29.1164],
  'Kavaklıdere': [37.4500, 28.3300], 'Köyceğiz': [36.9166, 28.6833],
  'Marmaris': [36.8550, 28.2742], 'Menteşe': [37.2153, 28.3636],
  'Milas': [37.3166, 27.7833], 'Ortaca': [36.8333, 28.7666],
  'Seydikemer': [36.6333, 29.3500], 'Ula': [37.1000, 28.4166],
  'Yatağan': [37.3400, 28.1333],
};

const DISTRICT_WEIGHT: Record<EntityKind, number> = {
  locality: 3,
  district: 2,
  province: 1,
};

// ─── Mahalle/mevki → ilçe eşleşmesi (NER). Kanonik ilçe adlarına bağlanır. ──
const LOCALITY_MAP: Record<string, string> = {
  'ölüdeniz': 'Fethiye', 'hisarönü': 'Fethiye', 'çalış plajı': 'Fethiye', 'kayaköy': 'Fethiye',
  'göcek': 'Fethiye', 'saklıkent': 'Seydikemer', 'kınık': 'Seydikemer',
  'turgutreis': 'Bodrum', 'gümüşlük': 'Bodrum', 'yalıkavak': 'Bodrum', 'gündoğan': 'Bodrum',
  'bitez': 'Bodrum', 'ortakent': 'Bodrum', 'türkbükü': 'Bodrum', 'torba': 'Bodrum',
  'içmeler': 'Marmaris', 'turunç': 'Marmaris', 'armutalan': 'Marmaris', 'selimiye': 'Marmaris',
  'datça merkez': 'Datça', 'palamutbükü': 'Datça', 'mesudiye': 'Datça', 'knidos': 'Datça',
  'dalyan': 'Ortaca', 'sarigerme': 'Ortaca', 'sarıgerme': 'Ortaca',
  'akyaka': 'Ula', 'gökova': 'Ula',
  'kapıkargın': 'Dalaman', 'sarsala': 'Dalaman',
  'güllük': 'Milas', 'ören': 'Milas', 'bafa': 'Milas', 'labranda': 'Milas',
  'esençay': 'Köyceğiz', 'toparlar': 'Köyceğiz',
  'yatağan termik': 'Yatağan', 'bozüyük': 'Yatağan',
  'muğla merkez': 'Menteşe', 'müştakbey': 'Menteşe', 'düğerek': 'Menteşe',
  'akçaova': 'Menteşe', 'yerkesik': 'Menteşe',
};

// İl geneli / merkez imleri — düşük spesifiklik (kind: province).
// "Muğla" bir il adıdır; merkez ilçe kanonik olarak Menteşe'dir.
const PROVINCE_ALIASES: Record<string, string> = {
  'muğla': 'Menteşe',
  'muğla merkez': 'Menteşe',
  'menteşe': 'Menteşe',
};

// ─── Kategori anahtar kelimeleri ────────────────────────────────────────────
const CATEGORY_ORDER: Exclude<Category, 'general'>[] = [
  'fire_disaster', 'infrastructure_transport', 'tourism', 'governance',
];

const CATEGORY_KEYWORDS: Record<Exclude<Category, 'general'>, string[]> = {
  fire_disaster: [
    'yangın', 'alev', 'duman', 'itfaiye', 'orman yangını', 'deprem', 'sel', 'heyelan',
    'fırtına', 'afet', 'kaza', 'boğulma', 'kayıp', 'arama kurtarma', 'afad', 'tahliye',
  ],
  infrastructure_transport: [
    'yol', 'trafik', 'kapanma', 'çalışma', 'altyapı', 'su kesintisi', 'elektrik kesintisi',
    'şantiye', 'asfalt', 'köprü', 'tünel', 'otobüs', 'dolmuş', 'havalimanı', 'havaalanı',
    'imar', 'inşaat', 'kanalizasyon', 'arıza',
  ],
  tourism: [
    'turist', 'otel', 'tatil', 'plaj', 'rezervasyon', 'sezon', 'doluluk', 'marina',
    'tekne', 'mavi yolculuk', 'günübirlik', 'antik kent', 'müze', 'şezlong', 'turizm',
  ],
  governance: [
    'belediye', 'başkan', 'meclis', 'karar', 'ihale', 'zabıta', 'encümen', 'valilik',
    'kaymakam', 'protokol', 'tören', 'denetim', 'ceza', 'ruhsat', 'muhtar', 'büyükşehir',
  ],
};

const POSITIVE_WORDS = [
  'güzel', 'harika', 'muhteşem', 'başarılı', 'teşekkür', 'tamamlandı', 'açıldı',
  'kazandı', 'ödül', 'temiz', 'huzur', 'sevinç', 'memnun', 'artış', 'rekor',
  'gelişme', 'yenilik', 'destek', 'müjde', 'ücretsiz',
];
const NEGATIVE_WORDS = [
  'kötü', 'berbat', 'rezalet', 'şikayet', 'mağdur', 'zarar', 'kirlilik', 'pis',
  'pahalı', 'zam', 'kuyruk', 'gürültü', 'rahatsız', 'tehlike', 'korku', 'panik',
  'yıkım', 'hırsızlık', 'kavga', 'ölü', 'yaralı', 'çöktü', 'tıkalı', 'kesinti',
];

// Olumsuzlama belirteçleri (duygu kelimesinden önce gelen pencerede aranır)
const NEGATION_WORDS = ['degil', 'yok', 'hic', 'olmadi', 'olmaz', 'olmuyor', 'yoktu', 'degildi'];

// ─── Türkçe normalizasyon ───────────────────────────────────────────────────
// toLocaleLowerCase('tr-TR'): I→ı, İ→i. Ardından aksan/kuyruk harfleri sadeleşir.
const TR_FOLD: Array<[RegExp, string]> = [
  [/ı/g, 'i'], [/î/g, 'i'], [/ş/g, 's'], [/ç/g, 'c'], [/ğ/g, 'g'],
  [/ö/g, 'o'], [/ü/g, 'u'], [/û/g, 'u'], [/â/g, 'a'], [/à/g, 'a'],
  [/é/g, 'e'], [/è/g, 'e'], [/ê/g, 'e'],
];

/** Türkçe'ye duyarlı normalizasyon (küçük harf + harf sadeleştirme). */
export function normalizeTr(input: string): string {
  let out = String(input ?? '').toLocaleLowerCase('tr-TR');
  for (const [re, rep] of TR_FOLD) out = out.replace(re, rep);
  return out;
}

/** Metni normalleştirilmiş kelime dizisine ayırır (kelime sınırı = token sınırı). */
function tokenize(input: string): string[] {
  return normalizeTr(input).split(/[^a-z0-9]+/).filter(Boolean);
}

// ─── Türkçe çekim ekleri (yalnızca ÇEKİM; yapım ekleri hariç) ───────────────
// -cu/-cı, -lı/-li, -sız/-siz gibi YAPIM ekleri kasıtlı olarak DIŞARIDA bırakıldı;
// aksi hâlde "yolcu"→yol, "milaslı"→milas gibi yanlış eşleşmeler oluşurdu.
const TR_INFLECTIONS = [
  // çoğul
  'lar', 'ler',
  // hâl ekleri (accusative/dative/locative/ablative + kaynaştırma harfleri)
  'ndan', 'nden', 'nda', 'nde', 'dan', 'den', 'tan', 'ten', 'da', 'de', 'ta', 'te',
  'ya', 'ye', 'yı', 'yi', 'yu', 'yü', 'na', 'ne', 'ni', 'nı', 'nu', 'nü',
  'si', 'sı', 'su', 'sü', 'i', 'ı', 'u', 'ü', 'a', 'e',
  // tamlayan
  'nin', 'nın', 'nun', 'nün', 'in', 'ın', 'un', 'ün',
  // iyelik
  'imiz', 'ımız', 'umuz', 'ümüz', 'iniz', 'ınız', 'unuz', 'ünüz',
  'miz', 'mız', 'muz', 'müz', 'niz', 'nız', 'nuz', 'nüz',
].sort((a, b) => b.length - a.length); // en uzun ek önce denenir

/**
 * `token`, `stem` kökünün çekimli hâli mi? (kelime sınırına duyarlı)
 * Yalnızca bilinen çekim ekleri zinciri artıksa kabul eder; yapım eki içeren
 * farklı kelimeler (yolcu, milaspor, ulaşım) reddedilir.
 */
function inflectedMatch(token: string, stem: string): boolean {
  if (!stem || !token.startsWith(stem)) return false;
  let rest = token.slice(stem.length);
  if (rest === '') return true;
  let guard = 0;
  while (rest.length > 0 && guard++ < 8) {
    const hit = TR_INFLECTIONS.find((sfx) => rest.startsWith(sfx));
    if (!hit) return false;
    rest = rest.slice(hit.length);
  }
  return rest.length === 0;
}

/** Çok kelimeli kalıpta: son kelime çekim eki alabilir, öncekiler birebir eşleşir. */
function phraseMatchesAt(tokens: string[], start: number, phrase: string[]): boolean {
  if (start + phrase.length > tokens.length) return false;
  for (let j = 0; j < phrase.length - 1; j++) {
    if (tokens[start + j] !== phrase[j]) return false;
  }
  return inflectedMatch(tokens[start + phrase.length - 1], phrase[phrase.length - 1]);
}

function countPhrase(tokens: string[], phrase: string[]): number {
  let count = 0;
  for (let i = 0; i + phrase.length <= tokens.length; i++) {
    if (phraseMatchesAt(tokens, i, phrase)) {
      count++;
      i += phrase.length - 1;
    }
  }
  return count;
}

function firstPhraseIndex(tokens: string[], phrase: string[]): number {
  for (let i = 0; i + phrase.length <= tokens.length; i++) {
    if (phraseMatchesAt(tokens, i, phrase)) return i;
  }
  return -1;
}

// ─── Önceden normalize edilmiş sözlükler (modül yüklenirken bir kez) ─────────
const LOCALITY_ENTRIES = Object.entries(LOCALITY_MAP)
  .map(([name, district]) => ({ name, district, tokens: tokenize(name) }));
const DISTRICT_ENTRIES = Object.keys(DISTRICT_CENTERS)
  .map((name) => ({ name, district: name, tokens: tokenize(name) }));
const PROVINCE_ENTRIES = Object.entries(PROVINCE_ALIASES)
  .map(([name, district]) => ({ name, district, tokens: tokenize(name) }));
const CATEGORY_ENTRIES: Array<{ cat: Exclude<Category, 'general'>; tokens: string[]; weight: number }> =
  CATEGORY_ORDER.flatMap((cat) =>
    CATEGORY_KEYWORDS[cat].map((kw) => {
      const tokens = tokenize(kw);
      return { cat, tokens, weight: tokens.length > 1 ? 2 : 1 };
    }),
  );
const POSITIVE_STEMS = POSITIVE_WORDS.map(normalizeTr);
const NEGATIVE_STEMS = NEGATIVE_WORDS.map(normalizeTr);

interface DistrictAgg { score: number; locality: number; district: number; province: number; firstIdx: number; }

function isNegated(tokens: string[], index: number): boolean {
  for (let j = index - 1; j >= Math.max(0, index - 3); j--) {
    if (NEGATION_WORDS.includes(tokens[j])) return true;
  }
  return false;
}

/**
 * Metni analiz eder: ilçe/mevki NER, kategori sınıflandırma, duygu analizi.
 * Çok ilçeli metinlerde spesifiklik + tekrar ağırlıklı çoğunluk oyu uygular.
 */
export function analyzeText(text: string): NlpResult {
  const tokens = tokenize(text);

  // ── 1) Coğrafi varlıklar (NER) ────────────────────────────────────────────
  const entities: GeoEntity[] = [];
  const byDistrict = new Map<string, DistrictAgg>();

  const pushEntity = (
    name: string,
    district: string,
    kind: EntityKind,
    weight: number,
    count: number,
    firstIdx: number,
  ) => {
    const center = DISTRICT_CENTERS[district];
    if (!center) return;
    entities.push({ name, district, lat: center[0], lon: center[1], kind, weight, count });
    const agg = byDistrict.get(district) ?? { score: 0, locality: 0, district: 0, province: 0, firstIdx };
    agg.score += weight * count;
    agg[kind] += count;
    agg.firstIdx = Math.min(agg.firstIdx, firstIdx);
    byDistrict.set(district, agg);
  };

  for (const e of LOCALITY_ENTRIES) {
    const count = countPhrase(tokens, e.tokens);
    if (count > 0) pushEntity(e.name, e.district, 'locality', DISTRICT_WEIGHT.locality, count, firstPhraseIndex(tokens, e.tokens));
  }
  for (const e of DISTRICT_ENTRIES) {
    const count = countPhrase(tokens, e.tokens);
    if (count > 0) pushEntity(e.name, e.district, 'district', DISTRICT_WEIGHT.district, count, firstPhraseIndex(tokens, e.tokens));
  }
  for (const e of PROVINCE_ENTRIES) {
    const count = countPhrase(tokens, e.tokens);
    if (count > 0) pushEntity(e.name, e.district, 'province', DISTRICT_WEIGHT.province, count, firstPhraseIndex(tokens, e.tokens));
  }

  // Çok ilçeli metinde çoğunluk oyu: skor > mahalle isabeti > metin sırası > alfabetik
  let district: string | null = null;
  let districtConfidence = 0;
  if (byDistrict.size > 0) {
    const totalScore = [...byDistrict.values()].reduce((s, a) => s + a.score, 0);
    const winner = [...byDistrict.entries()].sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      if (b[1].locality !== a[1].locality) return b[1].locality - a[1].locality;
      if (a[1].firstIdx !== b[1].firstIdx) return a[1].firstIdx - b[1].firstIdx;
      return a[0].localeCompare(b[0]);
    })[0];
    district = winner[0];
    const agg = winner[1];
    // Kanıt gücü: en güçlü eşleşmenin spesifikliği
    const strength = agg.locality > 0 ? 1 : agg.district > 0 ? 0.75 : 0.5;
    // Baskınlık: kazananın toplam skor içindeki payı
    const dominance = totalScore > 0 ? agg.score / totalScore : 0;
    districtConfidence = round3(clamp01(strength * (0.5 + 0.5 * dominance)));
  }

  // Varlıkları metindeki ilk geçiş sırasına göre sırala (kararlı çıktı)
  entities.sort((a, b) => {
    const ai = firstPhraseIndex(tokens, tokenize(a.name));
    const bi = firstPhraseIndex(tokens, tokenize(b.name));
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  // ── 2) Kategori sınıflandırma (kelime sınırı + çekim eki) ─────────────────
  const catScores = new Map<Category, number>();
  for (const { cat, tokens: kwTokens, weight } of CATEGORY_ENTRIES) {
    const count = countPhrase(tokens, kwTokens);
    if (count > 0) catScores.set(cat, (catScores.get(cat) ?? 0) + count * weight);
  }
  let category: Category = 'general';
  let best = 0;
  for (const cat of CATEGORY_ORDER) {
    const score = catScores.get(cat) ?? 0;
    if (score > best) { best = score; category = cat; }
  }

  // ── 3) Duygu analizi (olumsuzlama pencereli) ──────────────────────────────
  let pos = 0, neg = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const isPos = POSITIVE_STEMS.some((w) => inflectedMatch(tok, w));
    const isNeg = NEGATIVE_STEMS.some((w) => inflectedMatch(tok, w));
    if (!isPos && !isNeg) continue;
    const negated = isNegated(tokens, i);
    if (isPos) negated ? neg++ : pos++;
    if (isNeg) negated ? pos++ : neg++;
  }
  // Kategori sinyali: afet/olay haberleri ağırlıklı olarak negatiftir
  if (category === 'fire_disaster') neg += 1.5;

  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / total;
  const sentiment: Sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
  const sentimentConfidence = round3(
    total === 0
      ? 0.3
      : clamp01(0.5 + 0.3 * Math.abs(score) + 0.2 * Math.min(1, total / 4)),
  );

  const coords = district ? DISTRICT_CENTERS[district] : null;

  return {
    district,
    entities: entities.slice(0, 12),
    category,
    sentiment,
    sentimentScore: round3(score),
    sentimentConfidence,
    districtConfidence,
    confidence: round3(clamp01(0.5 * districtConfidence + 0.5 * sentimentConfidence)),
    lat: coords ? coords[0] : null,
    lon: coords ? coords[1] : null,
  };
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export const DISTRICTS = Object.keys(DISTRICT_CENTERS);
export const CANONICAL_DISTRICTS = DISTRICTS;
export const DISTRICT_COORDS = DISTRICT_CENTERS;
