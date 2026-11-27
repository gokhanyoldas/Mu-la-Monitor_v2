// src/components/investigation/InterrogationRoomConsole.tsx
// Muğla Canlı Haber Doğrulama ve Kayıt Eşleştirme Konsolu
// Yalnızca gerçek veritabanı kayıtları (`social_posts`, `alert_events`, `protocol_members`) ile çalışır.

import React, { useState, useMemo } from "react";
import {
  Send,
  Radio,
  Search,
  FileCheck2,
  Scale,
  Users,
  Copy,
  Check,
  Bell,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";
import {
  runLiveCrossCheck,
  type LiveCrossCheckResult,
  type LiveDiagramDataset,
} from "@/services/liveDiagramBuilder";

interface InterrogationRoomConsoleProps {
  dataset: LiveDiagramDataset;
  onHighlightInvestigation?: (nodeIds: string[], linkIds: string[], dossierId?: string) => void;
  className?: string;
}

export const InterrogationRoomConsole: React.FC<InterrogationRoomConsoleProps> = ({
  dataset,
  onHighlightInvestigation,
  className = "",
}) => {
  const { lang, t } = useTranslation();
  const isEn = lang === "en";
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LiveCrossCheckResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Yalnızca gerçek güncel uyarılar ve haber başlıklarından hızlı seçim listesi üret
  const quickTopics = useMemo(() => {
    const items: Array<{ id: string; label: string; queryText: string; kind: "alert" | "post" }> = [];
    for (const al of dataset.alerts.slice(0, 3)) {
      if (al.title.trim()) {
        items.push({
          id: `al-${al.id}`,
          label: al.title.slice(0, 44),
          queryText: al.title,
          kind: "alert",
        });
      }
    }
    for (const p of dataset.posts.slice(0, 4)) {
      const clean = p.content.replace(/\s+/g, " ").trim();
      if (clean && !items.some((x) => x.label === clean.slice(0, 44))) {
        items.push({
          id: `sp-${p.id}`,
          label: clean.slice(0, 44),
          queryText: clean.slice(0, 90),
          kind: "post",
        });
      }
    }
    return items.slice(0, 5);
  }, [dataset.alerts, dataset.posts]);

  const handleCrossCheck = (questionText: string) => {
    const text = (questionText || query).trim();
    if (!text) return;
    setQuery(text);
    const res = runLiveCrossCheck(text, dataset);
    setResult(res);
    if (onHighlightInvestigation) {
      onHighlightInvestigation(res.highlightedNodeIds, res.highlightedLinkIds, "");
    }
  };

  const handleCopySummary = async () => {
    if (!result) return;
    try {
      const lines = [
        `MUĞLA MONİTÖR — CANLI DOĞRULAMA ÖZETİ`,
        `Sorgu: ${result.query}`,
        `Durum: ${result.statusLabel} (${result.matchedDistrict})`,
        `Özet: ${result.summary}`,
        `Eşleşen Paylaşımlar (${result.matchedPosts.length}):`,
        ...result.matchedPosts.map((p) => `  • [${p.platform}] ${p.content.slice(0, 120)}`),
        `Eşleşen Uyarılar (${result.matchedAlerts.length}):`,
        ...result.matchedAlerts.map((a) => `  • [${a.source}] ${a.title}`),
        `İlgili Resmi Makamlar (${result.matchedProtocol.length}):`,
        ...result.matchedProtocol.map((m) => `  • ${m.isim} — ${m.unvan}`),
      ].join("\n");
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      toast.success(isEn ? "Verification summary copied." : "Doğrulama özeti panoya kopyalandı.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(isEn ? "Copy failed." : "Kopyalama başarısız.");
    }
  };

  return (
    <div
      className={`rounded-xl border border-rose-950/70 bg-[#0a0710] shadow-2xl overflow-hidden font-mono ${className}`}
    >
      {/* ── Üst Konsol Başlığı ── */}
      <div className="p-3 border-b border-rose-950/60 bg-[#120a1c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-bold tracking-wider text-rose-100 flex items-center gap-2">
            <span>{t("HABER DOĞRULAMA KONSOLU")}</span>
          </h3>
        </div>

        <div className="text-[11px] text-rose-300/70 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-amber-400" />
          <span>
            {isEn
              ? `${dataset.posts.length} posts · ${dataset.alerts.length} alerts · ${dataset.protocolMembers.length} officials`
              : `${dataset.posts.length} paylaşım · ${dataset.alerts.length} uyarı · ${dataset.protocolMembers.length} protokol kaydı`}
          </span>
        </div>
      </div>

      {/* ── Canlı Kayıt Arama Girişi ── */}
      <div className="p-3.5 border-b border-rose-950/40 bg-[#0d0714] space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCrossCheck(query)}
              placeholder={
                isEn
                  ? "Search a district, topic, official, or news claim across live records..."
                  : "Doğrulamak istediğiniz ilçe, konu, makam veya haber başlığını yazın..."
              }
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#160d22] text-rose-100 border border-rose-900/60 rounded-lg focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder:text-rose-300/40"
            />
          </div>
          <Button
            type="button"
            onClick={() => handleCrossCheck(query)}
            disabled={!query.trim()}
            className="h-9 px-4 text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-900/30 gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
            <span>{isEn ? "Cross-Check" : "Kayıtlarda Ara"}</span>
          </Button>
        </div>

        {/* Yalnızca gerçek canlı başlıklardan hızlı seçim */}
        {quickTopics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 text-[10px] flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-400" />{" "}
              {isEn ? "Live Topics:" : "Güncel Gündem Kayıtları:"}
            </span>
            {quickTopics.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleCrossCheck(item.queryText)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                  item.kind === "alert"
                    ? "bg-amber-950/60 text-amber-200 border-amber-500/40 hover:border-amber-400"
                    : "bg-[#1a0f28] text-rose-200 border-rose-950 hover:border-rose-500 hover:text-white"
                }`}
              >
                {item.label}
                {item.label.length >= 44 ? "…" : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CANLI ÇAPRAZ EŞLEŞTİRME SONUCU ── */}
      {result ? (
        <div className="p-4 space-y-4">
          <div className="p-3.5 rounded-xl border border-rose-950 bg-[#130b1e] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`px-3 py-2 rounded-lg border-2 text-center uppercase tracking-wider font-mono font-bold ${
                  result.statusTone === "verified"
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500"
                    : result.statusTone === "monitoring"
                    ? "bg-amber-950/80 text-amber-300 border-amber-500"
                    : "bg-slate-900/80 text-slate-300 border-slate-600"
                }`}
              >
                <div className="text-[9px] opacity-75">{t("DOĞRULAMA SONUCU")}</div>
                <div className="text-xs sm:text-sm">{result.statusLabel}</div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{t("Bölge")}:</span>
                  <span className="text-xs font-bold text-white">{result.matchedDistrict}</span>
                </div>
                <p className="text-xs text-slate-200 font-sans mt-0.5">{result.summary}</p>
              </div>
            </div>

            <Button
              size="sm"
              type="button"
              onClick={handleCopySummary}
              className="h-7 text-xs font-mono font-bold bg-[#201132] hover:bg-[#2b1744] text-rose-200 border border-rose-800/60 cursor-pointer gap-1 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t("Kopyalandı") : t("Özeti Kopyala")}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Sol Kolon: Eşleşen Paylaşımlar & Uyarılar */}
            <div className="p-3 rounded-lg border border-rose-950/80 bg-[#0e0717] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-rose-300 uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isEn ? "Matched Posts & Alerts" : "Eşleşen Paylaşım & Uyarı Kayıtları"}</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {result.matchedPosts.length + result.matchedAlerts.length} {isEn ? "records" : "kayıt"}
                </span>
              </div>

              {result.matchedAlerts.length > 0 && (
                <div className="space-y-1.5">
                  {result.matchedAlerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-2 rounded border border-amber-500/30 bg-amber-500/5 text-[11px]"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                        <Bell className="w-3 h-3 shrink-0" />
                        <span className="font-bold">{al.source}</span>
                      </div>
                      <div className="text-white font-sans text-xs mt-0.5">{al.title}</div>
                      {al.body && (
                        <p className="text-slate-300 font-sans text-[11px] mt-0.5 line-clamp-2">{al.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.matchedPosts.length > 0 ? (
                <div className="space-y-1.5">
                  {result.matchedPosts.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 rounded border border-rose-950/60 bg-[#150c22] flex items-start justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <span className="text-cyan-400 font-bold uppercase">[{p.platform}]</span>
                          {p.districtName && <span>{p.districtName}</span>}
                          {p.author && <span className="truncate">· {p.author}</span>}
                        </div>
                        <p className="text-white font-sans text-xs mt-0.5 line-clamp-2">{p.content}</p>
                      </div>
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Kaynağa git"
                          className="text-cyan-400 hover:text-cyan-300 shrink-0 mt-0.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : result.matchedAlerts.length === 0 ? (
                <p className="text-xs font-sans text-slate-400 py-2">
                  {isEn
                    ? "No matching posts or alerts found for this query in the current stream."
                    : "Mevcut akışta bu sorguyla doğrudan eşleşen paylaşım veya uyarı kaydı bulunmadı."}
                </p>
              ) : null}
            </div>

            {/* Sağ Kolon: İlgili Resmi Makamlar & Protokol Eşleşmesi */}
            <div className="p-3 rounded-lg border border-rose-950/80 bg-[#0d0716] space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-rose-900/40 text-xs font-bold text-emerald-300 uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isEn ? "Relevant Official Authorities" : "İlgili Resmi Makamlar & Protokol"}</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {result.matchedProtocol.length} {isEn ? "officials" : "yetkili"}
                </span>
              </div>

              {result.matchedProtocol.length > 0 ? (
                <div className="space-y-1.5">
                  {result.matchedProtocol.map((m) => (
                    <div
                      key={`${m.id}-${m.isim}`}
                      className="p-2 rounded bg-[#150a22] border border-emerald-900/50 font-sans"
                    >
                      <div className="font-mono text-xs font-bold text-white">{m.isim}</div>
                      <div className="text-[11px] text-emerald-300/90 mt-0.5">{m.unvan}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{m.kategori}</span>
                        {m.district && <span>· {m.district}</span>}
                        {m.telefon && <span>· {m.telefon}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-sans text-slate-400 py-2">
                  {isEn
                    ? "Use a district name (Bodrum, Marmaris, Fethiye, Menteşe...) or official title to see matching protocol authorities."
                    : "İlgili resmi makam eşleşmelerini görmek için ilçe adı veya kurum/unvan belirterek arama yapabilirsiniz."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-xs font-sans text-slate-400 flex items-center justify-between gap-2">
          <span>
            {isEn
              ? "Select a live topic above or enter a keyword to cross-reference posts, alerts, and official protocol records."
              : "Yukarıdaki güncel gündem kayıtlarından birini seçin veya bir anahtar kelime yazarak canlı paylaşımlar, uyarılar ve protokol kayıtları arasında çapraz doğrulama yapın."}
          </span>
        </div>
      )}
    </div>
  );
};
