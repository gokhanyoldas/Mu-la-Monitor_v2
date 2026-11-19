// src/components/investigation/InvestigationGraph.tsx
// Muğla İstihbarat & Dedektif Masası İlişki Ağı (Investigation Corkboard Graph)
// Kulis dedikoduları, yerel haberler, sosyal medya iddiaları ve resmi teyitler arasındaki kırmızı ipler.

import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  INVESTIGATION_NODES,
  INVESTIGATION_LINKS,
  INVESTIGATION_DOSSIERS,
  NODE_TYPE_CONFIG,
  RELATION_LABELS,
} from "@/data/investigationData";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import {
  Search,
  Filter,
  Flame,
  Radio,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Share2,
  Eye,
  Maximize2,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface InvestigationGraphProps {
  selectedDossierId?: string | null;
  onSelectDossier?: (dossierId: string) => void;
  highlightedNodeIds?: string[];
  highlightedLinkIds?: string[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  className?: string;
}

export const InvestigationGraph: React.FC<InvestigationGraphProps> = ({
  selectedDossierId,
  onSelectDossier,
  highlightedNodeIds = [],
  highlightedLinkIds = [],
  selectedNodeId,
  onSelectNode,
  className = ""
}) => {
  const {
    dynamicDossiers,
    dynamicInvestigationNodes,
    dynamicInvestigationLinks,
  } = useUnifiedIntelligence();

  const allNodes = useMemo(
    () => [...INVESTIGATION_NODES, ...dynamicInvestigationNodes],
    [dynamicInvestigationNodes]
  );
  const allLinks = useMemo(
    () => [...INVESTIGATION_LINKS, ...dynamicInvestigationLinks],
    [dynamicInvestigationLinks]
  );
  const allDossiers = useMemo(
    () => [...dynamicDossiers, ...INVESTIGATION_DOSSIERS],
    [dynamicDossiers]
  );

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [activeFilterType, setActiveFilterType] = useState<string | null>(null);

  // Sürüklenebilir Düğüm Konumları
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const init: Record<string, { x: number; y: number }> = {};
    allNodes.forEach((n) => {
      init[n.id] = { x: n.x, y: n.y };
    });
    return init;
  });

  useEffect(() => {
    setNodePositions((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const n of allNodes) {
        if (!next[n.id]) {
          next[n.id] = { x: n.x, y: n.y };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allNodes]);

  const draggingNodeRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Düğüm veya Bağlantı Odağı
  const activeFocusNodeId = hoveredNodeId || selectedNodeId;

  // Filtrelenmiş Düğümler
  const filteredNodes = useMemo(() => {
    if (!activeFilterType) return allNodes;
    return allNodes.filter((n) => n.type === activeFilterType);
  }, [activeFilterType, allNodes]);

  // Filtrelenmiş Bağlantılar
  const filteredLinks = useMemo(() => {
    return allLinks.filter((l) => {
      const srcExists = filteredNodes.some((n) => n.id === l.source);
      const tgtExists = filteredNodes.some((n) => n.id === l.target);
      return srcExists && tgtExists;
    });
  }, [filteredNodes, allLinks]);

  // Aktif düğümün doğrudan bağlı olduğu düğüm id'leri
  const connectedNodeIds = useMemo(() => {
    if (!activeFocusNodeId) return new Set<string>();
    const set = new Set<string>();
    set.add(activeFocusNodeId);
    allLinks.forEach((l) => {
      if (l.source === activeFocusNodeId) set.add(l.target);
      if (l.target === activeFocusNodeId) set.add(l.source);
    });
    return set;
  }, [activeFocusNodeId, allLinks]);

  // Fare Hareketleri (Düğüm Sürükleme)
  const handleMouseDown = (nodeId: string) => {
    draggingNodeRef.current = nodeId;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    // SVG viewBox: -450, -320, 900, 640
    const scaleX = 900 / rect.width;
    const scaleY = 640 / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX - 450;
    const mouseY = (e.clientY - rect.top) * scaleY - 320;

    setNodePositions((prev) => ({
      ...prev,
      [draggingNodeRef.current!]: { x: Math.round(mouseX), y: Math.round(mouseY) }
    }));
  };

  const handleMouseUp = () => {
    draggingNodeRef.current = null;
  };

  const handleResetPositions = () => {
    const init: Record<string, { x: number; y: number }> = {};
    allNodes.forEach((n) => {
      init[n.id] = { x: n.x, y: n.y };
    });
    setNodePositions(init);
  };

  const activeHoveredLink = hoveredLinkId
    ? allLinks.find((l) => l.id === hoveredLinkId)
    : null;

  const activeFocusedNodeData = activeFocusNodeId
    ? allNodes.find((n) => n.id === activeFocusNodeId)
    : null;

  return (
    <div className={`rounded-xl border border-rose-950/60 bg-[#07090f] overflow-hidden shadow-2xl relative select-none ${className}`}>
      
      {/* ── Üst Dedektif Masası Kontrol Barı ── */}
      <div className="p-3 border-b border-rose-950/50 bg-[#0d0914] flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <h3 className="text-sm sm:text-base font-bold font-mono tracking-wide text-rose-100 flex items-center gap-2">
              <span>İstihbarat & Dedektif Masası İlişki Ağı</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                CANLI OSINT DİYAGRAMI
              </span>
            </h3>
          </div>
          <p className="text-xs text-rose-300/70 mt-0.5 font-sans">
            Kulis fısıltıları, yerel manşetler, sosyal medya köpürtmeleri ve resmi tutanaklar arasındaki kırmızı kanıt ipleri
          </p>
        </div>

        {/* Dosya Hızlı Filtreleri & Sıfırla */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetPositions}
            className="h-7 text-xs gap-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="Düğümleri İlk Konumuna Getir"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Sıfırla</span>
          </Button>

          {allDossiers.map((dossier) => {
            const isSelected = selectedDossierId === dossier.id;
            const isDyn = dossier.code.startsWith("ODİT-");
            return (
              <button
                key={dossier.id}
                type="button"
                onClick={() => onSelectDossier && onSelectDossier(isSelected ? "" : dossier.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? "bg-rose-600 text-white border-rose-400 font-bold shadow-lg shadow-rose-900/30 scale-105"
                    : isDyn
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:border-emerald-400"
                    : "bg-[#160d1f] text-rose-200/80 border-rose-900/40 hover:border-rose-500/60 hover:text-white"
                }`}
              >
                <span>{`${dossier.districtName}: ${dossier.category}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Düğüm Türü Lejant / Filtre Çubuğu ── */}
      <div className="px-3 py-1.5 border-b border-rose-950/40 bg-[#09060d] flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-rose-400" /> Düğüm Türü:
          </span>
          <button
            type="button"
            onClick={() => setActiveFilterType(null)}
            className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer border ${
              activeFilterType === null
                ? "bg-rose-600 text-white border-rose-400 font-bold"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            Tümü ({allNodes.length})
          </button>
          {Object.entries(NODE_TYPE_CONFIG).map(([key, config]) => {
            const count = allNodes.filter((n) => n.type === key).length;
            const isSelected = activeFilterType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilterType(isSelected ? null : key)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-slate-800 text-white font-bold"
                    : "bg-[#110c17] text-slate-300 border-rose-950/60 hover:border-rose-800"
                }`}
                style={{ borderColor: isSelected ? config.color : undefined }}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-400 hidden lg:flex items-center gap-2">
          <span className="text-rose-400 font-bold">● Kırmızı İpler:</span> Çapraz Teyit & İddia Zinciri
          <span className="text-amber-400 font-bold">-- Kesikli İpler:</span> Çelişki / Yalanlama
        </div>
      </div>

      {/* ── İNTERAKTİF DEDEKTİF PANOSU SVG TUVALİ ── */}
      <div className="relative w-full h-[620px] lg:h-[680px] overflow-hidden select-none bg-radial from-[#150a18] via-[#09040c] to-[#040106]">
        
        {/* Mantar Pano Doku Ağı (Grid / Crosshair izleri) */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle, #e11d48 1px, transparent 1px)`,
            backgroundSize: "28px 28px"
          }}
        />

        <svg
          ref={svgRef}
          viewBox="-450 -320 900 640"
          className="w-full h-full cursor-grab active:cursor-grabbing relative z-10"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Çizgi Marker Okları */}
          <defs>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#e11d48" />
            </marker>
            <marker id="arrow-amber" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
            </marker>
            <marker id="arrow-emerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
            </marker>
          </defs>

          {/* 1. BAĞLANTI İPLERİ (KIRMIZI DEDEKTİF İPLERİ & İLİŞKİLER) */}
          <g className="links">
            {filteredLinks.map((link) => {
              const srcPos = nodePositions[link.source];
              const tgtPos = nodePositions[link.target];
              if (!srcPos || !tgtPos) return null;

              const isHighlighted = highlightedLinkIds.includes(link.id);
              const isDirectlyFocused =
                hoveredLinkId === link.id ||
                (activeFocusNodeId && (link.source === activeFocusNodeId || link.target === activeFocusNodeId));

              const isFaded =
                (selectedDossierId || activeFocusNodeId || highlightedLinkIds.length > 0) &&
                !isHighlighted &&
                !isDirectlyFocused;

              const relConfig = RELATION_LABELS[link.relation] || { color: "#e11d48", style: "solid" };
              const strokeColor = isDirectlyFocused ? "#ffffff" : link.isContradiction ? "#fbbf24" : relConfig.color;
              const strokeWidth = isDirectlyFocused ? 2.8 : isHighlighted ? 2.2 : 1.5;
              const strokeOpacity = isFaded ? 0.12 : isDirectlyFocused ? 1 : 0.85;

              // İpin orta noktası (Etiket konumu)
              const midX = (srcPos.x + tgtPos.x) / 2;
              const midY = (srcPos.y + tgtPos.y) / 2;

              return (
                <g key={link.id}>
                  {/* Kalın Görünmez Tıklama Çizgisi */}
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke="transparent"
                    strokeWidth={16}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                  />

                  {/* Kırmızı Dedektif İpi */}
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    strokeDasharray={relConfig.style === "dashed" || link.isContradiction ? "5, 4" : undefined}
                    className="transition-all duration-200 pointer-events-none"
                    markerEnd={link.isContradiction ? "url(#arrow-amber)" : "url(#arrow-red)"}
                  />

                  {/* Orta Nokta Çelişki / İlişki Rozeti */}
                  {(isDirectlyFocused || isHighlighted || link.isContradiction) && (
                    <g transform={`translate(${midX}, ${midY})`} className="pointer-events-none">
                      <rect
                        x="-45"
                        y="-9"
                        width="90"
                        height="18"
                        rx="4"
                        fill="#0b0612"
                        stroke={link.isContradiction ? "#f59e0b" : strokeColor}
                        strokeWidth="1"
                        opacity={isFaded ? 0.2 : 0.95}
                      />
                      <text
                        textAnchor="middle"
                        y="3.5"
                        fontSize="9"
                        fill={link.isContradiction ? "#fbbf24" : "#ffffff"}
                        fontFamily="monospace"
                        fontWeight="bold"
                        opacity={isFaded ? 0.2 : 1}
                      >
                        {link.label.slice(0, 14)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 2. DÜĞÜMLER (KARTLAR, PİNLER, BELGELER) */}
          <g className="nodes">
            {filteredNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isHighlighted = highlightedNodeIds.includes(node.id);
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isConnected = connectedNodeIds.has(node.id);
              const isFocused = isSelected || isHovered || isHighlighted;

              const isFaded =
                (selectedDossierId || activeFocusNodeId || highlightedNodeIds.length > 0) &&
                !isFocused &&
                !isConnected;

              const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.kulis_dedikodu;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer select-none transition-all duration-200"
                  style={{ opacity: isFaded ? 0.18 : 1 }}
                  onMouseDown={() => handleMouseDown(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => {
                    const next = selectedNodeId === node.id ? null : node.id;
                    if (onSelectNode) onSelectNode(next);
                  }}
                >
                  {/* Odak Halkası (Yanıp Sönen Dedektif Vurgusu) */}
                  {isFocused && (
                    <circle
                      r="24"
                      fill="none"
                      stroke={config.color}
                      strokeWidth="2.5"
                      strokeOpacity="0.8"
                      strokeDasharray="4, 3"
                      className="animate-spin"
                    />
                  )}

                  {/* Arka Plan Rozet / Kart */}
                  <rect
                    x="-75"
                    y="-22"
                    width="150"
                    height="44"
                    rx="8"
                    fill="#100b17"
                    stroke={isFocused ? "#ffffff" : config.color}
                    strokeWidth={isFocused ? 2 : 1.2}
                    className="shadow-xl"
                  />

                  {/* İkon Dairesi (Sol Taraf) */}
                  <circle cx="-54" cy="0" r="13" fill="#1e122b" stroke={config.color} strokeWidth="1" />
                  <text textAnchor="middle" x="-54" y="4" fontSize="13">
                    {config.icon}
                  </text>

                  {/* Üst Rozet (Tür) */}
                  <text
                    x="-35"
                    y="-7"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill={config.color}
                  >
                    {config.badge}
                  </text>

                  {/* Başlık Metni */}
                  <text
                    x="-35"
                    y="7"
                    fontSize="10"
                    fontFamily="sans-serif"
                    fontWeight="bold"
                    fill={isFocused ? "#ffffff" : "#fcdcd4"}
                  >
                    {node.title.length > 17 ? `${node.title.slice(0, 16)}…` : node.title}
                  </text>

                  {/* Güvenilirlik / Doğruluk Skoru Rozeti (Sağ Alt) */}
                  <rect
                    x="42"
                    y="4"
                    width="26"
                    height="12"
                    rx="3"
                    fill={node.credibilityScore > 75 ? "#064e3b" : node.credibilityScore > 40 ? "#78350f" : "#881337"}
                    stroke={node.credibilityScore > 75 ? "#10b981" : node.credibilityScore > 40 ? "#f59e0b" : "#f43f5e"}
                    strokeWidth="0.8"
                  />
                  <text
                    x="55"
                    y="13"
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#ffffff"
                  >
                    %{node.credibilityScore}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── ALT İSTİHBARAT BİLGİ KARTI (Hover & Seçim İpucu) ── */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 p-3 rounded-xl bg-black/80 backdrop-blur-xl border border-rose-950/80 text-white text-xs font-mono shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 z-20">
          {activeHoveredLink ? (
            /* Bir İpin / İlişkinin Üzerindeyken */
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-400">🧵 İLİŞKİ TESPİTİ:</span>
                <span className="text-white font-bold">{activeHoveredLink.label}</span>
                <span className="text-[10px] text-amber-300">Güvenilirlik: %{activeHoveredLink.confidence}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 truncate font-sans italic">
                "{activeHoveredLink.evidenceQuote}"
              </p>
            </div>
          ) : activeFocusedNodeData ? (
            /* Bir Düğümün Üzerindeyken */
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{NODE_TYPE_CONFIG[activeFocusedNodeData.type].icon}</span>
                <span className="font-bold text-white tracking-wide">{activeFocusedNodeData.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  activeFocusedNodeData.status === "dogrulandi" 
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                    : activeFocusedNodeData.status === "yalanlandi"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                }`}>
                  {activeFocusedNodeData.status.toUpperCase()}
                </span>
                <span className="text-[10px] text-slate-400">Kaynak: {activeFocusedNodeData.source}</span>
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5 truncate font-sans">
                {activeFocusedNodeData.claimSummary}
              </p>
            </div>
          ) : (
            /* Boştayken İpucu */
            <div className="flex items-center gap-2 text-rose-200/80 text-[11px] font-sans">
              <Info className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>Sorgu Odası Dedektif Masası:</strong> Düğümlere veya kırmızı iplere tıklayarak iddiaların kaynağını ve resmi çelişkileri inceleyin. İlgili dosyayı odaklamak için üstteki vaka butonlarını kullanın.
              </span>
            </div>
          )}

          {selectedNodeId && (
            <div className="shrink-0 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectNode && onSelectNode(null)}
                className="h-7 text-xs font-mono bg-black/40 hover:bg-black/60 text-slate-300 border-white/20 cursor-pointer"
              >
                Vurguyu Kaldır
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
