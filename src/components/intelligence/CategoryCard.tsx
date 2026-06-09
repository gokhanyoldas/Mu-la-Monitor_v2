import { useState, useEffect } from "react";
import { IntelligenceItem } from "@/services/osint-data-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleAlert as AlertCircle, TrendingUp, TrendingDown, Cloud, DollarSign, Heart, Shield, ChevronDown, ChevronUp } from "lucide-react";

interface CategoryCardProps {
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  items: IntelligenceItem[];
  category: "security" | "weather" | "economy" | "health";
}

export const CategoryCard = ({
  title,
  icon,
  bgColor,
  borderColor,
  items,
  category,
}: CategoryCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState({
    critical: 0,
    high: 0,
    total: 0,
    trend: "neutral" as "up" | "down" | "neutral",
  });

  useEffect(() => {
    const critical = items.filter((i) => i.importance === "critical").length;
    const high = items.filter((i) => i.importance === "high").length;
    const total = items.length;

    const trend = critical > 0 ? ("up" as const) : high > 0 ? ("down" as const) : ("neutral" as const);

    setStats({ critical, high, total, trend });
  }, [items]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "security":
        return <Shield className="w-5 h-5 text-orange-400" />;
      case "weather":
        return <Cloud className="w-5 h-5 text-blue-400" />;
      case "economy":
        return <DollarSign className="w-5 h-5 text-green-400" />;
      case "health":
        return <Heart className="w-5 h-5 text-red-400" />;
      default:
        return icon;
    }
  };

  const getTrendColor = () => {
    switch (stats.trend) {
      case "up":
        return "text-red-400";
      case "down":
        return "text-orange-400";
      default:
        return "text-blue-400";
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "critical":
        return "bg-red-600 text-white";
      case "high":
        return "bg-orange-600 text-white";
      case "medium":
        return "bg-yellow-600 text-white";
      default:
        return "bg-slate-600 text-white";
    }
  };

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} backdrop-blur-sm transition-all duration-300 overflow-hidden hover:shadow-lg`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="p-2 rounded-lg bg-white/10">{getCategoryIcon(category)}</div>

          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {stats.total} bildirim • {stats.critical} kritik
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {stats.trend === "up" ? (
              <TrendingUp className="w-4 h-4" />
            ) : stats.trend === "down" ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-xs font-semibold">{stats.critical > 0 ? "Dikkat!" : "Durağan"}</span>
          </div>

          <button className="p-1 hover:bg-white/10 rounded transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-2 max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Bildirim yok</p>
          ) : (
            items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-200 line-clamp-2">
                    {item.title}
                  </p>
                  <Badge className={`text-[10px] flex-shrink-0 ${getImportanceColor(item.importance)}`}>
                    {item.importance === "critical" && "KRİTİK"}
                    {item.importance === "high" && "YÜKSEK"}
                    {item.importance === "medium" && "ORTA"}
                    {item.importance === "low" && "DÜŞÜK"}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">
                  {item.location} • {new Date(item.date).toLocaleTimeString("tr-TR")}
                </p>
              </div>
            ))
          )}

          {items.length > 5 && (
            <Button variant="outline" className="w-full text-xs h-8 mt-2">
              Tümünü Gör ({items.length})
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
