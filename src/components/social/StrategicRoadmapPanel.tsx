import { useState } from "react";
import {
  Compass, CheckCircle2, Clock, AlertTriangle, Download,
  Copy, Check, Plus, Calendar, Shield, Building2,
  FileText, Sparkles, RefreshCw
} from "lucide-react";
import {
  INSTITUTION_CATALOG,
  type Institution,
  type InstitutionReputationReport
} from "@/services/institution-reputation";

export interface RoadmapActionItem {
  id: string;
  phase: "t0" | "t1" | "t2";
  phaseTitle: string;
  title: string;
  description: string;
  responsibleUnit: string;
  priority: "critical" | "high" | "medium";
  deadline: string;
  completed: boolean;
  inProgress: boolean;
}

interface StrategicRoadmapPanelProps {
  initialInstitution?: Institution;
  initialReport?: InstitutionReputationReport;
}

export const StrategicRoadmapPanel = ({
  initialInstitution,
  initialReport,
}: StrategicRoadmapPanelProps) => {
  const [selectedInstId, setSelectedInstId] = useState<string>(
    initialInstitution?.id || "mugla-bb"
  );
  const [copied, setCopied] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionPhase, setNewActionPhase] = useState<"t0" | "t1" | "t2">("t0");
  const [newActionUnit, setNewActionUnit] = useState("Basın & Halkla İlişkiler");
  const [isAdding, setIsAdding] = useState(false);

  const institution =
    INSTITUTION_CATALOG.find((i) => i.id === selectedInstId) ||
    INSTITUTION_CATALOG[0];

  // Default Action Items tailored for Muğla governance
  const [actions, setActions] = useState<RoadmapActionItem[]>([
    // T0: First 48 Hours
    {
      id: "a1",
      phase: "t0",
      phaseTitle: "Faz 1: Acil Müdahale & İlk 48 Saat Protokolü",
      title: "Kriz Masası Aktivasyonu ve Sosyal Medya İzleme Teyidi",
      description: "Sosyal medyada pik yapan su kesintisi ve trafik şikayetleri için ilgili daire başkanlarıyla ortak kriz koordinasyonu kurulması.",
      responsibleUnit: "Kriz Masası & Genel Sekreterlik",
      priority: "critical",
      deadline: "İlk 6 Saat",
      completed: false,
      inProgress: true,
    },
    {
      id: "a2",
      phase: "t0",
      phaseTitle: "Faz 1: Acil Müdahale & İlk 48 Saat Protokolü",
      title: "Resmi Şeffaf Bilgilendirme Bülteni Yayınlanması",
      description: "Vatandaşların belirsizlik nedeniyle tepki gösterdiği altyapı çalışmalarının bitiş tarihini ve harita konumlarını içeren infografikli basın duyurusu.",
      responsibleUnit: "Basın Yayın ve Halkla İlişkiler",
      priority: "critical",
      deadline: "İlk 12 Saat",
      completed: false,
      inProgress: false,
    },
    {
      id: "a3",
      phase: "t0",
      phaseTitle: "Faz 1: Acil Müdahale & İlk 48 Saat Protokolü",
      title: "Sosyal Medya Yanıt Süresinin 15 Dakikanın Altına İndirilmesi",
      description: "153 Halk Masası ve sosyal medya doğrudan mesaj (DM) ekiplerinin 7/24 teyakkuz moduna geçirilerek vatandaşa birebir takip numarası iletilmesi.",
      responsibleUnit: "Halk Masası (153) & Dijital İletişim",
      priority: "high",
      deadline: "İlk 24 Saat",
      completed: true,
      inProgress: false,
    },

    // T1: 1-2 Weeks
    {
      id: "b1",
      phase: "t1",
      phaseTitle: "Faz 2: İtibar Onarımı & Saha Aksiyonu (3 - 14 Gün)",
      title: "Hassas İlçelerde Yerinde Koordinasyon & Muhtar Buluşması",
      description: "Bodrum ve Marmaris gibi şikayet yoğunluğunun arttığı ilçelerde ilçe belediyesi ve muhtarlarla ortak yerinde inceleme toplantısı yapılması.",
      responsibleUnit: "Muhtarlık İşleri Dairesi & Saha Ekipleri",
      priority: "high",
      deadline: "5. Gün",
      completed: false,
      inProgress: false,
    },
    {
      id: "b2",
      phase: "t1",
      phaseTitle: "Faz 2: İtibar Onarımı & Saha Aksiyonu (3 - 14 Gün)",
      title: "Sahadaki Tamirat & Çözümlerin Görsel Olarak Paylaşılması",
      description: "'Söz Verdik, Yaptık' temalı video ve fotoğraf kanıtlarıyla sokakta çözülen arızaların kamuoyuyla paylaşılması.",
      responsibleUnit: "Basın Yayın ve Halkla İlişkiler",
      priority: "medium",
      deadline: "8. Gün",
      completed: false,
      inProgress: false,
    },
    {
      id: "b3",
      phase: "t1",
      phaseTitle: "Faz 2: İtibar Onarımı & Saha Aksiyonu (3 - 14 Gün)",
      title: "Toplu Taşıma Sefer Seyrekliği İnceleme Raporu",
      description: "MUTTAŞ hatlarında üniversite ve hastane güzergahlarındaki pik saat taleplerinin GPS verileriyle analiz edilerek ek araç tahsis edilmesi.",
      responsibleUnit: "Ulaşım Dairesi Bşk. (MUTTAŞ)",
      priority: "high",
      deadline: "12. Gün",
      completed: false,
      inProgress: false,
    },

    // T2: 30-90 Days
    {
      id: "c1",
      phase: "t2",
      phaseTitle: "Faz 3: Yapısal Güven & Sürdürülebilir İmaj (15 - 90 Gün)",
      title: "Canlı Altyapı ve Yatırım Takip Portalının Hizmete Açılması",
      description: "Muğla genelinde devam eden tüm yol, su ve çevre yatırımlarının yüzdelik tamamlanma oranının vatandaşlara açık web portalında sergilenmesi.",
      responsibleUnit: "Bilgi İşlem & Fen İşleri",
      priority: "high",
      deadline: "30. Gün",
      completed: false,
      inProgress: false,
    },
    {
      id: "c2",
      phase: "t2",
      phaseTitle: "Faz 3: Yapısal Güven & Sürdürülebilir İmaj (15 - 90 Gün)",
      title: "13 İlçe Bağımsız Vatandaş Memnuniyeti Ölçüm Araştırması",
      description: "İlçe bazlı algı değişimini ve belediye hizmetlerinden memnuniyeti ölçecek akademik/profesyonel saha kamuoyu yoklaması.",
      responsibleUnit: "Strateji Geliştirme Dairesi",
      priority: "medium",
      deadline: "60. Gün",
      completed: false,
      inProgress: false,
    },
    {
      id: "c3",
      phase: "t2",
      phaseTitle: "Faz 3: Yapısal Güven & Sürdürülebilir İmaj (15 - 90 Gün)",
      title: "Kentsel Dayanıklılık ve İletişim Strateji Belgesi Yayınlanması",
      description: "Doğal afetler, kuraklık ve yangın krizlerinde kamuoyunun paniğe kapılmasını önleyici ortak çoklu kurum iletişim protokolü oluşturulması.",
      responsibleUnit: "Afet İşleri Dairesi & Valilik Koordinasyonu",
      priority: "high",
      deadline: "90. Gün",
      completed: false,
      inProgress: false,
    },
  ]);

  const toggleAction = (id: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed: !a.completed, inProgress: false } : a))
    );
  };

  const toggleProgress = (id: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, inProgress: !a.inProgress, completed: false } : a))
    );
  };

  const addCustomAction = () => {
    if (!newActionTitle.trim()) return;
    const newItem: RoadmapActionItem = {
      id: `custom-${Date.now()}`,
      phase: newActionPhase,
      phaseTitle:
        newActionPhase === "t0"
          ? "Faz 1: Acil Müdahale & İlk 48 Saat Protokolü"
          : newActionPhase === "t1"
          ? "Faz 2: İtibar Onarımı & Saha Aksiyonu (3 - 14 Gün)"
          : "Faz 3: Yapısal Güven & Sürdürülebilir İmaj (15 - 90 Gün)",
      title: newActionTitle.trim(),
      description: "Kurum yöneticisi tarafından eklenen stratejik eylem maddesi.",
      responsibleUnit: newActionUnit,
      priority: "high",
      deadline: newActionPhase === "t0" ? "24 Saat" : newActionPhase === "t1" ? "7 Gün" : "30 Gün",
      completed: false,
      inProgress: true,
    };
    setActions((prev) => [...prev, newItem]);
    setNewActionTitle("");
    setIsAdding(false);
  };

  const completedCount = actions.filter((a) => a.completed).length;
  const progressPercent = Math.round((completedCount / actions.length) * 100);

  // Generate copyable Markdown/Text report
  const generateReportText = () => {
    return `# STRATEJİK İTİBAR & KRİZ YOL HARİTASI
Kurum: ${institution.name} (${institution.leader})
Tarih: ${new Date().toLocaleDateString("tr-TR")}
İtibar Endeksi: ${initialReport?.overallScore ?? 78}/100 (${initialReport?.letterGrade ?? "B+"})
İlerleme Durumu: %${progressPercent} Tamamlandı (${completedCount}/${actions.length} Eylem)

---
## FAZ 1: ACİL MÜDAHALE PROTOKOLÜ (İLK 48 SAAT)
${actions
  .filter((a) => a.phase === "t0")
  .map(
    (a) =>
      `- [${a.completed ? "X" : a.inProgress ? "~" : " "}] ${a.title} | Birim: ${a.responsibleUnit} | Termin: ${a.deadline} | Öncelik: ${a.priority.toUpperCase()}`
  )
  .join("\n")}

## FAZ 2: İTİBAR İYİLEŞTİRME & SAHA AKSİYONU (3 - 14 GÜN)
${actions
  .filter((a) => a.phase === "t1")
  .map(
    (a) =>
      `- [${a.completed ? "X" : a.inProgress ? "~" : " "}] ${a.title} | Birim: ${a.responsibleUnit} | Termin: ${a.deadline} | Öncelik: ${a.priority.toUpperCase()}`
  )
  .join("\n")}

## FAZ 3: YAPISAL GÜVEN & SÜRDÜRÜLEBİLİR İMAJ (15 - 90 GÜN)
${actions
  .filter((a) => a.phase === "t2")
  .map(
    (a) =>
      `- [${a.completed ? "X" : a.inProgress ? "~" : " "}] ${a.title} | Birim: ${a.responsibleUnit} | Termin: ${a.deadline} | Öncelik: ${a.priority.toUpperCase()}`
  )
  .join("\n")}

---
Muğla Monitor v2 — Bölgesel İstihbarat & Karar Destek Sistemi
`;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    const element = document.createElement("a");
    const file = new Blob([generateReportText()], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `${institution.shortName}_Stratejik_Yol_Haritasi_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-card to-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
              <Compass size={18} />
            </span>
            <h3 className="text-sm font-mono font-bold text-foreground">
              Stratejik Eylem Yol Haritası & Karar Destek Masası
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Yönetici Brifingi
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            Sosyal medya hassasiyetleri, teyitli şikayet odakları ve ilçe nabzı analiz edilerek <strong className="text-foreground">{institution.name}</strong> için hazırlanan eylem protokolüdür.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyReport}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-secondary text-foreground border border-border hover:bg-secondary/80 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "Kopyalandı!" : "Raporu Kopyala"}</span>
          </button>
          <button
            onClick={handleDownloadReport}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 transition-colors font-bold shadow-sm"
          >
            <Download size={13} />
            <span>Markdown İndir</span>
          </button>
        </div>
      </div>

      {/* Institution Switcher & Progress Bar */}
      <div className="p-4 rounded-xl border border-border bg-card/70 backdrop-blur-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{institution.logoEmoji}</span>
            <div>
              <span className="text-xs font-mono text-muted-foreground block">Seçili Kurum / Lider</span>
              <h4 className="text-sm font-mono font-bold text-foreground">
                {institution.name} ({institution.leader})
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-lg scrollbar-thin">
            {INSTITUTION_CATALOG.slice(0, 6).map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelectedInstId(inst.id)}
                className={`text-[10px] font-mono px-2.5 py-1 rounded-md transition-colors whitespace-nowrap border ${
                  inst.id === selectedInstId
                    ? "bg-primary text-primary-foreground border-primary font-bold"
                    : "bg-secondary/30 text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {inst.logoEmoji} {inst.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock size={13} className="text-primary" />
              Yol Haritası Tamamlanma Oranı
            </span>
            <span className="font-bold text-foreground">
              {completedCount} / {actions.length} Eylem (%{progressPercent})
            </span>
          </div>
          <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phase Columns / Sections */}
      {(["t0", "t1", "t2"] as const).map((phaseKey) => {
        const phaseActions = actions.filter((a) => a.phase === phaseKey);
        const phaseTitle =
          phaseKey === "t0"
            ? "Faz 1: Acil Müdahale & İlk 48 Saat Protokolü (T0)"
            : phaseKey === "t1"
            ? "Faz 2: İtibar Onarımı & Saha Aksiyonu (3 - 14 Gün, T1)"
            : "Faz 3: Yapısal Güven & Sürdürülebilir İmaj (15 - 90 Gün, T2)";

        const badgeClass =
          phaseKey === "t0"
            ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
            : phaseKey === "t1"
            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
            : "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";

        return (
          <div key={phaseKey} className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${badgeClass}`}>
                  {phaseKey.toUpperCase()}
                </span>
                <h4 className="text-xs font-mono font-bold text-foreground">{phaseTitle}</h4>
              </div>

              <span className="text-[10px] font-mono text-muted-foreground">
                {phaseActions.filter((a) => a.completed).length} / {phaseActions.length} Tamamlandı
              </span>
            </div>

            <div className="space-y-2">
              {phaseActions.map((action) => {
                return (
                  <div
                    key={action.id}
                    className={`p-3 rounded-lg border transition-all ${
                      action.completed
                        ? "bg-emerald-500/5 border-emerald-500/30 opacity-80"
                        : action.inProgress
                        ? "bg-primary/5 border-primary/40 shadow-sm"
                        : "bg-secondary/20 border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleAction(action.id)}
                          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            action.completed
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-muted-foreground/60 hover:border-primary"
                          }`}
                        >
                          {action.completed && <Check size={11} strokeWidth={3} />}
                        </button>

                        <div className="space-y-1">
                          <h5 className={`text-xs font-mono font-bold ${
                            action.completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}>
                            {action.title}
                          </h5>
                          <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                            {action.description}
                          </p>

                          <div className="flex items-center gap-2 pt-1 flex-wrap text-[9px] font-mono">
                            <span className="px-2 py-0.5 rounded bg-secondary text-foreground border border-border/40">
                              Birim: <strong>{action.responsibleUnit}</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border/40 flex items-center gap-1">
                              <Calendar size={10} />
                              Termin: {action.deadline}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${
                              action.priority === "critical"
                                ? "text-rose-400 bg-rose-500/15"
                                : action.priority === "high"
                                ? "text-amber-400 bg-amber-500/15"
                                : "text-cyan-400 bg-cyan-500/15"
                            }`}>
                              {action.priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status toggle button */}
                      <button
                        onClick={() => toggleProgress(action.id)}
                        className={`text-[9px] font-mono px-2 py-1 rounded transition-colors whitespace-nowrap ${
                          action.inProgress
                            ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {action.completed
                          ? "Tamamlandı"
                          : action.inProgress
                          ? "● Yürütülüyor"
                          : "Başlat"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add Custom Action Form */}
      <div className="p-4 rounded-xl border border-dashed border-border bg-card/30">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
          >
            <Plus size={14} />
            <span>Yol Haritasına Özel Stratejik Eylem Maddesi Ekle</span>
          </button>
        ) : (
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-foreground">Yeni Eylem Maddesi Ekle</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Eylem başlığı..."
                value={newActionTitle}
                onChange={(e) => setNewActionTitle(e.target.value)}
                className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <select
                value={newActionPhase}
                onChange={(e) => setNewActionPhase(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              >
                <option value="t0">Faz 1 (İlk 48 Saat)</option>
                <option value="t1">Faz 2 (3-14 Gün)</option>
                <option value="t2">Faz 3 (15-90 Gün)</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                placeholder="Sorumlu Daire Başkanlığı / Birim..."
                value={newActionUnit}
                onChange={(e) => setNewActionUnit(e.target.value)}
                className="max-w-xs px-3 py-1 rounded-lg bg-background border border-border text-[11px] font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-xs font-mono px-3 py-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  İptal
                </button>
                <button
                  onClick={addCustomAction}
                  className="text-xs font-mono px-3 py-1 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
