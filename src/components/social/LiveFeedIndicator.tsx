import { Radio } from "lucide-react";
import { feedStatus, formatRelativeTime } from "@/lib/time-utils";
import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface LiveFeedIndicatorProps {
  lastUpdate: Date | string | number | null;
  itemCount: number;
  isCollecting?: boolean;
}

export const LiveFeedIndicator = ({ lastUpdate, itemCount, isCollecting }: LiveFeedIndicatorProps) => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const [, setTick] = useState(0);
  const status = feedStatus(lastUpdate, lang);

  // Refresh every 30s to update relative time
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/10 border border-border/30">
      <div className="flex items-center gap-1.5">
        {isCollecting ? (
          <Radio size={10} className="text-primary animate-pulse" />
        ) : status.isLive ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        ) : (
          <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}
        <span className={`text-[10px] font-mono font-bold ${status.color}`}>
          {isCollecting ? (isEn ? "COLLECTING..." : "TOPLANIYOR...") : status.label}
        </span>
      </div>

      <div className="h-3 w-px bg-border/50" />

      <span className="text-[9px] font-mono text-muted-foreground">
        {itemCount} {isEn ? "posts" : "gönderi"}
      </span>

      {lastUpdate && (
        <>
          <div className="h-3 w-px bg-border/50" />
          <span className="text-[9px] font-mono text-muted-foreground/60">
            {isEn ? "Updated:" : "Son:"} {formatRelativeTime(lastUpdate, lang)}
          </span>
        </>
      )}
    </div>
  );
};
