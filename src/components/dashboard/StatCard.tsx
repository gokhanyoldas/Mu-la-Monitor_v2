import { Info } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon?: React.ReactNode;
  variant?: "default" | "primary" | "warning" | "destructive" | "accent";
  /** "i" ikonuna tıklandığında gösterilen kaynak/periyot bilgisi */
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
  const { lang, t } = useTranslation();
  const displayVal = typeof value === "string" ? t(value) : value;
  const infoLabel = lang === "en" ? "Source & detail" : "Kaynak & bilgi";

  return (
    <div className="relative bg-muted/30 rounded-md p-2.5 border border-border/50 animate-slide-in">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 min-w-0">
          <span className="truncate">{t(label)}</span>
          {info && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${t(label)} — ${infoLabel}`}
                  className="inline-flex items-center justify-center w-5 h-5 !min-h-[20px] -my-1 shrink-0 rounded-full text-muted-foreground/75 hover:text-primary data-[state=open]:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
                >
                  <Info size={11} aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="center"
                sideOffset={6}
                collisionPadding={12}
                role="tooltip"
                onClick={(e) => e.stopPropagation()}
                className="z-[90] w-60 max-w-[calc(100vw-24px)] rounded-md border border-border bg-popover px-3 py-2 shadow-xl text-left normal-case tracking-normal"
              >
                <div className="text-[10px] font-mono font-semibold text-primary mb-0.5">
                  {t(label)}
                </div>
                <p className="text-[11px] font-mono text-popover-foreground leading-relaxed">
                  {t(info)}
                </p>
              </PopoverContent>
            </Popover>
          )}
        </span>
        {icon && <span className="text-muted-foreground text-xs shrink-0">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-mono font-bold ${variantStyles[variant]}`}>
          {displayVal}
        </span>
        {unit && (
          <span className="text-[10px] font-mono text-muted-foreground">{t(unit)}</span>
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
