import { Database, Radio, Clock3, FlaskConical } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type DataOrigin = "live" | "cached" | "reference" | "pending";

const styles: Record<DataOrigin, { label: string; className: string; Icon: typeof Radio }> = {
  live: { label: "CANLI VERİ", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", Icon: Radio },
  cached: { label: "ÖNBELLEK", className: "border-sky-500/40 bg-sky-500/10 text-sky-300", Icon: Clock3 },
  reference: { label: "REFERANS VERİ", className: "border-amber-500/40 bg-amber-500/10 text-amber-300", Icon: Database },
  pending: { label: "VERİ BEKLENİYOR", className: "border-slate-500/40 bg-slate-500/10 text-slate-300", Icon: FlaskConical },
};

export function DataOriginBadge({ origin, className = "" }: { origin: DataOrigin; className?: string }) {
  const item = styles[origin];
  const Icon = item.Icon;
  const { lang } = useTranslation();
  const labels: Record<DataOrigin, string> =
    lang === "en"
      ? { live: "LIVE DATA", cached: "CACHED", reference: "REFERENCE DATA", pending: "DATA PENDING" }
      : lang === "de"
      ? { live: "LIVE-DATEN", cached: "CACHE", reference: "REFERENZDATEN", pending: "DATEN AUSSTEHEND" }
      : { live: "CANLI VERİ", cached: "ÖNBELLEK", reference: "REFERANS VERİ", pending: "VERİ BEKLENİYOR" };

  return (
    <span
      className={`tech-meta-only inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase ${item.className} ${className}`}
    >
      <Icon size={10} aria-hidden="true" /> {labels[origin]}
    </span>
  );
}

export type { DataOrigin };
