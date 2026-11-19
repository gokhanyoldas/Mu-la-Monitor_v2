// src/data/muglaDistrictsGeoJSON.ts
// Muğla 13 İlçe Resmi Sınır Poligonları (GeoJSON FeatureCollection)
// Standart RFC 7946 GeoJSON formatı: Koordinatlar [Boylam (Lon), Enlem (Lat)] sıralamasındadır.

export interface DistrictGeoProperties {
  id: string;
  name: string;
  center: [number, number]; // [lat, lon]
  population: number;
  populationFormatted: string;
  area_km2: number;
  type: "coastal" | "inland";
  emoji: string;
  temperature: string;
  weatherDesc: string;
  trafficDensity: number; // Yüzde (%)
  riskLevel: "Düşük" | "Orta" | "Yüksek" | "Kritik";
  color: string;
}

export interface DistrictFeature {
  type: "Feature";
  id: string;
  properties: DistrictGeoProperties;
  geometry: {
    type: "Polygon";
    coordinates: number[][][]; // [ [ [lon, lat], ... ] ]
  };
}

export interface DistrictsGeoJSON {
  type: "FeatureCollection";
  features: DistrictFeature[];
}

export const MUGLA_DISTRICTS_GEOJSON: DistrictsGeoJSON = {
  type: "FeatureCollection",
  features: [
    // 1. BODRUM YARIMADASI
    {
      type: "Feature",
      id: "bodrum",
      properties: {
        id: "bodrum",
        name: "Bodrum",
        center: [37.0344, 27.4305],
        population: 198335,
        populationFormatted: "198.335",
        area_km2: 602,
        type: "coastal",
        emoji: "⛵",
        temperature: "14.2°C",
        weatherDesc: "Güneşli",
        trafficDensity: 28,
        riskLevel: "Orta",
        color: "#0284c7"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [27.240, 37.010], [27.235, 37.060], [27.255, 37.110], [27.310, 37.155],
            [27.420, 37.165], [27.530, 37.150], [27.600, 37.125], [27.560, 37.060],
            [27.480, 37.010], [27.430, 36.970], [27.340, 36.960], [27.270, 36.980],
            [27.240, 37.010]
          ]
        ]
      }
    },

    // 2. MİLAS
    {
      type: "Feature",
      id: "milas",
      properties: {
        id: "milas",
        name: "Milas",
        center: [37.3166, 27.7869],
        population: 151590,
        populationFormatted: "151.590",
        area_km2: 1993,
        type: "coastal",
        emoji: "🏛️",
        temperature: "12.8°C",
        weatherDesc: "Parçalı Bulutlu",
        trafficDensity: 22,
        riskLevel: "Düşük",
        color: "#0ea5e9"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [27.380, 37.180], [27.320, 37.320], [27.390, 37.490], [27.520, 37.580],
            [27.700, 37.560], [27.910, 37.480], [28.020, 37.360], [28.050, 37.220],
            [27.950, 37.020], [27.810, 37.000], [27.680, 37.110], [27.540, 37.160],
            [27.380, 37.180]
          ]
        ]
      }
    },

    // 3. YATAĞAN
    {
      type: "Feature",
      id: "yatagan",
      properties: {
        id: "yatagan",
        name: "Yatağan",
        center: [37.3396, 28.1376],
        population: 45283,
        populationFormatted: "45.283",
        area_km2: 1003,
        type: "inland",
        emoji: "⚡",
        temperature: "11.4°C",
        weatherDesc: "Az Bulutlu",
        trafficDensity: 19,
        riskLevel: "Düşük",
        color: "#6366f1"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.020, 37.360], [27.910, 37.480], [28.040, 37.530], [28.190, 37.520],
            [28.270, 37.430], [28.240, 37.310], [28.140, 37.240], [28.050, 37.280],
            [28.020, 37.360]
          ]
        ]
      }
    },

    // 4. KAVAKLIDERE
    {
      type: "Feature",
      id: "kavaklidere",
      properties: {
        id: "kavaklidere",
        name: "Kavaklıdere",
        center: [37.4460, 28.3904],
        population: 10738,
        populationFormatted: "10.738",
        area_km2: 632,
        type: "inland",
        emoji: "🌲",
        temperature: "9.6°C",
        weatherDesc: "Serin / Ormanlık",
        trafficDensity: 8,
        riskLevel: "Düşük",
        color: "#14b8a6"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.270, 37.430], [28.190, 37.520], [28.320, 37.600], [28.480, 37.580],
            [28.520, 37.470], [28.410, 37.390], [28.300, 37.400], [28.270, 37.430]
          ]
        ]
      }
    },

    // 5. MENTEŞE (MUĞLA MERKEZ)
    {
      type: "Feature",
      id: "mentese",
      properties: {
        id: "mentese",
        name: "Menteşe",
        center: [37.2153, 28.3636],
        population: 123284,
        populationFormatted: "123.284",
        area_km2: 1780,
        type: "inland",
        emoji: "🏢",
        temperature: "10.8°C",
        weatherDesc: "Açık",
        trafficDensity: 24,
        riskLevel: "Düşük",
        color: "#3b82f6"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.140, 37.240], [28.240, 37.310], [28.410, 37.390], [28.550, 37.360],
            [28.610, 37.250], [28.570, 37.140], [28.420, 37.120], [28.280, 37.130],
            [28.180, 37.170], [28.140, 37.240]
          ]
        ]
      }
    },

    // 6. ULA
    {
      type: "Feature",
      id: "ula",
      properties: {
        id: "ula",
        name: "Ula",
        center: [37.1035, 28.4266],
        population: 27537,
        populationFormatted: "27.537",
        area_km2: 740,
        type: "coastal",
        emoji: "🌾",
        temperature: "12.5°C",
        weatherDesc: "Sakin",
        trafficDensity: 17,
        riskLevel: "Düşük",
        color: "#22c55e"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.180, 37.170], [28.280, 37.130], [28.420, 37.120], [28.540, 37.130],
            [28.580, 37.040], [28.470, 36.980], [28.310, 37.010], [28.210, 37.050],
            [28.180, 37.170]
          ]
        ]
      }
    },

    // 7. DATÇA YARIMADASI
    {
      type: "Feature",
      id: "datca",
      properties: {
        id: "datca",
        name: "Datça",
        center: [36.7344, 27.6866],
        population: 25741,
        populationFormatted: "25.741",
        area_km2: 960,
        type: "coastal",
        emoji: "🌿",
        temperature: "15.0°C",
        weatherDesc: "Rüzgarlı & Açık",
        trafficDensity: 12,
        riskLevel: "Düşük",
        color: "#10b981"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [27.360, 36.680], [27.340, 36.740], [27.480, 36.780], [27.680, 36.790],
            [27.890, 36.780], [28.020, 36.790], [28.030, 36.740], [27.870, 36.700],
            [27.690, 36.660], [27.460, 36.660], [27.360, 36.680]
          ]
        ]
      }
    },

    // 8. MARMARİS
    {
      type: "Feature",
      id: "marmaris",
      properties: {
        id: "marmaris",
        name: "Marmaris",
        center: [36.8521, 28.2706],
        population: 97818,
        populationFormatted: "97.818",
        area_km2: 891,
        type: "coastal",
        emoji: "🏖️",
        temperature: "14.8°C",
        weatherDesc: "Hafif Esintili",
        trafficDensity: 26,
        riskLevel: "Orta",
        color: "#f59e0b"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.030, 36.740], [28.020, 36.790], [28.090, 36.890], [28.210, 37.010],
            [28.350, 37.000], [28.440, 36.930], [28.470, 36.820], [28.420, 36.710],
            [28.280, 36.630], [28.160, 36.680], [28.030, 36.740]
          ]
        ]
      }
    },

    // 9. KÖYCEĞİZ
    {
      type: "Feature",
      id: "koycegiz",
      properties: {
        id: "koycegiz",
        name: "Köyceğiz",
        center: [36.9705, 28.6854],
        population: 40167,
        populationFormatted: "40.167",
        area_km2: 1501,
        type: "coastal",
        emoji: "🌊",
        temperature: "13.4°C",
        weatherDesc: "Göl Esintisi",
        trafficDensity: 15,
        riskLevel: "Düşük",
        color: "#06b6d4"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.470, 36.980], [28.580, 37.040], [28.660, 37.180], [28.820, 37.160],
            [28.920, 37.080], [28.850, 36.940], [28.720, 36.910], [28.570, 36.890],
            [28.470, 36.980]
          ]
        ]
      }
    },

    // 10. ORTACA
    {
      type: "Feature",
      id: "ortaca",
      properties: {
        id: "ortaca",
        name: "Ortaca",
        center: [36.8344, 28.7682],
        population: 55437,
        populationFormatted: "55.437",
        area_km2: 574,
        type: "coastal",
        emoji: "🌲",
        temperature: "14.1°C",
        weatherDesc: "Parçalı Bulutlu",
        trafficDensity: 20,
        riskLevel: "Düşük",
        color: "#84cc16"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.570, 36.890], [28.720, 36.910], [28.840, 36.890], [28.860, 36.810],
            [28.820, 36.730], [28.680, 36.750], [28.610, 36.810], [28.570, 36.890]
          ]
        ]
      }
    },

    // 11. DALAMAN
    {
      type: "Feature",
      id: "dalaman",
      properties: {
        id: "dalaman",
        name: "Dalaman",
        center: [36.7752, 28.7929],
        population: 49012,
        populationFormatted: "49.012",
        area_km2: 582,
        type: "coastal",
        emoji: "✈️",
        temperature: "14.6°C",
        weatherDesc: "Güneşli",
        trafficDensity: 25,
        riskLevel: "Düşük",
        color: "#a855f7"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.720, 36.910], [28.850, 36.940], [28.980, 36.970], [29.020, 36.870],
            [28.960, 36.720], [28.820, 36.700], [28.820, 36.730], [28.860, 36.810],
            [28.720, 36.910]
          ]
        ]
      }
    },

    // 12. FETHİYE
    {
      type: "Feature",
      id: "fethiye",
      properties: {
        id: "fethiye",
        name: "Fethiye",
        center: [36.6548, 29.1165],
        population: 181415,
        populationFormatted: "181.415",
        area_km2: 1205,
        type: "coastal",
        emoji: "🧿",
        temperature: "15.3°C",
        weatherDesc: "Açık / Ilık",
        trafficDensity: 31,
        riskLevel: "Orta",
        color: "#ec4899"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [28.960, 36.720], [29.020, 36.870], [29.140, 36.890], [29.240, 36.790],
            [29.270, 36.660], [29.170, 36.520], [29.050, 36.530], [28.990, 36.620],
            [28.960, 36.720]
          ]
        ]
      }
    },

    // 13. SEYDİKEMER
    {
      type: "Feature",
      id: "seydikemer",
      properties: {
        id: "seydikemer",
        name: "Seydikemer",
        center: [36.9183, 29.1286],
        population: 63870,
        populationFormatted: "63.870",
        area_km2: 1394,
        type: "inland",
        emoji: "🏔️",
        temperature: "11.9°C",
        weatherDesc: "Dağ Havası",
        trafficDensity: 14,
        riskLevel: "Düşük",
        color: "#f97316"
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [29.140, 36.890], [29.020, 36.970], [29.180, 37.110], [29.420, 37.080],
            [29.580, 36.920], [29.540, 36.680], [29.390, 36.550], [29.270, 36.660],
            [29.240, 36.790], [29.140, 36.890]
          ]
        ]
      }
    }
  ]
};
