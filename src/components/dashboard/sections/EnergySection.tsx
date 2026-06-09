import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { MiniChart } from "../MiniChart";
import { Zap, Sun, Leaf } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

const energyData = [
  { name: "Oca", value: 320 }, { name: "Şub", value: 310 }, { name: "Mar", value: 340 },
  { name: "Nis", value: 360 }, { name: "May", value: 410 }, { name: "Haz", value: 520 },
  { name: "Tem", value: 620 }, { name: "Ağu", value: 640 }, { name: "Eyl", value: 480 },
  { name: "Eki", value: 380 }, { name: "Kas", value: 330 }, { name: "Ara", value: 310 },
];

export const EnergySection = () => {
  const { data: energyLive } = useLiveData<any>("energy", { refetchInterval: 30 * 60 * 1000 });

  const dailyConsumption = energyLive?.daily_consumption_gwh ?? 1.8;
  const renewableShare = energyLive?.renewable_share ?? 42;

  return (
    <div className="space-y-3">
      <DashboardPanel title="Enerji & Tüketim" icon={<Zap size={14} />} badge="CANLI" badgeVariant="live">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Günlük Tüketim" value={String(dailyConsumption)} unit="GWh" variant="warning" />
          <StatCard label="Kesinti (Ay)" value="3" variant="primary" />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Aylık Enerji Tüketimi (GWh)</span>
        <MiniChart data={energyData} color="hsl(38, 92%, 50%)" height={50} showAxis />
      </DashboardPanel>

      <DashboardPanel title="Yenilenebilir Enerji" icon={<Sun size={14} />} badge="AKTİF" badgeVariant="active">
        <div className="flex justify-around mb-3">
          <Gauge value={renewableShare} max={100} label="Yenilenebilir Pay" variant="primary" />
          <Gauge value={280} max={500} label="GES (MW)" unit=" MW" variant="primary" />
          <Gauge value={180} max={300} label="RES (MW)" unit=" MW" variant="accent" />
        </div>
        <StatusList items={[
          { label: "Güneş Santrali", value: "156 tesis", status: "ok" },
          { label: "Rüzgar Santrali", value: "28 tesis", status: "ok" },
          { label: "Jeotermal", value: "3 tesis", status: "info" },
        ]} />
      </DashboardPanel>

      <DashboardPanel title="Sürdürülebilirlik" icon={<Leaf size={14} />}>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Karbon Ayak İzi" value="4.2" unit="ton/kişi" variant="warning" />
          <StatCard label="Geri Dönüşüm" value="34" unit="%" change={5.2} variant="primary" />
        </div>
        <StatusList items={[
          { label: "İnternet Erişimi", value: "92%", status: "ok" },
          { label: "Ort. Hız", value: "48 Mbps", status: "ok" },
          { label: "Akıllı Şehir Projesi", value: "DEVAM", status: "warning" },
          { label: "Akıllı Aydınlatma", value: "28%", status: "warning" },
        ]} />
      </DashboardPanel>
    </div>
  );
};
