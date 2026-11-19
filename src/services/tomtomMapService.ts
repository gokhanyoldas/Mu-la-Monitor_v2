// src/services/tomtomMapService.ts
// Muğla Monitör v2 — Modüler TomTom Harita Görüntüleme & Trafik Katmanı Servisi

import { ENV } from "@/config/env";

export type BaseMapMode = "carto-voyager" | "tomtom-night";

export interface TomTomLayerUrls {
  cartoVoyager: string;
  tomtomNight: string;
  trafficFlow: string;
  trafficIncidents: string;
}

export const TOMTOM_MISSING_KEY_MESSAGE =
  "TomTom API anahtarı (.env içinde VITE_TOMTOM_API_KEY) tanımlandığında canlı trafik katmanı aktif olacaktır";

export const DEFAULT_CARTO_VOYAGER_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

export function isTomTomConfigured(): boolean {
  return Boolean(ENV.VITE_TOMTOM_API_KEY);
}

/**
 * TomTom Raster Harita, Trafik Akışı ve Trafik Olayları tile URL şablonlarını üretir.
 */
export function buildTomTomLayerUrls(apiKey: string = ENV.VITE_TOMTOM_API_KEY): TomTomLayerUrls {
  const encodedKey = encodeURIComponent(apiKey.trim());
  return {
    cartoVoyager: DEFAULT_CARTO_VOYAGER_URL,
    tomtomNight: `https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${encodedKey}&tileSize=256`,
    trafficFlow: `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${encodedKey}&tileSize=256`,
    trafficIncidents: `https://api.tomtom.com/traffic/map/4/tile/incidents/s3/{z}/{x}/{y}.png?key=${encodedKey}&tileSize=256`,
  };
}
