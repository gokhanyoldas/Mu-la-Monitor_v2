// src/components/dashboard/CrisisProtocolDrawer.tsx
// Muğla Monitor v2 - İlçe / Düğüm Kriz Yönetimi & Protokol Komuta Zinciri Paneli (Faz 4)

import React, { useState } from "react";
import {
  NodeCrisisInfo,
  CrisisContact,
  generateCrisisDispatchText
} from "@/data/crisisProtocolChain";
import {
  ShieldAlert,
  Phone,
  Copy,
  Check,
  X,
  AlertTriangle,
  Building2,
  Navigation,
  ExternalLink,
  Radio,
  Flame,
  Droplets,
  BadgeAlert,
  UserCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CrisisProtocolDrawerProps {
  crisisInfo: NodeCrisisInfo;
  isOpen: boolean;
  onClose: () => void;
  onSelectConnectedNode?: (nodeId: string) => void;
  connectedNodes?: { id: string; name: string; relation: string; style: string }[];
  isTerracotta?: boolean;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  mulki_amiri: <ShieldAlert className="w-4 h-4 text-amber-400" />,
  belediye: <Building2 className="w-4 h-4 text-sky-400" />,
  kolluk: <UserCheck className="w-4 h-4 text-emerald-400" />,
  afet_acil: <Flame className="w-4 h-4 text-red-400" />,
  altyapi_su: <Droplets className="w-4 h-4 text-cyan-400" />,
  saglik: <BadgeAlert className="w-4 h-4 text-rose-400" />
};

export const CrisisProtocolDrawer: React.FC<CrisisProtocolDrawerProps> = ({
  crisisInfo,
  isOpen,
  onClose,
  onSelectConnectedNode,
  connectedNodes = [],
  isTerracotta = false
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyDispatch = async () => {
    try {
      const text = generateCrisisDispatchText(crisisInfo);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${crisisInfo.nodeName} kriz brifingi panoya kopyalandı!`, {
        description: "Telsiz, SMS ve WhatsApp koordinasyon formatında hazırlandı."
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Kopyalama başarısız oldu.");
    }
  };

  const primaryContact = crisisInfo.contacts.find((c) => c.isPrimary) || crisisInfo.contacts[0];

  const cardBg = isTerracotta
    ? "bg-[#380e28]/95 border-[#5c1c44] text-[#fce5df]"
    : "bg-[#0b1220]/95 border-slate-700/80 text-slate-100";

  return (
    <div
      className={`absolute top-2 right-2 bottom-2 w-full max-w-[390px] sm:max-w-[430px] z-30 rounded-xl border shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-right-5 ${cardBg}`}
    >
      {/* ── Üst Başlık & Acil Durum Rozeti ── */}
      <div className={`p-3.5 border-b flex items-start justify-between gap-2 ${isTerracotta ? "border-[#5c1c44] bg-[#29081c]/80" : "border-slate-800 bg-[#070b14]/90"}`}>
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-[10px] font-mono tracking-wider uppercase font-bold text-red-400">
              Kriz & Protokol Komuta Zinciri (Faz 4)
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-base font-bold font-mono tracking-wide text-white">
              {crisisInfo.nodeName}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
              {crisisInfo.emergencyCode}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
              crisisInfo.riskScore > 70 
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                : crisisInfo.riskScore > 50 
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            }`}>
              Risk: %{crisisInfo.riskScore}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1 font-sans leading-tight">
            🏛️ {crisisInfo.commandHub}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Kapat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Hızlı Aksiyon Araç Çubuğu ── */}
      <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 text-xs font-mono ${isTerracotta ? "border-[#5c1c44] bg-[#310c24]/50" : "border-slate-800/80 bg-slate-900/60"}`}>
        <Button
          size="sm"
          onClick={handleCopyDispatch}
          className="h-8 gap-1.5 text-xs font-mono font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-sm"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Kopyalandı!" : "Kriz Brifingi Kopyala"}</span>
        </Button>

        {primaryContact && (
          <a
            href={`tel:${primaryContact.telefon.replace(/\s+/g, "")}`}
            className="h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Mülki Amiri Ara</span>
          </a>
        )}
      </div>

      {/* ── Kaydırılabilir İçerik Alanı ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs font-sans scrollbar-thin">
        
        {/* 1. Mülki İdare Amiri & Yetkili Protokol Kadrosu */}
        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] font-mono text-slate-300">
            <span className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Protokol & Yetkili Komuta Kadrosu
            </span>
            <span className="text-[10px] opacity-75">{crisisInfo.contacts.length} Yetkili</span>
          </div>

          <div className="space-y-2 mt-2.5">
            {crisisInfo.contacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-2.5 rounded-lg border transition-all ${
                  contact.isPrimary
                    ? isTerracotta
                      ? "bg-[#451435] border-amber-500/50 shadow-md"
                      : "bg-[#101b30] border-amber-500/40 shadow-md"
                    : isTerracotta
                    ? "bg-[#2d0a21]/70 border-white/10 hover:border-white/20"
                    : "bg-[#0f172a]/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {ROLE_ICONS[contact.roleTag] || <Building2 className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-slate-300">
                      {contact.roleLabel}
                    </span>
                  </div>
                  {contact.isPrimary && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      1. DERECE
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <div className="text-sm font-bold text-white tracking-wide">
                    {contact.isim}
                  </div>
                  <div className="text-[11px] text-slate-300 font-medium">
                    {contact.unvan}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {contact.kurum}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-300 flex items-center gap-1">
                    📞 {contact.telefon}
                    {contact.dahili && <span className="opacity-75">/ Dahili: {contact.dahili}</span>}
                  </span>
                  <a
                    href={`tel:${contact.telefon.replace(/\s+/g, "")}`}
                    className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 text-[10px] font-bold"
                  >
                    Ara <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Öncelikli Kriz & Güvenlik Riskleri */}
        <div className={`p-3 rounded-lg border ${isTerracotta ? "bg-[#29081c]/60 border-[#5c1c44]" : "bg-[#090f1d] border-slate-800"}`}>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            Öncelikli Kriz Risk Başlıkları
          </div>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-200">
            {crisisInfo.keyRisks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-red-400 font-mono font-bold mt-0.5">›</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Tahliye ve Acil Müdahale Güzergahları */}
        <div className={`p-3 rounded-lg border ${isTerracotta ? "bg-[#29081c]/60 border-[#5c1c44]" : "bg-[#090f1d] border-slate-800"}`}>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wide">
            <Navigation className="w-3.5 h-3.5" />
            Tahliye & Acil İntikal Güzergahları
          </div>
          <div className="mt-2 space-y-1 text-[11px] text-slate-200">
            {crisisInfo.contingencyRoutes.map((route, idx) => (
              <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{route}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Ağdaki Bağlantılı Komşu Düğümler & Kriz Yayılımı */}
        {connectedNodes.length > 0 && (
          <div>
            <div className="flex items-center justify-between pb-1 text-[11px] font-mono text-slate-300">
              <span className="font-bold uppercase tracking-wider text-sky-300">
                Ağ Etki & Bağlantılı Merkezler ({connectedNodes.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {connectedNodes.map((cn) => (
                <button
                  key={cn.id}
                  type="button"
                  onClick={() => onSelectConnectedNode && onSelectConnectedNode(cn.id)}
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                    isTerracotta
                      ? "bg-[#451435] border-white/10 hover:border-amber-400 text-[#fce5df]"
                      : "bg-[#101b30] border-slate-700 hover:border-emerald-400 text-slate-200"
                  }`}
                  title={`${cn.name}: ${cn.relation}`}
                >
                  <span className="font-bold">{cn.name}</span>
                  <span className="text-[9px] opacity-75">({cn.relation.split(" ")[0]})</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Alt Durum Çubuğu ── */}
      <div className={`p-2.5 border-t text-[10px] font-mono text-center ${isTerracotta ? "border-[#5c1c44] bg-[#29081c]/90 text-[#fce5df]/70" : "border-slate-800 bg-[#070b14]/90 text-slate-400"}`}>
        <span>Muğla Valiliği Resmi Protokol Verisi · Canlı Kriz Koordinasyon Masası</span>
      </div>
    </div>
  );
};
