import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { Users, GraduationCap, HeartPulse, Scale, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useTranslation } from "@/hooks/useTranslation";

export const DemographicsPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: demoData, isLoading: dLoading } = useLiveData<any>("demographics", {
    refetchInterval: 24 * 60 * 60 * 1000,
  });
  const demo = demoData || {};

  return (
    <DashboardPanel title="Nüfus & Demografi" icon={<Users size={14} />} badge="TÜİK 2024" badgeVariant="live">
      {dLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StatCard
          label="Muğla Nüfusu"
          value={demo.population ?? "1.066.736"}
          change={demo.population_growth ?? 1.5}
          variant="primary"
          info={isEn ? "TurkStat 2024 official population register" : "TÜİK 2024 ADNKS Resmi Sonuçları"}
        />
        <StatCard
          label="Yoğunluk"
          value={String(demo.density ?? 84)}
          unit={isEn ? "ppl/km²" : "kişi/km²"}
          info={isEn ? "12,654 km² total provincial area" : "12.654 km² İl Yüzölçümü"}
        />
        <StatCard
          label="Medyan Yaş"
          value={String(demo.median_age ?? 40.2)}
          info={isEn ? "Turkey avg: 33.5 | Muğla: 40.2" : "Türkiye Ort: 33.5 | Muğla: 40.2"}
        />
        <StatCard
          label="Yabancı Nüfus"
          value={demo.foreign_population ?? "38.4K"}
          change={demo.foreign_growth ?? 4.2}
          variant="accent"
          info={isEn ? "Foreign residents with permits" : "İkamet İzinli Yabancı Nüfus"}
        />
      </div>
      <StatusList
        items={[
          { label: "Net Göç Hızı", value: demo.migration_balance ?? "+9,820", status: "ok" },
          { label: "Kentsel Dokulu Nüfus", value: `${demo.urban_ratio ?? 64}%`, status: "info" },
          { label: "Kırsal Mahalle Nüfusu", value: `${demo.rural_ratio ?? 36}%`, status: "info" },
          { label: "Pik Sezon Nüfus Artışı", value: demo.seasonal_increase ?? "+1.8M", status: "warning" },
        ]}
      />
      <div className="tech-meta-only text-[8px] font-mono text-muted-foreground mt-1 text-right">
        {isEn ? "Source" : "Kaynak"}:{" "}
        {translate(demo.source || "TÜİK Adrese Dayalı Nüfus Kayıt Sistemi (ADNKS 2024)")}
      </div>
    </DashboardPanel>
  );
};

export const EducationPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: eduData, isLoading: eLoading } = useLiveData<any>("education", {
    refetchInterval: 24 * 60 * 60 * 1000,
  });
  const edu = eduData || {};

  return (
    <DashboardPanel title="Eğitim" icon={<GraduationCap size={14} />} badge="MEB / MSKÜ 2024" badgeVariant="live">
      {eLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard label="Okullaşma Oranı" value={String(edu.schooling_rate ?? 98.4)} unit="%" variant="primary" />
        <StatCard
          label="Üniversite Öğrenci"
          value={edu.university_students ?? "44.5K"}
          info={isEn ? "Muğla Sıtkı Koçman University" : "Muğla Sıtkı Koçman Üni."}
        />
        <StatCard
          label="LGS Başarı"
          value={isEn ? `#${edu.lgs_rank ?? 28}` : `${edu.lgs_rank ?? 28}. sıra`}
          info={isEn ? "National provincial ranking" : "Türkiye Geneli İl Başarısı"}
        />
        <StatCard
          label="YKS Başarı"
          value={isEn ? `#${edu.yks_rank ?? 24}` : `${edu.yks_rank ?? 24}. sıra`}
          info={isEn ? "National provincial ranking" : "Türkiye Geneli İl Başarısı"}
        />
      </div>
      <div className="tech-meta-only text-[8px] font-mono text-muted-foreground text-right">
        {isEn ? "Source" : "Kaynak"}:{" "}
        {translate(edu.source || "Muğla İl Milli Eğitim Müdürlüğü & MSKÜ 2024 Raporu")}
      </div>
    </DashboardPanel>
  );
};

export const HealthPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: healthData, isLoading: hLoading } = useLiveData<any>("health", {
    refetchInterval: 24 * 60 * 60 * 1000,
  });
  const health = healthData || {};

  return (
    <DashboardPanel title="Sağlık" icon={<HeartPulse size={14} />} badge="İl Sağlık 2024" badgeVariant="live">
      {hLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard
          label="Aktif Hastane"
          value={String(health.hospitals ?? 18)}
          info={isEn ? "Public + University + Private" : "Devlet + Üniversite + Özel"}
        />
        <StatCard label="Toplam Hekim" value={String(health.doctors ?? "2,840")} />
        <StatCard label="Yatak Kapasitesi" value={String(health.bed_capacity ?? "4,200")} />
        <StatCard label="Ruhsatlı Eczane" value={String(health.pharmacies ?? 385)} />
      </div>
      <div className="flex justify-around">
        <Gauge value={health.capacity_usage ?? 68} max={100} label="Kış Kapasite Kullanım" variant="warning" />
        <Gauge value={health.season_usage ?? 89} max={100} label="Yaz Sezonu Kullanım" variant="destructive" />
      </div>
      <div className="tech-meta-only text-[8px] font-mono text-muted-foreground mt-1 text-right">
        {isEn ? "Source" : "Kaynak"}:{" "}
        {translate(health.source || "Sağlık Bakanlığı Muğla İl Sağlık Müdürlüğü Brifingi")}
      </div>
    </DashboardPanel>
  );
};

export const LifeQualityPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: lifeData } = useLiveData<any>("life_quality", { refetchInterval: 24 * 60 * 60 * 1000 });
  const life = lifeData || {};

  return (
    <DashboardPanel
      title="Yaşam Kalitesi & Güvenlik"
      icon={<Scale size={14} />}
      badge="TÜİK İller Yaşam Endeksi"
      badgeVariant="live"
    >
      <div className="flex justify-around mb-3">
        <Gauge value={life.life_index ?? 76} max={100} label="Yaşam Endeksi" variant="primary" />
        <Gauge value={life.safety_index ?? 72} max={100} label="Güvenlik Endeksi" variant="primary" />
        <Gauge value={life.satisfaction_index ?? 81} max={100} label="Genel Memnuniyet" variant="primary" />
      </div>
      <div className="tech-meta-only text-[8px] font-mono text-muted-foreground text-right">
        {isEn ? "Source" : "Kaynak"}:{" "}
        {translate(life.source || "TÜİK İllerde Yaşam Kalitesi & Emniyet Genel Müdürlüğü")}
      </div>
    </DashboardPanel>
  );
};

export const SocialSection = () => {
  return (
    <div className="space-y-3">
      <DemographicsPanel />
      <EducationPanel />
      <HealthPanel />
      <LifeQualityPanel />
    </div>
  );
};
