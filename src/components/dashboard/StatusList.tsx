interface StatusListItem {
  label: string;
  value: string | number;
  status?: "ok" | "warning" | "critical" | "info";
}

interface StatusListProps {
  items: StatusListItem[];
}

const statusColors = {
  ok: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  info: "bg-accent",
};

export const StatusList = ({ items }: StatusListProps) => {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-2">
            {item.status && (
              <span className={`w-1.5 h-1.5 rounded-full ${statusColors[item.status]}`} />
            )}
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
          <span className="text-xs font-mono font-medium text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
};
