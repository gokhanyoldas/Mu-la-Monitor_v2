import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { MiniChart } from "../MiniChart";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { Plane, Hotel, UtensilsCrossed } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";

const touristData = [
  { name: "Oca", value: 45 }, { name: "Şub", value: 52 }, { name: "Mar", value: 78 },
  { name: "Nis", value: 120 }, { name: "May", value: 210 }, { name: "Haz", value: 380 },
  { name: "Tem", value: 520 }, { name: "Ağu", value: 550 }, { name: "Eyl", value: 320 },
  { name: "Eki", value: 180 }, { name: "Kas", value: 85 }, { name: "Ara", value: 50 },
];

export const TourismMovementPanel = () => {
  const { data: tourismData } = useLiveData<any>("tourism", { refetchInterval: 60 * 60 * 1000 });
  const hub = useOptionalUnifiedIntelligence();
  const tourismRisks = (hub?.arbitratedEvents ?? [])
    .map((e) => e.tourismRiskAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const annualTourists = tourismData?.annual_tourists ?? "3.85M";
  const cruiseShips = tourismData?.cruise_ships ?? 130;
  const airportPassengers = tourismData?.airport_passengers ?? "4.45M";

  return (
    <DashboardPanel title="Turizm" icon={<Plane size={14} />} badge={tourismData?.source_period ?? "Kültür-Turizm Bk. 2024"} badgeVariant="info" count={12}>
      {tourismRisks.length > 0 && (
        <div className="mb-2.5 rounded border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-mono">
          <div className="font-bold text-amber-300">⚠ {tourismRisks[0].title} ({tourismRisks[0].districtName})</div>
          <div className="text-foreground/90 mt-0.5">{tourismRisks[0].detail}</div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StatCard label="Yıllık Turist" value={String(annualTourists)} change={8.5} variant="primary"
          info={tourismData?.annual_tourists_note ?? "Kültür ve Turizm Bakanlığı 2024 yıllık turist sayısı. Değişim yıllık bazdadır."} />
        <StatCard label="Ülke Sayısı" value="92" variant="accent"
          info="Muğla'ya turist gönderen ülke sayısı. Kültür ve Turizm Bakanlığı 2024." />
        <StatCard label="Havalimanı Yolcu" value={String(airportPassengers)} change={11.2}
          info="DHMİ Dalaman + Milas-Bodrum yıllık yolcu sayısı 2024. Değişim yıllık." />
        <StatCard label="Kruvaziyer" value={String(cruiseShips)} unit="gemi" change={15.3}
          info="Kültür ve Turizm Bakanlığı 2024 kruvaziyer gemi sayısı. Değişim yıllık." />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Aylık Turist Girişi (bin)</span>
      <MiniChart data={touristData} color="hsl(200, 80%, 50%)" height={70} showAxis />
      <p className="text-[8px] font-mono text-muted-foreground/70 mt-1">
        Kaynak: Kültür ve Turizm Bakanlığı + DHMİ 2024 · Sezonsal aylık model
      </p>
    </DashboardPanel>
  );
};

export const AccommodationPanel = () => {
  const { data: tourismData } = useLiveData<any>("tourism", { refetchInterval: 60 * 60 * 1000 });
  const hub = useOptionalUnifiedIntelligence();
  const tourismRisks = (hub?.arbitratedEvents ?? [])
    .map((e) => e.tourismRiskAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const hotelOccupancy = tourismData?.hotel_occupancy ?? 38;
  const totalBeds = tourismData?.beds ?? 185_000;
  const totalBedsK = totalBeds >= 1000 ? `${Math.round(totalBeds / 1000)}K` : String(totalBeds);

  return (
    <DashboardPanel title="Konaklama" icon={<Hotel size={14} />} badge={tourismRisks.length > 0 ? "ŞANTİYE RİSKİ" : "TÜRSAB 2024"} badgeVariant={tourismRisks.length > 0 ? "warning" : "info"}>
      <div className="flex justify-around mb-3">
        <Gauge value={hotelOccupancy} max={100} label="Otel Doluluk" variant="accent" />
        <Gauge value={72} max={100} label="Sezon Doluluk" variant="primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Otel Fiyat Ort." value="3,200" unit="₺/gece" variant="warning"
          info="TÜRSAB bölge ortalaması 2024. Sezona göre değişir." />
        <StatCard label="Toplam Yatak" value={totalBedsK}
          info="Muğla geneli toplam yatak kapasitesi. Kültür ve Turizm Bakanlığı 2024." />
      </div>
      {tourismRisks.length > 0 && (
        <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[9px] font-mono text-amber-200">
          ⚠ Sezon Öncesi Şantiye Riski ({tourismRisks[0].districtName}): Mermer/sıva ve yol yamaları Mayıs sezon algısını etkileyebilir.
        </div>
      )}
      <p className="text-[8px] font-mono text-muted-foreground/70 mt-1">
        Kaynak: TÜRSAB + Kültür ve Turizm Bakanlığı 2024 · Günlük sezonsal model
      </p>
    </DashboardPanel>
  );
};

export const VisitorProfilePanel = () => {
  return (
    <DashboardPanel title="Ziyaretçi Profili" badge="Kültür-Turizm Bk. 2024" badgeVariant="info">
      <StatusList items={[
        { label: "🇬🇧 İngiltere", value: "22%", status: "ok" },
        { label: "🇩🇪 Almanya", value: "18%", status: "ok" },
        { label: "🇳🇱 Hollanda", value: "12%", status: "ok" },
        { label: "🇷🇺 Rusya", value: "9%", status: "info" },
        { label: "🇹🇷 Yurtiçi", value: "28%", status: "ok" },
        { label: "Diğer", value: "11%", status: "info" },
      ]} />
      <p className="text-[8px] font-mono text-muted-foreground/70 mt-1">
        Kaynak: Kültür ve Turizm Bakanlığı 2024 · Yıllık dağılım
      </p>
    </DashboardPanel>
  );
};

export const GastronomyQuickPanel = () => {
  return (
    <DashboardPanel title="Gastronomi" icon={<UtensilsCrossed size={14} />} badge="Ticaret Odası 2024" badgeVariant="info">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Restoran Sayısı" value="4,820"
          info="Kayıtlı restoran sayısı. Muğla Ticaret Odası + Kültür ve Turizm Bakanlığı 2024." />
        <StatCard label="Ort. Yemek Fiyat" value="450" unit="₺"
          info="Bölge ortalama kişi başı yemek fiyatı 2024. Mevsimsel değişken." />
      </div>
      <p className="text-[8px] font-mono text-muted-foreground/70 mt-1">
        Kaynak: Ticaret Odası + Kültür ve Turizm Bakanlığı 2024
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
