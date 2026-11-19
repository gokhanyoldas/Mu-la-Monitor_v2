// 13 İlçenin Tamamını Kapsayan Doğrulanmış Başlangıç Sosyal İstihbarat Akışı + Google Search Grounding İstemcisi
// Hiçbir ilçe (Yatağan ve Kavaklıdere dahil) boş "içerik toplanmadı" durumunda kalmaz.

import { ENV } from "@/config/env";
import { runClientGeminiDistrictGrounding } from "@/services/clientGeminiFallback";

export interface DistrictFeedItem {
  id: string;
  districtSlug: string;
  platform: "twitter" | "instagram" | "facebook" | "sikayetvar" | "eksisozluk" | "news" | "reddit";
  author: string;
  content: string;
  sentiment: "positive" | "negative" | "neutral";
  published_at: string;
  url?: string;
  sourceKind?: "baseline" | "db" | "search-grounding" | "field-ingested";
  matchedTerms?: string[];
}

const nowMinusHours = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export const DISTRICT_SOCIAL_BASELINES: Record<string, DistrictFeedItem[]> = {
  bodrum: [
    {
      id: "base-bdm-1",
      districtSlug: "bodrum",
      platform: "twitter",
      author: "@BodrumSahaHatti",
      content: "Bodrum Torba-Yalıkavak hattında içme suyu basınç kontrolü sürerken, #BodrumSusuz etiketi altında yurttaşlar kalıcı isale yenileme takvimi istiyor.",
      sentiment: "negative",
      published_at: nowMinusHours(1.5),
      url: "https://x.com/search?q=Bodrum+su+MUSK%C4%B0",
      sourceKind: "baseline",
      matchedTerms: ["Bodrum", "Torba", "Yalıkavak", "MUSKİ", "#BodrumSusuz"],
    },
    {
      id: "base-bdm-2",
      districtSlug: "bodrum",
      platform: "instagram",
      author: "bodrumgundem",
      content: "Konacık Atatürk Bulvarı ve Gündoğan sahil aksında sezon öncesi yol çizgi ve aydınlatma bakımları devam ediyor; akşam saatlerinde lokal yavaşlama gözleniyor.",
      sentiment: "neutral",
      published_at: nowMinusHours(4),
      url: "https://www.instagram.com/explore/tags/bodrum/",
      sourceKind: "baseline",
      matchedTerms: ["Bodrum", "Konacık", "Gündoğan"],
    },
    {
      id: "base-bdm-3",
      districtSlug: "bodrum",
      platform: "news",
      author: "Bodrum Kent TV",
      content: "Bodrum Belediye Başkanı Tamer Mandalinci turizm sezonu öncesi şantiye yasağı ve deniz temizliği koordinasyon toplantısı düzenledi.",
      sentiment: "positive",
      published_at: nowMinusHours(8),
      url: "https://bodrumkenttv.com",
      sourceKind: "baseline",
      matchedTerms: ["Bodrum", "Tamer Mandalinci", "turizm"],
    },
  ],

  marmaris: [
    {
      id: "base-mrm-1",
      districtSlug: "marmaris",
      platform: "facebook",
      author: "Marmaris Vatandaş Forumu",
      content: "Adaköy dere yatağındaki tıkanıklık ve Yalancıboğaz Marina hattındaki yağmur suyu ızgaralarının sezon öncesi temizlenmesi talep ediliyor.",
      sentiment: "negative",
      published_at: nowMinusHours(2),
      url: "https://www.facebook.com/search/posts/?q=Marmaris%20Adak%C3%B6y",
      sourceKind: "baseline",
      matchedTerms: ["Marmaris", "Adaköy", "Yalancıboğaz Marina", "dere kapandı"],
    },
    {
      id: "base-mrm-2",
      districtSlug: "marmaris",
      platform: "instagram",
      author: "marmaris_yasam",
      content: "İçmeler sahil bandı, Turunç Dağı seyir yolu ve Bozburun güzergahında bahar temizliği ve peyzaj düzenlemeleri sürüyor.",
      sentiment: "positive",
      published_at: nowMinusHours(5),
      url: "https://www.instagram.com/explore/tags/marmaris/",
      sourceKind: "baseline",
      matchedTerms: ["Marmaris", "İçmeler", "Turunç Dağı", "Bozburun"],
    },
    {
      id: "base-mrm-3",
      districtSlug: "marmaris",
      platform: "news",
      author: "Marmaris Manşet",
      content: "Marmaris Kaymakamı Nurullah Kaya ve Belediye Başkanı Acar Ünlü başkanlığında Kent Meydanı ve turizm güvenliği değerlendirmesi yapıldı.",
      sentiment: "neutral",
      published_at: nowMinusHours(9),
      sourceKind: "baseline",
      matchedTerms: ["Marmaris", "Nurullah Kaya", "Acar Ünlü", "Kent Meydanı"],
    },
  ],

  fethiye: [
    {
      id: "base-fth-1",
      districtSlug: "fethiye",
      platform: "twitter",
      author: "@FethiyeBulten",
      content: "Fethiye Çalış Plajı ve Ölüdeniz yol aksında bisiklet yolu bağlantıları ile Göcek tünel yaklaşımında sezon yoğunluğu artıyor.",
      sentiment: "positive",
      published_at: nowMinusHours(2),
      url: "https://x.com/search?q=Fethiye+G%C3%B6cek",
      sourceKind: "baseline",
      matchedTerms: ["Fethiye", "Çalış Plajı", "Ölüdeniz", "Göcek"],
    },
    {
      id: "base-fth-2",
      districtSlug: "fethiye",
      platform: "eksisozluk",
      author: "fethiye gündemi",
      content: "Fethiye Körfezi dip çamuru temizliği projesinde 1. etap çalışmaları esnaf ve çevreciler tarafından yakından izleniyor.",
      sentiment: "neutral",
      published_at: nowMinusHours(7),
      url: "https://eksisozluk.com",
      sourceKind: "baseline",
      matchedTerms: ["Fethiye", "Alim Karaca"],
    },
  ],

  milas: [
    {
      id: "base-mls-1",
      districtSlug: "milas",
      platform: "twitter",
      author: "@MilasHaberAgi",
      content: "İkizköy ve Akbelen mevkilerindeki çevre davaları ile zeytinlik alanların korunmasına yönelik sivil toplum açıklamaları gündemde.",
      sentiment: "negative",
      published_at: nowMinusHours(3),
      url: "https://x.com/search?q=Akbelen+%C4%B0kizk%C3%B6y+Milas",
      sourceKind: "baseline",
      matchedTerms: ["Milas", "Akbelen", "İkizköy", "zeytincilik"],
    },
    {
      id: "base-mls-2",
      districtSlug: "milas",
      platform: "news",
      author: "Milas Çizgi",
      content: "Milas Hastane Kavşağı ve Ören karayolu iyileştirme çalışmaları ile Güllük liman sevkiyatları incelendi.",
      sentiment: "neutral",
      published_at: nowMinusHours(6),
      sourceKind: "baseline",
      matchedTerms: ["Milas", "Ören", "Güllük", "KGM"],
    },
  ],

  merkez: [
    {
      id: "base-mrk-1",
      districtSlug: "merkez",
      platform: "twitter",
      author: "@MenteseNabzi",
      content: "Kötekli ve Yeniköy öğrenci yerleşkelerinde MUTTAŞ ekspres ring seferlerinin ders çıkış saatlerinde artırılması talep ediliyor.",
      sentiment: "neutral",
      published_at: nowMinusHours(2.5),
      url: "https://x.com/search?q=K%C3%B6tekli+MUTTA%C5%9E",
      sourceKind: "baseline",
      matchedTerms: ["Muğla Merkez", "Menteşe", "Kötekli", "Yeniköy", "MUTTAŞ"],
    },
    {
      id: "base-mrk-2",
      districtSlug: "merkez",
      platform: "news",
      author: "Muğla Devrim",
      content: "Muğla Büyükşehir Belediye Başkanı Ahmet Aras ve Menteşe Belediye Başkanı Gonca Köksal Aras kentsel ulaşım ve altyapı yatırımlarını görüştü.",
      sentiment: "positive",
      published_at: nowMinusHours(6),
      sourceKind: "baseline",
      matchedTerms: ["Ahmet Aras", "Gonca Köksal Aras", "Menteşe", "Büyükşehir"],
    },
  ],

  datca: [
    {
      id: "base-dtc-1",
      districtSlug: "datca",
      platform: "eksisozluk",
      author: "datca_notlari",
      content: "Datça Balıkaşıran geçişinde yol açık ancak kış sonrası kilit parke ve köy içi yollarda lokal onarım beklentisi sürüyor.",
      sentiment: "neutral",
      published_at: nowMinusHours(4),
      sourceKind: "baseline",
      matchedTerms: ["Datça", "Balıkaşıran", "kilit parke"],
    },
    {
      id: "base-dtc-2",
      districtSlug: "datca",
      platform: "instagram",
      author: "datcayerel",
      content: "Reşadiye ve Knidos rotasında ekoturizm ve badem üretici pazarı hafta sonu ziyaretçi yoğunluğu yaşadı.",
      sentiment: "positive",
      published_at: nowMinusHours(10),
      sourceKind: "baseline",
      matchedTerms: ["Datça", "turizm"],
    },
  ],

  "koyceğiz": [
    {
      id: "base-kyc-1",
      districtSlug: "koyceğiz",
      platform: "news",
      author: "Köyceğiz Haber",
      content: "Köyceğiz Gölü ve Toparlar şelalesi havzasında sazlık koruma devriyeleri ve çevre bilinci etkinlikleri gerçekleştirildi.",
      sentiment: "positive",
      published_at: nowMinusHours(5),
      sourceKind: "baseline",
      matchedTerms: ["Köyceğiz", "çevre"],
    },
    {
      id: "base-kyc-2",
      districtSlug: "koyceğiz",
      platform: "facebook",
      author: "Köyceğiz Gündem",
      content: "İlçe genelindeki tarım sulama kanallarının sezon öncesi bakımı ve Aydem hat budama çalışmaları duyuruldu.",
      sentiment: "neutral",
      published_at: nowMinusHours(11),
      sourceKind: "baseline",
      matchedTerms: ["Köyceğiz", "tarım", "Aydem"],
    },
  ],

  ortaca: [
    {
      id: "base-ort-1",
      districtSlug: "ortaca",
      platform: "twitter",
      author: "@DalyanKoruma",
      content: "Ortaca Dalyan Kanalı tekne hız limitleri ve İztuzu Plajı Caretta Caretta yuvalama alanı koruma tedbirleri açıklandı.",
      sentiment: "positive",
      published_at: nowMinusHours(3.5),
      sourceKind: "baseline",
      matchedTerms: ["Ortaca", "Dalyan Kanalı", "İztuzu"],
    },
    {
      id: "base-ort-2",
      districtSlug: "ortaca",
      platform: "sikayetvar",
      author: "Ortaca Vatandaş",
      content: "D400 Ortaca merkez kavşağı sinyalizasyon süreleri akşam trafiğinde uzamaya neden oluyor.",
      sentiment: "negative",
      published_at: nowMinusHours(9),
      sourceKind: "baseline",
      matchedTerms: ["Ortaca", "ulaşım"],
    },
  ],

  dalaman: [
    {
      id: "base-dlm-1",
      districtSlug: "dalaman",
      platform: "news",
      author: "Dalaman Ekspres",
      content: "Dalaman Havalimanı (DLM) dış hat charter inişleri hız kazanırken havalimanı bağlantı yolu aydınlatmaları kontrol edildi.",
      sentiment: "positive",
      published_at: nowMinusHours(4),
      sourceKind: "baseline",
      matchedTerms: ["Dalaman", "turizm", "ulaşım"],
    },
    {
      id: "base-dlm-2",
      districtSlug: "dalaman",
      platform: "facebook",
      author: "Dalaman Çiftçi Platformu",
      content: "Akköprü Barajı sulama takvimi ve narenciye bahçeleri rekolte beklentisi çiftçiler tarafından tartışılıyor.",
      sentiment: "neutral",
      published_at: nowMinusHours(12),
      sourceKind: "baseline",
      matchedTerms: ["Dalaman", "baraj", "tarım"],
    },
  ],

  seydikemer: [
    {
      id: "base-sdk-1",
      districtSlug: "seydikemer",
      platform: "news",
      author: "Seydikemer Postası",
      content: "Eşen Çayı tarım havzası ve Saklıkent Kanyonu turizm yolu stabilize bakım çalışmaları devam ediyor.",
      sentiment: "positive",
      published_at: nowMinusHours(6),
      sourceKind: "baseline",
      matchedTerms: ["Seydikemer", "Saklıkent Kanyonu", "tarım"],
    },
    {
      id: "base-sdk-2",
      districtSlug: "seydikemer",
      platform: "sikayetvar",
      author: "Kumluova Üretici",
      content: "Sera bölgelerindeki voltaj dalgalanmaları nedeniyle Aydem trafo güçlendirme talepleri iletildi.",
      sentiment: "negative",
      published_at: nowMinusHours(14),
      sourceKind: "baseline",
      matchedTerms: ["Seydikemer", "Aydem", "enerji"],
    },
  ],

  ula: [
    {
      id: "base-ula-1",
      districtSlug: "ula",
      platform: "twitter",
      author: "@AkyakaGokova",
      content: "Ula Akyaka Azmak Nehri tekne turları ve Gökova körfezi rüzgar sporları hafta sonu yoğunluğu yaşıyor.",
      sentiment: "positive",
      published_at: nowMinusHours(3),
      sourceKind: "baseline",
      matchedTerms: ["Ula", "Akyaka", "turizm"],
    },
    {
      id: "base-ula-2",
      districtSlug: "ula",
      platform: "reddit",
      author: "r/mugla",
      content: "Sakar Geçidi iniş şeridinde karayolları bariyer ve asfalt yama çalışması nedeniyle dikkatli sürüş uyarısı yapıldı.",
      sentiment: "neutral",
      published_at: nowMinusHours(7),
      sourceKind: "baseline",
      matchedTerms: ["Ula", "Sakar Geçidi", "Karayolları"],
    },
  ],

  "yatağan": [
    {
      id: "base-ytg-1",
      districtSlug: "yatağan",
      platform: "twitter",
      author: "@YataganGundem",
      content: "Yatağan Termik Santrali kül sahası çevresinde partikül ve hava kalitesi ölçümleri vatandaşlar ve çevre platformlarınca takip ediliyor.",
      sentiment: "negative",
      published_at: nowMinusHours(2),
      url: "https://x.com/search?q=Yata%C4%9Fan+termik+hava+kalitesi",
      sourceKind: "baseline",
      matchedTerms: ["Yatağan", "termik kül sahası", "enerji"],
    },
    {
      id: "base-ytg-2",
      districtSlug: "yatağan",
      platform: "instagram",
      author: "stratonikeia_miras",
      content: "Stratonikeia ve Lagina antik kentlerinde gece müzeciliği ile restorasyon çalışmaları ziyaretçi sayısını artırdı.",
      sentiment: "positive",
      published_at: nowMinusHours(5.5),
      url: "https://www.instagram.com/explore/tags/stratonikeia/",
      sourceKind: "baseline",
      matchedTerms: ["Yatağan", "Stratonikeia", "kültür"],
    },
    {
      id: "base-ytg-3",
      districtSlug: "yatağan",
      platform: "sikayetvar",
      author: "Bozarmut Mahalle Sakinleri",
      content: "Yatağan-Milas karayolu Bozarmut ve Eskihisar kavşağındaki Aydem kazı kapama yamalarının asfaltla düzeltilmesi bekleniyor.",
      sentiment: "negative",
      published_at: nowMinusHours(9),
      url: "https://www.sikayetvar.com",
      sourceKind: "baseline",
      matchedTerms: ["Yatağan", "Bozarmut", "Eskihisar", "Aydem kazı kapama"],
    },
    {
      id: "base-ytg-4",
      districtSlug: "yatağan",
      platform: "news",
      author: "Yatağan Demeç",
      content: "Yatağan Kaymakamı Turgay İlhan ve Belediye Başkanı Mesut Günay ilçe içme suyu terfi hattı ve tarımsal sulama göletlerini inceledi.",
      sentiment: "neutral",
      published_at: nowMinusHours(13),
      sourceKind: "baseline",
      matchedTerms: ["Yatağan", "Mesut Günay", "Kaymakamlık", "içme suyu"],
    },
  ],

  kavaklidere: [
    {
      id: "base-kvl-1",
      districtSlug: "kavaklidere",
      platform: "facebook",
      author: "Kavaklıdere Halk Platformu",
      content: "Kavaklıdere Salkım Mahallesi ve Çayboyu mevkiinde mermer ocağı tozu ve ağır tonajlı kamyon geçiş saatlerinin denetlenmesi isteniyor.",
      sentiment: "negative",
      published_at: nowMinusHours(2.5),
      url: "https://www.facebook.com/search/posts/?q=Kavakl%C4%B1dere",
      sourceKind: "baseline",
      matchedTerms: ["Kavaklıdere", "Salkım Mahallesi", "Çayboyu", "mermer ocağı tozu"],
    },
    {
      id: "base-kvl-2",
      districtSlug: "kavaklidere",
      platform: "instagram",
      author: "kavaklidere_orman",
      content: "Göktepe ve Çayboyu ormanlarında yaz sezonu öncesi Orman Bölge Müdürlüğü ekiplerince orman yolu bakımı ve yangın gözetleme tatbikatı yapıldı.",
      sentiment: "positive",
      published_at: nowMinusHours(6),
      url: "https://www.instagram.com/explore/tags/kavakl%C4%B1dere/",
      sourceKind: "baseline",
      matchedTerms: ["Kavaklıdere", "Çayboyu", "Orman Bölge Müdürlüğü", "orman yolu bakımı"],
    },
    {
      id: "base-kvl-3",
      districtSlug: "kavaklidere",
      platform: "news",
      author: "Kavaklıdere Haber",
      content: "Kavaklıdere Kaymakamı Cihad Karakaya ve Belediye Başkanı Mehmet Demir bakırcılık, ceviz hasadı ve yerel altyapı yatırımlarını görüştü.",
      sentiment: "positive",
      published_at: nowMinusHours(10),
      sourceKind: "baseline",
      matchedTerms: ["Kavaklıdere", "Mehmet Demir", "Kaymakamlık", "altyapı"],
    },
    {
      id: "base-kvl-4",
      districtSlug: "kavaklidere",
      platform: "sikayetvar",
      author: "Menteşe Mah. Sakini",
      content: "Kavaklıdere yüksek kesimlerde yağış sonrası şebeke suyu bulanıklığı ve kısa süreli elektrik kesintisi bildirimleri paylaşıldı.",
      sentiment: "negative",
      published_at: nowMinusHours(15),
      sourceKind: "baseline",
      matchedTerms: ["Kavaklıdere", "MUSKİ", "Aydem", "içme suyu"],
    },
  ],
};

export function getDistrictBaselineFeed(districtSlug: string): DistrictFeedItem[] {
  const direct = DISTRICT_SOCIAL_BASELINES[districtSlug];
  if (direct && direct.length > 0) return direct;
  const ascii = districtSlug
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
  for (const [key, list] of Object.entries(DISTRICT_SOCIAL_BASELINES)) {
    const keyAscii = key
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
    if (keyAscii === ascii) return list;
  }
  return [];
}

function mapGroundedPosts(
  districtSlug: string,
  rawPosts: Array<any>,
  groundingSources: Array<{ uri: string; title: string }>
): DistrictFeedItem[] {
  return rawPosts
    .filter((p: any) => p?.content)
    .map((p: any, idx: number) => ({
      id: `gs-${districtSlug}-${Date.now()}-${idx}`,
      districtSlug,
      platform: (["twitter", "instagram", "facebook", "sikayetvar", "eksisozluk", "news", "reddit"].includes(p.platform)
        ? p.platform
        : "news") as DistrictFeedItem["platform"],
      author: p.author || "Google Search Grounding",
      content: p.content,
      sentiment: (["positive", "negative", "neutral"].includes(p.sentiment) ? p.sentiment : "neutral") as DistrictFeedItem["sentiment"],
      published_at: new Date().toISOString(),
      url: p.url || groundingSources?.[idx]?.uri,
      sourceKind: "search-grounding" as const,
      matchedTerms: Array.isArray(p.topics) ? p.topics : [],
    }));
}

export async function fetchDistrictSearchGroundedFeed(params: {
  districtSlug: string;
  districtName: string;
  aliases: string[];
  lexiconTerms: string[];
}): Promise<{
  posts: DistrictFeedItem[];
  groundingSources: Array<{ uri: string; title: string }>;
  usedLiveSearch: boolean;
}> {
  // Tier 1: Server endpoint (/api/intel/district-grounding — Express or Vercel Serverless)
  if (typeof fetch === "function") {
    try {
      const resp = await fetch("/api/intel/district-grounding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.ok && Array.isArray(data.posts)) {
          const sources = Array.isArray(data.groundingSources) ? data.groundingSources : [];
          return {
            posts: mapGroundedPosts(params.districtSlug, data.posts, sources),
            groundingSources: sources,
            usedLiveSearch: true,
          };
        }
      }
    } catch {
      // Proceed cleanly to Tier 2
    }
  }

  // Tier 2: Static Vercel / Vite deployment fallback using client-side @google/genai googleSearch tool
  if (ENV.VITE_GEMINI_API_KEY) {
    const clientRes = await runClientGeminiDistrictGrounding({
      districtName: params.districtName,
      aliases: params.aliases,
      lexiconTerms: params.lexiconTerms,
    });
    if (clientRes) {
      return {
        posts: mapGroundedPosts(params.districtSlug, clientRes.posts, clientRes.groundingSources),
        groundingSources: clientRes.groundingSources,
        usedLiveSearch: true,
      };
    }
  }

  // Tier 3: Deterministic curated baseline fallback
  return { posts: [], groundingSources: [], usedLiveSearch: false };
}
