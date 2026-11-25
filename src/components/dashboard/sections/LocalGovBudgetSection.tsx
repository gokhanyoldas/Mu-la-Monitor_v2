import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { Landmark, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";

type BudgetItem = {
  category: string;
  amount: number;
  percentage: number;
};

type Municipality = {
  name: string;
  totalBudget: number;
  items: BudgetItem[];
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
  { name: "Büyükşehir Belediyesi", totalBudget: 8200, items: [
    { category: "Altyapı & Yol", amount: 2624, percentage: 32 },
    { category: "Su & Kanalizasyon", amount: 1476, percentage: 18 },
    { category: "Ulaşım", amount: 1230, percentage: 15 },
    { category: "Çevre & Park", amount: 820, percentage: 10 },
    { category: "Sosyal Hizmetler", amount: 738, percentage: 9 },
    { category: "Kültür & Turizm", amount: 574, percentage: 7 },
    { category: "Personel", amount: 492, percentage: 6 },
    { category: "Diğer", amount: 246, percentage: 3 },
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

export const LocalGovBudgetSection = () => {
  const [openMunicipality, setOpenMunicipality] = useState<string | null>("Büyükşehir Belediyesi");
  const { data: budgetData, isLoading } = useLiveData<any>("budget", { refetchInterval: 24 * 60 * 60 * 1000 });
  const hub = useOptionalUnifiedIntelligence();

  const municipalities: Municipality[] = budgetData?.municipalities || fallbackMunicipalities;
  const totalAllBudgets = municipalities.reduce((a, m) => a + m.totalBudget, 0);

  return (
    <div className="space-y-3">
      <DashboardPanel title="Yerel Yönetim Bütçeleri" icon={<Landmark size={14} />} badge="2024 RESMİ" badgeVariant="info">
        {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Toplam Bütçe" value={`${(totalAllBudgets / 1000).toFixed(1)}`} unit="Milyar ₺" variant="primary" info="Muğla Valiliği + Büyükşehir ve İlçe Meclisleri onaylı 2024 bütçe toplamı" />
          <StatCard label="İzlenen Kurum" value={String(municipalities.length)} variant="accent" info="Resmi bütçe kararı izlenen yerel idare sayısı" />
        </div>

        <div className="space-y-1">
          {municipalities.map((mun) => {
            const munAlerts = hub?.getBudgetAlertsForMunicipality(mun.name) ?? [];
            const hasFieldDemand = munAlerts.length > 0;
            const alertProjects = Array.from(new Set(munAlerts.flatMap((a) => a?.projects ?? [])));
            const alertCats = munAlerts.flatMap((a) => a?.categories ?? []).map((c) => c.toLocaleLowerCase("tr-TR"));

            return (
              <div
                key={mun.name}
                className={`rounded overflow-hidden transition-colors ${
                  hasFieldDemand ? "bg-amber-500/10 border border-amber-500/50" : "bg-muted/20"
                }`}
              >
                <button
                  onClick={() => setOpenMunicipality(openMunicipality === mun.name ? null : mun.name)}
                  className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 transition-colors gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-semibold text-foreground/80 truncate">{mun.name}</span>
                    {hasFieldDemand && (
                      <span className="shrink-0 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Güncel Gündem
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-primary">{mun.totalBudget >= 1000 ? `${(mun.totalBudget / 1000).toFixed(1)} Milyar ₺` : `${mun.totalBudget} Milyon ₺`}</span>
                    {openMunicipality === mun.name ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                  </div>
                </button>
                {openMunicipality === mun.name && (
                  <div className="px-2.5 pb-3">
                    {hasFieldDemand && (
                      <div className="mb-2 rounded border border-amber-500/40 bg-background/60 p-2 text-[10px] font-mono space-y-1">
                        <div className="font-bold text-amber-300">Güncel Proje Notu:</div>
                        <div className="text-foreground/85">{munAlerts[0]?.detail}</div>
                        {alertProjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {alertProjects.map((proj) => (
                              <span key={proj} className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-200 border border-rose-500/30 text-[9px]">
                                {proj}
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
                          title={`${item.category}: ${item.percentage}%`}
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
                                {item.category}
                                {catMatched && <span className="ml-1.5 text-[8px] text-amber-300 font-bold">· Güncel</span>}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-muted-foreground">{item.amount >= 1000 ? `${(item.amount / 1000).toFixed(1)} Milyar` : `${item.amount} Milyon`} ₺</span>
                              <span className="text-[10px] font-mono font-bold text-primary w-8 text-right">{item.percentage}%</span>
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
        {budgetData?.source && <div className="text-[8px] font-mono text-muted-foreground mt-2 text-right">Kaynak: {budgetData.source}</div>}
      </DashboardPanel>
    </div>
  );
};
