import { useEffect, useState } from "react";
import { dataQualityTracker } from "@/lib/data-quality";
import { Clock, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/useTranslation";

interface DataFreshnessIndicatorProps {
  category: string;
  size?: "sm" | "md" | "lg";
}

export const DataFreshnessIndicator = ({ category, size = "sm" }: DataFreshnessIndicatorProps) => {
  const { lang, t } = useTranslation();
  const [status, setStatus] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const updateStatus = () => {
      const s = dataQualityTracker.getQualityStatus(category);
      setStatus(s);
      if (s.lastUpdate > 0) {
        setLastUpdate(new Date(s.lastUpdate));
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, [category]);

  if (!status || status.age < 0) {
    return null;
  }

  const sizeClasses = {
    sm: "w-4 h-4 text-xs",
    md: "w-5 h-5 text-sm",
    lg: "w-6 h-6 text-base",
  };

  const getIcon = () => {
    if (!status.isFresh) {
      return <AlertCircle className={`${sizeClasses[size]} text-red-500`} />;
    }

    switch (status.validationStatus) {
      case "valid":
        return <CheckCircle2 className={`${sizeClasses[size]} text-green-500`} />;
      case "partial":
        return <AlertCircle className={`${sizeClasses[size]} text-yellow-500`} />;
      case "invalid":
        return <AlertCircle className={`${sizeClasses[size]} text-red-500`} />;
      default:
        return <Clock className={`${sizeClasses[size]} text-gray-500`} />;
    }
  };

  const getDescription = () => {
    if (!status.isFresh) {
      return `${t("stale_data", "Eski veri")}: ${status.age} ${t("min", "dk")} ${t("ago", "önce")}`;
    }

    if (status.age === 0) {
      return t("just_updated", "Yeni güncelleme (saniyeler)");
    }

    return `${status.age} ${t("min", "dk")} ${t("ago", "önce")}`;
  };

  const timeFormatted = lastUpdate
    ? lastUpdate.toLocaleTimeString(lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : t("unknown", "Bilinmiyor");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            {getIcon()}
            <span className={`text-[10px] font-mono font-semibold text-muted-foreground opacity-75`}>
              {getDescription()}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
          <p className="font-semibold">{t(status.source)}</p>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            {timeFormatted}
          </div>
          <div className="flex items-center gap-1">
            {status.hasRealSource ? (
              <>
                <Zap className="w-3 h-3 text-green-500" />
                <span className="text-green-600">{t("free_real_source", "Ücretsiz gerçek kaynak")}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-yellow-500" />
                <span className="text-yellow-600">{t("paid_or_estimate", "Ücretli veya tahmini")}</span>
              </>
            )}
          </div>
          {status.lastError && <p className="text-red-500">{t("Hata", "Hata")}: {status.lastError}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
