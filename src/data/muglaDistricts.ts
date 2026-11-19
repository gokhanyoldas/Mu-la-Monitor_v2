// src/data/muglaDistricts.ts
// Muğla 13 İlçe Resmi GIS Koordinatları ve Olay Tipleri

export interface District {
  id: string;
  name: string;
  lat: number;
  lon: number;
  population?: number;
}

export type IncidentCategory =
  | 'Yangın/Afet'
  | 'Trafik'
  | 'Altyapı/Su'
  | 'Asayiş'
  | 'Turizm/Çevre'
  | 'Genel';

export type IncidentSeverity = 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik';

export interface Incident {
  id: string;
  district_id: string;
  district_name: string;
  title: string;
  summary: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  event_date: string;
  lat: number;
  lon: number;
  raw_source?: string;
}

export const MUGLA_DISTRICTS: District[] = [
  { id: "mentese",     name: "Menteşe",     lat: 37.2153, lon: 28.3636, population: 123284 },
  { id: "bodrum",      name: "Bodrum",      lat: 37.0344, lon: 27.4305, population: 198335 },
  { id: "fethiye",     name: "Fethiye",     lat: 36.6548, lon: 29.1165, population: 181415 },
  { id: "marmaris",    name: "Marmaris",    lat: 36.8521, lon: 28.2706, population: 97818 },
  { id: "milas",       name: "Milas",       lat: 37.3166, lon: 27.7869, population: 151590 },
  { id: "dalaman",     name: "Dalaman",     lat: 36.7752, lon: 28.7929, population: 49012 },
  { id: "ortaca",      name: "Ortaca",      lat: 36.8344, lon: 28.7682, population: 55437 },
  { id: "koycegiz",    name: "Köyceğiz",    lat: 36.9705, lon: 28.6854, population: 40167 },
  { id: "datca",       name: "Datça",       lat: 36.7344, lon: 27.6866, population: 25741 },
  { id: "ula",         name: "Ula",         lat: 37.1035, lon: 28.4266, population: 27537 },
  { id: "yatagan",     name: "Yatağan",     lat: 37.3396, lon: 28.1376, population: 45283 },
  { id: "seydikemer",  name: "Seydikemer",  lat: 36.9183, lon: 29.1286, population: 63870 },
  { id: "kavaklidere", name: "Kavaklıdere", lat: 37.4460, lon: 28.3904, population: 10738 }
];

export const CATEGORY_COLORS: Record<IncidentCategory, string> = {
  "Yangın/Afet": "#ef4444",
  "Trafik": "#f59e0b",
  "Altyapı/Su": "#06b6d4",
  "Asayiş": "#a855f7",
  "Turizm/Çevre": "#10b981",
  "Genel": "#64748b"
};
