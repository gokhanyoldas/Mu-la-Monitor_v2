// useTranslation.tsx
// Comprehensive Multi-Language (TR / EN / DE) Context, Dictionary & Dynamic Translator

import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";
import { useOptionalAccessibility, simplifyCitizenText } from "@/contexts/AccessibilityContext";

export type Language = "tr" | "en" | "de";

export const LANGUAGE_LABELS: Record<Language, string> = {
  tr: "🇹🇷 Türkçe",
  en: "🇬🇧 English",
  de: "🇩🇪 Deutsch",
};

// 1. Core dictionary for exact keys and phrases
export const translations: Record<Language, Record<string, string>> = {
  tr: {
    // Navigation & Header
    "nav.genel": "Genel Bakış",
    "nav.ekonomi": "Ekonomi",
    "nav.cevre": "Çevre",
    "nav.turizm": "Turizm",
    "nav.ulasim": "Ulaşım",
    "nav.guvenlik": "Güvenlik",
    "nav.sosyal": "Sosyal",
    "nav.enerji": "Enerji",
    "nav.protokol": "Muğla Protokol",
    "nav.osint": "OSINT",
    "nav.ilceler": "İlçeler",
    "Genel Bakış": "Genel Bakış",
    "Ekonomi": "Ekonomi",
    "Çevre": "Çevre",
    "Turizm": "Turizm",
    "Ulaşım": "Ulaşım",
    "Güvenlik": "Güvenlik",
    "Sosyal": "Sosyal",
    "Enerji": "Enerji",
    "Muğla Protokol": "Muğla Protokol",
    "OSINT": "OSINT",
    "İlçeler": "İlçeler",
    "Bölgesel İstihbarat Paneli": "Bölgesel İstihbarat Paneli",
    "CANLI": "CANLI",
    "KAYNAK": "KAYNAK",
    "SON GÜNCELLEME": "SON GÜNCELLEME",

    // Panel Registry Titles (Index.tsx)
    "Trafik Yoğunluk Haritası": "Trafik Yoğunluk Haritası",
    "Hava & İklim": "Hava & İklim",
    "Hava Kalitesi (AQI)": "Hava Kalitesi (AQI)",
    "Yangın Riski Göstergesi": "Yangın Riski Göstergesi",
    "Orman Yangın Risk Göstergesi": "Orman Yangın Risk Göstergesi",
    "Su & Barajlar": "Su & Barajlar",
    "Ekonomi & İstihdam": "Ekonomi & İstihdam",
    "Gayrimenkul & İlanlar": "Gayrimenkul & İlanlar",
    "Tarım & Üretim": "Tarım & Üretim",
    "Yerel Yönetim Bütçeleri": "Yerel Yönetim Bütçeleri",
    "Turizm Tahmin Modeli": "Turizm Tahmin Modeli",
    "Turizm Hareketliliği": "Turizm Hareketliliği",
    "Konaklama & Oteller": "Konaklama & Oteller",
    "Konaklama": "Konaklama",
    "Ziyaretçi Profili": "Ziyaretçi Profili",
    "Muğla Gastronomisi": "Muğla Gastronomisi",
    "Canlı Uçuş Takibi": "Canlı Uçuş Takibi",
    "Ulaşım & Trafik Özeti": "Ulaşım & Trafik Özeti",
    "Ulaşım & Trafik Akışı": "Ulaşım & Trafik Akışı",
    "Havalimanları (DLM/BJV)": "Havalimanları (DLM/BJV)",
    "Yol & Altyapı Projeleri": "Yol & Altyapı Projeleri",
    "Şehirlerarası Otobüs Seferleri": "Şehirlerarası Otobüs Seferleri",
    "Enerji & Tüketim": "Enerji & Tüketim",
    "Yenilenebilir Enerji": "Yenilenebilir Enerji",
    "Sürdürülebilirlik": "Sürdürülebilirlik",
    "Sosyal İstihbarat": "Sosyal İstihbarat",
    "Gündemdeki Başlıklar": "Gündemdeki Başlıklar",
    "Nüfus & Demografi": "Nüfus & Demografi",
    "Eğitim": "Eğitim",
    "Sağlık": "Sağlık",
    "Yaşam Kalitesi": "Yaşam Kalitesi",
    "Kültür & Etkinlikler": "Kültür & Etkinlikler",
    "Kültürel Miras": "Kültürel Miras",
    "Asayiş & Güvenlik": "Asayiş & Güvenlik",
    "Radar & Trafik Denetim Haritası": "Radar & Trafik Denetim Haritası",
    "Acil Durum & Kriz": "Acil Durum & Kriz",
    "Yerel Yönetim": "Yerel Yönetim",
    "Muğla İl Protokol Listesi": "Muğla İl Protokol Listesi",

    // Top Summary Metric Cards
    "OTEL DOLULUK": "OTEL DOLULUK",
    "BARAJ": "BARAJ",
    "HAVA KALİTESİ": "HAVA KALİTESİ",
    "DEPREM": "DEPREM",
    "TRAFİK": "TRAFİK",
    "ELEKTRİK": "ELEKTRİK",
    "UÇUŞ": "UÇUŞ",
    "SU ÜRETİMİ": "SU ÜRETİMİ",
    "NÜFUS": "NÜFUS",
    "SICAKLIK": "SICAKLIK",
    "Turist/Yıl": "Turist/Yıl",
    "İşsizlik": "İşsizlik",
    "Hava": "Hava",
    "AQI": "AQI",
    "Baraj": "Baraj",

    // StatCard Labels
    "Sıcaklık": "Sıcaklık",
    "Nem": "Nem",
    "Rüzgar": "Rüzgar",
    "UV İndeksi": "UV İndeksi",
    "Deniz Suyu": "Deniz Suyu",
    "Durum": "Durum",
    "Yağış": "Yağış",
    "Turizm Geliri": "Turizm Geliri",
    "Yeni Şirket": "Yeni Şirket",
    "KOBİ Sayısı": "KOBİ Sayısı",
    "Ort. m² Fiyatı": "Ort. m² Fiyatı",
    "Yıllık Artış": "Yıllık Artış",
    "Konut Satış": "Konut Satış",
    "Amortisman Süresi": "Amortisman Süresi",
    "Ortalama Doluluk": "Ortalama Doluluk",
    "Aktif Baraj Sayısı": "Aktif Baraj Sayısı",
    "Toplam Kapasite": "Toplam Kapasite",
    "Kritik Baraj": "Kritik Baraj",
    "Yıllık Turist": "Yıllık Turist",
    "Ülke Sayısı": "Ülke Sayısı",
    "Havalimanı Yolcu": "Havalimanı Yolcu",
    "Kruvaziyer": "Kruvaziyer",
    "Otel Doluluk": "Otel Doluluk",
    "Sezon Doluluk": "Sezon Doluluk",
    "Otel Fiyat Ort.": "Otel Fiyat Ort.",
    "Toplam Yatak": "Toplam Yatak",
    "Ortalama Hız": "Ortalama Hız",
    "Ort. Yoğunluk": "Ort. Yoğunluk",
    "Ortalama Yoğunluk": "Ortalama Yoğunluk",
    "En Yoğun Bölge": "En Yoğun Bölge",
    "Kritik Bölge": "Kritik Bölge",
    "İzlenen İlçe": "İzlenen İlçe",
    "Günlük Tüketim": "Günlük Tüketim",
    "Kesinti (Ay)": "Kesinti (Ay)",
    "Yenilenebilir Pay": "Yenilenebilir Pay",
    "Karbon Ayak İzi": "Karbon Ayak İzi",
    "Geri Dönüşüm": "Geri Dönüşüm",
    "İnternet Erişimi": "İnternet Erişimi",
    "Toplam Bütçe": "Toplam Bütçe",
    "Gelir Bütçesi": "Gelir Bütçesi",
    "Gider Bütçesi": "Gider Bütçesi",
    "Gerçekleşme": "Gerçekleşme",
    "Bugün": "Bugün",
    "Otel Dol.": "Otel Dol.",
    "Plaj": "Plaj",
    "7g Zirve": "7g Zirve",
    "FWI Skoru": "FWI Skoru",
    "Tehlike Düzeyi": "Tehlike Düzeyi",

    // Column Layout & Actions
    "Sütun 1": "Sütun 1",
    "Sütun 2": "Sütun 2",
    "Sütun 3": "Sütun 3",
    "Gösterge": "Gösterge",
    "Düzeni Sıfırla": "Düzeni Sıfırla",
    "Göstergeyi buraya sürükleyin": "Göstergeyi buraya sürükleyin",
    "Genel Bakış İstihbarat Ekranı": "Genel Bakış İstihbarat Ekranı",
    "Ekranı Özelleştir": "📱 Ekranı Özelleştir",
    "Bitti (Koru)": "✓ Bitti (Koru)",

    // Common labels & badges
    "card.live": "CANLI",
    "card.estimate": "TAHMİN",
    "card.cached": "ÖNBELLEK",
    "card.static": "STATİK",
    "TAHMİN": "TAHMİN",
    "ÖNBELLEK": "ÖNBELLEK",
    "STATİK": "STATİK",
    "AKTİF": "AKTİF",
    "BEKLEYEN": "BEKLEYEN",
    "TAMAMLANDI": "TAMAMLANDI",
    "DEVAM": "DEVAM",
    "İZLENİYOR": "İZLENİYOR",
    "YÜKSEK": "YÜKSEK",
    "ORTA": "ORTA",
    "DÜŞÜK": "DÜŞÜK",
    "AŞIRI": "AŞIRI",
    "ÇOK DÜŞÜK": "ÇOK DÜŞÜK",
    "ÇOK YÜKSEK": "ÇOK YÜKSEK",
    "KRİTİK": "KRİTİK",
    "İYİ": "İYİ",
    "eski": "eski",
    "loading": "Yükleniyor...",
    "no_data": "Veri bulunamadı",
    "source": "Kaynak",
    "updated": "Güncellendi",
    "ago": "önce",
    "min": "dk",
    "hour": "sa",
    "day": "g",
    "just_now": "Az önce",
    "just_updated": "Yeni güncelleme (saniyeler)",
    "stale_data": "Eski veri",
    "free_real_source": "Ücretsiz gerçek kaynak",
    "paid_or_estimate": "Ücretli veya tahmini",
    "unknown": "Bilinmiyor",

    // Weather Conditions
    "Açık": "Açık",
    "Güneşli": "Güneşli",
    "Az Bulutlu": "Az Bulutlu",
    "Parçalı Bulutlu": "Parçalı Bulutlu",
    "Çok Bulutlu": "Çok Bulutlu",
    "Yağmurlu": "Yağmurlu",
    "Hafif Yağmurlu": "Hafif Yağmurlu",
    "Kuvvetli Yağmurlu": "Kuvvetli Yağmurlu",
    "Gök Gürültülü Sağanak": "Gök Gürültülü Sağanak",
    "Sisli": "Sisli",
    "Fırtınalı": "Fırtınalı",
    "Kar Yağışlı": "Kar Yağışlı",

    // Air Quality levels
    "İyi": "İyi",
    "Orta": "Orta",
    "Hassas": "Hassas",
    "Sağlıksız": "Sağlıksız",
    "Kötü": "Kötü",
    "Tehlikeli": "Tehlikeli",

    // Units
    "Milyar ₺": "Milyar ₺",
    "Milyon ₺": "Milyon ₺",
    "₺/gece": "₺/gece",
    "TL/m²": "TL/m²",
    "ton/kişi": "ton/kişi",
    "gemi": "gemi",
    "tesis": "tesis",
    "kişi": "kişi",
    "adet": "adet",

    // AI Summary Cards
    "Şehir Nabzı": "Şehir Nabzı",
    "Günlük AI Özeti": "Günlük AI Özeti",
    "Kamuoyu Özeti": "Kamuoyu Özeti",
    "Deprem Risk Özeti": "Deprem Risk Özeti",
    "Hava Durumu Özeti": "Hava Durumu Özeti",
    "Canlı Şehir Nabzı": "Canlı Şehir Nabzı",
    "Yenile": "Yenile",

    // Notification
    "notif.title": "Bildirim Tercihleri",
    "notif.enable": "Bildirimleri Etkinleştir",
    "notif.earthquake": "Deprem Uyarıları (M3+)",
    "notif.fire": "Yüksek Yangın Riski",
    "notif.flood": "Sel / Taşkın",
    "notif.social": "Sosyal Medya Krizi",
    "notif.daily": "Günlük Özet",

    // Earthquake
    "quake.title": "Deprem Uyarısı",
    "quake.mag": "Büyüklük",
    "quake.depth": "Derinlik",
    "quake.distance": "Uzaklık",

    // Sektörler
    "Turizm & Hizmet": "Turizm & Hizmet",
    "Tarım": "Tarım",
    "İnşaat": "İnşaat",
    "Sanayi": "Sanayi",
    "Güneş Santrali": "Güneş Santrali",
    "Rüzgar Santrali": "Rüzgar Santrali",
    "Jeotermal": "Jeotermal",
  },

  en: {
    // Navigation & Header
    "nav.genel": "Overview",
    "nav.ekonomi": "Economy",
    "nav.cevre": "Environment",
    "nav.turizm": "Tourism",
    "nav.ulasim": "Transport",
    "nav.guvenlik": "Security",
    "nav.sosyal": "Social",
    "nav.enerji": "Energy",
    "nav.protokol": "Muğla Protocol",
    "nav.osint": "OSINT",
    "nav.ilceler": "Districts",
    "Genel Bakış": "Overview",
    "Ekonomi": "Economy",
    "Çevre": "Environment",
    "Turizm": "Tourism",
    "Ulaşım": "Transport",
    "Güvenlik": "Security",
    "Sosyal": "Social",
    "Enerji": "Energy",
    "Muğla Protokol": "Muğla Protocol",
    "OSINT": "OSINT",
    "İlçeler": "Districts",
    "Bölgesel İstihbarat Paneli": "Regional Intelligence Hub",
    "CANLI": "LIVE",
    "KAYNAK": "SOURCES",
    "SON GÜNCELLEME": "LAST UPDATE",

    // Panel Registry Titles (Index.tsx)
    "Trafik Yoğunluk Haritası": "Traffic Density Map",
    "Hava & İklim": "Weather & Climate",
    "Hava Kalitesi (AQI)": "Air Quality (AQI)",
    "Yangın Riski Göstergesi": "Wildfire Risk Index",
    "Orman Yangın Risk Göstergesi": "Forest Fire Risk Index",
    "Su & Barajlar": "Water & Dams",
    "Ekonomi & İstihdam": "Economy & Employment",
    "Gayrimenkul & İlanlar": "Real Estate & Listings",
    "Tarım & Üretim": "Agriculture & Production",
    "Yerel Yönetim Bütçeleri": "Local Government Budgets",
    "Turizm Tahmin Modeli": "Tourism Forecast Model",
    "Turizm Hareketliliği": "Tourism Movement",
    "Konaklama & Oteller": "Accommodation & Hotels",
    "Konaklama": "Accommodation",
    "Ziyaretçi Profili": "Visitor Profile",
    "Muğla Gastronomisi": "Muğla Gastronomy",
    "Canlı Uçuş Takibi": "Live Flight Tracker",
    "Ulaşım & Trafik Özeti": "Transport & Traffic Summary",
    "Ulaşım & Trafik Akışı": "Transport & Traffic Flow",
    "Havalimanları (DLM/BJV)": "Airports (DLM/BJV)",
    "Yol & Altyapı Projeleri": "Road & Infrastructure Projects",
    "Şehirlerarası Otobüs Seferleri": "Intercity Bus Schedules",
    "Enerji & Tüketim": "Energy & Consumption",
    "Yenilenebilir Enerji": "Renewable Energy",
    "Sürdürülebilirlik": "Sustainability",
    "Sosyal İstihbarat": "Social Intelligence",
    "Gündemdeki Başlıklar": "Trending Topics",
    "Nüfus & Demografi": "Population & Demographics",
    "Eğitim": "Education",
    "Sağlık": "Healthcare",
    "Yaşam Kalitesi": "Quality of Life",
    "Kültür & Etkinlikler": "Culture & Events",
    "Kültürel Miras": "Cultural Heritage",
    "Asayiş & Güvenlik": "Public Security & Safety",
    "Radar & Trafik Denetim Haritası": "Speed Camera & Traffic Inspection Map",
    "Acil Durum & Kriz": "Emergency & Crisis",
    "Yerel Yönetim": "Local Governance",
    "Muğla İl Protokol Listesi": "Muğla Provincial Protocol",

    // Top Summary Metric Cards
    "OTEL DOLULUK": "HOTEL OCCUPANCY",
    "BARAJ": "DAMS",
    "HAVA KALİTESİ": "AIR QUALITY",
    "DEPREM": "EARTHQUAKES",
    "TRAFİK": "TRAFFIC",
    "ELEKTRİK": "POWER GRID",
    "UÇUŞ": "FLIGHTS",
    "SU ÜRETİMİ": "WATER SUPPLY",
    "NÜFUS": "POPULATION",
    "SICAKLIK": "TEMPERATURE",
    "Turist/Yıl": "Tourists/Yr",
    "İşsizlik": "Unemployment",
    "Hava": "Weather",
    "AQI": "AQI",
    "Baraj": "Dams",

    // StatCard Labels
    "Sıcaklık": "Temperature",
    "Nem": "Humidity",
    "Rüzgar": "Wind",
    "UV İndeksi": "UV Index",
    "Deniz Suyu": "Sea Temp",
    "Durum": "Condition",
    "Yağış": "Rainfall",
    "Turizm Geliri": "Tourism Revenue",
    "Yeni Şirket": "New Companies",
    "KOBİ Sayısı": "SME Count",
    "Ort. m² Fiyatı": "Avg. m² Price",
    "Yıllık Artış": "Annual Growth",
    "Konut Satış": "Housing Sales",
    "Amortisman Süresi": "Payback Period",
    "Ortalama Doluluk": "Average Occupancy",
    "Aktif Baraj Sayısı": "Active Dams",
    "Toplam Kapasite": "Total Capacity",
    "Kritik Baraj": "Critical Dam",
    "Yıllık Turist": "Annual Tourists",
    "Ülke Sayısı": "Origin Countries",
    "Havalimanı Yolcu": "Airport Passengers",
    "Kruvaziyer": "Cruise Ships",
    "Otel Doluluk": "Hotel Occupancy",
    "Sezon Doluluk": "Peak Occupancy",
    "Otel Fiyat Ort.": "Avg. Hotel Rate",
    "Toplam Yatak": "Total Beds",
    "Ortalama Hız": "Average Speed",
    "Ort. Yoğunluk": "Avg. Congestion",
    "Ortalama Yoğunluk": "Average Congestion",
    "En Yoğun Bölge": "Densest District",
    "Kritik Bölge": "Critical District",
    "İzlenen İlçe": "Monitored Districts",
    "Günlük Tüketim": "Daily Consumption",
    "Kesinti (Ay)": "Outages (Month)",
    "Yenilenebilir Pay": "Renewable Share",
    "Karbon Ayak İzi": "Carbon Footprint",
    "Geri Dönüşüm": "Recycling Rate",
    "İnternet Erişimi": "Internet Access",
    "Toplam Bütçe": "Total Budget",
    "Gelir Bütçesi": "Revenue Budget",
    "Gider Bütçesi": "Expenditure Budget",
    "Gerçekleşme": "Realization",
    "Bugün": "Today",
    "Otel Dol.": "Hotel Occ.",
    "Plaj": "Beach",
    "7g Zirve": "7d Peak",
    "FWI Skoru": "FWI Score",
    "Tehlike Düzeyi": "Danger Level",

    // Column Layout & Actions
    "Sütun 1": "Column 1",
    "Sütun 2": "Column 2",
    "Sütun 3": "Column 3",
    "Gösterge": "Widgets",
    "Düzeni Sıfırla": "Reset Layout",
    "Göstergeyi buraya sürükleyin": "Drag widget here",
    "Genel Bakış İstihbarat Ekranı": "Overview Intelligence Dashboard",
    "Ekranı Özelleştir": "📱 Customize Layout",
    "Bitti (Koru)": "✓ Done (Save)",
    "Muğla Monitör · Şehir Bilgi Platformu": "Muğla Monitor · City Information Platform",
    "Haber Doğrulama": "News Verification",
    "Haber Doğrulama Merkezi": "News Verification Center",
    "Yerel haberler, sosyal medya paylaşımları ve resmi açıklamaları karşılaştırarak doğruluğunu gösterir.": "Compare local news, social media posts, and official statements to assess credibility.",
    "13 İlçe Bağlantı Haritası": "13-District Connection Map",
    "CANLI OSINT DİYAGRAMI": "LIVE OSINT DIAGRAM",
    "İstihbarat & Dedektif Masası İlişki Ağı": "Intelligence & Detective Desk Relationship Network",
    "Çapraz Teyit & İddia Zinciri": "Cross-Verification & Claim Chain",
    "Çelişki / Yalanlama": "Contradiction / Rebuttal",
    "Sıra": "Rank",
    "Muğla Valiliği resmi protokol kaynağından güncelliği sorgula": "Check the official Muğla Governorship protocol source for updates",
    "Düzeni Özelleştir": "Customize Layout",
    "Sürüklemek için bu başlıktan tutun": "Drag from this header",
    "Sola / Önceki sütuna taşı": "Move left / previous column",
    "Yukarı taşı": "Move up",
    "Aşağı taşı": "Move down",
    "Sağa / Sonraki sütuna taşı": "Move right / next column",
    "Doğrudan sütun seç": "Select column directly",
    "Buraya Yerleştir": "Place here",
    "Sistem Durumu": "System Status",
    "Güncelliği Denetle": "Check for updates",
    "Denetleniyor...": "Checking...",
    "Kasım 2026 Doğrulandı": "Verified November 2026",
    "Toplam": "Total",
    "kayıt listeleniyor": "records listed",
    "Kişi": "People",
    "kişi": "people",
    "Tümünü Aç": "Expand All",
    "Tümünü Kapat": "Collapse All",
    "Vaka": "Case",
    "Bölge": "Region",
    "Doğrulama Sonucu": "Verification Result",
    "DOĞRULAMA SONUCU": "VERIFICATION RESULT",
    "Çapraz Sorgula": "Cross-Verify",
    "Sorgulanıyor...": "Verifying...",
    "Örnek Konular": "Sample Topics",
    "Tutanağı Kopyala": "Copy Record",
    "Kopyalandı": "Copied",
    "Sıfırla": "Reset",
    "Vurguyu Kaldır": "Remove Highlight",
    "Düğümleri İlk Konumuna Getir": "Reset nodes to initial positions",
    "Düğüm Türü": "Node Type",
    "Tümü": "All",
    "Kırmızı İpler": "Red Threads",
    "Kesikli İpler": "Dashed Threads",
    "İLİŞKİ TESPİTİ:": "RELATIONSHIP DETECTED:",
    "Güvenilirlik": "Reliability",
    "Kaynak": "Source",
    "HABER DOĞRULAMA KONSOLU": "NEWS VERIFICATION CONSOLE",
    "Yerel Haberler · Sosyal Medya · Resmi Açıklamalar": "Local News · Social Media · Official Statements",
    "Sorgulamak istediğiniz kulis dedikodusu, şüpheli haber veya iddiayı yazın...": "Enter the rumor, suspicious report, or claim you want to verify...",
    "DOĞRULAMA SONUCU": "VERIFICATION RESULT",
    "Çapraz Teyitte Saptanan Çelişkiler": "Contradictions Found in Cross-Verification",
    "Kaynak Güvenilirlik & Kanıt Zinciri": "Source Reliability & Evidence Chain",
    "Delil": "Evidence",
    "Sorgu Odası Transkripti (Tarafların İfadeleri)": "Interrogation Room Transcript (Statements)",
    "RESMİ ZABIT": "OFFICIAL RECORD",
    "ÖNERİLEN İSTİHBARİ AKSİYON:": "RECOMMENDED INTELLIGENCE ACTION:",
    "13 İlçe Bağlantı Haritası": "13-District Connection Map",
    "Güncel Konu": "Current Topic",
    "Aramak için tıklayın": "Click to call",
    "İsim, unvan (örn. Kaymakam, Başsavcı, Rektör) veya kategori ara...": "Search by name, title (e.g. District Governor, Chief Prosecutor, Rector), or category...",
    "Toplam ": "Total ",
    " kayıt listeleniyor": " records listed",
    "Arama kriterine uygun protokol üyesi bulunamadı.": "No protocol member matches your search.",

    // Common labels & badges
    "Diyagram": "Diagram",
    "Sorgu Odası": "Interrogation Room",
    "Kamu Kurumları Ağı": "Public Institution Network",
    "Muğla İstihbarat & Çapraz Sorgu Odası": "Muğla Intelligence & Cross-Verification Room",
    "OSINT & KULİS ANALİZİ": "OSINT & RUMOR ANALYSIS",
    "Sorgu Odası & Kulis Ağı": "Interrogation Room & Network",
    "Altyapı Projeleri": "Infrastructure Projects",
    "HABER TAKİBİ": "NEWS TRACKING",
    "HABER + SAHA İHBARI": "NEWS + FIELD REPORTS",
    "ŞANTİYE RİSKİ": "CONSTRUCTION RISK",
    "NORMAL": "NORMAL",
    "BİLDİRİM MERKEZİ": "NOTIFICATION CENTER",
    "Canlı Çapraz Doğrulama Akışı": "Live Cross-Verification Stream",
    "Otonom Nabız": "Autonomous Pulse",
    "card.live": "LIVE",
    "card.estimate": "ESTIMATE",
    "card.cached": "CACHED",
    "card.static": "STATIC",
    "TAHMİN": "ESTIMATE",
    "ÖNBELLEK": "CACHED",
    "STATİK": "STATIC",
    "AKTİF": "ACTIVE",
    "BEKLEYEN": "PENDING",
    "TAMAMLANDI": "COMPLETED",
    "DEVAM": "IN PROGRESS",
    "İZLENİYOR": "MONITORED",
    "YÜKSEK": "HIGH",
    "ORTA": "MODERATE",
    "DÜŞÜK": "LOW",
    "AŞIRI": "EXTREME",
    "ÇOK DÜŞÜK": "VERY LOW",
    "ÇOK YÜKSEK": "VERY HIGH",
    "KRİTİK": "CRITICAL",
    "İYİ": "GOOD",
    "eski": "stale",
    "loading": "Loading...",
    "no_data": "No data found",
    "source": "Source",
    "updated": "Updated",
    "ago": "ago",
    "min": "m",
    "hour": "h",
    "day": "d",
    "just_now": "Just now",
    "just_updated": "Just updated (seconds)",
    "stale_data": "Outdated data",
    "free_real_source": "Verified free source",
    "paid_or_estimate": "Estimated / synthetic",
    "unknown": "Unknown",

    // Weather Conditions
    "Açık": "Clear / Sunny",
    "Güneşli": "Sunny",
    "Az Bulutlu": "Partly Sunny",
    "Parçalı Bulutlu": "Partly Cloudy",
    "Çok Bulutlu": "Overcast",
    "Yağmurlu": "Rainy",
    "Hafif Yağmurlu": "Light Rain",
    "Kuvvetli Yağmurlu": "Heavy Rain",
    "Gök Gürültülü Sağanak": "Thunderstorms",
    "Sisli": "Foggy",
    "Fırtınalı": "Stormy",
    "Kar Yağışlı": "Snowy",

    // Air Quality levels
    "İyi": "Good",
    "Orta": "Moderate",
    "Hassas": "Sensitive",
    "Sağlıksız": "Unhealthy",
    "Kötü": "Poor",
    "Tehlikeli": "Hazardous",

    // Units
    "Milyar ₺": "Bn ₺",
    "Milyon ₺": "M ₺",
    "₺/gece": "₺/night",
    "TL/m²": "TL/m²",
    "ton/kişi": "tons/capita",
    "gemi": "ships",
    "tesis": "facilities",
    "kişi": "people",
    "adet": "units",

    // AI Summary Cards
    "Şehir Nabzı": "City Pulse",
    "Günlük AI Özeti": "Daily AI Summary",
    "Kamuoyu Özeti": "Public Opinion Summary",
    "Deprem Risk Özeti": "Earthquake Risk Summary",
    "Hava Durumu Özeti": "Weather Summary",
    "Canlı Şehir Nabzı": "Live City Pulse",
    "Yenile": "Refresh",

    // Notification
    "notif.title": "Notification Preferences",
    "notif.enable": "Enable Notifications",
    "notif.earthquake": "Earthquake Alerts (M3+)",
    "notif.fire": "High Wildfire Risk",
    "notif.flood": "Flood Warning",
    "notif.social": "Social Media Crisis",
    "notif.daily": "Daily Summary",

    // Earthquake
    "quake.title": "Earthquake Alert",
    "quake.mag": "Magnitude",
    "quake.depth": "Depth",
    "quake.distance": "Distance",

    // Sektörler
    "Turizm & Hizmet": "Tourism & Services",
    "Tarım": "Agriculture",
    "İnşaat": "Construction",
    "Sanayi": "Industry",
    "Güneş Santrali": "Solar Power Plants",
    "Rüzgar Santrali": "Wind Power Plants",
    "Jeotermal": "Geothermal",
  },

  de: {
    // Navigation & Header
    "nav.genel": "Übersicht",
    "nav.ekonomi": "Wirtschaft",
    "nav.cevre": "Umwelt",
    "nav.turizm": "Tourismus",
    "nav.ulasim": "Verkehr",
    "nav.guvenlik": "Sicherheit",
    "nav.sosyal": "Soziales",
    "nav.enerji": "Energie",
    "nav.protokol": "Muğla Protokoll",
    "nav.osint": "OSINT",
    "nav.ilceler": "Bezirke",
    "Genel Bakış": "Übersicht",
    "Ekonomi": "Wirtschaft",
    "Çevre": "Umwelt",
    "Turizm": "Tourismus",
    "Ulaşım": "Verkehr",
    "Güvenlik": "Sicherheit",
    "Sosyal": "Soziales",
    "Enerji": "Energie",
    "Muğla Protokol": "Muğla Protokoll",
    "OSINT": "OSINT",
    "İlçeler": "Bezirke",
    "Bölgesel İstihbarat Paneli": "Regionales Lagezentrum",
    "CANLI": "LIVE",
    "KAYNAK": "QUELLEN",
    "SON GÜNCELLEME": "LETZTE AKTUALISIERUNG",

    // Panel Registry Titles (Index.tsx)
    "Trafik Yoğunluk Haritası": "Verkehrsdichte-Karte",
    "Hava & İklim": "Wetter & Klima",
    "Hava Kalitesi (AQI)": "Luftqualität (AQI)",
    "Yangın Riski Göstergesi": "Waldbrand-Risikoindex",
    "Orman Yangın Risk Göstergesi": "Waldbrand-Gefahrenindex",
    "Su & Barajlar": "Wasser & Staudämme",
    "Ekonomi & İstihdam": "Wirtschaft & Beschäftigung",
    "Gayrimenkul & İlanlar": "Immobilien & Angebote",
    "Tarım & Üretim": "Landwirtschaft & Produktion",
    "Yerel Yönetim Bütçeleri": "Kommunalhaushalte",
    "Turizm Tahmin Modeli": "Tourismus-Prognosemodell",
    "Turizm Hareketliliği": "Tourismusbewegung",
    "Konaklama & Oteller": "Unterkünfte & Hotels",
    "Konaklama": "Unterkunft",
    "Ziyaretçi Profili": "Besucherprofil",
    "Muğla Gastronomisi": "Muğla Gastronomie",
    "Canlı Uçuş Takibi": "Live-Flugverfolgung",
    "Ulaşım & Trafik Özeti": "Verkehrs- & Transportübersicht",
    "Ulaşım & Trafik Akışı": "Verkehrsfluss & Mobilität",
    "Havalimanları (DLM/BJV)": "Flughäfen (DLM/BJV)",
    "Yol & Altyapı Projeleri": "Straßen- & Infrastrukturprojekte",
    "Şehirlerarası Otobüs Seferleri": "Fernbus-Fahrpläne",
    "Enerji & Tüketim": "Energie & Verbrauch",
    "Yenilenebilir Enerji": "Erneuerbare Energien",
    "Sürdürülebilirlik": "Nachhaltigkeit",
    "Sosyal İstihbarat": "Soziale Intelligenz",
    "Gündemdeki Başlıklar": "Trending Topics",
    "Nüfus & Demografi": "Bevölkerung & Demografie",
    "Eğitim": "Bildung",
    "Sağlık": "Gesundheitswesen",
    "Yaşam Kalitesi": "Lebensqualität",
    "Kültür & Etkinlikler": "Kultur & Veranstaltungen",
    "Kültürel Miras": "Kulturerbe",
    "Asayiş & Güvenlik": "Öffentliche Sicherheit",
    "Radar & Trafik Denetim Haritası": "Radar- & Verkehrskontrollkarte",
    "Acil Durum & Kriz": "Notfall & Krise",
    "Yerel Yönetim": "Kommunalverwaltung",
    "Muğla İl Protokol Listesi": "Muğla Protokollliste",

    // Top Summary Metric Cards
    "OTEL DOLULUK": "HOTELBELEGUNG",
    "BARAJ": "STAUDÄMME",
    "HAVA KALİTESİ": "LUFTQUALITÄT",
    "DEPREM": "ERDBEBEN",
    "TRAFİK": "VERKEHR",
    "ELEKTRİK": "STROMNETZ",
    "UÇUŞ": "FLÜGE",
    "SU ÜRETİMİ": "WASSERVERSORGUNG",
    "NÜFUS": "BEVÖLKERUNG",
    "SICAKLIK": "TEMPERATUR",
    "Turist/Yıl": "Touristen/J.",
    "İşsizlik": "Arbeitslosigkeit",
    "Hava": "Wetter",
    "AQI": "AQI",
    "Baraj": "Dämme",

    // StatCard Labels
    "Sıcaklık": "Temperatur",
    "Nem": "Luftfeuchtigkeit",
    "Rüzgar": "Wind",
    "UV İndeksi": "UV-Index",
    "Deniz Suyu": "Wassertemperatur",
    "Durum": "Zustand",
    "Yağış": "Niederschlag",
    "Turizm Geliri": "Tourismuseinnahmen",
    "Yeni Şirket": "Neue Unternehmen",
    "KOBİ Sayısı": "KMU-Anzahl",
    "Ort. m² Fiyatı": "Durchschnitts-m²-Preis",
    "Yıllık Artış": "Jährlicher Anstieg",
    "Konut Satış": "Immobilienverkäufe",
    "Amortisman Süresi": "Amortisationszeit",
    "Ortalama Doluluk": "Durchschn. Füllstand",
    "Aktif Baraj Sayısı": "Aktive Staudämme",
    "Toplam Kapasite": "Gesamtkapazität",
    "Kritik Baraj": "Kritischer Damm",
    "Yıllık Turist": "Jährliche Touristen",
    "Ülke Sayısı": "Herkunftsländer",
    "Havalimanı Yolcu": "Flughafenpassagiere",
    "Kruvaziyer": "Kreuzfahrtschiffe",
    "Otel Doluluk": "Hotelbelegung",
    "Sezon Doluluk": "Saisonauslastung",
    "Otel Fiyat Ort.": "Durchschn. Hotelpreis",
    "Toplam Yatak": "Gesamte Betten",
    "Ortalama Hız": "Durchschnittstempo",
    "Ort. Yoğunluk": "Durchschn. Dichte",
    "Ortalama Yoğunluk": "Durchschnittliche Dichte",
    "En Yoğun Bölge": "Dichteste Zone",
    "Kritik Bölge": "Kritische Zone",
    "İzlenen İlçe": "Überwachte Bezirke",
    "Günlük Tüketim": "Täglicher Verbrauch",
    "Kesinti (Ay)": "Ausfälle (Monat)",
    "Yenilenebilir Pay": "Erneuerbarer Anteil",
    "Karbon Ayak İzi": "CO2-Fußabdruck",
    "Geri Dönüşüm": "Recyclingquote",
    "İnternet Erişimi": "Internetzugang",
    "Toplam Bütçe": "Gesamtbudget",
    "Gelir Bütçesi": "Einnahmenbudget",
    "Gider Bütçesi": "Ausgabenbudget",
    "Gerçekleşme": "Erfüllung",
    "Bugün": "Heute",
    "Otel Dol.": "Hotelbel.",
    "Plaj": "Strand",
    "7g Zirve": "7T-Spitze",
    "FWI Skoru": "FWI-Wert",
    "Tehlike Düzeyi": "Gefahrenstufe",

    // Column Layout & Actions
    "Sütun 1": "Spalte 1",
    "Sütun 2": "Spalte 2",
    "Sütun 3": "Spalte 3",
    "Gösterge": "Widgets",
    "Düzeni Sıfırla": "Layout zurücksetzen",
    "Göstergeyi buraya sürükleyin": "Widget hierher ziehen",
    "Genel Bakış İstihbarat Ekranı": "Übersicht Lagezentrum",
    "Ekranı Özelleştir": "📱 Layout anpassen",
    "Bitti (Koru)": "✓ Fertig (Speichern)",

    // Common labels & badges
    "card.live": "LIVE",
    "card.estimate": "SCHÄTZUNG",
    "card.cached": "CACHE",
    "card.static": "STATISCH",
    "TAHMİN": "SCHÄTZUNG",
    "ÖNBELLEK": "CACHE",
    "STATİK": "STATISCH",
    "AKTİF": "AKTIV",
    "BEKLEYEN": "AUSSTEHEND",
    "TAMAMLANDI": "ABGESCHLOSSEN",
    "DEVAM": "IN ARBEIT",
    "İZLENİYOR": "ÜBERWACHT",
    "YÜKSEK": "HOCH",
    "ORTA": "MITTEL",
    "DÜŞÜK": "NIEDRIG",
    "AŞIRI": "EXTREM",
    "ÇOK DÜŞÜK": "SEHR NIEDRIG",
    "ÇOK YÜKSEK": "SEHR HOCH",
    "KRİTİK": "KRITISCH",
    "İYİ": "GUT",
    "eski": "veraltet",
    "loading": "Wird geladen...",
    "no_data": "Keine Daten gefunden",
    "source": "Quelle",
    "updated": "Aktualisiert",
    "ago": "vor",
    "min": "Min",
    "hour": "Std",
    "day": "T",
    "just_now": "Gerade eben",
    "just_updated": "Neu aktualisiert (Sekunden)",
    "stale_data": "Veraltete Daten",
    "free_real_source": "Geprüfte kostenlose Quelle",
    "paid_or_estimate": "Geschätzt / synthetisch",
    "unknown": "Unbekannt",

    // Weather Conditions
    "Açık": "Klar / Sonnig",
    "Güneşli": "Sonnig",
    "Az Bulutlu": "Leicht bewölkt",
    "Parçalı Bulutlu": "Teilweise bewölkt",
    "Çok Bulutlu": "Bedeckt",
    "Yağmurlu": "Regnerisch",
    "Hafif Yağmurlu": "Leichter Regen",
    "Kuvvetli Yağmurlu": "Starker Regen",
    "Gök Gürültülü Sağanak": "Gewitter",
    "Sisli": "Neblig",
    "Fırtınalı": "Stürmisch",
    "Kar Yağışlı": "Schneefall",

    // Air Quality levels
    "İyi": "Gut",
    "Orta": "Mäßig",
    "Hassas": "Sensibel",
    "Sağlıksız": "Ungesund",
    "Kötü": "Schlecht",
    "Tehlikeli": "Gefährlich",

    // Units
    "Milyar ₺": "Mrd. ₺",
    "Milyon ₺": "Mio. ₺",
    "₺/gece": "₺/night",
    "TL/m²": "TL/m²",
    "ton/kişi": "tons/capita",
    "gemi": "ships",
    "tesis": "facilities",
    "kişi": "people",
    "adet": "units",

    // AI Summary Cards
    "Şehir Nabzı": "Stadtpuls",
    "Günlük AI Özeti": "Tägliche AI-Zusammenfassung",
    "Kamuoyu Özeti": "Öffentliche Meinung",
    "Deprem Risk Özeti": "Erdbebenrisiko-Zusammenfassung",
    "Hava Durumu Özeti": "Wetterbericht",
    "Canlı Şehir Nabzı": "Live-Stadtpuls",
    "Yenile": "Aktualisieren",

    // Notification
    "notif.title": "Benachrichtigungseinstellungen",
    "notif.enable": "Benachrichtigungen aktivieren",
    "notif.earthquake": "Erdbebenwarnungen (M3+)",
    "notif.fire": "Hohes Waldbrandrisiko",
    "notif.flood": "Hochwasser-Warnung",
    "notif.social": "Social-Media-Krisenwarnung",
    "notif.daily": "Tägliche Zusammenfassung",

    // Earthquake
    "quake.title": "Erdbebenwarnung",
    "quake.mag": "Stärke",
    "quake.depth": "Tiefe",
    "quake.distance": "Entfernung",

    // Sektörler
    "Turizm & Hizmet": "Tourismus & Dienstleistungen",
    "Tarım": "Landwirtschaft",
    "İnşaat": "Baugewerbe",
    "Sanayi": "Industrie",
    "Güneş Santrali": "Solaranlagen",
    "Rüzgar Santrali": "Windkraftanlagen",
    "Jeotermal": "Geothermie",
  },
};

// 2. Dynamic sentence / text translation engine
// Replaces multi-word phrases, keywords, dates, and common metrics in unstructured text
const PHRASE_REPLACEMENTS: { [k in Exclude<Language, "tr">]: [RegExp, string][] } = {
  en: [
    // Multi-word phrases first
    [/Düzeni Özelleştir/gi, "Customize Layout"],
    [/Düzeni Sıfırla/gi, "Reset Layout"],
    [/Tümünü Aç/gi, "Expand All"],
    [/Tümünü Kapat/gi, "Collapse All"],
    [/Güncelliği Denetle/gi, "Check for updates"],
    [/Denetleniyor.../gi, "Checking..."],
    [/Kayıt listeleniyor/gi, "records listed"],
    [/Arama kriterine uygun protokol üyesi bulunamadı./gi, "No protocol member matches your search."],
    [/Güncel Konu/gi, "Current Topic"],
    [/Kırmızı İpler/gi, "Red Threads"],
    [/Kesikli İpler/gi, "Dashed Threads"],
    [/Kültür ve Turizm Bakanlığı/gi, "Ministry of Culture and Tourism"],
    [/TÜİK İşgücü İstatistikleri/gi, "TurkStat Labor Statistics"],
    [/Orman Genel Müdürlüğü/gi, "General Directorate of Forestry"],
    [/AFAD uyarılarını takip edin/gi, "follow AFAD emergency alerts"],
    [/15 dakikada bir güncellenir/gi, "updated every 15 minutes"],
    [/30 dakikada bir güncellenir/gi, "updated every 30 minutes"],
    [/Günlük güncellenir/gi, "updated daily"],
    [/Değişim yıllık bazdadır/gi, "Change is on an annual basis"],
    [/Muğla geneli/gi, "Across Muğla"],
    [/Muğla genelinde/gi, "Across Muğla"],
    [/Canlı Şehir Nabzı/gi, "Live City Pulse"],
    [/Trafik yoğunluğu/gi, "Traffic congestion"],
    [/Hava sıcaklığı/gi, "Air temperature"],
    [/Deprem aktivitesi/gi, "Earthquake activity"],
    [/Baraj doluluk oranı/gi, "Dam occupancy rate"],
    [/Otel doluluk oranı/gi, "Hotel occupancy rate"],
    [/sezon ortalaması/gi, "season average"],
    [/Yangın riski/gi, "Wildfire risk"],
    [/Yüksek yangın riski/gi, "High wildfire risk"],
    [/Hava kalitesi/gi, "Air quality"],
    [/Son 24 saat/gi, "Last 24 hours"],
    [/dakika önce/gi, "minutes ago"],
    [/saat önce/gi, "hours ago"],
    [/gün önce/gi, "days ago"],
    [/Az önce/gi, "Just now"],
    [/stabil seyrediyor/gi, "is stable"],
    [/normal seviyede/gi, "at normal level"],
    [/dikkat çekiyor/gi, "stands out"],
    [/tespit edildi/gi, "detected"],
    [/kaydedildi/gi, "recorded"],
    [/bekleniyor/gi, "expected"],
  ],
  de: [
    [/Kültür ve Turizm Bakanlığı/gi, "Ministerium für Kultur und Tourismus"],
    [/TÜİK İşgücü İstatistikleri/gi, "TurkStat Arbeitsmarktstatistik"],
    [/Orman Genel Müdürlüğü/gi, "Generaldirektion für Forstwesen"],
    [/AFAD uyarılarını takip edin/gi, "Bitte AFAD-Warnungen beachten"],
    [/15 dakikada bir güncellenir/gi, "alle 15 Minuten aktualisiert"],
    [/30 dakikada bir güncellenir/gi, "alle 30 Minuten aktualisiert"],
    [/Günlük güncellenir/gi, "täglich aktualisiert"],
    [/Değişim yıllık bazdadır/gi, "Veränderung auf Jahresbasis"],
    [/Muğla geneli/gi, "In ganz Muğla"],
    [/Muğla genelinde/gi, "Im gesamten Muğla-Gebiet"],
    [/Canlı Şehir Nabzı/gi, "Live-Stadtpuls"],
    [/Trafik yoğunluğu/gi, "Verkehrsdichte"],
    [/Hava sıcaklığı/gi, "Lufttemperatur"],
    [/Deprem aktivitesi/gi, "Erdbebenaktivität"],
    [/Baraj doluluk oranı/gi, "Staudamm-Füllstand"],
    [/Otel doluluk oranı/gi, "Hotelbelegungsrate"],
    [/sezon ortalaması/gi, "Saisondurchschnitt"],
    [/Yangın riski/gi, "Waldbrandrisiko"],
    [/Yüksek yangın riski/gi, "Hohes Waldbrandrisiko"],
    [/Hava kalitesi/gi, "Luftqualität"],
    [/Son 24 saat/gi, "Letzte 24 Stunden"],
    [/dakika önce/gi, "Minuten her"],
    [/saat önce/gi, "Stunden her"],
    [/gün önce/gi, "Tagen her"],
    [/Az önce/gi, "Gerade eben"],
    [/stabil seyrediyor/gi, "bleibt stabil"],
    [/normal seviyede/gi, "auf normalem Niveau"],
    [/dikkat çekiyor/gi, "fällt auf"],
    [/tespit edildi/gi, "festgestellt"],
    [/kaydedildi/gi, "erfasst"],
    [/bekleniyor/gi, "erwartet"],
  ],
};

// Translate unstructured paragraph or sentence safely
export function translateText(text: any, lang: Language): string {
  if (text === null || text === undefined) return "";
  if (typeof text !== "string") return String(text);
  if (!text.trim() || lang === "tr") return text;

  const clean = text.trim();
  // 1. Direct match in dictionary
  if (translations[lang]?.[clean]) return translations[lang][clean];
  if (translations[lang]?.[text]) return translations[lang][text];

  // 2. Apply regex phrase replacements
  let res = text;
  const list = PHRASE_REPLACEMENTS[lang];
  if (list) {
    for (const [pattern, repl] of list) {
      res = res.replace(pattern, repl);
    }
  }

  // 3. Fallback check for single word replacements inside dictionary
  const dict = translations[lang];
  if (dict) {
    // If exact trimmed key exists after regex
    if (dict[res.trim()]) return dict[res.trim()];
  }

  return res;
}

// Context types
interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: any, fallback?: string) => string;
  translate: (text: any) => string;
}

export const I18nContext = createContext<I18nContextType>({
  lang: "tr",
  setLang: () => {},
  t: (k) => (typeof k === "string" ? k : String(k ?? "")),
  translate: (t) => (typeof t === "string" ? t : String(t ?? "")),
});

const LANG_KEY = "mugla-lang";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const a11y = useOptionalAccessibility();
  const isCitizenMode = a11y?.isCitizenMode ?? false;

  // Varsayılan açılış dili her zaman TR'dir; yalnızca kullanıcının kaydettiği tercih okunur.
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY) as Language | null;
      if (stored && ["tr", "en", "de"].includes(stored)) return stored;
    } catch {}
    return "tr";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
      if (typeof document !== "undefined") {
        document.documentElement.lang = l;
      }
    } catch {}
  };

  const value = useMemo(() => {
    const maybeSimplify = (text: string): string =>
      isCitizenMode ? simplifyCitizenText(text, lang) : text;

    const t = (key: any, fallback?: string): string => {
      if (key === null || key === undefined) return "";
      if (typeof key !== "string") return String(key);
      if (lang === "tr") {
        const cleanKey = key.trim();
        return maybeSimplify(translations.tr[cleanKey] ?? fallback ?? key);
      }

      const cleanKey = key.trim();
      // 1. Exact match in target dictionary
      if (translations[lang]?.[cleanKey]) return maybeSimplify(translations[lang][cleanKey]);
      if (translations[lang]?.[key]) return maybeSimplify(translations[lang][key]);

      // 2. Case-insensitive lookup
      const lowerKey = cleanKey.toLowerCase();
      const entry = Object.entries(translations[lang] || {}).find(
        ([k]) => k.toLowerCase() === lowerKey
      );
      if (entry) return maybeSimplify(entry[1]);

      // 3. Substring / sentence translation
      const phraseTranslated = translateText(cleanKey, lang);
      if (phraseTranslated !== cleanKey) return maybeSimplify(phraseTranslated);

      // 4. Fallback or original key
      return maybeSimplify(fallback ?? key);
    };

    const translate = (text: any): string => maybeSimplify(translateText(text, lang));

    return { lang, setLang, t, translate };
  }, [lang, isCitizenMode]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
