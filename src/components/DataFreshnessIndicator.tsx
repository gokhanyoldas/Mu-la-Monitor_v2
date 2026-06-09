import { useEffect, useState } from "react";
import { dataQualityTracker } from "@/lib/data-quality";
import { Clock, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DataFreshnessIndicatorProps {
  category: string;
  size?: "sm" | "md" | "lg";
}

export const DataFreshnessIndicator = ({ category, size = "sm" }: DataFreshnessIndicatorProps) => {
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
      return `Eski veri: ${status.age} dakika önceki`;
    }

    if (status.age === 0) {
      return "Yeni güncelleme (saniyeler)";
    }

    return `${status.age} dakika önceki`;
  };

  const timeFormatted = lastUpdate
    ? lastUpdate.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Bilinmiyor";

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
          <p className="font-semibold">{status.source}</p>
          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            {timeFormatted}
          </div>
          <div className="flex items-center gap-1">
            {status.hasRealSource ? (
              <>
                <Zap className="w-3 h-3 text-green-500" />
                <span className="text-green-600">Ücretsiz gerçek kaynak</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 text-yellow-500" />
                <span className="text-yellow-600">Ücretli veya tahmini</span>
              </>
            )}
          </div>
          {status.lastError && <p className="text-red-500">Hata: {status.lastError}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
