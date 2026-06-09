import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface ComparisonData {
  region: string;
  thisWeek: number;
  lastWeek: number;
  sentimentThis: number; // -1 to 1
  sentimentLast: number;
}

interface WeeklyComparisonProps {
  data: ComparisonData[];
}

export const WeeklyComparison = ({ data }: WeeklyComparisonProps) => {
  if (data.length === 0) {
    return (
      <div className="text-[10px] font-mono text-muted-foreground/50 text-center py-4">
        Karşılaştırma için en az 2 haftalık veri gerekli
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: d.region,
    "Bu Hafta": d.thisWeek,
    "Geçen Hafta": d.lastWeek,
    change: d.thisWeek - d.lastWeek,
    sentimentChange: d.sentimentThis - d.sentimentLast,
  }));

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 8, fontFamily: "monospace", fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 8, fontFamily: "monospace", fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "10px",
              fontFamily: "monospace",
            }}
          />
          <Bar dataKey="Bu Hafta" fill="#06b6d4" radius={[3, 3, 0, 0]} barSize={12} />
          <Bar dataKey="Geçen Hafta" fill="#334155" radius={[3, 3, 0, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>

      {/* Change indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.slice(0, 6).map(d => {
          const mentionChange = d.thisWeek - d.lastWeek;
          const sentChange = d.sentimentThis - d.sentimentLast;

          return (
            <div key={d.region} className="px-2 py-1.5 rounded bg-muted/10 border border-border/20">
              <span className="text-[9px] font-mono text-muted-foreground block">{d.region}</span>
              <div className="flex items-center gap-1 mt-0.5">
                {mentionChange > 0 ? (
                  <ArrowUp size={9} className="text-green-500" />
                ) : mentionChange < 0 ? (
                  <ArrowDown size={9} className="text-red-500" />
                ) : (
                  <Minus size={9} className="text-muted-foreground" />
                )}
                <span className={`text-[10px] font-mono font-bold ${
                  mentionChange > 0 ? "text-green-500" : mentionChange < 0 ? "text-red-500" : "text-muted-foreground"
                }`}>
                  {mentionChange > 0 ? "+" : ""}{mentionChange} mention
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[8px] font-mono ${
                  sentChange > 0 ? "text-green-400" : sentChange < 0 ? "text-red-400" : "text-muted-foreground/50"
                }`}>
                  Duygu: {sentChange > 0 ? "↑ İyileşme" : sentChange < 0 ? "↓ Kötüleşme" : "— Sabit"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Generate comparison data from current analyses vs history
 */
export function generateComparisonData(
  currentByRegion: Record<string, { count: number; sentimentAvg: number }>,
  previousByRegion: Record<string, { count: number; sentimentAvg: number }>
): ComparisonData[] {
  const allRegions = new Set([...Object.keys(currentByRegion), ...Object.keys(previousByRegion)]);

  return Array.from(allRegions).map(region => ({
    region,
    thisWeek: currentByRegion[region]?.count || 0,
    lastWeek: previousByRegion[region]?.count || 0,
    sentimentThis: currentByRegion[region]?.sentimentAvg || 0,
    sentimentLast: previousByRegion[region]?.sentimentAvg || 0,
  })).sort((a, b) => b.thisWeek - a.thisWeek);
}
