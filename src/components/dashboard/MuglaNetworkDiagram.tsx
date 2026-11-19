// src/components/dashboard/MuglaNetworkDiagram.tsx
// Muğla 13 İlçe Veri & Altyapı İlişki Ağ Diyagramı (Network Relationship Topology)
// Kullanıcının paylaştığı Hamlet ilişki ağı şeması tarzında, merkez odaklı, düz ve kesikli bağlantılı interaktif grafik.

import React, { useState, useRef, useMemo } from "react";
import {
  MUGLA_NETWORK_NODES,
  MUGLA_NETWORK_LINKS,
  LINK_TYPE_COLORS,
  NetworkNode,
  NetworkLink
} from "@/data/muglaNetworkData";
import {
  Network,
  Palette,
  Maximize2,
  Info,
  Filter,
  Flame,
  Droplets,
  Car,
  Plane,
  Activity,
  Layers,
  RotateCcw,
  ShieldAlert,
  Radio
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNodeCrisisChain } from "@/data/crisisProtocolChain";
import { CrisisProtocolDrawer } from "@/components/dashboard/CrisisProtocolDrawer";

interface MuglaNetworkDiagramProps {
  selectedDistrictId?: string | null;
  onSelectDistrict?: (districtId: string) => void;
  className?: string;
}

export const MuglaNetworkDiagram: React.FC<MuglaNetworkDiagramProps> = ({
  selectedDistrictId,
  onSelectDistrict,
  className = ""
}) => {
  // Tema Seçimi: "terracotta" (Kullanıcının paylaştığı resimdeki mercan/mor tonları) veya "dark" (Gece operasyon teması)
  const [theme, setTheme] = useState<"terracotta" | "dark">("terracotta");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [isCrisisDrawerOpen, setIsCrisisDrawerOpen] = useState<boolean>(false);

  const activeDistrictId = selectedDistrictId !== undefined ? selectedDistrictId : internalSelectedId;

  // Sürüklenebilir Düğümler Durumu (Drag & Drop)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const init: Record<string, { x: number; y: number }> = {};
    MUGLA_NETWORK_NODES.forEach((n) => {
      init[n.id] = { x: n.x, y: n.y };
    });
    return init;
  });

  const draggingNodeRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Filtrelenmiş Bağlantılar
  const filteredLinks = useMemo(() => {
    if (!selectedType) return MUGLA_NETWORK_LINKS;
    return MUGLA_NETWORK_LINKS.filter((l) => l.type === selectedType);
  }, [selectedType]);

  // Vurgulu Düğüm veya Bağlantı
  const activeFocusId = hoveredNodeId || activeDistrictId;

  // Aktif düğümün bağlı olduğu ilçeler
  const connectedNodeIds = useMemo(() => {
    if (!activeFocusId) return new Set<string>();
    const set = new Set<string>();
    set.add(activeFocusId);
    filteredLinks.forEach((l) => {
      if (l.source === activeFocusId) set.add(l.target);
      if (l.target === activeFocusId) set.add(l.source);
    });
    return set;
  }, [activeFocusId, filteredLinks]);

  // Faz 4: Kriz & Protokol Bilgileri
  const activeCrisisInfo = useMemo(() => {
    const targetId = activeDistrictId || (isCrisisDrawerOpen ? "mentese" : hoveredNodeId);
    if (!targetId) return null;
    return getNodeCrisisChain(targetId);
  }, [activeDistrictId, hoveredNodeId, isCrisisDrawerOpen]);

  // Aktif düğümün doğrudan bağlı olduğu komşu merkezler ve hat isimleri
  const activeConnectedNodes = useMemo(() => {
    const targetId = activeDistrictId || hoveredNodeId;
    if (!targetId) return [];
    const list: { id: string; name: string; relation: string; style: string }[] = [];
    MUGLA_NETWORK_LINKS.forEach((l) => {
      if (l.source === targetId) {
        const node = MUGLA_NETWORK_NODES.find((n) => n.id === l.target);
        if (node && !list.some(item => item.id === node.id)) {
          list.push({ id: node.id, name: node.name, relation: l.label, style: l.style });
        }
      } else if (l.target === targetId) {
        const node = MUGLA_NETWORK_NODES.find((n) => n.id === l.source);
        if (node && !list.some(item => item.id === node.id)) {
          list.push({ id: node.id, name: node.name, relation: l.label, style: l.style });
        }
      }
    });
    return list;
  }, [activeDistrictId, hoveredNodeId]);

  // Fare Olayları (Düğüm Sürükleme)
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

  // Pozisyonları Sıfırlama
  const handleResetPositions = () => {
    const reset: Record<string, { x: number; y: number }> = {};
    MUGLA_NETWORK_NODES.forEach((n) => {
      reset[n.id] = { x: n.x, y: n.y };
    });
    setNodePositions(reset);
  };

  // Tema Renkleri
  const isTerracotta = theme === "terracotta";
  const styles = isTerracotta
    ? {
        bg: "bg-[#cf634c]",
        borderColor: "border-[#b5503b]",
        panelBg: "bg-[#b8513b]/90",
        nodeText: "#380f2b",
        nodeTextActive: "#1f0318",
        lineColor: "#4f163e",
        lineActive: "#1a0314",
        subText: "text-[#fad4cc]",
        badgeBg: "bg-[#4f163e] text-[#fcdcd4]"
      }
    : {
        bg: "bg-[#090d16]",
        borderColor: "border-slate-800",
        panelBg: "bg-[#0e1626]/95",
        nodeText: "#94a3b8",
        nodeTextActive: "#ffffff",
        lineColor: "#334155",
        lineActive: "#38bdf8",
        subText: "text-slate-400",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
      };

  const activeHoveredLinkData = hoveredLinkId
    ? MUGLA_NETWORK_LINKS.find((l) => l.id === hoveredLinkId)
    : null;

  const activeNodeData = activeFocusId
    ? MUGLA_NETWORK_NODES.find((n) => n.id === activeFocusId)
    : null;

  return (
    <div className={`rounded-xl border ${styles.borderColor} ${styles.bg} overflow-hidden shadow-2xl transition-colors duration-300 ${className}`}>
      
      {/* ── Üst Kontrol Barı ── */}
      <div className={`p-3.5 border-b ${styles.borderColor} flex flex-col md:flex-row items-start md:items-center justify-between gap-3 backdrop-blur-sm`}>
        <div>
          <div className="flex items-center gap-2">
            <Network className={`w-5 h-5 ${isTerracotta ? "text-[#3b0b29]" : "text-emerald-400"}`} />
            <h3 className={`text-sm sm:text-base font-bold font-mono tracking-wide ${isTerracotta ? "text-[#2e0620]" : "text-white"}`}>
              Muğla Veri Bütünlüğü & İlçe Bağımlılık Ağ Diyagramı
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${styles.badgeBg}`}>
              TOPOLOJİ DİYAGRAMI
            </span>
          </div>
          <p className={`text-xs mt-1 font-sans ${isTerracotta ? "text-[#fce5df]" : "text-slate-300"}`}>
            13 ilçe arasındaki su isale hatları, ulaşım koridorları, turizm transferleri ve afet yayılım eksenleri
          </p>
        </div>

        {/* Aksiyon Butonları: Kriz Protokolü (Faz 4), Tema & Sıfırla */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono shrink-0">
          <Button
            size="sm"
            onClick={() => {
              if (!activeDistrictId) {
                setInternalSelectedId("mentese");
              }
              setIsCrisisDrawerOpen(!isCrisisDrawerOpen);
            }}
            className={`text-xs gap-1.5 cursor-pointer font-bold border transition-all ${
              isCrisisDrawerOpen
                ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md"
                : isTerracotta
                ? "bg-[#4f163e] text-[#fcdcd4] border-[#380f2b] hover:bg-[#380f2b]"
                : "bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-700 hover:border-amber-400"
            }`}
            title="İlçelerin Mülki İdare Amiri ve Kriz Komuta Zincirini Görüntüle"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
            <span>Kriz Protokolü {isCrisisDrawerOpen ? "(Açık)" : ""}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setTheme(isTerracotta ? "dark" : "terracotta")}
            className={`text-xs gap-1.5 cursor-pointer font-bold border ${
              isTerracotta
                ? "bg-[#4f163e] text-[#fcdcd4] border-[#380f2b] hover:bg-[#380f2b]"
                : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{isTerracotta ? "Koyu Tema" : "Klasik Terracotta"}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetPositions}
            className={`text-xs gap-1 cursor-pointer ${isTerracotta ? "text-[#fce5df] hover:bg-[#4f163e]/40" : "text-slate-300 hover:bg-slate-800"}`}
            title="Düğüm Konumlarını İlk Haline Getir"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sıfırla</span>
          </Button>
        </div>
      </div>

      {/* ── İlişki Türü Filtre Butonları (Lejant) ── */}
      <div className={`px-3 py-2 border-b ${styles.borderColor} flex flex-wrap items-center justify-between gap-2 text-xs font-mono`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[10px] flex items-center gap-1 mr-1 ${isTerracotta ? "text-[#fce5df]" : "text-slate-400"}`}>
            <Filter className="w-3 h-3" /> Ağ Katmanı:
          </span>
          <button
            type="button"
            onClick={() => setSelectedType(null)}
            className={`px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
              selectedType === null
                ? isTerracotta
                  ? "bg-[#380f2b] text-white border-[#26051c] font-bold"
                  : "bg-emerald-600 text-white border-emerald-500 font-bold"
                : isTerracotta
                ? "bg-[#ba543e] text-[#fcdcd4] border-[#9e4330] hover:bg-[#a64733]"
                : "bg-slate-900 text-slate-300 border-slate-700 hover:text-white"
            }`}
          >
            Tüm İlişkiler ({MUGLA_NETWORK_LINKS.length})
          </button>

          {Object.entries(LINK_TYPE_COLORS).map(([key, config]) => {
            const isSelected = selectedType === key;
            const count = MUGLA_NETWORK_LINKS.filter((l) => l.type === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedType(isSelected ? null : key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer border ${
                  isSelected
                    ? isTerracotta
                      ? "bg-[#380f2b] text-white border-white font-bold"
                      : "bg-slate-800 text-white border-cyan-400 font-bold"
                    : isTerracotta
                    ? "bg-[#ba543e] text-[#fcdcd4] border-[#9e4330] hover:bg-[#a64733]"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:text-white"
                }`}
              >
                <span
                  className="w-3.5 h-0.5 inline-block"
                  style={{
                    backgroundColor: isTerracotta ? "#ffffff" : config.color,
                    borderTop: config.dash ? "1px dashed" : "none"
                  }}
                />
                <span>{config.label}</span>
                <span className="opacity-75 font-mono text-[9px]">({count})</span>
              </button>
            );
          })}
        </div>

        <div className={`text-[10px] hidden sm:block ${isTerracotta ? "text-[#fce5df]" : "text-slate-400"}`}>
          <span>Düz Çizgi: Doğrudan Altyapı/Koridor · Kesikli Çizgi: Lojistik/Afet/Fay Hattı</span>
        </div>
      </div>

      {/* ── İNTERAKTİF SVG AĞ ALANI ── */}
      <div className="relative w-full h-[620px] lg:h-[720px] overflow-hidden select-none">
        
        {/* SVG Çizim Tuvali */}
        <svg
          ref={svgRef}
          viewBox="-450 -320 900 640"
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Çizgi Stilleri & Markerlar */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={isTerracotta ? "#4f163e" : "#38bdf8"} />
            </marker>
          </defs>

          {/* 1. BAĞLANTI ÇİZGİLERİ (EDGES) */}
          <g className="links">
            {filteredLinks.map((link) => {
              const srcPos = nodePositions[link.source];
              const tgtPos = nodePositions[link.target];
              if (!srcPos || !tgtPos) return null;

              const isLinkActive =
                hoveredLinkId === link.id ||
                (activeFocusId && (link.source === activeFocusId || link.target === activeFocusId));

              const isLinkFaded = activeFocusId && !isLinkActive;

              const config = LINK_TYPE_COLORS[link.type] || { color: "#94a3b8", dash: false };

              const strokeColor = isTerracotta
                ? isLinkActive
                  ? "#14010e"
                  : "#4a1236"
                : isLinkActive
                ? config.color
                : styles.lineColor;

              const strokeWidth = isLinkActive ? (isTerracotta ? 2.5 : 2.5) : (isTerracotta ? 1.4 : 1.2);
              const strokeOpacity = isLinkFaded ? 0.12 : isLinkActive ? 1 : (isTerracotta ? 0.75 : 0.65);

              return (
                <g key={link.id}>
                  {/* Görünmez Kalın Hover Çizgisi */}
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                  />
                  {/* Görünen Çizgi */}
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    strokeDasharray={link.style === "dashed" ? "5, 4" : undefined}
                    className="transition-all duration-200 pointer-events-none"
                  />
                </g>
              );
            })}
          </g>

          {/* 2. DÜĞÜMLER (NODES) & ETİKETLER */}
          <g className="nodes">
            {MUGLA_NETWORK_NODES.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isSelected = activeDistrictId === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isConnected = connectedNodeIds.has(node.id);
              const isFocused = isSelected || isHovered;

              const isFaded = activeFocusId && !isConnected;
              const isCenterHub = node.id === "mentese";

              // Düğüm Daire Boyutu
              const radius = isCenterHub ? 10 : node.category === "turizm_kiyisi" ? 8 : 6.5;

              const nodeColor = isTerracotta
                ? isFocused
                  ? "#1f0318"
                  : "#4a1236"
                : isFocused
                ? "#10b981"
                : isCenterHub
                ? "#38bdf8"
                : node.category === "turizm_kiyisi"
                ? "#ec4899"
                : node.category === "altyapi_hub"
                ? "#06b6d4"
                : "#64748b";

              const textColor = isTerracotta
                ? isFocused
                  ? "#14010e"
                  : "#380f2b"
                : isFocused
                ? "#ffffff"
                : styles.nodeText;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer select-none transition-opacity duration-200"
                  style={{ opacity: isFaded ? 0.2 : 1 }}
                  onMouseDown={() => handleMouseDown(node.id)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => {
                    const next = activeDistrictId === node.id ? null : node.id;
                    setInternalSelectedId(next);
                    if (next) {
                      setIsCrisisDrawerOpen(true);
                    }
                    if (onSelectDistrict && next) onSelectDistrict(next);
                  }}
                >
                  {/* Merkez Düğüm Dairesi veya Vurgu Halkası */}
                  {isFocused && (
                    <circle
                      r={radius + 6}
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth={2}
                      strokeOpacity={0.6}
                      strokeDasharray="3, 3"
                      className="animate-spin"
                    />
                  )}

                  <circle
                    r={radius}
                    fill={nodeColor}
                    stroke={isTerracotta ? "#d96b52" : "#090d16"}
                    strokeWidth={2.5}
                  />

                  {/* Düğüm Etiketi (Kullanıcının paylaştığı resimdeki tipografi tarzı) */}
                  <text
                    x={0}
                    y={radius + 14}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={isCenterHub ? "13px" : "11px"}
                    fontWeight={isFocused ? "bold" : isCenterHub ? "700" : "500"}
                    fontFamily="inherit"
                    className="pointer-events-none drop-shadow-sm"
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* ── ALT BİLGİ VE ETKİLEŞİM KARTI (Açıklama Paneli) ── */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-mono shadow-2xl">
          {activeHoveredLinkData ? (
            /* Bir Bağlantının Üzerindeyken */
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-cyan-300">🔗 {activeHoveredLinkData.label}</span>
                <span className="text-[10px] text-slate-400">({activeHoveredLinkData.style === "solid" ? "Doğrudan Hat" : "Dolaylı Koridor"})</span>
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5 truncate font-sans">
                {activeHoveredLinkData.description}
              </p>
            </div>
          ) : activeNodeData ? (
            /* Bir İlçenin Üzerindeyken */
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{activeNodeData.emoji}</span>
                <span className="font-bold text-emerald-300">{activeNodeData.name}</span>
                <span className="text-[10px] text-slate-300">Risk: {activeNodeData.riskScore}/100</span>
                {activeNodeData.population && (
                  <span className="text-[10px] text-cyan-300">Nüfus: {activeNodeData.population}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5 truncate font-sans">
                {activeNodeData.role}
              </p>
            </div>
          ) : (
            /* Boştayken İpucu */
            <div className="flex items-center gap-2 text-slate-300 text-[11px] font-sans">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                İpucu: Düğümlerin veya çizgilerin üzerine gelerek bağımlılıkları inceleyebilir, ilçelere tıklayarak haritayla senkronize edebilir, düğümleri dilediğiniz gibi sürükleyebilirsiniz.
              </span>
            </div>
          )}

          {/* Aksiyon Butonları */}
          <div className="shrink-0 flex items-center gap-2">
            {activeCrisisInfo && (
              <Button
                size="sm"
                onClick={() => {
                  if (activeNodeData) setInternalSelectedId(activeNodeData.id);
                  setIsCrisisDrawerOpen(true);
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Kriz & Protokol Kadrosu</span>
              </Button>
            )}

            {activeDistrictId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInternalSelectedId(null);
                  setIsCrisisDrawerOpen(false);
                  if (onSelectDistrict) onSelectDistrict("");
                }}
                className="bg-black/40 hover:bg-black/60 text-slate-200 border-white/20 text-xs font-mono cursor-pointer"
              >
                <span>Seçimi Temizle</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── FAZ 4: KRİZ PROTOKOL & KOMUTA ZİNCİRİ YAN PANELİ ── */}
        {activeCrisisInfo && (
          <CrisisProtocolDrawer
            crisisInfo={activeCrisisInfo}
            isOpen={isCrisisDrawerOpen}
            onClose={() => setIsCrisisDrawerOpen(false)}
            isTerracotta={isTerracotta}
            connectedNodes={activeConnectedNodes}
            onSelectConnectedNode={(nodeId) => {
              setInternalSelectedId(nodeId);
              if (onSelectDistrict) onSelectDistrict(nodeId);
            }}
          />
        )}

      </div>
    </div>
  );
};
