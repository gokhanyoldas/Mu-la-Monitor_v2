import { ReactNode } from "react";

interface DashboardPanelProps {
  title: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: "live" | "active" | "warning" | "info";
  children: ReactNode;
  className?: string;
  count?: number;
}

const badgeStyles = {
  live: "bg-destructive/20 text-destructive border-destructive/30",
  active: "bg-success/20 text-success border-success/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  info: "bg-accent/20 text-accent border-accent/30",
};

export const DashboardPanel = ({
  title,
  icon,
  badge,
  badgeVariant = "active",
  children,
  className = "",
  count,
}: DashboardPanelProps) => {
  return (
    <div className={`panel-border rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary text-sm">{icon}</span>}
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground/80">
            {title}
          </h3>
          {count !== undefined && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
        </div>
        {badge && (
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${badgeStyles[badgeVariant]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
};
