import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { MiniChart } from "../MiniChart";
import { Gauge } from "../Gauge";
import { Radio, MessageCircle, Hash, BarChart3, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLiveData } from "@/hooks/useLiveData";

export const SocialIntelSection = () => {
  const { data: trendsData, isLoading } = useLiveData<any>("trends", { refetchInterval: 15 * 60 * 1000 });

  const trends = Array.isArray(trendsData) ? trendsData : [];
  const isLive = trends.length > 0;

  const totalMentions = isLive
    ? trends.reduce((a: number, t: any) => a + (t.mentions || 0), 0)
    : 1330;
  const activeKeywords = isLive ? trends.length : 8;

  const positiveCount = isLive ? trends.filter((t: any) => t.sentiment === "positive").length : 0;
  const negativeCount = isLive ? trends.filter((t: any) => t.sentiment === "negative").length : 0;
  const total = isLive ? trends.length : 1;
  const positiveRate = isLive ? Math.round((positiveCount / total) * 100) : 72;
  const negativeRate = isLive ? Math.round((negativeCount / total) * 100) : 18;

  const mentionTrend = isLive
    ? trends.slice(0, 7).map((t: any) => ({ name: (t.keyword || "").replace("#", "").slice(0, 4), value: t.mentions || 0 }))
    : [
        { name: "Pzt", value: 120 }, { name: "Sal", value: 185 }, { name: "Çar", value: 142 },
        { name: "Per", value: 210 }, { name: "Cum", value: 198 }, { name: "Cmt", value: 245 }, { name: "Paz", value: 230 },
      ];

  const sentimentTrend = isLive
    ? trends.slice(0, 7).map((t: any) => ({
        name: (t.keyword || "").replace("#", "").slice(0, 4),
        value: t.sentiment === "positive" ? 80 : t.sentiment === "negative" ? 30 : 55,
      }))
    : [
        { name: "Pzt", value: 65 }, { name: "Sal", value: 72 }, { name: "Çar", value: 58 },
        { name: "Per", value: 80 }, { name: "Cum", value: 74 }, { name: "Cmt", value: 85 }, { name: "Paz", value: 78 },
      ];

  const platformBreakdown = isLive
    ? [
        { label: "Web Bahsetme", value: `${Math.round(totalMentions * 0.4)} bahsetme`, status: "ok" as const },
        { label: "Haber Siteleri", value: `${Math.round(totalMentions * 0.3)} bahsetme`, status: "ok" as const },
        { label: "Sosyal Medya", value: `${Math.round(totalMentions * 0.2)} bahsetme`, status: "info" as const },
        { label: "Forum & Blog", value: `${Math.round(totalMentions * 0.1)} bahsetme`, status: "info" as const },
      ]
    : [
        { label: "X (Twitter)", value: "520 bahsetme", status: "ok" as const },
        { label: "Instagram", value: "380 bahsetme", status: "ok" as const },
        { label: "Facebook", value: "245 bahsetme", status: "info" as const },
        { label: "YouTube", value: "185 bahsetme", status: "info" as const },
      ];

  return (
    <div className="space-y-3">
      <DashboardPanel
        title="Sosyal Medya İstihbaratı"
        icon={<Radio size={14} />}
        badge={isLive ? "CANLI" : "AI ANALİZ"}
        badgeVariant={isLive ? "live" : "info"}
      >
        {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Toplam Bahsetme" value={totalMentions >= 1000 ? `${(totalMentions / 1000).toFixed(1)}K` : String(totalMentions)} change={12} variant="primary" icon={<MessageCircle size={12} />} />
          <StatCard label="Aktif Kelime" value={String(activeKeywords)} variant="accent" icon={<Hash size={12} />} />
        </div>

        <div className="mb-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Haftalık Bahsetme Trendi</div>
          <MiniChart data={mentionTrend} color="hsl(200, 80%, 50%)" height={50} showAxis />
        </div>

        <div className="flex justify-around mb-3">
          <Gauge value={positiveRate} max={100} label="Pozitif Oran" variant="primary" />
          <Gauge value={negativeRate} max={100} label="Negatif Oran" variant="destructive" />
        </div>

        <StatusList items={platformBreakdown} />

        <div className="mt-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Duygu Analizi Trendi</div>
          <MiniChart data={sentimentTrend} color="hsl(160, 60%, 45%)" height={50} showAxis />
        </div>

        <Link
          to="/social-intel"
          className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors py-1.5 rounded bg-primary/10 border border-primary/20 hover:bg-primary/20"
        >
          <BarChart3 size={12} />
          DETAYLI ANALİZ SAYFASI →
        </Link>
      </DashboardPanel>
    </div>
  );
};
