// District configuration — 13 Muğla ilçesi
export interface District {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  type: "coastal" | "inland";
  emoji: string;
  aliases: string[]; // keywords that match this district in social posts
  population: number;
  area_km2: number;
  description: string;
  tags: string[];
}

export const DISTRICTS: District[] = [
  {
    slug: "bodrum",
    name: "Bodrum",
    lat: 37.034, lng: 27.430, type: "coastal", emoji: "⛵",
    aliases: ["bodrum", "halicarnassus", "yalıkavak", "türkbükü", "göltürkbükü", "gündoğan", "torba", "konacık", "bitez", "turgutreis"],
    population: 196000, area_km2: 602,
    description: "Türkiye'nin en ünlü tatil ve marina kentidir.",
    tags: ["turizm", "deniz", "marina", "lüks", "yat"],
  },
  {
    slug: "marmaris",
    name: "Marmaris",
    lat: 36.855, lng: 28.272, type: "coastal", emoji: "🏖️",
    aliases: ["marmaris", "icmeler", "içmeler", "selimiye", "adaköy", "yalancıboğaz", "aksaz", "turunç", "bozburun", "armutalan", "hisarönü"],
    population: 82000, area_km2: 891,
    description: "Akdeniz'in en güzel koylarından birine sahip turistik ilçedir.",
    tags: ["turizm", "deniz", "koy", "yat", "tatil"],
  },
  {
    slug: "fethiye",
    name: "Fethiye",
    lat: 36.622, lng: 29.126, type: "coastal", emoji: "🧿",
    aliases: ["fethiye", "göcek", "ölüdeniz", "olüdeniz", "hisarönü", "ovacık", "çalış", "babadağ", "kayaköy"],
    population: 165000, area_km2: 3062,
    description: "Mavi yolculuğun kalbi, tarihi Likya yolu başlangıcıdır.",
    tags: ["turizm", "doğa", "tarih", "deniz", "yamaç paraşütü"],
  },
  {
    slug: "milas",
    name: "Milas",
    lat: 37.321, lng: 27.790, type: "inland", emoji: "🏛️",
    aliases: ["milas", "mylasa", "güllük", "akbelen", "ikizköy", "ören", "beçin"],
    population: 84000, area_km2: 1993,
    description: "Bodrum havalimanına ev sahipliği yapan tarihi ilçedir.",
    tags: ["tarih", "tarım", "havaalanı", "arkeoloji"],
  },
  {
    slug: "merkez",
    name: "Muğla Merkez",
    lat: 37.215, lng: 28.364, type: "inland", emoji: "🏢",
    aliases: ["muğla", "mugla", "merkez", "menteşe", "mentese", "kötekli", "yeniköy", "bayır"],
    population: 110000, area_km2: 3197,
    description: "İl merkezi, yönetim ve eğitim kentidir.",
    tags: ["idare", "eğitim", "sağlık", "üniversite"],
  },
  {
    slug: "datca",
    name: "Datça",
    lat: 36.729, lng: 27.690, type: "coastal", emoji: "🌿",
    aliases: ["datça", "datca", "reşadiye", "knidos", "palamutbükü", "balıkaşıran"],
    population: 13000, area_km2: 960,
    description: "Yarımada ucunda huzurlu, doğal ve organik bir tatil yeridir.",
    tags: ["turizm", "doğa", "badem", "yarımada", "organik"],
  },
  {
    slug: "koyceğiz",
    name: "Köyceğiz",
    lat: 36.964, lng: 28.688, type: "inland", emoji: "🌊",
    aliases: ["köyceğiz", "koyceğiz", "koycegiz", "köyceiz", "toparlar", "ekincik"],
    population: 23000, area_km2: 1501,
    description: "Köyceğiz Gölü ve termal kaplıcalarıyla tanınır.",
    tags: ["doğa", "göl", "kaplıca", "caretta caretta", "ekoloji"],
  },
  {
    slug: "ortaca",
    name: "Ortaca",
    lat: 36.838, lng: 28.762, type: "inland", emoji: "🌲",
    aliases: ["ortaca", "dalyan", "iztuzu", "sultaniye", "sarıgerme"],
    population: 36000, area_km2: 574,
    description: "Dalyan kanalı ve İztuzu plajına yakın doğa ilçesidir.",
    tags: ["doğa", "caretta caretta", "dalyan", "kanal", "kaplumbağa"],
  },
  {
    slug: "dalaman",
    name: "Dalaman",
    lat: 36.772, lng: 28.794, type: "inland", emoji: "✈️",
    aliases: ["dalaman", "sarsala", "kapıkargın"],
    population: 24000, area_km2: 582,
    description: "Uluslararası havalimanı ile bölgenin hava kapısıdır.",
    tags: ["havaalanı", "sanayi", "tekstil", "ulaşım"],
  },
  {
    slug: "seydikemer",
    name: "Seydikemer",
    lat: 36.712, lng: 29.244, type: "inland", emoji: "🏔️",
    aliases: ["seydikemer", "esen", "saklıkent", "kumluova", "kalkan", "kaş"],
    population: 29000, area_km2: 1394,
    description: "Esen çayı boyunca uzanan huzurlu bir kırsal ilçedir.",
    tags: ["doğa", "köy", "tarım", "ekoturizm"],
  },
  {
    slug: "ula",
    name: "Ula",
    lat: 37.101, lng: 28.411, type: "inland", emoji: "🌾",
    aliases: ["ula", "akyaka", "azmak", "sakar", "gökova"],
    population: 22000, area_km2: 740,
    description: "Muğla'ya 35 km mesafede sakin bir ilçedir.",
    tags: ["tarım", "kırsal", "doğa"],
  },
  {
    slug: "yatağan",
    name: "Yatağan",
    lat: 37.341, lng: 28.126, type: "inland", emoji: "⚡",
    aliases: ["yatağan", "yatagan", "stratonikeia", "lagina", "eskihisar", "bozarmut"],
    population: 30000, area_km2: 1003,
    description: "Termik santrali ve doğal güzellikleriyle bilinen ilçedir.",
    tags: ["enerji", "sanayi", "maden", "termik"],
  },
  {
    slug: "kavaklidere",
    name: "Kavaklidere",
    lat: 37.450, lng: 28.366, type: "inland", emoji: "🌳",
    aliases: ["kavaklidere", "kavaklıdere", "menteşe mahallesi", "çayboyu", "salkım"],
    population: 11000, area_km2: 632,
    description: "İlin kuzeyinde serin orman ilçesidir.",
    tags: ["orman", "doğa", "köy", "tarım"],
  },
];

function normalizeTrAscii(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

export const getDistrictBySlug = (slug: string): District | undefined => {
  if (!slug) return undefined;
  const direct = DISTRICTS.find(d => d.slug === slug);
  if (direct) return direct;
  const norm = normalizeTrAscii(slug);
  return DISTRICTS.find(
    d =>
      normalizeTrAscii(d.slug) === norm ||
      normalizeTrAscii(d.name) === norm ||
      (norm === "mentese" && d.slug === "merkez")
  );
};

/** Find district by checking if text contains any of its aliases (Turkish-safe) */
export const getDistrictFromText = (text: string): District | undefined => {
  if (!text) return undefined;
  const lower = text.toLocaleLowerCase("tr-TR");
  const ascii = normalizeTrAscii(text);
  return DISTRICTS.find(d =>
    d.aliases.some(a => {
      const aLow = a.toLocaleLowerCase("tr-TR");
      return lower.includes(aLow) || ascii.includes(normalizeTrAscii(aLow));
    })
  );
};
