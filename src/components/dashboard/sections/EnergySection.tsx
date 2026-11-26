import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { MiniChart } from "../MiniChart";
import { Zap, Sun, Leaf, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useEnergyIntelligence } from "@/services/topicGroundingService";
import { DataOriginBadge } from "../DataOriginBadge";

const energyDataTr = [
  { name: "Oca", value: 320 }, { name: "Şub", value: 310 }, { name: "Mar", value: 340 },
  { name: "Nis", value: 360 }, { name: "May", value: 410 }, { name: "Haz", value: 520 },
  { name: "Tem", value: 620 }, { name: "Ağu", value: 640 }, { name: "Eyl", value: 480 },
  { name: "Eki", value: 380 }, { name: "Kas", value: 330 }, { name: "Ara", value: 310 },
];

const energyDataEn = [
  { name: "Jan", value: 320 }, { name: "Feb", value: 310 }, { name: "Mar", value: 340 },
  { name: "Apr", value: 360 }, { name: "May", value: 410 }, { name: "Jun", value: 520 },
  { name: "Jul", value: 620 }, { name: "Aug", value: 640 }, { name: "Sep", value: 480 },
  { name: "Oct", value: 380 }, { name: "Nov", value: 330 }, { name: "Dec", value: 310 },
];

export const EnergyConsumptionPanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const hub = useOptionalUnifiedIntelligence();
  const outageBonus = hub?.getEnergyOutageBonus() ?? 0;
  const energyAlerts = (hub?.arbitratedEvents ?? [])
    .map((e) => e.energyAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const alertDistricts = energyAlerts.map((a) => a.districtName);

  const {
    dailyConsumptionGwh,
    activeOutageCount,
    outages,
    hasVerifiedLiveData,
    latestSourceSummary,
    isLoading,
  } = useEnergyIntelligence(outageBonus, alertDistricts);

  return (
    <DashboardPanel
      title="Enerji & Tüketim"
      icon={<Zap size={14} />}
      badge={hasVerifiedLiveData ? "GÜNCEL" : "ÖLÇÜM BEKLENİYOR"}
      badgeVariant={hasVerifiedLiveData ? "live" : "warning"}
    >
      <DataOriginBadge origin={hasVerifiedLiveData ? "live" : "pending"} className="mb-2" />
      {isLoading && !hasVerifiedLiveData && (
        <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard
          label="Günlük Tüketim"
          value={dailyConsumptionGwh !== null ? String(dailyConsumptionGwh) : "—"}
          unit={dailyConsumptionGwh !== null ? "GWh" : undefined}
          variant="warning"
        />
        <StatCard
          label="Aktif Kesinti"
          value={activeOutageCount !== null ? String(activeOutageCount) : "—"}
          variant={activeOutageCount && activeOutageCount > 0 ? "destructive" : "primary"}
        />
      </div>
      {energyAlerts.length > 0 && (
        <div className="mb-2.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-mono">
          <div className="font-bold text-amber-300">
            ⚡ {translate(energyAlerts[0].title)} ({energyAlerts[0].districtName})
          </div>
          <div className="text-foreground/90 mt-0.5">{translate(energyAlerts[0].detail)}</div>
        </div>
      )}
      {outages.length > 0 && (
        <div className="mb-2.5 space-y-1">
          {outages.slice(0, 3).map((out) => (
            <a
              key={out.id}
              href={out.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="block px-2 py-1 rounded bg-muted/25 hover:bg-muted/40 transition-colors text-[10px] font-mono"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground truncate">
                  {out.district} — {out.neighborhoods}
                </span>
                <span className="text-[9px] text-amber-400 uppercase shrink-0">
                  {out.type === "ariza" ? t("ARIZA") : t("PLANLI")}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground truncate">{translate(out.summary)}</p>
            </a>
          ))}
        </div>
      )}
      <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">
        {t("Aylık Enerji Tüketimi (GWh)")}
      </span>
      <MiniChart data={isEn ? energyDataEn : energyDataTr} color="hsl(38, 92%, 50%)" height={50} showAxis />
      <p className="text-[8px] font-mono text-muted-foreground/75 mt-2" data-testid="energy-source-note">
        {translate(latestSourceSummary)}
      </p>
    </DashboardPanel>
  );
};

export const RenewableEnergyPanel = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const { data: energyLive } = useLiveData<any>("energy", { refetchInterval: 30 * 60 * 1000 });
  const isLive = Boolean(energyLive);
  const renewableShare = energyLive?.renewable_share ?? 42;

  return (
    <DashboardPanel
      title="Yenilenebilir Enerji"
      icon={<Sun size={14} />}
      badge={isLive ? "AKTİF" : "REFERANS · 2024"}
      badgeVariant={isLive ? "active" : "info"}
    >
      <DataOriginBadge origin={isLive ? "live" : "reference"} className="mb-2" />
      <div className="flex justify-around mb-3">
        <Gauge value={renewableShare} max={100} label="Yenilenebilir Pay" variant="primary" />
        <Gauge value={280} max={500} label={isEn ? "Solar (MW)" : "GES (MW)"} unit=" MW" variant="primary" />
        <Gauge value={180} max={300} label={isEn ? "Wind (MW)" : "RES (MW)"} unit=" MW" variant="accent" />
      </div>
      <StatusList
        items={[
          { label: "Güneş Santrali", value: isEn ? "156 plants" : "156 tesis", status: "ok" },
          { label: "Rüzgar Santrali", value: isEn ? "28 plants" : "28 tesis", status: "ok" },
          { label: "Jeotermal", value: isEn ? "3 plants" : "3 tesis", status: "info" },
        ]}
      />
    </DashboardPanel>
  );
};

export const SustainabilityPanel = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  return (
    <DashboardPanel title="Sürdürülebilirlik" icon={<Leaf size={14} />}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard label="Karbon Ayak İzi" value="4.2" unit={isEn ? "t/capita" : "ton/kişi"} variant="warning" />
        <StatCard label="Geri Dönüşüm" value="34" unit="%" change={5.2} variant="primary" />
      </div>
      <StatusList
        items={[
          { label: "İnternet Erişimi", value: "92%", status: "ok" },
          { label: "Ort. Hız", value: "48 Mbps", status: "ok" },
          { label: "Akıllı Şehir Projesi", value: "DEVAM", status: "warning" },
          { label: "Akıllı Aydınlatma", value: "28%", status: "warning" },
        ]}
      />
    </DashboardPanel>
  );
};

export const EnergySection = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
        <EnergyConsumptionPanel />
        <SustainabilityPanel />
      </div>
      <div className="space-y-4">
        <RenewableEnergyPanel />
      </div>
    </div>
  );
};
