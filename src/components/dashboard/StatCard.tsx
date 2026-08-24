import { Info } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "warning" | "destructive" | "accent";
  /** Hover'da gösterilen kaynak/periyot bilgisi */
  info?: string;
}

const variantStyles = {
  default: "text-foreground",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  accent: "text-accent",
};

export const StatCard = ({ label, value, unit, change, icon, variant = "default", info }: StatCardProps) => {
  return (
    <div className="group relative bg-muted/30 rounded-md p-2.5 border border-border/50 animate-slide-in">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          {label}
          {info && (
            <Info size={9} className="text-muted-foreground/60 group-hover:text-primary transition-colors" />
          )}
        </span>
        {icon && <span className="text-muted-foreground text-xs">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-mono font-bold ${variantStyles[variant]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-mono text-muted-foreground">{unit}</span>
        )}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-[10px] font-mono ${change >= 0 ? "text-success" : "text-destructive"}`}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%
          </span>
        </div>
      )}

      {/* Hover tooltip — kaynak + periyot bilgisi */}
      {info && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 p-2 rounded-md bg-popover border border-border shadow-xl text-[9px] font-mono text-popover-foreground leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
          {info}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-popover border-r border-b border-border -mt-1" />
        </div>
      )}
    </div>
  );
};
