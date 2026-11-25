// src/components/investigation/InterrogationRoomConsole.tsx
// Muğla İstihbarat & Çapraz Sorgu Masası Konsolu (The Interrogation Room)

import React, { useState } from "react";
import {
  interrogateIntelligence,
  InterrogationResult
} from "@/services/investigationService";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import {
  Mic,
  Send,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Search,
  Sparkles,
  FileCheck2,
  Scale,
  Users,
  Copy,
  Check,
  Flame,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";

interface InterrogationRoomConsoleProps {
  onHighlightInvestigation?: (nodeIds: string[], linkIds: string[], dossierId?: string) => void;
  onOpenProtocolNetwork?: (focusTerm: string) => void;
  className?: string;
}

const SAMPLE_QUESTIONS = [
  "Bodrum'daki su kesintisiyle ilgili ihale usulsüzlüğü dedikodusu doğru mu?",
  "Datça Balıkaşıran yolu 3 gün kapanacak ses kaydı gerçek mi?",
  "Marmaris Bozburun koyları gizlice kiralandı mı, kaçak iskeleler ne durumda?",
  "Fethiye körfez dip tarama bütçesi iptal edildi söylentisinin aslı var mı?"
];

export const InterrogationRoomConsole: React.FC<InterrogationRoomConsoleProps> = ({
  onHighlightInvestigation,
  onOpenProtocolNetwork,
  className = ""
}) => {
  const { arbitratedEvents, activeDynamicDossierId, setActiveDynamicDossierId } = useUnifiedIntelligence();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterrogationResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Yeni sahadan analiz geldiğinde ODİT dosyasına otomatik geç
  React.useEffect(() => {
    if (arbitratedEvents.length > 0) {
      const targetEvt =
        (activeDynamicDossierId && arbitratedEvents.find((e) => e.dossier.id === activeDynamicDossierId)) ||
        arbitratedEvents[0];
      if (targetEvt) {
        setResult(targetEvt.interrogationResult);
        setQuery(targetEvt.rawText.slice(0, 140));
        if (onHighlightInvestigation) {
          onHighlightInvestigation(
            targetEvt.interrogationResult.highlightedNodeIds,
            targetEvt.interrogationResult.highlightedLinkIds,
            targetEvt.dossier.id
          );
        }
        return;
      }
    }
    handleInterrogate(SAMPLE_QUESTIONS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbitratedEvents, activeDynamicDossierId]);

  const handleInterrogate = async (questionText: string) => {
    const text = (questionText || query).trim();
    if (!text) return;

    setLoading(true);
    setQuery(text);

    try {
      const res = await interrogateIntelligence(text);
      setResult(res);

      if (onHighlightInvestigation) {
        onHighlightInvestigation(
          res.highlightedNodeIds,
          res.highlightedLinkIds,
          res.matchedDossier?.id
        );
      }
    } catch {
      toast.error("Sorgulama motorunda hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!result) return;
    try {
      const transcriptText = `🎙️ [MUĞLA MONITOR v2] SORGU ODASI ÇAPRAZ TEYİT TUTANAĞI
─────────────────────────────────────────────
Soru: ${result.query}
Hüküm: ${result.verdict} (Doğruluk: %${result.verdictScore})
İlgili Dosya: ${result.matchedDossier?.title}

🚨 TESPİT EDİLEN ÇELİŞKİLER:
${result.contradictions.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}

⚖️ KANIT VE TEBLİGAT ZİNCİRİ:
${result.chainOfEvidence.map((e) => `  • [${e.sourceType}] ${e.sourceName} ➔ ${e.verdict} (%${e.credibility})`).join("\n")}

🎯 ÖNERİLEN İSTİHBARAT AKSİYONU:
${result.recommendedAction}
─────────────────────────────────────────────`;

      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      toast.success("Sorgu tutanağı panoya kopyalandı!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Kopyalama başarısız.");
    }
  };

  return (
    <div className={`rounded-xl border border-rose-950/70 bg-[#0a0710] shadow-2xl overflow-hidden font-mono ${className}`}>
      
      {/* ── Üst Konsol Başlığı (Kasetçalar / Telsiz Stili) ── */}
      <div className="p-3 border-b border-rose-950/60 bg-[#120a1c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
          </span>
          <h3 className="text-sm font-bold tracking-wider text-rose-100 flex items-center gap-2">
            <span>{t("HABER DOĞRULAMA KONSOLU")}</span>
          </h3>
        </div>

        <div className="text-[11px] text-rose-300/70 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-amber-400" />
          <span>{t("Yerel Haberler · Sosyal Medya · Resmi Açıklamalar")}</span>
        </div>
      </div>

      {/* ── Soru Sorma Girişi & Hızlı Butonlar ── */}
      <div className="p-3.5 border-b border-rose-950/40 bg-[#0d0714] space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInterrogate(query)}
              placeholder={t("Sorgulamak istediğiniz kulis dedikodusu, şüpheli haber veya iddiayı yazın...")}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#160d22] text-rose-100 border border-rose-900/60 rounded-lg focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder:text-rose-300/40"
            />
          </div>
          <Button
            onClick={() => handleInterrogate(query)}
            disabled={loading || !query.trim()}
            className="h-9 px-4 text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-900/30 gap-1.5 shrink-0"
          >
            {loading ? (
              <Radio className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
            <span>{loading ? t("Sorgulanıyor...") : t("Çapraz Sorgula")}</span>
          </Button>
        </div>

        {/* Örnek ve Güncel Konular */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-400 text-[10px] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> {t("Örnek Konular")} · DEMO :
          </span>
          {arbitratedEvents.map((evt) => (
            <button
              key={evt.dossier.id}
              type="button"
              onClick={() => {
                setActiveDynamicDossierId(evt.dossier.id);
                setResult(evt.interrogationResult);
                if (onHighlightInvestigation) {
                  onHighlightInvestigation(
                    evt.interrogationResult.highlightedNodeIds,
                    evt.interrogationResult.highlightedLinkIds,
                    evt.dossier.id
                  );
                }
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/60 transition-all cursor-pointer font-bold"
            >
              {evt.districtName} — {evt.dossier.title.slice(0, 32)}
            </button>
          ))}
          {SAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleInterrogate(q)}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1a0f28] text-rose-200 border border-rose-950 hover:border-rose-500 hover:text-white transition-all cursor-pointer"
            >
              {q.slice(0, 38)}...
            </button>
          ))}
        </div>
      </div>

      {/* ── SORGU SONUCU VE ÇAPRAZ TEYİT BRİFİNGİ ── */}
      {result && (
        <div className="p-4 space-y-4">
          
          {/* 1. HÜKÜM & TEYİT DAMGASI (Verdict Stamp) */}
          <div className="p-3.5 rounded-xl border border-rose-950 bg-[#130b1e] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              {/* Damga Kutusu */}
              <div className={`px-3 py-2 rounded-lg border-2 text-center uppercase tracking-widest font-mono font-black rotate-[-2deg] shadow-lg ${
                result.verdict === "YALANLANDI / DEZENFORMASYON"
                  ? "bg-rose-950/80 text-rose-400 border-rose-500"
                  : result.verdict === "DOĞRULANDI"
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-500"
                  : "bg-amber-950/80 text-amber-400 border-amber-500"
              }`}>
                <div className="text-[9px] opacity-75">{t("DOĞRULAMA SONUCU")}</div>
                <div className="text-sm sm:text-base">{result.verdict}</div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{t("Bölge")}:</span>
                  <span className="text-xs font-bold text-white">{result.matchedDossier?.districtName}</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">
                  {result.matchedDossier?.title}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
              {onOpenProtocolNetwork && (
                <Button
                  size="sm"
                  type="button"
                  data-testid="jump-to-protocol-network-btn"
                  onClick={() =>
                    onOpenProtocolNetwork(
                      result.matchedDossier?.districtName ||
                        result.matchedDossier?.title ||
                        "Muğla"
                    )
                  }
                  className="h-7 text-xs font-mono font-bold bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/50 cursor-pointer gap-1"
                >
                  <span>Protokol İlişki Ağı</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleCopyTranscript}
                className="h-7 text-xs font-mono font-bold bg-[#201132] hover:bg-[#2b1744] text-rose-200 border border-rose-800/60 cursor-pointer gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t("Kopyalandı") : t("Tutanağı Kopyala")}</span>
              </Button>
            </div>
          </div>

          {/* 2. İKİ KOLONLU ÇAPRAZ TAHLİL (Çelişkiler & Canlı Diyalog) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            
            {/* Sol Kolon: Tespit Edilen Çelişkiler & Kanıt Zinciri */}
            <div className="space-y-3">
              {/* Çelişki Kutusu */}
              <div className="p-3 rounded-lg border border-amber-500/30 bg-[#161009] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>{t("Çapraz Teyitte Saptanan Çelişkiler")}</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-amber-200/90 font-sans">
                  {result.contradictions.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-mono font-bold mt-0.5">⚠️</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Kanıt ve Belge Matrisi */}
              <div className="p-3 rounded-lg border border-rose-950/80 bg-[#0e0717] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-300 uppercase tracking-wide">
                  <span className="flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t("Kaynak Güvenilirlik & Kanıt Zinciri")}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{result.chainOfEvidence.length} {t("Delil")}</span>
                </div>

                <div className="space-y-1.5">
                  {result.chainOfEvidence.map((ev, i) => (
                    <div key={i} className="p-2 rounded border border-rose-950/60 bg-[#150c22] flex items-center justify-between text-[11px]">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <span className="text-rose-400 font-bold">[{ev.sourceType}]</span>
                          <span className="truncate">{ev.sourceName}</span>
                        </div>
                        <div className="text-white font-sans text-xs truncate mt-0.5">{ev.claim}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          ev.credibility > 75 ? "bg-emerald-500/20 text-emerald-300" : ev.credibility > 40 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"
                        }`}>
                          %{ev.credibility}
                        </span>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{ev.verdict}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sağ Kolon: Sorgu Odası Tutanak Transkripti (Kim Ne Dedi?) */}
            <div className="p-3.5 rounded-lg border border-rose-950/80 bg-[#0d0716] flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-1.5 border-b border-rose-900/40 text-xs font-bold text-rose-300 uppercase tracking-wide">
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t("Sorgu Odası Transkripti (Tarafların İfadeleri)")}</span>
                  </span>
                  <span className="text-[9px] font-mono text-rose-400">{t("RESMİ ZABIT")}</span>
                </div>

                <div className="space-y-2 mt-2.5">
                  {result.interrogationTranscript.map((item, idx) => (
                    <div key={idx} className="text-xs p-2 rounded bg-[#150a22] border border-rose-950/70 font-sans">
                      <div className="font-mono text-[10px] font-bold text-amber-300 flex items-center gap-1">
                        <span>▶ {item.speaker}:</span>
                      </div>
                      <p className="text-slate-200 mt-0.5 italic">
                        "{item.text}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Önerilen İstihbari Aksiyon */}
              <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-[#081512] text-xs font-sans">
                <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  🎯 {t("ÖNERİLEN İSTİHBARİ AKSİYON:")}
                </span>
                <p className="text-emerald-200/90 text-[11px] mt-0.5">
                  {result.recommendedAction}
                </p>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
};
