// src/data/districtDetailedMetrics.ts
// Muğla 13 İlçe Resmi Nüfus (TÜİK ADNKS), Turizm Yoğunluğu ve Çok Boyutlu Risk Veritabanı

export interface DistrictDetailedMetric {
  id: string;
  name: string;
  emoji: string;
  type: "coastal" | "inland";
  center: [number, number]; // [lat, lon]
  
  // Demografi (TÜİK ADNKS 2024 Doğrulanmış)
  population: number;
  populationFormatted: string;
  summerPopulationPeak: number;
  summerPopulationPeakFormatted: string;
  populationMultiplier: string; // e.g. "7.5x"
  areaKm2: number;
  densityPerKm2: number;

  // Turizm Kapasitesi & Yoğunluğu
  tourismScore: number; // 0 - 100
  tourismDensityLabel: "Aşırı Yoğun" | "Yüksek" | "Orta" | "Düşük";
  annualVisitors: string;
  hotelBedCapacity: number;
  averageHotelOccupancy: number; // %

  // Çok Boyutlu Risk Matrisi (0 - 100)
  compositeRiskScore: number; // 100 üzerinden bileşik kentsel risk
  riskLabel: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  riskBreakdown: {
    fireRisk: number;       // Orman arayüzü & meteorolojik yangın riski
    seismicRisk: number;    // Fay hatları & deprem duyarlılığı
    trafficCongestion: number; // Pik saat trafik tıkanıklığı
    waterStress: number;    // Su rezervi & kuraklık baskısı
  };

  // Altyapı & Operasyonel Notlar
  primaryEconomicDriver: string;
  criticalInfrastructure: string[];
  operationalSummary: string;
}

export const DISTRICT_DETAILED_METRICS: Record<string, DistrictDetailedMetric> = {
  bodrum: {
    id: "bodrum",
    name: "Bodrum",
    emoji: "⛵",
    type: "coastal",
    center: [37.0344, 27.4305],
    population: 198335,
    populationFormatted: "198.335",
    summerPopulationPeak: 1450000,
    summerPopulationPeakFormatted: "1.450.000",
    populationMultiplier: "7.3x",
    areaKm2: 602,
    densityPerKm2: 329,
    tourismScore: 96,
    tourismDensityLabel: "Aşırı Yoğun",
    annualVisitors: "1.8M Turist",
    hotelBedCapacity: 88500,
    averageHotelOccupancy: 89,
    compositeRiskScore: 72,
    riskLabel: "Kritik",
    riskBreakdown: {
      fireRisk: 68,
      seismicRisk: 74,
      trafficCongestion: 85,
      waterStress: 92
    },
    primaryEconomicDriver: "Lüks Turizm, Marinalar & Gayrimenkul",
    criticalInfrastructure: [
      "Mumcular & Geyik Barajı isale hatları",
      "D-330 Bodrum-Torba-Yalıkavak ana arter koridoru",
      "Yalıkavak & Turgutreis Uluslararası Marinaları"
    ],
    operationalSummary: "Yaz aylarında yerleşik nüfusunun 7 katından fazlasına ulaşması su isale hatlarında ve D-330 arterinde aşırı basınca yol açar. Gece su basınç optimizasyonu kritiktir."
  },

  fethiye: {
    id: "fethiye",
    name: "Fethiye",
    emoji: "🧿",
    type: "coastal",
    center: [36.6548, 29.1165],
    population: 181415,
    populationFormatted: "181.415",
    summerPopulationPeak: 850000,
    summerPopulationPeakFormatted: "850.000",
    populationMultiplier: "4.7x",
    areaKm2: 1205,
    densityPerKm2: 150,
    tourismScore: 91,
    tourismDensityLabel: "Aşırı Yoğun",
    annualVisitors: "1.4M Turist",
    hotelBedCapacity: 62000,
    averageHotelOccupancy: 84,
    compositeRiskScore: 66,
    riskLabel: "Yüksek",
    riskBreakdown: {
      fireRisk: 72,
      seismicRisk: 86,
      trafficCongestion: 68,
      waterStress: 54
    },
    primaryEconomicDriver: "Ekoturizm, Yamaç Paraşütü & Mavi Yolculuk",
    criticalInfrastructure: [
      "Ölüdeniz - Babadağ Teleferik & Ulaşım Aksı",
      "Göcek Körfezi Yat ve Marina Tesisleri",
      "Fethiye-Seydikemer Fay Hattı Sismik Koridoru"
    ],
    operationalSummary: "Fethiye-Burdur fay segmenti nedeniyle sismik duyarlılığı en yüksek ilçelerdendir. Babadağ orman arayüzü ve Ölüdeniz kıyı bandı eşzamanlı izlenmektedir."
  },

  milas: {
    id: "milas",
    name: "Milas",
    emoji: "🏛️",
    type: "coastal",
    center: [37.3166, 27.7869],
    population: 151590,
    populationFormatted: "151.590",
    summerPopulationPeak: 380000,
    summerPopulationPeakFormatted: "380.000",
    populationMultiplier: "2.5x",
    areaKm2: 1993,
    densityPerKm2: 76,
    tourismScore: 68,
    tourismDensityLabel: "Orta",
    annualVisitors: "650K Turist",
    hotelBedCapacity: 22000,
    averageHotelOccupancy: 71,
    compositeRiskScore: 58,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 84,
      seismicRisk: 52,
      trafficCongestion: 56,
      waterStress: 62
    },
    primaryEconomicDriver: "Zeytincilik, Balıkçılık, Madencilik & Havalimanı Lojistiği",
    criticalInfrastructure: [
      "Milas-Bodrum Uluslararası Havalimanı (BJV)",
      "Geyik Barajı Su Rezervuarı",
      "Güllük Limanı & Ören Sahil Bandı"
    ],
    operationalSummary: "Geniş çam ormanı yüzölçümü nedeniyle yaz aylarında yangın riski en yüksek ilçedir. Bodrum'un su ve havalimanı lojistiğini doğrudan sırtlar."
  },

  mentese: {
    id: "mentese",
    name: "Menteşe",
    emoji: "🏢",
    type: "inland",
    center: [37.2153, 28.3636],
    population: 123284,
    populationFormatted: "123.284",
    summerPopulationPeak: 145000,
    summerPopulationPeakFormatted: "145.000",
    populationMultiplier: "1.2x",
    areaKm2: 1780,
    densityPerKm2: 69,
    tourismScore: 35,
    tourismDensityLabel: "Düşük",
    annualVisitors: "180K Ziyaretçi",
    hotelBedCapacity: 6500,
    averageHotelOccupancy: 56,
    compositeRiskScore: 42,
    riskLabel: "Düşük",
    riskBreakdown: {
      fireRisk: 48,
      seismicRisk: 62,
      trafficCongestion: 44,
      waterStress: 36
    },
    primaryEconomicDriver: "Kamu Yönetimi, MSKÜ Üniversitesi & Bölgesel Sağlık",
    criticalInfrastructure: [
      "Muğla Valiliği & Büyükşehir AKOM Koordinasyon Merkezi",
      "Muğla Eğitim ve Araştırma Hastanesi (Bölge Travma Merkezi)",
      "MSKÜ Kötekli Kampüsü (42.000 Öğrenci)"
    ],
    operationalSummary: "İlin idari, sağlık ve afet koordinasyon beynidir. Turizm nüfus dalgalanmasından en az etkilenen, operasyonel kapasitesi en dengeli ilçedir."
  },

  marmaris: {
    id: "marmaris",
    name: "Marmaris",
    emoji: "🏖️",
    type: "coastal",
    center: [36.8521, 28.2706],
    population: 97818,
    populationFormatted: "97.818",
    summerPopulationPeak: 750000,
    summerPopulationPeakFormatted: "750.000",
    populationMultiplier: "7.7x",
    areaKm2: 891,
    densityPerKm2: 110,
    tourismScore: 94,
    tourismDensityLabel: "Aşırı Yoğun",
    annualVisitors: "1.5M Turist",
    hotelBedCapacity: 74000,
    averageHotelOccupancy: 87,
    compositeRiskScore: 78,
    riskLabel: "Kritik",
    riskBreakdown: {
      fireRisk: 94,
      seismicRisk: 68,
      trafficCongestion: 76,
      waterStress: 78
    },
    primaryEconomicDriver: "Kruvaziyer & Marina Turizmi, Bal Üretimi, Otelcilik",
    criticalInfrastructure: [
      "Marmaris Cruise Port Limanı & Netsel Marina",
      "Marmaris-Datça Tek Giriş-Çıkış Karayolu Boğazı",
      "İçmeler - Armutalan Kentsel Orman Arayüzü"
    ],
    operationalSummary: "Sarp vadiler ve yoğun kızılçam örtüsü orman yangını tehdidini sürekli kılar. Tek kara yolu bağlantısı olması tahliye senaryolarında kilit öneme sahiptir."
  },

  seydikemer: {
    id: "seydikemer",
    name: "Seydikemer",
    emoji: "🏔️",
    type: "inland",
    center: [36.9183, 29.1286],
    population: 63870,
    populationFormatted: "63.870",
    summerPopulationPeak: 95000,
    summerPopulationPeakFormatted: "95.000",
    populationMultiplier: "1.5x",
    areaKm2: 1394,
    densityPerKm2: 46,
    tourismScore: 48,
    tourismDensityLabel: "Orta",
    annualVisitors: "450K Ziyaretçi",
    hotelBedCapacity: 5200,
    averageHotelOccupancy: 64,
    compositeRiskScore: 50,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 55,
      seismicRisk: 72,
      trafficCongestion: 32,
      waterStress: 42
    },
    primaryEconomicDriver: "Seracılık, Alabalık Yetiştiriciliği & Saklıkent Kanyonu",
    criticalInfrastructure: [
      "Saklıkent Kanyonu Turizm Koridoru",
      "Eşen Çayı Su Havzası & Barajı",
      "Muğla-Antalya İl Sınırı Karayolu Geçişi"
    ],
    operationalSummary: "Geniş coğrafyası ve tarımsal üretimiyle öne çıkar. Saklıkent taşkın riskleri ve Fethiye fay segmentine komşuluk sismik takip gerektirir."
  },

  ortaca: {
    id: "ortaca",
    name: "Ortaca",
    emoji: "🌲",
    type: "coastal",
    center: [36.8344, 28.7682],
    population: 55437,
    populationFormatted: "55.437",
    summerPopulationPeak: 220000,
    summerPopulationPeakFormatted: "220.000",
    populationMultiplier: "4.0x",
    areaKm2: 574,
    densityPerKm2: 97,
    tourismScore: 85,
    tourismDensityLabel: "Yüksek",
    annualVisitors: "850K Turist",
    hotelBedCapacity: 26000,
    averageHotelOccupancy: 82,
    compositeRiskScore: 54,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 52,
      seismicRisk: 56,
      trafficCongestion: 62,
      waterStress: 46
    },
    primaryEconomicDriver: "Dalyan Kanal Turizmi, Narenciye Üretimi & İztuzu Koruma",
    criticalInfrastructure: [
      "Dalyan Lagün Kanalı ve Tekne Filosu",
      "İztuzu Kumsalı Deniz Kaplumbağası Koruma Alanı",
      "D-400 Karayolu Ortaca Şehir Geçişi"
    ],
    operationalSummary: "Hassas sulak alan ekosistemine sahiptir. Dalyan kanalı tekne trafiği ve yaz aylarında D-400 sahil koridorundaki pik yoğunluk ana izleme konusudur."
  },

  dalaman: {
    id: "dalaman",
    name: "Dalaman",
    emoji: "✈️",
    type: "coastal",
    center: [36.7752, 28.7929],
    population: 49012,
    populationFormatted: "49.012",
    summerPopulationPeak: 180000,
    summerPopulationPeakFormatted: "180.000",
    populationMultiplier: "3.7x",
    areaKm2: 582,
    densityPerKm2: 84,
    tourismScore: 76,
    tourismDensityLabel: "Yüksek",
    annualVisitors: "3.2M Yolcu Transit",
    hotelBedCapacity: 14500,
    averageHotelOccupancy: 78,
    compositeRiskScore: 52,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 58,
      seismicRisk: 54,
      trafficCongestion: 52,
      waterStress: 44
    },
    primaryEconomicDriver: "Dalaman Havalimanı (DLM), Kağıt Sanayi & Tarım",
    criticalInfrastructure: [
      "Dalaman Uluslararası Havalimanı (Yıllık 5M+ yolcu kapasitesi)",
      "Dalaman Çayı ve Tarımsal Sulama Regülatörleri",
      "Sarsala ve Göcek Koyları Deniz Transfer İskeleleri"
    ],
    operationalSummary: "Muğla'nın güney kıyılarının (Marmaris, Fethiye, Kaş) ana uluslararası hava giriş kapısıdır. Havalimanı transit transfer güvenliği önceliklidir."
  },

  yatagan: {
    id: "yatagan",
    name: "Yatağan",
    emoji: "⚡",
    type: "inland",
    center: [37.3396, 28.1376],
    population: 45283,
    populationFormatted: "45.283",
    summerPopulationPeak: 52000,
    summerPopulationPeakFormatted: "52.000",
    populationMultiplier: "1.1x",
    areaKm2: 1003,
    densityPerKm2: 45,
    tourismScore: 24,
    tourismDensityLabel: "Düşük",
    annualVisitors: "95K Ziyaretçi",
    hotelBedCapacity: 2800,
    averageHotelOccupancy: 52,
    compositeRiskScore: 56,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 50,
      seismicRisk: 58,
      trafficCongestion: 42,
      waterStress: 72
    },
    primaryEconomicDriver: "Termik Enerji Üretimi, Linyit Madenciliği & Stratonikeia",
    criticalInfrastructure: [
      "Yatağan Termik Santrali (Ulusal şebeke besleme noktası)",
      "Stratonikeia & Lagina Antik Kenti Arkeoloji Sahası",
      "Muğla-Aydın-İzmir D-550 Ana Karayolu Kavşağı"
    ],
    operationalSummary: "Sanayi ve enerji üssüdür. Hava kalitesi (PM10/SO2) sensörleri ve yeraltı su havzası deşarj değerleri sürekli denetlenmektedir."
  },

  koycegiz: {
    id: "koycegiz",
    name: "Köyceğiz",
    emoji: "🌊",
    type: "coastal",
    center: [36.9705, 28.6854],
    population: 40167,
    populationFormatted: "40.167",
    summerPopulationPeak: 110000,
    summerPopulationPeakFormatted: "110.000",
    populationMultiplier: "2.7x",
    areaKm2: 1501,
    densityPerKm2: 27,
    tourismScore: 65,
    tourismDensityLabel: "Orta",
    annualVisitors: "350K Turist",
    hotelBedCapacity: 11000,
    averageHotelOccupancy: 74,
    compositeRiskScore: 48,
    riskLabel: "Düşük",
    riskBreakdown: {
      fireRisk: 62,
      seismicRisk: 50,
      trafficCongestion: 36,
      waterStress: 42
    },
    primaryEconomicDriver: "Ekolojik Turizm, Sığla Yağı, Narenciye & Termal Kaplıcalar",
    criticalInfrastructure: [
      "Köyceğiz Gölü Su Seviyesi & Taşkın Regülasyon Kanalı",
      "Sultaniye Termal ve Çamur Banyoları",
      "Sandras Dağı Yaban Hayatı ve Doğal Koruma Alanı"
    ],
    operationalSummary: "Doğal lagün gölü sistemi ve endemik Sığla ormanları bulunur. Kış ve ilkbahar yağışlarında göl su seviyesi yükselmeleri takip edilir."
  },

  ula: {
    id: "ula",
    name: "Ula",
    emoji: "🌾",
    type: "coastal",
    center: [37.1035, 28.4266],
    population: 27537,
    populationFormatted: "27.537",
    summerPopulationPeak: 160000,
    summerPopulationPeakFormatted: "160.000",
    populationMultiplier: "5.8x",
    areaKm2: 740,
    densityPerKm2: 37,
    tourismScore: 82,
    tourismDensityLabel: "Yüksek",
    annualVisitors: "900K Turist",
    hotelBedCapacity: 18000,
    averageHotelOccupancy: 88,
    compositeRiskScore: 60,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 74,
      seismicRisk: 55,
      trafficCongestion: 72,
      waterStress: 40
    },
    primaryEconomicDriver: "Akyaka Kitesurf & Yavaş Şehir (Cittaslow), Tarım",
    criticalInfrastructure: [
      "Sakar Rampası Karayolu Geçişi (Muğla-Marmaris ana boğazı)",
      "Akyaka Azmak Çayı & Gökova Körfezi Kıyı Koruma Sahası",
      "Gökova Rüzgar Koridoru Spor Tesisleri"
    ],
    operationalSummary: "Akyaka yaz aylarında aşırı turizm baskısı altındadır. Sakar rampasındaki dik eğimli trafik akışı ve yaz rüzgarlarının yangın riski öne çıkar."
  },

  datca: {
    id: "datca",
    name: "Datça",
    emoji: "🌿",
    type: "coastal",
    center: [36.7344, 27.6866],
    population: 25741,
    populationFormatted: "25.741",
    summerPopulationPeak: 140000,
    summerPopulationPeakFormatted: "140.000",
    populationMultiplier: "5.4x",
    areaKm2: 960,
    densityPerKm2: 27,
    tourismScore: 87,
    tourismDensityLabel: "Yüksek",
    annualVisitors: "620K Turist",
    hotelBedCapacity: 16500,
    averageHotelOccupancy: 86,
    compositeRiskScore: 64,
    riskLabel: "Orta",
    riskBreakdown: {
      fireRisk: 78,
      seismicRisk: 60,
      trafficCongestion: 52,
      waterStress: 76
    },
    primaryEconomicDriver: "Butik & Doğa Turizmi, Badem & Zeytin Yetiştiriciliği, Knidos",
    criticalInfrastructure: [
      "Marmaris-Datça Tek Girişli Yarımada Karayolu (D-400 sonu)",
      "Datça-Bodrum Feribot İskelesi (Deniz Transfer Koridoru)",
      "Knidos Antik Kenti ve Feneri Açık Deniz Hattı"
    ],
    operationalSummary: "Yarımada coğrafyası nedeniyle tek kara yolu ulaşımına sahiptir. Yaz aylarında artezyen kuyu debileri ve elektrik şebekesi yoğun yük altındadır."
  },

  kavaklidere: {
    id: "kavaklidere",
    name: "Kavaklıdere",
    emoji: "🌲",
    type: "inland",
    center: [37.4460, 28.3904],
    population: 10738,
    populationFormatted: "10.738",
    summerPopulationPeak: 14000,
    summerPopulationPeakFormatted: "14.000",
    populationMultiplier: "1.3x",
    areaKm2: 632,
    densityPerKm2: 17,
    tourismScore: 18,
    tourismDensityLabel: "Düşük",
    annualVisitors: "35K Ziyaretçi",
    hotelBedCapacity: 1200,
    averageHotelOccupancy: 48,
    compositeRiskScore: 36,
    riskLabel: "Düşük",
    riskBreakdown: {
      fireRisk: 52,
      seismicRisk: 42,
      trafficCongestion: 18,
      waterStress: 30
    },
    primaryEconomicDriver: "Bakırcılık, Orman Ürünleri & Yayla Turizmi",
    criticalInfrastructure: [
      "Göktepe Dağı Orman Gözetleme Kuleleri",
      "Kavaklıdere-Aydın-Yatağan Dağ Yolu Koridoru",
      "Tarihi Bakırcılar Çarşısı Zanaat Merkezi"
    ],
    operationalSummary: "Muğla'nın en düşük nüfuslu ve en yüksek rakımlı ilçesidir. Kış mevsiminde karla mücadele, yaz aylarında ise yüksek dağlık orman takibi yapılır."
  }
};
