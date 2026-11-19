// src/services/investigationService.ts
// Muğla İstihbarat & Çapraz Sorgu Odası Motoru (Interrogation & OSINT Analysis Engine)

import {
  INVESTIGATION_DOSSIERS as DOSSIERS,
  INVESTIGATION_NODES as NODES,
  INVESTIGATION_LINKS as LINKS,
  InvestigationDossier,
  InvestigationNode,
  InvestigationLink
} from "@/data/investigationData";

export interface InterrogationResult {
  query: string;
  matchedDossier: InvestigationDossier | null;
  verdict: "DOĞRULANDI" | "KISMİ DOĞRU / ÇELİŞKİLİ" | "YALANLANDI / DEZENFORMASYON" | "KULİS / TEYİT BEKLİYOR";
  verdictScore: number; // 0 - 100
  verdictColor: string;
  summary: string;
  contradictions: string[];
  chainOfEvidence: {
    sourceType: string;
    sourceName: string;
    claim: string;
    credibility: number;
    verdict: string;
  }[];
  actorsInvolved: {
    name: string;
    role: string;
    stance: "Suçlanan / Hedef" | "Açıklama Yapan" | "Kaynak" | "Yayan";
  }[];
  interrogationTranscript: {
    speaker: "Soruşturmacı" | "Kulis Kaynağı" | "Yerel Basın" | "Resmi Tutanak";
    text: string;
  }[];
  highlightedNodeIds: string[];
  highlightedLinkIds: string[];
  recommendedAction: string;
}

/**
 * Sorgu Odası Çapraz Tahlil Fonksiyonu:
 * Kullanıcının sorusunu yerel haberler, kulis iddiaları ve resmi tutanaklarla çapraz sorgular.
 */
export async function interrogateIntelligence(query: string): Promise<InterrogationResult> {
  const lowerQuery = query.toLowerCase();

  // 1. En uygun dosyayı tespit et
  let matchedDossier = DOSSIERS.find((d) => {
    if (lowerQuery.includes(d.districtId) || lowerQuery.includes(d.districtName.toLowerCase())) return true;
    if (d.category.toLowerCase().split(" ").some((w) => lowerQuery.includes(w))) return true;
    if (d.interrogationPromptQuestions.some((q) => q.toLowerCase().split(" ").some((w) => w.length > 4 && lowerQuery.includes(w)))) return true;
    return false;
  });

  // Eğer doğrudan dosya bulunamazsa varsayılan olarak en kritik olanı (Bodrum veya Marmaris) seç
  if (!matchedDossier) {
    if (lowerQuery.includes("su") || lowerQuery.includes("ihale") || lowerQuery.includes("muski") || lowerQuery.includes("baraj")) {
      matchedDossier = DOSSIERS[0]; // Bodrum
    } else if (lowerQuery.includes("koy") || lowerQuery.includes("kiralama") || lowerQuery.includes("sit") || lowerQuery.includes("marmaris")) {
      matchedDossier = DOSSIERS[1]; // Marmaris
    } else if (lowerQuery.includes("körfez") || lowerQuery.includes("balçık") || lowerQuery.includes("gemi") || lowerQuery.includes("fethiye")) {
      matchedDossier = DOSSIERS[2]; // Fethiye
    } else if (lowerQuery.includes("balıkaşıran") || lowerQuery.includes("yol") || lowerQuery.includes("datça") || lowerQuery.includes("kapan")) {
      matchedDossier = DOSSIERS[3]; // Datça
    } else {
      matchedDossier = DOSSIERS[0];
    }
  }

  // İlgili düğümleri ve bağlantıları filtrele
  const relevantNodes = NODES.filter((n) => matchedDossier!.nodeIds.includes(n.id));
  const relevantLinks = LINKS.filter((l) => matchedDossier!.linkIds.includes(l.id));

  // Kanıt zinciri oluştur
  const chainOfEvidence = relevantNodes.map((node) => ({
    sourceType: node.label,
    sourceName: node.source,
    claim: node.title,
    credibility: node.credibilityScore,
    verdict: node.status === "dogrulandi" ? "Resmi Teyitli" : node.status === "yalanlandi" ? "Çürütüldü" : "Şüpheli"
  }));

  // Çelişkileri tespit et (isContradiction olan bağlantılar)
  const contradictions = relevantLinks
    .filter((l) => l.isContradiction)
    .map((l) => `${l.label}: ${l.evidenceQuote}`);

  if (contradictions.length === 0) {
    contradictions.push("Resmi açıklamalar ile yerel fısıltı iddiaları arasındaki teknik tarih tutarsızlığı.");
  }

  // Aktörler ve tutumları
  const actorsInvolved = [
    { name: matchedDossier.districtName + " Kaymakamlığı", role: "Mülki İdare Amiri", stance: "Açıklama Yapan" as const },
    { name: "Telegram / Anonim Kulis Odası", role: "Söylenti Kaynağı", stance: "Kaynak" as const },
    { name: "İlgili İdare / Daire Başkanlığı", role: "Hizmet Sağlayıcı", stance: "Suçlanan / Hedef" as const },
    { name: "Yerel Saha Basını", role: "Bağımsız Gözlemci", stance: "Açıklama Yapan" as const }
  ];

  // Teyit Hükmü Belirleme
  let verdict: InterrogationResult["verdict"] = "KISMİ DOĞRU / ÇELİŞKİLİ";
  let verdictColor = "text-amber-400";
  if (matchedDossier.verdictScore <= 15) {
    verdict = "YALANLANDI / DEZENFORMASYON";
    verdictColor = "text-rose-500";
  } else if (matchedDossier.verdictScore >= 80) {
    verdict = "DOĞRULANDI";
    verdictColor = "text-emerald-400";
  }

  // Canlı Sorgu Transkripti (Soruşturmacı Masası Diyaloğu)
  const interrogationTranscript: InterrogationResult["interrogationTranscript"] = [
    {
      speaker: "Soruşturmacı",
      text: `"${query}" iddiasının kaynağı, doğruluğu ve tarafların savunması nedir?`
    },
    {
      speaker: "Kulis Kaynağı",
      text: relevantNodes.find((n) => n.type === "kulis_dedikodu")?.claimSummary || "Kapalı gruplarda yayılan iddialar."
    },
    {
      speaker: "Yerel Basın",
      text: relevantNodes.find((n) => n.type === "yerel_haber")?.claimSummary || "Saha muhabirinin olay yerindeki ilk gözlemleri."
    },
    {
      speaker: "Resmi Tutanak",
      text: relevantNodes.find((n) => n.type === "resmi_teyit")?.claimSummary || matchedDossier.officialVerdict
    }
  ];

  // Önerilen istihbari aksiyon
  let recommendedAction = "Resmi tekzip yayınlanması ve saha fotoğraflarıyla kamuoyunun ivedilikle bilgilendirilmesi.";
  if (verdict === "YALANLANDI / DEZENFORMASYON") {
    recommendedAction = "Sosyal medyadaki bot hesap dalgası tespit edilerek Dezenformasyonla Mücadele Merkezi ve savcılık koordinesi başlatılmalıdır.";
  } else if (verdict === "DOĞRULANDI") {
    recommendedAction = "Halkla İlişkiler birimi şeffaf kriz masası oluşturmalı, tamir/tamamlama saatini canlı duyurmalıdır.";
  }

  return {
    query,
    matchedDossier,
    verdict,
    verdictScore: matchedDossier.verdictScore,
    verdictColor,
    summary: matchedDossier.summary,
    contradictions,
    chainOfEvidence,
    actorsInvolved,
    interrogationTranscript,
    highlightedNodeIds: matchedDossier.nodeIds,
    highlightedLinkIds: matchedDossier.linkIds,
    recommendedAction
  };
}
