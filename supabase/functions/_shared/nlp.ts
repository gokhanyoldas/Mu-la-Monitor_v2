// _shared/nlp.ts — Muğla'ya özgü NLP & mekânsal analiz motoru (TEK DOĞRULUK KAYNAĞI)
//
// Bu modül, Muğla ilçe/mahalle çözümlemesi (NER), kategori sınıflandırma ve
// duygu analizi için projedeki TEK kaynaktır. news-scrape, social-collect,
// twitter-collect, social-analyze ve scripts/backfill-nlp.ts buradan beslenir;
// başka hiçbir yerde kopya ilçe/mahalle haritası veya duygu kelime listesi
// tutulmaz (ör. göcek→Dalaman, akyaka→Menteşe gibi çakışan eşlemeler kaldırıldı).
//
// Kanonik 13 ilçe adı kullanılır — Menteşe dâhil (ör. "Muğla Merkez" DEĞİL).
//
// Eşleştirme Türkçe duyarlı KELİME SINIRI tabanlıdır: `milaspor→Milas` veya
// `yolcu→yol` gibi alt-dize yanlış pozitifleri engellenir. Çok ilçeli metinlerde
// özgüllük ağırlıklı çoğunluk oyu uygulanır (mahalle/mevki > ilçe adı > il adı)
// ve ilçe ataması için 0..1 arası bir güven skoru üretilir.
//
// API anahtarı gerektirmez; tamamen deterministik kural tabanlıdır.

export interface GeoEntity {
  name: string;
  district: string;
  lat: number;
  lon: number;
}

export type NlpCategory =
  | "infrastructure_transport"
  | "fire_disaster"
  | "tourism"
  | "governance"
  | "general";

export type NlpSentiment = "positive" | "negative" | "neutral";

export interface NlpResult {
  /** Kanonik ilçe adı (13 ilçe) veya eşleşme yoksa null. */
  district: string | null;
  /** 0..1 — ilçe atamasının güveni (tek/özgül eşleşmede yüksek, çok ilçeli metinde düşük). */
  districtConfidence: number;
  entities: GeoEntity[];
  category: NlpCategory;
  sentiment: NlpSentiment;
  /** -1..+1 duygu skoru. */
  sentimentScore: number;
  /** 0..1 — duygu skorunun güveni. */
  sentimentConfidence: number;
  lat: number | null;
  lon: number | null;
}

// ─── 13 ilçe merkezi koordinatları (kanonik adlar) ──────────────────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  Bodrum: [37.0344, 27.4305],
  Dalaman: [36.7666, 28.803],
  Datça: [36.7308, 27.6861],
  Fethiye: [36.6216, 29.1164],
  Kavaklıdere: [37.45, 28.33],
  Köyceğiz: [36.9166, 28.6833],
  Marmaris: [36.855, 28.2742],
  Menteşe: [37.2153, 28.3636],
  Milas: [37.3166, 27.7833],
  Ortaca: [36.8333, 28.7666],
  Seydikemer: [36.6333, 29.35],
  Ula: [37.1, 28.4166],
  Yatağan: [37.34, 28.1333],
};

// ─── Türkçe normalizasyon: küçük harf (tr-TR) + diakritik katlama ────────────
// Arama ve kelime sınırı için metni ASCII'ye indirger: "Göcek"→"gocek",
// "MUĞLA"→"mugla", "İçmeler"→"icmeler".
export function normalizeTr(input: string): string {
  return String(input ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[îı]/g, "i")
    .replace(/[ûü]/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o");
}

// İl adı → merkez ilçe (GENEL sinyal, düşük özgüllük)
const PROVINCE_ALIASES: Record<string, string> = {
  muğla: "Menteşe",
};

// Mahalle/mevki → ilçe (SPESİFİK yer adı, yüksek özgüllük)
const LOCALITIES: Record<string, string> = {
  ölüdeniz: "Fethiye",
  hisarönü: "Fethiye",
  "çalış plajı": "Fethiye",
  kayaköy: "Fethiye",
  göcek: "Fethiye",
  saklıkent: "Seydikemer",
  kınık: "Seydikemer",
  turgutreis: "Bodrum",
  gümüşlük: "Bodrum",
  yalıkavak: "Bodrum",
  gündoğan: "Bodrum",
  bitez: "Bodrum",
  ortakent: "Bodrum",
  türkbükü: "Bodrum",
  torba: "Bodrum",
  içmeler: "Marmaris",
  turunç: "Marmaris",
  armutalan: "Marmaris",
  selimiye: "Marmaris",
  "datça merkez": "Datça",
  palamutbükü: "Datça",
  mesudiye: "Datça",
  knidos: "Datça",
  dalyan: "Ortaca",
  sarıgerme: "Ortaca",
  akyaka: "Ula",
  gökova: "Ula",
  kapıkargın: "Dalaman",
  sarsala: "Dalaman",
  güllük: "Milas",
  ören: "Milas",
  bafa: "Milas",
  labranda: "Milas",
  esençay: "Köyceğiz",
  toparlar: "Köyceğiz",
  "yatağan termik": "Yatağan",
  bozüyük: "Yatağan",
  "muğla merkez": "Menteşe",
  müştakbey: "Menteşe",
  düğerek: "Menteşe",
  akçaova: "Menteşe",
  yerkesik: "Menteşe",
};

// ─── Kategori anahtar kelimeleri ────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<Exclude<NlpCategory, "general">, string[]> = {
  fire_disaster: [
    "yangın", "alev", "duman", "itfaiye", "orman yangını", "deprem", "sel", "heyelan",
    "fırtına", "afet", "kaza", "boğulma", "kayıp", "arama kurtarma", "afad", "tahliye",
  ],
  infrastructure_transport: [
    "yol", "trafik", "kapanma", "çalışma", "altyapı", "su kesintisi", "elektrik kesintisi",
    "şantiye", "asfalt", "köprü", "tünel", "otobüs", "dolmuş", "havalimanı", "havaalanı",
    "imar", "inşaat", "kanalizasyon", "arıza",
  ],
  tourism: [
    "turist", "otel", "tatil", "plaj", "rezervasyon", "sezon", "doluluk", "marina",
    "tekne", "mavi yolculuk", "günübirlik", "antik kent", "müze", "şezlong", "turizm",
  ],
  governance: [
    "belediye", "başkan", "meclis", "karar", "ihale", "zabıta", "encümen", "valilik",
    "kaymakam", "protokol", "tören", "denetim", "ceza", "ruhsat", "muhtar", "büyükşehir",
  ],
};

// ─── Duygu sözlükleri (normalize edilerek saklanır) ─────────────────────────
const POSITIVE_RAW = [
  "güzel", "harika", "muhteşem", "başarılı", "teşekkür", "tamamlandı", "açıldı",
  "kazandı", "ödül", "temiz", "huzur", "sevinç", "memnun", "artış", "rekor",
  "gelişme", "yenilik", "destek", "müjde", "ücretsiz",
];
const NEGATIVE_RAW = [
  "kötü", "berbat", "rezalet", "şikayet", "mağdur", "zarar", "kirlilik", "pis",
  "pahalı", "zam", "kuyruk", "gürültü", "rahatsız", "tehlike", "korku", "panik",
  "yıkım", "hırsızlık", "kavga", "ölü", "yaralı", "çöktü", "tıkalı", "kesinti",
];

const POSITIVE_WORDS = new Set(POSITIVE_RAW.map(normalizeTr));
const NEGATIVE_WORDS = new Set(NEGATIVE_RAW.map(normalizeTr));
const NEGATORS = new Set(["degil", "yok", "hic", "asla"]);

// ─── Kelime sınırı tabanlı eşleştirme ───────────────────────────────────────
// Normalize edilmiş metinde `milaspor` içindeki `milas` veya `yolcu` içindeki
// `yol` EŞLEŞMEZ; buna karşın "Milas'ta", "Bodrum." gibi apostrophe/noktalama
// sonrası biçimler eşleşir.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function wordBoundaryRegex(needleNorm: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escapeRegex(needleNorm)}(?![a-z0-9])`, "g");
}

function countMatches(re: RegExp, textNorm: string): number {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(textNorm) !== null) {
    count++;
    if (re.lastIndex === 0) break; // güvenlik: sıfır genişlikli eşleşme olmamalı
  }
  return count;
}

// Özgüllük ağırlıkları: spesifik mahalle/mevki > ilçe adı = il adı
const SPECIFICITY_LOCALITY = 2;
const SPECIFICITY_DISTRICT = 1;

interface GeoTerm {
  label: string;
  district: string;
  specificity: number;
  re: RegExp;
}

const GEO_TERMS: GeoTerm[] = [
  ...Object.keys(DISTRICT_CENTERS).map((name) => ({
    label: name,
    district: name,
    specificity: SPECIFICITY_DISTRICT,
    re: wordBoundaryRegex(normalizeTr(name)),
  })),
  ...Object.entries(PROVINCE_ALIASES).map(([alias, district]) => ({
    label: alias,
    district,
    specificity: SPECIFICITY_DISTRICT,
    re: wordBoundaryRegex(normalizeTr(alias)),
  })),
  ...Object.entries(LOCALITIES).map(([alias, district]) => ({
    label: alias,
    district,
    specificity: SPECIFICITY_LOCALITY,
    re: wordBoundaryRegex(normalizeTr(alias)),
  })),
];

// Kategori kelimeleri için önceden derlenmiş kelime sınırı regex'leri
const CATEGORY_REGEX: Record<string, RegExp> = {};
for (const words of Object.values(CATEGORY_KEYWORDS)) {
  for (const w of words) CATEGORY_REGEX[w] = wordBoundaryRegex(normalizeTr(w));
}

export function analyzeText(text: string): NlpResult {
  const norm = normalizeTr(text);

  // ── NER: kelime sınırı eşleşmesi + özgüllük ağırlıklı çoğunluk oyu ──
  const entities: GeoEntity[] = [];
  const districtScores: Record<string, number> = {};
  const districtHasSpecific: Record<string, boolean> = {};

  for (const term of GEO_TERMS) {
    const count = countMatches(term.re, norm);
    if (count === 0) continue;

    const center = DISTRICT_CENTERS[term.district];
    if (center && !entities.some((e) => e.name === term.label && e.district === term.district)) {
      entities.push({
        name: term.label,
        district: term.district,
        lat: center[0],
        lon: center[1],
      });
    }

    districtScores[term.district] = (districtScores[term.district] ?? 0) + count * term.specificity;
    if (term.specificity >= SPECIFICITY_LOCALITY) districtHasSpecific[term.district] = true;
  }

  let district: string | null = null;
  let districtConfidence = 0;
  const scored = Object.entries(districtScores).sort((a, b) => b[1] - a[1]);
  if (scored.length > 0) {
    const [topDistrict, topScore] = scored[0];
    const totalScore = scored.reduce((sum, [, s]) => sum + s, 0);
    const dominance = totalScore > 0 ? topScore / totalScore : 0;
    // Spesifik (mahalle/mevki) kanıt, tek bir ilçe adına göre daha güvenilirdir.
    const specificityFactor = districtHasSpecific[topDistrict] ? 1 : 0.85;
    district = topDistrict;
    districtConfidence = Math.min(0.99, Math.round(dominance * specificityFactor * 100) / 100);
  }

  // ── Kategori: kelime sınırı eşleşme sayısı en yüksek olan kazanır ──
  let category: NlpCategory = "general";
  let bestHits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [
    Exclude<NlpCategory, "general">,
    string[],
  ][]) {
    let hits = 0;
    for (const w of words) hits += countMatches(CATEGORY_REGEX[w], norm);
    if (hits > bestHits) {
      bestHits = hits;
      category = cat;
    }
  }

  // ── Duygu: normalize edilmiş kelime sayımı + basit negasyon ──
  const tokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < tokens.length; i++) {
    const negated = i > 0 && NEGATORS.has(tokens[i - 1]);
    if (POSITIVE_WORDS.has(tokens[i])) negated ? neg++ : pos++;
    if (NEGATIVE_WORDS.has(tokens[i])) negated ? pos++ : neg++;
  }
  // Kategori sinyali: afet haberleri ağırlıklı negatiftir
  if (category === "fire_disaster") neg += 1.5;

  const total = pos + neg;
  const sentimentScore = total === 0 ? 0 : Number(((pos - neg) / total).toFixed(3));
  const sentiment: NlpSentiment =
    sentimentScore > 0.15 ? "positive" : sentimentScore < -0.15 ? "negative" : "neutral";
  const sentimentConfidence =
    total === 0 ? 0.5 : Math.min(0.95, Math.round((0.5 + Math.abs(sentimentScore) * 0.5) * 100) / 100);

  const first = entities[0];
  return {
    district,
    districtConfidence,
    entities,
    category,
    sentiment,
    sentimentScore,
    sentimentConfidence,
    lat: first ? first.lat : null,
    lon: first ? first.lon : null,
  };
}

export const DISTRICTS = Object.keys(DISTRICT_CENTERS);
export const DISTRICT_COORDS = DISTRICT_CENTERS;
