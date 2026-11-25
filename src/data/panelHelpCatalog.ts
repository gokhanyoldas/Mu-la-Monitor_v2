import type { ViewMode } from "@/contexts/AccessibilityContext";

interface HelpEntry {
  tr: string;
  en: string;
}

const PANEL_HELP_CATALOG: Record<string, HelpEntry> = {
  // Traffic & Transport
  "trafik yoğunluk haritası": {
    tr: "Muğla ilçelerindeki anlık yol yoğunluğunu ve vatandaş ihbarıyla tespit edilen kör noktaları gösterir.",
    en: "Shows live road traffic density across Muğla districts alongside citizen-verified congestion blindspots.",
  },
  "ulaşım & trafik özeti": {
    tr: "İl genelindeki ortalama trafik yoğunluğunu, en yoğun ilçeyi ve yol çalışmalarını özetler.",
    en: "Summarizes province-wide traffic congestion, the busiest district, and active roadworks.",
  },
  "ulaşım & trafik akışı": {
    tr: "Ana arterlerdeki trafik akışını ve güncel yol durumu bildirimlerini tek ekranda toplar.",
    en: "Brings together main corridor traffic flow and live road condition updates.",
  },
  "havalimanları (dlm/bjv)": {
    tr: "Dalaman ve Milas-Bodrum havalimanlarındaki aktif uçuş hareketlerini canlı olarak gösterir.",
    en: "Displays live flight activity at Dalaman and Milas-Bodrum airports.",
  },
  "havalimanları": {
    tr: "Dalaman ve Milas-Bodrum havalimanlarındaki aktif iniş ve kalkış uçuşlarını izler.",
    en: "Tracks live arrivals and departures at Dalaman and Milas-Bodrum airports.",
  },
  "canlı uçuş takibi": {
    tr: "Muğla hava sahasında iniş ve kalkış yapan uçakları gerçek zamanlı radar verisiyle listeler.",
    en: "Lists aircraft arriving at or departing from Muğla airports using live radar feeds.",
  },
  "altyapı projeleri": {
    tr: "Devam eden yol, kavşak ve tünel projelerinin basın takibini ve vatandaş ihbarlarını gösterir.",
    en: "Tracks ongoing road, junction, and tunnel projects from local news and citizen reports.",
  },
  "yol & altyapı projeleri": {
    tr: "Muğla genelindeki kara yolu ve belediye altyapı çalışmalarının güncel durumunu izler.",
    en: "Monitors the current status of highway and municipal infrastructure works across Muğla.",
  },
  "şehirlerarası otobüs seferleri": {
    tr: "Muğla otogarlarından kalkan güncel şehirlerarası ve MUTTAŞ otobüs seferlerini listeler.",
    en: "Lists current intercity and MUTTAŞ municipal bus departures across Muğla.",
  },

  // Environment, Weather, Water & Fire
  "hava & i̇klim": {
    tr: "Muğla için anlık sıcaklık, nem, rüzgar, deniz suyu ve yağış ölçümlerini sunar.",
    en: "Provides live temperature, humidity, wind, sea temperature, and rainfall readings for Muğla.",
  },
  "hava & iklim": {
    tr: "Muğla için anlık sıcaklık, nem, rüzgar, deniz suyu ve yağış ölçümlerini sunar.",
    en: "Provides live temperature, humidity, wind, sea temperature, and rainfall readings for Muğla.",
  },
  "hava kalitesi": {
    tr: "Soluduğumuz havadaki toz ve partikül düzeylerini ölçerek günlük sağlık etkisini gösterir.",
    en: "Measures airborne dust and particulate levels to show daily air quality impact.",
  },
  "hava kalitesi (aqi)": {
    tr: "Soluduğumuz havadaki toz ve partikül düzeylerini ölçerek günlük sağlık etkisini gösterir.",
    en: "Measures airborne dust and particulate levels to show daily air quality impact.",
  },
  "su & barajlar": {
    tr: "Muğla'daki 8 barajın doluluk oranlarını ve sahadan gelen sel veya su kesintisi uyarılarını gösterir.",
    en: "Shows reservoir fill rates for Muğla's 8 dams together with field flood or water outage alerts.",
  },
  "yangın riski göstergesi": {
    tr: "Sıcaklık, nem ve rüzgar verilerinden hesaplanan günlük orman yangını risk düzeyini bildirir.",
    en: "Reports daily wildfire danger calculated from live temperature, humidity, and wind data.",
  },
  "orman yangın risk göstergesi": {
    tr: "Sıcaklık, nem ve rüzgar verilerinden hesaplanan günlük orman yangını risk düzeyini bildirir.",
    en: "Reports daily wildfire danger calculated from live temperature, humidity, and wind data.",
  },

  // Economy & Budgets
  "ekonomi & i̇stihdam": {
    tr: "Muğla'nın turizm geliri, işgücü, döviz kuru ve yerel ekonomik göstergelerini özetler.",
    en: "Summarizes Muğla's tourism revenue, employment metrics, exchange rates, and local economic trends.",
  },
  "ekonomi & istihdam": {
    tr: "Muğla'nın turizm geliri, işgücü, döviz kuru ve yerel ekonomik göstergelerini özetler.",
    en: "Summarizes Muğla's tourism revenue, employment metrics, exchange rates, and local economic trends.",
  },
  "gayrimenkul & i̇lanlar": {
    tr: "İlçelerdeki ortalama metrekare konut fiyatlarını ve yıllık değişim oranlarını gösterir.",
    en: "Displays average housing prices per square meter and yearly trends across districts.",
  },
  "gayrimenkul & ilanlar": {
    tr: "İlçelerdeki ortalama metrekare konut fiyatlarını ve yıllık değişim oranlarını gösterir.",
    en: "Displays average housing prices per square meter and yearly trends across districts.",
  },
  "yerel yönetim bütçeleri": {
    tr: "Valilik, Büyükşehir ve 13 ilçe belediyesinin resmi bütçe dağılımını ve sahadaki yatırım taleplerini gösterir.",
    en: "Shows approved budgets for the Governorship and 14 municipalities alongside citizen project demands.",
  },
  "yerel yönetim": {
    tr: "Belediye bütçe harcama kalemlerini, yatırım oranlarını ve meclis kararlarını özetler.",
    en: "Summarizes municipal spending categories, investment ratios, and council decisions.",
  },

  // Tourism & Culture
  "turizm": {
    tr: "Yıllık ziyaretçi sayısı, kruvaziyer trafiği ve mevsimsel turist hareketliliğini gösterir.",
    en: "Shows annual visitor counts, cruise traffic, and seasonal tourism movement.",
  },
  "turizm hareketliliği": {
    tr: "Yıllık ziyaretçi sayısı, kruvaziyer trafiği ve mevsimsel turist hareketliliğini gösterir.",
    en: "Shows annual visitor counts, cruise traffic, and seasonal tourism movement.",
  },
  "turizm tahmin modeli": {
    tr: "Önümüzdeki 30 gün için otel, plaj ve restoran doluluk beklentilerini tahmin eder.",
    en: "Forecasts hotel, beach, and restaurant occupancy expectations for the next 30 days.",
  },
  "konaklama": {
    tr: "Muğla genelindeki otel doluluk oranlarını, yatak kapasitesini ve sezon risklerini gösterir.",
    en: "Shows province-wide hotel occupancy rates, total bed capacity, and seasonal risks.",
  },
  "ziyaretçi profili": {
    tr: "Muğla'yı ziyaret eden yerli ve yabancı turistlerin ülkelere göre dağılımını sunar.",
    en: "Breaks down domestic and international tourists visiting Muğla by country.",
  },
  "gastronomi": {
    tr: "Kayıtlı restoran sayısını, ortalama yemek fiyatlarını ve yerel mutfak göstergelerini gösterir.",
    en: "Displays registered restaurant counts, average dining costs, and local culinary data.",
  },
  "tarım & üretim": {
    tr: "Muğla'nın zeytin, narenciye, çam balı ve sera üretimi verilerini özetler.",
    en: "Summarizes Muğla's olive, citrus, pine honey, and greenhouse agricultural production.",
  },
  "kültür & etkinlikler": {
    tr: "İl genelindeki güncel kültür, sanat, festival ve halk etkinliklerini listeler.",
    en: "Lists upcoming cultural, arts, festival, and community events across Muğla.",
  },
  "kültürel miras": {
    tr: "Muğla'daki antik kentler, müzeler ve koruma altındaki tarihi alanların bilgilerini sunar.",
    en: "Highlights ancient cities, museums, and protected heritage sites across Muğla.",
  },

  // Energy
  "enerji & tüketim": {
    tr: "Günlük elektrik tüketimini, aylık kesinti sayısını ve sahadan gelen elektrik arıza bildirimlerini izler.",
    en: "Tracks daily electricity demand, monthly outages, and field-reported power disruptions.",
  },
  "yenilenebilir enerji": {
    tr: "Muğla'daki güneş, rüzgar ve jeotermal enerji tesislerinin kurulu gücünü ve üretim payını gösterir.",
    en: "Shows solar, wind, and geothermal power plant capacity and renewable share in Muğla.",
  },
  "sürdürülebilirlik": {
    tr: "Geri dönüşüm, karbon ayak izi ve akıllı şehir altyapı göstergelerini özetler.",
    en: "Summarizes recycling rates, carbon footprint, and smart-city infrastructure progress.",
  },

  // Social & Demographics
  "sosyal i̇stihbarat": {
    tr: "Sosyal medya ve yerel haberlerde en çok konuşulan vatandaş şikayetlerini ve takip edilen kelimeleri özetler.",
    en: "Summarizes the most discussed citizen topics and tracked keywords across social media and local news.",
  },
  "sosyal istihbarat": {
    tr: "Sosyal medya ve yerel haberlerde en çok konuşulan vatandaş şikayetlerini ve takip edilen kelimeleri özetler.",
    en: "Summarizes the most discussed citizen topics and tracked keywords across social media and local news.",
  },
  "gündemdeki başlıklar": {
    tr: "Muğla genelinde son günlerde yükselişe geçen güncel konuları ve tartışma başlıklarını listeler.",
    en: "Lists rising public topics and trending community discussions across Muğla.",
  },
  "nüfus & demografi": {
    tr: "TÜİK resmi kayıtlarına göre Muğla'nın nüfus yapısını ve yaş dağılımını gösterir.",
    en: "Displays Muğla's official population structure and age distribution from TurkStat records.",
  },
  "eğitim": {
    tr: "İl genelindeki okul, öğrenci ve üniversite eğitim göstergelerini özetler.",
    en: "Summarizes school, student, and university education indicators across Muğla.",
  },
  "sağlık": {
    tr: "Hastane kapasitesi, hekim sayısı ve temel sağlık hizmeti erişim göstergelerini sunar.",
    en: "Shows hospital capacity, physician counts, and public healthcare access metrics.",
  },
  "yaşam kalitesi": {
    tr: "Yeşil alan, temiz çevre, ulaşım ve temel şehir yaşam memnuniyeti göstergelerini özetler.",
    en: "Summarizes green space, environmental quality, and everyday livability indicators.",
  },

  // Security
  "asayiş & güvenlik": {
    tr: "İl genelindeki temel güvenlik göstergelerini ve trafik kazası istatistiklerini özetler.",
    en: "Summarizes general public safety indicators and monthly traffic incident statistics.",
  },
  "radar & trafik denetim haritası": {
    tr: "Muğla ana yollarındaki sabit trafik denetim ve hız kontrol noktalarını harita üzerinde gösterir.",
    en: "Maps active traffic speed checks and road safety inspection points across Muğla.",
  },
  "acil durum & kriz": {
    tr: "Deprem, sel ve yangın risk seviyelerini ve sahadan gelen aktif kriz uyarılarını bildirir.",
    en: "Reports earthquake, flood, and wildfire risk levels alongside live field crisis warnings.",
  },
  "yol çalışmaları & kapanmalar": {
    tr: "Trafiğe kapalı veya kısmen daralan güzergahları anlık olarak listeler.",
    en: "Lists roads with active closures, lane restrictions, or maintenance work.",
  },
  "haber akışı": {
    tr: "Muğla yerel basınından ve resmi kaynaklardan derlenen son dakika haberlerini sıralar.",
    en: "Streams recent local headlines gathered from Muğla press and official outlets.",
  },

  // AI Summaries, Interrogation Hub, Protocol & Network
  "şehir nabzı": {
    tr: "Tüm sekmelerdeki hava, trafik, baraj ve vatandaş ihbarlarını tek bir güncel şehir özetinde birleştirir.",
    en: "Combines weather, traffic, water, and citizen reports from every tab into one clear daily summary.",
  },
  "günlük ai özeti": {
    tr: "Günün öne çıkan Muğla gelişmelerini kısa ve anlaşılır bir özet halinde sunar.",
    en: "Provides a brief, easy-to-read daily summary of key developments across Muğla.",
  },
  "kamuoyu özeti": {
    tr: "Vatandaşların sosyal medya ve şikayet platformlarında öne çıkardığı konuları özetler.",
    en: "Summarizes the main issues raised by residents on social media and complaint platforms.",
  },
  "deprem risk özeti": {
    tr: "Bölgedeki son sismik hareketleri ve deprem hazırlık durumunu sade biçimde aktarır.",
    en: "Explains recent regional seismic activity and earthquake readiness in plain language.",
  },
  "hava durumu özeti": {
    tr: "Günlük hava koşullarının ulaşım, deniz ve tarım üzerindeki etkisini özetler.",
    en: "Summarizes how today's weather affects travel, coastal activity, and agriculture.",
  },
  "muğla istihbarat & çapraz sorgu odası": {
    tr: "Sosyal medya iddiaları ile resmi verileri karşılaştırarak hangisinin doğru olduğunu kanıtlarıyla gösterir.",
    en: "Compares social media claims against official data to verify what is actually happening on the ground.",
  },
  "muğla il protokol listesi": {
    tr: "Muğla Valiliği, belediyeler ve kamu kurumlarındaki görevli yöneticilerin resmi iletişim listesini sunar.",
    en: "Provides the official directory and contact list of provincial governors, mayors, and public officials.",
  },
  "protokol ilişki ağı": {
    tr: "Valilik, belediyeler, 13 ilçe ve aktif gündemler arasındaki iş birliği bağlantılarını görsel haritada gösterir.",
    en: "Visualizes coordination links between the governorship, municipalities, 13 districts, and active issues.",
  },
};

export function getPanelHelpText(
  title: string,
  lang: "tr" | "en" | "de",
  _viewMode?: ViewMode
): string {
  const key = (title || "").trim().toLocaleLowerCase("tr-TR");
  const entry = PANEL_HELP_CATALOG[key];
  if (entry) {
    return lang === "en" ? entry.en : entry.tr;
  }

  // Fuzzy prefix/substring match for translated or compound panel titles
  for (const [catalogKey, val] of Object.entries(PANEL_HELP_CATALOG)) {
    if (key.includes(catalogKey) || catalogKey.includes(key)) {
      return lang === "en" ? val.en : val.tr;
    }
  }

  return lang === "en"
    ? `Shows live verified data and current status indicators for ${title}.`
    : `${title} başlığına ait güncel verileri ve sahadan doğrulanan göstergeleri sunar.`;
}
