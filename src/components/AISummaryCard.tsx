import { RefreshCw, Brain, AlertTriangle, CloudSun, MessageSquare, TrendingUp, Activity } from "lucide-react";
import { useAISummary, type SummaryType } from "@/hooks/useAISummary";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { PanelHelpTooltip } from "@/components/dashboard/PanelHelpTooltip";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/time-utils";

const TYPE_CONFIG: Record<SummaryType, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  gradient: string;
}> = {
  pulse: { icon: Activity, label: "Şehir Nabzı", color: "text-rose-400", gradient: "from-rose-500/10 to-transparent" },
  daily: { icon: Brain, label: "Günlük AI Özeti", color: "text-violet-400", gradient: "from-violet-500/10 to-transparent" },
  social: { icon: MessageSquare, label: "Kamuoyu Özeti", color: "text-blue-400", gradient: "from-blue-500/10 to-transparent" },
  earthquake: { icon: AlertTriangle, label: "Deprem Risk Özeti", color: "text-orange-400", gradient: "from-orange-500/10 to-transparent" },
  weather: { icon: CloudSun, label: "Hava Durumu Özeti", color: "text-cyan-400", gradient: "from-cyan-500/10 to-transparent" },
};

interface AISummaryCardProps { type?: SummaryType; className?: string; }

export function AISummaryCard({ type = "daily", className }: AISummaryCardProps) {
  const { canGenerateAI } = useAuth();
  const normalizedType = String(type ?? "daily").trim().toLowerCase() as SummaryType;
  const config = TYPE_CONFIG[normalizedType] ?? TYPE_CONFIG.daily;
  const safeType: SummaryType = TYPE_CONFIG[normalizedType] ? normalizedType : "daily";
  const { data, isLoading, error, refresh } = useAISummary(safeType);
  const { lang, t, translate } = useTranslation();
  const Icon = config?.icon ?? Brain;

  const dateLocale = lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";

  return (
    <div className={cn("relative rounded-xl border border-border/50 p-4 overflow-visible bg-gradient-to-br from-background to-card", className)}>
      <div className={cn("absolute inset-0 rounded-xl bg-gradient-to-br opacity-30 pointer-events-none", config.gradient)} />
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg bg-current/10", config.color)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{t(config.label)}</span>
          <PanelHelpTooltip panelTitle={config.label} />
        </div>
        <div className="flex items-center gap-2">
          {data?.isStale && <span className="text-[9px] font-mono text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">{t("eski")}</span>}
          {canGenerateAI && (
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              aria-label={t("Yenile")}
              title={t("Yenile")}
              className="p-1 rounded hover:bg-muted/50 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="relative min-h-[60px] space-y-2">
        {isLoading && !data && (
          <div className="space-y-2">
            <div className="h-3 bg-muted/50 rounded animate-pulse w-full" />
            <div className="h-3 bg-muted/50 rounded animate-pulse w-4/5" />
            <div className="h-3 bg-muted/50 rounded animate-pulse w-3/5" />
          </div>
        )}
        {error && !data && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t("AI özeti şu an yüklenemedi.")}</span>
          </div>
        )}
        {data && <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{translate(data.summary)}</p>}
      </div>
      {data && (
        <div className="tech-meta-only relative mt-3 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          <TrendingUp className="h-3 w-3" aria-hidden="true" />
          <span>{t(data.sourceLabel || "Canlı Şehir Nabzı")}</span>
          <span className="mx-1 opacity-40">·</span>
          <span
            data-testid="ai-summary-relative-time"
            title={new Date(data.generated_at).toLocaleString(dateLocale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          >
            {formatRelativeTime(data.generated_at, lang)}
          </span>
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
