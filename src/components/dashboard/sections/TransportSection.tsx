import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Car, PlaneTakeoff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLiveData } from "@/hooks/useLiveData";
import { supabase } from "@/integrations/supabase/client";

type RoadWorksProject = {
  name: string;
  status: "devam" | "tamamlandı" | "belirsiz";
  progress: number | null;
  confidence: "high" | "medium" | "low";
  expectedEnd: string;
  latest_news?: { title: string; pubDate: string; link: string }[];
};

const confidenceLabel = { high: "YÜKSEK", medium: "ORTA", low: "DÜŞÜK" } as const;

export const TransportSection = () => {
  const { data: trafficData, isLoading: tLoading } = useLiveData<any>("traffic_density", { refetchInterval: 10 * 60 * 1000 });
  const { data: roadWorks, isLoading: rLoading } = useLiveData<any>("road_works", { refetchInterval: 15 * 60 * 1000 });

  // Backend artık hotspots şemasını dönüyor (eski "zones" yalnızca geriye dönük)
  const hotspots = trafficData?.hotspots ?? trafficData?.zones ?? [];
  const avgDensity = Array.isArray(hotspots) && hotspots.length > 0
    ? Math.round(hotspots.reduce((a: number, z: any) => a + Number(z.density ?? 0), 0) / hotspots.length)
    : null;
  const worstZone = Array.isArray(hotspots) && hotspots.length > 0
    ? hotspots.reduce((a: any, z: any) => (Number(z.density ?? 0) > Number(a.density ?? 0) ? z : a), hotspots[0])
    : null;

  // road_works.backend çıktısı: { projects: [...] } (haber akışından izlenen altyapı)
  const projects: RoadWorksProject[] =
    (roadWorks && Array.isArray(roadWorks.projects) ? roadWorks.projects : []) as RoadWorksProject[];

  const roadItems = projects.length > 0
    ? projects.slice(0, 5).map((p) => ({
        label: p.name,
        value: p.status === "tamamlandı" ? "TAMAMLANDI" : p.status === "devam" ? "DEVAM" : "İZLENİYOR",
        status: (p.status === "tamamlandı" ? "ok" : p.status === "devam" ? "warning" : "info") as "ok" | "warning" | "critical" | "info",
      }))
    : [];

  const hasLiveTraffic = Array.isArray(hotspots) && hotspots.length > 0;
  const hasRoadWorks = projects.length > 0;

  // Canlı uçuş verisi (transport-scrape type=flights): DLM/BJV bugünkü sefer sayısı
  const [flightStats, setFlightStats] = useState<{
    dlm: number; bjv: number; dlmDep: number; dlmArr: number; bjvDep: number; bjvArr: number;
  } | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightError, setFlightError] = useState(false);

  const fetchFlights = async () => {
    try {
      setFlightLoading(true);
      const { data, error } = await supabase.functions.invoke("transport-scrape", { body: { type: "flights", source: "adsb" } });
      if (error || !data?.airports?.length) { setFlightError(true); return; }
      const dlm = data.airports.find((a: any) => a.code === "DLM");
      const bjv = data.airports.find((a: any) => a.code === "BJV");
      setFlightStats({
        dlm: dlm?.departures?.length ?? 0,
        bjv: bjv?.departures?.length ?? 0,
        dlmDep: dlm?.departures?.length ?? 0,
        dlmArr: dlm?.arrivals?.length ?? 0,
        bjvDep: bjv?.departures?.length ?? 0,
        bjvArr: bjv?.arrivals?.length ?? 0,
      });
      setFlightError(false);
    } catch {
      setFlightError(true);
    } finally {
      setFlightLoading(false);
    }
  };

  useEffect(() => {
    fetchFlights();
    const interval = setInterval(fetchFlights, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <DashboardPanel
        title="Ulaşım"
        icon={<Car size={14} />}
        badge={hasLiveTraffic || hasRoadWorks ? "CANLI" : "BEKLEYEN"}
        badgeVariant={hasLiveTraffic || hasRoadWorks ? "live" : "warning"}
        count={(hasLiveTraffic ? 1 : 0) + (hasRoadWorks ? projects.length : 0)}
      >
        {(tLoading || rLoading) && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <StatCard
            label="Ort. Trafik Yoğunluğu"
            value={avgDensity !== null ? String(avgDensity) : "—"}
            unit="%"
            variant="primary"
            info={hasLiveTraffic ? "TomTom canlı akışından (13 ilçe ortalaması)" : "Canlı veri yok; panoya bağlanamadı"}
          />
          <StatCard
            label="İzlenen İlçe"
            value={hasLiveTraffic ? String(hotspots.length) : "—"}
            unit="ilçe"
            info="TomTom izleme noktası sayısı (Muğla'nın 13 ilçesi)"
          />
          {worstZone && (
            <StatCard
              label="En Yoğun İlçe"
              value={String(worstZone.name ?? "—")}
              unit={worstZone.density != null ? `%${Math.round(Number(worstZone.density))}` : ""}
              variant={Number(worstZone.density ?? 0) >= 50 ? "warning" : "primary"}
              info="Şu an en tıkalı izleme noktası"
            />
          )}
        </div>

        {roadItems.length > 0 ? (
          <>
            <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Altyapı / Yol Durumu (basın takibi)</span>
            <StatusList items={roadItems} />
            <p className="text-[8px] font-mono text-muted-foreground/70 mt-1">
              Durumlar Google News RSS'ten proje bazlı izlenir; "tamamlandı" yalnızca basın kanıtıyla işaretlenir.
            </p>
          </>
        ) : (
          <p className="text-[9px] font-mono text-muted-foreground/80 py-1">
            Canlı yol/altyapı duyurusu bekleniyor — haber akışı tazelenince burada görünür.
          </p>
        )}
      </DashboardPanel>

      <DashboardPanel
        title="Havalimanları"
        icon={<PlaneTakeoff size={14} />}
        badge={flightStats ? "CANLI" : flightError ? "BEKLEYEN" : "AKTİF"}
        badgeVariant={flightStats ? "live" : flightError ? "warning" : "active"}
        count={flightStats ? 2 : undefined}
      >
        {flightLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {flightStats ? (
            <>
              <StatCard
                label="DLM Havalimanı"
                value={String(flightStats.dlm)}
                unit="uçak (şu an)"
                variant="accent"
                info="adsb.fi canlı: DLM 40 NM yarıçapında şu an tespit edilen uçaklar (kalkış/iniş/havada)"
              />
              <StatCard
                label="BJV Havalimanı"
                value={String(flightStats.bjv)}
                unit="uçak (şu an)"
                variant="accent"
                info="adsb.fi canlı: BJV 40 NM yarıçapında şu an tespit edilen uçaklar (kalkış/iniş/havada)"
              />
            </>
          ) : (
            <>
              <StatCard label="DLM Havalimanı" value={flightError ? "—" : "…"} unit={flightError ? "veri yok" : "yükleniyor"} variant="accent" />
              <StatCard label="BJV Havalimanı" value={flightError ? "—" : "…"} unit={flightError ? "veri yok" : "yükleniyor"} variant="accent" />
            </>
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={fetchFlights}
            disabled={flightLoading}
            className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            {flightLoading ? "Yükleniyor…" : "↻ Canlı uçuşları yenile"}
          </button>
        </div>
        {flightError && (
          <p className="text-[8px] font-mono text-destructive/80 mt-1">
            Canlı uçuş verisi alınamadı — uçak takibi ayrı sekmede (Havalimanları detay) görülebilir.
          </p>
        )}
      </DashboardPanel>

      <DashboardPanel
        title="Altyapı Projeleri"
        badge={projects.length > 0 ? "HABER TAKİBİ" : "BEKLEYEN"}
        badgeVariant={projects.length > 0 ? "info" : "warning"}
        count={projects.length > 0 ? projects.length : undefined}
      >
        {rLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        {projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map((p, i) => {
              const newsCount = p.latest_news?.length ?? 0;
              const endRaw = p.expectedEnd ? new Date(p.expectedEnd) : null;
              const validEnd = endRaw && !isNaN(endRaw.getTime());
              const daysLeft = validEnd ? Math.ceil((endRaw.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const isDone = p.status === "tamamlandı";
              return (
                <div key={i} className="px-2.5 py-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-semibold text-foreground/90">{p.name}</span>
                    <span className={`text-[10px] font-mono font-bold ${
                      isDone ? "text-success" : p.status === "devam" ? "text-warning" : "text-muted-foreground"
                    }`}>
                      {isDone ? "TAMAMLANDI" : p.status === "devam" ? "DEVAM EDİYOR" : "İZLENİYOR"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-muted-foreground">
                      Güven: <b className="text-foreground/70">{confidenceLabel[p.confidence] ?? "—"}</b>
                      {daysLeft !== null && <span className="ml-2">Bitiş: <b className="text-foreground/70">{daysLeft < 0 ? "belirsiz" : `${daysLeft} gün`}</b></span>}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {newsCount} haber
                    </span>
                  </div>
                </div>
              );
            })}
            <p className="text-[8px] font-mono text-muted-foreground/70 mt-2 pt-2 border-t border-border/30">
              {String(roadWorks?.note ?? "Durumlar Google News RSS'ten proje bazlı izlenir; ilerleme yüzdeleri yalnızca doğrulanmış tamamlanmalarda gösterilir.")}
            </p>
          </div>
        ) : (
          <p className="text-[9px] font-mono text-muted-foreground/80 py-1">
            Altyapı projeleri için haber akışı bekleniyor — basın verisi toplanınca burada görünür.
          </p>
        )}
      </DashboardPanel>
    </div>
  );
};
