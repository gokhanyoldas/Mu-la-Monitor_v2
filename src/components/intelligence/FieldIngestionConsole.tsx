import React, { useRef, useState } from "react";
import {
  Send,
  ImagePlus,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Layers,
  BookOpen,
  Eye,
  Radio,
} from "lucide-react";
import { useUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import {
  FIELD_INGESTION_PRESETS,
  type ArbitratedFieldEvent,
} from "@/services/fieldArbitrationEngine";
import { toast } from "sonner";

interface FieldIngestionConsoleProps {
  compact?: boolean;
  onArbitrated?: (event: ArbitratedFieldEvent) => void;
  className?: string;
}

export const FieldIngestionConsole: React.FC<FieldIngestionConsoleProps> = ({
  compact = false,
  onArbitrated,
  className = "",
}) => {
  const {
    ingestFieldSubmission,
    isIngesting,
    latestEvent,
    lexicon,
    setLexiconDrawerOpen,
  } = useUnifiedIntelligence();

  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Görsel boyutu en fazla 6 MB olabilir.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageBase64(reader.result);
        setImageMimeType(file.type || "image/jpeg");
        setImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async (customText?: string) => {
    const payloadText = (customText ?? text).trim();
    if (!payloadText && !imageBase64) {
      toast.error("Lütfen sahadan bir paylaşım metni girin veya görsel yükleyin.");
      return;
    }
    try {
      const event = await ingestFieldSubmission({
        text: payloadText,
        imageBase64,
        imageMimeType,
        imageName,
      });
      toast.success(
        `${event.dossier.code}: ${event.issues.length} sorun ayrıştırıldı ve ${event.updatedTabs.length} sekme çapraz güncellendi!`,
        {
          description: event.trafficPatch?.sensorDiscrepancy
            ? event.trafficPatch.verdictMessage
            : event.executiveSummary,
        }
      );
      if (onArbitrated) onArbitrated(event);
    } catch {
      toast.error("Saha analizi sırasında hata oluştu.");
    }
  };

  const handlePresetClick = async (presetText: string) => {
    setText(presetText);
    await runAnalysis(presetText);
  };

  return (
    <div
      className={`rounded-xl border border-primary/30 bg-[#080d16] shadow-xl overflow-hidden font-mono ${className}`}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border/60 bg-secondary/30 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary animate-pulse" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-wide">
              Sahadan Paylaşım / Görsel Besle ve Çapraz Doğrula
            </h3>
            <p className="text-[10px] font-sans text-muted-foreground">
              Çoklu Sorun Ayrıştırıcı · Kulis/İma Çözümleyici · Tüm Sekmeler Arası Hakem Motoru
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLexiconDrawerOpen(true)}
          className="px-2.5 py-1 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1.5 transition-colors"
        >
          <BookOpen className="w-3 h-3" />
          <span>Yaşayan Sözlük ({lexicon.length})</span>
        </button>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Preset Test Butonları */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Tek Tıkla Canlı Çapraz Doğrulama Senaryoları:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FIELD_INGESTION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={isIngesting}
                onClick={() => handlePresetClick(preset.text)}
                className="text-left px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-[10px] transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[8px] font-bold">
                  {preset.badge}
                </span>
                <span className="font-sans">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Textarea + Image Upload */}
        <div className="space-y-2">
          <textarea
            rows={compact ? 3 : 4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Sahadan sosyal medya paylaşımı, WhatsApp/Facebook şikayeti, dolaylı protokol eleştirisi veya trafik tıkanıklığı ihbarı yapıştırın..."
            className="w-full p-2.5 rounded-lg bg-background/90 border border-border text-xs font-sans text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-8 px-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 text-[11px] text-foreground flex items-center gap-1.5 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>{imageName ? `Görsel: ${imageName.slice(0, 18)}` : "Saha Fotoğrafı / Ekran Görüntüsü Ekle"}</span>
              </button>

              {imageBase64 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-cyan-500/40 bg-cyan-500/10">
                  <img
                    src={imageBase64}
                    alt="Saha görseli önizleme"
                    className="w-6 h-6 rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageBase64(undefined);
                      setImageMimeType(undefined);
                      setImageName(undefined);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    title="Görseli kaldır"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isIngesting || (!text.trim() && !imageBase64)}
              onClick={() => runAnalysis()}
              className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              {isIngesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Çapraz Doğrulanıyor...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Analiz Et & Çapraz Doğrula</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* En Son Çapraz Doğrulama Sonucu */}
        {latestEvent && (
          <div className="mt-2 pt-3 border-t border-border/50 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                  {latestEvent.dossier.code}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {latestEvent.districtName} · {latestEvent.issues.length} Alt Sorun & {latestEvent.implicitSubtext.length} Dolaylı İma
                </span>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                {latestEvent.analysisSource === "gemini-multimodal"
                  ? "Gemini Multimodal + Hakem"
                  : "Yerel NLP + Hakem Motoru"}
              </span>
            </div>

            {latestEvent.trafficPatch?.sensorDiscrepancy && (
              <div className="p-2.5 rounded-lg border border-destructive/60 bg-destructive/15 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px]">
                  <div className="font-bold text-destructive">
                    {latestEvent.trafficPatch.verdictMessage}
                  </div>
                  <p className="font-sans text-foreground/85 mt-0.5">
                    {latestEvent.trafficPatch.reason}
                  </p>
                </div>
              </div>
            )}

            {/* Çoklu Sorun Ayrıştırma */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border border-border/70 bg-secondary/20 space-y-1.5">
                <div className="text-[10px] font-bold text-cyan-300 flex items-center gap-1 uppercase">
                  <Layers className="w-3 h-3" /> Çoklu Sorun Ayrıştırması ({latestEvent.issues.length})
                </div>
                <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                  {latestEvent.issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-1.5 rounded bg-background/60 border border-border/50 text-[10px]"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-foreground">{iss.topic}</span>
                        <span
                          className={`px-1 rounded text-[8px] uppercase font-bold ${
                            iss.severity === "kritik"
                              ? "bg-destructive/20 text-destructive"
                              : iss.severity === "yuksek"
                              ? "bg-warning/20 text-warning"
                              : "bg-accent/20 text-accent"
                          }`}
                        >
                          {iss.severity}
                        </span>
                      </div>
                      <p className="font-sans text-muted-foreground mt-0.5">{iss.summary}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[8px] px-1 rounded bg-primary/10 text-primary">
                          📍 {iss.locality}
                        </span>
                        {iss.targetTabs.map((tabName) => (
                          <span
                            key={tabName}
                            className="text-[8px] px-1 rounded bg-secondary text-muted-foreground"
                          >
                            → {tabName}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dolaylı İma & Kulis Analizi */}
              <div className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-950/15 space-y-1.5">
                <div className="text-[10px] font-bold text-purple-300 flex items-center gap-1 uppercase">
                  <Eye className="w-3 h-3" /> Dolaylı İma & Kulis Çözümleyici ({latestEvent.implicitSubtext.length})
                </div>
                {latestEvent.implicitSubtext.length === 0 ? (
                  <p className="text-[10px] font-sans text-muted-foreground">
                    Bu paylaşımda doğrudan saha bildirimi yer alıyor; gizli kinaye tespit edilmedi.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                    {latestEvent.implicitSubtext.map((sub, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded bg-background/60 border border-purple-500/20 text-[10px]"
                      >
                        <div className="text-purple-200 font-bold">"{sub.phrase}"</div>
                        <p className="font-sans text-foreground/85 mt-0.5">
                          ↳ {sub.hiddenMeaning}
                        </p>
                        <div className="text-[8px] text-purple-300/80 mt-0.5">
                          Muhatap: {sub.targetActor}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Güncellenen Sekmeler + Sözlük Büyümesi */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Güncellenen Sekmeler:
                </span>
                {latestEvent.updatedTabs.map((tab) => (
                  <span
                    key={tab}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  >
                    {tab}
                  </span>
                ))}
              </div>
              {latestEvent.extractedLexiconTerms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLexiconDrawerOpen(true)}
                  className="text-[9px] text-primary hover:underline"
                >
                  +{latestEvent.extractedLexiconTerms.length} terim Yaşayan Sözlük havuzuna işlendi →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
