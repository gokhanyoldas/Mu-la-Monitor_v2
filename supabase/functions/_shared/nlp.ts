// _shared/nlp.ts — Muğla'ya özgü NLP & mekânsal analiz motoru
// Edge function'larda API anahtarı olmadan çalışır (deterministik kural tabanlı):
// 13 ilçe NER + mahalle çözümleme, kategori sınıflandırma, duygu analizi.

export interface GeoEntity { name: string; district: string; lat: number; lon: number; }

export interface NlpResult {
  district: string | null;
  entities: GeoEntity[];
  category: 'infrastructure_transport' | 'fire_disaster' | 'tourism' | 'governance' | 'general';
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number; // -1 .. +1
  lat: number | null;
  lon: number | null;
}

// ─── 13 ilçe merkezi + bilinen mahalle/mevki koordinatları ──────────────────
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  'Bodrum': [37.0344, 27.4305], 'Dalaman': [36.7666, 28.8030],
  'Datça': [36.7308, 27.6861], 'Fethiye': [36.6216, 29.1164],
  'Kavaklıdere': [37.4500, 28.3300], 'Köyceğiz': [36.9166, 28.6833],
  'Marmaris': [36.8550, 28.2742], 'Menteşe': [37.2153, 28.3636],
  'Milas': [37.3166, 27.7833], 'Ortaca': [36.8333, 28.7666],
  'Seydikemer': [36.6333, 29.3500], 'Ula': [37.1000, 28.4166],
  'Yatağan': [37.3400, 28.1333],
};

// Mahalle/mevki → ilçe eşleşmesi (NER). Küçük harfle aranır.
const LOCALITIES: Record<string, string> = {
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

// İlçe adlarının kendisi de bir sinyaldir
for (const d of Object.keys(DISTRICT_CENTERS)) LOCALITIES[d.toLowerCase()] = d;
LOCALITIES['muğla'] = 'Menteşe';

// ─── Kategori anahtar kelimeleri ────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<Exclude<NlpResult['category'], 'general'>, string[]> = {
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

const POSITIVE_WORDS = new Set([
  'güzel', 'harika', 'muhteşem', 'başarılı', 'teşekkür', 'tamamlandı', 'açıldı',
  'kazandı', 'ödül', 'temiz', 'huzur', 'sevinç', 'memnun', 'artış', 'rekor',
  'gelişme', 'yenilik', 'destek', 'müjde', 'ücretsiz',
]);
const NEGATIVE_WORDS = new Set([
  'kötü', 'berbat', 'rezalet', 'şikayet', 'mağdur', 'zarar', 'kirlilik', 'pis',
  'pahalı', 'zam', 'kuyruk', 'gürültü', 'rahatsız', 'tehlike', 'korku', 'panik',
  'yıkım', 'hırsızlık', 'kavga', 'ölü', 'yaralı', 'çöktü', 'tıkalı', 'kesinti',
]);

const normalize = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/[îı]/g, 'i').replace(/[ûü]/g, 'u').replace(/[ş]/g, 's').replace(/[ç]/g, 'c').replace(/[ğ]/g, 'g').replace(/[ö]/g, 'o');

export function analyzeText(text: string): NlpResult {
  const lower = text.toLocaleLowerCase('tr-TR');
  const norm = normalize(text);

  // NER: önce mahalle (spesifik), sonra ilçe
  const entities: GeoEntity[] = [];
  let district: string | null = null;
  for (const [name, dist] of Object.entries(LOCALITIES)) {
    const needle = normalize(name);
    if (!norm.includes(needle)) continue;
    const center = DISTRICT_CENTERS[dist];
    if (!entities.some(e => e.name === name)) {
      entities.push({ name, district: dist, lat: center[0], lon: center[1] });
    }
    if (!district) district = dist;
  }

  // Kategori: en çok eşleşen kazanır
  let category: NlpResult['category'] = 'general';
  let best = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [Exclude<NlpResult['category'], 'general'>, string[]][]) {
    const hits = words.reduce((acc, w) => acc + (norm.includes(normalize(w)) ? 1 : 0), 0);
    if (hits > best) { best = hits; category = cat; }
  }

  // Duygu: kelime sayımı, negasyon duyarlılığı basit tutulur
  const tokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  let pos = 0, neg = 0;
  for (let i = 0; i < tokens.length; i++) {
    const negated = i > 0 && (tokens[i - 1] === 'degil' || tokens[i - 1] === 'yok' || tokens[i - 1] === 'hic');
    if (POSITIVE_WORDS.has(tokens[i])) negated ? neg++ : pos++;
    if (NEGATIVE_WORDS.has(tokens[i])) negated ? pos++ : neg++;
  }
  // Kategori sinyali: felaket/inşaat haberleri ağırlıklı negatiftir
  if (category === 'fire_disaster') neg += 1.5;
  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / total;
  const sentiment: NlpResult['sentiment'] = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';

  const first = entities[0];
  return {
    district,
    entities,
    category,
    sentiment,
    sentimentScore: Number(score.toFixed(3)),
    lat: first ? first.lat : null,
    lon: first ? first.lon : null,
  };
}

export const DISTRICTS = Object.keys(DISTRICT_CENTERS);
export const DISTRICT_COORDS = DISTRICT_CENTERS;
