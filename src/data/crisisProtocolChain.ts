// src/data/crisisProtocolChain.ts
// Muğla 13 İlçe ve Kritik Altyapı Düğümleri İçin Kriz Koordinasyon & Protokol Komuta Zinciri (Faz 4)
// Kaynak: Muğla Valiliği Resmi İl Protokol Listesi (https://www.mugla.gov.tr/il-protokol-listesi)

export interface CrisisContact {
  id: string;
  roleTag: "mulki_amiri" | "belediye" | "kolluk" | "afet_acil" | "altyapi_su" | "saglik";
  roleLabel: string;
  unvan: string;
  isim: string;
  kurum: string;
  telefon: string;
  faks?: string;
  dahili?: string;
  isPrimary?: boolean;
}

export interface NodeCrisisInfo {
  nodeId: string;
  nodeName: string;
  emergencyCode: string;
  category: "merkez" | "turizm_kiyisi" | "ulasim_kapisi" | "ekoloji_su" | "sanayi_tarim" | "altyapi_hub";
  riskScore: number;
  commandHub: string;
  keyRisks: string[];
  contingencyRoutes: string[];
  contacts: CrisisContact[];
}

export const CRISIS_PROTOCOL_CHAINS: Record<string, NodeCrisisInfo> = {
  // ── 1. MENTEŞE (İL MERKEZİ & KRİZ ANA KARARGAHI) ──
  mentese: {
    nodeId: "mentese",
    nodeName: "Menteşe",
    emergencyCode: "MU-MNT-00",
    category: "merkez",
    riskScore: 42,
    commandHub: "Muğla Valiliği GAMER & AFAD İl Afet Koordinasyon Merkezi",
    keyRisks: [
      "İl geneli kriz koordinasyon düğümü",
      "Bölge Eğitim ve Araştırma Hastanesi yoğun bakım kapasitesi",
      "Kış mevsimi don & yüksek rakım ulaşım tıkanıklıkları"
    ],
    contingencyRoutes: [
      "D-330 Yatağan - Aydın İstikameti",
      "D-550 Sakar Rampası - Gökova Bağlantısı",
      "Muğla - Denizli Kale Yolu"
    ],
    contacts: [
      {
        id: "c-mentese-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Vali Yardımcısı V. / Menteşe Kaymakamı",
        isim: "Ali Edip BUDAN",
        kurum: "Menteşe Kaymakamlığı",
        telefon: "0252 214 1282",
        faks: "0252 212 1019",
        isPrimary: true
      },
      {
        id: "c-mentese-vali",
        roleTag: "mulki_amiri",
        roleLabel: "İl Valisi & Kriz Başkanı",
        unvan: "Muğla Valisi",
        isim: "Dr. İdris AKBIYIK",
        kurum: "Muğla Valiliği",
        telefon: "0252 214 1001",
        faks: "0252 214 3188",
        isPrimary: true
      },
      {
        id: "c-mentese-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Menteşe Belediye Başkanı",
        isim: "Gonca KÖKSAL",
        kurum: "Menteşe Belediyesi",
        telefon: "0252 214 4880"
      },
      {
        id: "c-mentese-bb",
        roleTag: "belediye",
        roleLabel: "Büyükşehir Belediye Başkanı",
        unvan: "Muğla Büyükşehir Belediye Başkanı",
        isim: "Ahmet ARAS",
        kurum: "Muğla Büyükşehir Belediyesi",
        telefon: "0252 214 1000",
        dahili: "185"
      },
      {
        id: "c-mentese-3",
        roleTag: "kolluk",
        roleLabel: "İl Kolluk Kuvvetleri",
        unvan: "İl Emniyet Müdürü",
        isim: "Süleyman KARADENİZ",
        kurum: "Muğla İl Emniyet Müdürlüğü",
        telefon: "0252 214 1910",
        dahili: "112"
      },
      {
        id: "c-mentese-jandarma",
        roleTag: "kolluk",
        roleLabel: "Kırsal Kolluk Kuvvetleri",
        unvan: "İl Jandarma Komutanı",
        isim: "Tuğgeneral Adem ŞEN",
        kurum: "Muğla İl Jandarma Komutanlığı",
        telefon: "0252 214 2315",
        dahili: "112"
      },
      {
        id: "c-mentese-4",
        roleTag: "afet_acil",
        roleLabel: "Afet Yönetimi & Müdahale",
        unvan: "AFAD İl Müdürü",
        isim: "İsmail ÖZSAVRAN",
        kurum: "Muğla AFAD İl Müdürlüğü",
        telefon: "0252 214 1030",
        faks: "0252 214 1035"
      },
      {
        id: "c-mentese-orman",
        roleTag: "afet_acil",
        roleLabel: "Orman Yangınları Sevk",
        unvan: "Muğla Orman Bölge Müdürü",
        isim: "Mustafa ÜLKÜDÜR",
        kurum: "Muğla Orman Bölge Müdürlüğü",
        telefon: "0252 214 1202",
        faks: "0252 214 1205"
      },
      {
        id: "c-mentese-5",
        roleTag: "saglik",
        roleLabel: "Sağlık & 112 Koordinasyon",
        unvan: "İl Sağlık Müdürü",
        isim: "Dr. Ali Burak MÜLAYİM",
        kurum: "Muğla İl Sağlık Müdürlüğü",
        telefon: "0252 214 1160",
        dahili: "112"
      }
    ]
  },

  // ── 2. BODRUM (TURİZM & YAZLIK NÜFUS PİKİ) ──
  bodrum: {
    nodeId: "bodrum",
    nodeName: "Bodrum",
    emergencyCode: "MU-BDR-01",
    category: "turizm_kiyisi",
    riskScore: 72,
    commandHub: "Bodrum Hükümet Konağı & İlçe Kriz Koordinasyon Masası",
    keyRisks: [
      "Yaz aylarında 1.45M nüfus piki ve su tüketim darboğazı",
      "Geyik Barajı ana isale hattı arıza hassasiyeti",
      "Yarımada genelinde D-330 Torba-Yalıkavak tek ana arter tıkanması",
      "Marina ve kıyı tesislerinde deniz kirliliği ve yangın riski"
    ],
    contingencyRoutes: [
      "D-330 Milas - Havalimanı (BJV) Tahliye Güzergahı",
      "Bodrum - Turgutreis Çevre Alternatifi",
      "Yalıkavak - Gündoğan - Torba Ring Hattı"
    ],
    contacts: [
      {
        id: "c-bodrum-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Bodrum Kaymakamı",
        isim: "Ali SIRMALI",
        kurum: "Bodrum Kaymakamlığı",
        telefon: "0252 316 1001",
        faks: "0252 316 9900",
        isPrimary: true
      },
      {
        id: "c-bodrum-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Bodrum Belediye Başkanı",
        isim: "Tamer MANDALİNCİ",
        kurum: "Bodrum Belediyesi",
        telefon: "0252 444 0048",
        isPrimary: true
      },
      {
        id: "c-bodrum-3",
        roleTag: "kolluk",
        roleLabel: "İlçe Güvenlik & Zabıta",
        unvan: "Bodrum İlçe Emniyet Müdürü",
        isim: "Mehmet Darendeli",
        kurum: "Bodrum İlçe Emniyet Müdürlüğü",
        telefon: "0252 316 8080",
        dahili: "112"
      },
      {
        id: "c-bodrum-sg",
        roleTag: "kolluk",
        roleLabel: "Kıyı ve Deniz Güvenliği",
        unvan: "Bodrum Sahil Güvenlik Komutanı",
        isim: "SG Binbaşı Raşit Gödelek",
        kurum: "Bodrum Sahil Güvenlik Karakol K.",
        telefon: "0252 316 1172"
      },
      {
        id: "c-bodrum-4",
        roleTag: "altyapi_su",
        roleLabel: "Su & Altyapı Kriz Masası",
        unvan: "MUSKİ Bodrum Bölge Müdürü",
        isim: "Su ve Kanalizasyon Şube Müdürlüğü",
        kurum: "MUSKİ Genel Müdürlüğü",
        telefon: "185",
        dahili: "0252 214 1000"
      },
      {
        id: "c-bodrum-5",
        roleTag: "saglik",
        roleLabel: "Acil Sağlık & Hastane",
        unvan: "Bodrum Devlet Hastanesi Başhekimi",
        isim: "Op. Dr. Oğuz Şahin",
        kurum: "Bodrum Devlet Hastanesi",
        telefon: "0252 313 1420",
        dahili: "112"
      }
    ]
  },

  // ── 3. MARMARİS (ORMAN YANGINI & KIYI GÜVENLİĞİ) ──
  marmaris: {
    nodeId: "marmaris",
    nodeName: "Marmaris",
    emergencyCode: "MU-MRM-02",
    category: "turizm_kiyisi",
    riskScore: 78,
    commandHub: "Marmaris Hükümet Konağı & Orman Yangın Harekat Merkezi",
    keyRisks: [
      "Çam balı orman kuşağında yüksek yangın yayılım indeksi",
      "Balıkaşıran Boğazı fırtına rüzgar koridoru",
      "Sakar Rampası kapanırsa merkez ile tek bağlantının kesilmesi riski"
    ],
    contingencyRoutes: [
      "D-400 Gökova - Sakar Rampası Koridoru",
      "Marmaris - Datça Yarımada Yolu",
      "İçmeler - Turunç Kıyı Alternatif Yolu"
    ],
    contacts: [
      {
        id: "c-marmaris-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Marmaris Kaymakamı",
        isim: "Nurullah KAYA",
        kurum: "Marmaris Kaymakamlığı",
        telefon: "0252 412 1001",
        faks: "0252 412 0919",
        isPrimary: true
      },
      {
        id: "c-marmaris-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Marmaris Belediye Başkanı",
        isim: "Acar ÜNLÜ",
        kurum: "Marmaris Belediyesi",
        telefon: "0252 412 1005",
        isPrimary: true
      },
      {
        id: "c-marmaris-3",
        roleTag: "afet_acil",
        roleLabel: "Orman Yangın İlk Müdahale",
        unvan: "Marmaris Orman İşletme Müdürü",
        isim: "Gökhan Şahin",
        kurum: "Marmaris Orman İşletme Müdürlüğü",
        telefon: "0252 412 1010",
        dahili: "177"
      },
      {
        id: "c-marmaris-sg",
        roleTag: "kolluk",
        roleLabel: "Güney Ege Sahil Güvenlik",
        unvan: "Sahil Güvenlik Güney Ege Grup Komutanı",
        isim: "S.G. Yarbay Akın COŞKUNLAR",
        kurum: "Sahil Güvenlik Güney Ege Grup K.",
        telefon: "0252 412 7722",
        faks: "0252 412 7777"
      },
      {
        id: "c-marmaris-4",
        roleTag: "kolluk",
        roleLabel: "İlçe Emniyet",
        unvan: "Marmaris İlçe Emniyet Müdürü",
        isim: "Emre Süel",
        kurum: "Marmaris İlçe Emniyet Müdürlüğü",
        telefon: "0252 412 1444",
        dahili: "112"
      }
    ]
  },

  // ── 4. FETHİYE (SİSMİK RİSK & GÜNEY LOJİSTİK HUB'I) ──
  fethiye: {
    nodeId: "fethiye",
    nodeName: "Fethiye",
    emergencyCode: "MU-FTH-03",
    category: "turizm_kiyisi",
    riskScore: 68,
    commandHub: "Fethiye Kaymakamlığı & Güney Kriz Koordinasyon Masası",
    keyRisks: [
      "Fethiye - Burdur Aktif Sismik Fay Zonu",
      "Ölüdeniz Belcekız kıyı tahliye darboğazı",
      "Kışın Babadağ eteklerinde taşkın ve heyelan hassasiyeti"
    ],
    contingencyRoutes: [
      "D-400 Dalaman - Ortaca - Muğla Aksı",
      "D-350 Seydikemer - Antalya Yayla Yolu",
      "Fethiye - Göcek Tünel Geçişi"
    ],
    contacts: [
      {
        id: "c-fethiye-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Fethiye Kaymakamı",
        isim: "Fatih AKKAYA",
        kurum: "Fethiye Kaymakamlığı",
        telefon: "0252 614 1001",
        faks: "0252 614 2343",
        isPrimary: true
      },
      {
        id: "c-fethiye-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Fethiye Belediye Başkanı",
        isim: "Alim KARACA",
        kurum: "Fethiye Belediyesi",
        telefon: "0252 614 1020",
        isPrimary: true
      },
      {
        id: "c-fethiye-3",
        roleTag: "kolluk",
        roleLabel: "İlçe Emniyet",
        unvan: "Fethiye İlçe Emniyet Müdürü",
        isim: "Kayhan Dadaşoğlu",
        kurum: "Fethiye İlçe Emniyet Müdürlüğü",
        telefon: "0252 614 1303",
        dahili: "112"
      },
      {
        id: "c-fethiye-4",
        roleTag: "afet_acil",
        roleLabel: "Deprem & Arama Kurtarma",
        unvan: "Fethiye AFAD İrtibat Merkezi",
        isim: "Güney Ege Arama Kurtarma Birimi",
        kurum: "AFAD Muğla",
        telefon: "0252 214 1030",
        dahili: "112"
      }
    ]
  },

  // ── 5. MİLAS (SANAYİ, BARAJ HAVZASI & BJV HAVALİMANI) ──
  milas: {
    nodeId: "milas",
    nodeName: "Milas",
    emergencyCode: "MU-MLS-04",
    category: "sanayi_tarim",
    riskScore: 61,
    commandHub: "Milas Hükümet Konağı Kriz Masası",
    keyRisks: [
      "Geyik Barajı havzası koruma ve isale güvenliği",
      "Yeniköy - Kemerköy Enerji İletim Hatları koridoru",
      "Milas-Bodrum Havalimanı (BJV) acil durum tahliyesi"
    ],
    contingencyRoutes: [
      "D-330 Bodrum - Milas Otoyolu",
      "Milas - Yatağan Ağır Vasıta Aksı",
      "Milas - Söke - İzmir Karayolu"
    ],
    contacts: [
      {
        id: "c-milas-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Milas Kaymakamı",
        isim: "Dr. Vural KARAGÜL",
        kurum: "Milas Kaymakamlığı",
        telefon: "0252 512 1001",
        faks: "0252 512 3333",
        isPrimary: true
      },
      {
        id: "c-milas-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Milas Belediye Başkanı",
        isim: "Fevzi TOPUZ",
        kurum: "Milas Belediyesi",
        telefon: "0252 512 1025",
        isPrimary: true
      },
      {
        id: "c-milas-3",
        roleTag: "kolluk",
        roleLabel: "Kırsal Güvenlik & Sanayi",
        unvan: "Milas İlçe Jandarma Komutanı",
        isim: "J. Yzb. Seyhan Kılıç",
        kurum: "Milas İlçe Jandarma Komutanlığı",
        telefon: "0252 512 1030"
      },
      {
        id: "c-milas-4",
        roleTag: "altyapi_su",
        roleLabel: "Baraj & Su İletim",
        unvan: "DSİ 213. Şube Milas İşletme Şefliği",
        isim: "Geyik Barajı Rezervuar Sorumlusu",
        kurum: "DSİ 21. Bölge Müdürlüğü",
        telefon: "0252 214 1175"
      }
    ]
  },

  // ── 6. DALAMAN (HAVALİMANI & GÜNEY ENTEGRASYON KAPISI) ──
  dalaman: {
    nodeId: "dalaman",
    nodeName: "Dalaman",
    emergencyCode: "MU-DLM-05",
    category: "ulasim_kapisi",
    riskScore: 54,
    commandHub: "Dalaman Kaymakamlığı & Havalimanı Mülki İdare Amirliği",
    keyRisks: [
      "Uluslararası Dalaman Havalimanı (DLM) hava sahası güvenliği",
      "Dalaman Çayı taşkın ve regülasyon riski",
      "Fethiye-Marmaris arası kritik kavşak konumu"
    ],
    contingencyRoutes: [
      "D-400 Ortaca - Köyceğiz İstikameti",
      "D-400 Göcek Tüneli - Fethiye İstikameti",
      "Dalaman Havalimanı Protokol Yolu"
    ],
    contacts: [
      {
        id: "c-dalaman-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Dalaman Kaymakamı",
        isim: "Ferhat VARDAR",
        kurum: "Dalaman Kaymakamlığı",
        telefon: "0252 692 5011",
        faks: "0252 692 2719",
        isPrimary: true
      },
      {
        id: "c-dalaman-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Dalaman Belediye Başkanı",
        isim: "Sezer DURMUŞ",
        kurum: "Dalaman Belediyesi",
        telefon: "0252 692 2010",
        isPrimary: true
      },
      {
        id: "c-dalaman-3",
        roleTag: "ulasim_kapisi" as any,
        roleLabel: "Havalimanı Başmüdürü",
        unvan: "DHMİ Dalaman Havalimanı Başmüdürü",
        isim: "Kemal Daştan",
        kurum: "DHMİ Havalimanı Başmüdürlüğü",
        telefon: "0252 792 5555"
      }
    ]
  },

  // ── 7. DATÇA (YARIMADA İZOLASYONU & KIYI HASSASİYETİ) ──
  datca: {
    nodeId: "datca",
    nodeName: "Datça",
    emergencyCode: "MU-DTC-06",
    category: "turizm_kiyisi",
    riskScore: 64,
    commandHub: "Datça Hükümet Konağı Acil Durum Masası",
    keyRisks: [
      "Tek karayolu bağlantısı (70 km Marmaris-Datça dağ yolu)",
      "Balıkaşıran Geçidi kapanırsa kara ulaşımının tamamen kesilmesi",
      "Yarımada genelinde kısıtlı yeraltı su kaynakları"
    ],
    contingencyRoutes: [
      "D-400 Datça - Marmaris Tek Karayolu",
      "Datça - Bodrum Feribot Acil Deniz Hattı",
      "Palamutbükü Balıkçı Barınağı Tahliye İskelesi"
    ],
    contacts: [
      {
        id: "c-datca-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Datça Kaymakamı",
        isim: "Murat ATICI",
        kurum: "Datça Kaymakamlığı",
        telefon: "0252 712 3001",
        faks: "0252 712 3100",
        isPrimary: true
      },
      {
        id: "c-datca-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Datça Belediye Başkanı",
        isim: "Aytaç KURT",
        kurum: "Datça Belediyesi",
        telefon: "0252 712 3005",
        isPrimary: true
      },
      {
        id: "c-datca-3",
        roleTag: "kolluk",
        roleLabel: "Kıyı Güvenlik & Arama Kurtarma",
        unvan: "Datça Sahil Güvenlik Bot Komutanı",
        isim: "TCSG-92 Komutanlığı",
        kurum: "Sahil Güvenlik Komutanlığı",
        telefon: "0252 712 3222",
        dahili: "158"
      }
    ]
  },

  // ── 8. ORTACA (DALYAN KANALI & SAĞLIK-LOJİSTİK AKSI) ──
  ortaca: {
    nodeId: "ortaca",
    nodeName: "Ortaca",
    emergencyCode: "MU-ORT-07",
    category: "sanayi_tarim",
    riskScore: 48,
    commandHub: "Ortaca Kaymakamlığı Kriz Merkezi",
    keyRisks: [
      "Dalyan Kanalı taşkın ve ekosistem regülasyonu",
      "D-400 Havalimanı transit yolcu trafiği yoğunluğu",
      "Narenciye üretimi zirai dona karşı erken uyarı"
    ],
    contingencyRoutes: [
      "D-400 Dalaman - Fethiye Yönü",
      "D-400 Köyceğiz - Muğla Yönü",
      "Dalyan - İztuzu Alternatif Servis Yolu"
    ],
    contacts: [
      {
        id: "c-ortaca-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Ortaca Kaymakamı",
        isim: "Kenan AKTAŞ",
        kurum: "Ortaca Kaymakamlığı",
        telefon: "0252 282 2970",
        faks: "0252 282 2972",
        isPrimary: true
      },
      {
        id: "c-ortaca-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Ortaca Belediye Başkanı",
        isim: "Evren TEZCAN",
        kurum: "Ortaca Belediyesi",
        telefon: "0252 282 2010",
        isPrimary: true
      },
      {
        id: "c-ortaca-3",
        roleTag: "saglik",
        roleLabel: "Bölge Sağlık Merkezi",
        unvan: "Ortaca Devlet Hastanesi Başhekimi",
        isim: "Ortaca Devlet Hastanesi",
        kurum: "İl Sağlık Müdürlüğü",
        telefon: "0252 282 5050"
      }
    ]
  },

  // ── 9. KÖYCEĞİZ (GÖL HAVZASI, EKOLOJİ & YANGIN KORİDORU) ──
  koycegiz: {
    nodeId: "koycegiz",
    nodeName: "Köyceğiz",
    emergencyCode: "MU-KYC-08",
    category: "ekoloji_su",
    riskScore: 58,
    commandHub: "Köyceğiz Hükümet Konağı Koordinasyon Masası",
    keyRisks: [
      "Köyceğiz Gölü su kotu yükselmesi ve Dalyan taşkınları",
      "Sandras Dağı orman yangınları erken uyarı koridoru",
      "Sığla ormanları koruma hassasiyeti"
    ],
    contingencyRoutes: [
      "D-400 Gökova - Sakar Rampası Aksı",
      "D-400 Ortaca - Dalaman Aksı",
      "Köyceğiz - Ağla Yayla Yolu"
    ],
    contacts: [
      {
        id: "c-koycegiz-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Köyceğiz Kaymakamı",
        isim: "Mert KUMCU",
        kurum: "Köyceğiz Kaymakamlığı",
        telefon: "0252 262 4003",
        faks: "0252 262 1317",
        isPrimary: true
      },
      {
        id: "c-koycegiz-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Köyceğiz Belediye Başkanı",
        isim: "Ali ERDOĞAN",
        kurum: "Köyceğiz Belediyesi",
        telefon: "0252 262 4004",
        isPrimary: true
      },
      {
        id: "c-koycegiz-3",
        roleTag: "afet_acil",
        roleLabel: "Orman İşletme",
        unvan: "Köyceğiz Orman İşletme Müdürü",
        isim: "Köyceğiz Orman İşletmesi",
        kurum: "OGM Muğla Bölge",
        telefon: "0252 262 4015"
      }
    ]
  },

  // ── 10. ULA (SAKAR GEÇİDİ, GÖKOVA & KIYI BAĞLANTISI) ──
  ula: {
    nodeId: "ula",
    nodeName: "Ula",
    emergencyCode: "MU-ULA-09",
    category: "merkez",
    riskScore: 50,
    commandHub: "Ula Kaymakamlığı & Sakar Geçidi Karayolu Masası",
    keyRisks: [
      "Sakar Rampası heyelan, kaza ve trafik kilitlenmesi riski",
      "Akyaka 'Sakin Şehir' yaz trafiği ve rüzgar fırtınaları",
      "Kıyı şeridi ile il merkezi arasındaki tek stratejik darboğaz"
    ],
    contingencyRoutes: [
      "D-550 Sakar Rampası Karayolu",
      "Ula - Karabörtlen - Köyceğiz Dağ Yolu",
      "Akyaka - Ören Kıyı Bağlantı Yolu"
    ],
    contacts: [
      {
        id: "c-ula-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Ula Kaymakamı",
        isim: "Murat EKİNCİ",
        kurum: "Ula Kaymakamlığı",
        telefon: "0252 242 3001",
        faks: "0252 242 1221",
        isPrimary: true
      },
      {
        id: "c-ula-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Ula Belediye Başkanı",
        isim: "Mehmet CANER",
        kurum: "Ula Belediyesi",
        telefon: "0252 242 3005",
        isPrimary: true
      },
      {
        id: "c-ula-3",
        roleTag: "kolluk",
        roleLabel: "Trafik Denetleme & Geçit Güvenliği",
        unvan: "Bölge Trafik Denetleme Şube Müdürü",
        isim: "Sakar Rampası Trafik Ekibi",
        kurum: "İl Emniyet Müdürlüğü",
        telefon: "0252 214 1910",
        dahili: "112"
      }
    ]
  },

  // ── 11. YATAĞAN (ENERJİ, TERMİK SANTRAL & İÇ EGE ARTERİ) ──
  yatagan: {
    nodeId: "yatagan",
    nodeName: "Yatağan",
    emergencyCode: "MU-YTG-10",
    category: "sanayi_tarim",
    riskScore: 45,
    commandHub: "Yatağan Kaymakamlığı Sanayi & Kriz Koordinasyon Masası",
    keyRisks: [
      "Yatağan Termik Santrali ve şebeke enerji arz güvenliği",
      "Aydın - Muğla D-550 ağır yük ve kimyasal tanker koridoru",
      "Maden sahalarında göçük ve çevre güvenliği"
    ],
    contingencyRoutes: [
      "D-550 Çine - Aydın İstikameti",
      "D-550 Menteşe - Muğla Merkez Aksı",
      "Yatağan - Milas Sanayi Geçiş Yolu"
    ],
    contacts: [
      {
        id: "c-yatagan-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Yatağan Kaymakamı",
        isim: "Turgay İLHAN",
        kurum: "Yatağan Kaymakamlığı",
        telefon: "0252 572 5001",
        faks: "0252 572 5114",
        isPrimary: true
      },
      {
        id: "c-yatagan-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Yatağan Belediye Başkanı",
        isim: "Mesut GÜNAY",
        kurum: "Yatağan Belediyesi",
        telefon: "0252 572 5015",
        isPrimary: true
      },
      {
        id: "c-yatagan-3",
        roleTag: "afet_acil",
        roleLabel: "Endüstriyel Kriz Masası",
        unvan: "Yatağan İtfaiye Grup Amirliği",
        isim: "Büyükşehir İtfaiye Daire Bşk.",
        kurum: "Muğla Büyükşehir Belediyesi",
        telefon: "112"
      }
    ]
  },

  // ── 12. SEYDİKEMER (YAYLA TARIMI & SİSMİK KUŞAK) ──
  seydikemer: {
    nodeId: "seydikemer",
    nodeName: "Seydikemer",
    emergencyCode: "MU-SKM-11",
    category: "sanayi_tarim",
    riskScore: 52,
    commandHub: "Seydikemer Hükümet Konağı Kriz Masası",
    keyRisks: [
      "Fethiye-Burdur sismik fay kırığı güney uzantısı",
      "Eşen Çayı taşkın ve drenaj havzası",
      "Kırsal dağ köylerinde kış şartları ve kar kapanması"
    ],
    contingencyRoutes: [
      "D-350 Yayla Yolu - Korkuteli - Antalya",
      "D-400 Fethiye - Kıyı Hattı",
      "Seydikemer - Kaş - Kalkan Sahil Yolu"
    ],
    contacts: [
      {
        id: "c-seydikemer-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Seydikemer Kaymakamı",
        isim: "Mustafa DİLEKLİ",
        kurum: "Seydikemer Kaymakamlığı",
        telefon: "0252 656 1800",
        faks: "0252 656 1802",
        isPrimary: true
      },
      {
        id: "c-seydikemer-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Seydikemer Belediye Başkanı",
        isim: "Bayram Önder AKDENİZLİ",
        kurum: "Seydikemer Belediyesi",
        telefon: "0252 656 1015",
        isPrimary: true
      },
      {
        id: "c-seydikemer-3",
        roleTag: "kolluk",
        roleLabel: "Kırsal Asayiş",
        unvan: "Seydikemer İlçe Jandarma Komutanı",
        isim: "İlçe Jandarma Komutanlığı",
        kurum: "Jandarma Genel Komutanlığı",
        telefon: "0252 656 1030"
      }
    ]
  },

  // ── 13. KAVAKLIDERE (ORMAN İLÇESİ & DAĞ İZOLASYONU) ──
  kavaklidere: {
    nodeId: "kavaklidere",
    nodeName: "Kavaklıdere",
    emergencyCode: "MU-KVK-12",
    category: "sanayi_tarim",
    riskScore: 40,
    commandHub: "Kavaklıdere Hükümet Konağı Masası",
    keyRisks: [
      "Muğla'nın en yüksek rakımlı ilçesi; kış aylarında kar & buzlanma",
      "Yatağan bağlantılı tek ana dağ yolu (24 km)",
      "Yoğun karaçam orman varlığı ve yıldırım yangınları"
    ],
    contingencyRoutes: [
      "Kavaklıdere - Yatağan Tek Anayolu",
      "Menteşe - Göktepe Dağ Geçidi (Acil 4x4)",
      "Bozdoğan - Aydın İl Sınırı Dağ Yolu"
    ],
    contacts: [
      {
        id: "c-kavaklidere-1",
        roleTag: "mulki_amiri",
        roleLabel: "Mülki İdare Amiri",
        unvan: "Kavaklıdere Kaymakamı",
        isim: "Cihad KARAKAYA",
        kurum: "Kavaklıdere Kaymakamlığı",
        telefon: "0252 592 7101",
        faks: "0252 592 7821",
        isPrimary: true
      },
      {
        id: "c-kavaklidere-2",
        roleTag: "belediye",
        roleLabel: "Yerel Yönetim",
        unvan: "Kavaklıdere Belediye Başkanı",
        isim: "Mehmet DEMİR",
        kurum: "Kavaklıdere Belediyesi",
        telefon: "0252 592 7003",
        isPrimary: true
      },
      {
        id: "c-kavaklidere-3",
        roleTag: "afet_acil",
        roleLabel: "Orman Yangın İlk Müdahale",
        unvan: "Kavaklıdere Orman İşletme Şefi",
        isim: "Kavaklıdere Orman Şefliği",
        kurum: "Muğla Orman Bölge",
        telefon: "0252 592 7015"
      }
    ]
  },

  // ── 14. GEYİK BARAJI (BODRUM & MİLAS İÇME SUYU KALBİ) ──
  geyik_baraji: {
    nodeId: "geyik_baraji",
    nodeName: "Geyik Barajı",
    emergencyCode: "MU-HUB-GYK",
    category: "altyapi_hub",
    riskScore: 84,
    commandHub: "MUSKİ Genel Müdürlüğü İçme Suyu Daire Bşk. & DSİ 213. Şube",
    keyRisks: [
      "Bodrum ve Milas'a günlük 85.000 m³ içme suyu sağlayan kritik kaynak",
      "Kuraklık periyotlarında hacim düşüşü ve su alma yapısı arızaları",
      "Ana isale hattında basınç patlaması veya elektrik kesintisi"
    ],
    contingencyRoutes: [
      "Milas - Çamköy Yeraltı Kuyuları Takviyesi",
      "Bodrum Mumcular Barajı İkinci Rezervuarı",
      "Deniz Suyu Arıtma (Desalinasyon) Mobil Üniteleri"
    ],
    contacts: [
      {
        id: "c-gyk-1",
        roleTag: "altyapi_su",
        roleLabel: "Altyapı & Su Operatörü",
        unvan: "MUSKİ Genel Müdürü",
        isim: "Yılmaz ŞENGÜL",
        kurum: "Muğla Su ve Kanalizasyon İdaresi",
        telefon: "0252 214 1000",
        dahili: "185",
        isPrimary: true
      },
      {
        id: "c-gyk-2",
        roleTag: "altyapi_su",
        roleLabel: "Devlet Su İşleri Amiri",
        unvan: "DSİ 213. Şube Müdürü",
        isim: "DSİ Muğla Şube Müdürlüğü",
        kurum: "DSİ 21. Bölge Müdürlüğü",
        telefon: "0252 214 1175",
        isPrimary: true
      },
      {
        id: "c-gyk-3",
        roleTag: "mulki_amiri",
        roleLabel: "Havza Mülki Amiri",
        unvan: "Milas Kaymakamı",
        isim: "Dr. Vural KARAGÜL",
        kurum: "Milas Kaymakamlığı",
        telefon: "0252 512 1001"
      }
    ]
  },

  // ── 15. SAKAR RAMPASI (KIYI - MERKEZ KRİTİK DARBOĞAZI) ──
  sakar_rampasi: {
    nodeId: "sakar_rampasi",
    nodeName: "Sakar Rampası Geçidi",
    emergencyCode: "MU-HUB-SKR",
    category: "altyapi_hub",
    riskScore: 79,
    commandHub: "Karayolları 26. Şube Şefliği & Bölge Trafik Denetleme",
    keyRisks: [
      "%10 eğimli, keskin virajlı 12 km kritik dağ inişi",
      "Kaza veya ağır vasıta arızasında Marmaris, Datça, Köyceğiz ve Ortaca'nın Muğla merkezle bağının kopması",
      "Yağışlı havalarda kaya düşmesi ve heyelan"
    ],
    contingencyRoutes: [
      "Ula - Karabörtlen - Köyceğiz Dağ Yolu (Küçük Araçlar İçin)",
      "Menteşe - Milas - Ören - Akyaka Kıyı Alternatifi",
      "Hava Ambulansı / Helikopter Acil Tahliyesi"
    ],
    contacts: [
      {
        id: "c-skr-1",
        roleTag: "altyapi_su",
        roleLabel: "Karayolları Bakım Amiri",
        unvan: "Karayolları 26. Şube Şefi",
        isim: "Karayolları 2. Bölge Muğla Şefliği",
        kurum: "Karayolları Genel Müdürlüğü",
        telefon: "0252 214 1045",
        isPrimary: true
      },
      {
        id: "c-skr-2",
        roleTag: "kolluk",
        roleLabel: "Geçit Trafik Denetleme",
        unvan: "Bölge Trafik Denetleme Şube Müdürü",
        isim: "Sakar Rampası İstasyon Ekibi",
        kurum: "Muğla İl Emniyet Müdürlüğü",
        telefon: "0252 214 1910",
        dahili: "112",
        isPrimary: true
      },
      {
        id: "c-skr-3",
        roleTag: "mulki_amiri",
        roleLabel: "Bölge Mülki İdare Amiri",
        unvan: "Ula Kaymakamı",
        isim: "Murat EKİNCİ",
        kurum: "Ula Kaymakamlığı",
        telefon: "0252 242 3001"
      }
    ]
  },

  // ── 16. DALAMAN HAVALİMANI (DLM) ──
  dlm_havalimani: {
    nodeId: "dlm_havalimani",
    nodeName: "Dalaman Havalimanı (DLM)",
    emergencyCode: "MU-HUB-DLM",
    category: "altyapi_hub",
    riskScore: 59,
    commandHub: "DHMİ Dalaman Havalimanı Mülki İdare Amirliği & Kriz Masası",
    keyRisks: [
      "Yılda 5.5 milyon yolcu kapasiteli güney uluslararası hava kapısı",
      "Hava meydanı yangın söndürme (ARFF) ve acil iniş protokolü",
      "Turizm pikinde havalimanı servis yolu trafiği"
    ],
    contingencyRoutes: [
      "Dalaman Protokol Yolu - D-400 Bağlantısı",
      "Göcek - Fethiye Transfer Aksı",
      "Milas-Bodrum Havalimanı (BJV) Yedek İniş Meydanı"
    ],
    contacts: [
      {
        id: "c-dlm-1",
        roleTag: "mulki_amiri",
        roleLabel: "Havalimanı Mülki Amiri",
        unvan: "Dalaman Kaymakamı / Mülki İdare Amiri",
        isim: "Ferhat VARDAR",
        kurum: "Dalaman Mülki İdare Amirliği",
        telefon: "0252 692 5011",
        isPrimary: true
      },
      {
        id: "c-dlm-2",
        roleTag: "ulasim_kapisi" as any,
        roleLabel: "Havalimanı Başmüdürü",
        unvan: "DHMİ Dalaman Havalimanı Başmüdürü",
        isim: "Kemal Daştan",
        kurum: "DHMİ Genel Müdürlüğü",
        telefon: "0252 792 5555",
        faks: "0252 792 5565",
        isPrimary: true
      },
      {
        id: "c-dlm-3",
        roleTag: "kolluk",
        roleLabel: "Havalimanı Emniyet",
        unvan: "Havalimanı Emniyet Şube Müdürü",
        isim: "DHMİ Emniyet Amirliği",
        kurum: "İl Emniyet Müdürlüğü",
        telefon: "0252 792 5291"
      }
    ]
  },

  // ── 17. MİLAS-BODRUM HAVALİMANI (BJV) ──
  bjv_havalimani: {
    nodeId: "bjv_havalimani",
    nodeName: "Milas-Bodrum Havalimanı (BJV)",
    emergencyCode: "MU-HUB-BJV",
    category: "altyapi_hub",
    riskScore: 62,
    commandHub: "DHMİ Milas-Bodrum Havalimanı Mülki İdare Amirliği",
    keyRisks: [
      "Bodrum Yarımadası ve Güllük Körfezi ana hava kapısı",
      "Yaz sezonunda yoğun charter ve VIP jet trafiği",
      "D-330 karayolu bağlantı kavşağında kaza ve tıkanma riski"
    ],
    contingencyRoutes: [
      "D-330 Bodrum Yarımadası Aksı",
      "D-330 Milas - İzmir Yolu",
      "Dalaman Havalimanı (DLM) İkinci Meydan Yedeği"
    ],
    contacts: [
      {
        id: "c-bjv-1",
        roleTag: "mulki_amiri",
        roleLabel: "Havalimanı Mülki Amiri",
        unvan: "Milas Kaymakamı / Mülki İdare Amiri",
        isim: "Dr. Vural KARAGÜL",
        kurum: "Milas Mülki İdare Amirliği",
        telefon: "0252 512 1001",
        isPrimary: true
      },
      {
        id: "c-bjv-2",
        roleTag: "ulasim_kapisi" as any,
        roleLabel: "Havalimanı Başmüdürü",
        unvan: "DHMİ Milas-Bodrum Havalimanı Başmüdürü",
        isim: "Yücel Karadavut",
        kurum: "DHMİ Genel Müdürlüğü",
        telefon: "0252 523 0101",
        faks: "0252 523 0125",
        isPrimary: true
      },
      {
        id: "c-bjv-3",
        roleTag: "kolluk",
        roleLabel: "Havalimanı Emniyet",
        unvan: "BJV Emniyet Şube Müdürü",
        isim: "Havalimanı Emniyet Şube Müdürlüğü",
        kurum: "İl Emniyet Müdürlüğü",
        telefon: "0252 523 0130"
      }
    ]
  }
};

/**
 * Bir düğümün kriz protokol bilgilerini getirir.
 */
export const getNodeCrisisChain = (nodeId: string): NodeCrisisInfo => {
  if (CRISIS_PROTOCOL_CHAINS[nodeId]) {
    return CRISIS_PROTOCOL_CHAINS[nodeId];
  }

  // Varsayılan İl Merkezi Bilgisi Fallback'i
  return {
    nodeId,
    nodeName: nodeId.toUpperCase(),
    emergencyCode: `MU-${nodeId.slice(0, 3).toUpperCase()}`,
    category: "merkez",
    riskScore: 50,
    commandHub: "Muğla Valiliği GAMER & AFAD İl Merkezi",
    keyRisks: ["Standart İlçe Koordinasyon Riski"],
    contingencyRoutes: ["D-330 / D-400 Karayolu"],
    contacts: CRISIS_PROTOCOL_CHAINS.mentese.contacts
  };
};

/**
 * Telsiz, WhatsApp ve SMS formatında tek tıkla kriz brifingi üretir
 */
export const generateCrisisDispatchText = (info: NodeCrisisInfo): string => {
  const primary = info.contacts.find((c) => c.isPrimary) || info.contacts[0];
  const timestamp = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return `🔴 [MUĞLA MONITOR v2] KRİZ & PROTOKOL BRİFİNGİ (${timestamp})
────────────────────────────────
📍 Düğüm / Bölge: ${info.nodeName} (${info.emergencyCode})
⚠️ Risk Seviyesi: %${info.riskScore} (${info.riskScore > 70 ? "KRİTİK" : info.riskScore > 50 ? "YÜKSEK" : "ORTA"})
🏛️ Komuta Merkezi: ${info.commandHub}

👤 Mülki İdare Amiri:
   • ${primary.unvan}: ${primary.isim}
   • İletişim: ${primary.telefon}

🚨 Öncelikli Risk Başlıkları:
${info.keyRisks.map((r, i) => `   ${i + 1}. ${r}`).join("\n")}

🛣️ Tahliye & Müdahale Güzergahları:
${info.contingencyRoutes.map((r) => `   • ${r}`).join("\n")}

📞 Koordinasyon Numaraları:
${info.contacts.slice(0, 4).map((c) => `   • ${c.roleLabel}: ${c.isim} (${c.telefon})`).join("\n")}
────────────────────────────────
*Bu mesaj Muğla Monitor v2 Kriz Protokol Zinciri tarafından otomatik üretilmiştir.*`;
};
