// src/components/map/MuglaLeafletMap.tsx
// Muğla 13 İlçe GeoJSON Sınır Katmanı ve Etkileşimli Veri Pinleri

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MUGLA_DISTRICTS, Incident, CATEGORY_COLORS } from "@/data/muglaDistricts";
import {
  MUGLA_DISTRICTS_GEOJSON,
  DistrictGeoProperties,
  DistrictFeature
} from "@/data/muglaDistrictsGeoJSON";
import { Layers, Navigation, AlertTriangle, Moon, Info, X } from "lucide-react";
import { ENV } from "@/config/env";
import {
  BaseMapMode,
  DEFAULT_CARTO_VOYAGER_URL,
  TOMTOM_MISSING_KEY_MESSAGE,
  buildTomTomLayerUrls,
} from "@/services/tomtomMapService";
import { useToast } from "@/hooks/use-toast";

interface MuglaLeafletMapProps {
  incidents: Incident[];
  selectedCategory: string | null;
  selectedDistrictId?: string | null;
  onDistrictSelect?: (districtId: string) => void;
  focusTrigger?: number;
  height?: number | string;
  className?: string;
}

export const MuglaLeafletMap: React.FC<MuglaLeafletMapProps> = ({
  incidents,
  selectedCategory,
  selectedDistrictId,
  onDistrictSelect,
  focusTrigger = 0,
  height = 540,
  className = ""
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Katman Referansları
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const tomtomFlowLayerRef = useRef<L.TileLayer | null>(null);
  const tomtomIncidentsLayerRef = useRef<L.TileLayer | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const districtPinsLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);

  // Katman Görünürlük Kontrolleri
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showDistrictPins, setShowDistrictPins] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  // TomTom Harita & Trafik Katmanı Kontrolleri
  const [baseMapMode, setBaseMapMode] = useState<BaseMapMode>("carto-voyager");
  const [showTrafficFlow, setShowTrafficFlow] = useState(false);
  const [showTrafficIncidents, setShowTrafficIncidents] = useState(false);
  const [missingTomTomNotice, setMissingTomTomNotice] = useState(false);

  const hasTomTomKey = Boolean(ENV.VITE_TOMTOM_API_KEY);

  // 1. Haritayı Başlat ve Katmanları Kur
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Muğla coğrafi merkez (Menteşe - Ula - Köyceğiz üçgeni: 37.12, 28.30)
    const map = L.map(containerRef.current, {
      center: [37.12, 28.30],
      zoom: 9,
      minZoom: 8,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: true
    });

    // Varsayılan OpenStreetMap / CartoDB Voyager Katmanı
    const baseLayer = L.tileLayer(DEFAULT_CARTO_VOYAGER_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);
    baseTileLayerRef.current = baseLayer;

    L.control.zoom({ position: "topright" }).addTo(map);

    // Katman Grupları
    const geoJsonGroup = L.geoJSON(undefined, {
      style: (feature) => {
        const props = feature?.properties as DistrictGeoProperties;
        const isSelected = props?.id === selectedDistrictId;
        return {
          color: isSelected ? "#10b981" : "#38bdf8",
          weight: isSelected ? 3 : 1.5,
          opacity: isSelected ? 1 : 0.75,
          dashArray: isSelected ? undefined : "4, 4",
          fillColor: isSelected ? "#10b981" : (props?.color || "#0284c7"),
          fillOpacity: isSelected ? 0.35 : 0.12
        };
      },
      onEachFeature: (feature: DistrictFeature, layer) => {
        const props = feature.properties;

        // İlçe Poligonu Üzerine Gelince (Hover)
        layer.on("mouseover", (e) => {
          const target = e.target;
          target.setStyle({
            weight: 2.8,
            dashArray: undefined,
            color: "#38bdf8",
            fillOpacity: 0.38
          });
          target.bringToFront();
        });

        // İlçe Poligonundan Çıkınca (Mouseout)
        layer.on("mouseout", (e) => {
          if (geoJsonLayerRef.current) {
            geoJsonLayerRef.current.resetStyle(e.target);
          }
        });

        // İlçe Poligonuna Tıklanınca (Click)
        layer.on("click", () => {
          if (onDistrictSelect) onDistrictSelect(props.id);
          const bounds = (layer as L.Polygon).getBounds();
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
        });

        // Poligon Araç İpucu (Tooltip)
        layer.bindTooltip(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; padding: 2px 4px;">
            <div style="font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 4px;">
              <span>${props.emoji}</span> <span>${props.name}</span>
            </div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">
              Nüfus: ${props.populationFormatted} · ${props.temperature}
            </div>
          </div>
        `, {
          permanent: false,
          direction: "top",
          className: "custom-district-tooltip"
        });
      }
    }).addTo(map);

    // GeoJSON verisini yükle
    geoJsonGroup.addData(MUGLA_DISTRICTS_GEOJSON as any);
    geoJsonLayerRef.current = geoJsonGroup;

    const districtPinsGroup = L.layerGroup().addTo(map);
    const incidentsGroup = L.layerGroup().addTo(map);

    districtPinsLayerRef.current = districtPinsGroup;
    incidentsLayerRef.current = incidentsGroup;
    mapRef.current = map;

    // Yeniden boyutlandırmada harita kararmasını önle
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Leaflet map construction is intentionally mount-only; callbacks are used by later layers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Seçili İlçe Değiştiğinde GeoJSON Stillerini Güncelle ve Odaklan
  useEffect(() => {
    if (!geoJsonLayerRef.current || !mapRef.current) return;

    geoJsonLayerRef.current.eachLayer((layer: any) => {
      const props = layer.feature?.properties as DistrictGeoProperties;
      const isSelected = props?.id === selectedDistrictId;

      layer.setStyle({
        color: isSelected ? "#10b981" : "#38bdf8",
        weight: isSelected ? 3.2 : 1.5,
        opacity: isSelected ? 1 : 0.75,
        dashArray: isSelected ? undefined : "4, 4",
        fillColor: isSelected ? "#10b981" : (props?.color || "#0284c7"),
        fillOpacity: isSelected ? 0.35 : 0.12
      });

      if (isSelected) {
        layer.bringToFront();
      }
    });

    if (selectedDistrictId) {
      const feat = MUGLA_DISTRICTS_GEOJSON.features.find(f => f.id === selectedDistrictId);
      if (feat && mapRef.current) {
        mapRef.current.flyTo(feat.properties.center, 11, { duration: 1.0 });
      }
    }
  }, [selectedDistrictId, focusTrigger]);

  // 3. İlçe Bazlı Etkileşimli Veri Pinlerini Çiz
  useEffect(() => {
    if (!districtPinsLayerRef.current || !mapRef.current) return;

    districtPinsLayerRef.current.clearLayers();
    if (!showDistrictPins) return;

    MUGLA_DISTRICTS_GEOJSON.features.forEach((feature) => {
      const p = feature.properties;
      const districtIncidents = incidents.filter(i => i.district_id === p.id);
      const incCount = districtIncidents.length;
      const isSelected = selectedDistrictId === p.id;
      const hasCritical = districtIncidents.some(i => i.severity === "Kritik" || i.severity === "Yüksek");

      // Özel HTML Etkileşimli İlçe Veri Çipi
      const pinIcon = L.divIcon({
        className: "custom-district-data-pin",
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: ${isSelected ? '#064e3b' : '#0b111e'};
            color: #ffffff;
            border: 1.5px solid ${isSelected ? '#10b981' : hasCritical ? '#f59e0b' : '#334155'};
            border-radius: 9999px;
            padding: 3px 8px 3px 6px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 4px 10px rgba(0,0,0,0.45);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s ease;
            position: relative;
          ">
            <span>${p.emoji}</span>
            <span>${p.name}</span>
            <span style="
              background: ${hasCritical ? '#ef4444' : '#1e293b'};
              color: ${hasCritical ? '#ffffff' : '#94a3b8'};
              font-size: 9px;
              font-family: monospace;
              padding: 1px 5px;
              border-radius: 9999px;
              margin-left: 2px;
            ">
              ${incCount > 0 ? `${incCount} Olay` : p.populationFormatted}
            </span>
            ${hasCritical ? `
              <span style="
                position: absolute;
                top: -2px;
                right: -2px;
                width: 8px;
                height: 8px;
                background-color: #ef4444;
                border-radius: 50%;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></span>
            ` : ''}
          </div>
        `,
        iconSize: [120, 26],
        iconAnchor: [60, 13]
      });

      const marker = L.marker(p.center, { icon: pinIcon, zIndexOffset: isSelected ? 1000 : 100 });

      // İlçe Bilgi ve Veri Açılır Kartı (Popup)
      marker.bindPopup(`
        <div style="min-width: 250px; max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 4px;">
          
          {/* Başlık ve Tür Rozeti */}
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 18px;">${p.emoji}</span>
              <div>
                <h3 style="margin: 0; font-size: 14px; font-weight: bold; color: #0f172a;">${p.name}</h3>
                <span style="font-size: 10px; color: #64748b;">${p.type === 'coastal' ? 'Kıyı Turizm İlçesi' : 'İç İlçe / İdari Bölge'}</span>
              </div>
            </div>
            <span style="
              font-size: 10px;
              background: ${p.riskLevel === 'Kritik' ? '#fee2e2' : p.riskLevel === 'Orta' ? '#fef3c7' : '#dcfce7'};
              color: ${p.riskLevel === 'Kritik' ? '#991b1b' : p.riskLevel === 'Orta' ? '#92400e' : '#166534'};
              padding: 2px 7px;
              border-radius: 4px;
              font-weight: 700;
            ">
              ${p.riskLevel} Risk
            </span>
          </div>

          {/* Veri Izgarası (Grid) */}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 10px;">
            <div style="background: #f8fafc; padding: 5px 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
              <span style="font-size: 9px; color: #64748b; display: block; font-family: monospace;">NÜFUS</span>
              <span style="font-weight: 700; color: #1e293b; font-family: monospace;">${p.populationFormatted}</span>
            </div>
            <div style="background: #f8fafc; padding: 5px 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
              <span style="font-size: 9px; color: #64748b; display: block; font-family: monospace;">HAVA</span>
              <span style="font-weight: 700; color: #1e293b;">${p.temperature} · ${p.weatherDesc}</span>
            </div>
            <div style="background: #f8fafc; padding: 5px 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
              <span style="font-size: 9px; color: #64748b; display: block; font-family: monospace;">TRAFİK YOĞUNLUĞU</span>
              <span style="font-weight: 700; color: #0284c7; font-family: monospace;">%${p.trafficDensity} Akış</span>
            </div>
            <div style="background: #f8fafc; padding: 5px 8px; border-radius: 6px; border: 1px solid #f1f5f9;">
              <span style="font-size: 9px; color: #64748b; display: block; font-family: monospace;">KAYITLI OLAY</span>
              <span style="font-weight: 700; color: ${incCount > 0 ? '#ea580c' : '#16a34a'}; font-family: monospace;">${incCount} Aktif</span>
            </div>
          </div>

          {/* Aktif Olay Önizlemesi */}
          ${districtIncidents.length > 0 ? `
            <div style="margin-bottom: 10px;">
              <span style="font-size: 10px; font-weight: bold; color: #475569; display: block; margin-bottom: 4px;">Son Olay Bildirimi:</span>
              <div style="background: #fff7ed; border-left: 3px solid #f97316; padding: 5px 7px; font-size: 10px; color: #9a3412; border-radius: 2px;">
                ${districtIncidents[0].title}
              </div>
            </div>
          ` : ''}

          {/* Alt Aksiyon Butonları */}
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <button 
              type="button"
              onclick="window.dispatchEvent(new CustomEvent('focus-district-analysis', { detail: '${p.id}' }))"
              style="
                display: block;
                width: 100%;
                text-align: center;
                background: #064e3b;
                border: 1px solid #10b981;
                color: #a7f3d0;
                font-size: 11px;
                font-weight: bold;
                padding: 6px 10px;
                border-radius: 6px;
                cursor: pointer;
              "
            >
              📊 İlçe Detay Analizini İncele ↓
            </button>
            <a 
              href="/ilce/${p.id}"
              style="
                display: block;
                text-align: center;
                background: #0284c7;
                color: #ffffff;
                text-decoration: none;
                font-size: 11px;
                font-weight: bold;
                padding: 6px 10px;
                border-radius: 6px;
                transition: background 0.2s;
              "
            >
              ${p.name} Resmi Sayfasına Git →
            </a>
          </div>
        </div>
      `, {
        maxWidth: 320,
        className: "custom-leaflet-popup"
      });

      marker.on("click", () => {
        if (onDistrictSelect) onDistrictSelect(p.id);
      });

      districtPinsLayerRef.current!.addLayer(marker);
    });
    // Parent callbacks are intentionally excluded; the layer redraw is state-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDistrictPins, incidents, selectedDistrictId]);

  // 4. Olay Pinlerini Çiz (Yangın, Trafik, Altyapı vb.)
  useEffect(() => {
    if (!incidentsLayerRef.current || !mapRef.current) return;

    incidentsLayerRef.current.clearLayers();
    if (!showIncidents) return;

    const filtered = incidents.filter(i => {
      const matchesCat = !selectedCategory || i.category === selectedCategory;
      const matchesDist = !selectedDistrictId || i.district_id === selectedDistrictId;
      return matchesCat && matchesDist;
    });

    filtered.forEach((inc) => {
      const color = CATEGORY_COLORS[inc.category] || "#3b82f6";
      const isCritical = inc.severity === "Kritik";
      const isWarning = inc.severity === "Yüksek";

      const icon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
            ${isCritical ? `
              <div style="position: absolute; width: 30px; height: 30px; background-color: ${color}; opacity: 0.45; border-radius: 50%; animation: pulse-ring 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            ` : isWarning ? `
              <div style="position: absolute; width: 24px; height: 24px; background-color: ${color}; opacity: 0.3; border-radius: 50%;"></div>
            ` : ''}
            <div style="width: 14px; height: 14px; background-color: ${color}; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.45); z-index: 2;"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([inc.lat, inc.lon], { icon, zIndexOffset: 500 });
      const dateStr = new Date(inc.event_date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

      marker.bindPopup(`
        <div style="min-width: 220px; max-width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase;">${inc.category}</span>
            <span style="font-size: 9px; background: ${isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#3b82f6'}; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${inc.severity}</span>
          </div>
          <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; line-height: 1.3; color: #1e293b;">${inc.title}</h4>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #475569; line-height: 1.4;">${inc.summary}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <span style="font-weight: 600; color: #0ea5e9;">📍 ${inc.district_name}</span>
            <span>🕒 ${dateStr}</span>
          </div>
        </div>
      `, {
        maxWidth: 320,
        className: "custom-leaflet-popup"
      });

      incidentsLayerRef.current!.addLayer(marker);
    });
  }, [showIncidents, incidents, selectedCategory, selectedDistrictId]);

  // 5. Katman Görünürlüklerini Değiştirme
  useEffect(() => {
    if (!geoJsonLayerRef.current || !mapRef.current) return;
    if (showBoundaries) {
      if (!mapRef.current.hasLayer(geoJsonLayerRef.current)) {
        mapRef.current.addLayer(geoJsonLayerRef.current);
      }
    } else {
      if (mapRef.current.hasLayer(geoJsonLayerRef.current)) {
        mapRef.current.removeLayer(geoJsonLayerRef.current);
      }
    }
  }, [showBoundaries]);

  // 6. TomTom Altlık ve Canlı Trafik Katmanları Senkronizasyonu
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const tomtomKey = ENV.VITE_TOMTOM_API_KEY;
    const urls = buildTomTomLayerUrls(tomtomKey);

    // Altlık Harita Geçişi (CartoDB / OSM <-> TomTom Gece)
    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }

    if (baseMapMode === "tomtom-night" && tomtomKey) {
      baseTileLayerRef.current = L.tileLayer(urls.tomtomNight, {
        attribution: '&copy; <a href="https://www.tomtom.com">TomTom</a>',
        maxZoom: 19,
        tileSize: 256,
      }).addTo(map);
      baseTileLayerRef.current.bringToBack();
    } else {
      baseTileLayerRef.current = L.tileLayer(urls.cartoVoyager, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);
      baseTileLayerRef.current.bringToBack();
    }

    // TomTom Canlı Trafik Akışı Katmanı
    if (tomtomFlowLayerRef.current) {
      map.removeLayer(tomtomFlowLayerRef.current);
      tomtomFlowLayerRef.current = null;
    }
    if (showTrafficFlow && tomtomKey) {
      tomtomFlowLayerRef.current = L.tileLayer(urls.trafficFlow, {
        attribution: '&copy; TomTom Traffic Flow',
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.85,
        zIndex: 410,
      }).addTo(map);
    }

    // TomTom Trafik Olayları Katmanı
    if (tomtomIncidentsLayerRef.current) {
      map.removeLayer(tomtomIncidentsLayerRef.current);
      tomtomIncidentsLayerRef.current = null;
    }
    if (showTrafficIncidents && tomtomKey) {
      tomtomIncidentsLayerRef.current = L.tileLayer(urls.trafficIncidents, {
        attribution: '&copy; TomTom Traffic Incidents',
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.9,
        zIndex: 420,
      }).addTo(map);
    }
  }, [baseMapMode, showTrafficFlow, showTrafficIncidents]);

  const notifyMissingTomTomKey = () => {
    setMissingTomTomNotice(true);
    toast({
      title: "TomTom API Anahtarı Bekleniyor",
      description: TOMTOM_MISSING_KEY_MESSAGE,
    });
  };

  const handleToggleTrafficFlow = () => {
    if (!hasTomTomKey) {
      notifyMissingTomTomKey();
      return;
    }
    setMissingTomTomNotice(false);
    setShowTrafficFlow((prev) => !prev);
  };

  const handleToggleTrafficIncidents = () => {
    if (!hasTomTomKey) {
      notifyMissingTomTomKey();
      return;
    }
    setMissingTomTomNotice(false);
    setShowTrafficIncidents((prev) => !prev);
  };

  const handleToggleTomTomNight = () => {
    if (baseMapMode === "tomtom-night") {
      setBaseMapMode("carto-voyager");
      return;
    }
    if (!hasTomTomKey) {
      notifyMissingTomTomKey();
      return;
    }
    setMissingTomTomNotice(false);
    setBaseMapMode("tomtom-night");
  };

  return (
    <div 
      className={`relative w-full rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl bg-[#090d16] ${className}`}
      style={{ height }}
    >
      {/* Harita Katman Kontrol Menüsü (Sol Üst Floating Panel) */}
      <div className="absolute top-3 left-3 right-14 z-[1000] flex flex-col gap-1.5 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0b111e]/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-lg shadow-xl text-xs pointer-events-auto w-fit max-w-full">
          <span className="text-[10px] font-mono text-slate-400 px-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" /> Katmanlar:
          </span>
          <button
            type="button"
            onClick={() => setShowBoundaries(prev => !prev)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
              showBoundaries
                ? "bg-slate-800 text-emerald-400 border-emerald-500/50 font-bold"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="13 İlçe GeoJSON Sınır Poligonları"
          >
            🗺️ GeoJSON Sınırları
          </button>
          <button
            type="button"
            onClick={() => setShowDistrictPins(prev => !prev)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
              showDistrictPins
                ? "bg-slate-800 text-cyan-400 border-cyan-500/50 font-bold"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="13 İlçe Veri & İstatistik Pinleri"
          >
            📍 İlçe Veri Pinleri
          </button>
          <button
            type="button"
            onClick={() => setShowIncidents(prev => !prev)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
              showIncidents
                ? "bg-slate-800 text-amber-400 border-amber-500/50 font-bold"
                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white"
            }`}
            title="Canlı Olay Bildirimleri"
          >
            ⚡ Olaylar ({incidents.length})
          </button>

          <span className="hidden sm:inline-block h-4 w-px bg-slate-700/80 mx-0.5" />

          {/* TomTom Harita & Trafik Katmanları */}
          <button
            type="button"
            onClick={handleToggleTrafficFlow}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border flex items-center gap-1 ${
              showTrafficFlow
                ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/70 font-bold"
                : "bg-slate-900/70 text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-500"
            }`}
            title="TomTom Canlı Trafik Akışı (Raster Flow Tiles)"
          >
            <Navigation className="w-3 h-3 text-emerald-400" />
            <span>Canlı Trafik Akışı</span>
          </button>
          <button
            type="button"
            onClick={handleToggleTrafficIncidents}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border flex items-center gap-1 ${
              showTrafficIncidents
                ? "bg-amber-950/90 text-amber-300 border-amber-500/70 font-bold"
                : "bg-slate-900/70 text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-500"
            }`}
            title="TomTom Trafik Olayları (Kazalar ve Yol Çalışmaları)"
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Trafik Olayları</span>
          </button>
          <button
            type="button"
            onClick={handleToggleTomTomNight}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border flex items-center gap-1 ${
              baseMapMode === "tomtom-night"
                ? "bg-indigo-950/90 text-indigo-300 border-indigo-500/70 font-bold"
                : "bg-slate-900/70 text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-500"
            }`}
            title="TomTom Gece/Koyu Harita ve OSM/Carto altlığı arasında geçiş"
          >
            <Moon className="w-3 h-3 text-indigo-400" />
            <span>{baseMapMode === "tomtom-night" ? "OSM / Carto Altlık" : "TomTom Gece/Koyu Harita"}</span>
          </button>
        </div>

        {/* TomTom API Anahtarı Eksik Bilgi Rozeti */}
        {missingTomTomNotice && (
          <div className="pointer-events-auto flex items-center justify-between gap-2 max-w-xl bg-[#0b111e]/95 backdrop-blur-md border border-amber-500/60 text-amber-200 px-3 py-2 rounded-lg shadow-xl text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{TOMTOM_MISSING_KEY_MESSAGE}</span>
            </div>
            <button
              type="button"
              onClick={() => setMissingTomTomNotice(false)}
              className="text-amber-300/80 hover:text-white p-0.5 cursor-pointer"
              aria-label="Uyarıyı kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Harita Konteyneri */}
      <div ref={containerRef} className="w-full h-full z-10" />

      {/* Harita İçi Stil Kuralları */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.8; }
          70% { transform: scale(2.0); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .custom-district-tooltip {
          background-color: #0b111e !important;
          color: #f8fafc !important;
          border: 1px solid #334155 !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5) !important;
          padding: 4px 8px !important;
        }
        .custom-district-tooltip:before {
          border-top-color: #0b111e !important;
        }
        .custom-district-data-pin:hover > div {
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.6) !important;
          border-color: #38bdf8 !important;
        }
        .custom-leaflet-popup .leaflet-popup-content-wrapper {
          border-radius: 10px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          padding: 6px !important;
        }
      `}</style>
    </div>
  );
};
