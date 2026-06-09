import { useEffect, useRef, useState } from "react";
import { useLiveData } from "@/hooks/useLiveData";

interface EarthquakeFeature {
  properties: {
    mag: number;
    place: string;
    time: number;
    url: string;
  };
  geometry: {
    coordinates: [number, number, number]; // lon, lat, depth
  };
}

interface MapPoint {
  name: string;
  lat: number;
  lng: number;
  type: "district" | "earthquake" | "alert";
  info?: string;
  severity?: "low" | "medium" | "high" | "critical";
  url?: string;
}

const MUGLA_CENTER = { lat: 37.0, lng: 28.3 };

const DISTRICTS: MapPoint[] = [
  { name: "Muğla Merkez", lat: 37.2153, lng: 28.3636, type: "district" },
  { name: "Bodrum", lat: 37.0344, lng: 27.4267, type: "district" },
  { name: "Marmaris", lat: 36.8508, lng: 28.2731, type: "district" },
  { name: "Fethiye", lat: 36.6184, lng: 29.1078, type: "district" },
  { name: "Milas", lat: 37.3170, lng: 27.7833, type: "district" },
  { name: "Datça", lat: 36.7264, lng: 27.6861, type: "district" },
  { name: "Dalaman", lat: 36.7676, lng: 28.7997, type: "district" },
  { name: "Ortaca", lat: 36.8419, lng: 28.7733, type: "district" },
  { name: "Seydikemer", lat: 36.6417, lng: 29.3528, type: "district" },
  { name: "Menteşe", lat: 37.2028, lng: 28.3661, type: "district" },
  { name: "Kavaklıdere", lat: 37.4333, lng: 28.3833, type: "district" },
  { name: "Köyceğiz", lat: 36.9678, lng: 28.6842, type: "district" },
  { name: "Yatağan", lat: 37.3333, lng: 28.1333, type: "district" },
];

export const LiveMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [earthquakes, setEarthquakes] = useState<MapPoint[]>([]);
  const mapInstance = useRef<any>(null);

  // Fetch earthquake data
  const { data: eqData } = useLiveData<{ earthquakes: EarthquakeFeature[] }>("earthquakes", {
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (eqData?.earthquakes) {
      const points: MapPoint[] = eqData.earthquakes.map((eq) => {
        const mag = eq.properties.mag;
        return {
          name: eq.properties.place || "Deprem",
          lat: eq.geometry.coordinates[1],
          lng: eq.geometry.coordinates[0],
          type: "earthquake" as const,
          info: `M${mag.toFixed(1)} - ${new Date(eq.properties.time).toLocaleString("tr-TR")}`,
          severity: mag >= 5 ? "critical" : mag >= 4 ? "high" : mag >= 3 ? "medium" : "low",
          url: eq.properties.url,
        };
      });
      setEarthquakes(points);
    }
  }, [eqData]);

  // Load Leaflet dynamically
  useEffect(() => {
    if (mapLoaded || !mapContainer.current) return;

    const loadLeaflet = async () => {
      // Check if already loaded
      if ((window as any).L) {
        initMap();
        return;
      }

      // Load CSS
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);

      // Load JS
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        initMap();
      };
      document.head.appendChild(script);
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const initMap = () => {
    if (!mapContainer.current || mapInstance.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapContainer.current, {
      center: [MUGLA_CENTER.lat, MUGLA_CENTER.lng],
      zoom: 9,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer (free, no API key)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 18,
      subdomains: "abcd",
    }).addTo(map);

    // Add attribution
    L.control.attribution({ position: "bottomright" })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    mapInstance.current = map;
    setMapLoaded(true);
  };

  // Update markers when data changes
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstance.current;

    // Clear existing markers (except tile layer)
    map.eachLayer((layer: any) => {
      if (layer._url === undefined && layer._container === undefined) {
        // Skip tile layers
      }
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    // Add district markers
    DISTRICTS.forEach((d) => {
      const marker = L.circleMarker([d.lat, d.lng], {
        radius: 6,
        fillColor: "#06b6d4",
        fillOpacity: 0.7,
        color: "#0891b2",
        weight: 1,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: monospace; font-size: 11px;">
          <strong>${d.name}</strong><br/>
          <span style="color: #06b6d4;">İlçe Merkezi</span>
        </div>
      `);

      // Label
      L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: "district-label",
          html: `<span style="font-family: monospace; font-size: 9px; color: #94a3b8; text-shadow: 0 0 3px rgba(0,0,0,0.8); white-space: nowrap;">${d.name}</span>`,
          iconSize: [0, 0],
          iconAnchor: [-8, 0],
        }),
      }).addTo(map);
    });

    // Add earthquake markers
    earthquakes.forEach((eq) => {
      const colors: Record<string, string> = {
        critical: "#ef4444",
        high: "#f97316",
        medium: "#eab308",
        low: "#84cc16",
      };
      const sizes: Record<string, number> = {
        critical: 14,
        high: 10,
        medium: 7,
        low: 5,
      };

      const color = colors[eq.severity || "low"];
      const radius = sizes[eq.severity || "low"];

      const marker = L.circleMarker([eq.lat, eq.lng], {
        radius,
        fillColor: color,
        fillOpacity: 0.8,
        color,
        weight: 2,
        className: eq.severity === "critical" || eq.severity === "high" ? "earthquake-pulse" : "",
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: monospace; font-size: 11px;">
          <strong style="color: ${color};">🔴 ${eq.name}</strong><br/>
          <span>${eq.info}</span><br/>
          ${eq.url ? `<a href="${eq.url}" target="_blank" style="color: #60a5fa;">Detay →</a>` : ""}
        </div>
      `);
    });
  }, [mapLoaded, earthquakes]);

  return (
    <div className="relative w-full h-full min-h-[350px]">
      <div ref={mapContainer} className="w-full h-full min-h-[350px] rounded-lg overflow-hidden" />
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-background/90 backdrop-blur-sm border border-border/50 rounded p-2 text-[9px] font-mono">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
          <span className="text-muted-foreground">İlçe</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-muted-foreground">Deprem {"<"}3.0</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
          <span className="text-muted-foreground">Deprem 3-4</span>
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
          <span className="text-muted-foreground">Deprem 4-5</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-muted-foreground">Deprem 5+</span>
        </div>
      </div>

      {/* Status */}
      <div className="absolute top-2 right-2 z-[1000] bg-background/90 backdrop-blur-sm border border-border/50 rounded px-2 py-1">
        <span className="text-[9px] font-mono text-muted-foreground">
          {earthquakes.length > 0 ? `🔴 ${earthquakes.length} deprem (7 gün)` : "Veri yükleniyor..."}
        </span>
      </div>

      {/* Add CSS for pulsing */}
      <style>{`
        .earthquake-pulse {
          animation: pulse-ring 2s ease-out infinite;
        }
        @keyframes pulse-ring {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
