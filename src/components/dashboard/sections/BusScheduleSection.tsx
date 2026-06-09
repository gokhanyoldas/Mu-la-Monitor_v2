import { useState, useEffect, useCallback } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { Bus, RefreshCw, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type BusRoute = {
  carrier: string;
  from: string;
  to: string;
  departures: string[];
  duration: string;
  price: string;
  type: "şehirlerarası" | "ilçe";
};

const mockRoutes: BusRoute[] = [
  { carrier: "Muğla Koop.", from: "Muğla", to: "Bodrum", departures: ["06:00","07:30","09:00","10:30","12:00","13:30","15:00","16:30","18:00","19:30"], duration: "2s 45dk", price: "₺180", type: "ilçe" },
  { carrier: "Muğla Koop.", from: "Muğla", to: "Fethiye", departures: ["06:30","08:00","09:30","11:00","13:00","15:00","17:00","19:00"], duration: "2s 15dk", price: "₺150", type: "ilçe" },
  { carrier: "Muğla Koop.", from: "Muğla", to: "Marmaris", departures: ["07:00","08:30","10:00","12:00","14:00","16:00","18:00","20:00"], duration: "1s 30dk", price: "₺120", type: "ilçe" },
  { carrier: "Muğla Koop.", from: "Muğla", to: "Dalaman", departures: ["07:00","09:00","11:00","14:00","16:30","19:00"], duration: "1s 45dk", price: "₺130", type: "ilçe" },
  { carrier: "Muğla Koop.", from: "Muğla", to: "Milas", departures: ["06:30","07:30","08:30","09:30","10:30","11:30","13:00","14:30","16:00","17:30","19:00"], duration: "45dk", price: "₺70", type: "ilçe" },
  { carrier: "Pamukkale", from: "Muğla", to: "İstanbul", departures: ["08:00","14:00","20:00","22:00"], duration: "11s", price: "₺650", type: "şehirlerarası" },
  { carrier: "Kamil Koç", from: "Muğla", to: "Ankara", departures: ["09:00","17:00","21:00","23:00"], duration: "9s 30dk", price: "₺550", type: "şehirlerarası" },
  { carrier: "Metro", from: "Muğla", to: "İzmir", departures: ["06:00","08:00","10:00","12:00","14:00","16:00","18:00","20:00"], duration: "3s 30dk", price: "₺250", type: "şehirlerarası" },
  { carrier: "Pamukkale", from: "Muğla", to: "Antalya", departures: ["07:30","10:00","13:00","16:00","19:00"], duration: "4s", price: "₺300", type: "şehirlerarası" },
  { carrier: "Kamil Koç", from: "Muğla", to: "Denizli", departures: ["07:00","09:30","12:00","15:00","18:00"], duration: "3s", price: "₺200", type: "şehirlerarası" },
];

const getNextDeparture = (departures: string[]) => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const d of departures) {
    const [h, m] = d.split(":").map(Number);
    if (h * 60 + m > nowMin) return d;
  }
  return departures[0]; // tomorrow's first
};

export const BusScheduleSection = () => {
  const [routes, setRoutes] = useState<BusRoute[]>(mockRoutes);
  const [filter, setFilter] = useState<"all" | "ilçe" | "şehirlerarası">("all");
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("transport-scrape", {
        body: { type: "bus" },
      });
      if (!error && data?.routes?.length) {
        setRoutes(data.routes);
        setLastUpdate(new Date().toLocaleTimeString("tr-TR", { hour12: false }));
      }
    } catch {
      // keep mock
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const filtered = filter === "all" ? routes : routes.filter((r) => r.type === filter);

  return (
    <DashboardPanel
      title="Otobüs Seferleri"
      icon={<Bus size={14} />}
      badge="GÜNCEL"
      badgeVariant="active"
      count={filtered.length}
    >
      {/* Filters */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {([["all", "Tümü"], ["ilçe", "İlçe"], ["şehirlerarası", "Şehirlerarası"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
                filter === val
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && <span className="text-[8px] font-mono text-muted-foreground">{lastUpdate}</span>}
          <button
            onClick={fetchLiveData}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {/* Routes */}
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {filtered.map((route, i) => {
          const next = getNextDeparture(route.departures);
          return (
            <div key={i} className="px-2.5 py-2 rounded bg-muted/10 hover:bg-muted/25 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-foreground">{route.from} → {route.to}</span>
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${
                    route.type === "ilçe" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"
                  }`}>
                    {route.type === "ilçe" ? "İLÇE" : "ŞEHİRLERARASI"}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-accent">{route.price}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground">{route.carrier}</span>
                  <span className="text-[8px] text-muted-foreground">•</span>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock size={8} /> {route.duration}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-muted-foreground">Sonraki:</span>
                  <span className="text-[10px] font-mono font-bold text-success">{next}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {route.departures.map((d) => {
                  const isNext = d === next;
                  return (
                    <span
                      key={d}
                      className={`text-[8px] font-mono px-1 py-0.5 rounded ${
                        isNext ? "bg-success/20 text-success font-bold" : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {d}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 text-[9px] font-mono text-muted-foreground">
        <span>Toplam: {filtered.length} hat</span>
        <span>•</span>
        <span>Günlük sefer: {filtered.reduce((s, r) => s + r.departures.length, 0)}</span>
      </div>
    </DashboardPanel>
  );
};
