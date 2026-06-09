import { useEffect, useState } from "react";
import { osintDataManager, IntelligenceItem } from "@/services/osint-data-manager";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleAlert as AlertCircle, TrendingUp, MessageSquare, Clock, ExternalLink, Filter, X, Zap } from "lucide-react";

interface FilterState {
  importance: string[];
  sentiment: string[];
  source?: string;
}

export const IntelligenceFeed = () => {
  const [items, setItems] = useState<IntelligenceItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<IntelligenceItem[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    importance: ["critical", "high"],
    sentiment: [],
    source: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({ critical: 0, total: 0 });

  useEffect(() => {
    loadIntelligence();
    const interval = setInterval(loadIntelligence, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, filters]);

  const loadIntelligence = () => {
    const feed = osintDataManager.getIntelligenceFeed();
    setItems(feed);

    const critical = feed.filter(
      (i) =>
        i.importance === "critical" || i.sentiment === "critical"
    ).length;
    setStats({ critical, total: feed.length });
  };

  const applyFilters = () => {
    let filtered = items;

    if (filters.importance.length > 0) {
      filtered = filtered.filter((item) =>
        filters.importance.includes(item.importance)
      );
    }

    if (filters.sentiment.length > 0) {
      filtered = filtered.filter((item) =>
        filters.sentiment.includes(item.sentiment)
      );
    }

    if (filters.source) {
      filtered = filtered.filter((item) => item.source === filters.source);
    }

    setFilteredItems(filtered);
  };

  const toggleFilter = (type: "importance" | "sentiment", value: string) => {
    setFilters((prev) => {
      const arr = prev[type] as string[];
      const newArr = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [type]: newArr };
    });
  };

  const clearFilters = () => {
    setFilters({
      importance: ["critical", "high"],
      sentiment: [],
      source: undefined,
    });
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case "critical":
        return "bg-red-950 border-red-700";
      case "negative":
        return "bg-orange-950 border-orange-700";
      case "positive":
        return "bg-green-950 border-green-700";
      default:
        return "bg-slate-900 border-slate-700";
    }
  };

  const getSentimentTextColor = (sentiment: string): string => {
    switch (sentiment) {
      case "critical":
        return "text-red-400";
      case "negative":
        return "text-orange-400";
      case "positive":
        return "text-green-400";
      default:
        return "text-slate-400";
    }
  };

  const getImportanceColor = (importance: string): string => {
    switch (importance) {
      case "critical":
        return "bg-red-600";
      case "high":
        return "bg-orange-600";
      case "medium":
        return "bg-yellow-600";
      default:
        return "bg-slate-600";
    }
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Şimdi";
    if (minutes < 60) return `${minutes} dk`;
    if (hours < 24) return `${hours} s`;
    return `${days} g`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              İstihbarat Akışı
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {stats.critical > 0 && (
                <span className="text-red-400 font-semibold">
                  {stats.critical} kritik
                </span>
              )}
              {stats.critical > 0 && " • "}
              Toplam {stats.total} bildirim
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="hover:bg-slate-800"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-3 bg-slate-800/50 p-3 rounded-lg">
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                Önem Seviyesi
              </p>
              <div className="flex flex-wrap gap-2">
                {["critical", "high", "medium", "low"].map((level) => (
                  <button
                    key={level}
                    onClick={() =>
                      toggleFilter("importance", level)
                    }
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filters.importance.includes(level)
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {level === "critical" && "Kritik"}
                    {level === "high" && "Yüksek"}
                    {level === "medium" && "Orta"}
                    {level === "low" && "Düşük"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                Duygu Durumu
              </p>
              <div className="flex flex-wrap gap-2">
                {["critical", "negative", "neutral", "positive"].map(
                  (sent) => (
                    <button
                      key={sent}
                      onClick={() =>
                        toggleFilter("sentiment", sent)
                      }
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filters.sentiment.includes(sent)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {sent === "critical" && "Kritik"}
                      {sent === "negative" && "Olumsuz"}
                      {sent === "neutral" && "Nötr"}
                      {sent === "positive" && "Olumlu"}
                    </button>
                  )
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="w-full text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Filtreleri Temizle
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <MessageSquare className="w-8 h-8 opacity-50 mb-2" />
              <p className="text-sm">Seçili filtrelere uygun veri yok</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition-all hover:border-slate-600 ${getSentimentColor(
                  item.sentiment
                )} group`}
              >
                <div className="flex items-start gap-2">
                  {item.importance === "critical" && (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-1 animate-pulse" />
                  )}
                  {item.sentiment === "critical" && (
                    <Zap className="w-4 h-4 text-red-400 flex-shrink-0 mt-1" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-slate-100">
                        {item.title}
                      </h4>
                      <Badge
                        className={`text-[10px] ${getImportanceColor(
                          item.importance
                        )}`}
                      >
                        {item.importance === "critical" && "KRİTİK"}
                        {item.importance === "high" && "YÜKSEK"}
                        {item.importance === "medium" && "ORTA"}
                        {item.importance === "low" && "DÜŞÜK"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] border-current ${getSentimentTextColor(
                          item.sentiment
                        )}`}
                      >
                        {item.sentiment === "critical" && "KRİTİK"}
                        {item.sentiment === "negative" && "OLUMSUZ"}
                        {item.sentiment === "neutral" && "NÖTR"}
                        {item.sentiment === "positive" && "OLUMLU"}
                      </Badge>
                    </div>

                    {item.content && (
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                        {item.content}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(item.date)}
                      </div>
                      <span className="text-slate-500">•</span>
                      <span>{item.source}</span>
                      {item.location && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span>{item.location}</span>
                        </>
                      )}
                      {item.confidence && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span>%{Math.round(item.confidence * 100)}</span>
                        </>
                      )}
                    </div>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-slate-800/50 text-slate-300 px-2 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{item.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-slate-700/50 rounded transition-colors flex-shrink-0 mt-1"
                      title="Orijinal kaynağı aç"
                    >
                      <ExternalLink className="w-3 h-3 text-slate-400 hover:text-slate-200" />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
