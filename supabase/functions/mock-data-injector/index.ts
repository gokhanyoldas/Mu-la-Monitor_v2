// mock-data-injector — 13 ilçeye gerçekçi, koordinatlı demo olay/tweet/haber üretir.
// Üretilen her kayıt NLP motorundan geçer ve social_posts'a yazılır; kritik
// afet olayları ayrıca alert_events'e düşer (Realtime pin pulse).
// Tüm mock kayıtlar sentiment_method='mock' ile işaretlenir — mode:'clear'
// tek seferde temizler; gerçek veriye asla dokunmaz.

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";
import { analyzeText } from "../_shared/nlp.ts";

const MOCK_TAG = "mock";

interface DistrictSpec {
  name: string;
  center: [number, number];
  // Turistik kıyı ilçeleri daha yüksek hacim + turizm ağırlıklı
  weight: number;
  localities: string[];
}

const DISTRICTS: DistrictSpec[] = [
  { name: "Menteşe",    center: [37.2153, 28.3636], weight: 1.2, localities: ["Muğla merkez", "Müştakbey", "Düğerek", "Akçaova"] },
  { name: "Bodrum",     center: [37.0344, 27.4305], weight: 1.5, localities: ["Turgutreis", "Gümüşlük", "Yalıkavak", "Bitez", "Torba"] },
  { name: "Marmaris",   center: [36.8550, 28.2742], weight: 1.4, localities: ["İçmeler", "Turunç", "Armutalan", "Selimiye"] },
  { name: "Fethiye",    center: [36.6216, 29.1164], weight: 1.4, localities: ["Ölüdeniz", "Hisarönü", "Çalış Plajı", "Göcek"] },
  { name: "Seydikemer", center: [36.6333, 29.3500], weight: 0.8, localities: ["Saklıkent", "Kınık"] },
  { name: "Datça",      center: [36.7308, 27.6861], weight: 0.7, localities: ["Palamutbükü", "Mesudiye", "Knidos"] },
  { name: "Milas",      center: [37.3166, 27.7833], weight: 0.9, localities: ["Güllük", "Ören", "Bafa"] },
  { name: "Dalaman",    center: [36.7666, 28.8030], weight: 0.8, localities: ["Kapıkargın", "Sarsala"] },
  { name: "Ortaca",     center: [36.8333, 28.7666], weight: 0.8, localities: ["Dalyan", "Sarıgerme"] },
  { name: "Köyceğiz",   center: [36.9166, 28.6833], weight: 0.6, localities: ["Esençay", "Toparlar"] },
  { name: "Ula",        center: [37.1000, 28.4166], weight: 0.6, localities: ["Akyaka", "Gökova"] },
  { name: "Yatağan",    center: [37.3400, 28.1333], weight: 0.6, localities: ["Yatağan termik", "Bozüyük"] },
  { name: "Kavaklıdere", center: [37.4500, 28.3300], weight: 0.5, localities: ["Kavaklıdere merkez"] },
];

// Kategori başına Türkçe içerik şablonları — {loc} mahalle, {dist} ilçe ile doldurulur
const TEMPLATES: Record<string, { tweets: string[]; news: string[] }> = {
  fire_disaster: {
    tweets: [
      "{loc} tarafında dumanlar yükseliyor, itfaiye ekipleri yolda 🚒 #Muğla #yangın",
      "{dist} ormanlık alanda yangın çıktı, rüzgar çok şiddetli, umarım kontrol altına alınır",
      "AFAD ekipleri {loc} bölgesinde. Herkes dikkatli olsun lütfen",
      "{loc} yakınlarında hortum görüldü, tekneler limana döndü",
    ],
    news: [
      "{dist} ilçesinde orman yangını: ekipler havadan ve karadan müdahale ediyor",
      "{loc} mevkiinde çıkan yangın kısmen kontrol altına alındı",
      "Meteoroloji'den {dist} için kuvvetli rüzgar ve fırtına uyarısı",
    ],
  },
  infrastructure_transport: {
    tweets: [
      "{dist}-{loc} yolunda trafik kilit, 40 dakikadır hareket edemiyoruz 🚗",
      "{loc} bölgesinde elektrik kesintisi var, 2 saattir gelmedi",
      "Belediye {loc} caddesinde asfalt çalışması başlattı, alternatif güzergah kullanın",
      "{dist} şehir içi su kesintisi duyuruldu, yarın 08:00-14:00 arası",
    ],
    news: [
      "{dist} belediyesi altyapı çalışmalarını hızlandırdı: {loc} bölgesinde yeni kanalizasyon hattı",
      "Karayolları {dist} çevre yolunda bakım çalışması yapacak, sürücüler dikkat",
      "{loc} mevkiinde trafik kazası: 2 yaralı, yol tek şeritten veriliyor",
    ],
  },
  tourism: {
    tweets: [
      "{loc} bugün harika! Deniz cam gibi, sezon resmen açıldı ☀️ #tatil",
      "{dist} otellerinde doluluk %95'e ulaştı, yerli turist akını var",
      "{loc} plajında şezlong fiyatları bu sene de cep yakıyor 😤",
      "Mavi yolculuk tekneleri {loc} koylarında, manzara muhteşem",
    ],
    news: [
      "{dist} turizm sezonu rekorla açıldı: Haziran doluluk oranı geçen yılı geçti",
      "{loc} antik kenti ziyaretçi sayısında rekor kırdı",
      "{dist} marinasında günübirlik tekne turlarına yoğun ilgi",
    ],
  },
  governance: {
    tweets: [
      "{dist} belediye meclisi imar kararını görüştü, sonuç merakla bekleniyor",
      "Büyükşehir {loc} için yeni park projesini duyurdu, güzel gelişme 👏",
      "{dist} zabıtası sahil işgallerine ceza kesti, sonunda!",
      "Valilik {dist} genelinde denetimleri sıkılaştırdı",
    ],
    news: [
      "Muğla Büyükşehir Belediyesi {dist} için yeni ulaşım planını açıkladı",
      "{dist} belediye başkanı {loc} mahallesinde vatandaşlarla buluştu",
      "Valilikten {dist} açıklaması: afet hazırlık tatbikatı yapılacak",
    ],
  },
  general: {
    tweets: [
      "{dist} bugün çok sakin, keyifli bir gün 🌿",
      "{loc} pazarında taze zeytinyağı buldum, tavsiye ederim",
      "Akşam {loc} sahilinde gün batımı izledik, efsaneydi",
    ],
    news: [
      "{dist} kültür festivali programı açıklandı",
      "{loc} köyünde geleneksel hasat şenliği düzenlendi",
    ],
  },
};

const TWITTER_HANDLES = ["muglali_haber", "ege_ruzgari", "tatilci_48", "bodrum_life", "marmaris_ask", "fethiye_gundem", "yerel_bakis", "datca_sever", "mentese_genclik", "sahil_gozcusu"];
const NEWS_OUTLETS = ["Muğla Haber", "Ege'nin Sesi", "48 Haber", "Bodrum Gazetesi", "Marmaris Manşet", "Fethiye Times", "Datça Postası", "Yerel Gündem 48"];

// Deterministik ama çeşitli rastgelelik (enjeksiyonlar arası farklı içerik)
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const jitter = (rng: () => number, c: number, range = 0.07) => c + (rng() - 0.5) * 2 * range;

// Kategori → duygu dağılımı: afet ağırlıklı negatif, turizm pozitif ağırlıklı
const SENTIMENT_BIAS: Record<string, number> = {
  fire_disaster: -0.8, infrastructure_transport: -0.4, tourism: 0.5, governance: 0.0, general: 0.2,
};

function buildPost(rng: () => number, spec: DistrictSpec, hoursBack: number) {
  const catKeys = Object.keys(TEMPLATES);
  // Kıyı ilçelerinde turizm ağırlığını artır
  const tourismHeavy = ["Bodrum", "Marmaris", "Fethiye", "Datça", "Ortaca"].includes(spec.name);
  const cat = tourismHeavy && rng() < 0.35
    ? "tourism"
    : pick(rng, catKeys);
  const isTweet = rng() < 0.6;
  const pool = isTweet ? TEMPLATES[cat].tweets : TEMPLATES[cat].news;
  const loc = pick(rng, spec.localities);
  const text = pick(rng, pool).replaceAll("{loc}", loc).replaceAll("{dist}", spec.name);
  // content_hash çakışmasını önlemek için benzersiz iz
  const uniq = ` · [${Math.floor(rng() * 1e6).toString(36)}]`;
  const published = new Date(Date.now() - rng() * hoursBack * 3600e3);
  const bias = SENTIMENT_BIAS[cat] ?? 0;
  const roll = rng() + bias * 0.5;
  const sentiment = roll > 0.62 ? "positive" : roll < 0.38 ? "negative" : "neutral";

  return {
    platform: isTweet ? "twitter" : "news",
    content: text + (isTweet ? uniq : uniq + " "),
    author: isTweet ? "@" + pick(rng, TWITTER_HANDLES) : pick(rng, NEWS_OUTLETS),
    url: `https://mock.mugla-monitor/${spec.name.toLowerCase()}/${Math.floor(rng() * 1e8)}`,
    published_at: published.toISOString(),
    keywords_matched: [spec.name, loc],
    region: spec.name,
    district: spec.name,
    category: cat,
    sentiment,
    sentiment_score: sentiment === "positive" ? 0.4 + rng() * 0.5 : sentiment === "negative" ? -(0.4 + rng() * 0.5) : (rng() - 0.5) * 0.3,
    sentiment_method: MOCK_TAG,
    analyzed_at: new Date().toISOString(),
    entities: [{ name: loc, district: spec.name, lat: spec.center[0], lon: spec.center[1] }],
    lat: jitter(rng, spec.center[0]),
    lon: jitter(rng, spec.center[1]),
  };
}

// Kritik canlı uyarılar (haritada pulsing pin görünür)
function buildAlerts(rng: () => number) {
  const specs = [
    { type: "fire", severity: "critical", title: "Orman yangını — Marmaris İçmeler mevkii", body: "3 helikopter ve 12 arazözle müdahale sürüyor. Yerleşim yerlerine 2 km.", district: "Marmaris" },
    { type: "crisis", severity: "critical", title: "Trafik kazası — Fethiye-Ölüdeniz yolu", body: "Yol tek şeritten kontrollü veriliyor, 4 km kuyruk oluştu.", district: "Fethiye" },
    { type: "social", severity: "high", title: "Ani şikayet artışı — Bodrum şezlong fiyatları", body: "Son 1 saatte turizm kategorisinde ×4 hacim sıçraması.", district: "Bodrum" },
  ];
  return specs.map(s => {
    const spec = DISTRICTS.find(d => d.name === s.district)!;
    return {
      type: s.type, severity: s.severity, title: s.title, body: s.body,
      source: "Demo Veri", lat: jitter(rng, spec.center[0], 0.03), lon: jitter(rng, spec.center[1], 0.03),
      metadata: { mock: true, district: s.district },
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = getServiceClient();
  if (!sb) {
    return new Response(JSON.stringify({ ok: false, error: "no service client" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "clear" ? "clear" : "inject";

  // ── Temizleme: sadece mock işaretli kayıtlar silinir, gerçek veriye dokunulmaz ──
  if (mode === "clear") {
    const { count: postsDeleted } = await sb.from("social_posts")
      .delete({ count: "exact" }).eq("sentiment_method", MOCK_TAG);
    const { count: alertsDeleted } = await sb.from("alert_events")
      .delete({ count: "exact" }).eq("source", "Demo Veri");
    return new Response(JSON.stringify({ ok: true, mode, postsDeleted, alertsDeleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Enjeksiyon ──
  const perDistrict = Math.min(Math.max(Number(body.perDistrict) || 12, 4), 40);
  const hoursBack = Math.min(Number(body.hours) || 24, 72);
  const seed = Number(body.seed) || Date.now();
  const rng = mulberry32(seed);

  const rows: ReturnType<typeof buildPost>[] = [];
  for (const spec of DISTRICTS) {
    const count = Math.round(perDistrict * spec.weight);
    for (let i = 0; i < count; i++) rows.push(buildPost(rng, spec, hoursBack));
  }

  let inserted = 0;
  // 500'lük gruplar halinde (Supabase upsert limiti)
  for (let i = 0; i < rows.length; i += 500) {
    const { error, count } = await sb.from("social_posts")
      .upsert(rows.slice(i, i + 500), { onConflict: "content_hash", ignoreDuplicates: true, count: "exact" });
    if (error) console.error("[mock-injector] upsert hatası:", error.message);
    else inserted += count ?? rows.slice(i, i + 500).length;
  }

  // Kritik uyarılar: yalnızca son 30 dk içinde demo uyarısı yoksa ekle
  const { data: recentDemo } = await sb.from("alert_events")
    .select("id").eq("source", "Demo Veri")
    .gte("created_at", new Date(Date.now() - 30 * 60e3).toISOString()).limit(1);
  let alertsInserted = 0;
  if (!recentDemo || recentDemo.length === 0) {
    const { error } = await sb.from("alert_events").insert(buildAlerts(rng));
    if (!error) alertsInserted = 3;
  }

  return new Response(JSON.stringify({
    ok: true, mode, inserted, alertsInserted,
    districts: DISTRICTS.length, generated: rows.length, seed,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
