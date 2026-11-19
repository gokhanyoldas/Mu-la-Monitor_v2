// src/data/investigationData.ts
// Muğla Monitor v2 - İstihbarat, Kulis Dedikoduları, Medya ve Aktör İlişki Ağı Veri Seti

export type NodeType = "kulis_dedikodu" | "yerel_haber" | "sosyal_medya" | "aktor_resmi" | "resmi_teyit" | "belge_kanit";

export interface InvestigationNode {
  id: string;
  type: NodeType;
  label: string;
  title: string;
  source: string; // Örn: "Telegram Kulis Odası", "Bodrum Olay Gazetesi", "X/Twitter @MuglaHavadis", "Valilik GAMER"
  districtId: string;
  districtName: string;
  date: string;
  credibilityScore: number; // 0 - 100 (Güvenilirlik / Teyit Skoru)
  claimSummary: string;
  involvedActors: string[]; // İlgili kişi ve kurumlar
  tags: string[];
  x: number;
  y: number;
  status: "dogrulandi" | "supheli" | "yalanlandi" | "arastiriliyor";
}

export type RelationType = 
  | "iddia_ediyor"       // Kulis -> Aktör
  | "yayiyor"            // Sosyal Medya -> Haber
  | "kaynak_gosteriyor"  // Haber -> Kulis
  | "yalanliyor"         // Resmi Teyit -> Kulis
  | "teyit_ediyor"       // Resmi Teyit / Yerel Haber -> Olay
  | "cikar_catismasi"    // Aktör <-> Aktör
  | "hedef_aliyor"       // Kulis / Sosyal Medya -> Aktör
  | "celisiyor";          // Haber <-> Açıklama

export interface InvestigationLink {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  label: string;
  confidence: number; // 0 - 100
  evidenceQuote: string;
  isContradiction?: boolean;
}

export interface InvestigationDossier {
  id: string;
  code: string;
  title: string;
  districtId: string;
  districtName: string;
  category: "İçme Suyu & İhale" | "İmar & Kıyı Talanı" | "Körfez & Çevre" | "Ulaşım & Heyelan" | "Orman Yangını & İhmal";
  urgency: "Kritik" | "Yüksek" | "Orta";
  summary: string;
  interrogationPromptQuestions: string[];
  nodeIds: string[];
  linkIds: string[];
  officialVerdict: string;
  verdictScore: number; // Teyit Yüzdesi
}

// ── 1. DÜĞÜMLER (İddialar, Haberler, Aktörler, Teyitler) ──
export const INVESTIGATION_NODES: InvestigationNode[] = [
  // ── DOSYA 1: BODRUM SU KRİZİ & İHALE KULİSLERİ ──
  {
    id: "kulis-bodrum-su-ihale",
    type: "kulis_dedikodu",
    label: "Kulis İddiası",
    title: "Geyik Barajı İsale Hattı İhalesi Usulsüzlük İddiası",
    source: "Yerel Kulis & Fısıltı Gazetesi (Telegram)",
    districtId: "bodrum",
    districtName: "Bodrum",
    date: "Dün 22:40",
    credibilityScore: 22,
    claimSummary: "İçme suyu isale borularının düşük basınç sınıfı seçildiği, ihalenin kapalı kapılar ardında belirli bir konsorsiyuma verildiği fısıltısı.",
    involvedActors: ["MUSKİ İçme Suyu Dairesi", "Yüklenici Altyapı Konsorsiyumu", "Bodrum Belediyesi"],
    tags: ["ihale", "geyik_baraji", "muski", "su_kesintisi"],
    x: -220,
    y: -140,
    status: "supheli"
  },
  {
    id: "sosyal-bodrum-tepki",
    type: "sosyal_medya",
    label: "Sosyal Medya Yankısı",
    title: "#BodrumSusuz 4.800 Paylaşım & Bot Dalgası",
    source: "X / Twitter & Yerel Gruplar",
    districtId: "bodrum",
    districtName: "Bodrum",
    date: "Bugün 08:15",
    credibilityScore: 45,
    claimSummary: "Torba ve Konacık sakinlerinin su kesintisi videoları; ancak gece saatlerinde aynı metinle atılan 1.200 bot hesap paylaşımı tespit edildi.",
    involvedActors: ["Sosyal Medya Kullanıcıları", "Bot Hesap Ağları", "Esnaf Odası"],
    tags: ["sosyal_medya", "trend", "manipulasyon"],
    x: -280,
    y: 0,
    status: "arastiriliyor"
  },
  {
    id: "haber-bodrum-olay",
    type: "yerel_haber",
    label: "Yerel Basın",
    title: "Bodrum Olay Gazetesi: 'Ana İsale Hattında Basınç Testi Arızası'",
    source: "Bodrum Olay Gazetesi (Saha Muhabiri)",
    districtId: "bodrum",
    districtName: "Bodrum",
    date: "Bugün 10:30",
    credibilityScore: 82,
    claimSummary: "Haber muhabirinin şantiyeden bildirdiği detay: Patlayan borunun 2012 döşemesi CTP boru olduğu, yeni döşenen düktil borularda sorun olmadığı tespit edildi.",
    involvedActors: ["Saha Mühendisleri", "Bodrum Olay", "MUSKİ Ekipleri"],
    tags: ["haber", "saha_raporu", "boru_tipi"],
    x: -60,
    y: -110,
    status: "dogrulandi"
  },
  {
    id: "aktor-muski-baskani",
    type: "aktor_resmi",
    label: "Kilit Kurum & Aktör",
    title: "MUSKİ Genel Müdürlüğü & Altyapı Dairesi",
    source: "Muğla Büyükşehir Belediyesi Su Kanal İdaresi",
    districtId: "mentese",
    districtName: "Menteşe",
    date: "Sürekli",
    credibilityScore: 90,
    claimSummary: "Tüm il genelindeki baraj ve ana arter isale hatlarının tek resmi ihale ve bakım otoritesi.",
    involvedActors: ["Yılmaz Şengül (Genel Müdür)", "Altyapı Kontrol Mühendisleri"],
    tags: ["resmi_makam", "muski", "denetim"],
    x: 40,
    y: -30,
    status: "dogrulandi"
  },
  {
    id: "teyit-valilik-muski-aciklama",
    type: "resmi_teyit",
    label: "Resmi Açıklama",
    title: "Muğla Valiliği & MUSKİ Ortak Basın Bülteni",
    source: "Muğla Valiliği Basın ve Halkla İlişkiler",
    districtId: "mentese",
    districtName: "Menteşe",
    date: "Bugün 11:45",
    credibilityScore: 98,
    claimSummary: "İhale usulsüzlüğü iddiaları tamamen asılsızdır; tüm altyapı sözleşmeleri EKAP üzerinden açıktır. Arızaya 24 saat içinde müdahale edilmiş, su verilmeye başlanmıştır.",
    involvedActors: ["Muğla Valisi Dr. İdris Akbıyık", "MUSKİ", "Kamu İhale Kurumu"],
    tags: ["resmi_yalanlama", "basin_bulteni", "ekap"],
    x: 180,
    y: -130,
    status: "dogrulandi"
  },

  // ── DOSYA 2: MARMARİS KOY KİRALAMA & KIYI İDDİALARI ──
  {
    id: "kulis-marmaris-koy-isgal",
    type: "kulis_dedikodu",
    label: "Kulis İddiası",
    title: "Bozburun & Selimiye'de 3 Koyun Gizlice Tahsis Edildiği İddiası",
    source: "Siyasi Kulis Fısıltıları & Anonim Blog",
    districtId: "marmaris",
    districtName: "Marmaris",
    date: "2 Gün Önce",
    credibilityScore: 18,
    claimSummary: "Bozburun yarımadasında doğal sit alanı 3 koyun özel bir offshore turizm holdingine 49 yıllığına devredildiği söylentisi.",
    involvedActors: ["Offshore Turizm Şirketi", "ÇŞİM", "Marmaris Belediyesi"],
    tags: ["kulis", "sit_alani", "koy_isgali"],
    x: 20,
    y: 170,
    status: "yalanlandi"
  },
  {
    id: "haber-marmaris-manset",
    type: "yerel_haber",
    label: "Yerel Basın",
    title: "Marmaris Manşet: 'Kaçak İskeleler Yıkılıyor, Tahsis Yok'",
    source: "Marmaris Manşet Haber Portalı",
    districtId: "marmaris",
    districtName: "Marmaris",
    date: "Dün 14:20",
    credibilityScore: 85,
    claimSummary: "Kaymakamlık ve Çevre Müdürlüğü ekipleri iddia edilen koydaki kaçak tonoz ve iskeleleri yıktı. Herhangi bir kiralama izni olmadığı açıklandı.",
    involvedActors: ["Marmaris Kaymakamı Nurullah Kaya", "Yıkım Ekipleri", "Çevre Şehircilik"],
    tags: ["haber", "kacak_yapi", "iskele_yikimi"],
    x: 180,
    y: 110,
    status: "dogrulandi"
  },
  {
    id: "teyit-kaymakamlik-marmaris",
    type: "resmi_teyit",
    label: "Resmi Teyit",
    title: "Marmaris Kaymakamlığı Tebligatı & Basın Açıklaması",
    source: "Marmaris Kaymakamlığı Mülki İdare Masası",
    districtId: "marmaris",
    districtName: "Marmaris",
    date: "Dün 16:00",
    credibilityScore: 99,
    claimSummary: "Bozburun Yarımadası koruma altındadır; hiçbir şahıs veya kuruma kiralanmamıştır. Yalan haber üreten anonim hesaplar hakkında adli süreç başlatılmıştır.",
    involvedActors: ["Nurullah Kaya (Kaymakam)", "Cumhuriyet Başsavcılığı"],
    tags: ["resmi_aciklama", "yargi", "sit_koruma"],
    x: 280,
    y: 190,
    status: "dogrulandi"
  },

  // ── DOSYA 3: FETHİYE KÖRFEZ DİP BALÇIK KRİZİ & BÜTÇE DEDİKODUSU ──
  {
    id: "kulis-fethiye-butce",
    type: "kulis_dedikodu",
    label: "Kulis İddiası",
    title: "Fethiye Körfez Dip Tarama Bütçesinin Başka İle Aktarıldığı İddiası",
    source: "Liman Esnafı & Sivil İnisiyatif Fısıltıları",
    districtId: "fethiye",
    districtName: "Fethiye",
    date: "3 Gün Önce",
    credibilityScore: 25,
    claimSummary: "Ulaştırma Bakanlığı'nın Fethiye Körfezi balçık temizliği için ayırdığı ödeneğin iptal edildiği, tarama gemisinin gelmeyeceği kulisi.",
    involvedActors: ["Ulaştırma ve Altyapı Bakanlığı", "Fethiye Belediye Bşk. Alim Karaca", "Liman Bşk."],
    tags: ["korfez", "butce", "fethiye", "balcik"],
    x: 100,
    y: -220,
    status: "yalanlandi"
  },
  {
    id: "haber-fethiye-gazetesi",
    type: "yerel_haber",
    label: "Yerel Basın",
    title: "Fethiye Haber: 'Bakanlık Tarama Gemisi Seyirde'",
    source: "Fethiye Gazetesi & Batı Akdeniz Ajansı",
    districtId: "fethiye",
    districtName: "Fethiye",
    date: "Dün 11:00",
    credibilityScore: 88,
    claimSummary: "Tarama gemisi 'Kanuni' Çanakkale boğazından çıkış yaptı; 72 saat içinde Fethiye Körfezi şantiye sahasına demirleyecek.",
    involvedActors: ["Kıyı Emniyeti", "Tarama Filosu Kaptanlığı", "Fethiye Liman Bşk."],
    tags: ["haber", "gemi", "korfez_temizligi"],
    x: 240,
    y: -230,
    status: "dogrulandi"
  },
  {
    id: "teyit-fethiye-valilik",
    type: "resmi_teyit",
    label: "Resmi Teyit",
    title: "Valilik Yatırım İzleme (YİKOB) Basın Bildirisi",
    source: "Muğla YİKOB & Çevre Dairesi",
    districtId: "fethiye",
    districtName: "Fethiye",
    date: "Dün 15:30",
    credibilityScore: 96,
    claimSummary: "180 milyon TL bütçeli 1. etap dip çamuru tahliye projesinde ödenek kesintisi yoktur. Çalışma planlandığı gibi başlayacaktır.",
    involvedActors: ["YİKOB Başkanı", "Fethiye Kaymakamı Fatih Akkaya"],
    tags: ["resmi_teyit", "yikob", "butce_onay"],
    x: 320,
    y: -140,
    status: "dogrulandi"
  },

  // ── DOSYA 4: DATÇA BALIKAŞIRAN HEYELAN & YOL KAPANMA DEZENFORMASYONU ──
  {
    id: "kulis-datca-izolasyon",
    type: "kulis_dedikodu",
    label: "Kulis / Panik Söylentisi",
    title: "Datça Balıkaşıran Geçidinin 3 Gün Trafiğe Kapatılacağı Dedikodusu",
    source: "WhatsApp Aile & Site Grupları Ses Kaydı",
    districtId: "datca",
    districtName: "Datça",
    date: "Bugün 07:10",
    credibilityScore: 5,
    claimSummary: "Anonim bir ses kaydında yolda derin yarıklar oluştuğu, Datça'ya erzak girişinin durdurulacağı yönünde panik yayan ifadeler.",
    involvedActors: ["WhatsApp Grupları", "Anonim Ses Kaydı", "Datça Esnafı"],
    tags: ["whatsapp", "dezenformasyon", "panik", "balikasiran"],
    x: -300,
    y: 160,
    status: "yalanlandi"
  },
  {
    id: "haber-datca-havadis",
    type: "yerel_haber",
    label: "Yerel Basın",
    title: "Datça Havadis: 'Karayolları Şev Temizliği Yapıyor, Yol Açık'",
    source: "Datça Havadis Portalı",
    districtId: "datca",
    districtName: "Datça",
    date: "Bugün 09:20",
    credibilityScore: 91,
    claimSummary: "Muhabir bizzat Balıkaşıran mevkiine gitti: Yol açık, kontrollü olarak 20 dakikalık kaya temizliği yapılıyor, kapanma yok.",
    involvedActors: ["Datça Havadis Muhabiri", "Karayolları 26. Şube Ekipleri"],
    tags: ["saha_teyit", "yol_acik", "balikasiran"],
    x: -160,
    y: 200,
    status: "dogrulandi"
  },
  {
    id: "teyit-datca-kaymakamlik",
    type: "resmi_teyit",
    label: "Resmi Teyit",
    title: "Datça Kaymakamı Murat Atıcı: 'Dezenformasyona İtibar Etmeyiniz'",
    source: "Datça Kaymakamlığı Resmi X Hesabı & Web Sitesi",
    districtId: "datca",
    districtName: "Datça",
    date: "Bugün 10:00",
    credibilityScore: 100,
    claimSummary: "İlçemizin tek karayolu olan Balıkaşıran mevkiinde kapanma söz konusu değildir. Ses kaydını yayanlar hakkında TCK 217/A kapsamında suç duyurusu yapılmıştır.",
    involvedActors: ["Murat Atıcı (Datça Kaymakamı)", "İlçe Emniyet Müdürlüğü"],
    tags: ["resmi_yalanlama", "tck217", "dezenformasyon_mucadele"],
    x: -40,
    y: 250,
    status: "dogrulandi"
  }
];

// ── 2. İLİŞKİ BAĞLANTILARI (Dedektif Panosu İpleri & Kanıt Zinciri) ──
export const INVESTIGATION_LINKS: InvestigationLink[] = [
  // Bodrum Su Dosyası Bağlantıları
  {
    id: "link-bdr-1",
    source: "kulis-bodrum-su-ihale",
    target: "sosyal-bodrum-tepki",
    relation: "yayiyor",
    label: "Sosyal Medyada Köpürtülüyor",
    confidence: 89,
    evidenceQuote: "Kulis iddiasındaki metin birebir Twitter bot hesapları tarafından kopyalanıp #BodrumSusuz etiketine pompalandı."
  },
  {
    id: "link-bdr-2",
    source: "kulis-bodrum-su-ihale",
    target: "aktor-muski-baskani",
    relation: "hedef_aliyor",
    label: "Hedef Alınan Makam",
    confidence: 94,
    evidenceQuote: "Fısıltı gazetesindeki dedikodu doğrudan MUSKİ ihale komisyonunu suçlamaktadır."
  },
  {
    id: "link-bdr-3",
    source: "haber-bodrum-olay",
    target: "kulis-bodrum-su-ihale",
    relation: "celisiyor",
    label: "Teknik Çelişki Tespiti",
    confidence: 91,
    isContradiction: true,
    evidenceQuote: "Haber muhabirinin incelediği arızalı boru yeni ihale borusu değil, 2012 yılında döşenen eski CTP hattıdır."
  },
  {
    id: "link-bdr-4",
    source: "teyit-valilik-muski-aciklama",
    target: "kulis-bodrum-su-ihale",
    relation: "yalanliyor",
    label: "Resmi Yalanlama",
    confidence: 98,
    evidenceQuote: "Valilik ve MUSKİ sözleşmelerin EKAP üzerinden şeffaf olduğunu duyurarak kulisi yalanladı."
  },
  {
    id: "link-bdr-5",
    source: "teyit-valilik-muski-aciklama",
    target: "haber-bodrum-olay",
    relation: "teyit_ediyor",
    label: "Saha Bulgusunu Teyit Etti",
    confidence: 95,
    evidenceQuote: "Valilik açıklaması gazetenin yazdığı 'basınç testinde eski borunun çatlaması' bilgisini doğruladı."
  },

  // Marmaris Koy Dosyası Bağlantıları
  {
    id: "link-mrm-1",
    source: "kulis-marmaris-koy-isgal",
    target: "haber-marmaris-manset",
    relation: "kaynak_gosteriyor",
    label: "Basın İddiayı Araştırdı",
    confidence: 88,
    evidenceQuote: "Marmaris Manşet gazetesi kulis söylentisi üzerine Çevre Müdürlüğü ekipleriyle koya gitti."
  },
  {
    id: "link-mrm-2",
    source: "haber-marmaris-manset",
    target: "kulis-marmaris-koy-isgal",
    relation: "celisiyor",
    label: "49 Yıl Tahsis İddiası Çürütüldü",
    confidence: 93,
    isContradiction: true,
    evidenceQuote: "Sahada tahsis değil, tam aksine kaçak iskelelerin dozerlerle yıkımı belgelendi."
  },
  {
    id: "link-mrm-3",
    source: "teyit-kaymakamlik-marmaris",
    target: "kulis-marmaris-koy-isgal",
    relation: "yalanliyor",
    label: "Yargı Yoluyla Yalanlama",
    confidence: 100,
    evidenceQuote: "Kaymakamlık resmi açıklamayla tahsis olmadığını ve dedikoduyu yayanlar hakkında soruşturma açıldığını bildirdi."
  },

  // Fethiye Körfez Dosyası Bağlantıları
  {
    id: "link-fth-1",
    source: "kulis-fethiye-butce",
    target: "haber-fethiye-gazetesi",
    relation: "celisiyor",
    label: "Gemi Seyir Bilgisiyle Çelişiyor",
    confidence: 95,
    isContradiction: true,
    evidenceQuote: "Kulis iptal edildi derken geminin AIS uydu takip sisteminde Fethiye rotasında olduğu teyit edildi."
  },
  {
    id: "link-fth-2",
    source: "teyit-fethiye-valilik",
    target: "kulis-fethiye-butce",
    relation: "yalanliyor",
    label: "Bütçe İptali Yalanlandı",
    confidence: 97,
    evidenceQuote: "YİKOB 180 Milyon TL bütçenin hesapta olduğunu resmen açıkladı."
  },

  // Datça Balıkaşıran Dosyası Bağlantıları
  {
    id: "link-dtc-1",
    source: "kulis-datca-izolasyon",
    target: "haber-datca-havadis",
    relation: "celisiyor",
    label: "Saha İncelemesi Yalanladı",
    confidence: 99,
    isContradiction: true,
    evidenceQuote: "Datça Havadis muhabiri yoldan canlı yayın yaparak 3 günlük kapanmanın yalan olduğunu gösterdi."
  },
  {
    id: "link-dtc-2",
    source: "teyit-datca-kaymakamlik",
    target: "kulis-datca-izolasyon",
    relation: "yalanliyor",
    label: "Mülki Amir Tarafından Tekzip",
    confidence: 100,
    evidenceQuote: "Kaymakam Murat Atıcı 'halkı yanıltıcı bilgiyi alenen yayma' suçundan savcılığa başvurdu."
  }
];

// ── 3. İSTİHBARAT DOSYALARI (Vakalar & Çapraz Sorgu Senaryoları) ──
export const INVESTIGATION_DOSSIERS: InvestigationDossier[] = [
  {
    id: "dosya-bodrum-su",
    code: "DOSYA-BDR-01",
    title: "Bodrum Su Kesintisi, İhale Kulisleri & Basınç Patlaması",
    districtId: "bodrum",
    districtName: "Bodrum",
    category: "İçme Suyu & İhale",
    urgency: "Kritik",
    summary: "Telegram kulislerinde 'düşük kaliteli boru ihalesi' söylentisi çıkarıldı. Yerel basın ve teknik saha incelemesi patlayan borunun 2012 yapımı eski CTP hattı olduğunu, yeni hattın sağlam olduğunu ortaya koydu.",
    interrogationPromptQuestions: [
      "Bodrum'daki su kesintisiyle ilgili ihale usulsüzlüğü dedikodusu doğru mu?",
      "Patlayan boru yeni ihale kapsamında mı döşendi?",
      "Resmi makamlar ve MUSKİ iddialara ne yanıt verdi?",
      "Sosyal medyadaki bot hesap dalgasının arkasında kim var?"
    ],
    nodeIds: [
      "kulis-bodrum-su-ihale",
      "sosyal-bodrum-tepki",
      "haber-bodrum-olay",
      "aktor-muski-baskani",
      "teyit-valilik-muski-aciklama"
    ],
    linkIds: ["link-bdr-1", "link-bdr-2", "link-bdr-3", "link-bdr-4", "link-bdr-5"],
    officialVerdict: "İhale usulsüzlüğü iddiası YALANLANDI (%12 doğruluk); ancak eski CTP boru hattındaki yorulma ve gecikmeli bakım TEYİT EDİLDİ (%94 doğruluk).",
    verdictScore: 12
  },
  {
    id: "dosya-marmaris-koy",
    code: "DOSYA-MRM-02",
    title: "Marmaris Bozburun Kıyı Kiralama İddiası & İskele Yıkımları",
    districtId: "marmaris",
    districtName: "Marmaris",
    category: "İmar & Kıyı Talanı",
    urgency: "Yüksek",
    summary: "Bozburun'da koyların 49 yıllığına özel şirkete tahsis edildiği kulisi yayıldı. Yerel muhabirler ve Kaymakamlık incelemesi sonucunda tahsis olmadığı, aksine kaçak iskelelerin mühürlenip yıkıldığı teyit edildi.",
    interrogationPromptQuestions: [
      "Marmaris Bozburun koyları gizlice bir holdinge kiralandı mı?",
      "Yerel basın sahada ne tespit etti?",
      "Kaymakamlık tebligatında kaçak yapılarla ilgili ne denildi?",
      "İddiayı yayan kaynaklar kimler?"
    ],
    nodeIds: [
      "kulis-marmaris-koy-isgal",
      "haber-marmaris-manset",
      "teyit-kaymakamlik-marmaris"
    ],
    linkIds: ["link-mrm-1", "link-mrm-2", "link-mrm-3"],
    officialVerdict: "49 yıllık kiralama kulisi YALANLANDI (%0 doğruluk); Kaçak iskele yıkımı ve adli soruşturma TEYİT EDİLDİ (%100 doğruluk).",
    verdictScore: 0
  },
  {
    id: "dosya-fethiye-korfez",
    code: "DOSYA-FTH-03",
    title: "Fethiye Körfez Dip Tarama Bütçesi & Gemi İptali Dedikodusu",
    districtId: "fethiye",
    districtName: "Fethiye",
    category: "Körfez & Çevre",
    urgency: "Orta",
    summary: "Fethiye balıkçıları arasında körfez temizliği ödeneğinin kesildiği dedikodusu yayıldı. Bakanlık ve YİKOB resmi bütçe onayını teyit etti, tarama gemisinin seyrüseferde olduğu kanıtlandı.",
    interrogationPromptQuestions: [
      "Fethiye körfez temizliği bütçesi iptal mi edildi?",
      "Tarama gemisi nerede, ne zaman ulaşacak?",
      "Yerel gazeteler ve YİKOB bütçeyi doğruladı mı?"
    ],
    nodeIds: [
      "kulis-fethiye-butce",
      "haber-fethiye-gazetesi",
      "teyit-fethiye-valilik"
    ],
    linkIds: ["link-fth-1", "link-fth-2"],
    officialVerdict: "Bütçe iptali iddiası ASILSIZDIR (%5 doğruluk); Tarama gemisi intikali ve 180M TL ödenek TEYİT EDİLDİ (%96 doğruluk).",
    verdictScore: 5
  },
  {
    id: "dosya-datca-balikasiran",
    code: "DOSYA-DTC-04",
    title: "Datça Balıkaşıran Geçidi Heyelan & 3 Gün Kapanma Dezenformasyonu",
    districtId: "datca",
    districtName: "Datça",
    category: "Ulaşım & Heyelan",
    urgency: "Kritik",
    summary: "WhatsApp ses kayıtlarıyla Datça'nın tek karayolu olan Balıkaşıran'ın 3 gün kapanacağı ve yarıklar oluştuğu yayıldı. Muhabirler yolun açık olduğunu canlı yayında gösterdi, Kaymakamlık savcılığa başvurdu.",
    interrogationPromptQuestions: [
      "Datça'ya karayolu ulaşımı kesildi mi, yol kapalı mı?",
      "WhatsApp'ta dolaşan ses kaydı kime ait, doğru mu?",
      "Datça Kaymakamlığı ne tür yasal işlem başlattı?"
    ],
    nodeIds: [
      "kulis-datca-izolasyon",
      "haber-datca-havadis",
      "teyit-datca-kaymakamlik"
    ],
    linkIds: ["link-dtc-1", "link-dtc-2"],
    officialVerdict: "Yolun kapanması iddiası KASITLI DEZENFORMASYONDUR (%0 doğruluk); Karayolları şev temizliği kontrollü yapılmış olup yol açıktır.",
    verdictScore: 0
  }
];

export const NODE_TYPE_CONFIG: Record<NodeType, { label: string; color: string; badge: string; icon: string }> = {
  kulis_dedikodu: { label: "Kulis Fısıltısı", color: "#f43f5e", badge: "KULİS / DEDİKODU", icon: "🕵️" },
  yerel_haber:    { label: "Yerel Basın Haberi", color: "#f59e0b", badge: "YEREL HABER", icon: "📰" },
  sosyal_medya:   { label: "Sosyal Medya Yankısı", color: "#38bdf8", badge: "SOSYAL MEDYA", icon: "💬" },
  aktor_resmi:    { label: "Kilit Aktör / Yetkili", color: "#a855f7", badge: "KİLİT AKTÖR", icon: "👤" },
  resmi_teyit:    { label: "Resmi Teyit / Yalanlama", color: "#10b981", badge: "RESMİ TEYİT", icon: "🏛️" },
  belge_kanit:    { label: "Belge & Resmi Tutanak", color: "#06b6d4", badge: "BELGE / KANIT", icon: "📑" }
};

export const RELATION_LABELS: Record<RelationType, { label: string; color: string; style: "solid" | "dashed" }> = {
  iddia_ediyor:       { label: "İddia Ediyor", color: "#f43f5e", style: "dashed" },
  yayiyor:            { label: "Yayıyor / Köpürtüyor", color: "#38bdf8", style: "dashed" },
  kaynak_gosteriyor:  { label: "Kaynak Gösteriyor", color: "#f59e0b", style: "solid" },
  yalanliyor:         { label: "Yalanlıyor / Tekzip", color: "#ef4444", style: "solid" },
  teyit_ediyor:       { label: "Doğruluyor & Teyit", color: "#10b981", style: "solid" },
  cikar_catismasi:    { label: "Çıkar Çatışması", color: "#e11d48", style: "dashed" },
  hedef_aliyor:       { label: "Hedef Alıyor", color: "#dc2626", style: "dashed" },
  celisiyor:          { label: "Çelişiyor (Çelişki)", color: "#fbbf24", style: "dashed" }
};
