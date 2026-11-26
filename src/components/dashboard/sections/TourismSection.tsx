import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { MiniChart } from "../MiniChart";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { Plane, Hotel, UtensilsCrossed, Loader2 } from "lucide-react";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useTourismIntelligence, formatShortTurkishDate } from "@/services/topicGroundingService";
import { DataOriginBadge } from "../DataOriginBadge";

const touristDataTr = [
  { name: "Oca", value: 45 }, { name: "Şub", value: 52 }, { name: "Mar", value: 78 },
  { name: "Nis", value: 120 }, { name: "May", value: 210 }, { name: "Haz", value: 380 },
  { name: "Tem", value: 520 }, { name: "Ağu", value: 550 }, { name: "Eyl", value: 320 },
  { name: "Eki", value: 180 }, { name: "Kas", value: 85 }, { name: "Ara", value: 50 },
];

const touristDataEn = [
  { name: "Jan", value: 45 }, { name: "Feb", value: 52 }, { name: "Mar", value: 78 },
  { name: "Apr", value: 120 }, { name: "May", value: 210 }, { name: "Jun", value: 380 },
  { name: "Jul", value: 520 }, { name: "Aug", value: 550 }, { name: "Sep", value: 320 },
  { name: "Oct", value: 180 }, { name: "Nov", value: 85 }, { name: "Dec", value: 50 },
];

export const TourismMovementPanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const {
    annualTourists,
    airportPassengers,
    cruiseShips,
    headlines,
    hasVerifiedLiveData,
    movementSourceSummary,
    isLoading,
  } = useTourismIntelligence();
  const hub = useOptionalUnifiedIntelligence();
  const tourismRisks = (hub?.arbitratedEvents ?? [])
    .map((e) => e.tourismRiskAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <DashboardPanel
      title="Turizm"
      icon={<Plane size={14} />}
      badge={hasVerifiedLiveData ? "GÜNCEL" : "ÖLÇÜM BEKLENİYOR"}
      badgeVariant={hasVerifiedLiveData ? "active" : "warning"}
      count={headlines.length > 0 ? headlines.length : undefined}
    >
      <DataOriginBadge origin={hasVerifiedLiveData ? "live" : "pending"} className="mb-2" />
      {isLoading && !hasVerifiedLiveData && (
        <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
      )}
      {tourismRisks.length > 0 && (
        <div className="mb-2.5 rounded border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-mono">
          <div className="font-bold text-amber-300">
            ⚠ {translate(tourismRisks[0].title)} ({tourismRisks[0].districtName})
          </div>
          <div className="text-foreground/90 mt-0.5">{translate(tourismRisks[0].detail)}</div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StatCard
          label="Yıllık Turist"
          value={annualTourists ?? "—"}
          variant="primary"
          info={isEn ? "Verified tourism arrivals from Ministry of Culture & Tourism / regional reports." : "Kültür ve Turizm Bakanlığı / yerel sektör kaynakları."}
        />
        <StatCard
          label="Ülke Sayısı"
          value="92"
          variant="accent"
          info={isEn ? "Source countries sending visitors to Muğla." : "Muğla'ya turist gönderen ülke sayısı. Kültür ve Turizm Bakanlığı."}
        />
        <StatCard
          label="Havalimanı Yolcu"
          value={airportPassengers ?? "—"}
          info={isEn ? "DHMİ Dalaman + Milas-Bodrum annual passenger volume." : "DHMİ Dalaman + Milas-Bodrum yıllık yolcu sayısı."}
        />
        <StatCard
          label="Kruvaziyer"
          value={cruiseShips !== null ? String(cruiseShips) : "—"}
          unit={cruiseShips !== null ? (isEn ? "ships" : "gemi") : undefined}
          info={isEn ? "Annual cruise ship arrivals." : "Kültür ve Turizm Bakanlığı kruvaziyer gemi sayısı."}
        />
      </div>
      {headlines.length > 0 && (
        <div className="space-y-1 mb-2.5" data-testid="tourism-headlines">
          {headlines.slice(0, 3).map((h, idx) => (
            <a
              key={`${h.sourceUrl}-${idx}`}
              href={h.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-[10px] font-mono"
            >
              <span className="truncate text-foreground/90">
                <b className="text-primary">{h.district}:</b> {translate(h.title)}
              </span>
              <span className="shrink-0 text-[8px] text-muted-foreground">
                {h.sourceName}
                {h.publishedAt ? ` · ${formatShortTurkishDate(h.publishedAt)}` : ""}
              </span>
            </a>
          ))}
        </div>
      )}
      <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">
        {t("Aylık Turist Girişi (bin)")}
      </span>
      <MiniChart data={isEn ? touristDataEn : touristDataTr} color="hsl(200, 80%, 50%)" height={70} showAxis />
      <p className="text-[8px] font-mono text-muted-foreground/75 mt-1" data-testid="tourism-movement-source-note">
        {translate(movementSourceSummary)}
      </p>
    </DashboardPanel>
  );
};

export const AccommodationPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const {
    hotelOccupancyPct,
    totalBedsK,
    districtRates,
    hasVerifiedOccupancy,
    occupancySourceSummary,
    isLoading,
  } = useTourismIntelligence();
  const hub = useOptionalUnifiedIntelligence();
  const tourismRisks = (hub?.arbitratedEvents ?? [])
    .map((e) => e.tourismRiskAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <DashboardPanel
      title="Konaklama"
      icon={<Hotel size={14} />}
      badge={tourismRisks.length > 0 ? "ŞANTİYE RİSKİ" : hasVerifiedOccupancy ? "GÜNCEL" : "ÖLÇÜM BEKLENİYOR"}
      badgeVariant={tourismRisks.length > 0 ? "warning" : hasVerifiedOccupancy ? "active" : "warning"}
    >
      <DataOriginBadge origin={hasVerifiedOccupancy ? "live" : "pending"} className="mb-2" />
      {isLoading && !hasVerifiedOccupancy && (
        <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
      )}
      {hasVerifiedOccupancy && hotelOccupancyPct !== null ? (
        <div className="flex justify-around mb-3">
          <Gauge value={hotelOccupancyPct} max={100} label="Otel Doluluk" variant="accent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Otel Doluluk" value="—" variant="accent" />
          <StatCard label="Toplam Yatak" value={totalBedsK ?? "—"} />
        </div>
      )}
      {districtRates.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {districtRates.map((r) => (
            <a
              key={r.district}
              href={r.sourceUrl}
              target="_blank"
              rel="noreferrer"
              title={`${r.sourceName}${r.measuredAt ? ` • ${formatShortTurkishDate(r.measuredAt)}` : ""}`}
              className="flex items-center justify-between px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-[10px] font-mono"
            >
              <span className="text-foreground/85">{r.district}</span>
              <span className="font-bold text-primary tabular-nums-stat">%{r.occupancyPct}</span>
            </a>
          ))}
        </div>
      )}
      {tourismRisks.length > 0 && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[9px] font-mono text-amber-200">
          {isEn
            ? `⚠ Pre-Season Construction Risk (${tourismRisks[0].districtName}): Ongoing road/facade work may impact early-season visitor perception.`
            : `⚠ Sezon Öncesi Şantiye Riski (${tourismRisks[0].districtName}): Mermer/sıva ve yol yamaları Mayıs sezon algısını etkileyebilir.`}
        </div>
      )}
      <p className="text-[8px] font-mono text-muted-foreground/75 mt-1" data-testid="tourism-occupancy-source-note">
        {translate(occupancySourceSummary)}
      </p>
    </DashboardPanel>
  );
};

export const VisitorProfilePanel = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  return (
    <DashboardPanel title="Ziyaretçi Profili" badge="Kültür-Turizm Bk. 2024" badgeVariant="info">
      <StatusList
        items={[
          { label: isEn ? "🇬🇧 United Kingdom" : "🇬🇧 İngiltere", value: "22%", status: "ok" },
          { label: isEn ? "🇩🇪 Germany" : "🇩🇪 Almanya", value: "18%", status: "ok" },
          { label: isEn ? "🇳🇱 Netherlands" : "🇳🇱 Hollanda", value: "12%", status: "ok" },
          { label: isEn ? "🇷🇺 Russia" : "🇷🇺 Rusya", value: "9%", status: "info" },
          { label: isEn ? "🇹🇷 Domestic" : "🇹🇷 Yurtiçi", value: "28%", status: "ok" },
          { label: "Diğer", value: "11%", status: "info" },
        ]}
      />
      <p className="tech-meta-only text-[8px] font-mono text-muted-foreground/70 mt-1">
        {isEn ? "Source: Ministry of Culture & Tourism 2024 · Annual share" : "Kaynak: Kültür ve Turizm Bakanlığı 2024 · Yıllık dağılım"}
      </p>
    </DashboardPanel>
  );
};

export const GastronomyQuickPanel = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  return (
    <DashboardPanel title="Gastronomi" icon={<UtensilsCrossed size={14} />} badge="Ticaret Odası 2024" badgeVariant="info">
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Restoran Sayısı"
          value="4,820"
          info={isEn ? "Registered restaurants across Muğla." : "Kayıtlı restoran sayısı. Muğla Ticaret Odası + Kültür ve Turizm Bakanlığı 2024."}
        />
        <StatCard
          label="Ort. Yemek Fiyat"
          value="450"
          unit="₺"
          info={isEn ? "Regional average meal price per person." : "Bölge ortalama kişi başı yemek fiyatı 2024. Mevsimsel değişken."}
        />
      </div>
      <p className="tech-meta-only text-[8px] font-mono text-muted-foreground/70 mt-1">
        {isEn ? "Source: Chamber of Commerce + Ministry of Culture & Tourism 2024" : "Kaynak: Ticaret Odası + Kültür ve Turizm Bakanlığı 2024"}
      </p>
    </DashboardPanel>
  );
};

export const TourismSection = () => {
  return (
    <div className="space-y-3">
      <TourismMovementPanel />
      <AccommodationPanel />
      <VisitorProfilePanel />
      <GastronomyQuickPanel />
    </div>
  );
};
