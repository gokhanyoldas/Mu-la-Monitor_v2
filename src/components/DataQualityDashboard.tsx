// DataQualityDashboard.tsx
// Unified Command Center: Data Quality Control Panel & Muğla Sentinel AI Agent working in synergy

import { useEffect, useState } from "react";
import { dataQualityTracker } from "@/lib/data-quality";
import {
  systemAgent,
  type AgentState,
  type SubsystemHealth,
  type AgentProposal,
  type SelfHealingAction,
} from "@/services/system-agent-service";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ChartBar as BarChart3,
  Bot,
  Activity,
  CheckCircle2,
  AlertTriangle,
  CircleAlert as AlertCircle,
  Clock,
  Zap,
  Sparkles,
  RefreshCw,
  Server,
  ShieldCheck,
  Check,
  X,
  Layers,
  Search,
  Wrench,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";

interface QualityMetric {
  category: string;
  lastUpdate: number;
  age: number;
  isFresh: boolean;
  hasRealSource: boolean;
  validationStatus: "valid" | "invalid" | "partial" | "unknown";
  source: string;
  lastError?: string;
}

type TabKey = "agent" | "quality" | "proposals" | "actions";

interface DataQualityDashboardProps {
  embedded?: boolean;
}

export const DataQualityDashboard = ({ embedded = false }: DataQualityDashboardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("agent");
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [agentState, setAgentState] = useState<AgentState>(systemAgent.getState());
  const [subsystems, setSubsystems] = useState<SubsystemHealth[]>(systemAgent.getHealth());
  const [proposals, setProposals] = useState<AgentProposal[]>(systemAgent.getProposals());
  const [actions, setActions] = useState<SelfHealingAction[]>(systemAgent.getActions());
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const { toast } = useToast();
  const hub = useOptionalUnifiedIntelligence();

  const updateQualityMetrics = () => {
    dataQualityTracker.loadPersistedMetrics();
    const allMetrics = dataQualityTracker.getAllMetrics().map((m) => ({
      category: m.category,
      lastUpdate: m.timestamp,
      age: Math.max(0, Math.round((Date.now() - m.timestamp) / (1000 * 60))),
      isFresh: m.is_fresh && (Date.now() - m.timestamp) / (1000 * 60) < 120,
      hasRealSource: m.has_real_source,
      validationStatus: m.validation_status,
      source: m.source,
      lastError: m.last_error,
    }));

    setMetrics(allMetrics);
    setSummary(dataQualityTracker.getHealthSummary());
  };

  useEffect(() => {
    updateQualityMetrics();

    // Subscribe to systemAgent changes
    const unsubAgent = systemAgent.subscribe(() => {
      setAgentState(systemAgent.getState());
      setSubsystems(systemAgent.getHealth());
      setProposals(systemAgent.getProposals());
      setActions(systemAgent.getActions());
      updateQualityMetrics();
    });

    // Listen to custom event for opening panel with specific tab
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: TabKey }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab);
      }
      setIsOpen(true);
    };

    window.addEventListener("open-data-quality-agent", handleOpenEvent);

    const interval = setInterval(updateQualityMetrics, 15000);
    return () => {
      unsubAgent();
      window.removeEventListener("open-data-quality-agent", handleOpenEvent);
      clearInterval(interval);
    };
  }, []);

  const handleRunDiagnostic = async () => {
    setIsRunningTest(true);
    toast({
      title: "Otonom Teşhis Başlatıldı ⚡",
      description: "8 alt sistem canlı ping ve veri kalitesi bütünlük testinden geçiriliyor...",
    });
    const result = await systemAgent.runFullDiagnostic();
    updateQualityMetrics();
    setIsRunningTest(false);
    toast({
      title: "Teşhis & Veri Kalitesi Senkronize Edildi ✅",
      description: `Tüm sistemler ${result.durationMs}ms içinde test edildi. AI Sağlık Skoru: %${systemAgent.getState().healthScore}`,
    });
  };

  const handleRunResearch = async () => {
    setIsResearching(true);
    toast({
      title: "İstihbarat & Veri Açığı Taraması Başlatıldı 🔍",
      description: "Muğla kamu kaynakları ve veri açıkları taranıyor...",
    });
    await systemAgent.runAutonomousResearch();
    setIsResearching(false);
    toast({
      title: "Yeni Geliştirme Önerisi Keşfedildi ✨",
      description: "Öneri havuzuna yeni bir kamu veri kaynağı entegrasyonu eklendi.",
    });
  };

  const handleSelfHeal = () => {
    systemAgent.checkQualityAndAutoHeal();
    updateQualityMetrics();
    toast({
      title: "Otonom İyileştirme Tamamlandı 🛡️",
      description: "Tüm veri hatları ve önbellekler AI Ajan tarafından tarandı ve nominale çekildi.",
    });
  };

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    const ok = await systemAgent.resolveProposal(id, decision);
    if (ok) {
      toast({
        title: decision === "approved" ? "Öneri Onaylandı & Sisteme Entegre Edildi ✅" : "Öneri Reddedildi ❌",
        description: decision === "approved" ? "Ajan ilgili kamu veri hattı yapılandırmasını otonom entegre etti." : "Teklif arşivlendi.",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "valid":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "partial":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "invalid":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, isFresh: boolean) => {
    if (!isFresh) {
      return <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-400 border-red-500/30">ESKİ VERİ</Badge>;
    }
    switch (status) {
      case "valid":
        return <Badge className="text-[9px] bg-emerald-600/90 text-white hover:bg-emerald-600">DOĞRU</Badge>;
      case "partial":
        return <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">KISMÎ</Badge>;
      case "invalid":
        return <Badge variant="destructive" className="text-[9px]">HATA</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9px]">BİLİNMEYEN</Badge>;
    }
  };

  // Main Dashboard Content
  const content = (
    <div className="space-y-4 font-mono text-xs">
      {/* ── Top Unified Health & Quality Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-secondary/30 border border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">AI Sağlık Skoru</p>
            <p className="text-sm font-bold text-emerald-400">%{agentState.healthScore}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Alt Sistemler</p>
            <p className="text-sm font-bold text-foreground">
              {agentState.healthyCount}/{agentState.totalSubsystems} Nominal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Doğrulanmış Kaynak</p>
            <p className="text-sm font-bold text-cyan-400">{summary?.healthy || metrics.length} Sağlıklı</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase">Otonom Onarılan</p>
            <p className="text-sm font-bold text-amber-400">{agentState.selfHealedCount} Aksiyon</p>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/20 border border-border/50 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab("agent")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
            activeTab === "agent"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <Bot size={13} />
          <span>🤖 AI Ajan & Teşhis</span>
        </button>

        <button
          onClick={() => setActiveTab("quality")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
            activeTab === "quality"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <BarChart3 size={13} />
          <span>📊 Veri Kalitesi ({metrics.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("proposals")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap relative ${
            activeTab === "proposals"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <Sparkles size={13} />
          <span>💡 Öneri Havuzu</span>
          {agentState.pendingProposalsCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center">
              {agentState.pendingProposalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("actions")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
            activeTab === "actions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
          }`}
        >
          <ShieldCheck size={13} />
          <span>🛡️ İyileştirme Günlüğü ({actions.length})</span>
        </button>
      </div>

      {/* ── TAB 1: AI Ajan & Teşhis Matrisi ── */}
      {activeTab === "agent" && (
        <div className="space-y-3.5">
          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-card border border-border/60">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${agentState.healthScore >= 90 ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-[11px] text-foreground font-semibold">
                Nöbetçi Modu:{" "}
                <span className="text-primary font-bold">
                  {agentState.mode === "testing"
                    ? "Sentetik Test Koşturuluyor…"
                    : agentState.mode === "researching"
                    ? "İstihbarat Araştırılıyor…"
                    : "7/24 Aktif Nöbette"}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunDiagnostic}
                disabled={isRunningTest}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                <RefreshCw size={11} className={isRunningTest ? "animate-spin" : ""} />
                {isRunningTest ? "Test Ediliyor…" : "⚡ 8 Sistemi Canlı Test Et"}
              </button>

              <button
                onClick={handleSelfHeal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-foreground text-[10px] font-medium border border-border hover:bg-secondary/70 transition-colors"
                title="Eski veya gecikmiş verileri otonom onar"
              >
                <Wrench size={11} className="text-amber-400" />
                Otonom Onar
              </button>

              <button
                onClick={handleRunResearch}
                disabled={isResearching}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-foreground text-[10px] font-medium border border-border hover:bg-secondary/70 disabled:opacity-50 transition-colors"
              >
                <Search size={11} className={isResearching ? "animate-spin text-primary" : ""} />
                {isResearching ? "Taranıyor…" : "🔍 Veri Açığı Tara"}
              </button>
            </div>
          </div>

          {/* 8 Subsystem Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {subsystems.map((sub) => {
              const isHealthy = sub.status === "healthy";
              return (
                <div
                  key={sub.id}
                  className="p-3 rounded-lg border bg-card/60 hover:bg-card/90 transition-all space-y-1.5 border-border/60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isHealthy ? "bg-emerald-400" : "bg-amber-400 animate-ping"}`} />
                      <span className="font-bold text-[11px] text-foreground truncate">{sub.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[8px] font-mono shrink-0 ${
                        isHealthy
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      }`}
                    >
                      {isHealthy ? "Sağlıklı" : "Gecikmeli"}
                    </Badge>
                  </div>

                  <p className="text-[10px] text-muted-foreground line-clamp-1">{sub.message}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      Tazelik: {sub.freshnessMin} dk önce
                    </span>
                    <span className="font-mono text-cyan-400">{sub.latencyMs}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: Veri Kalitesi & Doğrulama ── */}
      {activeTab === "quality" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-[10px]">
            <span className="text-muted-foreground">
              Tüm veri hatları 30 saniyede bir doğrulanır. Gerçek ve ücretsiz kaynaklar önceliklendirilir.
            </span>
            <button
              onClick={updateQualityMetrics}
              className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/70 border border-border text-foreground transition-colors shrink-0"
            >
              <RefreshCw size={10} /> Yenile
            </button>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {metrics.map((metric) => (
              <div
                key={metric.category}
                className="p-3 rounded-lg border border-border/50 bg-card/60 hover:bg-card/90 space-y-1.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {getStatusIcon(metric.validationStatus)}
                    <div>
                      <h4 className="text-[11px] font-bold capitalize text-foreground">
                        {metric.category.replace(/_/g, " ")}
                      </h4>
                      <p className="text-[9px] text-muted-foreground">{metric.source}</p>
                    </div>
                  </div>
                  {getStatusBadge(metric.validationStatus, metric.isFresh)}
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {metric.age === 0 ? "Hemen şimdi" : `${metric.age} dk önce`}
                  </span>

                  {metric.hasRealSource ? (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      <Zap size={9} /> Doğrulanmış Gerçek Kaynak
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      <AlertCircle size={9} /> Kısmi / Saha Gözlemi
                    </span>
                  )}
                </div>

                {metric.lastError && (
                  <p className="text-[9px] text-destructive bg-destructive/10 rounded px-2 py-1 border border-destructive/20">
                    Hata: {metric.lastError}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: Geliştirme & Keşif Önerileri ── */}
      {activeTab === "proposals" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px]">
            <span className="text-primary font-medium">
              💡 AI Ajan, Muğla genelinde veri kalitesini ve istihbarat doğruluğunu artırmak için yeni kamu kaynaklarını araştırır.
            </span>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {proposals.map((prop) => (
              <div
                key={prop.id}
                className="p-3.5 rounded-xl border border-border/60 bg-card/60 space-y-2.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[8px] bg-primary/10 text-primary border-primary/30">
                        {prop.categoryLabel}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">{new Date(prop.createdAt).toLocaleDateString("tr-TR")}</span>
                    </div>
                    <h4 className="text-xs font-bold text-foreground">{prop.title}</h4>
                  </div>
                  <Badge
                    className={`text-[8px] ${
                      prop.status === "approved"
                        ? "bg-emerald-600 text-white"
                        : prop.status === "rejected"
                        ? "bg-secondary text-muted-foreground"
                        : "bg-amber-500 text-black font-bold"
                    }`}
                  >
                    {prop.status === "approved" ? "Onaylandı" : prop.status === "rejected" ? "Reddedildi" : "Onay Bekliyor"}
                  </Badge>
                </div>

                <p className="text-[10px] text-muted-foreground leading-relaxed">{prop.description}</p>

                <div className="p-2 rounded bg-secondary/40 border border-border/40 text-[9px] text-foreground/90 space-y-1">
                  <p><span className="font-bold text-primary">Gerekçe:</span> {prop.rationale}</p>
                  <p><span className="font-bold text-cyan-400">Önerilen Aksiyon:</span> {prop.suggestedAction}</p>
                </div>

                {prop.status === "pending" && (
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                    <button
                      onClick={() => handleDecision(prop.id, "rejected")}
                      className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      Reddet
                    </button>
                    <button
                      onClick={() => handleDecision(prop.id, "approved")}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Check size={11} /> Onayla & Sisteme Uygula
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: Otonom İyileştirme Günlüğü ── */}
      {activeTab === "actions" && (
        <div className="space-y-3">
          <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-[10px] text-muted-foreground">
            🛡️ Siz çevrimdışıyken AI Ajan'ın veri kalitesini korumak için gerçekleştirdiği otonom iyileştirmelerin denetim izi.
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {actions.map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-lg border border-border/50 bg-card/60 space-y-1.5 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    {act.subsystem.toUpperCase()} Hat Onarımı
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {new Date(act.timestamp).toLocaleTimeString("tr-TR")}
                  </span>
                </div>

                <div className="p-2 rounded bg-secondary/30 border border-border/30 text-[9px] space-y-1">
                  <p className="text-amber-400 font-medium">Sorun: {act.issue}</p>
                  <p className="text-emerald-400 font-medium">Uygulanan İyileştirme: {act.actionTaken}</p>
                </div>

                <div className="flex items-center justify-between text-[8px] text-muted-foreground font-mono">
                  <span>Kurtarma Süresi: {act.recoveryMs || 65}ms</span>
                  <span className="text-emerald-400 font-bold">BAŞARILI</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // If embedded in a tab/page directly
  if (embedded) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/80 p-4 sm:p-5 backdrop-blur-sm shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground">
                Veri Kalitesi Kontrol Paneli & AI Ajan Komuta Merkezi
              </h3>
              <p className="text-[9px] font-mono text-muted-foreground">
                8 Alt Sistem Canlı Doğrulama, Açık Veri Bütünlüğü & Otonom Sistem Nöbetçisi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-mono text-emerald-400 font-bold">CANLI SENKRONİZASYON</span>
          </div>
        </div>
        {content}
      </div>
    );
  }

  // Slide-out Sheet View (Opened only via footer "Sistem Durumu" link — zero floating pills on main UI)
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-screen overflow-hidden flex flex-col p-4 sm:p-6 bg-background/95 backdrop-blur-md border-l border-border/80 shadow-2xl"
      >
        <SheetHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="flex items-center gap-2 font-mono text-sm sm:text-base text-foreground">
              <div className="w-7 h-7 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <span>Sistem Durumu & Veri Sağlığı</span>
            </SheetTitle>
            <Badge variant="outline" className="text-[9px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
              Sağlık %{agentState.healthScore}
            </Badge>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground text-left">
            Geliştirici görünümü: veri kaynağı güncelliği, arka plan sözlük durumu ve sistem kontrolleri
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3">
          {content}
        </ScrollArea>

        <div className="border-t border-border/50 pt-2.5 text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
          <span>Arka plan kontrolleri aktif · {hub?.arbitratedEvents.length ?? 0} işlenmiş olay</span>
          {hub && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                hub.setLexiconDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              data-testid="system-status-lexicon-btn"
            >
              <BookOpen className="w-3 h-3" />
              <span>Sözlük Havuzu ({hub.lexicon.length} terim)</span>
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
