import { useEffect, useState } from "react";
import { intelligenceHub, type DataCategory } from "@/lib/intelligence-hub";
import { Zap } from "lucide-react";

interface SmartCardProps {
  category: DataCategory;
  children: React.ReactNode;
  onDataUpdate?: (data: any, isLive: boolean) => void;
}

export const SmartCard = ({ category, children, onDataUpdate }: SmartCardProps) => {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const unsubscribe = intelligenceHub.subscribe(category, (data, live) => {
      setIsLive(live);
      onDataUpdate?.(data, live);
    });

    return unsubscribe;
  }, [category, onDataUpdate]);

  return (
    <div className="relative group">
      {children}
      {isLive && (
        <div className="absolute top-2 right-2 bg-green-500/20 border border-green-500/40 rounded-full p-1.5 backdrop-blur-sm group-hover:bg-green-500/30 transition-colors">
          <Zap className="w-3 h-3 text-green-400 animate-pulse" />
        </div>
      )}
    </div>
  );
};
