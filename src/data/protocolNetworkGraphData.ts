// src/data/protocolNetworkGraphData.ts
// Muğla Monitör v2 — Protokol, 13 İlçe, Paydaş ve Aktif Gündem Ağ Grafiği Veri Modeli

export type ProtocolNodeGroup =
  | "protokol_merkez"
  | "ilce"
  | "paydas"
  | "olay";

export type ProtocolFilterCategory = "all" | "protokol" | "ilce" | "olay";

export type ProtocolLinkRelation =
  | "Protokol Koordinasyonu"
  | "Saha Denetimi"
  | "OSINT Haber Bağlantısı"
  | "İdari Bağ";

export interface ProtocolGraphNode {
  id: string;
  label: string;
  group: ProtocolNodeGroup;
  role: string;
  districtTag?: string;
  eventCount: number;
  // Simülasyon koordinatları (opsiyonel başlangıç)
  x?: number;
  y?: number;
}

export interface ProtocolGraphLink {
  id: string;
  source: string;
  target: string;
  relation: ProtocolLinkRelation;
  weight: number; // 1 (hafif) .. 5 (çok güçlü)
  note?: string;
}

export const NODE_GROUP_META: Record<
  ProtocolNodeGroup,
  {
    label: string;
    shortLabel: string;
    color: string;
    bgClass: string;
    borderClass: string;
    textClass: string;
    radius: number;
  }
> = {
  protokol_merkez: {
    label: "İl Protokolü & Merkez Kurumlar",
    shortLabel: "Merkez Protokol",
    color: "#10b981",
    bgClass: "bg-emerald-500/15",
    borderClass: "border-emerald-500/50",
    textClass: "text-emerald-300",
    radius: 22,
  },
  ilce: {
    label: "Muğla 13 İlçe",
    shortLabel: "İlçe",
    color: "#38bdf8",
    bgClass: "bg-sky-500/15",
    borderClass: "border-sky-500/50",
    textClass: "text-sky-300",
    radius: 17,
  },
  paydas: {
    label: "Protokol Temsilcileri & Paydaşlar",
    shortLabel: "Paydaş / Temsilci",
    color: "#a855f7",
    bgClass: "bg-purple-500/15",
    borderClass: "border-purple-500/50",
    textClass: "text-purple-300",
    radius: 16,
  },
  olay: {
    label: "Aktif Olay & Gündem",
    shortLabel: "Olay / Gündem",
    color: "#f59e0b",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/50",
    textClass: "text-amber-300",
    radius: 15,
  },
};

export const LINK_RELATION_META: Record<
  ProtocolLinkRelation,
  { color: string; dashArray?: string; description: string }
> = {
  "Protokol Koordinasyonu": {
    color: "#10b981",
    description: "Resmi protokol, tören ve kurumlar arası üst düzey koordinasyon bağı",
  },
  "Saha Denetimi": {
    color: "#f59e0b",
    dashArray: "6 3",
    description: "Sahada fiili denetim, zabıta/kolluk ve altyapı kontrol akışı",
  },
  "OSINT Haber Bağlantısı": {
    color: "#f43f5e",
    dashArray: "3 3",
    description: "Sosyal medya, yerel basın ve açık kaynak sinyal korelasyonu",
  },
  "İdari Bağ": {
    color: "#38bdf8",
    description: "Mülki idare, büyükşehir ve ilçe birimleri arası hiyerarşik idari bağ",
  },
};

export const INITIAL_PROTOCOL_NODES: ProtocolGraphNode[] = [
  // a) İl Protokolü ve Merkez Kurumlar
  {
    id: "valilik",
    label: "Muğla Valiliği",
    group: "protokol_merkez",
    role: "İl Mülki İdare Makamı & Kriz Üst Koordinasyon Merkezi",
    districtTag: "Menteşe",
    eventCount: 18,
  },
  {
    id: "mbb",
    label: "Muğla Büyükşehir Belediyesi",
    group: "protokol_merkez",
    role: "İl Geneli Altyapı, MUSKİ, Ulaşım & İtfaiye Koordinasyonu",
    districtTag: "Menteşe",
    eventCount: 22,
  },
  {
    id: "toren_sube",
    label: "Tören ve Organizasyon Şube Müdürlüğü",
    group: "protokol_merkez",
    role: "Resmi Bayram, Anma ve Protokol Programlama Birimi",
    districtTag: "Menteşe",
    eventCount: 11,
  },
  {
    id: "ilan_komisyon",
    label: "İlan ve Reklam Komisyonu",
    group: "protokol_merkez",
    role: "Kent Estetiği, Açık Alan İlan ve Ticari Denetim Kurulu",
    districtTag: "Menteşe",
    eventCount: 8,
  },
  {
    id: "afad",
    label: "AFAD İl Müdürlüğü",
    group: "protokol_merkez",
    role: "TAMP Afet Müdahale, Sismik İzleme & Acil Tahliye Merkezi",
    districtTag: "Menteşe",
    eventCount: 15,
  },

  // b) 13 İlçe Düğümleri
  { id: "ilce_mentese", label: "Menteşe", group: "ilce", role: "İl Merkezi & İdari Hub", districtTag: "Menteşe", eventCount: 14 },
  { id: "ilce_bodrum", label: "Bodrum", group: "ilce", role: "Kıyı Turizm & Su Stresi Bölgesi", districtTag: "Bodrum", eventCount: 19 },
  { id: "ilce_fethiye", label: "Fethiye", group: "ilce", role: "Kıyı Turizm & Sismik Koridor", districtTag: "Fethiye", eventCount: 13 },
  { id: "ilce_marmaris", label: "Marmaris", group: "ilce", role: "Yüksek Orman Yangını Hassasiyeti", districtTag: "Marmaris", eventCount: 16 },
  { id: "ilce_milas", label: "Milas", group: "ilce", role: "BJV Havalimanı, Barajlar & Sanayi", districtTag: "Milas", eventCount: 12 },
  { id: "ilce_seydikemer", label: "Seydikemer", group: "ilce", role: "Tarım Havzası & Yayla Geçişi", districtTag: "Seydikemer", eventCount: 7 },
  { id: "ilce_ortaca", label: "Ortaca", group: "ilce", role: "Dalyan / İztuzu Ekoloji Koridoru", districtTag: "Ortaca", eventCount: 9 },
  { id: "ilce_dalaman", label: "Dalaman", group: "ilce", role: "DLM Havalimanı & Lojistik Kapı", districtTag: "Dalaman", eventCount: 10 },
  { id: "ilce_koycegiz", label: "Köyceğiz", group: "ilce", role: "Göl Havzası & Taşkın İzleme", districtTag: "Köyceğiz", eventCount: 8 },
  { id: "ilce_ula", label: "Ula", group: "ilce", role: "Sakar Geçişi & Akyaka Gökova", districtTag: "Ula", eventCount: 9 },
  { id: "ilce_yatagan", label: "Yatağan", group: "ilce", role: "Enerji Üretimi & Karayolu Kavşağı", districtTag: "Yatağan", eventCount: 8 },
  { id: "ilce_datca", label: "Datça", group: "ilce", role: "Yarımada Tek Arter Ulaşım", districtTag: "Datça", eventCount: 7 },
  { id: "ilce_kavaklidere", label: "Kavaklıdere", group: "ilce", role: "Kırsal Mermer & Orman Alanı", districtTag: "Kavaklıdere", eventCount: 5 },

  // c) Protokol / Temsilciler ve Paydaşlar
  {
    id: "paydas_kaymakamliklar",
    label: "İlçe Kaymakamlıkları",
    group: "paydas",
    role: "13 İlçede Mülki İdare ve Güvenlik Temsilcilikleri",
    eventCount: 16,
  },
  {
    id: "paydas_belediyeler",
    label: "İlçe Belediyeleri",
    group: "paydas",
    role: "Yerel Zabıta, İmar, Temizlik ve Sosyal Etkinlik Paydaşları",
    eventCount: 17,
  },
  {
    id: "paydas_stk_odalar",
    label: "Sivil Toplum ve Oda Temsilcilikleri",
    group: "paydas",
    role: "MUTSO, Esnaf Odaları, Deniz Ticaret Odası & Gönüllü STK'lar",
    eventCount: 10,
  },

  // d) Aktif Olay / Gündem Düğümleri
  {
    id: "olay_resmi_toren",
    label: "Resmi Tören ve Organizasyonlar",
    group: "olay",
    role: "İl Protokolü Katılımlı Tören, Açılış ve Anma Takvimi",
    eventCount: 9,
  },
  {
    id: "olay_osint_gundem",
    label: "OSINT Sosyal Medya Gündemleri",
    group: "olay",
    role: "Yerel Basın, Twitter/X ve Vatandaş Şikayet Kümeleri",
    eventCount: 24,
  },
  {
    id: "olay_saha_denetim",
    label: "Saha Denetimleri",
    group: "olay",
    role: "İlan/Reklam, Kıyı İşgaliye, Yangın Önlem & Zabıta Denetimleri",
    eventCount: 14,
  },
  {
    id: "olay_trafik_altyapi",
    label: "Trafik/Altyapı Bildirimleri",
    group: "olay",
    role: "TomTom Akış Daralması, MUSKİ İsale Hattı & Yol Çalışmaları",
    eventCount: 21,
  },
];

export const INITIAL_PROTOCOL_LINKS: ProtocolGraphLink[] = [
  // Merkez Protokol -> Kaymakamlıklar & İlçeler (İdari Bağ / Protokol Koordinasyonu)
  { id: "l1", source: "valilik", target: "paydas_kaymakamliklar", relation: "İdari Bağ", weight: 5 },
  { id: "l2", source: "valilik", target: "afad", relation: "Protokol Koordinasyonu", weight: 5 },
  { id: "l3", source: "valilik", target: "toren_sube", relation: "İdari Bağ", weight: 4 },
  { id: "l4", source: "valilik", target: "mbb", relation: "Protokol Koordinasyonu", weight: 5 },
  { id: "l5", source: "mbb", target: "paydas_belediyeler", relation: "İdari Bağ", weight: 5 },
  { id: "l6", source: "mbb", target: "ilan_komisyon", relation: "İdari Bağ", weight: 4 },
  { id: "l7", source: "mbb", target: "afad", relation: "Protokol Koordinasyonu", weight: 4 },

  // Tören & İlan Komisyonu -> Olaylar & Paydaşlar
  { id: "l8", source: "toren_sube", target: "olay_resmi_toren", relation: "Protokol Koordinasyonu", weight: 5 },
  { id: "l9", source: "valilik", target: "olay_resmi_toren", relation: "Protokol Koordinasyonu", weight: 4 },
  { id: "l10", source: "paydas_stk_odalar", target: "olay_resmi_toren", relation: "Protokol Koordinasyonu", weight: 3 },
  { id: "l11", source: "ilan_komisyon", target: "olay_saha_denetim", relation: "Saha Denetimi", weight: 4 },
  { id: "l12", source: "paydas_belediyeler", target: "olay_saha_denetim", relation: "Saha Denetimi", weight: 4 },
  { id: "l13", source: "paydas_kaymakamliklar", target: "olay_saha_denetim", relation: "Saha Denetimi", weight: 3 },

  // Kaymakamlıklar -> 13 İlçe (İdari Bağ)
  { id: "l14", source: "paydas_kaymakamliklar", target: "ilce_mentese", relation: "İdari Bağ", weight: 4 },
  { id: "l15", source: "paydas_kaymakamliklar", target: "ilce_bodrum", relation: "İdari Bağ", weight: 4 },
  { id: "l16", source: "paydas_kaymakamliklar", target: "ilce_fethiye", relation: "İdari Bağ", weight: 4 },
  { id: "l17", source: "paydas_kaymakamliklar", target: "ilce_marmaris", relation: "İdari Bağ", weight: 4 },
  { id: "l18", source: "paydas_kaymakamliklar", target: "ilce_milas", relation: "İdari Bağ", weight: 3 },
  { id: "l19", source: "paydas_kaymakamliklar", target: "ilce_seydikemer", relation: "İdari Bağ", weight: 2 },
  { id: "l20", source: "paydas_kaymakamliklar", target: "ilce_ortaca", relation: "İdari Bağ", weight: 3 },
  { id: "l21", source: "paydas_kaymakamliklar", target: "ilce_dalaman", relation: "İdari Bağ", weight: 3 },
  { id: "l22", source: "paydas_kaymakamliklar", target: "ilce_koycegiz", relation: "İdari Bağ", weight: 2 },
  { id: "l23", source: "paydas_kaymakamliklar", target: "ilce_ula", relation: "İdari Bağ", weight: 2 },
  { id: "l24", source: "paydas_kaymakamliklar", target: "ilce_yatagan", relation: "İdari Bağ", weight: 2 },
  { id: "l25", source: "paydas_kaymakamliklar", target: "ilce_datca", relation: "İdari Bağ", weight: 3 },
  { id: "l26", source: "paydas_kaymakamliklar", target: "ilce_kavaklidere", relation: "İdari Bağ", weight: 2 },

  // İlçe Belediyeleri & STK -> Kilit İlçeler
  { id: "l27", source: "paydas_belediyeler", target: "ilce_bodrum", relation: "Protokol Koordinasyonu", weight: 4 },
  { id: "l28", source: "paydas_belediyeler", target: "ilce_marmaris", relation: "Protokol Koordinasyonu", weight: 4 },
  { id: "l29", source: "paydas_belediyeler", target: "ilce_fethiye", relation: "Protokol Koordinasyonu", weight: 4 },
  { id: "l30", source: "paydas_belediyeler", target: "ilce_mentese", relation: "Protokol Koordinasyonu", weight: 4 },
  { id: "l31", source: "paydas_stk_odalar", target: "ilce_bodrum", relation: "Protokol Koordinasyonu", weight: 3 },
  { id: "l32", source: "paydas_stk_odalar", target: "ilce_marmaris", relation: "Protokol Koordinasyonu", weight: 3 },
  { id: "l33", source: "paydas_stk_odalar", target: "ilce_mentese", relation: "Protokol Koordinasyonu", weight: 3 },

  // AFAD -> Yüksek Riskli İlçeler
  { id: "l34", source: "afad", target: "ilce_marmaris", relation: "Saha Denetimi", weight: 4 },
  { id: "l35", source: "afad", target: "ilce_fethiye", relation: "Saha Denetimi", weight: 4 },
  { id: "l36", source: "afad", target: "ilce_datca", relation: "Saha Denetimi", weight: 3 },
  { id: "l37", source: "afad", target: "ilce_koycegiz", relation: "Saha Denetimi", weight: 3 },

  // MBB & Olaylar -> İlçeler (Altyapı, Trafik, OSINT)
  { id: "l38", source: "mbb", target: "olay_trafik_altyapi", relation: "Saha Denetimi", weight: 5 },
  { id: "l39", source: "olay_trafik_altyapi", target: "ilce_bodrum", relation: "Saha Denetimi", weight: 5 },
  { id: "l40", source: "olay_trafik_altyapi", target: "ilce_milas", relation: "Saha Denetimi", weight: 4 },
  { id: "l41", source: "olay_trafik_altyapi", target: "ilce_ula", relation: "Saha Denetimi", weight: 3 },
  { id: "l42", source: "olay_trafik_altyapi", target: "ilce_dalaman", relation: "Saha Denetimi", weight: 3 },
  { id: "l43", source: "olay_trafik_altyapi", target: "ilce_yatagan", relation: "Saha Denetimi", weight: 3 },

  // OSINT Sosyal Medya Gündemleri -> İlçeler & Kurumlar
  { id: "l44", source: "olay_osint_gundem", target: "ilce_bodrum", relation: "OSINT Haber Bağlantısı", weight: 5 },
  { id: "l45", source: "olay_osint_gundem", target: "ilce_marmaris", relation: "OSINT Haber Bağlantısı", weight: 4 },
  { id: "l46", source: "olay_osint_gundem", target: "ilce_fethiye", relation: "OSINT Haber Bağlantısı", weight: 4 },
  { id: "l47", source: "olay_osint_gundem", target: "ilce_datca", relation: "OSINT Haber Bağlantısı", weight: 3 },
  { id: "l48", source: "olay_osint_gundem", target: "ilce_ortaca", relation: "OSINT Haber Bağlantısı", weight: 3 },
  { id: "l49", source: "olay_osint_gundem", target: "mbb", relation: "OSINT Haber Bağlantısı", weight: 4 },
  { id: "l50", source: "olay_osint_gundem", target: "valilik", relation: "OSINT Haber Bağlantısı", weight: 3 },
  { id: "l51", source: "olay_saha_denetim", target: "ilce_bodrum", relation: "Saha Denetimi", weight: 4 },
  { id: "l52", source: "olay_saha_denetim", target: "ilce_seydikemer", relation: "Saha Denetimi", weight: 2 },
  { id: "l53", source: "olay_saha_denetim", target: "ilce_kavaklidere", relation: "Saha Denetimi", weight: 2 },
  { id: "l54", source: "valilik", target: "ilce_mentese", relation: "İdari Bağ", weight: 5 },
];

export interface NeighborConnection {
  node: ProtocolGraphNode;
  link: ProtocolGraphLink;
}

/**
 * Seçili veya üzerinde durulan düğümün 1. derece komşularını ve bağlantılarını döndürür.
 */
export function getFirstDegreeNeighborhood(
  nodeId: string,
  nodes: ProtocolGraphNode[],
  links: ProtocolGraphLink[]
): {
  neighborIds: Set<string>;
  connectedLinkIds: Set<string>;
  connections: NeighborConnection[];
} {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const neighborIds = new Set<string>([nodeId]);
  const connectedLinkIds = new Set<string>();
  const connections: NeighborConnection[] = [];

  for (const link of links) {
    if (link.source === nodeId) {
      const targetNode = nodeMap.get(link.target);
      if (targetNode) {
        neighborIds.add(targetNode.id);
        connectedLinkIds.add(link.id);
        connections.push({ node: targetNode, link });
      }
    } else if (link.target === nodeId) {
      const sourceNode = nodeMap.get(link.source);
      if (sourceNode) {
        neighborIds.add(sourceNode.id);
        connectedLinkIds.add(link.id);
        connections.push({ node: sourceNode, link });
      }
    }
  }

  connections.sort((a, b) => b.link.weight - a.link.weight);
  return { neighborIds, connectedLinkIds, connections };
}

/**
 * Kategori filtresine göre düğümün görünür olup olmadığını belirler.
 */
export function matchesProtocolFilter(
  node: ProtocolGraphNode,
  filter: ProtocolFilterCategory
): boolean {
  if (filter === "all") return true;
  if (filter === "protokol") {
    return node.group === "protokol_merkez" || node.group === "paydas";
  }
  if (filter === "ilce") return node.group === "ilce";
  if (filter === "olay") return node.group === "olay";
  return true;
}
