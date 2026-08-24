import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { MiniChart } from "../MiniChart";
import { useState } from "react";
import { TrendingUp, Building2, Home, Info, ChevronDown } from "lucide-react";
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

  // 13 ilçe m² fiyatı — ilk 4 varsayılan, gerisi tıklayınca açılır
  const ALL_DISTRICT_PRICES = [
    { name: "Bodrum", price: 95000 },
    { name: "Marmaris", price: 72000 },
    { name: "Fethiye", price: 55000 },
    { name: "Menteşe", price: 28000 },
    { name: "Milas", price: 26500 },
    { name: "Datça", price: 52000 },
    { name: "Dalaman", price: 24500 },
    { name: "Köyceğiz", price: 23000 },
    { name: "Ortaca", price: 21000 },
    { name: "Seydikemer", price: 18500 },
    { name: "Ula", price: 19800 },
    { name: "Yatağan", price: 16800 },
    { name: "Kavaklıdere", price: 12500 },
  ];
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  // API verisi geldiyse onu kullan, yoksa 13 ilçe referans listesi
  const displayPrices = (districtPrices && districtPrices.length >= 13)
    ? districtPrices
    : (districtPrices && districtPrices.length > 0)
      ? [...districtPrices, ...ALL_DISTRICT_PRICES.filter(a => !districtPrices.some(d => d.name === a.name))]
      : ALL_DISTRICT_PRICES;
  const visibleDistricts = showAllDistricts ? displayPrices : displayPrices.slice(0, 4);
  const maxDistrictPrice = displayPrices[0]?.price ?? 1;

  return (
    <div className="space-y-3">
      <DashboardPanel title="Ekonomi & İstihdam" icon={<TrendingUp size={14} />} badge={ecoBadge} badgeVariant="info" count={8}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatCard
            label="İşsizlik" value={String(unemployment)} unit="%" change={-0.8} variant="primary"
            info="TÜİK İşgücü İstatistikleri, 2024/Ç4 dönemi. Çeyreklik yayınlanır; değişim bir önceki çeyreğe göredir."
          />
          <StatCard
            label="Turizm Geliri" value={tourismRevenueBn} unit="Myr ₺" change={12.5} variant="primary"
            info="Kültür ve Turizm Bakanlığı 2024 yıllık verisi (1580M USD) × güncel TCMB/ECB kuru (Frankfurter, günlük). Değişim yıllık bazdadır."
          />
          <StatCard
            label="Yeni Şirket" value={String(newCompanies)} change={5.2} variant="accent"
            info="TOBB şirket kuruluş istatistikleri, yıllık toplam. Değişim oranı yıllık bazda hesaplanır."
          />
          <StatCard
            label="KOBİ Sayısı" value="18.5K" change={2.1}
            info="TOBB + KOSGEB kayıtlı aktif KOBİ sayısı, 2024. Değişim yıllık bazdadır."
          />
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
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground uppercase">
            <span>İlçe Bazında Konut m² Fiyatı (₺)</span>
            <span className="text-amber-400">YoY %{yoyChange}</span>
          </div>
          {visibleDistricts.map(d => (
            <div key={d.name} className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-foreground flex items-center gap-1"><Home size={9} className="text-amber-400" /> {d.name}</span>
                <span className="font-bold text-amber-400">{(d.price / 1000).toFixed(1)}K ₺</span>
              </div>
              <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-amber-400 transition-all duration-700"
                  style={{ width: `${(d.price / maxDistrictPrice) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {displayPrices.length > 4 && (
            <button
              onClick={() => setShowAllDistricts(v => !v)}
              className="w-full flex items-center justify-center gap-1 text-[9px] font-mono text-amber-400/80 hover:text-amber-400 pt-0.5 transition-colors"
            >
              {showAllDistricts ? "Daha az göster" : `Tüm ilçeler (+${displayPrices.length - 4})`}
              <ChevronDown size={10} className={`transition-transform ${showAllDistricts ? "rotate-180" : ""}`} />
            </button>
          )}
          <p className="text-[8px] font-mono text-muted-foreground/70 pt-1">
            Kaynak: REIDIN-GYODER 2024 + Sahibinden bölge ortalaması · Kira getirisi %{reData?.rental_yield_pct ?? 5.2}
          </p>
        </div>
      </DashboardPanel>
    </div>
  );
};
