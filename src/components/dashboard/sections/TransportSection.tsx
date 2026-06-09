import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { MiniChart } from "../MiniChart";
import { Car, PlaneTakeoff, Ship, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

const airportData = [
  { name: "Oca", value: 120 }, { name: "Şub", value: 135 }, { name: "Mar", value: 180 },
  { name: "Nis", value: 280 }, { name: "May", value: 420 }, { name: "Haz", value: 580 },
  { name: "Tem", value: 720 }, { name: "Ağu", value: 750 }, { name: "Eyl", value: 480 },
  { name: "Eki", value: 280 }, { name: "Kas", value: 150 }, { name: "Ara", value: 110 },
];

const defaultRoads = [
  { label: "Muğla-Bodrum Yolu", value: "NORMAL", status: "ok" as const },
  { label: "Muğla-Fethiye Yolu", value: "YOĞUN", status: "warning" as const },
  { label: "Muğla-Marmaris Yolu", value: "NORMAL", status: "ok" as const },
  { label: "Otobüs Seferleri", value: "124/gün", status: "ok" as const },
  { label: "Feribot Seferleri", value: "18/gün", status: "ok" as const },
];

export const TransportSection = () => {
  const { data: trafficData, isLoading: tLoading } = useLiveData<any>("traffic_density", { refetchInterval: 10 * 60 * 1000 });
  const { data: roadWorks, isLoading: rLoading } = useLiveData<any[]>("road_works", { refetchInterval: 15 * 60 * 1000 });

  const zones = trafficData?.zones || [];
  const avgDensity = zones.length > 0
    ? Math.round(zones.reduce((a: number, z: any) => a + z.density, 0) / zones.length)
    : 42;
  const totalVehicles = zones.length > 0 ? "285K" : "285K";
  const accidents = 128;

  // Build road status from live road_works data
  const roadItems = roadWorks && roadWorks.length > 0
    ? roadWorks.slice(0, 5).map((rw: any) => ({
        label: rw.title || rw.road || "",
        value: rw.status || "BİLGİ",
        status: (rw.type === "closed" ? "critical" : rw.type === "open" ? "ok" : "warning") as "ok" | "warning" | "critical" | "info",
      }))
    : defaultRoads;

  const isLive = zones.length > 0 || (roadWorks && roadWorks.length > 0);

  return (
    <div className="space-y-3">
      <DashboardPanel title="Ulaşım" icon={<Car size={14} />} badge={isLive ? "CANLI" : "CANLI"} badgeVariant="live" count={6}>
        {(tLoading || rLoading) && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <StatCard label="Trafik Yoğunluk" value={String(avgDensity)} unit="%" variant="primary" />
          <StatCard label="Günlük Araç" value={totalVehicles} />
          <StatCard label="Kaza (Ay)" value={String(accidents)} variant="warning" />
        </div>
        <StatusList items={roadItems} />
      </DashboardPanel>

      <DashboardPanel title="Havalimanları" icon={<PlaneTakeoff size={14} />} badge="AKTİF" badgeVariant="active">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="DLM Havalimanı" value="2.8M" unit="yolcu/yıl" variant="accent" />
          <StatCard label="BJV Havalimanı" value="1.4M" unit="yolcu/yıl" variant="accent" />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Aylık Yolcu (bin)</span>
        <MiniChart data={airportData} color="hsl(200, 80%, 50%)" height={50} showAxis />
      </DashboardPanel>

      <DashboardPanel title="Altyapı Projeleri" badge="DEVAM" badgeVariant="warning">
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
        </div>
      </DashboardPanel>
    </div>
  );
};
