// M13: Çok Dil Desteği — TR/EN/DE
// Hafif custom i18n, harici bağımlılık yok
import { createContext, useContext, useState, type ReactNode } from "react";

export type Language = "tr" | "en" | "de";

export const LANGUAGE_LABELS: Record<Language, string> = {
  tr: "🇹🇷 Türkçe",
  en: "🇬🇧 English",
  de: "🇩🇪 Deutsch",
};

// Translation dictionary
export const translations: Record<Language, Record<string, string>> = {
  tr: {
    "nav.genel":    "Genel",
    "nav.ekonomi":  "Ekonomi",
    "nav.cevre":    "Çevre",
    "nav.turizm":   "Turizm",
    "nav.ulasim":   "Ulaşım",
    "nav.gvenlik":  "Güvenlik",
    "nav.sosyal":   "Sosyal",
    "nav.protokol": "Protokol",
    "nav.osint":    "OSINT",
    "nav.ilceler":  "İlçeler",
    "card.live":     "CANLI",
    "card.estimate": "TAHMİN",
    "card.cached":   "ÖNBELLEK",
    "card.static":   "STATİK",
    "loading":  "Yükleniyor...",
    "no_data":  "Veri bulunamadı",
    "source":   "Kaynak",
    "updated":  "Güncellendi",
    "ago":      "önce",
    "min":      "dk",
    "hour":     "sa",
    "day":      "g",
    "weather.title": "Hava Durumu",
    "weather.temp":  "Sıcaklık",
    "weather.humidity": "Nem",
    "weather.wind":  "Rüzgar",
    "quake.title":   "Deprem Uyarısı",
    "quake.mag":     "Büyüklük",
    "quake.depth":   "Derinlik",
    "quake.distance":"Uzaklık",
    "fire.title":    "Yangın Risk Göstergesi",
    "fire.level":    "Risk Seviyesi",
    "tourism.title": "Turizm Tahmini",
    "tourism.visitors": "Ziyaretçi",
    "tourism.hotels":   "Otel Doluluk",
    "tourism.beaches":  "Plaj Doluluk",
    "notif.title":   "Bildirim Tercihleri",
    "notif.enable":  "Bildirimleri Etkinleştir",
    "notif.earthquake": "Deprem Uyarıları (M3+)",
    "notif.fire":    "Yüksek Yangın Riski",
    "notif.flood":   "Sel / Taşkın",
    "notif.social":  "Sosyal Medya Krizi",
    "notif.daily":   "Günlük Özet",
  },
  en: {
    "nav.genel":    "Overview",
    "nav.ekonomi":  "Economy",
    "nav.cevre":    "Environment",
    "nav.turizm":   "Tourism",
    "nav.ulasim":   "Transport",
    "nav.gvenlik":  "Security",
    "nav.sosyal":   "Social",
    "nav.protokol": "Protocol",
    "nav.osint":    "OSINT",
    "nav.ilceler":  "Districts",
    "card.live":     "LIVE",
    "card.estimate": "ESTIMATE",
    "card.cached":   "CACHED",
    "card.static":   "STATIC",
    "loading":  "Loading...",
    "no_data":  "No data found",
    "source":   "Source",
    "updated":  "Updated",
    "ago":      "ago",
    "min":      "min",
    "hour":     "hr",
    "day":      "d",
    "weather.title": "Weather",
    "weather.temp":  "Temperature",
    "weather.humidity": "Humidity",
    "weather.wind":  "Wind",
    "quake.title":   "Earthquake Alert",
    "quake.mag":     "Magnitude",
    "quake.depth":   "Depth",
    "quake.distance":"Distance",
    "fire.title":    "Fire Risk Indicator",
    "fire.level":    "Risk Level",
    "tourism.title": "Tourism Forecast",
    "tourism.visitors": "Visitors",
    "tourism.hotels":   "Hotel Occupancy",
    "tourism.beaches":  "Beach Occupancy",
    "notif.title":   "Notification Preferences",
    "notif.enable":  "Enable Notifications",
    "notif.earthquake": "Earthquake Alerts (M3+)",
    "notif.fire":    "High Fire Risk",
    "notif.flood":   "Flood Warning",
    "notif.social":  "Social Media Crisis",
    "notif.daily":   "Daily Summary",
  },
  de: {
    "nav.genel":    "Übersicht",
    "nav.ekonomi":  "Wirtschaft",
    "nav.cevre":    "Umwelt",
    "nav.turizm":   "Tourismus",
    "nav.ulasim":   "Transport",
    "nav.gvenlik":  "Sicherheit",
    "nav.sosyal":   "Soziales",
    "nav.protokol": "Protokoll",
    "nav.osint":    "OSINT",
    "nav.ilceler":  "Bezirke",
    "card.live":     "LIVE",
    "card.estimate": "SCHÄTZUNG",
    "card.cached":   "CACHE",
    "card.static":   "STATISCH",
    "loading":  "Wird geladen...",
    "no_data":  "Keine Daten gefunden",
    "source":   "Quelle",
    "updated":  "Aktualisiert",
    "ago":      "vor",
    "min":      "Min",
    "hour":     "Std",
    "day":      "T",
    "weather.title": "Wetter",
    "weather.temp":  "Temperatur",
    "weather.humidity": "Luftfeuchtigkeit",
    "weather.wind":  "Wind",
    "quake.title":   "Erdbeben-Warnung",
    "quake.mag":     "Stärke",
    "quake.depth":   "Tiefe",
    "quake.distance":"Entfernung",
    "fire.title":    "Waldbrand-Risikoindikator",
    "fire.level":    "Risikoniveau",
    "tourism.title": "Tourismus-Prognose",
    "tourism.visitors": "Besucher",
    "tourism.hotels":   "Hotelbelegung",
    "tourism.beaches":  "Strandbelegung",
    "notif.title":   "Benachrichtigungseinstellungen",
    "notif.enable":  "Benachrichtigungen aktivieren",
    "notif.earthquake": "Erdbeben-Warnungen (M3+)",
    "notif.fire":    "Hohes Waldbrandrisiko",
    "notif.flood":   "Hochwasser-Warnung",
    "notif.social":  "Social-Media-Krise",
    "notif.daily":   "Tägliche Zusammenfassung",
  },
};

// Context types
interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, fallback?: string) => string;
}

export const I18nContext = createContext<I18nContextType>({
  lang: "tr",
  setLang: () => {},
  t: (k) => k,
});

const LANG_KEY = "mugla-lang";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY) as Language | null;
      if (stored && ["tr", "en", "de"].includes(stored)) return stored;
      const browser = navigator.language.slice(0, 2).toLowerCase();
      if (browser === "de") return "de";
      if (browser === "en") return "en";
    } catch {}
    return "tr";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
      document.documentElement.lang = l;
    } catch {}
  };

  const t = (key: string, fallback?: string): string => {
    return translations[lang]?.[key] ?? translations["tr"]?.[key] ?? fallback ?? key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
