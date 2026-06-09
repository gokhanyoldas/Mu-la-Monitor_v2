import { useState } from "react";
import { Filter, X, Calendar, MapPin, Hash, TrendingUp } from "lucide-react";
import { MUGLA_DISTRICTS } from "@/lib/time-utils";

export interface SocialFilters {
  platform: string;
  sentiment: string;
  region: string;
  dateRange: "all" | "1h" | "6h" | "24h" | "7d" | "30d";
  keyword: string;
}

interface FilterPanelProps {
  filters: SocialFilters;
  onChange: (filters: SocialFilters) => void;
  activeCount?: number;
}

const platforms = [
  { value: "all", label: "Tümü" },
  { value: "news", label: "Haberler" },
  { value: "reddit", label: "Reddit" },
  { value: "eksisozluk", label: "Ekşi Sözlük" },
  { value: "twitter", label: "X (Twitter)" },
];

const sentiments = [
  { value: "all", label: "Tümü", color: "text-muted-foreground" },
  { value: "positive", label: "Pozitif", color: "text-green-500" },
  { value: "neutral", label: "Nötr", color: "text-yellow-500" },
  { value: "negative", label: "Negatif", color: "text-red-500" },
];

const dateRanges = [
  { value: "all", label: "Tümü" },
  { value: "1h", label: "Son 1 saat" },
  { value: "6h", label: "Son 6 saat" },
  { value: "24h", label: "Son 24 saat" },
  { value: "7d", label: "Son 7 gün" },
  { value: "30d", label: "Son 30 gün" },
];

export const FilterPanel = ({ filters, onChange, activeCount }: FilterPanelProps) => {
  const [expanded, setExpanded] = useState(false);

  const activeFilters = [
    filters.platform !== "all" && "platform",
    filters.sentiment !== "all" && "sentiment",
    filters.region !== "" && "region",
    filters.dateRange !== "all" && "date",
    filters.keyword !== "" && "keyword",
  ].filter(Boolean).length;

  const resetFilters = () => {
    onChange({ platform: "all", sentiment: "all", region: "", dateRange: "all", keyword: "" });
  };

  return (
    <div className="border border-border/50 rounded-lg bg-secondary/20 overflow-hidden">
      {/* Collapse header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-primary" />
          <span className="text-[10px] font-mono font-bold text-foreground">FİLTRELER</span>
          {activeFilters > 0 && (
            <span className="bg-primary/20 text-primary text-[9px] font-mono px-1.5 py-0.5 rounded-full">
              {activeFilters} aktif
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount !== undefined && (
            <span className="text-[9px] font-mono text-muted-foreground">{activeCount} sonuç</span>
          )}
          {activeFilters > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); resetFilters(); }}
              className="text-[9px] font-mono text-destructive/70 hover:text-destructive"
            >
              Temizle
            </button>
          )}
        </div>
      </button>

      {/* Filter body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-3">
          {/* Platform */}
          <div>
            <label className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 mb-1.5">
              <Hash size={9} /> PLATFORM
            </label>
            <div className="flex flex-wrap gap-1">
              {platforms.map(p => (
                <button
                  key={p.value}
                  onClick={() => onChange({ ...filters, platform: p.value })}
                  className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                    filters.platform === p.value
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border/30 hover:border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div>
            <label className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 mb-1.5">
              <TrendingUp size={9} /> DUYGU
            </label>
            <div className="flex flex-wrap gap-1">
              {sentiments.map(s => (
                <button
                  key={s.value}
                  onClick={() => onChange({ ...filters, sentiment: s.value })}
                  className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                    filters.sentiment === s.value
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border/30 hover:border-border"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 mb-1.5">
              <MapPin size={9} /> BÖLGE
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onChange({ ...filters, region: "" })}
                className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                  filters.region === ""
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "text-muted-foreground border-border/30 hover:border-border"
                }`}
              >
                Tümü
              </button>
              {MUGLA_DISTRICTS.map(d => (
                <button
                  key={d}
                  onClick={() => onChange({ ...filters, region: d })}
                  className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                    filters.region === d
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border/30 hover:border-border"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[9px] font-mono text-muted-foreground flex items-center gap-1 mb-1.5">
              <Calendar size={9} /> TARİH ARAILIĞI
            </label>
            <div className="flex flex-wrap gap-1">
              {dateRanges.map(d => (
                <button
                  key={d.value}
                  onClick={() => onChange({ ...filters, dateRange: d.value as any })}
                  className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                    filters.dateRange === d.value
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border/30 hover:border-border"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
