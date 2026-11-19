import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GitBranch,
  Search,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  X,
  Network,
  ArrowRight,
  Loader2,
  RefreshCw,
  Layers,
  CalendarClock,
  Link2,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { PanelHelpTooltip } from "@/components/dashboard/PanelHelpTooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  INITIAL_PROTOCOL_NODES,
  INITIAL_PROTOCOL_LINKS,
  NODE_GROUP_META,
  LINK_RELATION_META,
  getFirstDegreeNeighborhood,
  matchesProtocolFilter,
  type ProtocolGraphNode,
  type ProtocolGraphLink,
  type ProtocolNodeGroup,
  type ProtocolFilterCategory,
  type ProtocolLinkRelation,
} from "@/data/protocolNetworkGraphData";
import {
  analyzeProtocolNodeWithGemini,
  type ProtocolGeminiAnalysisResult,
} from "@/services/protocolNetworkGeminiService";
import { useAuth } from "@/hooks/useAuth";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";

interface SimNode extends ProtocolGraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 760;

const FILTER_OPTIONS: { value: ProtocolFilterCategory; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "protokol", label: "Protokol" },
  { value: "ilce", label: "İlçeler" },
  { value: "olay", label: "Olaylar" },
];

const DISTRICT_CHOICES = [
  "Menteşe",
  "Bodrum",
  "Fethiye",
  "Marmaris",
  "Milas",
  "Seydikemer",
  "Ortaca",
  "Dalaman",
  "Köyceğiz",
  "Ula",
  "Yatağan",
  "Datça",
  "Kavaklıdere",
];

function computeInitialPositions(nodes: ProtocolGraphNode[]): SimNode[] {
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;

  const byGroup: Record<ProtocolNodeGroup, ProtocolGraphNode[]> = {
    protokol_merkez: [],
    paydas: [],
    ilce: [],
    olay: [],
  };

  for (const n of nodes) {
    byGroup[n.group].push(n);
  }

  const posMap = new Map<string, { x: number; y: number }>();

  // Merkez kurumlar iç halka
  byGroup.protokol_merkez.forEach((n, idx, arr) => {
    const angle = (idx / Math.max(arr.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const r = arr.length === 1 ? 0 : 115;
    posMap.set(n.id, {
      x: n.x ?? cx + Math.cos(angle) * r,
      y: n.y ?? cy + Math.sin(angle) * r,
    });
  });

  // Paydaşlar orta halka
  byGroup.paydas.forEach((n, idx, arr) => {
    const angle = (idx / Math.max(arr.length, 1)) * Math.PI * 2 + 0.35;
    const r = 215;
    posMap.set(n.id, {
      x: n.x ?? cx + Math.cos(angle) * r,
      y: n.y ?? cy + Math.sin(angle) * r,
    });
  });

  // 13 ilçe dış halka
  byGroup.ilce.forEach((n, idx, arr) => {
    const angle = (idx / Math.max(arr.length, 1)) * Math.PI * 2 - Math.PI / 3;
    const r = 305;
    posMap.set(n.id, {
      x: n.x ?? cx + Math.cos(angle) * r * 1.18,
      y: n.y ?? cy + Math.sin(angle) * r * 0.9,
    });
  });

  // Olaylar & gündem ara odak noktaları
  byGroup.olay.forEach((n, idx, arr) => {
    const angle = (idx / Math.max(arr.length, 1)) * Math.PI * 2 + Math.PI / 4;
    const r = 240;
    posMap.set(n.id, {
      x: n.x ?? cx + Math.cos(angle) * r * 1.12,
      y: n.y ?? cy + Math.sin(angle) * r * 0.85,
    });
  });

  return nodes.map((n) => {
    const pos = posMap.get(n.id) ?? { x: cx, y: cy };
    return {
      ...n,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    };
  });
}

export const ProtocolNetworkGraph: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const hub = useOptionalUnifiedIntelligence();
  const [nodes, setNodes] = useState<ProtocolGraphNode[]>(INITIAL_PROTOCOL_NODES);
  const [links, setLinks] = useState<ProtocolGraphLink[]>(INITIAL_PROTOCOL_LINKS);

  const getNodeAgendaLinks = useCallback(
    (node: ProtocolGraphNode) => {
      const agendaLinks = hub?.protocolAgendaLinks ?? [];
      if (agendaLinks.length === 0) return [];
      const nLow = node.label.toLocaleLowerCase("tr-TR");
      const dLow = (node.districtTag || "").toLocaleLowerCase("tr-TR");
      return agendaLinks.filter((al) => {
        const distMatch = dLow && al.districtName.toLocaleLowerCase("tr-TR") === dLow && (node.group === "ilce" || node.group === "olay");
        const mbbMatch = nLow.includes("büyükşehir") && al.actorTitle.toLocaleLowerCase("tr-TR").includes("büyükşehir");
        const valilikMatch = nLow.includes("valiliği") && al.actorTitle.toLocaleLowerCase("tr-TR").includes("vali");
        const actorMatch = nLow.includes(al.actorName.toLocaleLowerCase("tr-TR")) || nLow.includes(al.districtName.toLocaleLowerCase("tr-TR"));
        return Boolean(distMatch || mbbMatch || valilikMatch || actorMatch);
      });
    },
    [hub?.protocolAgendaLinks]
  );

  // Arama, filtre ve vurgu state'leri
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProtocolFilterCategory>("all");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("valilik");

  // Zoom & Pan transform
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Kuvvet simülasyonu state'i (mutable ref + tick counter ile yüksek FPS)
  const simNodesRef = useRef<SimNode[]>(computeInitialPositions(INITIAL_PROTOCOL_NODES));
  const alphaRef = useRef<number>(1);
  const [, setRenderTick] = useState(0);

  // Sürükleme takibi
  const dragStateRef = useRef<{
    type: "node" | "pan" | null;
    nodeId?: string;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  }>({
    type: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });

  // Gemini analiz state'i
  const [analysisMap, setAnalysisMap] = useState<Record<string, ProtocolGeminiAnalysisResult>>({});
  const [analyzingNodeId, setAnalyzingNodeId] = useState<string | null>(null);

  // Yeni düğüm/bağlantı ekleme modalı
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<"node" | "link">("node");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeGroup, setNewNodeGroup] = useState<ProtocolNodeGroup>("olay");
  const [newNodeRole, setNewNodeRole] = useState("");
  const [newNodeDistrict, setNewNodeDistrict] = useState("Bodrum");
  const [newNodeEventCount, setNewNodeEventCount] = useState(5);
  const [newLinkSource, setNewLinkSource] = useState("valilik");
  const [newLinkTarget, setNewLinkTarget] = useState("ilce_bodrum");
  const [newLinkRelation, setNewLinkRelation] =
    useState<ProtocolLinkRelation>("Protokol Koordinasyonu");
  const [newLinkWeight, setNewLinkWeight] = useState(4);

  // Görünür düğüm ve bağlantılar
  const visibleNodes = useMemo(
    () => nodes.filter((n) => matchesProtocolFilter(n, categoryFilter)),
    [nodes, categoryFilter]
  );

  const visibleNodeIdSet = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );

  const visibleLinks = useMemo(
    () =>
      links.filter(
        (l) => visibleNodeIdSet.has(l.source) && visibleNodeIdSet.has(l.target)
      ),
    [links, visibleNodeIdSet]
  );

  // Arama eşleşmeleri
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("tr-TR");
  const matchedSearchIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>();
    const ids = new Set<string>();
    for (const n of visibleNodes) {
      const hay = `${n.label} ${n.role} ${n.districtTag ?? ""}`.toLocaleLowerCase("tr-TR");
      if (hay.includes(normalizedQuery)) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [visibleNodes, normalizedQuery]);

  // Seçili düğüm görünür filtreden çıktıysa temizle
  useEffect(() => {
    if (selectedNodeId && !visibleNodeIdSet.has(selectedNodeId)) {
      setSelectedNodeId(visibleNodes[0]?.id ?? null);
    }
  }, [selectedNodeId, visibleNodeIdSet, visibleNodes]);

  // nodes değiştiğinde simülasyon dizisini senkronize et (mevcut koordinatları koru)
  useEffect(() => {
    const existingMap = new Map(simNodesRef.current.map((s) => [s.id, s]));
    const freshDefaults = computeInitialPositions(nodes);
    simNodesRef.current = freshDefaults.map((fresh) => {
      const prev = existingMap.get(fresh.id);
      if (prev) {
        return {
          ...fresh,
          x: prev.x,
          y: prev.y,
          vx: prev.vx,
          vy: prev.vy,
          fx: prev.fx,
          fy: prev.fy,
        };
      }
      return fresh;
    });
    alphaRef.current = 0.85;
  }, [nodes]);

  // Kuvvet Yönlendirmeli Fizik Motoru (requestAnimationFrame)
  useEffect(() => {
    let rafId = 0;
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    const step = () => {
      const simNodes = simNodesRef.current;
      const activeNodes = simNodes.filter((n) => visibleNodeIdSet.has(n.id));
      const alpha = alphaRef.current;

      if (alpha > 0.005 && activeNodes.length > 0) {
        const nodeMap = new Map(activeNodes.map((n) => [n.id, n]));

        // 1. Coulomb itme kuvveti + çarpışma önleme
        for (let i = 0; i < activeNodes.length; i++) {
          const a = activeNodes[i];
          const ra = NODE_GROUP_META[a.group].radius;
          for (let j = i + 1; j < activeNodes.length; j++) {
            const b = activeNodes[j];
            const rb = NODE_GROUP_META[b.group].radius;
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let distSq = dx * dx + dy * dy;
            if (distSq < 1) {
              dx = (Math.random() - 0.5) * 2;
              dy = (Math.random() - 0.5) * 2;
              distSq = dx * dx + dy * dy || 1;
            }
            const dist = Math.sqrt(distSq);

            // İtme kuvveti
            const repulse = (3200 / distSq) * alpha;
            const fx = (dx / dist) * repulse;
            const fy = (dy / dist) * repulse;
            if (a.fx == null) {
              a.vx -= fx;
              a.vy -= fy;
            }
            if (b.fx == null) {
              b.vx += fx;
              b.vy += fy;
            }

            // Çarpışma önleme (minimum mesafe)
            const minDist = ra + rb + 24;
            if (dist < minDist) {
              const overlap = ((minDist - dist) / dist) * 0.45;
              const cxPush = dx * overlap;
              const cyPush = dy * overlap;
              if (a.fx == null) {
                a.x -= cxPush;
                a.y -= cyPush;
              }
              if (b.fx == null) {
                b.x += cxPush;
                b.y += cyPush;
              }
            }
          }
        }

        // 2. Hooke yay çekme kuvveti (bağlantılar)
        for (const link of visibleLinks) {
          const s = nodeMap.get(link.source);
          const t = nodeMap.get(link.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetLen = 185 - link.weight * 14;
          const stiffness = 0.018 + link.weight * 0.005;
          const force = (dist - targetLen) * stiffness * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (s.fx == null) {
            s.vx += fx;
            s.vy += fy;
          }
          if (t.fx == null) {
            t.vx -= fx;
            t.vy -= fy;
          }
        }

        // 3. Merkez yerçekimi & hız sönümleme
        for (const n of activeNodes) {
          if (n.fx != null && n.fy != null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.vx += (cx - n.x) * 0.008 * alpha;
          n.vy += (cy - n.y) * 0.008 * alpha;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x = Math.max(60, Math.min(CANVAS_WIDTH - 60, n.x + n.vx));
          n.y = Math.max(55, Math.min(CANVAS_HEIGHT - 55, n.y + n.vy));
        }

        alphaRef.current = alpha * 0.986;
        setRenderTick((t) => (t + 1) % 100000);
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [visibleNodeIdSet, visibleLinks]);

  // Hover veya aktif seçim üzerinden 1. derece komşuluk vurgusu
  const focusNodeId = hoveredNodeId ?? selectedNodeId;
  const focusNeighborhood = useMemo(() => {
    if (!focusNodeId || !visibleNodeIdSet.has(focusNodeId)) return null;
    return getFirstDegreeNeighborhood(focusNodeId, visibleNodes, visibleLinks);
  }, [focusNodeId, visibleNodeIdSet, visibleNodes, visibleLinks]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  // Seçili düğümün tüm bağlantıları (filtre dışı komşuları da gösterebilmesi için full nodes/links üzerinden)
  const selectedNeighborhood = useMemo(() => {
    if (!selectedNodeId) return null;
    return getFirstDegreeNeighborhood(selectedNodeId, nodes, links);
  }, [selectedNodeId, nodes, links]);

  // Ekran koordinatını SVG dünya koordinatına çevir
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
      const rect = svg.getBoundingClientRect();
      const svgX = ((clientX - rect.left) / Math.max(rect.width, 1)) * CANVAS_WIDTH;
      const svgY = ((clientY - rect.top) / Math.max(rect.height, 1)) * CANVAS_HEIGHT;
      return {
        x: (svgX - transform.x) / transform.scale,
        y: (svgY - transform.y) / transform.scale,
      };
    },
    [transform]
  );

  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const simNode = simNodesRef.current.find((n) => n.id === nodeId);
    if (simNode) {
      simNode.fx = simNode.x;
      simNode.fy = simNode.y;
    }
    dragStateRef.current = {
      type: "node",
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: transform.x,
      startPanY: transform.y,
      moved: false,
    };
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragStateRef.current = {
      type: "pan",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: transform.x,
      startPanY: transform.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    if (!drag.type) return;

    const dxPx = e.clientX - drag.startClientX;
    const dyPx = e.clientY - drag.startClientY;
    if (Math.hypot(dxPx, dyPx) > 4) {
      drag.moved = true;
    }

    if (drag.type === "node" && drag.nodeId) {
      const world = clientToWorld(e.clientX, e.clientY);
      const simNode = simNodesRef.current.find((n) => n.id === drag.nodeId);
      if (simNode) {
        simNode.fx = Math.max(40, Math.min(CANVAS_WIDTH - 40, world.x));
        simNode.fy = Math.max(40, Math.min(CANVAS_HEIGHT - 40, world.y));
        simNode.x = simNode.fx;
        simNode.y = simNode.fy;
        alphaRef.current = Math.max(alphaRef.current, 0.35);
        setRenderTick((t) => t + 1);
      }
    } else if (drag.type === "pan") {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / Math.max(rect.width, 1);
      const scaleY = CANVAS_HEIGHT / Math.max(rect.height, 1);
      setTransform((prev) => ({
        ...prev,
        x: drag.startPanX + dxPx * scaleX,
        y: drag.startPanY + dyPx * scaleY,
      }));
    }
  };

  const handlePointerUp = () => {
    const drag = dragStateRef.current;
    if (drag.type === "node" && drag.nodeId) {
      const simNode = simNodesRef.current.find((n) => n.id === drag.nodeId);
      if (simNode) {
        simNode.fx = null;
        simNode.fy = null;
      }
      if (!drag.moved) {
        setSelectedNodeId(drag.nodeId);
      }
    }
    dragStateRef.current.type = null;
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * CANVAS_WIDTH;
    const svgY = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * CANVAS_HEIGHT;

    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setTransform((prev) => {
      const nextScale = Math.max(0.4, Math.min(2.6, prev.scale * factor));
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: svgX - (svgX - prev.x) * ratio,
        y: svgY - (svgY - prev.y) * ratio,
      };
    });
  };

  const handleReLayout = () => {
    simNodesRef.current = computeInitialPositions(nodes);
    alphaRef.current = 1;
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const { canGenerateAI } = useAuth();

  const handleGenerateGeminiAnalysis = async () => {
    if (!selectedNode || !selectedNeighborhood) return;
    setAnalyzingNodeId(selectedNode.id);
    try {
      const result = await analyzeProtocolNodeWithGemini(
        selectedNode,
        selectedNeighborhood.connections,
        { allowExternalApi: canGenerateAI }
      );
      setAnalysisMap((prev) => ({ ...prev, [selectedNode.id]: result }));
    } finally {
      setAnalyzingNodeId(null);
    }
  };

  const handleAddNodeOrLink = (e: React.FormEvent) => {
    e.preventDefault();

    if (addMode === "node") {
      const cleanLabel = newNodeLabel.trim();
      if (!cleanLabel) return;
      const newId = `custom_${Date.now()}`;
      const newNode: ProtocolGraphNode = {
        id: newId,
        label: cleanLabel,
        group: newNodeGroup,
        role: newNodeRole.trim() || `${NODE_GROUP_META[newNodeGroup].shortLabel} (Test Düğümü)`,
        districtTag: newNodeDistrict || undefined,
        eventCount: Math.max(1, Number(newNodeEventCount) || 1),
        x: CANVAS_WIDTH / 2 + (Math.random() - 0.5) * 140,
        y: CANVAS_HEIGHT / 2 + (Math.random() - 0.5) * 140,
      };
      const linkId = `custom_link_${Date.now()}`;
      const newLink: ProtocolGraphLink = {
        id: linkId,
        source: newId,
        target: newLinkTarget,
        relation: newLinkRelation,
        weight: newLinkWeight,
      };

      setNodes((prev) => [...prev, newNode]);
      setLinks((prev) => [...prev, newLink]);
      setCategoryFilter("all");
      setSelectedNodeId(newId);
      setNewNodeLabel("");
      setNewNodeRole("");
      setIsAddModalOpen(false);
    } else {
      if (!newLinkSource || !newLinkTarget || newLinkSource === newLinkTarget) return;
      const linkId = `custom_link_${Date.now()}`;
      const newLink: ProtocolGraphLink = {
        id: linkId,
        source: newLinkSource,
        target: newLinkTarget,
        relation: newLinkRelation,
        weight: newLinkWeight,
      };
      setLinks((prev) => [...prev, newLink]);
      alphaRef.current = Math.max(alphaRef.current, 0.7);
      setSelectedNodeId(newLinkSource);
      setIsAddModalOpen(false);
    }
  };

  const simNodeMap = new Map(simNodesRef.current.map((s) => [s.id, s]));

  const totalSharedEvents = useMemo(() => {
    if (!selectedNode || !selectedNeighborhood) return 0;
    return (
      selectedNode.eventCount +
      selectedNeighborhood.connections.reduce((sum, c) => sum + c.node.eventCount, 0)
    );
  }, [selectedNode, selectedNeighborhood]);

  const currentAnalysis = selectedNode ? analysisMap[selectedNode.id] : undefined;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Üst Başlık ve Filtreleme Araç Çubuğu */}
      <div className="rounded-lg border border-border bg-secondary/25 p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Network className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-mono font-bold tracking-wide text-foreground">
                  {t("Protokol ve Veri Ağı (Test)")}
                </h2>
                <PanelHelpTooltip panelTitle="Protokol ve Veri Ağı (Test)" />
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  {visibleNodes.length} {t("Düğüm")} · {visibleLinks.length} {t("Bağlantı")}
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">
                {t("Muğla kurumları, 13 ilçe ve güncel şehir gündemleri arasındaki iletişim haritası")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Arama Kutusu */}
            <div className="relative flex-1 sm:flex-initial min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Düğüm veya ilçe ara (ör. Bodrum)..."
                className="w-full h-8 pl-8 pr-7 rounded-md border border-border bg-background/80 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Aramayı temizle"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Kategori Filtre Butonları */}
            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-md border border-border/70">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategoryFilter(opt.value)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    categoryFilter === opt.value
                      ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Yeni Düğüm/Bağlantı Ekle (Test) */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="h-8 px-3 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Yeni Düğüm/Bağlantı Ekle (Test)
            </button>
          </div>
        </div>

        {/* Arama Hızlı Seçim Çipleri */}
        {normalizedQuery && (
          <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-border/50 text-[11px] font-mono">
            <span className="text-muted-foreground">
              Eşleşen ({matchedSearchIds.size}):
            </span>
            {matchedSearchIds.size === 0 ? (
              <span className="text-amber-400">Eşleşen düğüm bulunamadı.</span>
            ) : (
              visibleNodes
                .filter((n) => matchedSearchIds.has(n.id))
                .slice(0, 8)
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNodeId(n.id)}
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      selectedNodeId === n.id
                        ? "bg-primary/25 border-primary text-primary"
                        : "bg-background/70 border-border text-foreground hover:border-primary/50"
                    }`}
                  >
                    {n.label}
                  </button>
                ))
            )}
          </div>
        )}

        {/* Renk ve İlişki Lejantı */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(NODE_GROUP_META) as ProtocolNodeGroup[]).map((groupKey) => {
              const meta = NODE_GROUP_META[groupKey];
              return (
                <div key={groupKey} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span>{meta.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(Object.keys(LINK_RELATION_META) as ProtocolLinkRelation[]).map((rel) => {
              const meta = LINK_RELATION_META[rel];
              return (
                <div key={rel} className="flex items-center gap-1.5" title={meta.description}>
                  <svg width="20" height="6" className="shrink-0">
                    <line
                      x1="0"
                      y1="3"
                      x2="20"
                      y2="3"
                      stroke={meta.color}
                      strokeWidth="2"
                      strokeDasharray={meta.dashArray}
                    />
                  </svg>
                  <span>{rel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ana Alan: Etkileşimli Ağ Grafiği + Sağ Detay Çekmecesi */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
        {/* Ağ Grafiği Kanvas/SVG Alanı */}
        <div
          className={`${
            selectedNode ? "xl:col-span-8" : "xl:col-span-12"
          } relative rounded-lg border border-border bg-slate-950/90 overflow-hidden min-h-[600px] lg:min-h-[680px] select-none`}
        >
          {/* Sol Üst Etkileşim İpucu */}
          <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1">
            <div className="px-2.5 py-1 rounded bg-background/80 backdrop-blur border border-border/70 text-[10px] font-mono text-muted-foreground">
              Sürükle: Düğüm taşı · Boş alanı sürükle: Kaydır · Tekerlek: Yakınlaştır
            </div>
          </div>

          {/* Sağ Üst Zoom & Reset Kontrolleri */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-background/85 backdrop-blur border border-border/80 rounded-md p-1">
            <button
              type="button"
              onClick={() =>
                setTransform((p) => ({ ...p, scale: Math.min(2.6, p.scale * 1.18) }))
              }
              className="p-1.5 rounded hover:bg-muted text-foreground"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setTransform((p) => ({ ...p, scale: Math.max(0.4, p.scale * 0.85) }))
              }
              className="p-1.5 rounded hover:bg-muted text-foreground"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
              className="p-1.5 rounded hover:bg-muted text-foreground"
              title="Görünümü Sıfırla"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReLayout}
              className="px-2 py-1 rounded hover:bg-muted text-[10px] font-mono text-foreground flex items-center gap-1"
              title="Kuvvet simülasyonunu yeniden başlat"
            >
              <RefreshCw className="w-3 h-3" />
              Yenile
            </button>
          </div>

          {/* SVG Force-Directed Ağ */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="w-full h-[600px] lg:h-[680px] cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
          >
            <defs>
              <radialGradient id="network-bg-glow" cx="50%" cy="50%" r="55%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
              <pattern id="network-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="rgba(148,163,184,0.06)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#network-bg-glow)" />
            <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#network-grid)" />

            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
              {/* Bağlantı Çizgileri */}
              {visibleLinks.map((link) => {
                const s = simNodeMap.get(link.source);
                const t = simNodeMap.get(link.target);
                if (!s || !t) return null;

                const meta = LINK_RELATION_META[link.relation];
                const isConnectedToFocus = focusNeighborhood
                  ? focusNeighborhood.connectedLinkIds.has(link.id)
                  : true;
                const opacity = focusNeighborhood
                  ? isConnectedToFocus
                    ? 0.92
                    : 0.12
                  : normalizedQuery
                  ? matchedSearchIds.has(link.source) || matchedSearchIds.has(link.target)
                    ? 0.8
                    : 0.18
                  : 0.6;

                return (
                  <g key={link.id} style={{ opacity, transition: "opacity 160ms ease" }}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={meta.color}
                      strokeWidth={1 + link.weight * 0.72}
                      strokeDasharray={meta.dashArray}
                      strokeLinecap="round"
                    />
                    {isConnectedToFocus && focusNeighborhood && (
                      <text
                        x={(s.x + t.x) / 2}
                        y={(s.y + t.y) / 2 - 4}
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontSize="9"
                        fontFamily="monospace"
                        className="pointer-events-none select-none"
                      >
                        {link.relation}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Düğümler */}
              {visibleNodes.map((node) => {
                const sim = simNodeMap.get(node.id);
                if (!sim) return null;

                const meta = NODE_GROUP_META[node.group];
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isSearchMatch = matchedSearchIds.has(node.id);
                const isNeighbor = focusNeighborhood
                  ? focusNeighborhood.neighborIds.has(node.id)
                  : true;

                let nodeOpacity = 1;
                if (focusNeighborhood && !isNeighbor) {
                  nodeOpacity = 0.15;
                } else if (!focusNeighborhood && normalizedQuery && !isSearchMatch) {
                  nodeOpacity = 0.22;
                }

                const nodeAgenda = getNodeAgendaLinks(node);
                const hasActiveFieldAgenda = nodeAgenda.length > 0;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${sim.x}, ${sim.y})`}
                    style={{ opacity: nodeOpacity, transition: "opacity 160ms ease" }}
                    className="cursor-pointer"
                    onPointerDown={(e) => handleNodePointerDown(e, node.id)}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() =>
                      setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                    }
                  >
                    {/* Aktif Saha Gündemi Nabız Halkası */}
                    {hasActiveFieldAgenda && (
                      <circle
                        r={meta.radius + 11}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={1.8}
                        strokeDasharray="4 3"
                        className="animate-pulse"
                      />
                    )}
                    {/* Seçim veya Arama Vurgusu Halkası */}
                    {(isSelected || isHovered || isSearchMatch) && (
                      <circle
                        r={meta.radius + (isSelected ? 8 : 6)}
                        fill="none"
                        stroke={isSearchMatch ? "#facc15" : meta.color}
                        strokeWidth={isSelected ? 2.4 : 1.5}
                        strokeDasharray={isSearchMatch && !isSelected ? "4 2" : undefined}
                        opacity={0.9}
                      />
                    )}

                    {/* Düğüm Gövdesi */}
                    <circle
                      r={meta.radius}
                      fill="#0f172a"
                      stroke={hasActiveFieldAgenda ? "#f59e0b" : meta.color}
                      strokeWidth={isSelected || hasActiveFieldAgenda ? 3 : 2}
                    />
                    <circle
                      r={Math.max(4, meta.radius - 5)}
                      fill={meta.color}
                      fillOpacity={0.28}
                    />
                    {hasActiveFieldAgenda && (
                      <circle
                        cx={meta.radius - 2}
                        cy={-(meta.radius - 2)}
                        r={4.5}
                        fill="#f59e0b"
                        stroke="#020617"
                        strokeWidth={1.2}
                      />
                    )}

                    {/* Etkinlik Sayısı Rozeti */}
                    <text
                      y={3.5}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      className="pointer-events-none"
                    >
                      {node.eventCount}
                    </text>

                    {/* Düğüm İsmi */}
                    <text
                      y={meta.radius + 14}
                      textAnchor="middle"
                      fill={isSelected || isHovered ? "#ffffff" : "#e2e8f0"}
                      fontSize={node.group === "protokol_merkez" ? "11.5" : "10.5"}
                      fontWeight={node.group === "protokol_merkez" || isSelected ? "700" : "500"}
                      fontFamily="monospace"
                      className="pointer-events-none"
                      style={{
                        paintOrder: "stroke",
                        stroke: "#020617",
                        strokeWidth: "3px",
                        strokeLinejoin: "round",
                      }}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Sağ Detay Çekmecesi */}
        {selectedNode && selectedNeighborhood && (
          <aside className="xl:col-span-4 rounded-lg border border-border bg-secondary/25 p-4 flex flex-col justify-between gap-4 min-h-[600px] lg:min-h-[680px]">
            <div className="space-y-4">
              {/* Çekmece Başlığı */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/60">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        NODE_GROUP_META[selectedNode.group].bgClass
                      } ${NODE_GROUP_META[selectedNode.group].borderClass} ${
                        NODE_GROUP_META[selectedNode.group].textClass
                      }`}
                    >
                      {NODE_GROUP_META[selectedNode.group].label}
                    </span>
                    {selectedNode.districtTag && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/40 border border-border text-muted-foreground">
                        {selectedNode.districtTag}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-mono font-bold text-foreground">
                    {selectedNode.label}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedNode.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Detay çekmecesini kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Özet Metrikler */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border/70 bg-background/60 p-2.5">
                  <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-sky-400" />
                    Bağlı Düğüm
                  </div>
                  <div className="text-lg font-mono font-bold text-foreground mt-0.5">
                    {selectedNeighborhood.connections.length}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/60 p-2.5">
                  <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="w-3 h-3 text-amber-400" />
                    Düğüm Gündem
                  </div>
                  <div className="text-lg font-mono font-bold text-foreground mt-0.5">
                    {selectedNode.eventCount}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/60 p-2.5">
                  <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    Ortak Gündem
                  </div>
                  <div className="text-lg font-mono font-bold text-emerald-300 mt-0.5">
                    {totalSharedEvents}
                  </div>
                </div>
              </div>

              {/* Aktif Saha Gündemi / Dolaylı İma Bağlantıları */}
              {(() => {
                const selectedAgenda = getNodeAgendaLinks(selectedNode);
                if (selectedAgenda.length === 0) return null;
                return (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-300">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        Aktif Saha Gündemi &amp; İma Bağlantısı ({selectedAgenda.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate("/?tab=diyagram")}
                        className="text-primary hover:underline"
                      >
                        Sorgu Odası →
                      </button>
                    </div>
                    {selectedAgenda.slice(0, 3).map((item) => (
                      <div key={item.id} className="text-[10px] font-mono text-foreground/90 border-t border-amber-500/20 pt-1">
                        <span className="font-bold text-amber-200">{item.actorName}</span> · {item.implicationType} ({item.dossierCode}):{" "}
                        <span className="text-muted-foreground">{item.summary}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Bağlı Olduğu Tüm Düğümlerin Listesi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-primary" />
                    Bağlı Olduğu Düğümler ({selectedNeighborhood.connections.length})
                  </span>
                </div>

                <div className="max-h-[245px] overflow-y-auto space-y-1.5 pr-1">
                  {selectedNeighborhood.connections.length === 0 ? (
                    <div className="text-xs font-mono text-muted-foreground p-3 rounded border border-dashed border-border">
                      Bu düğümün henüz tanımlı bağlantısı yok.
                    </div>
                  ) : (
                    selectedNeighborhood.connections.map(({ node, link }) => {
                      const nMeta = NODE_GROUP_META[node.group];
                      const rMeta = LINK_RELATION_META[link.relation];
                      return (
                        <button
                          key={link.id}
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          className="w-full text-left p-2 rounded-md border border-border/70 bg-background/60 hover:border-primary/50 hover:bg-background/90 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: nMeta.color }}
                              />
                              <span className="text-xs font-mono font-semibold text-foreground truncate">
                                {node.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/40 border border-border/60"
                                style={{ color: rMeta.color }}
                              >
                                {link.relation}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Ağırlık: {link.weight}/5 · {node.eventCount} gündem
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Alt Bölüm: Gemini / Topoloji Bağlantı Analizi Üret */}
            <div className="pt-3 border-t border-border/60 space-y-2.5">
              <button
                type="button"
                onClick={handleGenerateGeminiAnalysis}
                disabled={analyzingNodeId === selectedNode.id}
                className="w-full h-9 px-3 rounded-md bg-primary/20 hover:bg-primary/30 disabled:opacity-60 border border-primary/50 text-primary text-xs font-mono font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {analyzingNodeId === selectedNode.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    İlişki Özeti Hazırlanıyor...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    İlişki Özeti Oluştur
                  </>
                )}
              </button>

              {currentAnalysis && (
                <div className="rounded-md border border-primary/30 bg-background/80 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      3 Maddelik Koordinasyon & Gündem Özeti
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                      {currentAnalysis.source === "gemini-api"
                        ? "Gemini API"
                        : "Yerel Topoloji Sentezi"}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {currentAnalysis.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-foreground/90 leading-relaxed flex items-start gap-1.5"
                      >
                        <span className="text-primary font-mono font-bold mt-0.5">
                          {i + 1}.
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Yeni Düğüm / Bağlantı Ekle (Test) Modalı */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Yeni Düğüm / Bağlantı Ekle (Test)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ağ topolojisini canlı test etmek için yeni bir düğüm veya mevcut iki düğüm arasında yeni bir koordinasyon/olay bağlantısı ekleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1.5 p-1 rounded-md bg-secondary/40 border border-border">
            <button
              type="button"
              onClick={() => setAddMode("node")}
              className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors ${
                addMode === "node"
                  ? "bg-primary/20 text-primary font-semibold border border-primary/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yeni Düğüm + Bağlantı
            </button>
            <button
              type="button"
              onClick={() => setAddMode("link")}
              className={`flex-1 py-1.5 rounded text-xs font-mono transition-colors ${
                addMode === "link"
                  ? "bg-primary/20 text-primary font-semibold border border-primary/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mevcut Düğümleri Bağla
            </button>
          </div>

          <form onSubmit={handleAddNodeOrLink} className="space-y-3">
            {addMode === "node" ? (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-muted-foreground">
                    Düğüm Adı
                  </label>
                  <input
                    type="text"
                    required
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder="Örn: Bodrum Turizm Koordinasyon Kurulu"
                    className="w-full h-8 px-2.5 rounded border border-border bg-secondary/20 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-muted-foreground">
                      Düğüm Grubu
                    </label>
                    <select
                      value={newNodeGroup}
                      onChange={(e) => setNewNodeGroup(e.target.value as ProtocolNodeGroup)}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                    >
                      {(Object.keys(NODE_GROUP_META) as ProtocolNodeGroup[]).map((g) => (
                        <option key={g} value={g}>
                          {NODE_GROUP_META[g].shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-muted-foreground">
                      İlgili İlçe (Opsiyonel)
                    </label>
                    <select
                      value={newNodeDistrict}
                      onChange={(e) => setNewNodeDistrict(e.target.value)}
                      className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                    >
                      <option value="">İl Geneli</option>
                      {DISTRICT_CHOICES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[11px] font-mono text-muted-foreground">
                      Görevi / Açıklama
                    </label>
                    <input
                      type="text"
                      value={newNodeRole}
                      onChange={(e) => setNewNodeRole(e.target.value)}
                      placeholder="Örn: Sezon yoğunluğu saha denetim ekibi"
                      className="w-full h-8 px-2.5 rounded border border-border bg-secondary/20 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-muted-foreground">
                      Gündem Sayısı
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={newNodeEventCount}
                      onChange={(e) => setNewNodeEventCount(Number(e.target.value))}
                      className="w-full h-8 px-2.5 rounded border border-border bg-secondary/20 text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">
                  Kaynak Düğüm
                </label>
                <select
                  value={newLinkSource}
                  onChange={(e) => setNewLinkSource(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({NODE_GROUP_META[n.group].shortLabel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">
                  Bağlanacak Düğüm
                </label>
                <select
                  value={newLinkTarget}
                  onChange={(e) => setNewLinkTarget(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">
                  İlişki Türü
                </label>
                <select
                  value={newLinkRelation}
                  onChange={(e) =>
                    setNewLinkRelation(e.target.value as ProtocolLinkRelation)
                  }
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                >
                  {(Object.keys(LINK_RELATION_META) as ProtocolLinkRelation[]).map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1 space-y-1">
                <label className="text-[11px] font-mono text-muted-foreground">
                  Ağırlık (1-5)
                </label>
                <select
                  value={newLinkWeight}
                  onChange={(e) => setNewLinkWeight(Number(e.target.value))}
                  className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      {w} / 5
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="h-8 px-3 rounded border border-border text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                İptal
              </button>
              <button
                type="submit"
                className="h-8 px-4 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-semibold"
              >
                Ağa Ekle
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
