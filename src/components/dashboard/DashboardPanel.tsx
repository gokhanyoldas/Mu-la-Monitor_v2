import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";

interface DashboardPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: "live" | "active" | "warning" | "info" | "alert";
  children: ReactNode;
  className?: string;
  count?: number;
  /** true ise başlık tıklanabilir olur ve içerik aç/kapa yapar */
  collapsible?: boolean;
  /** collapsible iken başlangıç durumu (varsayılan: true) */
  defaultOpen?: boolean;
}

const badgeStyles = {
  live: "bg-destructive/20 text-destructive border-destructive/30",
  active: "bg-success/20 text-success border-success/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  info: "bg-accent/20 text-accent border-accent/30",
  alert: "bg-destructive/20 text-destructive border-destructive/30",
};

export const DashboardPanel = ({
  title,
  subtitle,
  icon,
  badge,
  badgeVariant = "active",
  children,
  className = "",
  count,
  collapsible = false,
  defaultOpen = true,
}: DashboardPanelProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const open = collapsible ? isOpen : true;

  return (
    <div className={`panel-border rounded-lg overflow-hidden ${className}`}>
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30 ${
          collapsible ? "cursor-pointer select-none hover:bg-secondary/50 transition-colors" : ""
        }`}
        onClick={collapsible ? () => setIsOpen(v => !v) : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-primary text-sm">{icon}</span>}
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground/80">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[9px] font-mono text-muted-foreground normal-case tracking-normal">
                {subtitle}
              </p>
            )}
          </div>
          {count !== undefined && (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${badgeStyles[badgeVariant]}`}>
              {badge}
            </span>
          )}
          {collapsible && (
            <ChevronDown
              size={14}
              className={`text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </div>
      <div
        className="grid transition-all duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="p-3">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
