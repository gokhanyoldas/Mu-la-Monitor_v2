// src/data/muglaNetworkData.ts
// Muğla 13 İlçe ve Kritik Altyapı Ağ Topolojisi (İlişki ve Bağımlılık Matrisi)

export interface NetworkNode {
  id: string;
  name: string;
  category: "merkez" | "turizm_kiyisi" | "ulasim_kapisi" | "ekoloji_su" | "sanayi_tarim" | "altyapi_hub";
  emoji: string;
  role: string;
  population?: string;
  riskScore: number; // 0 - 100
  x: number; // Radyal diyagram için normalize koordinatlar (-400 ile +400 arası)
  y: number;
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  type: "altyapi_su" | "karayolu_koridor" | "turizm_transfer" | "afet_yangin" | "sismik_fay" | "idari" | "ekoloji_su";
  label: string;
  style: "solid" | "dashed";
  description: string;
}

export const MUGLA_NETWORK_NODES: NetworkNode[] = [
  // 1. Merkez Hub (Hamlet rolü - En yüksek bağlantı yoğunluğu)
  {
    id: "mentese",
    name: "Menteşe",
    category: "merkez",
    emoji: "🏢",
    role: "İl Merkezi, Valilik, Bölge Hastanesi & AKOM",
    population: "123.284",
    riskScore: 42,
    x: 0,
    y: 0
  },

  // 2. Birincil Kıyı ve Turizm Motorları (Claudius, Kraliçe, Horatio gibi ana odak noktaları)
  {
    id: "bodrum",
    name: "Bodrum",
    category: "turizm_kiyisi",
    emoji: "⛵",
    role: "Lüks Turizm, Marinalar & Yazlık Nüfus Piki",
    population: "198.335 (Yaz: 1.45M)",
    riskScore: 72,
    x: -240,
    y: -40
  },
  {
    id: "marmaris",
    name: "Marmaris",
    category: "turizm_kiyisi",
    emoji: "🏖️",
    role: "Kruvaziyer, Kıyı Bandı & Yangın Koridoru",
    population: "97.818 (Yaz: 750K)",
    riskScore: 78,
    x: 180,
    y: 40
  },
  {
    id: "fethiye",
    name: "Fethiye",
    category: "turizm_kiyisi",
    emoji: "🧿",
    role: "Mavi Yolculuk, Ölüdeniz & Sismik Koridor",
    population: "181.415 (Yaz: 850K)",
    riskScore: 66,
    x: 240,
    y: 190
  },
  {
    id: "milas",
    name: "Milas",
    category: "altyapi_hub",
    emoji: "🏛️",
    role: "BJV Havalimanı, Geyik Barajı & Bodrum Su Tedariği",
    population: "151.590",
    riskScore: 58,
    x: -180,
    y: -170
  },

  // 3. Ulaşım ve Geçiş Koridorları
  {
    id: "dalaman",
    name: "Dalaman",
    category: "ulasim_kapisi",
    emoji: "✈️",
    role: "DLM Uluslararası Havalimanı & Bölge Hava Kapısı",
    population: "49.012",
    riskScore: 52,
    x: 160,
    y: 130
  },
  {
    id: "ula",
    name: "Ula",
    category: "turizm_kiyisi",
    emoji: "🌾",
    role: "Sakar Rampası Geçişi & Akyaka Gökova",
    population: "27.537",
    riskScore: 60,
    x: 60,
    y: -70
  },
  {
    id: "ortaca",
    name: "Ortaca",
    category: "ekoloji_su",
    emoji: "🌲",
    role: "Dalyan Kanalı & İztuzu Koruma Sahası",
    population: "55.437",
    riskScore: 54,
    x: 100,
    y: 160
  },

  // 4. Doğa, Su ve Çevre Çevre Düğümleri
  {
    id: "datca",
    name: "Datça",
    category: "turizm_kiyisi",
    emoji: "🌿",
    role: "Tek Karayolu İzolasyonu & Badem Üretimi",
    population: "25.741",
    riskScore: 64,
    x: -80,
    y: 170
  },
  {
    id: "koycegiz",
    name: "Köyceğiz",
    category: "ekoloji_su",
    emoji: "🌊",
    role: "Göl Su Regülasyonu & Sığla Ormanları",
    population: "40.167",
    riskScore: 48,
    x: 80,
    y: 90
  },
  {
    id: "seydikemer",
    name: "Seydikemer",
    category: "sanayi_tarim",
    emoji: "🏔️",
    role: "Eşen Çayı, Saklıkent & Antalya İl Sınırı",
    population: "63.870",
    riskScore: 50,
    x: 290,
    y: 270
  },

  // 5. Kuzey Sanayi, Enerji ve Orman Çevre Düğümleri
  {
    id: "yatagan",
    name: "Yatağan",
    category: "sanayi_tarim",
    emoji: "⚡",
    role: "Termik Enerji, Madencilik & D-550 Kavşağı",
    population: "45.283",
    riskScore: 56,
    x: -90,
    y: -210
  },
  {
    id: "kavaklidere",
    name: "Kavaklıdere",
    category: "sanayi_tarim",
    emoji: "🌲",
    role: "Yüksek Orman Gözetleme & Bakırcılık",
    population: "10.738",
    riskScore: 36,
    x: 0,
    y: -280
  },

  // 6. Kritik Altyapı Düğümleri (Ağdaki Stratejik Tesisler)
  {
    id: "geyik_baraji",
    name: "Geyik & Mumcular Barajı",
    category: "altyapi_hub",
    emoji: "💧",
    role: "Bodrum ve Milas Ana İçme Suyu Kaynağı",
    riskScore: 82,
    x: -280,
    y: -120
  },
  {
    id: "sakar_rampasi",
    name: "Sakar Rampası Boğazı",
    category: "ulasim_kapisi",
    emoji: "⚠️",
    role: "Marmaris ve Datça'nın Tek Karayolu Girişi",
    riskScore: 76,
    x: 100,
    y: -20
  },
  {
    id: "dlm_havalimani",
    name: "Dalaman Havalimanı (DLM)",
    category: "ulasim_kapisi",
    emoji: "🛫",
    role: "Güney Kıyı Turist Transfer Hub'ı",
    riskScore: 50,
    x: 220,
    y: 110
  },
  {
    id: "bjv_havalimani",
    name: "Milas-Bodrum Havalimanı (BJV)",
    category: "ulasim_kapisi",
    emoji: "🛬",
    role: "Kuzey Kıyı Turist Transfer Hub'ı",
    riskScore: 55,
    x: -220,
    y: -230
  }
];

export const MUGLA_NETWORK_LINKS: NetworkLink[] = [
  // ── MENTEŞE MERKEZ OMURGA BAĞLANTILARI ──
  {
    id: "l-mentese-bodrum",
    source: "mentese",
    target: "bodrum",
    type: "karayolu_koridor",
    label: "D-330 Ana Karayolu Aksı",
    style: "solid",
    description: "Menteşe idari ve sağlık merkezi ile Bodrum arasındaki 110 km'lik ana arter."
  },
  {
    id: "l-mentese-milas",
    source: "mentese",
    target: "milas",
    type: "karayolu_koridor",
    label: "D-330 Karayolu Bağlantısı",
    style: "solid",
    description: "Milas sanayi ve tarım ürünlerinin il merkezine ana nakil hattı."
  },
  {
    id: "l-mentese-yatagan",
    source: "mentese",
    target: "yatagan",
    type: "karayolu_koridor",
    label: "D-550 İzmir/Aydın Koridoru",
    style: "solid",
    description: "Muğla'nın kuzeye ve büyükşehirlere açılan 28 km'lik ana bağlantı arteri."
  },
  {
    id: "l-mentese-ula",
    source: "mentese",
    target: "ula",
    type: "idari",
    label: "Kentsel Gelişim & Sakar Geçişi",
    style: "solid",
    description: "Menteşe platosundan Gökova Körfezi'ne iniş ve komşu ilçe entegrasyonu."
  },
  {
    id: "l-mentese-marmaris",
    source: "mentese",
    target: "marmaris",
    type: "idari",
    label: "AKOM Afet Koordinasyon Hattı",
    style: "dashed",
    description: "Menteşe Afet ve Kriz Merkezi ile Marmaris Orman Yangın Komuta Merkezi telsiz bağı."
  },
  {
    id: "l-mentese-fethiye",
    source: "mentese",
    target: "fethiye",
    type: "idari",
    label: "Bölge Sağlık & Adli Koordinasyon",
    style: "dashed",
    description: "Muğla Eğitim ve Araştırma Hastanesi üçüncü basamak sevk koridoru."
  },

  // ── BODRUM VE MİLAS ALTYAPI BAĞLANTILARI ──
  {
    id: "l-milas-bodrum",
    source: "milas",
    target: "bodrum",
    type: "karayolu_koridor",
    label: "Bodrum-Milas Transit Koridoru",
    style: "solid",
    description: "Günlük ortalama 45.000 aracın geçtiği D-330 ortak karayolu aksı."
  },
  {
    id: "l-baraj-bodrum",
    source: "geyik_baraji",
    target: "bodrum",
    type: "altyapi_su",
    label: "Geyik & Mumcular İçme Suyu İsalesi",
    style: "solid",
    description: "Bodrum yarımadasının içme suyunun %65'ini sağlayan MUSKİ çelik isale hattı."
  },
  {
    id: "l-baraj-milas",
    source: "geyik_baraji",
    target: "milas",
    type: "altyapi_su",
    label: "Milas İçme Suyu & Arıtma",
    style: "solid",
    description: "Milas kentsel su şebekesi ve arıtma tesisi besleme hattı."
  },
  {
    id: "l-bjv-bodrum",
    source: "bjv_havalimani",
    target: "bodrum",
    type: "turizm_transfer",
    label: "BJV Turist Transfer Koridoru",
    style: "dashed",
    description: "Havalimanından Bodrum otel ve marinalarına yapılan charter ve VIP transfer hattı."
  },
  {
    id: "l-bjv-milas",
    source: "bjv_havalimani",
    target: "milas",
    type: "karayolu_koridor",
    label: "Havalimanı Yerleşkesi & Lojistik",
    style: "solid",
    description: "Havalimanının Milas mülki sınırlarında bulunması sebebiyle idari ve lojistik bağ."
  },

  // ── MARMARİS, ULA VE SAKAR BOĞAZI ──
  {
    id: "l-ula-sakar",
    source: "ula",
    target: "sakar_rampasi",
    type: "karayolu_koridor",
    label: "Sakar İnişi (670m Rakım Farkı)",
    style: "solid",
    description: "Akyaka ve Gökova Körfezi'ne inen dik eğimli kritik karayolu boğazı."
  },
  {
    id: "l-sakar-marmaris",
    source: "sakar_rampasi",
    target: "marmaris",
    type: "karayolu_koridor",
    label: "Gökova - Marmaris Ana Girişi",
    style: "solid",
    description: "Marmaris ve Datça ilçelerinin ana karaya tek bağlantı koridoru."
  },
  {
    id: "l-marmaris-datca",
    source: "marmaris",
    target: "datca",
    type: "karayolu_koridor",
    label: "D-400 Datça Yarımada Yolu (70 km)",
    style: "solid",
    description: "Datça'nın tek karayolu arteridir; heyelan veya yangında alternatif kara yolu bulunmaz."
  },
  {
    id: "l-bodrum-datca",
    source: "bodrum",
    target: "datca",
    type: "turizm_transfer",
    label: "Bodrum - Datça Feribot Hattı",
    style: "dashed",
    description: "Gökova Körfezi üzerinden 1 saat 45 dakikalık deniz köprüsü."
  },

  // ── DALAMAN, ORTACA VE KÖYCEĞİZ SU/HAVALİMANI AĞI ──
  {
    id: "l-dlm-marmaris",
    source: "dlm_havalimani",
    target: "marmaris",
    type: "turizm_transfer",
    label: "DLM - Marmaris Transfer Aksı (90 km)",
    style: "dashed",
    description: "İngiltere ve Avrupa'dan gelen charter turistlerin Marmaris otellerine transferi."
  },
  {
    id: "l-dlm-fethiye",
    source: "dlm_havalimani",
    target: "fethiye",
    type: "turizm_transfer",
    label: "DLM - Göcek - Fethiye Transferi",
    style: "dashed",
    description: "Göcek Tüneli üzerinden 45 dakikalık hızlı havalimanı erişimi."
  },
  {
    id: "l-dlm-dalaman",
    source: "dlm_havalimani",
    target: "dalaman",
    type: "karayolu_koridor",
    label: "Havalimanı Kentsel Yerleşke",
    style: "solid",
    description: "Dalaman ilçe merkezi ile hava meydanı doğrudan entegrasyonu."
  },
  {
    id: "l-ortaca-dalaman",
    source: "ortaca",
    target: "dalaman",
    type: "karayolu_koridor",
    label: "D-400 Çift Şeritli Sahil Geçişi",
    style: "solid",
    description: "Tarımsal lojistik ve narenciye sevkiyat koridoru."
  },
  {
    id: "l-koycegiz-ortaca",
    source: "koycegiz",
    target: "ortaca",
    type: "ekoloji_su",
    label: "Dalyan Kanalı & Göl Boşalımı",
    style: "solid",
    description: "Köyceğiz Gölü'nün Akdeniz'e aktığı doğal lagün kanalı sistemi."
  },

  // ── FETHİYE, SEYDİKEMER VE GÜNEY SİSMİK KORİDORU ──
  {
    id: "l-fethiye-seydikemer",
    source: "fethiye",
    target: "seydikemer",
    type: "karayolu_koridor",
    label: "D-350 Yayla Karayolu Koridoru",
    style: "solid",
    description: "Fethiye kıyı turizmi ile Seydikemer tarım arazilerini birleştiren ortak vadi."
  },
  {
    id: "l-fethiye-seydikemer-fay",
    source: "fethiye",
    target: "seydikemer",
    type: "sismik_fay",
    label: "Fethiye-Burdur Fay Zonu",
    style: "dashed",
    description: "Bölgenin en aktif sismik kırık hattı; deprem erken uyarı sensörleri ortak çalışır."
  },

  // ── KUZEY VE İÇ KESİMLER (YATAĞAN & KAVAKLIDERE) ──
  {
    id: "l-yatagan-kavaklidere",
    source: "yatagan",
    target: "kavaklidere",
    type: "karayolu_koridor",
    label: "Kavaklıdere Dağ Yolu (24 km)",
    style: "solid",
    description: "Yüksek rakımlı orman ilçesinin anayol şebekesine tek resmi bağlantısı."
  },
  {
    id: "l-milas-yatagan",
    source: "milas",
    target: "yatagan",
    type: "karayolu_koridor",
    label: "İç Ege - Kıyı Bağlantı Yolu",
    style: "solid",
    description: "Maden ve enerji sevkiyatı için kullanılan ağır vasıta koridoru."
  },

  // ── ORMAN YANGINI VE AFET ERKEN UYARI KORİDORLARI ──
  {
    id: "l-yangin-marmaris-koycegiz",
    source: "marmaris",
    target: "koycegiz",
    type: "afet_yangin",
    label: "Balıkaşıran - Çubucak Rüzgar Koridoru",
    style: "dashed",
    description: "Yaz aylarında kuzeybatı fırtınalarının yangını taşıma riski bulunan kızılçam koridoru."
  },
  {
    id: "l-yangin-milas-bodrum",
    source: "milas",
    target: "bodrum",
    type: "afet_yangin",
    label: "Güvercinlik - Meşelik Yangın Tamponu",
    style: "dashed",
    description: "Milas kırsalından Bodrum yarımadası girişine uzanan orman arayüzü gözetleme hattı."
  }
];

export const LINK_TYPE_COLORS: Record<string, { label: string; color: string; dash: boolean }> = {
  karayolu_koridor: { label: "Ana Karayolu & Arter", color: "#38bdf8", dash: false },
  altyapi_su:       { label: "Su & Baraj İsale Hattı", color: "#06b6d4", dash: false },
  ekoloji_su:       { label: "Ekoloji & Su Regülasyonu", color: "#14b8a6", dash: false },
  turizm_transfer:  { label: "Turizm & Havalimanı Transferi", color: "#ec4899", dash: true },
  afet_yangin:      { label: "Orman Yangını / Afet Koridoru", color: "#ef4444", dash: true },
  sismik_fay:       { label: "Sismik Fay Hattı İlişkisi", color: "#a855f7", dash: true },
  idari:            { label: "İdari & Sağlık Koordinasyonu", color: "#10b981", dash: true }
};
