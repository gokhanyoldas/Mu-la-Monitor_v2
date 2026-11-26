import { useMemo, useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Landmark, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useEconomyIntelligence,
  canonicalizeBudgetInstitution,
  formatShortTurkishDate,
  VERIFIED_BUDGET_SEED,
  type MunicipalBudgetUpdate,
} from "@/services/topicGroundingService";
import { DataOriginBadge } from "../DataOriginBadge";
import { useMonitorStore, selectEconomyOverride } from "@/store/useMonitorStore";
import { formatRelativeTime } from "@/lib/time-utils";

type BudgetItem = {
  category: string;
  amount: number;
  percentage: number;
};

type Municipality = {
  name: string;
  totalBudget: number;
  items: BudgetItem[];
  verifiedUpdate?: MunicipalBudgetUpdate;
};

const fallbackMunicipalities: Municipality[] = [
  { name: "Muğla Valiliği", totalBudget: 4200, items: [
    { category: "Altyapı & Yol", amount: 1260, percentage: 30 },
    { category: "Eğitim", amount: 840, percentage: 20 },
    { category: "Sağlık", amount: 630, percentage: 15 },
    { category: "Güvenlik", amount: 546, percentage: 13 },
    { category: "Sosyal Yardım", amount: 420, percentage: 10 },
    { category: "Kültür & Sanat", amount: 252, percentage: 6 },
    { category: "Diğer", amount: 252, percentage: 6 },
  ]},
  { name: "Büyükşehir Belediyesi", totalBudget: 24300, items: [
    { category: "Altyapı & Yol", amount: 7290, percentage: 30 },
    { category: "Ulaşım & Toplu Taşıma", amount: 3645, percentage: 15 },
    { category: "Su & Altyapı Destek", amount: 3402, percentage: 14 },
    { category: "Çevre & Park", amount: 2673, percentage: 11 },
    { category: "Sosyal Hizmetler", amount: 2430, percentage: 10 },
    { category: "Kültür & Turizm", amount: 1944, percentage: 8 },
    { category: "Personel & İşletme", amount: 1799, percentage: 7 },
    { category: "MUTTAŞ Sermaye Artışı (1.116.639.124 ₺)", amount: 1117, percentage: 5 },
  ]},
  { name: "MUSKİ", totalBudget: 20500, items: [
    { category: "Su & Kanalizasyon", amount: 9020, percentage: 44 },
    { category: "Altyapı & İsale", amount: 6560, percentage: 32 },
    { category: "Arıtma & Çevre", amount: 3280, percentage: 16 },
    { category: "İşletme & Enerji", amount: 1640, percentage: 8 },
  ]},
  { name: "Bodrum Belediyesi", totalBudget: 2800, items: [
    { category: "Altyapı", amount: 840, percentage: 30 },
    { category: "Turizm & Tanıtım", amount: 420, percentage: 15 },
    { category: "Çevre", amount: 392, percentage: 14 },
    { category: "Sosyal", amount: 336, percentage: 12 },
    { category: "Ulaşım", amount: 280, percentage: 10 },
    { category: "Kültür", amount: 252, percentage: 9 },
    { category: "Diğer", amount: 280, percentage: 10 },
  ]},
  { name: "Fethiye Belediyesi", totalBudget: 1600, items: [
    { category: "Altyapı", amount: 512, percentage: 32 },
    { category: "Ulaşım", amount: 240, percentage: 15 },
    { category: "Çevre & Park", amount: 224, percentage: 14 },
    { category: "Sosyal", amount: 192, percentage: 12 },
    { category: "Kültür & Turizm", amount: 160, percentage: 10 },
    { category: "Diğer", amount: 272, percentage: 17 },
  ]},
  { name: "Marmaris Belediyesi", totalBudget: 1400, items: [
    { category: "Altyapı", amount: 420, percentage: 30 },
    { category: "Turizm", amount: 252, percentage: 18 },
    { category: "Çevre", amount: 196, percentage: 14 },
    { category: "Ulaşım", amount: 168, percentage: 12 },
    { category: "Sosyal", amount: 140, percentage: 10 },
    { category: "Diğer", amount: 224, percentage: 16 },
  ]},
  { name: "Milas Belediyesi", totalBudget: 950, items: [
    { category: "Altyapı", amount: 323, percentage: 34 },
    { category: "Tarım Destek", amount: 143, percentage: 15 },
    { category: "Sosyal", amount: 124, percentage: 13 },
    { category: "Ulaşım", amount: 105, percentage: 11 },
    { category: "Diğer", amount: 255, percentage: 27 },
  ]},
  { name: "Dalaman Belediyesi", totalBudget: 480, items: [
    { category: "Altyapı", amount: 163, percentage: 34 },
    { category: "Ulaşım", amount: 72, percentage: 15 },
    { category: "Çevre", amount: 62, percentage: 13 },
    { category: "Diğer", amount: 183, percentage: 38 },
  ]},
  { name: "Datça Belediyesi", totalBudget: 320, items: [
    { category: "Altyapı", amount: 96, percentage: 30 },
    { category: "Turizm & Kültür", amount: 64, percentage: 20 },
    { category: "Çevre", amount: 51, percentage: 16 },
    { category: "Diğer", amount: 109, percentage: 34 },
  ]},
  { name: "Ortaca Belediyesi", totalBudget: 380, items: [
    { category: "Altyapı", amount: 129, percentage: 34 },
    { category: "Sosyal", amount: 57, percentage: 15 },
    { category: "Çevre", amount: 46, percentage: 12 },
    { category: "Diğer", amount: 148, percentage: 39 },
  ]},
  { name: "Köyceğiz Belediyesi", totalBudget: 280, items: [
    { category: "Altyapı", amount: 90, percentage: 32 },
    { category: "Turizm", amount: 45, percentage: 16 },
    { category: "Çevre", amount: 42, percentage: 15 },
    { category: "Diğer", amount: 103, percentage: 37 },
  ]},
  { name: "Yatağan Belediyesi", totalBudget: 350, items: [
    { category: "Altyapı", amount: 119, percentage: 34 },
    { category: "Enerji & Maden", amount: 53, percentage: 15 },
    { category: "Sosyal", amount: 42, percentage: 12 },
    { category: "Diğer", amount: 136, percentage: 39 },
  ]},
  { name: "Ula Belediyesi", totalBudget: 220, items: [
    { category: "Altyapı", amount: 77, percentage: 35 },
    { category: "Tarım", amount: 33, percentage: 15 },
    { category: "Diğer", amount: 110, percentage: 50 },
  ]},
  { name: "Kavaklıdere Belediyesi", totalBudget: 180, items: [
    { category: "Altyapı", amount: 65, percentage: 36 },
    { category: "Tarım", amount: 27, percentage: 15 },
    { category: "Diğer", amount: 88, percentage: 49 },
  ]},
  { name: "Seydikemer Belediyesi", totalBudget: 420, items: [
    { category: "Altyapı", amount: 143, percentage: 34 },
    { category: "Tarım & Hayvancılık", amount: 63, percentage: 15 },
    { category: "Çevre", amount: 50, percentage: 12 },
    { category: "Diğer", amount: 164, percentage: 39 },
  ]},
  { name: "Menteşe Belediyesi", totalBudget: 680, items: [
    { category: "Altyapı", amount: 218, percentage: 32 },
    { category: "Eğitim & Kültür", amount: 102, percentage: 15 },
    { category: "Ulaşım", amount: 82, percentage: 12 },
    { category: "Sosyal", amount: 68, percentage: 10 },
    { category: "Diğer", amount: 210, percentage: 31 },
  ]},
];

const barColors = [
  "bg-primary", "bg-accent", "bg-warning", "bg-success",
  "bg-destructive", "bg-chart-4", "bg-muted-foreground", "bg-chart-5",
];

const MUSKI_DEFAULT_BREAKDOWN: Array<{ category: string; percentage: number }> = [
  { category: "Su & Kanalizasyon", percentage: 44 },
  { category: "Altyapı & İsale", percentage: 32 },
  { category: "Arıtma & Çevre", percentage: 16 },
  { category: "İşletme & Enerji", percentage: 8 },
];

function rescaleItems(items: BudgetItem[], nextTotalMillion: number): BudgetItem[] {
  return items.map((item) => ({
    ...item,
    amount: Math.round((nextTotalMillion * item.percentage) / 100),
  }));
}

export const LocalGovBudgetSection = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const [openMunicipality, setOpenMunicipality] = useState<string | null>("Büyükşehir Belediyesi");
  const { data: budgetData, isLoading: cacheLoading } = useLiveData<any>("budget", {
    refetchInterval: 24 * 60 * 60 * 1000,
  });
  const storeEconomy = useMonitorStore(selectEconomyOverride);
  const queryEconomy = useEconomyIntelligence();
  const useStoreSnapshot = Boolean(
    storeEconomy?.hasVerifiedBudgetUpdate && !queryEconomy.hasVerifiedBudgetUpdate
  );
  const {
    municipalBudgets,
    combinedTotalBillionTry: liveCombinedTotal,
    budgetYear: liveBudgetYear,
    budgetYoyChangePct: liveYoyPct,
    budgetSourceSummary: liveBudgetSourceSummary,
    hasVerifiedBudgetUpdate,
    latestMeasuredAt,
  } = useStoreSnapshot && storeEconomy ? storeEconomy : queryEconomy;
  const intelLoading = queryEconomy.isLoading;
  const hub = useOptionalUnifiedIntelligence();

  const isLoading = cacheLoading || intelLoading;

  const municipalities: Municipality[] = useMemo(() => {
    const baseList: Municipality[] = (budgetData?.municipalities || fallbackMunicipalities).map(
      (m: Municipality) => ({
        ...m,
        items: m.items.map((it) => ({ ...it })),
      })
    );

    if (municipalBudgets.length === 0) {
      return baseList;
    }

    const updateByCanonical = new Map<string, MunicipalBudgetUpdate>();
    for (const upd of municipalBudgets) {
      updateByCanonical.set(canonicalizeBudgetInstitution(upd.institution), upd);
    }

    const matchedKeys = new Set<string>();
    const updatedList = baseList.map((mun) => {
      const canonical = canonicalizeBudgetInstitution(mun.name);
      const upd = updateByCanonical.get(canonical);
      if (!upd) return mun;
      matchedKeys.add(canonical);
      const nextTotalMillion = Math.round(upd.amountBillionTry * 1000);
      return {
        ...mun,
        totalBudget: nextTotalMillion,
        items: rescaleItems(mun.items, nextTotalMillion),
        verifiedUpdate: upd,
      };
    });

    // Eğer MUSKİ veya başka doğrulanmış yeni bir yerel kurum varsa listeye ekle
    const muskiUpd = updateByCanonical.get("MUSKİ");
    if (muskiUpd && !matchedKeys.has("MUSKİ")) {
      matchedKeys.add("MUSKİ");
      const muskiMillion = Math.round(muskiUpd.amountBillionTry * 1000);
      const muskiRow: Municipality = {
        name: "MUSKİ",
        totalBudget: muskiMillion,
        items: MUSKI_DEFAULT_BREAKDOWN.map((b) => ({
          category: b.category,
          percentage: b.percentage,
          amount: Math.round((muskiMillion * b.percentage) / 100),
        })),
        verifiedUpdate: muskiUpd,
      };
      const mbbIdx = updatedList.findIndex(
        (m) => canonicalizeBudgetInstitution(m.name) === "Büyükşehir Belediyesi"
      );
      if (mbbIdx >= 0) {
        updatedList.splice(mbbIdx + 1, 0, muskiRow);
      } else {
        updatedList.unshift(muskiRow);
      }
    }

    for (const [canonical, upd] of updateByCanonical.entries()) {
      if (matchedKeys.has(canonical)) continue;
      const totalMillion = Math.round(upd.amountBillionTry * 1000);
      updatedList.push({
        name: canonical,
        totalBudget: totalMillion,
        items: [
          { category: "Altyapı & Yatırım", percentage: 40, amount: Math.round(totalMillion * 0.4) },
          { category: "Hizmet & İşletme", percentage: 35, amount: Math.round(totalMillion * 0.35) },
          { category: "Diğer", percentage: 25, amount: Math.round(totalMillion * 0.25) },
        ],
        verifiedUpdate: upd,
      });
    }

    return updatedList;
  }, [budgetData?.municipalities, municipalBudgets]);

  const totalAllBudgets = municipalities.reduce((a, m) => a + m.totalBudget, 0);
  const combinedTotalBillionTry =
    liveCombinedTotal !== null ? liveCombinedTotal : VERIFIED_BUDGET_SEED.combinedBillionTry;
  const budgetYear = liveBudgetYear ?? VERIFIED_BUDGET_SEED.year;
  const budgetYoyChangePct =
    liveYoyPct !== null ? liveYoyPct : VERIFIED_BUDGET_SEED.yoyChangePct;
  const budgetSourceSummary = hasVerifiedBudgetUpdate
    ? liveBudgetSourceSummary
    : VERIFIED_BUDGET_SEED.sourceLabel;
  const panelBadge = hasVerifiedBudgetUpdate
    ? `${budgetYear} GÜNCEL`
    : `${VERIFIED_BUDGET_SEED.year} RESMİ`;

  return (
    <div className="space-y-3">
      <DashboardPanel
        title="Yerel Yönetim Bütçeleri"
        icon={<Landmark size={14} />}
        badge={panelBadge}
        badgeVariant={hasVerifiedBudgetUpdate ? "live" : "info"}
      >
        <DataOriginBadge origin={hasVerifiedBudgetUpdate ? "live" : "reference"} className="mb-2" />
        {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard
            label="Toplam Bütçe"
            value={`${(totalAllBudgets / 1000).toFixed(1)}`}
            unit={isEn ? "B ₺" : "Milyar ₺"}
            change={budgetYoyChangePct}
            variant="primary"
            info={
              hasVerifiedBudgetUpdate
                ? isEn
                  ? `Updated with verified ${budgetYear} council budget approvals (${budgetSourceSummary}).`
                  : `Doğrulanmış ${budgetYear} meclis bütçe kararlarıyla güncellendi (${budgetSourceSummary}).`
                : isEn
                ? `Approved council budgets (${VERIFIED_BUDGET_SEED.mbbBillionTry}B MBB + ${VERIFIED_BUDGET_SEED.muskiBillionTry}B MUSKİ = ${VERIFIED_BUDGET_SEED.combinedBillionTry}B ₺, +${VERIFIED_BUDGET_SEED.yoyChangePct}%).`
                : VERIFIED_BUDGET_SEED.sourceLabel
            }
          />
          <StatCard
            label="Büyükşehir + MUSKİ"
            value={combinedTotalBillionTry.toFixed(1)}
            unit={isEn ? "B ₺" : "Milyar ₺"}
            variant="accent"
            info={
              isEn
                ? `Combined Metropolitan Municipality + MUSKİ approved budget (${budgetYear}), incl. MUTTAŞ ${VERIFIED_BUDGET_SEED.muttasCapitalIncreaseBillionTry}B ₺ capital increase.`
                : `Muğla Büyükşehir Belediyesi (${VERIFIED_BUDGET_SEED.mbbBillionTry} Milyar ₺) + MUSKİ (${VERIFIED_BUDGET_SEED.muskiBillionTry} Milyar ₺) birleşik bütçe toplamı (${budgetYear}); MUTTAŞ sermaye artışı ${VERIFIED_BUDGET_SEED.muttasCapitalIncreaseBillionTry} Milyar ₺ dahil.`
            }
          />
        </div>

        <div className="space-y-1">
          {municipalities.map((mun) => {
            const munAlerts = hub?.getBudgetAlertsForMunicipality(mun.name) ?? [];
            const hasFieldDemand = munAlerts.length > 0;
            const alertProjects = Array.from(new Set(munAlerts.flatMap((a) => a?.projects ?? [])));
            const alertCats = munAlerts.flatMap((a) => a?.categories ?? []).map((c) => c.toLocaleLowerCase("tr-TR"));
            const isOpen = openMunicipality === mun.name;
            const upd = mun.verifiedUpdate;

            return (
              <div
                key={mun.name}
                className={`rounded overflow-hidden transition-colors ${
                  hasFieldDemand
                    ? "bg-amber-500/10 border border-amber-500/50"
                    : upd
                    ? "bg-primary/5 border border-primary/25"
                    : "bg-muted/20"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenMunicipality(isOpen ? null : mun.name)}
                  className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 transition-colors gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono font-semibold text-foreground/85 truncate">
                      {translate(mun.name)}
                    </span>
                    {upd && (
                      <span className="shrink-0 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {upd.year ?? budgetYear ?? 2026}
                        {upd.yoyChangePct !== null && upd.yoyChangePct !== undefined
                          ? ` · ${upd.yoyChangePct >= 0 ? "+" : ""}%${upd.yoyChangePct}`
                          : ""}
                      </span>
                    )}
                    {hasFieldDemand && (
                      <span className="shrink-0 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {t("Güncel Gündem")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-primary tabular-nums-stat">
                      {mun.totalBudget >= 1000
                        ? `${(mun.totalBudget / 1000).toFixed(1)} ${isEn ? "B ₺" : "Milyar ₺"}`
                        : `${mun.totalBudget} ${isEn ? "M ₺" : "Milyon ₺"}`}
                    </span>
                    {isOpen ? (
                      <ChevronUp size={12} className="text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <ChevronDown size={12} className="text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-2.5 pb-3">
                    {upd && (
                      <div className="mb-2 flex items-center justify-between gap-2 text-[9px] font-mono text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/25 rounded px-2 py-1">
                        <span className="truncate">
                          {isEn ? "Verified council budget" : "Doğrulanmış meclis bütçesi"} · {upd.sourceName}
                          {upd.publishedAt ? ` (${formatShortTurkishDate(upd.publishedAt)})` : ""}
                        </span>
                        <a
                          href={upd.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 underline hover:text-emerald-200"
                        >
                          {isEn ? "Source" : "Kaynak"}
                        </a>
                      </div>
                    )}
                    {hasFieldDemand && (
                      <div className="mb-2 rounded border border-amber-500/40 bg-background/60 p-2 text-[10px] font-mono space-y-1">
                        <div className="font-bold text-amber-300">{isEn ? "Active Project Note:" : "Güncel Proje Notu:"}</div>
                        <div className="text-foreground/85">{translate(munAlerts[0]?.detail || "")}</div>
                        {alertProjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {alertProjects.map((proj) => (
                              <span key={proj} className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-200 border border-rose-500/30 text-[9px]">
                                {translate(proj)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex h-3 rounded-full overflow-hidden mb-2">
                      {mun.items.map((item, j) => (
                        <div
                          key={j}
                          className={`${barColors[j % barColors.length]} transition-all`}
                          style={{ width: `${item.percentage}%` }}
                          title={`${t(item.category)}: ${item.percentage}%`}
                        />
                      ))}
                    </div>
                    <div className="space-y-0.5">
                      {mun.items.map((item, j) => {
                        const catLow = item.category.toLocaleLowerCase("tr-TR");
                        const catMatched = alertCats.some((ac) => catLow.includes(ac) || ac.includes(catLow.split(" ")[0]));
                        return (
                          <div
                            key={j}
                            className={`flex items-center justify-between py-0.5 px-1.5 rounded ${
                              catMatched ? "bg-amber-500/15 border border-amber-500/40" : ""
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-sm ${barColors[j % barColors.length]}`} />
                              <span className="text-[10px] font-mono text-foreground/80">
                                {t(item.category)}
                                {catMatched && (
                                  <span className="ml-1.5 text-[8px] text-amber-300 font-bold">
                                    · {t("Güncel")}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-muted-foreground tabular-nums-stat">
                                {item.amount >= 1000
                                  ? `${(item.amount / 1000).toFixed(1)} ${isEn ? "B" : "Milyar"}`
                                  : `${item.amount} ${isEn ? "M" : "Milyon"}`}{" "}
                                ₺
                              </span>
                              <span className="text-[10px] font-mono font-bold text-primary w-8 text-right tabular-nums-stat">
                                {item.percentage}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[8px] font-mono text-muted-foreground/75 mt-2" data-testid="budget-source-note">
          {hasVerifiedBudgetUpdate
            ? translate(budgetSourceSummary)
            : budgetData?.source
            ? `${isEn ? "Source" : "Kaynak"}: ${translate(String(budgetData.source))}`
            : translate(budgetSourceSummary)}
          {latestMeasuredAt ? ` · ${formatRelativeTime(latestMeasuredAt, lang)}` : ""}
        </p>
      </DashboardPanel>
    </div>
  );
};
