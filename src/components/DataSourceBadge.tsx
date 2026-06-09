// M1: Canlı/Tahmin Rozeti — tüm veri kartlarında tek tip gösterim
import { Zap, Brain, Clock } from "lucide-react";

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
  const cfg = CONFIG[type];

  const ageLabel = lastUpdated
    ? (() => {
        const diff = Math.round((Date.now() - new Date(lastUpdated).getTime()) / 60000);
        if (diff < 1) return "Az önce";
        if (diff < 60) return `${diff}dk önce`;
        return `${Math.round(diff / 60)}s önce`;
      })()
    : null;

  const IconEl = type === "live"
    ? <Zap size={8} />
    : type === "estimate"
    ? <Brain size={8} />
    : <Clock size={8} />;

  return (
    <span
      title={cfg.tooltip}
      className={`inline-flex items-center gap-0.5 text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded border ${cfg.className} ${className}`}
    >
      {showIcon && IconEl}
      {cfg.label}
      {ageLabel && (
        <span className="ml-0.5 opacity-70">· {ageLabel}</span>
      )}
    </span>
  );
};
