// IncidentFilterBar — Genel / İlçe bazlı / Kritik filtreleri + PDF/Excel export.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel, exportToPdf } from "@/utils/exportReports";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText, Filter, X } from "lucide-react";

export const DISTRICT_LIST = [
  "Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz",
  "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan",
];

export type ScopeFilter = "all" | "district" | "critical";

export interface IncidentFilterState {
  scope: ScopeFilter;
  district: string | null;
}

interface Props {
  value: IncidentFilterState;
  onChange: (next: IncidentFilterState) => void;
  className?: string;
}

const CATEGORY_TR: Record<string, string> = {
  fire_disaster: "Yangın/Afet",
  infrastructure_transport: "Altyapı/Ulaşım",
  tourism: "Turizm",
  governance: "Yönetim",
  general: "Genel",
};

function useExportRows(filter: IncidentFilterState, enabled: boolean) {
  return useQuery({
    queryKey: ["incident-export", filter.scope, filter.district],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from("social_posts")
        .select("district, category, sentiment, sentiment_score, content, platform, published_at, url")
        .gte("published_at", new Date(Date.now() - 24 * 3600e3).toISOString())
        .order("published_at", { ascending: false })
        .limit(2000);
      if (filter.scope === "district" && filter.district) q = q.eq("district", filter.district);
      if (filter.scope === "critical") q = q.eq("sentiment", "negative");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function IncidentFilterBar({ value, onChange, className }: Props) {
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const { data: rows, refetch } = useExportRows(value, false);

  const label = value.scope === "district" && value.district
    ? value.district
    : value.scope === "critical" ? "Kritik Uyarılar" : "Genel";

  async function handleExport(kind: "xlsx" | "pdf") {
    setExporting(kind);
    try {
      const { data } = await refetch();
      const list = data ?? rows ?? [];
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const base = `mugla-istihbarat-${stamp}`;
      if (kind === "xlsx") {
        await exportToExcel(
          list.map(r => ({
            İlçe: r.district, Kategori: CATEGORY_TR[r.category ?? "general"] ?? r.category,
            Duygu: r.sentiment, Skor: r.sentiment_score, İçerik: r.content,
            Kaynak: r.platform, Tarih: r.published_at, Link: r.url,
          })),
          base, label,
        );
      } else {
        await exportToPdf(
          `Muğla Monitör — ${label}`,
          ["İlçe", "Kategori", "Duygu", "İçerik", "Tarih"],
          list.slice(0, 400).map(r => [
            r.district ?? "-",
            CATEGORY_TR[r.category ?? "general"] ?? r.category ?? "-",
            r.sentiment ?? "-",
            (r.content ?? "").slice(0, 90),
            new Date(r.published_at).toLocaleString("tr-TR"),
          ]),
          base,
          `${list.length} kayıt · Son 24 saat · ${new Date().toLocaleString("tr-TR")}`,
        );
      }
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1 bg-secondary/40 border border-border/40 rounded-lg p-1">
        <Filter className="w-3.5 h-3.5 text-muted-foreground ml-1.5" />
        {([
          { key: "all" as const, label: "Genel" },
          { key: "district" as const, label: "İlçe Bazlı" },
          { key: "critical" as const, label: "Kritik Uyarılar" },
        ]).map(({ key, label: l }) => (
          <button
            key={key}
            onClick={() => onChange({ scope: key, district: key === "district" ? (value.district ?? "Menteşe") : null })}
            className={cn(
              "px-3 py-1.5 rounded-md text-[11px] font-mono transition-colors",
              value.scope === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {value.scope === "district" && (
        <div className="flex items-center gap-1 flex-wrap">
          {DISTRICT_LIST.map(d => (
            <button
              key={d}
              onClick={() => onChange({ ...value, district: d })}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-mono border transition-colors",
                value.district === d
                  ? "bg-primary/20 text-primary border-primary/50"
                  : "text-muted-foreground border-border/40 hover:border-border hover:text-foreground",
              )}
            >
              {d}
            </button>
          ))}
          {value.district && (
            <button
              onClick={() => onChange({ scope: "all", district: null })}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              aria-label="İlçe filtresini temizle"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Download className="w-3 h-3" /> Dışa Aktar:
        </span>
        <button
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          <FileText className="w-3 h-3" /> {exporting === "pdf" ? "…" : "PDF"}
        </button>
        <button
          onClick={() => handleExport("xlsx")}
          disabled={exporting !== null}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-mono bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3 h-3" /> {exporting === "xlsx" ? "…" : "Excel"}
        </button>
      </div>
    </div>
  );
}
