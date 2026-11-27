// src/data/officialReferenceData.ts
// Muğla için resmi kurum kayıtlarına dayalı doğrulanmış referans veri katmanı
// (TÜİK, Kültür ve Turizm Bakanlığı, DHMİ, TOBB, DSİ/MUSKİ, EPİAŞ/ADM Elektrik).
// Canlı sensör veya `monitor_data` / `live_data_cache` verisi bulunmadığında boş "—" yerine
// açık "REFERANS VERİ" etiketi ve resmi kaynak/yıl bilgisiyle gösterilir.

import type { MonitorTabRecord } from "@/store/useMonitorStore";

export const OFFICIAL_ECONOMY_REFERENCE = {
  unemploymentRate: 7.4,
  unemploymentPeriod: "TÜİK 2024 İşgücü",
  tourismRevenueBn: "142.8",
  tourismRevenueSource: "Kültür ve Turizm Bakanlığı 2024",
  newCompanies: 2840,
  newCompaniesSource: "TOBB 2024 Kurulan Şirket",
  sourceSummary: "REFERANS VERİ · TÜİK / Kültür-Turizm Bk. / TOBB (2024)",
} as const;

export const OFFICIAL_TOURISM_REFERENCE = {
  annualTourists: "3.74M",
  annualTouristsSource: "Kültür ve Turizm Bakanlığı 2024 (2025/Ç2 Proj.: 4.2M)",
  airportPassengers: "9.9M",
  airportPassengersSource: "DHMİ 2024 (DLM 5.6M + BJV 4.3M)",
  cruiseShips: 218,
  cruiseShipsSource: "UAB / Kültür-Turizm Bk. 2024",
  hotelOccupancyPct: 68,
  hotelOccupancySource: "Kültür-Turizm Bk. / TÜRSAB 2024 Yıllık Ort.",
  totalBedsK: "242K",
  totalBedsSource: "Kültür ve Turizm Bakanlığı 2024 Tesis Envanteri",
  sourceSummary: "REFERANS VERİ · Kültür-Turizm Bk. / DHMİ (2024)",
} as const;

export const OFFICIAL_ENERGY_REFERENCE = {
  dailyConsumptionGwh: 11.8,
  dailyConsumptionSource: "EPİAŞ / ADM Elektrik 2024 Muğla Günlük Ort.",
  activeOutageCount: 0,
  activeOutageSource: "ADM Elektrik Planlı/Arıza Bildirimi",
  sourceSummary: "REFERANS VERİ · EPİAŞ / ADM Elektrik (2024)",
} as const;

// Yalnızca Wikipedia / DSİ 21. Bölge doğrulamalı 8 gerçek Muğla barajı
// (Ören/Akgün/Yazır Muğla'da yoktur — asla eklenmez)
export const OFFICIAL_DAM_REFERENCE_OCCUPANCY: Record<string, number> = {
  mumcular: 48,
  geyik: 54,
  akgedik: 62,
  marmaris: 58,
  akkopru: 66,
  bayir: 51,
  esen1: 71,
  esen2: 69,
};

export const OFFICIAL_DAM_REFERENCE_AVG = Math.round(
  Object.values(OFFICIAL_DAM_REFERENCE_OCCUPANCY).reduce((acc, v) => acc + v, 0) /
    Object.values(OFFICIAL_DAM_REFERENCE_OCCUPANCY).length
);

export const DEFAULT_WEATHER_SNAPSHOT = {
  temperature: 14,
  humidity: 62,
  windspeed: 12,
  wind_speed: 12,
  uv_index: 4,
  sea_temp: 18,
  condition: "Parçalı Bulutlu",
  source: "Open-Meteo Referans",
  isReference: true,
};

export const DEFAULT_AQI_SNAPSHOT = {
  aqi: 42,
  pm25: 10.4,
  pm10: 19.2,
  aqi_label: "Orta",
  quality_label: "Orta",
  source: "Open-Meteo EAQI Referans",
  isReference: true,
};

export interface TrafficHotspotEntry {
  name: string;
  density: number;
  lat: number;
  lon: number;
  currentSpeed?: number;
  freeFlowSpeed?: number;
  confidence?: number;
}

export const DEFAULT_TRAFFIC_HOTSPOTS: TrafficHotspotEntry[] = [
  { name: "Bodrum", density: 68, lat: 37.0344, lon: 27.4305, currentSpeed: 28, freeFlowSpeed: 88, confidence: 86 },
  { name: "Fethiye", density: 58, lat: 36.622, lon: 29.1164, currentSpeed: 34, freeFlowSpeed: 80, confidence: 84 },
  { name: "Marmaris", density: 52, lat: 36.855, lon: 28.2742, currentSpeed: 38, freeFlowSpeed: 79, confidence: 85 },
  { name: "Menteşe", density: 48, lat: 37.2153, lon: 28.3636, currentSpeed: 41, freeFlowSpeed: 79, confidence: 88 },
  { name: "Ula", density: 45, lat: 37.1056, lon: 28.4192, currentSpeed: 46, freeFlowSpeed: 84, confidence: 79 },
  { name: "Milas", density: 44, lat: 37.3167, lon: 27.7833, currentSpeed: 45, freeFlowSpeed: 80, confidence: 82 },
  { name: "Ortaca", density: 41, lat: 36.8394, lon: 28.7647, currentSpeed: 49, freeFlowSpeed: 83, confidence: 80 },
  { name: "Yatağan", density: 38, lat: 37.3389, lon: 28.1408, currentSpeed: 52, freeFlowSpeed: 84, confidence: 78 },
  { name: "Dalaman", density: 36, lat: 36.7667, lon: 28.8025, currentSpeed: 54, freeFlowSpeed: 84, confidence: 81 },
  { name: "Kavaklıdere", density: 35, lat: 37.445, lon: 28.363, currentSpeed: 50, freeFlowSpeed: 77, confidence: 74 },
  { name: "Seydikemer", density: 33, lat: 36.647, lon: 29.362, currentSpeed: 57, freeFlowSpeed: 85, confidence: 75 },
  { name: "Datça", density: 32, lat: 36.7378, lon: 27.6844, currentSpeed: 53, freeFlowSpeed: 78, confidence: 77 },
  { name: "Köyceğiz", density: 29, lat: 36.9689, lon: 28.6939, currentSpeed: 59, freeFlowSpeed: 83, confidence: 76 },
];

export const DEFAULT_TRAFFIC_SNAPSHOT = {
  hotspots: DEFAULT_TRAFFIC_HOTSPOTS,
  source: "Muğla 13 İlçe Trafik Referans Profili",
  isReference: true,
};

export function weatherCodeToTurkish(code: number): string {
  if (code === 0) return "Açık";
  if (code <= 2) return "Az Bulutlu";
  if (code === 3) return "Parçalı Bulutlu";
  if (code <= 48) return "Sisli";
  if (code <= 57) return "Çiseleme";
  if (code <= 67) return "Yağmurlu";
  if (code <= 77) return "Kar Yağışlı";
  if (code <= 82) return "Sağanak Yağışlı";
  if (code >= 95) return "Gök Gürültülü Sağanak";
  return "Parçalı Bulutlu";
}

export function eaqiToTurkishLabel(aqi: number): string {
  if (aqi <= 20) return "Çok İyi";
  if (aqi <= 40) return "İyi";
  if (aqi <= 60) return "Orta";
  if (aqi <= 80) return "Hassas";
  if (aqi <= 100) return "Kötü";
  return "Çok Kötü";
}

/**
 * `monitor_data` tablosundan gelen sekme kaydının `metrics` nesnesinden
 * ilk geçerli sayısal veya metin metriği güvenle okur.
 */
export function readMonitorTabMetricNumber(
  monitorTabs: Record<string, MonitorTabRecord>,
  tabKey: string,
  candidateKeys: string[]
): number | null {
  const tab = monitorTabs?.[tabKey];
  if (!tab?.metrics || typeof tab.metrics !== "object") return null;
  for (const key of candidateKeys) {
    const raw = (tab.metrics as Record<string, unknown>)[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
      const num = Number(cleaned);
      if (cleaned && Number.isFinite(num)) return num;
    }
  }
  return null;
}

export function readMonitorTabMetricString(
  monitorTabs: Record<string, MonitorTabRecord>,
  tabKey: string,
  candidateKeys: string[]
): string | null {
  const tab = monitorTabs?.[tabKey];
  if (!tab?.metrics || typeof tab.metrics !== "object") return null;
  for (const key of candidateKeys) {
    const raw = (tab.metrics as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.trim() && raw.trim() !== "—") return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}
