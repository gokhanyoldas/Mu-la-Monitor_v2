import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Car, Flame, Palmtree, TrendingUp, Shield, Building2,
  CheckCircle2, AlertTriangle, ArrowRight,
  Activity, ExternalLink, Info, Filter
} from "lucide-react";
import {
  crossTabIntelligence,
  type DomainVerificationStatus,
  type CityDomainKey
} from "@/services/cross-tab-intelligence";

interface CrossTabVerificationMatrixProps {
  posts?: Array<Record<string, unknown>>;
  onFilterByDomain?: (domain: CityDomainKey) => void;
}

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  Car: <Car size={16} />,
  Flame: <Flame size={16} />,
  Palmtree: <Palmtree size={16} />,
  TrendingUp: <TrendingUp size={16} />,
  Shield: <Shield size={16} />,
  Building2: <Building2 size={16} />,
};

export const CrossTabVerificationMatrix = ({
  posts = [],
  onFilterByDomain,
}: CrossTabVerificationMatrixProps) => {
  const navigate = useNavigate();
  const [selectedDomain, setSelectedDomain] = useState<CityDomainKey | null>(null);

  const matrix = useMemo(() => {
    return crossTabIntelligence.generateDomainMatrix(posts);
  }, [posts]);

  const totalVerified = matrix.filter(m => m.status === "verified" || m.status === "spike").length;
  const criticalSpikes = matrix.filter(m => m.status === "spike").length;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
            <h3 className="text-sm font-mono font-bold text-foreground flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              Yaşayan Şehir Çapraz Teyit & Doğrulama Matrisi
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Canlı Sinyal Besleme
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Sosyal medya, yerel basın ve OSINT kanallarından yakalanan sinyaller; Ulaşım, Çevre, Turizm ve Güvenlik sekmelerindeki resmi sensör verileriyle çapraz doğrulanır.
          </p>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-background/80 border border-border text-center min-w-[90px]">
            <span className="text-[9px] font-mono text-muted-foreground block">Teyitli Sektör</span>
            <span className="text-sm font-mono font-bold text-primary">{totalVerified} / 6</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-background/80 border border-border text-center min-w-[90px]">
            <span className="text-[9px] font-mono text-muted-foreground block">Kritik Anomali</span>
            <span className={`text-sm font-mono font-bold ${criticalSpikes > 0 ? "text-destructive animate-pulse" : "text-success"}`}>
              {criticalSpikes > 0 ? `${criticalSpikes} ALARM` : "Yok"}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Domain Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {matrix.map((item) => {
          const isSpike = item.status === "spike";
          const isVerified = item.status === "verified";
          const isSelected = selectedDomain === item.domain;

          return (
            <div
              key={item.domain}
              className={`rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                isSpike
                  ? "border-destructive/60 bg-destructive/5 hover:border-destructive"
                  : isVerified
                  ? "border-primary/40 bg-card hover:border-primary/70"
                  : "border-border/60 bg-card/60 hover:border-border"
              } ${isSelected ? "ring-2 ring-primary shadow-lg" : ""}`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      isSpike ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"
                    }`}>
                      {DOMAIN_ICONS[item.iconName] || <Activity size={16} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold text-foreground">{item.title}</h4>
                      <span className="text-[9px] font-mono text-muted-foreground">{item.lastVerifiedAt}</span>
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isSpike
                      ? "bg-destructive/20 text-destructive border-destructive/40"
                      : isVerified
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {item.statusLabel}
                  </span>
                </div>

                {/* Score & Progress */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Teyit Güven Endeksi</span>
                    <span className="font-bold text-foreground">%{item.verificationScore}</span>
                  </div>
                  <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSpike ? "bg-destructive" : item.verificationScore >= 80 ? "bg-primary" : "bg-warning"
                      }`}
                      style={{ width: `${item.verificationScore}%` }}
                    />
                  </div>
                </div>

                {/* Dominant issue alert if any */}
                {item.dominantIssue && (
                  <div className="p-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-[10px] font-mono flex items-start gap-1.5 mb-2.5">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{item.dominantIssue}</span>
                  </div>
                )}

                {/* Official correlation statement */}
                <div className="text-[10px] font-mono text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/40 mb-3 flex items-start gap-1.5">
                  <Info size={11} className="text-primary flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{item.officialDataCorrelation}</span>
                </div>

                {/* Recent Supporting Signals */}
                <div className="space-y-1.5 mb-3">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Son Yakalanan Sosyal Sinyaller ({item.recentSignals.length})
                  </span>
                  {item.recentSignals.length === 0 ? (
                    <div className="text-[10px] font-mono text-muted-foreground/60 italic py-1">
                      Henüz bu sektöre ait kritik sinyal yakalanmadı.
                    </div>
                  ) : (
                    item.recentSignals.map((sig) => (
                      <div
                        key={sig.id}
                        className="p-2 rounded-md bg-secondary/30 border border-border/30 text-[10px] font-mono space-y-1"
                      >
                        <div className="flex items-center justify-between text-[8px] text-muted-foreground">
                          <span className="text-foreground/80 font-semibold">{sig.source}</span>
                          <span className={
                            sig.sentiment === "positive" ? "text-green-400" :
                            sig.sentiment === "negative" ? "text-red-400" : "text-yellow-400"
                          }>
                            {sig.sentiment === "positive" ? "● Olumlu" : sig.sentiment === "negative" ? "● Olumsuz" : "● Nötr"}
                          </span>
                        </div>
                        <p className="text-foreground/90 line-clamp-2 leading-relaxed text-[9px]">{sig.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 mt-auto">
                <button
                  onClick={() => {
                    setSelectedDomain(isSelected ? null : item.domain);
                    if (onFilterByDomain) onFilterByDomain(item.domain);
                  }}
                  className="text-[9px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Filter size={10} />
                  {isSelected ? "Filtreyi Temizle" : "Bu Sektörü Filtrele"}
                </button>

                <button
                  onClick={() => {
                    if (item.tabKey === "genel") navigate("/");
                    else navigate(`/?tab=${item.tabKey}`);
                  }}
                  className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 flex items-center gap-1 transition-colors"
                >
                  <span>{item.title.split(" ")[0]} Sekmesi</span>
                  <ArrowRight size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
