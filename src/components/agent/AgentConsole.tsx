// AgentConsole.tsx
// Comprehensive command console for the Muğla Sentinel Autonomous Agent

import { useEffect, useState } from "react";
import {
  systemAgent,
  type AgentState,
  type SubsystemHealth,
  type AgentProposal,
  type SelfHealingAction,
} from "@/services/system-agent-service";
import {
  Bot,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Search,
  Check,
  X,
  Clock,
  Zap,
  Server,
  Layers,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConsoleTab = "health" | "proposals" | "actions";

export const AgentConsole = () => {
  const [state, setState] = useState<AgentState>(systemAgent.getState());
  const [health, setHealth] = useState<SubsystemHealth[]>(systemAgent.getHealth());
  const [proposals, setProposals] = useState<AgentProposal[]>(systemAgent.getProposals());
  const [actions, setActions] = useState<SelfHealingAction[]>(systemAgent.getActions());
  const [activeTab, setActiveTab] = useState<ConsoleTab>("health");
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    return systemAgent.subscribe(() => {
      setState(systemAgent.getState());
      setHealth(systemAgent.getHealth());
      setProposals(systemAgent.getProposals());
      setActions(systemAgent.getActions());
    });
  }, []);

  const handleRunDiagnostic = async () => {
    setIsRunningTest(true);
    toast({
      title: "Otonom Teşhis Başlatıldı ⚡",
      description: "8 alt sistemin canlı ping ve veri bütünlüğü testleri koşturuluyor...",
    });
    const result = await systemAgent.runFullDiagnostic();
    setIsRunningTest(false);
    toast({
      title: "Teşhis Tamamlandı ✅",
      description: `Tüm sistemler ${result.durationMs}ms içinde test edildi. Sağlık skoru: %${systemAgent.getState().healthScore}`,
    });
  };

  const handleRunResearch = async () => {
    setIsResearching(true);
    toast({
      title: "İstihbarat Taraması Başlatıldı 🔍",
      description: "Muğla veri açıkları ve yeni kamu kaynakları araştırılıyor...",
    });
    await systemAgent.runAutonomousResearch();
    setIsResearching(false);
    toast({
      title: "Araştırma Raporu Hazır ✨",
      description: "Yeni bir geliştirme önerisi teklif havuzuna eklendi.",
    });
  };

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    const ok = await systemAgent.resolveProposal(id, decision);
    if (ok) {
      toast({
        title: decision === "approved" ? "Öneri Onaylandı & Uygulandı ✅" : "Öneri Reddedildi ❌",
        description: decision === "approved" ? "Ajan ilgili yapılandırmayı otonom olarak sisteme entegre etti." : "Teklif arşivlendi.",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Top Hero: Agent Status & Quick Commands ── */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
              <Bot className="text-primary animate-pulse" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-mono font-bold text-foreground">
                  Muğla Sentinel AI — Otonom Sistem Nöbetçisi
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Nöbette & Aktif
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-mono text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                Siz çevrimdışıyken tüm veri hatlarını denetler, sentetik testler koşturur, bayatlayan önbellekleri otonom iyileştirir ve şehir istihbaratını geliştirecek yeni kaynakları araştırır.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunDiagnostic}
              disabled={isRunningTest || isResearching}
              className="px-3 py-2 text-[10px] font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Zap size={12} className={isRunningTest ? "animate-spin" : ""} />
              {isRunningTest ? "Test Ediliyor…" : "Sistemleri Test Et"}
            </button>
            <button
              onClick={handleRunResearch}
              disabled={isRunningTest || isResearching}
              className="px-3 py-2 text-[10px] font-mono font-semibold bg-muted/20 hover:bg-muted/40 text-foreground border border-border/60 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Search size={12} className={isResearching ? "animate-pulse text-primary" : ""} />
              {isResearching ? "Araştırılıyor…" : "İstihbarat Araştırması Yap"}
            </button>
          </div>
        </div>

        {/* ── Key Metrics Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-border/40">
          <div className="p-2.5 rounded-lg bg-muted/10 border border-border/30">
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Sistem Sağlık Skoru</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-mono font-bold text-emerald-400">%{state.healthScore}</span>
              <span className="text-[9px] font-mono text-emerald-500/80">Nominal</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/10 border border-border/30">
            <span className="text-[9px] font-mono text-muted-foreground uppercase">İzlenen Veri Hattı</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-mono font-bold text-foreground">{state.healthyCount} / {state.totalSubsystems}</span>
              <span className="text-[9px] font-mono text-muted-foreground">Aktif</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/10 border border-border/30">
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Otonom Müdahale (Healed)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-mono font-bold text-primary">{state.selfHealedCount}</span>
              <span className="text-[9px] font-mono text-primary/70">Düzeltme</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-muted/10 border border-border/30">
            <span className="text-[9px] font-mono text-muted-foreground uppercase">Geliştirme Teklifleri</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-mono font-bold text-yellow-400">{state.pendingProposalsCount}</span>
              <span className="text-[9px] font-mono text-yellow-500/80">Onay Bekliyor</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-1.5 border-b border-border/50 pb-2 overflow-x-auto scrollbar-thin">
        <button
          onClick={() => setActiveTab("health")}
          className={`flex items-center gap-1.5 text-[10px] font-mono px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
            activeTab === "health"
              ? "bg-primary/15 text-primary border-primary/40 font-bold"
              : "bg-muted/5 text-muted-foreground border-border/30 hover:text-foreground"
          }`}
        >
          <Server size={12} />
          Alt Sistem Test Matrisi ({health.length})
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`flex items-center gap-1.5 text-[10px] font-mono px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
            activeTab === "proposals"
              ? "bg-primary/15 text-primary border-primary/40 font-bold"
              : "bg-muted/5 text-muted-foreground border-border/30 hover:text-foreground"
          }`}
        >
          <Sparkles size={12} />
          Araştırma & Geliştirme Önerileri ({state.pendingProposalsCount})
        </button>

        <button
          onClick={() => setActiveTab("actions")}
          className={`flex items-center gap-1.5 text-[10px] font-mono px-3.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
            activeTab === "actions"
              ? "bg-primary/15 text-primary border-primary/40 font-bold"
              : "bg-muted/5 text-muted-foreground border-border/30 hover:text-foreground"
          }`}
        >
          <ShieldCheck size={12} />
          Otonom İyileştirme Günlüğü ({actions.length})
        </button>
      </div>

      {/* ── TAB 1: Subsystem Health & QA Matrix ── */}
      {activeTab === "health" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {health.map((sub) => {
            const isHealthy = sub.status === "healthy";
            const isDegraded = sub.status === "degraded";

            return (
              <div
                key={sub.id}
                className="p-3.5 rounded-xl border border-border/40 bg-card hover:border-border transition-all space-y-2 relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground border border-border/40">
                        {sub.category}
                      </span>
                      <h4 className="text-[11px] font-mono font-bold text-foreground truncate">{sub.name}</h4>
                    </div>
                    <span className="text-[8px] font-mono text-muted-foreground/60 truncate block mt-0.5">
                      {sub.endpoint}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isHealthy
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : isDegraded
                          ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {isHealthy ? <CheckCircle2 size={10} /> : isDegraded ? <AlertTriangle size={10} /> : <XCircle size={10} />}
                      {isHealthy ? "Sağlıklı" : isDegraded ? "Yavaş" : "Kesinti"}
                    </span>
                  </div>
                </div>

                <p className="text-[9.5px] font-mono text-foreground/85 leading-relaxed bg-muted/10 p-2 rounded-lg border border-border/20">
                  {sub.message}
                </p>

                <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Clock size={9} />
                    Son kontrol: {sub.freshnessMin}dk önce
                  </span>
                  <span className="text-foreground/80 font-bold">
                    Gecikme: <span className={sub.latencyMs < 200 ? "text-emerald-400" : "text-yellow-400"}>{sub.latencyMs}ms</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 2: Autonomous Research & Proposals ── */}
      {activeTab === "proposals" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-[9.5px] font-mono text-foreground/90 leading-relaxed flex items-start gap-2.5">
            <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-primary">Ajan Araştırma Notu:</span> Muğla'nın 13 ilçesindeki kamu veri portalları, yerel basın ve kriz dinamikleri düzenli taranarak sistemin kör noktaları tespit edilmektedir. Aşağıdaki öneriler otonom olarak üretilmiş olup, onayınız halinde sisteme dahil edilecektir.
            </div>
          </div>

          {proposals.map((prop) => {
            const isPending = prop.status === "pending";
            const isApproved = prop.status === "approved";

            return (
              <div
                key={prop.id}
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  isPending
                    ? "bg-card border-border/50 hover:border-primary/40"
                    : isApproved
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : "bg-muted/10 border-border/30 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-bold">
                        {prop.categoryLabel}
                      </span>
                      <span
                        className={`text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                          prop.impact === "high"
                            ? "bg-red-500/15 text-red-400 border border-red-500/30"
                            : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                        }`}
                      >
                        {prop.impact === "high" ? "Yüksek Etki" : "Orta Etki"}
                      </span>
                      <span className="text-[8px] font-mono text-muted-foreground">
                        {new Date(prop.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-mono font-bold text-foreground mt-1.5">
                      {prop.title}
                    </h3>
                  </div>

                  {/* Actions */}
                  {isPending ? (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                      <button
                        onClick={() => handleDecision(prop.id, "approved")}
                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-lg text-[9.5px] font-mono font-bold flex items-center gap-1 transition-colors"
                      >
                        <Check size={12} />
                        Onayla & Sisteme Uygula
                      </button>
                      <button
                        onClick={() => handleDecision(prop.id, "rejected")}
                        className="px-2.5 py-1.5 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-red-400 border border-border/40 rounded-lg text-[9.5px] font-mono flex items-center gap-1 transition-colors"
                      >
                        <X size={12} />
                        Reddet
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-[9px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
                        isApproved
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/15 text-red-400 border-red-500/30"
                      }`}
                    >
                      {isApproved ? "✓ Onaylandı ve Uygulandı" : "✕ Reddedildi"}
                    </span>
                  )}
                </div>

                <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                  {prop.description}
                </p>

                <div className="p-2.5 rounded-lg bg-muted/15 border border-border/25 space-y-1 text-[9px] font-mono">
                  <div className="text-foreground/90">
                    <span className="text-primary font-bold">Gerekçe: </span>
                    {prop.rationale}
                  </div>
                  <div className="text-muted-foreground/90">
                    <span className="text-yellow-400 font-bold">Önerilen Aksiyon: </span>
                    {prop.suggestedAction}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB 3: Self-Healing Actions Log ── */}
      {activeTab === "actions" && (
        <div className="space-y-2.5">
          <div className="p-3 rounded-lg bg-muted/15 border border-border/30 text-[9.5px] font-mono text-muted-foreground leading-relaxed flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>
              Ajan, siz çevrimdışıyken tespit ettiği gecikmeleri, bayatlayan önbellekleri ve hata durumlarını sistem mimarisini bozmadan otonom olarak onarır.
            </span>
          </div>

          <div className="space-y-1.5">
            {actions.map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-lg border border-border/30 bg-card flex items-start justify-between gap-3 text-[9.5px] font-mono"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 text-[8px] uppercase">
                      Otonom Çözüldü
                    </span>
                    <span className="font-bold text-foreground truncate">{act.issue}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{act.actionTaken}</p>
                </div>

                <div className="text-right shrink-0 text-[8px] font-mono text-muted-foreground/60">
                  <div>{new Date(act.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                  {act.recoveryMs && <div className="text-emerald-400 mt-0.5">+{act.recoveryMs}ms toparlanma</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
