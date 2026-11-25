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

export const InvestigationHub: React.FC = () => {
  const { dynamicDossiers, activeDynamicDossierId, setActiveDynamicDossierId } = useUnifiedIntelligence();
  const { t } = useTranslation();
  // Görünüm Modu: "investigation" (Sorgu Odası & Kulis Ağı) veya "topology" (13 İlçe Kentsel Altyapı Ağı)
  const [viewMode, setViewMode] = useState<"investigation" | "topology">("investigation");
  
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
            <span className="inline-flex items-center rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300">ÖRNEK / DEMO AKIŞI</span>
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
