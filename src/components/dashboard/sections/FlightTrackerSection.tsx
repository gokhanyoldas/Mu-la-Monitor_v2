import { useState, useEffect, useCallback } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { PlaneTakeoff, PlaneLanding, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Flight = {
  flightNo: string;
  airline: string;
  destination: string;
  scheduled: string;
  estimated: string;
  status: "on_time" | "delayed" | "landed" | "boarding" | "departed" | "cancelled" | "en_route" | "approach" | "transit";
  gate?: string;
  terminal?: string;
  // ADS-B canlı alanları (varsa)
  altitude?: number;
  velocity?: number;
  distance_km?: number;
  aircraft_type?: string;
  origin_country?: string;
  /** distance_km > 60 ise havalimanına inmiyor/kalkmıyor, sadece üstten geçiyor */
  is_transit?: boolean;
};

type AirportData = {
  code: string;
  name: string;
  departures: Flight[];
  arrivals: Flight[];
};

const statusLabels: Record<Flight["status"], string> = {
  on_time: "ZAMANINDA",
  delayed: "GECİKMELİ",
  landed: "İNDİ",
  boarding: "BİNİŞ",
  departed: "KALKTI",
  cancelled: "İPTAL",
  en_route: "HAVADA",
  approach: "İNİŞTE",
  transit: "GEÇİŞ",
};
const statusLabel = (s: string) => statusLabels[s as Flight["status"]] ?? "BİLİNMİYOR";

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
const statusColor = (s: string) => statusColors[s as Flight["status"]] ?? "text-muted-foreground bg-muted/30";

// Fallback mock data
const mockAirports: AirportData[] = [
  {
    code: "DLM",
    name: "Dalaman Havalimanı",
    departures: [
      { flightNo: "TK2846", airline: "THY", destination: "İstanbul (IST)", scheduled: "08:30", estimated: "08:30", status: "departed", gate: "A4", terminal: "İç" },
      { flightNo: "PC2234", airline: "Pegasus", destination: "İstanbul (SAW)", scheduled: "10:15", estimated: "10:40", status: "delayed", gate: "B2", terminal: "İç" },
      { flightNo: "XQ882", airline: "SunExpress", destination: "Düsseldorf", scheduled: "11:00", estimated: "11:00", status: "boarding", gate: "C1", terminal: "Dış" },
      { flightNo: "TK2850", airline: "THY", destination: "Ankara (ESB)", scheduled: "13:45", estimated: "13:45", status: "on_time", gate: "A2", terminal: "İç" },
      { flightNo: "EW9544", airline: "Eurowings", destination: "Köln", scheduled: "14:30", estimated: "14:30", status: "on_time", gate: "C3", terminal: "Dış" },
    ],
    arrivals: [
      { flightNo: "TK2845", airline: "THY", destination: "İstanbul (IST)", scheduled: "07:50", estimated: "07:45", status: "landed", terminal: "İç" },
      { flightNo: "XQ881", airline: "SunExpress", destination: "Düsseldorf", scheduled: "09:20", estimated: "09:35", status: "delayed", terminal: "Dış" },
      { flightNo: "PC2233", airline: "Pegasus", destination: "İstanbul (SAW)", scheduled: "11:45", estimated: "11:45", status: "on_time", terminal: "İç" },
      { flightNo: "LH1752", airline: "Lufthansa", destination: "Frankfurt", scheduled: "15:10", estimated: "15:10", status: "on_time", terminal: "Dış" },
    ],
  },
  {
    code: "BJV",
    name: "Milas-Bodrum Havalimanı",
    departures: [
      { flightNo: "TK2872", airline: "THY", destination: "İstanbul (IST)", scheduled: "07:00", estimated: "07:00", status: "departed", gate: "1", terminal: "İç" },
      { flightNo: "XQ502", airline: "SunExpress", destination: "Antalya", scheduled: "09:30", estimated: "09:30", status: "boarding", gate: "3", terminal: "İç" },
      { flightNo: "BA2800", airline: "British Airways", destination: "Londra (LGW)", scheduled: "12:00", estimated: "12:25", status: "delayed", gate: "5", terminal: "Dış" },
      { flightNo: "PC2286", airline: "Pegasus", destination: "İstanbul (SAW)", scheduled: "14:00", estimated: "14:00", status: "on_time", gate: "2", terminal: "İç" },
    ],
    arrivals: [
      { flightNo: "TK2871", airline: "THY", destination: "İstanbul (IST)", scheduled: "06:15", estimated: "06:10", status: "landed", terminal: "İç" },
      { flightNo: "BA2799", airline: "British Airways", destination: "Londra (LGW)", scheduled: "10:30", estimated: "10:55", status: "delayed", terminal: "Dış" },
      { flightNo: "XQ501", airline: "SunExpress", destination: "Antalya", scheduled: "13:00", estimated: "13:00", status: "on_time", terminal: "İç" },
    ],
  },
];

const FlightRow = ({ flight, type }: { flight: Flight; type: "dep" | "arr" }) => {
  // ADS-B canlı uçak: callsign + ülke + tip + irtifa/hız/mesafe
  const isLiveAircraft = flight.altitude !== undefined || flight.distance_km !== undefined;
  const displayStatus = flight.status;
  const detailLine = isLiveAircraft
    ? `${flight.aircraft_type ?? ""} · ${flight.altitude ? `${flight.altitude.toLocaleString()} ft` : ""} · ${flight.velocity ? `${flight.velocity} km/h` : ""}${flight.distance_km ? ` · ${flight.distance_km} km` : ""}`
    : (type === "dep" ? `→ ${flight.destination || "—"}` : `← ${flight.destination || "—"}`);

  return (
  <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/10 hover:bg-muted/25 transition-colors text-[10px] font-mono">
    <span className="w-14 font-bold text-foreground">{flight.flightNo}</span>
    <span className="w-16 text-muted-foreground truncate">{flight.airline}</span>
    <span className="flex-1 text-foreground/80 truncate" title={detailLine}>{detailLine}</span>
    <span className="w-10 text-center text-muted-foreground">{flight.scheduled}</span>
    <span className={`w-10 text-center font-semibold ${flight.estimated !== flight.scheduled ? "text-warning" : "text-foreground/60"}`}>
      {flight.estimated}
    </span>
    {flight.gate && <span className="w-8 text-center text-accent">{flight.gate}</span>}
    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${statusColor(displayStatus)}`}>
      {statusLabel(displayStatus)}
    </span>
  </div>
  );
};

export const FlightTrackerSection = () => {
  const [airports, setAirports] = useState<AirportData[]>(mockAirports);
  const [selectedAirport, setSelectedAirport] = useState(0);
  const [viewMode, setViewMode] = useState<"dep" | "arr">("dep");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("transport-scrape", {
        body: {},
      });
      if (!error && data?.airports?.length) {
        // transport-scrape alan adlarını Flight formatına normalize et
        const normalized = data.airports.map((ap: Record<string, unknown>) => ({
          code: String(ap.code ?? ""),
          name: String(ap.name ?? ""),
          departures: ((ap.departures as Record<string, unknown>[]) ?? []).map((f) => ({
            flightNo: String(f.flightNo ?? f.flight_no ?? f.callsign ?? ""),
            airline: String(f.airline ?? f.carrier ?? f.origin_country ?? ""),
            destination: String(f.destination ?? f.to ?? ""),
            scheduled: String(f.scheduled ?? f.std ?? ""),
            estimated: String(f.estimated ?? f.etd ?? f.scheduled ?? ""),
            status: String(f.status ?? (f.on_ground === false ? "en_route" : "on_time")),
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
            status: String(f.status ?? (f.on_ground === false ? "en_route" : "on_time")),
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
        setAirports(normalized);
        setLastUpdate(new Date().toLocaleTimeString("tr-TR", { hour12: false }));
      }
    } catch (err) {
      console.warn("[FlightTracker] transport-scrape erişilemedi, mock veriyle devam:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const airport = airports[selectedAirport];
  const flightsRaw = viewMode === "dep" ? airport.departures : airport.arrivals;
  // Yalnızca havalimanına gerçekten inen/kalkan uçaklar — transit (üstten geçen) elenir
  const flights = flightsRaw.filter(f => !f.is_transit);

  return (
    <DashboardPanel
      title="Uçuş Takip"
      icon={<PlaneTakeoff size={14} />}
      badge="CANLI"
      badgeVariant="live"
      count={flights.length}
    >
      {/* Airport selector + controls */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {airports.map((ap, i) => (
            <button
              key={ap.code}
              onClick={() => setSelectedAirport(i)}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
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
              onClick={() => setViewMode("dep")}
              className={`text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === "dep" ? "bg-accent/20 text-accent" : "text-muted-foreground"
              }`}
            >
              <PlaneTakeoff size={10} /> KALKIŞ
            </button>
            <button
              onClick={() => setViewMode("arr")}
              className={`text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                viewMode === "arr" ? "bg-accent/20 text-accent" : "text-muted-foreground"
              }`}
            >
              <PlaneLanding size={10} /> İNİŞ
            </button>
          </div>
          <button
            onClick={fetchLiveData}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {/* Airport name */}
      <div className="text-[9px] font-mono text-muted-foreground mb-2 flex items-center justify-between">
        <span>{airport.name}</span>
        {lastUpdate && <span>Güncelleme: {lastUpdate}</span>}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 text-[8px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
        <span className="w-14">Uçuş</span>
        <span className="w-16">Havayolu</span>
        <span className="flex-1">{viewMode === "dep" ? "Varış" : "Kalkış"}</span>
        <span className="w-10 text-center">Plan</span>
        <span className="w-10 text-center">Tahmin</span>
        <span className="w-8 text-center">Kapı</span>
        <span className="w-16 text-center">Durum</span>
      </div>

      {/* Flight rows */}
      <div className="space-y-1 max-h-[320px] overflow-y-auto">
        {flights.map((f) => (
          <FlightRow key={f.flightNo} flight={f} type={viewMode} />
        ))}
        {flights.length === 0 && (
          <p className="text-[10px] font-mono text-muted-foreground text-center py-4">
            Şu an bu havalimanına iniş/kalkış yapan uçak yok (transit uçaklar hariç)
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30">
        {["on_time", "delayed", "cancelled"].map((s) => {
          const count = flights.filter((f) => f.status === s).length;
          return (
            <span key={s} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${statusColors[s as Flight["status"]]}`}>
              {statusLabel(s)}: {count}
            </span>
          );
        })}
      </div>
    </DashboardPanel>
  );
};
