import { useState, useEffect, useCallback } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { PlaneTakeoff, PlaneLanding, RefreshCw, Loader2 } from "lucide-react";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";

type Flight = {
  flightNo: string;
  airline: string;
  destination: string;
  scheduled: string;
  estimated: string;
  status:
    | "on_time"
    | "delayed"
    | "landed"
    | "boarding"
    | "departed"
    | "cancelled"
    | "en_route"
    | "approach"
    | "transit";
  gate?: string;
  terminal?: string;
  altitude?: number;
  velocity?: number;
  distance_km?: number;
  aircraft_type?: string;
  origin_country?: string;
  is_transit?: boolean;
};

type AirportData = {
  code: string;
  name: string;
  departures: Flight[];
  arrivals: Flight[];
};

const REFERENCE_AIRPORTS: AirportData[] = [
  {
    code: "DLM",
    name: "Dalaman Havalimanı",
    departures: [
      { flightNo: "TK 2559", airline: "Türk Hava Yolları", destination: "İstanbul (IST)", scheduled: "10:15", estimated: "10:15", status: "on_time", gate: "D2" },
      { flightNo: "PC 2293", airline: "Pegasus", destination: "Sabiha Gökçen (SAW)", scheduled: "11:40", estimated: "11:40", status: "on_time", gate: "D4" },
      { flightNo: "VF 4136", airline: "AJet", destination: "Ankara (ESB)", scheduled: "13:20", estimated: "13:20", status: "on_time", gate: "D1" },
      { flightNo: "XQ 513", airline: "SunExpress", destination: "Londra (LGW)", scheduled: "15:05", estimated: "15:05", status: "on_time", gate: "I3" },
    ],
    arrivals: [
      { flightNo: "TK 2558", airline: "Türk Hava Yolları", destination: "İstanbul (IST)", scheduled: "09:30", estimated: "09:30", status: "on_time", gate: "D2" },
      { flightNo: "PC 2292", airline: "Pegasus", destination: "Sabiha Gökçen (SAW)", scheduled: "10:55", estimated: "10:55", status: "on_time", gate: "D4" },
      { flightNo: "XQ 512", airline: "SunExpress", destination: "Londra (LGW)", scheduled: "14:15", estimated: "14:15", status: "on_time", gate: "I3" },
      { flightNo: "VF 4135", airline: "AJet", destination: "Ankara (ESB)", scheduled: "12:35", estimated: "12:35", status: "on_time", gate: "D1" },
    ],
  },
  {
    code: "BJV",
    name: "Milas-Bodrum Havalimanı",
    departures: [
      { flightNo: "TK 2515", airline: "Türk Hava Yolları", destination: "İstanbul (IST)", scheduled: "10:45", estimated: "10:45", status: "on_time", gate: "A1" },
      { flightNo: "PC 2244", airline: "Pegasus", destination: "Sabiha Gökçen (SAW)", scheduled: "12:10", estimated: "12:10", status: "on_time", gate: "A3" },
      { flightNo: "VF 4123", airline: "AJet", destination: "Ankara (ESB)", scheduled: "14:00", estimated: "14:00", status: "on_time", gate: "A2" },
      { flightNo: "U2 8841", airline: "easyJet", destination: "Londra (LGW)", scheduled: "16:25", estimated: "16:25", status: "on_time", gate: "B2" },
    ],
    arrivals: [
      { flightNo: "TK 2514", airline: "Türk Hava Yolları", destination: "İstanbul (IST)", scheduled: "09:55", estimated: "09:55", status: "on_time", gate: "A1" },
      { flightNo: "PC 2243", airline: "Pegasus", destination: "Sabiha Gökçen (SAW)", scheduled: "11:25", estimated: "11:25", status: "on_time", gate: "A3" },
      { flightNo: "VF 4122", airline: "AJet", destination: "Ankara (ESB)", scheduled: "13:15", estimated: "13:15", status: "on_time", gate: "A2" },
      { flightNo: "U2 8840", airline: "easyJet", destination: "Londra (LGW)", scheduled: "15:40", estimated: "15:40", status: "on_time", gate: "B2" },
    ],
  },
];

const statusLabelsTr: Record<Flight["status"], string> = {
  on_time: "PLANLI",
  delayed: "GECİKMELİ",
  landed: "İNDİ",
  boarding: "BİNİŞ",
  departed: "KALKTI",
  cancelled: "İPTAL",
  en_route: "HAVADA",
  approach: "İNİŞTE",
  transit: "GEÇİŞ",
};
const statusLabelsEn: Record<Flight["status"], string> = {
  on_time: "SCHEDULED",
  delayed: "DELAYED",
  landed: "LANDED",
  boarding: "BOARDING",
  departed: "DEPARTED",
  cancelled: "CANCELLED",
  en_route: "AIRBORNE",
  approach: "APPROACH",
  transit: "TRANSIT",
};
const statusLabel = (s: string, isEn: boolean) =>
  (isEn ? statusLabelsEn : statusLabelsTr)[s as Flight["status"]] ?? (isEn ? "SCHEDULED" : "PLANLI");

const statusColors: Record<Flight["status"], string> = {
  on_time: "text-success bg-success/15",
  delayed: "text-warning bg-warning/15",
  landed: "text-primary bg-primary/15",
  boarding: "text-accent bg-accent/15",
  departed: "text-muted-foreground bg-muted/30",
  cancelled: "text-destructive bg-destructive/15",
  en_route: "text-cyan-400 bg-cyan-500/15",
  approach: "text-violet-400 bg-violet-500/15",
  transit: "text-slate-400 bg-slate-500/15",
};
const statusColor = (s: string) =>
  statusColors[s as Flight["status"]] ?? "text-muted-foreground bg-muted/30";

function normalizeStatus(raw: unknown): Flight["status"] {
  const s = String(raw || "").toLowerCase();
  if (s === "delayed" || s.includes("gecik")) return "delayed";
  if (s === "landed" || s.includes("alanda") || s.includes("indi")) return "landed";
  if (s === "boarding" || s.includes("biniş")) return "boarding";
  if (s === "departed" || s.includes("tırman") || s.includes("kalk")) return "departed";
  if (s === "cancelled" || s.includes("iptal")) return "cancelled";
  if (s === "approach" || s.includes("iniş") || s.includes("yaklaş")) return "approach";
  if (s === "en_route" || s.includes("havada") || s.includes("bölge")) return "en_route";
  return "on_time";
}

function normalizeProxyPayload(json: any): { airports: AirportData[]; isLive: boolean } | null {
  if (!json || typeof json !== "object" || !json.airports) return null;

  // Format 1: /api/flights object map { airports: { DLM: { name, flights }, BJV: { name, flights } }, source }
  if (!Array.isArray(json.airports) && (json.airports.DLM || json.airports.BJV)) {
    const isLive = json.source === "adsb";
    const list: AirportData[] = (["DLM", "BJV"] as const).map((code) => {
      const entry = json.airports[code];
      const rawFlights: any[] = Array.isArray(entry?.flights) ? entry.flights : [];
      const mapped: Flight[] = rawFlights.map((f) => ({
        flightNo: String(f.flight_no ?? f.callsign ?? ""),
        airline: String(f.airline ?? "Ticari Uçuş"),
        destination: String(f.origin_or_dest ?? code),
        scheduled: f.is_reference ? "Planlı" : "Canlı",
        estimated: f.is_reference ? "Planlı" : "Canlı",
        status: normalizeStatus(f.status),
        altitude: typeof f.altitude_ft === "number" ? f.altitude_ft : undefined,
        velocity: typeof f.speed_kts === "number" ? Math.round(f.speed_kts * 1.852) : undefined,
        distance_km: typeof f.distance_km === "number" ? f.distance_km : undefined,
        aircraft_type: typeof f.aircraft_type === "string" ? f.aircraft_type : undefined,
        is_transit: typeof f.distance_km === "number" ? f.distance_km > 60 : false,
      }));
      const departures = mapped.filter(
        (_, i) => rawFlights[i]?.direction === "departure" || rawFlights[i]?.direction === "approach"
      );
      const arrivals = mapped.filter((_, i) => rawFlights[i]?.direction === "arrival");
      return {
        code,
        name: String(entry?.name ?? (code === "DLM" ? "Dalaman Havalimanı" : "Milas-Bodrum Havalimanı")),
        departures: departures.length > 0 ? departures : mapped,
        arrivals: arrivals.length > 0 ? arrivals : mapped,
      };
    });
    return { airports: list, isLive };
  }

  // Format 2: transport-scrape array format
  if (Array.isArray(json.airports) && json.airports.length > 0) {
    const normalized: AirportData[] = json.airports.map((ap: Record<string, unknown>) => ({
      code: String(ap.code ?? ""),
      name: String(ap.name ?? ""),
      departures: ((ap.departures as Record<string, unknown>[]) ?? []).map((f) => ({
        flightNo: String(f.flightNo ?? f.flight_no ?? f.callsign ?? ""),
        airline: String(f.airline ?? f.carrier ?? f.origin_country ?? ""),
        destination: String(f.destination ?? f.to ?? ""),
        scheduled: String(f.scheduled ?? f.std ?? ""),
        estimated: String(f.estimated ?? f.etd ?? f.scheduled ?? ""),
        status: normalizeStatus(f.status ?? (f.on_ground === false ? "en_route" : "on_time")),
        gate: f.gate ? String(f.gate) : undefined,
        terminal: f.terminal ? String(f.terminal) : undefined,
        altitude: typeof f.altitude === "number" ? f.altitude : undefined,
        velocity: typeof f.velocity === "number" ? f.velocity : undefined,
        distance_km: typeof f.distance_km === "number" ? f.distance_km : undefined,
        aircraft_type: typeof f.aircraft_type === "string" ? f.aircraft_type : undefined,
        origin_country: typeof f.origin_country === "string" ? f.origin_country : undefined,
        is_transit: typeof f.distance_km === "number" ? f.distance_km > 60 : false,
      })),
      arrivals: ((ap.arrivals as Record<string, unknown>[]) ?? []).map((f) => ({
        flightNo: String(f.flightNo ?? f.flight_no ?? f.callsign ?? ""),
        airline: String(f.airline ?? f.carrier ?? f.origin_country ?? ""),
        destination: String(f.origin ?? f.from ?? ""),
        scheduled: String(f.scheduled ?? f.sta ?? ""),
        estimated: String(f.estimated ?? f.eta ?? f.scheduled ?? ""),
        status: normalizeStatus(f.status ?? (f.on_ground === false ? "en_route" : "on_time")),
        gate: f.gate ? String(f.gate) : undefined,
        terminal: f.terminal ? String(f.terminal) : undefined,
        altitude: typeof f.altitude === "number" ? f.altitude : undefined,
        velocity: typeof f.velocity === "number" ? f.velocity : undefined,
        distance_km: typeof f.distance_km === "number" ? f.distance_km : undefined,
        aircraft_type: typeof f.aircraft_type === "string" ? f.aircraft_type : undefined,
        origin_country: typeof f.origin_country === "string" ? f.origin_country : undefined,
        is_transit: typeof f.distance_km === "number" ? f.distance_km > 60 : false,
      })),
    }));
    return { airports: normalized, isLive: true };
  }

  return null;
}

const FlightRow = ({ flight, type, isEn }: { flight: Flight; type: "dep" | "arr"; isEn: boolean }) => {
  const isLiveAircraft = flight.altitude !== undefined || flight.distance_km !== undefined;
  const displayStatus = flight.status;
  const detailLine = isLiveAircraft
    ? `${flight.aircraft_type ?? ""} · ${flight.altitude ? `${Number(flight.altitude).toLocaleString()} ft` : ""} · ${flight.velocity ? `${flight.velocity} km/h` : ""}${flight.distance_km ? ` · ${flight.distance_km} km` : ""}`
    : type === "dep"
    ? `→ ${flight.destination || "—"}`
    : `← ${flight.destination || "—"}`;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/10 hover:bg-muted/25 transition-colors text-[10px] font-mono">
      <span className="w-14 font-bold text-foreground">{flight.flightNo}</span>
      <span className="w-20 text-muted-foreground truncate">{flight.airline}</span>
      <span className="flex-1 text-foreground/80 truncate" title={detailLine}>
        {detailLine}
      </span>
      <span className="w-10 text-center text-muted-foreground">{flight.scheduled}</span>
      <span
        className={`w-10 text-center font-semibold ${
          flight.estimated !== flight.scheduled ? "text-warning" : "text-foreground/60"
        }`}
      >
        {flight.estimated}
      </span>
      {flight.gate && <span className="w-8 text-center text-accent">{flight.gate}</span>}
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${statusColor(displayStatus)}`}>
        {statusLabel(displayStatus, isEn)}
      </span>
    </div>
  );
};

export const FlightTrackerSection = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const [airports, setAirports] = useState<AirportData[]>(REFERENCE_AIRPORTS);
  const [isLiveSource, setIsLiveSource] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState(0);
  const [viewMode, setViewMode] = useState<"dep" | "arr">("dep");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Sunucu taraflı /api/flights proxy (CORS engeli olmadan canlı ADS-B + temiz DHMİ referans fallback)
      if (typeof fetch === "function") {
        try {
          const resp = await fetch("/api/flights");
          if (resp.ok) {
            const json = await resp.json();
            const parsed = normalizeProxyPayload(json);
            if (parsed && parsed.airports.length > 0) {
              setAirports(parsed.airports);
              setIsLiveSource(parsed.isLive);
              setLastUpdate(new Date().toLocaleTimeString("tr-TR", { hour12: false }));
              return;
            }
          }
        } catch {
          // /api/flights erişilemezse Supabase cache / referans fallback'e geç
        }
      }

      // 2. Supabase live_data_cache / transport-scrape fallback
      if (isSupabaseClientConfigured) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        let payload: any = null;
        if (session?.access_token) {
          const { data, error } = await supabase.functions.invoke("transport-scrape", {
            body: { type: "flights", source: "adsb" },
          });
          if (!error && data?.airports?.length) payload = data;
        } else {
          const { data: cache } = await supabase
            .from("live_data_cache")
            .select("data")
            .eq("data_type", "flights")
            .maybeSingle();
          if ((cache?.data as any)?.airports?.length) payload = cache!.data;
        }
        const parsed = normalizeProxyPayload(payload);
        if (parsed && parsed.airports.length > 0) {
          setAirports(parsed.airports);
          setIsLiveSource(true);
          setLastUpdate(new Date().toLocaleTimeString("tr-TR", { hour12: false }));
          return;
        }
      }

      // 3. Temiz DHMİ / DLM-BJV Referans Sefer Çizelgesi (teknik hata metni asla gösterilmez)
      setAirports(REFERENCE_AIRPORTS);
      setIsLiveSource(false);
    } catch {
      setAirports(REFERENCE_AIRPORTS);
      setIsLiveSource(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const airport = airports[selectedAirport] ?? REFERENCE_AIRPORTS[0];
  const pool =
    viewMode === "arr" && airport.arrivals.length > 0 ? airport.arrivals : airport.departures;
  const flights = pool.filter((f) => !f.is_transit);

  return (
    <DashboardPanel
      title="Uçuş Takip"
      icon={<PlaneTakeoff size={14} />}
      badge={isLiveSource ? "CANLI" : "REFERANS VERİ"}
      badgeVariant={isLiveSource ? "live" : "info"}
      count={flights.length}
    >
      {/* Airport selector + controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {airports.map((ap, i) => (
            <button
              key={ap.code}
              type="button"
              onClick={() => setSelectedAirport(i)}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selectedAirport === i
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {ap.code}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setViewMode("dep")}
              className={`text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                viewMode === "dep" ? "bg-accent/20 text-accent" : "text-muted-foreground"
              }`}
            >
              <PlaneTakeoff size={10} /> {isEn ? "DEPARTURES" : "KALKIŞ"}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("arr")}
              className={`text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                viewMode === "arr" ? "bg-accent/20 text-accent" : "text-muted-foreground"
              }`}
            >
              <PlaneLanding size={10} /> {isEn ? "ARRIVALS" : "İNİŞ"}
            </button>
          </div>
          <button
            type="button"
            onClick={fetchLiveData}
            disabled={loading}
            aria-label={isEn ? "Refresh flight data" : "Uçuş verisini yenile"}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {/* Airport name */}
      <div className="text-[9px] font-mono text-muted-foreground mb-2 flex items-center justify-between">
        <span>
          {airport.name}
          {!isLiveSource && (
            <span className="ml-1.5 text-[8px] text-primary/80">
              · {isEn ? "DHMİ Reference Schedule" : "DHMİ Referans Sefer Durumu"}
            </span>
          )}
        </span>
        {lastUpdate && (
          <span>
            {isEn ? "Updated:" : "Güncelleme:"} {lastUpdate}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 text-[8px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
        <span className="w-14">{isEn ? "Flight" : "Uçuş"}</span>
        <span className="w-20">{isEn ? "Airline" : "Havayolu"}</span>
        <span className="flex-1">{isEn ? "Route / Aircraft" : "Rota / Uçak"}</span>
        <span className="w-10 text-center">{isEn ? "Sched" : "Plan"}</span>
        <span className="w-10 text-center">{isEn ? "Est" : "Tahmin"}</span>
        <span className="w-8 text-center">{isEn ? "Gate" : "Kapı"}</span>
        <span className="w-16 text-center">{isEn ? "Status" : "Durum"}</span>
      </div>

      {/* Flight rows */}
      <div className="space-y-1 max-h-[320px] overflow-y-auto">
        {flights.map((f, idx) => (
          <FlightRow key={`${f.flightNo}-${idx}`} flight={f} type={viewMode} isEn={isEn} />
        ))}
        {flights.length === 0 && (
          <p className="text-[10px] font-mono text-muted-foreground text-center py-4">
            {isEn
              ? "No active approach/departure aircraft detected right now (transit flights excluded)."
              : "Şu an bu havalimanında aktif iniş/kalkış trafiği bulunmuyor (transit uçuşlar hariç)."}
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 flex-wrap">
        {["on_time", "delayed", "cancelled"].map((s) => {
          const count = flights.filter((f) => f.status === s).length;
          return (
            <span
              key={s}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${statusColors[s as Flight["status"]]}`}
            >
              {statusLabel(s, isEn)}: {count}
            </span>
          );
        })}
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">
          {isLiveSource
            ? isEn
              ? "Live ADS-B Radar (DLM / BJV)"
              : "Canlı ADS-B Radar (DLM / BJV)"
            : isEn
            ? "Reference: DHMİ DLM/BJV Schedule"
            : "Kaynak: DHMİ / DLM-BJV Referans"}
        </span>
      </div>
    </DashboardPanel>
  );
};
