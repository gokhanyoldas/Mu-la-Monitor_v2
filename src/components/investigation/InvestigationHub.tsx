// src/components/investigation/InvestigationHub.tsx
// Muğla Haber Doğrulama & Canlı İlişki Diyagramı Merkezi
// Yalnızca gerçek Supabase (`social_posts`, `protocol_members`, `alert_events`) ve
// merkezi store verilerini kullanır; hiçbir sahte DEMO içerik barındırmaz.

import React, { useState, useEffect, useMemo } from "react";
import { InvestigationGraph } from "@/components/investigation/InvestigationGraph";
import { InterrogationRoomConsole } from "@/components/investigation/InterrogationRoomConsole";
import { MuglaNetworkDiagram } from "@/components/dashboard/MuglaNetworkDiagram";
import { Radio, Network, FileSearch } from "lucide-react";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import { PanelHelpTooltip } from "@/components/dashboard/PanelHelpTooltip";
import {
  useMonitorStore,
  selectDiagramEvents,
  selectSocialFeed,
  selectProtocolMembers,
} from "@/store/useMonitorStore";
import { formatRelativeTime } from "@/lib/time-utils";
import {
  fetchLiveDiagramSources,
  buildLiveDiagramGraph,
  type LiveAlertRecord,
} from "@/services/liveDiagramBuilder";

export type InvestigationHubView = "verification" | "protocol_network";

export const InvestigationHub: React.FC<{ initialView?: InvestigationHubView }> = ({
  initialView = "verification",
}) => {
  const { dynamicDossiers, activeDynamicDossierId, setActiveDynamicDossierId } =
    useUnifiedIntelligence();
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const diagramEvents = useMonitorStore(selectDiagramEvents);
  const socialFeed = useMonitorStore(selectSocialFeed);
  const storeProtocol = useMonitorStore(selectProtocolMembers);

  const [viewMode, setViewMode] = useState<"investigation" | "topology">(
    initialView === "protocol_network" ? "topology" : "investigation"
  );

  const storeProtocolList = useMemo(
    () => (Array.isArray(storeProtocol) ? storeProtocol : []),
    [storeProtocol]
  );
  const storePostsList = useMemo(
    () => (Array.isArray(socialFeed?.items) ? socialFeed.items : []),
    [socialFeed?.items]
  );

  const [fetchedPosts, setFetchedPosts] = useState(storePostsList);
  const [fetchedAlerts, setFetchedAlerts] = useState<LiveAlertRecord[]>([]);
  const [fetchedProtocol, setFetchedProtocol] = useState(storeProtocolList);

  useEffect(() => {
    let active = true;
    fetchLiveDiagramSources().then((res) => {
      if (!active) return;
      if (Array.isArray(res?.posts) && res.posts.length > 0) setFetchedPosts(res.posts);
      if (Array.isArray(res?.alerts) && res.alerts.length > 0) setFetchedAlerts(res.alerts);
      if (Array.isArray(res?.protocolMembers) && res.protocolMembers.length > 0) {
        setFetchedProtocol(res.protocolMembers);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const mergedPosts = useMemo(
    () => (fetchedPosts.length > 0 ? fetchedPosts : storePostsList),
    [fetchedPosts, storePostsList]
  );
  const mergedProtocol = useMemo(
    () => (fetchedProtocol.length > 0 ? fetchedProtocol : storeProtocolList),
    [fetchedProtocol, storeProtocolList]
  );

  const liveDataset = useMemo(
    () =>
      buildLiveDiagramGraph({
        posts: mergedPosts,
        alerts: fetchedAlerts,
        protocolMembers: mergedProtocol,
        diagramEvents: Array.isArray(diagramEvents) ? diagramEvents : [],
      }),
    [mergedPosts, fetchedAlerts, mergedProtocol, diagramEvents]
  );

  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<string[]>([]);

  const allDossiers = useMemo(
    () => [...dynamicDossiers, ...liveDataset.dossiers],
    [dynamicDossiers, liveDataset.dossiers]
  );

  useEffect(() => {
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
    if (dossierId !== undefined) {
      setSelectedDossierId(dossierId || null);
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
                {isEn
                  ? `${diagramEvents.length} VERIFIED SIGNALS`
                  : `${diagramEvents.length} DOĞRULANMIŞ GELİŞME`}
              </span>
            )}
            <PanelHelpTooltip panelTitle="Haber Doğrulama Merkezi" />
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            {t(
              "Yerel haberler, sosyal medya paylaşımları, resmi uyarılar ve il protokolü kayıtları arasındaki gerçek ilişkileri gösterir."
            )}
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

      {/* ── MOD A: CANLI HABER DOĞRULAMA & İLİŞKİ AĞI ── */}
      {viewMode === "investigation" ? (
        <div className="space-y-4">
          <InterrogationRoomConsole
            dataset={liveDataset}
            onHighlightInvestigation={handleHighlight}
          />

          <InvestigationGraph
            liveNodes={liveDataset.nodes}
            liveLinks={liveDataset.links}
            liveDossiers={liveDataset.dossiers}
            selectedDossierId={selectedDossierId}
            onSelectDossier={handleSelectDossier}
            highlightedNodeIds={highlightedNodeIds}
            highlightedLinkIds={highlightedLinkIds}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <MuglaNetworkDiagram />
        </div>
      )}
    </div>
  );
};
