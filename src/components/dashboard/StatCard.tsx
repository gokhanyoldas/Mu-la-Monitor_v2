interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "warning" | "destructive" | "accent";
}

const variantStyles = {
  default: "text-foreground",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  accent: "text-accent",
};

export const StatCard = ({ label, value, unit, change, icon, variant = "default" }: StatCardProps) => {
  return (
    <div className="bg-muted/30 rounded-md p-2.5 border border-border/50 animate-slide-in">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
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
    </div>
  );
};
