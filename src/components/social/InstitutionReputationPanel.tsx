import { useState, useMemo } from "react";
import {
  Building2, ShieldCheck, AlertCircle, TrendingUp,
  MapPin, CheckCircle, ArrowUpRight, Search, Compass
} from "lucide-react";
import {
  INSTITUTION_CATALOG,
  institutionReputation,
  type Institution,
  type InstitutionReputationReport
} from "@/services/institution-reputation";

interface InstitutionReputationPanelProps {
  posts?: Array<Record<string, unknown>>;
  onGenerateRoadmap?: (institution: Institution, report: InstitutionReputationReport) => void;
}

export const InstitutionReputationPanel = ({
  posts = [],
  onGenerateRoadmap,
}: InstitutionReputationPanelProps) => {
  const [selectedId, setSelectedId] = useState<string>("mugla-bb");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInstitutions = useMemo(() => {
    if (!searchQuery.trim()) return INSTITUTION_CATALOG;
    const q = searchQuery.toLowerCase();
    return INSTITUTION_CATALOG.filter(
      (inst) =>
        inst.name.toLowerCase().includes(q) ||
        inst.shortName.toLowerCase().includes(q) ||
        inst.leader.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeInstitution = useMemo(() => {
    return (
      INSTITUTION_CATALOG.find((i) => i.id === selectedId) || INSTITUTION_CATALOG[0]
    );
  }, [selectedId]);

  const report: InstitutionReputationReport = useMemo(() => {
    return institutionReputation.evaluateReputation(activeInstitution, posts);
  }, [activeInstitution, posts]);

  const gradeColor =
    report.letterGrade.startsWith("A")
      ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
      : report.letterGrade.startsWith("B")
      ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/10"
      : report.letterGrade === "C"
      ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
      : "text-rose-400 border-rose-500/40 bg-rose-500/10";

  return (
    <div className="space-y-4">
      {/* Selector & Search Header */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-mono font-bold text-foreground flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              Kurumsal İmaj & İtibar Değerlendirme Merkezi
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Muğla'daki kamu kurumları ve belediyelerin vatandaş nezdindeki itibar, güven ve hizmet algısı analizi.
            </p>
          </div>

          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Kurum veya ilçe ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Institution Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {filteredInstitutions.map((inst) => {
            const isSelected = inst.id === selectedId;
            return (
              <button
                key={inst.id}
                onClick={() => setSelectedId(inst.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-bold shadow-md shadow-primary/20"
                    : "bg-secondary/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-secondary"
                }`}
              >
                <span>{inst.logoEmoji}</span>
                <span>{inst.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Institution Score Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overall Score Card */}
        <div className="p-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeInstitution.logoEmoji}</span>
                <div>
                  <h4 className="text-base font-mono font-bold text-foreground">
                    {activeInstitution.name}
                  </h4>
                  <span className="text-xs font-mono text-muted-foreground">
                    Yönetim: <strong className="text-foreground">{activeInstitution.leader}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-lg text-center ${gradeColor}`}>
              {report.letterGrade}
            </div>
          </div>

          {/* Big Score Gauge */}
          <div className="py-2 text-center space-y-1">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
              Kurumsal İtibar & Algı Endeksi
            </span>
            <div className="text-4xl sm:text-5xl font-mono font-black text-foreground tracking-tight">
              {report.overallScore}
              <span className="text-sm font-normal text-muted-foreground ml-1">/100</span>
            </div>
            <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden max-w-xs mx-auto mt-2">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-primary rounded-full transition-all duration-700"
                style={{ width: `${report.overallScore}%` }}
              />
            </div>
            <p className="text-xs font-mono text-primary font-semibold mt-2">
              {report.statusDescription}
            </p>
          </div>

          {/* Sentiment Stats Bar */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40 text-center text-[10px] font-mono">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="block text-[8px] uppercase">Pozitif Algı</span>
              <span className="font-bold text-sm">%{report.sentimentBreakdown.positivePercent}</span>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              <span className="block text-[8px] uppercase">Nötr Bildirim</span>
              <span className="font-bold text-sm">%{report.sentimentBreakdown.neutralPercent}</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <span className="block text-[8px] uppercase">Negatif / Şikayet</span>
              <span className="font-bold text-sm">%{report.sentimentBreakdown.negativePercent}</span>
            </div>
          </div>

          {/* Trigger Action Button */}
          <button
            onClick={() => onGenerateRoadmap && onGenerateRoadmap(activeInstitution, report)}
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all"
          >
            <Compass size={15} />
            <span>Bu Kurum İçin Stratejik Eylem Yol Haritası Çıkar →</span>
          </button>
        </div>

        {/* 5 Dimensions Breakdown */}
        <div className="p-4 rounded-xl border border-border bg-card lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-foreground flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" />
              5 Boyutlu Kurumsal İmaj Analizi
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground">
              Ağırlıklı Algı Parametreleri
            </span>
          </div>

          <div className="space-y-3">
            {report.dimensions.map((dim) => (
              <div key={dim.name} className="p-3 rounded-lg bg-secondary/20 border border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-foreground">{dim.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px]">{dim.label}</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      dim.score >= 75 ? "bg-emerald-500/20 text-emerald-400" :
                      dim.score >= 60 ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"
                    }`}>
                      %{dim.score}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      dim.score >= 75 ? "bg-emerald-500" : dim.score >= 60 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>

                <p className="text-[10px] font-mono text-muted-foreground leading-snug">
                  {dim.recentFeedback}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vulnerabilities & District Satisfaction Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vulnerabilities / Issue Clustering */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-foreground flex items-center gap-2">
              <AlertCircle size={15} className="text-destructive" />
              Kritik Hassasiyet & Vatandaş Şikayet Odakları
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
              Kriz Önleme
            </span>
          </div>

          <div className="space-y-2.5">
            {report.vulnerabilities.map((vuln) => (
              <div
                key={vuln.topic}
                className="p-3 rounded-lg border border-border/60 bg-background/50 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    {vuln.topic}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/15 text-destructive font-bold uppercase">
                    {vuln.severity}
                  </span>
                </div>

                <p className="text-[10px] font-mono text-muted-foreground italic">
                  "{vuln.sampleSnippet}"
                </p>

                <div className="flex items-center gap-1 flex-wrap text-[9px] font-mono text-muted-foreground">
                  <span>Etkilenen İlçeler:</span>
                  {vuln.affectedDistricts.map((d) => (
                    <span key={d} className="px-1.5 py-0.5 rounded bg-secondary text-foreground">
                      {d}
                    </span>
                  ))}
                </div>

                <div className="p-2 rounded bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary flex items-start gap-1.5">
                  <CheckCircle size={12} className="flex-shrink-0 mt-0.5" />
                  <span><strong>Tavsiye Eylem:</strong> {vuln.recommendedAction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 13 District Satisfaction Grid */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-bold text-foreground flex items-center gap-2">
              <MapPin size={15} className="text-primary" />
              13 İlçe Kurumsal Memnuniyet Karnesi
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground">
              Yerel Algı Dağılımı
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
            {report.districtBreakdown.map((dist) => (
              <div
                key={dist.districtSlug}
                className="p-2.5 rounded-lg bg-secondary/30 border border-border/40 flex items-center justify-between text-xs font-mono"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <span>{dist.emoji}</span>
                    <span>{dist.districtName}</span>
                  </div>
                  {dist.topIssue && (
                    <span className="text-[9px] text-muted-foreground block line-clamp-1">
                      {dist.topIssue}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  {dist.mentionCount > 0 ? (
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                      dist.approvalRate >= 65
                        ? "bg-emerald-500/20 text-emerald-400"
                        : dist.approvalRate >= 45
                        ? "bg-cyan-500/20 text-cyan-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}>
                      %{dist.approvalRate}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/30 text-muted-foreground">
                      İzleniyor
                    </span>
                  )}
                  <span className="text-[8px] font-mono text-muted-foreground block mt-0.5">
                    {dist.mentionCount > 0 ? `${dist.mentionCount} sinyal` : "0 sinyal"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
