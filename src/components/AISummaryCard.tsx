// AISummaryCard.tsx
// Gemini-powered AI summary card with refresh and stale indicator.

import { RefreshCw, Brain, AlertTriangle, CloudSun, MessageSquare, TrendingUp } from "lucide-react";
import { useAISummary, type SummaryType } from "@/hooks/useAISummary";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<SummaryType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  gradient: string;
}> = {
  daily: { icon: Brain, label: "Günlük AI Özeti", color: "text-violet-400", gradient: "from-violet-500/10 to-transparent" },
  social: { icon: MessageSquare, label: "Kamuoyu Özeti", color: "text-blue-400", gradient: "from-blue-500/10 to-transparent" },
  earthquake: { icon: AlertTriangle, label: "Deprem Risk Özeti", color: "text-orange-400", gradient: "from-orange-500/10 to-transparent" },
  weather: { icon: CloudSun, label: "Hava Durumu Özeti", color: "text-cyan-400", gradient: "from-cyan-500/10 to-transparent" },
};

interface AISummaryCardProps { type?: SummaryType; className?: string; }

export function AISummaryCard({ type = "daily", className }: AISummaryCardProps) {
  const { data, isLoading, error, refresh } = useAISummary(type);
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={cn("relative rounded-xl border border-border/50 p-4 overflow-hidden bg-gradient-to-br from-background to-card", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30 pointer-events-none", config.gradient)} />
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg bg-current/10", config.color)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {data?.isStale && <span className="text-[9px] font-mono text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">eski</span>}
          <button onClick={refresh} disabled={isLoading} className="p-1 rounded hover:bg-muted/50 transition-colors disabled:opacity-40" title="Yenile">
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>
      <div className="relative min-h-[60px]">
        {isLoading && !data && (
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded animate-pulse w-full" />
            <div className="h-3 bg-muted/50 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-muted/50 rounded animate-pulse w-3/5" />
          </div>
        )}
        {error && !data && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>GEMINI_API_KEY tanımlı mı?</span>
          </div>
        )}
        {data && <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{data.summary}</p>}
      </div>
      {data && (
        <div className="relative mt-3 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          <span>Gemini 1.5 Flash</span>
          <span className="mx-1 opacity-40">·</span>
          <span>{new Date(data.generated_at).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}
    </div>
  );
}

export function AISummaryRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <AISummaryCard type="daily" />
      <AISummaryCard type="social" />
      <AISummaryCard type="earthquake" />
      <AISummaryCard type="weather" />
    </div>
  );
}
