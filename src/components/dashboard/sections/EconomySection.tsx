import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { MiniChart } from "../MiniChart";
import { TrendingUp, Building2, Home } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

const gdpData = [
  { name: "Oca", value: 82 }, { name: "Şub", value: 85 }, { name: "Mar", value: 88 },
  { name: "Nis", value: 91 }, { name: "May", value: 95 }, { name: "Haz", value: 110 },
  { name: "Tem", value: 125 }, { name: "Ağu", value: 130 }, { name: "Eyl", value: 115 },
  { name: "Eki", value: 100 }, { name: "Kas", value: 92 }, { name: "Ara", value: 88 },
];

const realEstateData = [
  { name: "Oca", value: 12500 }, { name: "Şub", value: 12800 }, { name: "Mar", value: 13200 },
  { name: "Nis", value: 14000 }, { name: "May", value: 15200 }, { name: "Haz", value: 16800 },
  { name: "Tem", value: 17500 }, { name: "Ağu", value: 17200 }, { name: "Eyl", value: 16500 },
  { name: "Eki", value: 15800 }, { name: "Kas", value: 15200 }, { name: "Ara", value: 14800 },
];

export const EconomySection = () => {
  const { data: ecoData } = useLiveData<any>("economy", { refetchInterval: 30 * 60 * 1000 });
  const { data: reData } = useLiveData<any>("real_estate", { refetchInterval: 30 * 60 * 1000 });

  const unemployment = ecoData?.unemployment_rate ?? 10.8;
  const newCompanies = ecoData?.new_companies ?? 342;

  // Turizm geliri: Kültür ve Turizm Bakanlığı (USD milyon) × güncel kur (Frankfurter/ECB)
  const tourismRevenueBn = ecoData?.tourism_revenue_usd_m && ecoData?.usd_try
    ? ((ecoData.tourism_revenue_usd_m * ecoData.usd_try) / 1000).toFixed(1)
    : "4.8";

  // m² fiyatları: REIDIN ilçe kırılımı
  const DISTRICT_LABELS: Record<string, string> = {
    bodrum: "Bodrum", marmaris: "Marmaris", fethiye: "Fethiye", mugla_merkez: "Menteşe",
  };
  const districtPrices = reData?.avg_price_per_m2_try
    ? Object.entries(reData.avg_price_per_m2_try as Record<string, number>)
        .map(([slug, price]) => ({ name: DISTRICT_LABELS[slug] ?? slug, price }))
        .sort((a, b) => b.price - a.price)
    : null;
  const maxPrice = districtPrices?.[0]?.price ?? 1;
  const yoyChange = reData?.yoy_change_pct ?? 42;

  const ecoBadge = ecoData?.source_period ?? "TÜİK 2024/Ç4";
  const reBadge = reData?.source_period ?? "REIDIN 2024";

  return (
    <div className="space-y-3">
      <DashboardPanel title="Ekonomi & İstihdam" icon={<TrendingUp size={14} />} badge={ecoBadge} badgeVariant="info" count={8}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard label="İşsizlik" value={String(unemployment)} unit="%" change={-0.8} variant="primary" />
          <StatCard label="Turizm Geliri" value={tourismRevenueBn} unit="Myr ₺" change={12.5} variant="primary" />
          <StatCard label="Yeni Şirket" value={String(newCompanies)} change={5.2} variant="accent" />
          <StatCard label="KOBİ Sayısı" value="18.5K" change={2.1} />
        </div>
        <p className="text-[8px] font-mono text-muted-foreground/70 mb-2 -mt-1">
          Kaynak: TÜİK + Kültür ve Turizm Bakanlığı + TCMB (Frankfurter/ECB günlük kur)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Turizm Gelir Endeksi</span>
            <MiniChart data={gdpData} color="hsl(160, 60%, 45%)" showAxis />
          </div>
          <div>
            <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Sektör Dağılımı</span>
            <div className="space-y-1.5 mt-1">
              {[
                { label: "Turizm & Hizmet", pct: 62 },
                { label: "Tarım", pct: 18 },
                { label: "İnşaat", pct: 12 },
                { label: "Sanayi", pct: 8 },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">{s.label}</span>
                  <div className="flex-1 bg-muted/30 rounded-full h-1.5">
                    <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-foreground w-8 text-right">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardPanel>

      <DashboardPanel title="Gayrimenkul" icon={<Building2 size={14} />} badge={reBadge} badgeVariant="info">
        {districtPrices ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground uppercase">
              <span>İlçe Bazında Konut m² Fiyatı (₺)</span>
              <span className="text-amber-400">YoY %{yoyChange}</span>
            </div>
            {districtPrices.map(d => (
              <div key={d.name} className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-foreground flex items-center gap-1"><Home size={9} className="text-amber-400" /> {d.name}</span>
                  <span className="font-bold text-amber-400">{(d.price / 1000).toFixed(0)}K ₺</span>
                </div>
                <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-amber-400 transition-all duration-700"
                    style={{ width: `${(d.price / maxPrice) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[8px] font-mono text-muted-foreground/70 pt-1">
              Kaynak: REIDIN-GYODER 2024 + Sahibinden bölge ortalaması · Kira getirisi %{reData?.rental_yield_pct ?? 5.2}
            </p>
          </div>
        ) : (
          <MiniChart data={realEstateData} color="hsl(38, 92%, 50%)" height={50} showAxis />
        )}
      </DashboardPanel>
    </div>
  );
};
