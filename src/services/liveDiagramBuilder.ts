// src/services/liveDiagramBuilder.ts
// Diyagram sekmesi için yalnızca gerçek Supabase kayıtlarından (`social_posts`,
// `protocol_members`, `alert_events`) ve merkezi store'dan canlı düğüm, bağlantı
// ve çapraz doğrulama sonucu üretir. Hiçbir sahte/DEMO veri içermez.

import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import type {
  InvestigationDossier,
  InvestigationLink,
  InvestigationNode,
} from "@/data/investigationData";
import type {
  DiagramEventRecord,
  ProtocolMemberRecord,
  SocialPostItem,
} from "@/store/useMonitorStore";

export interface LiveAlertRecord {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  source: string;
  created_at: string;
}

export interface LiveDiagramDataset {
  nodes: InvestigationNode[];
  links: InvestigationLink[];
  dossiers: InvestigationDossier[];
  posts: SocialPostItem[];
  alerts: LiveAlertRecord[];
  protocolMembers: ProtocolMemberRecord[];
  fetchedAt: string;
}

export interface LiveCrossCheckResult {
  query: string;
  statusLabel: "DOĞRULANMIŞ KAYIT BULUNDU" | "GÜNDEM TAKİBİNDE" | "KAYIT BULUNAMADI";
  statusTone: "verified" | "monitoring" | "empty";
  matchedDistrict: string;
  matchedPosts: SocialPostItem[];
  matchedAlerts: LiveAlertRecord[];
  matchedProtocol: ProtocolMemberRecord[];
  highlightedNodeIds: string[];
  highlightedLinkIds: string[];
  summary: string;
}

const MUGLA_DISTRICTS = [
  "Menteşe",
  "Bodrum",
  "Marmaris",
  "Fethiye",
  "Milas",
  "Datça",
  "Dalaman",
  "Ortaca",
  "Köyceğiz",
  "Yatağan",
  "Ula",
  "Seydikemer",
  "Kavaklıdere",
];

function normTr(text: string): string {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectDistrict(text: string, fallback?: string | null): string {
  const low = normTr(`${fallback || ""} ${text || ""}`);
  for (const d of MUGLA_DISTRICTS) {
    if (low.includes(normTr(d))) return d;
  }
  return fallback && fallback.trim() ? fallback.trim() : "Menteşe";
}

function districtToId(name: string): string {
  return normTr(name).replace(/[^a-z0-9]+/g, "");
}

export async function fetchLiveDiagramSources(): Promise<{
  posts: SocialPostItem[];
  alerts: LiveAlertRecord[];
  protocolMembers: ProtocolMemberRecord[];
}> {
  if (!isSupabaseClientConfigured || typeof supabase?.from !== "function") {
    return { posts: [], alerts: [], protocolMembers: [] };
  }

  const safeQuery = async (
    table: "social_posts" | "alert_events" | "protocol_members",
    columns: string,
    orderCol: string,
    limit: number
  ): Promise<any[]> => {
    try {
      const qb = supabase.from(table) as any;
      const res = await qb.select(columns).order(orderCol, { ascending: false }).limit(limit);
      return !res?.error && Array.isArray(res?.data) ? res.data : [];
    } catch {
      return [];
    }
  };

  const [rawPosts, rawAlerts, rawMembers] = await Promise.all([
    safeQuery("social_posts", "id, platform, content, sentiment, region, author, url, published_at", "published_at", 40),
    safeQuery("alert_events", "id, type, severity, title, body, source, created_at", "created_at", 20),
    safeQuery("protocol_members", "id, isim, unvan, kategori, telefon, faks, district, updated_at", "updated_at", 30),
  ]);

  const posts: SocialPostItem[] = rawPosts
    .filter((r) => r && typeof r.content === "string" && r.content.trim())
    .map((r) => ({
      id: String(r.id ?? `sp-${Math.random().toString(36).slice(2)}`),
      platform: String(r.platform ?? "news"),
      content: String(r.content),
      sentiment: String(r.sentiment ?? "neutral"),
      districtName: typeof r.region === "string" ? r.region : undefined,
      author: typeof r.author === "string" ? r.author : undefined,
      url: typeof r.url === "string" ? r.url : undefined,
      publishedAt: typeof r.published_at === "string" ? r.published_at : new Date().toISOString(),
    }));

  const alerts: LiveAlertRecord[] = rawAlerts
    .filter((r) => r && (r.title || r.body))
    .map((r) => ({
      id: String(r.id ?? `al-${Math.random().toString(36).slice(2)}`),
      type: String(r.type ?? "bildirim"),
      severity: String(r.severity ?? "info"),
      title: String(r.title ?? "Sistem Bildirimi"),
      body: String(r.body ?? ""),
      source: String(r.source ?? "Muğla Monitör"),
      created_at: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    }));

  const protocolMembers: ProtocolMemberRecord[] = rawMembers
    .filter((r) => r && r.isim && r.unvan)
    .map((r) => ({
      id: String(r.id ?? ""),
      isim: String(r.isim),
      unvan: String(r.unvan),
      kategori: String(r.kategori ?? "Protokol"),
      telefon: String(r.telefon ?? ""),
      faks: String(r.faks ?? ""),
      district: typeof r.district === "string" ? r.district : null,
      updatedAt: typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
    }));

  return { posts, alerts, protocolMembers };
}

export function buildLiveDiagramGraph(params: {
  posts: SocialPostItem[];
  alerts: LiveAlertRecord[];
  protocolMembers: ProtocolMemberRecord[];
  diagramEvents?: DiagramEventRecord[];
}): LiveDiagramDataset {
  const { posts, alerts, protocolMembers, diagramEvents = [] } = params;

  const nodes: InvestigationNode[] = [];
  const links: InvestigationLink[] = [];
  const dossiers: InvestigationDossier[] = [];
  const districtNodeIds = new Map<string, string[]>();

  const registerDistrictNode = (district: string, nodeId: string) => {
    const list = districtNodeIds.get(district) ?? [];
    list.push(nodeId);
    districtNodeIds.set(district, list);
  };

  // 1. Resmi Protokol Aktörleri (üst şerit — y: -185)
  const topProtocol = protocolMembers.slice(0, 5);
  topProtocol.forEach((m, idx) => {
    const id = `proto-${m.id || idx}`;
    const district = detectDistrict(`${m.unvan} ${m.district || ""}`, m.district || "Menteşe");
    const spacing = topProtocol.length > 1 ? 640 / (topProtocol.length - 1) : 0;
    const x = topProtocol.length > 1 ? Math.round(-320 + idx * spacing) : 0;
    nodes.push({
      id,
      type: "resmi_teyit",
      title: `${m.isim}`,
      source: m.unvan,
      timestamp: m.updatedAt || new Date().toISOString(),
      districtId: districtToId(district),
      districtName: district,
      status: "dogrulandi",
      credibilityScore: 98,
      claimSummary: `${m.unvan} (${m.kategori || "Muğla İl Protokolü"})`,
      x,
      y: -185,
    });
    registerDistrictNode(district, id);
  });

  // 2. Aktif Uyarılar (`alert_events` — orta şerit y: -15)
  const topAlerts = alerts.slice(0, 5);
  topAlerts.forEach((al, idx) => {
    const id = `alert-${al.id || idx}`;
    const district = detectDistrict(`${al.title} ${al.body}`);
    const spacing = topAlerts.length > 1 ? 660 / (topAlerts.length - 1) : 0;
    const x = topAlerts.length > 1 ? Math.round(-330 + idx * spacing) : 0;
    const sevLow = al.severity.toLowerCase();
    nodes.push({
      id,
      type: "saha_sensor",
      title: al.title.slice(0, 48),
      source: al.source || "Uyarı Merkezi",
      timestamp: al.created_at,
      districtId: districtToId(district),
      districtName: district,
      status: sevLow.includes("crit") || sevLow.includes("high") ? "celiskili" : "dogrulandi",
      credibilityScore: 92,
      claimSummary: al.body || al.title,
      x,
      y: -15,
    });
    registerDistrictNode(district, id);
  });

  // 3. Canlı Sosyal/Haber Akışı (`social_posts` + `diagramEvents` — alt şerit y: 155)
  const mergedPosts = [
    ...diagramEvents.slice(0, 3).map((ev) => ({
      id: `ev-${ev.id}`,
      platform: "yerel_haber",
      content: ev.title,
      sentiment: "neutral",
      districtName: ev.district,
      author: ev.sourceName,
      url: ev.sourceUrl,
      publishedAt: ev.publishedAt,
    })),
    ...posts.slice(0, 6),
  ].slice(0, 7);

  mergedPosts.forEach((p, idx) => {
    const id = `post-${p.id || idx}`;
    const district = detectDistrict(p.content, p.districtName);
    const spacing = mergedPosts.length > 1 ? 720 / (mergedPosts.length - 1) : 0;
    const x = mergedPosts.length > 1 ? Math.round(-360 + idx * spacing) : 0;
    const isNews = ["news", "google_news", "rss", "yerel_haber", "yerel_basin"].includes(
      String(p.platform || "").toLowerCase()
    );
    nodes.push({
      id,
      type: isNews ? "yerel_haber" : "sosyal_dalga",
      title: p.content.replace(/\s+/g, " ").trim().slice(0, 44),
      source: p.author || p.platform || "Yerel Akış",
      timestamp: p.publishedAt || new Date().toISOString(),
      districtId: districtToId(district),
      districtName: district,
      status: p.sentiment === "negative" ? "inceleniyor" : "dogrulandi",
      credibilityScore: isNews ? 84 : 72,
      claimSummary: p.content.replace(/\s+/g, " ").trim().slice(0, 200),
      x,
      y: 155,
    });
    registerDistrictNode(district, id);
  });

  // 4. Gerçek İlçe & Makam İlişkileri (Bağlantılar)
  const protoNodes = nodes.filter((n) => n.type === "resmi_teyit");
  const alertNodes = nodes.filter((n) => n.type === "saha_sensor");
  const postNodes = nodes.filter((n) => n.type === "yerel_haber" || n.type === "sosyal_dalga");

  const defaultGovernorNode =
    protoNodes.find((n) => normTr(n.source).includes("vali")) ?? protoNodes[0] ?? null;

  let linkSeq = 0;
  for (const alNode of alertNodes) {
    const targetProto =
      protoNodes.find((p) => p.districtName === alNode.districtName) ?? defaultGovernorNode;
    if (targetProto) {
      linkSeq++;
      links.push({
        id: `live-link-${linkSeq}`,
        source: alNode.id,
        target: targetProto.id,
        relation: "resmi_yanit",
        label: `${alNode.districtName} Koordinasyon`,
        confidence: 90,
        evidenceQuote: `${alNode.title} ↔ ${targetProto.title} (${targetProto.source})`,
        isContradiction: false,
      });
    }
  }

  for (const postNode of postNodes) {
    const matchedAlert = alertNodes.find((a) => a.districtName === postNode.districtName);
    const matchedProto =
      protoNodes.find((p) => p.districtName === postNode.districtName) ?? defaultGovernorNode;
    const target = matchedAlert ?? matchedProto;
    if (target) {
      linkSeq++;
      links.push({
        id: `live-link-${linkSeq}`,
        source: postNode.id,
        target: target.id,
        relation: matchedAlert ? "destekliyor" : "bahsediyor",
        label: `${postNode.districtName} Gündem`,
        confidence: matchedAlert ? 86 : 78,
        evidenceQuote: `${postNode.source}: ${postNode.claimSummary.slice(0, 110)}`,
        isContradiction: false,
      });
    }
  }

  // 5. İlçe Bazlı Canlı Dosyalar (yalnızca gerçek kayıt içeren ilçeler)
  const districtEntries = Array.from(districtNodeIds.entries())
    .filter(([, ids]) => ids.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  districtEntries.forEach(([districtName, ids], idx) => {
    const dLinks = links
      .filter((l) => ids.includes(l.source) || ids.includes(l.target))
      .map((l) => l.id);
    dossiers.push({
      id: `live-dosya-${districtToId(districtName)}`,
      code: `CANLI-${idx + 1}`,
      title: `${districtName} Canlı Akış & Protokol İlişkileri`,
      districtId: districtToId(districtName),
      districtName,
      category: `${ids.length} Kayıt`,
      summary: `${districtName} ilçesine ait doğrulanmış paylaşım, uyarı ve protokol kayıtları.`,
      status: "dogrulandi",
      verdictScore: 88,
      nodeIds: ids,
      linkIds: dLinks,
      interrogationPromptQuestions: [],
      officialStatement: "",
      rumorSummary: "",
      aiVerdictReasoning: "",
    });
  });

  return {
    nodes,
    links,
    dossiers,
    posts,
    alerts,
    protocolMembers,
    fetchedAt: new Date().toISOString(),
  };
}

export function runLiveCrossCheck(
  query: string,
  dataset: LiveDiagramDataset
): LiveCrossCheckResult {
  const cleanQuery = query.trim();
  const normQ = normTr(cleanQuery);
  const tokens = normQ
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3);

  const scoreText = (haystack: string): number => {
    const h = normTr(haystack);
    let score = 0;
    for (const tok of tokens) {
      if (h.includes(tok)) score += 1;
    }
    return score;
  };

  const matchedDistrict = detectDistrict(cleanQuery, "Muğla Geneli");

  const matchedPosts = dataset.posts
    .map((p) => ({
      item: p,
      score: scoreText(`${p.content} ${p.districtName || ""} ${p.author || ""} ${p.platform}`),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.item);

  const matchedAlerts = dataset.alerts
    .map((a) => ({
      item: a,
      score: scoreText(`${a.title} ${a.body} ${a.source} ${a.type}`),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.item);

  const matchedProtocol = dataset.protocolMembers
    .map((m) => ({
      item: m,
      score:
        scoreText(`${m.isim} ${m.unvan} ${m.district || ""} ${m.kategori}`) +
        (matchedDistrict !== "Muğla Geneli" &&
        normTr(`${m.unvan} ${m.district || ""}`).includes(normTr(matchedDistrict))
          ? 2
          : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.item);

  // Eşleşen düğüm ve bağlantıları vurgula
  const matchedPostIds = new Set(matchedPosts.map((p) => `post-${p.id}`));
  const matchedAlertIds = new Set(matchedAlerts.map((a) => `alert-${a.id}`));
  const matchedProtoIds = new Set(matchedProtocol.map((m) => `proto-${m.id}`));

  const highlightedNodeIds = dataset.nodes
    .filter(
      (n) =>
        matchedPostIds.has(n.id) ||
        matchedAlertIds.has(n.id) ||
        matchedProtoIds.has(n.id) ||
        (matchedDistrict !== "Muğla Geneli" && n.districtName === matchedDistrict)
    )
    .map((n) => n.id);

  const highlightedLinkIds = dataset.links
    .filter((l) => highlightedNodeIds.includes(l.source) || highlightedNodeIds.includes(l.target))
    .map((l) => l.id);

  const totalHits = matchedPosts.length + matchedAlerts.length;
  const statusLabel: LiveCrossCheckResult["statusLabel"] =
    matchedAlerts.length > 0 && matchedPosts.length > 0
      ? "DOĞRULANMIŞ KAYIT BULUNDU"
      : totalHits > 0 || matchedProtocol.length > 0
      ? "GÜNDEM TAKİBİNDE"
      : "KAYIT BULUNAMADI";

  const statusTone: LiveCrossCheckResult["statusTone"] =
    statusLabel === "DOĞRULANMIŞ KAYIT BULUNDU"
      ? "verified"
      : statusLabel === "GÜNDEM TAKİBİNDE"
      ? "monitoring"
      : "empty";

  const summary =
    totalHits > 0
      ? `"${cleanQuery}" sorgusu için canlı akışta ${matchedPosts.length} paylaşım, ${matchedAlerts.length} resmi uyarı ve ${matchedProtocol.length} ilgili makam kaydı eşleştirildi.`
      : `Canlı akışta "${cleanQuery}" ile doğrudan eşleşen yeni bir paylaşım veya uyarı kaydı bulunmadı; mevcut protokol ve saha akışı izlenmeye devam ediyor.`;

  return {
    query: cleanQuery,
    statusLabel,
    statusTone,
    matchedDistrict,
    matchedPosts,
    matchedAlerts,
    matchedProtocol,
    highlightedNodeIds,
    highlightedLinkIds,
    summary,
  };
}
