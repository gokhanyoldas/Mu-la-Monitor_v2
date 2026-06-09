import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  isLive: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LiveIndicator = ({ isLive, size = "md", className }: LiveIndicatorProps) => {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  if (!isLive) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("rounded-full bg-green-500 animate-pulse", sizeClasses[size])} />
      <span className="text-[10px] font-mono text-green-600 font-semibold uppercase tracking-wider">
        Canlı
      </span>
    </div>
  );
};
