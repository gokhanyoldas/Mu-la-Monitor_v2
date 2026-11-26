import { Zap, Brain, Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { formatRelativeTime } from "@/lib/time-utils";

export type DataSourceType = "live" | "estimate" | "cached" | "static";

interface BadgeConfig {
  label: string;
  className: string;
  tooltip: string;
}

const CONFIG: Record<DataSourceType, BadgeConfig> = {
  live: {
    label: "CANLI",
    className: "bg-green-500/20 text-green-400 border-green-500/40",
    tooltip: "Gerçek zamanlı API verisi",
  },
  estimate: {
    label: "TAHMİN",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    tooltip: "Algoritmik tahmin / model bazlı",
  },
  cached: {
    label: "ÖNBELLEK",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    tooltip: "Son API güncellemesinden cache",
  },
  static: {
    label: "STATİK",
    className: "bg-gray-500/20 text-gray-400 border-gray-500/40",
    tooltip: "Statik referans verisi (TÜİK / DSİ vb.)",
  },
};

interface DataSourceBadgeProps {
  type: DataSourceType;
  lastUpdated?: string;
  className?: string;
  showIcon?: boolean;
}

export const DataSourceBadge = ({
  type,
  lastUpdated,
  className = "",
  showIcon = true,
}: DataSourceBadgeProps) => {
  const { lang, t } = useTranslation();
  const cfg = CONFIG[type];

  const ageLabel = lastUpdated ? formatRelativeTime(lastUpdated, lang, { fallback: "" }) || null : null;

  const IconEl = type === "live"
    ? <Zap size={8} />
    : type === "estimate"
    ? <Brain size={8} />
    : <Clock size={8} />;

  return (
    <span
      title={t(cfg.tooltip)}
      className={`tech-meta-only inline-flex items-center gap-0.5 text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded border ${cfg.className} ${className}`}
    >
      {showIcon && IconEl}
      {t(cfg.label)}
      {ageLabel && (
        <span className="ml-0.5 opacity-70">· {ageLabel}</span>
      )}
    </span>
  );
};
