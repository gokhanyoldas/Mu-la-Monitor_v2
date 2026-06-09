import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { Users, GraduationCap, HeartPulse, Scale, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

export const SocialSection = () => {
  const { data: demoData, isLoading: dLoading } = useLiveData<any>("demographics", { refetchInterval: 24 * 60 * 60 * 1000 });
  const { data: eduData, isLoading: eLoading } = useLiveData<any>("education", { refetchInterval: 24 * 60 * 60 * 1000 });
  const { data: healthData, isLoading: hLoading } = useLiveData<any>("health", { refetchInterval: 24 * 60 * 60 * 1000 });
  const { data: lifeData } = useLiveData<any>("life_quality", { refetchInterval: 24 * 60 * 60 * 1000 });

  const demo = demoData || {};
  const edu = eduData || {};
  const health = healthData || {};
  const life = lifeData || {};

  return (
    <div className="space-y-3">
      <DashboardPanel title="Nüfus & Demografi" icon={<Users size={14} />} badge="CANLI" badgeVariant="live">
        {dLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard label="Nüfus" value={demo.population ?? "1.02M"} change={demo.population_growth ?? 1.8} variant="primary" />
          <StatCard label="Yoğunluk" value={String(demo.density ?? 79)} unit="kişi/km²" />
          <StatCard label="Medyan Yaş" value={String(demo.median_age ?? 38.5)} />
          <StatCard label="Yabancı Nüfus" value={demo.foreign_population ?? "42K"} change={demo.foreign_growth ?? 8.2} variant="accent" />
        </div>
        <StatusList items={[
          { label: "Göç Dengesi", value: demo.migration_balance ?? "+12,400", status: "ok" },
          { label: "Kentsel Nüfus", value: `${demo.urban_ratio ?? 58}%`, status: "info" },
          { label: "Kırsal Nüfus", value: `${demo.rural_ratio ?? 42}%`, status: "info" },
          { label: "Sezon Artışı", value: demo.seasonal_increase ?? "+380K", status: "warning" },
        ]} />
        {demo.source && <div className="text-[8px] font-mono text-muted-foreground mt-1 text-right">Kaynak: {demo.source}</div>}
      </DashboardPanel>

      <DashboardPanel title="Eğitim" icon={<GraduationCap size={14} />} badge="CANLI" badgeVariant="live">
        {eLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Okullaşma" value={String(edu.schooling_rate ?? 98.2)} unit="%" variant="primary" />
          <StatCard label="Üniversite Öğrenci" value={edu.university_students ?? "52K"} />
          <StatCard label="LGS Başarı" value={`${edu.lgs_rank ?? 68}. sıra`} />
          <StatCard label="YKS Başarı" value={`${edu.yks_rank ?? 42}. sıra`} />
        </div>
        {edu.source && <div className="text-[8px] font-mono text-muted-foreground text-right">Kaynak: {edu.source}</div>}
      </DashboardPanel>

      <DashboardPanel title="Sağlık" icon={<HeartPulse size={14} />} badge="CANLI" badgeVariant="live">
        {hLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Hastane" value={String(health.hospitals ?? 18)} />
          <StatCard label="Doktor" value={String(health.doctors ?? "2,840")} />
          <StatCard label="Yatak Kapasitesi" value={String(health.bed_capacity ?? "4,200")} />
          <StatCard label="Eczane" value={String(health.pharmacies ?? 385)} />
        </div>
        <div className="flex justify-around">
          <Gauge value={health.capacity_usage ?? 68} max={100} label="Kapasite Kullanım" variant="warning" />
          <Gauge value={health.season_usage ?? 85} max={100} label="Sezon Kullanım" variant="destructive" />
        </div>
        {health.source && <div className="text-[8px] font-mono text-muted-foreground mt-1 text-right">Kaynak: {health.source}</div>}
      </DashboardPanel>

      <DashboardPanel title="Yaşam Kalitesi" icon={<Scale size={14} />} badge="CANLI" badgeVariant="live">
        <div className="flex justify-around mb-3">
          <Gauge value={life.life_index ?? 72} max={100} label="Yaşam Endeksi" variant="primary" />
          <Gauge value={life.safety_index ?? 65} max={100} label="Güvenlik" variant="primary" />
          <Gauge value={life.satisfaction_index ?? 78} max={100} label="Memnuniyet" variant="primary" />
        </div>
        {life.source && <div className="text-[8px] font-mono text-muted-foreground text-right">Kaynak: {life.source}</div>}
      </DashboardPanel>
    </div>
  );
};
