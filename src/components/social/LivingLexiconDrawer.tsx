import React, { useMemo, useState } from "react";
import { BookOpen, Plus, Search, Sparkles, Lock, Layers, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import {
  LEXICON_LAYER_META,
  type LexiconLayer,
} from "@/services/livingLexiconService";

const ALL_LAYERS: LexiconLayer[] = ["core", "micro_geo", "protocol_subtext", "field_jargon"];

export const LivingLexiconDrawer: React.FC = () => {
  const {
    lexicon,
    lexiconCountByLayer,
    newlyLearnedCount,
    isLexiconDrawerOpen,
    setLexiconDrawerOpen,
    addLexiconTerm,
  } = useUnifiedIntelligence();

  const [selectedLayer, setSelectedLayer] = useState<LexiconLayer | "all" | "new">("all");
  const [search, setSearch] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newLayer, setNewLayer] = useState<LexiconLayer>("field_jargon");
  const [newDistrict, setNewDistrict] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return lexicon
      .filter((entry) => {
        if (selectedLayer === "new") return Boolean(entry.isNewlyLearned);
        if (selectedLayer !== "all" && entry.layer !== selectedLayer) return false;
        if (q && !entry.term.toLocaleLowerCase("tr-TR").includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isNewlyLearned && !b.isNewlyLearned) return -1;
        if (!a.isNewlyLearned && b.isNewlyLearned) return 1;
        return b.hitCount - a.hitCount;
      });
  }, [lexicon, selectedLayer, search]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;
    addLexiconTerm(newTerm.trim(), newLayer, newDistrict.trim() || undefined);
    setNewTerm("");
  };

  return (
    <Dialog open={isLexiconDrawerOpen} onOpenChange={setLexiconDrawerOpen}>
      <DialogContent className="sm:max-w-[780px] max-h-[88vh] overflow-hidden flex flex-col bg-[#080b12] border border-border text-foreground font-mono">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base font-bold text-primary">
              <BookOpen className="w-4 h-4 text-primary" />
              <span>Takip Edilen Kavramlar ve Bölge Sözlüğü</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-bold">
                TOPLAM: {lexicon.length} TERİM
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                +{newlyLearnedCount} YENİ EKLENEN
              </span>
            </div>
          </div>
          <DialogDescription className="text-[11px] font-sans text-muted-foreground">
            Muğla geneli ilçe, mevki, kurum ve gündem kavramları otomatik olarak güncellenir; mevcut terimler korunur.
          </DialogDescription>
        </DialogHeader>

        {/* Katman Filtreleri */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <button
            type="button"
            onClick={() => setSelectedLayer("all")}
            className={`px-2.5 py-1 rounded text-[10px] border transition-colors ${
              selectedLayer === "all"
                ? "bg-primary text-primary-foreground border-primary font-bold"
                : "bg-secondary/30 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            Tümü ({lexicon.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedLayer("new")}
            className={`px-2.5 py-1 rounded text-[10px] border transition-colors flex items-center gap-1 ${
              selectedLayer === "new"
                ? "bg-emerald-600 text-white border-emerald-400 font-bold"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Yeni Öğrenilenler ({newlyLearnedCount})
          </button>
          {ALL_LAYERS.map((layer) => {
            const meta = LEXICON_LAYER_META[layer] ?? LEXICON_LAYER_META.core;
            return (
              <button
                key={layer}
                type="button"
                onClick={() => setSelectedLayer(layer)}
                className={`px-2.5 py-1 rounded text-[10px] border transition-colors flex items-center gap-1 ${
                  selectedLayer === layer
                    ? "bg-secondary text-foreground border-primary font-bold"
                    : "bg-secondary/20 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {layer === "core" && <Lock className="w-2.5 h-2.5 text-sky-400" />}
                <span>{meta.shortLabel} ({lexiconCountByLayer[layer]})</span>
              </button>
            );
          })}
        </div>

        {/* Arama ve Yeni Terim Ekleme */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sözlükte mevki, kişi, jargon ara..."
              className="w-full h-8 pl-8 pr-2 rounded bg-background border border-border text-xs font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <form onSubmit={handleAdd} className="sm:col-span-7 flex items-center gap-1.5">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Yeni saha kelimesi / mevki ekle..."
              className="flex-1 h-8 px-2.5 rounded bg-background border border-border text-xs font-mono focus:outline-none focus:border-primary"
            />
            <select
              value={newLayer}
              onChange={(e) => setNewLayer(e.target.value as LexiconLayer)}
              className="h-8 px-1.5 rounded bg-background border border-border text-[10px] font-mono"
            >
              <option value="micro_geo">Mevki</option>
              <option value="protocol_subtext">Protokol/İma</option>
              <option value="field_jargon">Saha/Proje</option>
            </select>
            <input
              type="text"
              value={newDistrict}
              onChange={(e) => setNewDistrict(e.target.value)}
              placeholder="İlçe"
              className="w-20 h-8 px-2 rounded bg-background border border-border text-[10px] font-mono"
            />
            <button
              type="submit"
              className="h-8 px-2.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" /> Ekle
            </button>
          </form>
        </div>

        {/* Terim Listesi */}
        <div className="flex-1 overflow-y-auto pr-1 mt-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Eşleşen sözlük terimi bulunamadı.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((entry) => {
                const meta = LEXICON_LAYER_META[entry.layer] ?? LEXICON_LAYER_META.core;
                return (
                  <div
                    key={entry.normalized}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${
                      entry.isNewlyLearned
                        ? "bg-emerald-950/50 border-emerald-400/60 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                        : meta.badgeClass
                    }`}
                    title={`${meta.label}${entry.district ? ` · İlçe: ${entry.district}` : ""} · Eşleşme: ${entry.hitCount}`}
                  >
                    {entry.layer === "core" && <Lock className="w-2.5 h-2.5 opacity-70" />}
                    {entry.isNewlyLearned && <Sparkles className="w-2.5 h-2.5 text-emerald-300" />}
                    <span className="font-semibold">{entry.term}</span>
                    {entry.district && (
                      <span className="text-[9px] opacity-75">[{entry.district}]</span>
                    )}
                    {entry.hitCount > 1 && (
                      <span className="text-[9px] px-1 rounded bg-black/30 opacity-85">
                        ×{entry.hitCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-primary" />
            Bölge, Mevki, Kurum ve Gündem Kavramları
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Kayıt Koruması Aktif
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
