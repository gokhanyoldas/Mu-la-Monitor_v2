import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { safeStorage } from "@/lib/safe-storage";

export type ViewMode = "analyst" | "citizen";
export type FontScale = "normal" | "large" | "xlarge";

interface AccessibilityPreferences {
  viewMode: ViewMode;
  fontScale: FontScale;
  highContrast: boolean;
}

interface AccessibilityContextValue extends AccessibilityPreferences {
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setFontScale: (scale: FontScale) => void;
  increaseFontScale: () => void;
  decreaseFontScale: () => void;
  canIncreaseFont: boolean;
  canDecreaseFont: boolean;
  setHighContrast: (enabled: boolean) => void;
  toggleHighContrast: () => void;
  isCitizenMode: boolean;
}

const STORAGE_KEY = "mugla_accessibility_prefs_v1";

const DEFAULT_PREFS: AccessibilityPreferences = {
  viewMode: "analyst",
  fontScale: "normal",
  highContrast: false,
};

const FONT_SCALE_ORDER: FontScale[] = ["normal", "large", "xlarge"];

function loadPreferences(): AccessibilityPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.safeStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return {
      viewMode: parsed.viewMode === "citizen" ? "citizen" : "analyst",
      fontScale:
        parsed.fontScale && FONT_SCALE_ORDER.includes(parsed.fontScale)
          ? parsed.fontScale
          : "normal",
      highContrast: Boolean(parsed.highContrast),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Plain-language replacements applied when Sade Vatandaş Modu (Citizen Mode) is active.
// All panels remain visible; only technical acronyms & intelligence jargon are simplified.
const CITIZEN_EXACT_MAP_TR: Record<string, string> = {
  "Diyagram": "Doğrulama Merkezi",
  "Sorgu Odası": "Doğrulama Merkezi",
  "Muğla İstihbarat & Çapraz Sorgu Odası": "Muğla Doğrulama ve Bilgi Merkezi",
  "OSINT & KULİS ANALİZİ": "HABER & SOSYAL MEDYA DOĞRULAMA",
  "OSINT": "Açık Haber & Sosyal Medya",
  "Otonom Nabız": "Şehir Özeti",
  "Şehir Nabzı": "Şehir Özeti",
  "Canlı Şehir Nabzı": "Güncel Şehir Özeti",
  "Bölgesel İstihbarat Paneli": "Muğla Güncel Bilgi Ekranı",
  "Protokol ve Veri Ağı (Test)": "Kurum İletişim Ağı",
  "Muğla Protokol": "İl Yöneticileri",
  "Muğla İl Protokol Listesi": "Muğla İl Yöneticileri Rehberi",
  "Sosyal İstihbarat": "Sosyal Medya Gündemi",
  "Hava Kalitesi (AQI)": "Hava Kalitesi Puanı",
  "AQI": "Hava Puanı",
  "DSİ": "Su İdaresi",
  "HABER + SAHA İHBARI": "HABER + VATANDAŞ BİLDİRİMİ",
  "Canlı Çapraz Doğrulama Akışı": "Güncel Doğrulanmış Gelişmeler",
  "Günlük AI Özeti": "Günlük Şehir Özeti",
  "Kamuoyu Özeti": "Vatandaş Gündem Özeti",
  "Deprem Risk Özeti": "Deprem Durum Özeti",
  "Hava Durumu Özeti": "Hava Durumu Özeti",
  "YAŞAYAN SÖZLÜK": "TAKİP EDİLEN KELİMELER",
  "Söz Dağarcığı Havuzu": "Takip Edilen Kelime Listesi",
};

const CITIZEN_EXACT_MAP_EN: Record<string, string> = {
  "Diagram": "Verification Center",
  "Interrogation Room": "Verification Center",
  "Muğla Intelligence & Cross-Verification Room": "Muğla Fact-Check & Info Center",
  "OSINT & RUMOR ANALYSIS": "NEWS & SOCIAL MEDIA CHECK",
  "OSINT": "Public News & Social Media",
  "Autonomous Pulse": "City Summary",
  "City Pulse": "City Summary",
  "Live City Pulse": "Live City Summary",
  "Regional Intelligence Dashboard": "Muğla Live City Guide",
  "Protocol & Data Network (Test)": "Public Institution Network",
  "Muğla Protocol": "City Officials",
  "Muğla Provincial Protocol List": "Muğla Public Officials Directory",
  "Social Intelligence": "Social Media Trends",
  "Air Quality (AQI)": "Air Quality Score",
  "AQI": "Air Score",
  "Daily AI Summary": "Daily City Summary",
  "Public Opinion Summary": "Citizen Feedback Summary",
  "Living Lexicon": "Tracked Topics",
};

const CITIZEN_REGEX_TR: Array<[RegExp, string]> = [
  [/\bOSINT\b/g, "Açık Haber"],
  [/\bODİT-/g, "DOSYA-"],
  [/\bODİT\b/g, "İnceleme Dosyası"],
  [/Google Search Grounding/gi, "Canlı Web Doğrulaması"],
  [/Search Grounding/gi, "Canlı Web Doğrulaması"],
  [/\bGrounding\b/gi, "Web Doğrulaması"],
  [/\bTelemetri(si|k)?\b/gi, "Canlı Ölçüm"],
  [/\bTelemetry\b/gi, "Canlı Ölçüm"],
  [/Çapraz Sorgu Odası/gi, "Doğrulama Merkezi"],
  [/Sorgu Odası/gi, "Doğrulama Merkezi"],
  [/Otonom Nabız/gi, "Şehir Özeti"],
  [/İstihbarat/g, "Bilgi Takibi"],
  [/istihbarat/g, "bilgi takibi"],
  [/\bAQI\b/g, "Hava Puanı"],
];

const CITIZEN_REGEX_EN: Array<[RegExp, string]> = [
  [/\bOSINT\b/g, "Public News"],
  [/\bODİT-/g, "CASE-"],
  [/\bODİT\b/g, "Review Case"],
  [/Google Search Grounding/gi, "Live Web Check"],
  [/Search Grounding/gi, "Live Web Check"],
  [/\bGrounding\b/gi, "Web Check"],
  [/\bTelemetry\b/gi, "Live Readings"],
  [/Interrogation Room/gi, "Verification Center"],
  [/Autonomous Pulse/gi, "City Summary"],
  [/Intelligence/g, "City Info"],
  [/\bAQI\b/g, "Air Score"],
];

export function simplifyCitizenText(text: string, lang: "tr" | "en" | "de"): string {
  if (!text || typeof text !== "string") return text;
  const trimmed = text.trim();

  if (lang === "en") {
    if (CITIZEN_EXACT_MAP_EN[trimmed]) return CITIZEN_EXACT_MAP_EN[trimmed];
    let res = text;
    for (const [pattern, replacement] of CITIZEN_REGEX_EN) {
      res = res.replace(pattern, replacement);
    }
    return res;
  }

  // Default TR (and fallback for DE)
  if (CITIZEN_EXACT_MAP_TR[trimmed]) return CITIZEN_EXACT_MAP_TR[trimmed];
  let res = text;
  for (const [pattern, replacement] of CITIZEN_REGEX_TR) {
    res = res.replace(pattern, replacement);
  }
  return res;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(() => loadPreferences());

  useEffect(() => {
    try {
      window.safeStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore storage quota errors
    }

    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.fontScale = prefs.fontScale;
      root.dataset.viewMode = prefs.viewMode;
      root.classList.toggle("high-contrast-mode", prefs.highContrast);
    }
  }, [prefs]);

  const setViewMode = useCallback((viewMode: ViewMode) => {
    setPrefs((prev) => ({ ...prev, viewMode }));
  }, []);

  const toggleViewMode = useCallback(() => {
    setPrefs((prev) => ({
      ...prev,
      viewMode: prev.viewMode === "analyst" ? "citizen" : "analyst",
    }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setPrefs((prev) => ({ ...prev, fontScale }));
  }, []);

  const increaseFontScale = useCallback(() => {
    setPrefs((prev) => {
      const idx = FONT_SCALE_ORDER.indexOf(prev.fontScale);
      const next = FONT_SCALE_ORDER[Math.min(FONT_SCALE_ORDER.length - 1, idx + 1)];
      return { ...prev, fontScale: next };
    });
  }, []);

  const decreaseFontScale = useCallback(() => {
    setPrefs((prev) => {
      const idx = FONT_SCALE_ORDER.indexOf(prev.fontScale);
      const next = FONT_SCALE_ORDER[Math.max(0, idx - 1)];
      return { ...prev, fontScale: next };
    });
  }, []);

  const setHighContrast = useCallback((highContrast: boolean) => {
    setPrefs((prev) => ({ ...prev, highContrast }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setPrefs((prev) => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const value = useMemo<AccessibilityContextValue>(() => {
    const idx = FONT_SCALE_ORDER.indexOf(prefs.fontScale);
    return {
      ...prefs,
      setViewMode,
      toggleViewMode,
      setFontScale,
      increaseFontScale,
      decreaseFontScale,
      canIncreaseFont: idx < FONT_SCALE_ORDER.length - 1,
      canDecreaseFont: idx > 0,
      setHighContrast,
      toggleHighContrast,
      isCitizenMode: prefs.viewMode === "citizen",
    };
  }, [
    prefs,
    setViewMode,
    toggleViewMode,
    setFontScale,
    increaseFontScale,
    decreaseFontScale,
    setHighContrast,
    toggleHighContrast,
  ]);

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export function useOptionalAccessibility(): AccessibilityContextValue | null {
  return useContext(AccessibilityContext);
}

export function useAccessibility(): AccessibilityContextValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used inside AccessibilityProvider");
  }
  return ctx;
}
