// src/services/protocolNetworkGeminiService.ts
// Seçili düğümün bağlı olduğu ilçeler ve kurumlarla koordinasyon/gündem özetini
// merkezi ENV (VITE_GEMINI_API_KEY / process.env.GEMINI_API_KEY) üzerinden 3 maddede üretir.

import { runClientGeminiProtocolNode } from "@/services/clientGeminiFallback";
import {
  NODE_GROUP_META,
  type ProtocolGraphNode,
  type NeighborConnection,
} from "@/data/protocolNetworkGraphData";

export interface ProtocolGeminiAnalysisResult {
  nodeId: string;
  bullets: string[];
  source: "gemini-api" | "local-topology-fallback";
  generatedAt: string;
}

function buildLocalFallbackBullets(
  node: ProtocolGraphNode,
  connections: NeighborConnection[]
): string[] {
  const connectedDistricts = connections
    .filter((c) => c.node.group === "ilce")
    .map((c) => c.node.label);
  const connectedInstitutions = connections
    .filter((c) => c.node.group === "protokol_merkez" || c.node.group === "paydas")
    .map((c) => c.node.label);
  const connectedEvents = connections
    .filter((c) => c.node.group === "olay")
    .map((c) => c.node.label);

  const relationCounts = new Map<string, number>();
  connections.forEach((c) => {
    relationCounts.set(c.link.relation, (relationCounts.get(c.link.relation) ?? 0) + 1);
  });
  const topRelation =
    Array.from(relationCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "Protokol Koordinasyonu";

  const bullet1 =
    connectedInstitutions.length > 0
      ? `Kurumsal Koordinasyon: ${node.label} (${NODE_GROUP_META[node.group].shortLabel}), başta ${connectedInstitutions.slice(0, 3).join(", ")} olmak üzere ${connectedInstitutions.length} merkez/paydaş birimle "${topRelation}" ekseninde doğrudan bağlıdır.`
      : `Kurumsal Konum: ${node.label}, "${node.role}" göreviyle toplam ${connections.length} birinci derece ağ bağlantısı üzerinden il koordinasyonunda rol almaktadır.`;

  const bullet2 =
    connectedDistricts.length > 0
      ? `İlçe Kapsamı: Ağ üzerinde ${connectedDistricts.slice(0, 5).join(", ")}${connectedDistricts.length > 5 ? ` (+${connectedDistricts.length - 5} ilçe)` : ""} ilçeleriyle operasyonel ve idari etkileşim yürütmektedir.`
      : `Bölgesel Etki: Doğrudan bağlı olduğu ${connections.length} düğüm üzerinden ${node.districtTag ? `${node.districtTag} merkezli` : "Muğla geneli"} karar ve denetim akışını beslemektedir.`;

  const totalAgenda =
    node.eventCount + connections.reduce((sum, c) => sum + c.node.eventCount, 0);
  const bullet3 =
    connectedEvents.length > 0
      ? `Ortak Gündem & Risk Baskısı: "${connectedEvents.join(", ")}" başlıklarıyla bağlantılı toplam ${totalAgenda} aktif gündem/etkinlik sinyali izlenmektedir; öncelikli teyit önerilir.`
      : `Gündem Yoğunluğu: Düğüm ve doğrudan komşuları üzerinde toplam ${totalAgenda} ortak etkinlik/olay kaydı görünmektedir; periyodik saha senkronizasyonu önerilir.`;

  return [bullet1, bullet2, bullet3];
}

/**
 * Seçili düğüm ve 1. derece komşuları için 3 maddelik Gemini bağlantı analizi üretir.
 */
export async function analyzeProtocolNodeWithGemini(
  node: ProtocolGraphNode,
  connections: NeighborConnection[],
  options?: { allowExternalApi?: boolean }
): Promise<ProtocolGeminiAnalysisResult> {
  const generatedAt = new Date().toISOString();
  const allowExternalApi = options?.allowExternalApi ?? true;

  if (!allowExternalApi) {
    return {
      nodeId: node.id,
      bullets: buildLocalFallbackBullets(node, connections),
      source: "local-topology-fallback",
      generatedAt,
    };
  }

  try {
    const parsed = await runClientGeminiProtocolNode({ node, connections });
    const bullets = Array.isArray(parsed?.bullets)
      ? parsed.bullets.map(String).filter((b: string) => b.trim().length > 0).slice(0, 3)
      : [];

    if (bullets.length < 3) {
      return {
        nodeId: node.id,
        bullets: buildLocalFallbackBullets(node, connections),
        source: "local-topology-fallback",
        generatedAt,
      };
    }

    return {
      nodeId: node.id,
      bullets,
      source: "gemini-api",
      generatedAt,
    };
  } catch (err) {
    console.warn("[ProtocolNetworkGemini] Canlı Gemini çağrısı başarısız, yerel topoloji sentezi kullanılıyor:", err);
    return {
      nodeId: node.id,
      bullets: buildLocalFallbackBullets(node, connections),
      source: "local-topology-fallback",
      generatedAt,
    };
  }
}
