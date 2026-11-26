// src/components/investigation/InvestigationHub.tsx
// Muğla İstihbarat, Çapraz Sorgu & Ağ Diyagramı Ana Merkezi

import React, { useState } from "react";
import { InvestigationGraph } from "@/components/investigation/InvestigationGraph";
import { InterrogationRoomConsole } from "@/components/investigation/InterrogationRoomConsole";
import { MuglaNetworkDiagram } from "@/components/dashboard/MuglaNetworkDiagram";
import {
  INVESTIGATION_DOSSIERS,
  INVESTIGATION_NODES,
  INVESTIGATION_LINKS
} from "@/data/investigationData";
import {
  Radio,
  Network,
  FileSearch,
} from "lucide-react";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { PanelHelpTooltip } from "@/components/dashboard/PanelHelpTooltip";
import { useMonitorStore, selectDiagramEvents } from "@/store/useMonitorStore";
import { formatRelativeTime } from "@/lib/time-utils";

export type InvestigationHubView = "verification" | "protocol_network";

export const InvestigationHub: React.FC<{ initialView?: InvestigationHubView }> = ({ initialView = "verification" }) => {
  const { dynamicDossiers, activeDynamicDossierId, setActiveDynamicDossierId } = useUnifiedIntelligence();
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const diagramEvents = useMonitorStore(selectDiagramEvents);
  // Görünüm Modu: "investigation" (Sorgu Odası & Kulis Ağı) veya "topology" (13 İlçe Kentsel Altyapı Ağı)
  const [viewMode, setViewMode] = useState<"investigation" | "topology">(initialView === "protocol_network" ? "topology" : "investigation");
  
  // Seçili Dosya ve Vurgulu Düğümler
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>("dosya-bodrum-su");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>(() => {
    return INVESTIGATION_DOSSIERS[0].nodeIds;
  });
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<string[]>(() => {
    return INVESTIGATION_DOSSIERS[0].linkIds;
  });

  const allDossiers = React.useMemo(
    () => [...dynamicDossiers, ...INVESTIGATION_DOSSIERS],
    [dynamicDossiers]
  );

  React.useEffect(() => {
    if (!activeDynamicDossierId) return;
    const found = dynamicDossiers.find((d) => d.id === activeDynamicDossierId);
    if (found) {
      setSelectedDossierId(found.id);
      setHighlightedNodeIds(found.nodeIds);
      setHighlightedLinkIds(found.linkIds);
      setSelectedNodeId(null);
    }
  }, [activeDynamicDossierId, dynamicDossiers]);

  const handleHighlight = (nodeIds: string[], linkIds: string[], dossierId?: string) => {
    setHighlightedNodeIds(nodeIds);
    setHighlightedLinkIds(linkIds);
    if (dossierId) {
      setSelectedDossierId(dossierId);
    }
  };

  const handleSelectDossier = (dossierId: string) => {
    setSelectedDossierId(dossierId || null);
    if (!dossierId) {
      setActiveDynamicDossierId(null);
      setHighlightedNodeIds([]);
      setHighlightedLinkIds([]);
      setSelectedNodeId(null);
      return;
    }

    const dos = allDossiers.find((d) => d.id === dossierId);
    if (dos) {
      setHighlightedNodeIds(dos.nodeIds);
      setHighlightedLinkIds(dos.linkIds);
      setSelectedNodeId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── ÜST MOD SEÇİCİ & DURUM BİLGİSİ ── */}
      <div className="bg-[#0b0c14] border border-slate-800 p-3 rounded-xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <h2 className="text-base sm:text-lg font-bold font-mono tracking-wide text-white">
              {t("Haber Doğrulama Merkezi")}
            </h2>
            {diagramEvents.length > 0 && (
              <span className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-300">
                {isEn ? `${diagramEvents.length} VERIFIED SIGNALS` : `${diagramEvents.length} DOĞRULANMIŞ GELİŞME`}
              </span>
            )}
            <PanelHelpTooltip panelTitle="Muğla İstihbarat & Çapraz Sorgu Odası" />
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            {t("Yerel haberler, sosyal medya paylaşımları ve resmi açıklamaları karşılaştırarak doğruluğunu gösterir.")}
          </p>
        </div>

        {/* Görünüm Modu Değiştirici */}
        <div className="flex items-center gap-1.5 bg-[#121624] p-1 rounded-lg border border-slate-700/80 shrink-0 font-mono text-xs">
          <button
            type="button"
            onClick={() => setViewMode("investigation")}
            data-testid="hub-toggle-verification"
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "investigation"
                ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>{t("Haber Doğrulama")}</span>
          </button>

          <button
            type="button"
            data-testid="hub-toggle-network"
            onClick={() => setViewMode("topology")}
            className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "topology"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>{t("13 İlçe Bağlantı Haritası")}</span>
          </button>
        </div>
      </div>

      {/* ── CANLI ÇAPRAZ SEKTÖR GELİŞMELERİ (Merkezi Store'dan otomatik yansır) ── */}
      {diagramEvents.length > 0 && (
        <div
          data-testid="diagram-live-signals"
          className="bg-[#0b0c14] border border-emerald-500/30 p-3 rounded-xl space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
              {isEn ? "Verified Cross-Sector Feed" : "Doğrulanmış Canlı Gelişmeler"}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {formatRelativeTime(diagramEvents[0].publishedAt, lang)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {diagramEvents.slice(0, 4).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-muted/20 border border-border/40 text-[10px] font-mono"
              >
                <div className="min-w-0">
                  <span className="text-primary font-bold uppercase mr-1.5">[{ev.district}]</span>
                  {ev.sourceUrl ? (
                    <a
                      href={ev.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground/90 hover:text-primary hover:underline truncate inline"
                    >
                      {translate(ev.title)}
                    </a>
                  ) : (
                    <span className="text-foreground/90">{translate(ev.title)}</span>
                  )}
                </div>
                <span className="shrink-0 text-[8px] text-muted-foreground">
                  {ev.sourceName} · {formatRelativeTime(ev.publishedAt, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MOD A: SORGU ODASI & KULİS-MEDYA İLİŞKİ AĞI ── */}
      {viewMode === "investigation" ? (
        <div className="space-y-4">
          {/* 1. Sorgu Odası Konsolu (Soru sor, teyit et, transkripti gör) */}
          <InterrogationRoomConsole
            onHighlightInvestigation={handleHighlight}
          />

          {/* 2. Dedektif Panosu (Kırmızı İpler, Gazete Küpürleri, Kulisler) */}
          <InvestigationGraph
            selectedDossierId={selectedDossierId}
            onSelectDossier={handleSelectDossier}
            highlightedNodeIds={highlightedNodeIds}
            highlightedLinkIds={highlightedLinkIds}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>
      ) : (
        /* ── MOD B: 13 İLÇE KENTSEL ALTYAPI TOPOLOJİSİ & FAZ 4 KRİZ PROTOKOLÜ ── */
        <div className="space-y-4">
          <MuglaNetworkDiagram />
        </div>
      )}
    </div>
  );
};
