import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { MiniChart } from "../MiniChart";
import { Car, PlaneTakeoff, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

const airportData = [
  { name: "Oca", value: 120 }, { name: "Şub", value: 135 }, { name: "Mar", value: 180 },
  { name: "Nis", value: 280 }, { name: "May", value: 420 }, { name: "Haz", value: 580 },
  { name: "Tem", value: 720 }, { name: "Ağu", value: 750 }, { name: "Eyl", value: 480 },
  { name: "Eki", value: 280 }, { name: "Kas", value: 150 }, { name: "Ara", value: 110 },
];

type RoadWorksProject = {
  name: string;
  status: "devam" | "tamamlandı" | "belirsiz";
  progress: number | null;
  confidence: "high" | "medium" | "low";
  expectedEnd: string;
};

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

      <DashboardPanel title="Havalimanları" icon={<PlaneTakeoff size={14} />} badge="AKTİF" badgeVariant="active">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="DLM Havalimanı" value="2.8M" unit="yolcu/yıl" variant="accent" />
          <StatCard label="BJV Havalimanı" value="1.4M" unit="yolcu/yıl" variant="accent" />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Aylık Yolcu (bin)</span>
        <MiniChart data={airportData} color="hsl(200, 80%, 50%)" height={50} showAxis />
      </DashboardPanel>

      <DashboardPanel title="Altyapı Projeleri" badge="TAHMİNİ PLAN" badgeVariant="warning">
        <div className="space-y-2">
          {[
            { name: "Muğla Çevreyolu", progress: 78, start: "2024-03-15", end: "2026-06-30", address: "Muğla Merkez — Menteşe-Yatağan Bağlantısı" },
            { name: "Bodrum Marina Genişleme", progress: 45, start: "2024-09-01", end: "2026-12-15", address: "Bodrum Merkez, İçmeler Mevkii" },
            { name: "Fethiye Alt Geçit", progress: 92, start: "2024-01-10", end: "2025-04-30", address: "Fethiye Çarşı Kavşağı, D400 altı" },
            { name: "Akıllı Kavşak Sistemi", progress: 33, start: "2025-01-01", end: "2026-09-01", address: "İl Geneli — 24 Kavşak Noktası" },
            { name: "Bisiklet Yolu Ağı", progress: 15, start: "2025-02-15", end: "2027-06-01", address: "Bodrum-Turgutreis Sahil Şeridi" },
          ].map((project, i) => {
            const now = new Date();
            const endDate = new Date(project.end);
            const diffMs = endDate.getTime() - now.getTime();
            const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

            return (
              <div key={i} className="px-2.5 py-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-semibold text-foreground/90">{project.name}</span>
                  <span className={`text-[10px] font-mono font-bold ${
                    project.progress >= 80 ? "text-success" : project.progress >= 40 ? "text-warning" : "text-destructive"
                  }`}>{project.progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all ${
                      project.progress >= 80 ? "bg-success" : project.progress >= 40 ? "bg-warning" : "bg-destructive"
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">{project.address}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    daysLeft <= 90 ? "bg-success/20 text-success" : daysLeft <= 365 ? "bg-warning/20 text-warning" : "bg-accent/20 text-accent"
                  }`}>
                    {daysLeft === 0 ? "TAMAMLANDI" : `${daysLeft} gün kaldı`}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] font-mono text-muted-foreground">Başlangıç: {project.start}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">Bitiş: {project.end}</span>
                </div>
              </div>
            );
          })}
          <p className="text-[8px] font-mono text-muted-foreground/70 mt-2 pt-2 border-t border-border/30">
            Proje takvimleri tahmini plandır — resmi kaynak (Karayolları / Büyükşehir Belediyesi / YİKOB) doğrulaması yapılmamıştır.
            Proje durumları haber akışından izlenmektedir.
          </p>
        </div>
      </DashboardPanel>
    </div>
  );
};
