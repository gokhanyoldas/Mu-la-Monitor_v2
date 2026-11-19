// AgentSentinelBadge.tsx
// Compact live watchdog indicator for the top navigation header

import { useEffect, useState } from "react";
import { systemAgent, type AgentState } from "@/services/system-agent-service";
import { Bot, Activity, Sparkles } from "lucide-react";

interface Props {
  onClick?: () => void;
  className?: string;
}

export const AgentSentinelBadge = ({ onClick, className }: Props) => {
  const [state, setState] = useState<AgentState>(systemAgent.getState());

  useEffect(() => {
    return systemAgent.subscribe(() => {
      setState(systemAgent.getState());
    });
  }, []);

  const isTesting = state.mode === "testing";
  const isResearching = state.mode === "researching";

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      systemAgent.openQualityDashboard("agent");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`group relative flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all text-[10px] font-mono select-none ${
        isTesting || isResearching
          ? "border-primary/60 bg-primary/15 text-primary shadow-sm shadow-primary/20"
          : state.healthScore >= 90
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/15"
          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
      } ${className ?? ""}`}
      title="Muğla Sentinel AI — Otonom Sistem Nöbetçisi & Test Konsolu"
    >
      {/* Animated status ring */}
      <div className="relative flex items-center justify-center">
        <span
          className={`w-2 h-2 rounded-full ${
            isTesting
              ? "bg-primary animate-ping"
              : state.healthScore >= 90
              ? "bg-emerald-400 animate-pulse"
              : "bg-yellow-400 animate-ping"
          }`}
        />
        <Bot size={12} className="ml-1 opacity-80 group-hover:scale-110 transition-transform" />
      </div>

      <div className="flex items-center gap-1.5 font-bold">
        <span>AJAN:</span>
        <span className="font-semibold text-foreground/90 truncate max-w-[85px] sm:max-w-none">
          {isTesting
            ? "TEST EDİYOR…"
            : isResearching
            ? "ARAŞTIRIYOR…"
            : `%${state.healthScore} SAĞLIK`}
        </span>
      </div>

      {state.pendingProposalsCount > 0 && !isTesting && !isResearching && (
        <span
          className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-primary/20 text-primary border border-primary/30 text-[8px] font-bold"
          title={`${state.pendingProposalsCount} onay bekleyen geliştirme önerisi var`}
        >
          <Sparkles size={8} />
          {state.pendingProposalsCount}
        </span>
      )}
    </button>
  );
};
