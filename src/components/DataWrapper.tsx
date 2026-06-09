import { ReactNode, useState } from "react";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface DataWrapperProps {
  category: string;
  children: ReactNode;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const DataWrapper = ({ category, children, onRefresh, isLoading }: DataWrapperProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <div className="relative">
      {children}

      <div className="absolute top-2 right-2 flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/50 rounded-md px-2 py-1">
        <DataFreshnessIndicator category={category} size="sm" />

        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="h-5 w-5 p-0 hover:bg-secondary"
            title="Verileri yenile"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing || isLoading ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>
    </div>
  );
};
