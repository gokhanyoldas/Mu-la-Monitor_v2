import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { MiniChart } from "../MiniChart";
import { useState } from "react";
import { TrendingUp, Building2, Home, ChevronDown, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useTranslation } from "@/hooks/useTranslation";
import { useEconomyIntelligence, VERIFIED_BUDGET_SEED } from "@/services/topicGroundingService";
import { DataOriginBadge } from "../DataOriginBadge";
import { useMonitorStore, selectEconomyOverride } from "@/store/useMonitorStore";
import { formatRelativeTime } from "@/lib/time-utils";

const gdpDataTr = [
  { name: "Oca", value: 82 }, { name: "Şub", value: 85 }, { name: "Mar", value: 88 },
  { name: "Nis", value: 91 }, { name: "May", value: 95 }, { name: "Haz", value: 110 },
  { name: "Tem", value: 125 }, { name: "Ağu", value: 130 }, { name: "Eyl", value: 115 },
  { name: "Eki", value: 100 }, { name: "Kas", value: 92 }, { name: "Ara", value: 88 },
];

const gdpDataEn = [
  { name: "Jan", value: 82 }, { name: "Feb", value: 85 }, { name: "Mar", value: 88 },
  { name: "Apr", value: 91 }, { name: "May", value: 95 }, { name: "Jun", value: 110 },
  { name: "Jul", value: 125 }, { name: "Aug", value: 130 }, { name: "Sep", value: 115 },
  { name: "Oct", value: 100 }, { name: "Nov", value: 92 }, { name: "Dec", value: 88 },
];

export const EconomySection = () => {
  return (
    <div className="space-y-3">
      <EconomyOverviewPanel />
      <RealEstatePanel />
    </div>
  );
};

export const EconomyOverviewPanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const storeEconomy = useMonitorStore(selectEconomyOverride);
  const queryEconomy = useEconomyIntelligence();
  const activeEconomy =
    storeEconomy?.hasVerifiedLiveData && !queryEconomy.hasVerifiedLiveData
      ? storeEconomy
      : queryEconomy;
  const {
    unemploymentRate,
    unemploymentPeriod,
    tourismRevenueBn,
    newCompanies,
    budgetItems,
    municipalBudgets,
    combinedTotalBillionTry,
    budgetYear,
    budgetYoyChangePct,
    hasVerifiedBudgetUpdate,
    hasVerifiedLiveData,
    latestSourceSummary,
    latestMeasuredAt,
  } = activeEconomy;
  const isLoading = queryEconomy.isLoading;

  const ecoBadge =
    hasVerifiedBudgetUpdate || budgetItems.length > 0
      ? budgetYear
        ? `${budgetYear} BÜTÇE`
        : "BÜTÇE / İHALE"
      : unemploymentPeriod
      ? unemploymentPeriod
      : hasVerifiedLiveData
      ? "GÜNCEL"
      : `${VERIFIED_BUDGET_SEED.year} BÜTÇE`;

  const verifiedBudgetDisplayBn =
    combinedTotalBillionTry !== null
      ? combinedTotalBillionTry
      : municipalBudgets.length > 0
      ? municipalBudgets[0].amountBillionTry
      : VERIFIED_BUDGET_SEED.combinedBillionTry;
  const effectiveBudgetYear = budgetYear ?? VERIFIED_BUDGET_SEED.year;
  const effectiveBudgetYoy =
    hasVerifiedBudgetUpdate && budgetYoyChangePct !== null
      ? budgetYoyChangePct
      : !hasVerifiedBudgetUpdate
      ? VERIFIED_BUDGET_SEED.yoyChangePct
      : undefined;

  return (
    <DashboardPanel
      title="Ekonomi & İstihdam"
      icon={<TrendingUp size={14} />}
      badge={ecoBadge}
      badgeVariant={hasVerifiedLiveData ? "active" : "info"}
      count={
        budgetItems.length > 0
          ? budgetItems.length
          : municipalBudgets.length > 0
          ? municipalBudgets.length
          : undefined
      }
    >
      <DataOriginBadge origin={hasVerifiedLiveData ? "live" : "reference"} className="mb-2" />
      {isLoading && !hasVerifiedLiveData && (
        <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StatCard
          label="İşsizlik"
          value={unemploymentRate !== null ? String(unemploymentRate) : "—"}
          unit={unemploymentRate !== null ? "%" : undefined}
          variant="primary"
          info={isEn ? "TurkStat regional labor force rate." : "TÜİK İşgücü İstatistikleri."}
        />
        <StatCard
          label="Turizm Geliri"
          value={tourismRevenueBn ?? "—"}
          unit={tourismRevenueBn !== null ? (isEn ? "B ₺" : "Milyar ₺") : undefined}
          variant="primary"
          info={isEn ? "Ministry of Culture & Tourism annual revenue × live FX rate." : "Kültür ve Turizm Bakanlığı yıllık verisi × güncel TCMB/ECB kuru."}
        />
        <StatCard
          label="Yeni Şirket"
          value={newCompanies !== null ? String(newCompanies) : "—"}
          variant="accent"
          info={isEn ? "TOBB company formation statistics." : "TOBB şirket kuruluş istatistikleri."}
        />
        <StatCard
          label="Bütçe / İhale"
          value={verifiedBudgetDisplayBn.toFixed(1)}
          unit={isEn ? "B ₺" : "Milyar ₺"}
          change={effectiveBudgetYoy}
          info={
            hasVerifiedBudgetUpdate
              ? isEn
                ? `Verified ${effectiveBudgetYear} municipal budget total (${latestSourceSummary}).`
                : `Doğrulanmış ${effectiveBudgetYear} belediye bütçe toplamı (${latestSourceSummary}).`
              : isEn
              ? `Approved council budget: MBB ${VERIFIED_BUDGET_SEED.mbbBillionTry}B + MUSKİ ${VERIFIED_BUDGET_SEED.muskiBillionTry}B = ${VERIFIED_BUDGET_SEED.combinedBillionTry}B ₺ (+${VERIFIED_BUDGET_SEED.yoyChangePct}%).`
              : VERIFIED_BUDGET_SEED.sourceLabel
          }
        />
      </div>

      {municipalBudgets.length > 0 && (
        <div className="mb-2 space-y-1">
          {municipalBudgets.slice(0, 3).map((b) => (
            <a
              key={`${b.institution}-${b.amountBillionTry}`}
              href={b.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-colors text-[10px] font-mono"
            >
              <span className="truncate text-foreground/90">
                <b className="text-primary">{translate(b.institution)}:</b>{" "}
                {b.year ? `${b.year} ` : ""}
                {isEn ? "Council Budget" : "Meclis Bütçesi"}
              </span>
              <span className="shrink-0 text-amber-400 font-bold tabular-nums-stat">
                {b.amountBillionTry.toFixed(1)} {isEn ? "B ₺" : "Milyar ₺"}
              </span>
            </a>
          ))}
        </div>
      )}

      {budgetItems.length > 0 && (
        <div className="mb-3 space-y-1">
          {budgetItems.slice(0, 3).map((item) => (
            <a
              key={item.id}
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-[10px] font-mono"
            >
              <span className="truncate text-foreground/90">
                <b className="text-primary">{item.institution}:</b> {translate(item.title)}
              </span>
              {item.amountLabel && (
                <span className="shrink-0 text-amber-400 font-bold">{translate(item.amountLabel)}</span>
              )}
            </a>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">
            {t("Turizm Gelir Endeksi", "Turizm Gelir Endeksi")}
          </span>
          <MiniChart data={isEn ? gdpDataEn : gdpDataTr} color="hsl(160, 60%, 45%)" showAxis />
        </div>
        <div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">
            {t("Sektör Dağılımı", "Sektör Dağılımı")}
          </span>
          <div className="space-y-1.5 mt-1">
            {[
              { label: "Turizm & Hizmet", pct: 62 },
              { label: "Tarım", pct: 18 },
              { label: "İnşaat", pct: 12 },
              { label: "Sanayi", pct: 8 },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-24 shrink-0">{t(s.label)}</span>
                <div className="flex-1 bg-muted/30 rounded-full h-1.5">
                  <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-[10px] font-mono text-foreground w-8 text-right tabular-nums-stat">
                  {s.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[8px] font-mono text-muted-foreground/75 mt-2" data-testid="economy-source-note">
        {translate(hasVerifiedLiveData ? latestSourceSummary : VERIFIED_BUDGET_SEED.sourceLabel)}
        {latestMeasuredAt ? ` · ${formatRelativeTime(latestMeasuredAt, lang)}` : ""}
      </p>
    </DashboardPanel>
  );
};

export const RealEstatePanel = () => {
  const { lang, t } = useTranslation();
  const isEn = lang === "en";
  const { data: reData } = useLiveData<any>("real_estate", { refetchInterval: 30 * 60 * 1000 });
  const isLive = Boolean(reData);
  const reBadge = reData?.source_period ?? "REFERANS · REIDIN 2024";
  const DISTRICT_LABELS: Record<string, string> = {
    bodrum: "Bodrum",
    marmaris: "Marmaris",
    fethiye: "Fethiye",
    mugla_merkez: "Menteşe",
    datca: "Datça",
    milas: "Milas",
    dalaman: "Dalaman",
    koycegiz: "Köyceğiz",
    ortaca: "Ortaca",
    ula: "Ula",
    seydikemer: "Seydikemer",
    yatagan: "Yatağan",
    kavaklidere: "Kavaklıdere",
  };
  const districtPrices = reData?.avg_price_per_m2_try
    ? Object.entries(reData.avg_price_per_m2_try as Record<string, number>)
        .map(([slug, price]) => ({ name: DISTRICT_LABELS[slug] ?? slug, price }))
        .sort((a, b) => b.price - a.price)
    : null;
  const yoyChange = reData?.yoy_change_pct ?? 42;
  const ALL_DISTRICT_PRICES = [
    { name: "Bodrum", price: 95000 },
    { name: "Marmaris", price: 72000 },
    { name: "Fethiye", price: 55000 },
    { name: "Menteşe", price: 28000 },
    { name: "Milas", price: 26500 },
    { name: "Datça", price: 52000 },
    { name: "Dalaman", price: 24500 },
    { name: "Köyceğiz", price: 23000 },
    { name: "Ortaca", price: 25000 },
    { name: "Ula", price: 34000 },
    { name: "Seydikemer", price: 18500 },
    { name: "Yatağan", price: 16800 },
    { name: "Kavaklıdere", price: 12500 },
  ];
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  const displayPrices =
    districtPrices && districtPrices.length >= 13
      ? districtPrices
      : districtPrices && districtPrices.length > 0
      ? [...districtPrices, ...ALL_DISTRICT_PRICES.filter((a) => !districtPrices.some((d) => d.name === a.name))]
      : ALL_DISTRICT_PRICES;
  const visibleDistricts = showAllDistricts ? displayPrices : displayPrices.slice(0, 4);
  const maxDistrictPrice = displayPrices[0]?.price ?? 1;

  return (
    <DashboardPanel
      title="Gayrimenkul"
      icon={<Building2 size={14} />}
      badge={reBadge}
      badgeVariant={isLive ? "info" : "warning"}
    >
      <DataOriginBadge origin={isLive ? "live" : "reference"} className="mb-2" />
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2 mb-1">
          <StatCard
            label="Kira Ort."
            value={reData?.avg_rent ? `${(reData.avg_rent / 1000).toFixed(1)}K` : "15.2K"}
            unit={isEn ? "₺/mo" : "₺/ay"}
            change={22.1}
            variant="destructive"
            info={isEn ? "REIDIN-GYODER 2024 average rent (YoY change)." : "REIDIN-GYODER 2024 kira ortalaması. Değişim yıllık bazdadır (YoY)."}
          />
          <StatCard
            label="Satılık"
            value={reData?.total_for_sale ? reData.total_for_sale.toLocaleString() : "8,420"}
            change={-3.2}
            info={isEn ? "Active for-sale listings." : "Sahibinden aktif satılık ilan sayısı, anlık."}
          />
          <StatCard
            label="Kiralık"
            value={reData?.total_for_rent ? reData.total_for_rent.toLocaleString() : "2,180"}
            change={-12.5}
            info={isEn ? "Active rental listings." : "Sahibinden aktif kiralık ilan sayısı, anlık."}
          />
        </div>

        <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground uppercase">
          <span>{t("İlçe Bazında Konut m² Fiyatı (₺)", "İlçe Bazında Konut m² Fiyatı (₺)")}</span>
          <span className="text-amber-400">
            {isEn ? `YoY ${yoyChange}%` : `Yıllık %${yoyChange}`}
          </span>
        </div>
        {visibleDistricts.map((d) => (
          <div key={d.name} className="space-y-0.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-foreground flex items-center gap-1">
                <Home size={9} className="text-amber-400" aria-hidden="true" /> {d.name}
              </span>
              <span className="font-bold text-amber-400 tabular-nums-stat">{(d.price / 1000).toFixed(1)}K ₺</span>
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
            type="button"
            onClick={() => setShowAllDistricts((v) => !v)}
            aria-expanded={showAllDistricts}
            className="w-full flex items-center justify-center gap-1 text-[9px] font-mono text-amber-400/80 hover:text-amber-400 pt-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {showAllDistricts
              ? t("Daha az göster", "Daha az göster")
              : `${t("Tüm ilçeler", "Tüm ilçeler")} (+${displayPrices.length - 4})`}
            <ChevronDown size={10} aria-hidden="true" className={`transition-transform ${showAllDistricts ? "rotate-180" : ""}`} />
          </button>
        )}
        {reData?.tcmb_hpi_series && reData.tcmb_hpi_series.length >= 2 && (
          <div className="pt-1.5 border-t border-border/30">
            <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground uppercase mb-1">
              <span>{t("TCMB Konut Fiyat Endeksi — Muğla (aylık)", "TCMB Konut Fiyat Endeksi — Muğla (aylık)")}</span>
              <span className="text-amber-400">2023=100</span>
            </div>
            <MiniChart
              data={reData.tcmb_hpi_series.map((it: { month: string; index: number }) => ({
                name: it.month.slice(5),
                value: it.index,
              }))}
              color="hsl(38, 92%, 50%)"
              height={44}
              showAxis
            />
          </div>
        )}
        <p className="tech-meta-only text-[8px] font-mono text-muted-foreground/70 pt-1">
          {isEn
            ? `Source: REIDIN-GYODER 2024 + Regional Listings · Rental yield ${reData?.rental_yield_pct ?? 5.2}%`
            : `Kaynak: REIDIN-GYODER 2024 + Sahibinden bölge ortalaması · Kira getirisi %${reData?.rental_yield_pct ?? 5.2}`}
        </p>
      </div>
    </DashboardPanel>
  );
};
