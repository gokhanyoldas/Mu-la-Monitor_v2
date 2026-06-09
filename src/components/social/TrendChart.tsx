import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendDataPoint {
  time: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  height?: number;
}

export const TrendChart = ({ data, title = "Mention & Duygu Trendi", height = 200 }: TrendChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[10px] font-mono text-muted-foreground/50">
        Trend verisi henüz yok — veri toplandıkça oluşacak
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-[10px] font-mono font-bold text-foreground/80 mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fontFamily: "monospace", fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fontFamily: "monospace", fill: "#64748b" }}
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
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "9px", fontFamily: "monospace" }}
            iconSize={8}
          />
          <Area type="monotone" dataKey="positive" name="Pozitif" stroke="#22c55e" fill="url(#colorPositive)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="negative" name="Negatif" stroke="#ef4444" fill="url(#colorNegative)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="neutral" name="Nötr" stroke="#eab308" fill="url(#colorNeutral)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Generate trend data from analysis results
export function generateTrendFromAnalyses(
  analyses: Array<{ sentiment: string; collected_at?: string; timestamp?: number }>
): TrendDataPoint[] {
  if (analyses.length === 0) return [];

  // Group by hour
  const hourMap = new Map<string, { positive: number; negative: number; neutral: number; total: number }>();

  for (const item of analyses) {
    const time = item.collected_at ? new Date(item.collected_at) : new Date(item.timestamp || Date.now());
    const hourKey = time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    if (!hourMap.has(hourKey)) {
      hourMap.set(hourKey, { positive: 0, negative: 0, neutral: 0, total: 0 });
    }

    const entry = hourMap.get(hourKey)!;
    entry.total++;
    if (item.sentiment === "positive") entry.positive++;
    else if (item.sentiment === "negative") entry.negative++;
    else entry.neutral++;
  }

  return Array.from(hourMap.entries())
    .map(([time, counts]) => ({ time, ...counts }))
    .slice(-12); // Last 12 data points
}
