// ExecutiveReportPanel — Gemini destekli günlük/haftalık yönetici özeti.
// ai_summaries tablosundaki 'executive' / 'executive_weekly' kayıtlarını okur;
// gerekiyorsa executive-report edge function'ını tetikler.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BrainCircuit, CalendarDays, RefreshCw } from "lucide-react";

type Period = "daily" | "weekly";

interface SummaryRow {
  summary: string;
  generated_at: string;
  date: string;
}

export function ExecutiveReportPanel({ className }: { className?: string }) {
  const [period, setPeriod] = useState<Period>("daily");
  const [generating, setGenerating] = useState(false);
  const qc = useQueryClient();
  const type = period === "weekly" ? "executive_weekly" : "executive";

  const { data, isLoading } = useQuery<SummaryRow | null>({
    queryKey: ["executive-report", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_summaries")
        .select("summary, generated_at, date")
        .eq("type", type)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60e3,
  });

  async function generate() {
    setGenerating(true);
    try {
      await supabase.functions.invoke("executive-report", { body: { period } });
      await qc.invalidateQueries({ queryKey: ["executive-report", type] });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={cn("rounded-xl border border-border/40 bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-semibold">AI Yönetici Özeti</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-secondary/40 rounded-md p-0.5">
            {(["daily", "weekly"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-mono transition-colors",
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p === "daily" ? "Günlük" : "Haftalık"}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", generating && "animate-spin")} />
            {generating ? "Üretiliyor…" : "Şimdi Üret"}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground font-mono animate-pulse">Rapor yükleniyor…</p>
        ) : data ? (
          <>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-3">
              <CalendarDays className="w-3 h-3" />
              {data.date} · {new Date(data.generated_at).toLocaleTimeString("tr-TR")}
            </div>
            <div className="prose-sm text-[12px] leading-relaxed text-foreground/85 whitespace-pre-wrap font-sans">
              {data.summary}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <BrainCircuit className="w-8 h-8 mx-auto mb-2 text-primary/40" />
            <p className="text-xs text-muted-foreground mb-3">
              Henüz {period === "daily" ? "günlük" : "haftalık"} yönetici özeti üretilmedi.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              className="px-3 py-1.5 rounded-md text-[11px] font-mono bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {generating ? "Üretiliyor…" : "İlk Raporu Üret"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
