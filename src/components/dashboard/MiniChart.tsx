import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface MiniChartProps {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  showAxis?: boolean;
}

export const MiniChart = ({ data, color = "hsl(160, 60%, 45%)", height = 60, showAxis = false }: MiniChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {showAxis && (
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: "hsl(220, 10%, 50%)", fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
        )}
        <Tooltip
          contentStyle={{
            background: "hsl(220, 18%, 10%)",
            border: "1px solid hsl(220, 15%, 18%)",
            borderRadius: "6px",
            fontFamily: "JetBrains Mono",
            fontSize: "11px",
            color: "hsl(180, 10%, 85%)",
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, '')})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
