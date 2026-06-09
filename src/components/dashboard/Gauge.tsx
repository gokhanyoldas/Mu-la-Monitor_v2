interface GaugeProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  size?: number;
  variant?: "primary" | "warning" | "destructive" | "accent";
}

const gaugeColors = {
  primary: "hsl(160, 60%, 45%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(0, 72%, 51%)",
  accent: "hsl(200, 80%, 50%)",
};

export const Gauge = ({ value, max, label, unit = "%", size = 80, variant = "primary" }: GaugeProps) => {
  const percentage = (value / max) * 100;
  const radius = (size - 10) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path
          d={`M 5 ${size / 2 + 5} A ${radius} ${radius} 0 0 1 ${size - 5} ${size / 2 + 5}`}
          className="gauge-track"
          strokeWidth="4"
        />
        <path
          d={`M 5 ${size / 2 + 5} A ${radius} ${radius} 0 0 1 ${size - 5} ${size / 2 + 5}`}
          className="gauge-fill"
          stroke={gaugeColors[variant]}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          className="fill-foreground font-mono text-sm font-bold"
          fontSize="14"
        >
          {value}{unit}
        </text>
      </svg>
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider text-center">
        {label}
      </span>
    </div>
  );
};
