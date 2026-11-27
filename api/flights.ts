import type { IncomingMessage, ServerResponse } from "node:http";

type VercelRequest = IncomingMessage & { method?: string; url?: string };
type VercelResponse = ServerResponse & {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
};

export interface FlightRecord {
  callsign: string;
  flight_no: string;
  airline: string;
  airport: "DLM" | "BJV";
  origin_or_dest: string;
  direction: "arrival" | "departure" | "approach";
  status: string;
  altitude_ft: number | null;
  speed_kts: number | null;
  distance_km: number | null;
  aircraft_type?: string;
  is_reference?: boolean;
}

export interface FlightsApiPayload {
  ok: true;
  source: "adsb" | "reference";
  fetched_at: string;
  total_active: number;
  airports: {
    DLM: {
      iata: "DLM";
      name: string;
      active_count: number;
      daily_reference_flights: number;
      flights: FlightRecord[];
    };
    BJV: {
      iata: "BJV";
      name: string;
      active_count: number;
      daily_reference_flights: number;
      flights: FlightRecord[];
    };
  };
  flights: FlightRecord[];
  reference_note?: string;
}

const AIRPORTS = [
  { iata: "DLM" as const, name: "Dalaman Havalimanı", lat: 36.7167, lon: 28.7833, dailyRef: 118 },
  { iata: "BJV" as const, name: "Milas-Bodrum Havalimanı", lat: 37.2529, lon: 27.6643, dailyRef: 104 },
];

const AIRLINE_MAP: Record<string, string> = {
  THY: "Türk Hava Yolları",
  PGT: "Pegasus",
  SXS: "SunExpress",
  VF: "AJet",
  TKJ: "AJet",
  OHY: "Onur Air",
  CXI: "Corendon",
  CAI: "Corendon",
  BAW: "British Airways",
  EZY: "easyJet",
  EXS: "Jet2",
  TOM: "TUI Airways",
  DLH: "Lufthansa",
  CFG: "Condor",
  RYR: "Ryanair",
};

const REFERENCE_FLIGHTS: FlightRecord[] = [
  {
    callsign: "THY2558",
    flight_no: "TK 2558",
    airline: "Türk Hava Yolları",
    airport: "DLM",
    origin_or_dest: "İstanbul (IST)",
    direction: "arrival",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "B738",
    is_reference: true,
  },
  {
    callsign: "PGT2292",
    flight_no: "PC 2292",
    airline: "Pegasus",
    airport: "DLM",
    origin_or_dest: "Sabiha Gökçen (SAW)",
    direction: "arrival",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "A20N",
    is_reference: true,
  },
  {
    callsign: "TKJ4136",
    flight_no: "VF 4136",
    airline: "AJet",
    airport: "DLM",
    origin_or_dest: "Ankara (ESB)",
    direction: "departure",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "B738",
    is_reference: true,
  },
  {
    callsign: "SXS512",
    flight_no: "XQ 512",
    airline: "SunExpress",
    airport: "DLM",
    origin_or_dest: "Londra (LGW)",
    direction: "arrival",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "B738",
    is_reference: true,
  },
  {
    callsign: "THY2514",
    flight_no: "TK 2514",
    airline: "Türk Hava Yolları",
    airport: "BJV",
    origin_or_dest: "İstanbul (IST)",
    direction: "arrival",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "A321",
    is_reference: true,
  },
  {
    callsign: "PGT2244",
    flight_no: "PC 2244",
    airline: "Pegasus",
    airport: "BJV",
    origin_or_dest: "Sabiha Gökçen (SAW)",
    direction: "departure",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "A21N",
    is_reference: true,
  },
  {
    callsign: "TKJ4122",
    flight_no: "VF 4122",
    airline: "AJet",
    airport: "BJV",
    origin_or_dest: "Ankara (ESB)",
    direction: "arrival",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "B738",
    is_reference: true,
  },
  {
    callsign: "EZY8841",
    flight_no: "U2 8841",
    airline: "easyJet",
    airport: "BJV",
    origin_or_dest: "Londra (LGW)",
    direction: "departure",
    status: "Planlı",
    altitude_ft: null,
    speed_kts: null,
    distance_km: null,
    aircraft_type: "A320",
    is_reference: true,
  },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferAirline(callsign: string): string {
  const clean = callsign.trim().toUpperCase();
  const prefix3 = clean.slice(0, 3);
  const prefix2 = clean.slice(0, 2);
  return AIRLINE_MAP[prefix3] || AIRLINE_MAP[prefix2] || "Ticari Uçuş";
}

async function fetchAdsbForAirport(airport: (typeof AIRPORTS)[number]): Promise<{
  reachable: boolean;
  flights: FlightRecord[];
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  try {
    const url = `https://opendata.adsb.fi/api/v3/lat/${airport.lat}/lon/${airport.lon}/dist/40`;
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "MuglaMonitor/2.0",
      },
    });
    if (!resp.ok) {
      return { reachable: false, flights: [] };
    }
    const json = (await resp.json()) as {
      ac?: Array<{
        flight?: string;
        hex?: string;
        lat?: number;
        lon?: number;
        alt_baro?: number | string;
        gs?: number;
        baro_rate?: number;
        t?: string;
      }>;
    };
    const acList = Array.isArray(json?.ac) ? json.ac : [];
    const flights: FlightRecord[] = [];
    for (const ac of acList) {
      if (typeof ac.lat !== "number" || typeof ac.lon !== "number") continue;
      const distKm = Math.round(haversineKm(airport.lat, airport.lon, ac.lat, ac.lon) * 10) / 10;
      // Transit filtre: 60 km dışı ve yüksek irtifa (22.000 ft üstü) transit geçişleri hariç tut
      const altFt = typeof ac.alt_baro === "number" ? Math.round(ac.alt_baro) : null;
      if (distKm > 60) continue;
      if (altFt !== null && altFt > 22000) continue;

      const rawCallsign = String(ac.flight || ac.hex || "").trim().toUpperCase();
      if (!rawCallsign) continue;
      const rate = typeof ac.baro_rate === "number" ? ac.baro_rate : 0;
      const direction: FlightRecord["direction"] =
        ac.alt_baro === "ground"
          ? "arrival"
          : rate < -250
          ? "arrival"
          : rate > 250
          ? "departure"
          : "approach";

      flights.push({
        callsign: rawCallsign,
        flight_no: rawCallsign,
        airline: inferAirline(rawCallsign),
        airport: airport.iata,
        origin_or_dest: `${airport.name} (${distKm} km)`,
        direction,
        status:
          ac.alt_baro === "ground"
            ? "Alanda"
            : direction === "arrival"
            ? "İniş Yaklaşması"
            : direction === "departure"
            ? "Tırmanışta"
            : "Bölge Trafiği",
        altitude_ft: altFt,
        speed_kts: typeof ac.gs === "number" ? Math.round(ac.gs) : null,
        distance_km: distKm,
        aircraft_type: typeof ac.t === "string" ? ac.t : undefined,
        is_reference: false,
      });
    }
    return { reachable: true, flights };
  } catch {
    return { reachable: false, flights: [] };
  } finally {
    clearTimeout(timer);
  }
}

let cachedPayload: { data: FlightsApiPayload; expiresAt: number } | null = null;

export function buildReferenceFlightsPayload(nowIso = new Date().toISOString()): FlightsApiPayload {
  const dlmFlights = REFERENCE_FLIGHTS.filter((f) => f.airport === "DLM");
  const bjvFlights = REFERENCE_FLIGHTS.filter((f) => f.airport === "BJV");
  return {
    ok: true,
    source: "reference",
    fetched_at: nowIso,
    total_active: REFERENCE_FLIGHTS.length,
    airports: {
      DLM: {
        iata: "DLM",
        name: "Dalaman Havalimanı",
        active_count: dlmFlights.length,
        daily_reference_flights: 118,
        flights: dlmFlights,
      },
      BJV: {
        iata: "BJV",
        name: "Milas-Bodrum Havalimanı",
        active_count: bjvFlights.length,
        daily_reference_flights: 104,
        flights: bjvFlights,
      },
    },
    flights: REFERENCE_FLIGHTS,
    reference_note: "DHMİ / DLM-BJV Referans Sefer Çizelgesi",
  };
}

export async function getFlightsPayload(): Promise<FlightsApiPayload> {
  const now = Date.now();
  if (cachedPayload && cachedPayload.expiresAt > now) {
    return cachedPayload.data;
  }

  const [dlmRes, bjvRes] = await Promise.all([
    fetchAdsbForAirport(AIRPORTS[0]),
    fetchAdsbForAirport(AIRPORTS[1]),
  ]);

  const nowIso = new Date().toISOString();

  if (dlmRes.reachable || bjvRes.reachable) {
    const allLive = [...dlmRes.flights, ...bjvRes.flights];
    // Radar erişilebilir ama şu an bölgede aktif uçuş yoksa dahi temiz yapı dön
    const payload: FlightsApiPayload = {
      ok: true,
      source: "adsb",
      fetched_at: nowIso,
      total_active: allLive.length,
      airports: {
        DLM: {
          iata: "DLM",
          name: "Dalaman Havalimanı",
          active_count: dlmRes.flights.length,
          daily_reference_flights: 118,
          flights: dlmRes.flights,
        },
        BJV: {
          iata: "BJV",
          name: "Milas-Bodrum Havalimanı",
          active_count: bjvRes.flights.length,
          daily_reference_flights: 104,
          flights: bjvRes.flights,
        },
      },
      flights: allLive,
    };
    cachedPayload = { data: payload, expiresAt: now + 60_000 };
    return payload;
  }

  const fallback = buildReferenceFlightsPayload(nowIso);
  cachedPayload = { data: fallback, expiresAt: now + 120_000 };
  return fallback;
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const payload = await getFlightsPayload();

  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(JSON.stringify(payload));
}
