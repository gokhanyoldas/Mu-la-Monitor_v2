// src/components/dashboard/DistrictDetailedAnalysisPanel.tsx
// Muğla 13 İlçe Detay Analiz Paneli — Harita Pinleri ve GeoJSON ile Çift Yönlü Senkronize

import React, { useState, useEffect } from "react";
import {
  DISTRICT_DETAILED_METRICS,
  DistrictDetailedMetric
} from "@/data/districtDetailedMetrics";
import { MUGLA_DISTRICTS, Incident, CATEGORY_COLORS } from "@/data/muglaDistricts";
import {
  Users,
  Palmtree,
  AlertTriangle,
  Flame,
  Activity,
  Car,
  Droplets,
  Building2,
  TrendingUp,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Search,
  CheckCircle2,
  Maximize2,
  Loader2,
  Radio
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  invokeSocialCollect,
  fetchDistrictIntel,
  checkSupabaseConfigured,
  type IntelRecord
} from "@/services/supabaseService";

interface DistrictDetailedAnalysisPanelProps {
  selectedDistrictId: string | null;
  onSelectDistrict: (districtId: string) => void;
  incidents: Incident[];
  onFlyToDistrict?: (districtId: string) => void;
  className?: string;
}

export const DistrictDetailedAnalysisPanel: React.FC<DistrictDetailedAnalysisPanelProps> = ({
  selectedDistrictId,
  onSelectDistrict,
  incidents,
  onFlyToDistrict,
  className = ""
}) => {
  // Seçili ilçe yoksa varsayılan olarak Bodrum'u veya ilk ilçeyi göster
  const activeId = selectedDistrictId || "bodrum";
  const currentMetric = DISTRICT_DETAILED_METRICS[activeId] || DISTRICT_DETAILED_METRICS["bodrum"];
  const [viewMode, setViewMode] = useState<"detail" | "compare">("detail");
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Supabase social-collect & İlçe İstihbarat Senkronizasyonu
  const [isCollecting, setIsCollecting] = useState(false);
  const [districtIntel, setDistrictIntel] = useState<IntelRecord[]>([]);
  const [intelSource, setIntelSource] = useState<"supabase-edge" | "supabase-db" | "local-fallback">("local-fallback");
  const [lastCollectedAt, setLastCollectedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDistrictIntel(currentMetric.name, 4).then((res) => {
      if (cancelled) return;
      setDistrictIntel(res.records);
      setIntelSource(res.source);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, currentMetric.name]);

  const handleInvokeSocialCollect = async () => {
    setIsCollecting(true);
    try {
      const result = await invokeSocialCollect(currentMetric.name, currentMetric.name);
      setDistrictIntel(result.posts.slice(0, 5));
      setIntelSource(result.source);
      setLastCollectedAt(result.collected_at);
      toast({
        title: `${currentMetric.name} İstihbaratı Güncellendi`,
        description:
          result.source === "supabase-edge"
            ? `Supabase social-collect üzerinden ${result.total} kayıt senkronize edildi.`
            : `${result.total} yerel/örnek istihbarat kaydı yüklendi (${checkSupabaseConfigured() ? "yedek mod" : "önizleme modu"}).`,
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const districtList = Object.values(DISTRICT_DETAILED_METRICS);
  const activeDistrictIncidents = incidents.filter(i => i.district_id === activeId);

  // Sıralamalar (Kıyaslama Modu İçin)
  const sortedByPopulation = [...districtList].sort((a, b) => b.population - a.population);
  const sortedByTourism = [...districtList].sort((a, b) => b.tourismScore - a.tourismScore);
  const sortedByRisk = [...districtList].sort((a, b) => b.compositeRiskScore - a.compositeRiskScore);

  const getRiskBadgeColor = (score: number) => {
    if (score >= 70) return "bg-red-500/20 text-red-300 border-red-500/50";
    if (score >= 55) return "bg-amber-500/20 text-amber-300 border-amber-500/50";
    return "bg-blue-500/20 text-blue-300 border-blue-500/50";
  };

  const getTourismBadgeColor = (density: string) => {
    if (density === "Aşırı Yoğun") return "bg-rose-500/20 text-rose-300 border-rose-500/50";
    if (density === "Yüksek") return "bg-purple-500/20 text-purple-300 border-purple-500/50";
    if (density === "Orta") return "bg-cyan-500/20 text-cyan-300 border-cyan-500/50";
    return "bg-slate-700/40 text-slate-300 border-slate-600";
  };

  return (
    <div className={`bg-[#0b111e] border border-slate-700/80 rounded-xl overflow-hidden shadow-2xl ${className}`}>
      {/* ── Üst Başlık & Mod Değiştirici ── */}
      <div className="p-4 border-b border-slate-700/80 bg-[#0e1626] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold font-mono text-white tracking-wide">
              İlçe Detay Analiz & Kentsel Risk Radarı
            </h3>
            <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono">
              HARİTA İLE SENKRON
            </Badge>
          </div>
          <p className="text-xs text-slate-300 mt-1 font-sans">
            Muğla'nın 13 ilçesi için doğrulanmış nüfus, yaz mevsimi piki, turizm yoğunluğu ve 4'lü risk skoru analizi
          </p>
        </div>

        {/* Görünüm Seçici Sekmeler */}
        <div className="flex items-center gap-1.5 bg-[#131c2e] p-1 rounded-lg border border-slate-700 shrink-0 text-xs font-mono">
          <button
            type="button"
            onClick={() => setViewMode("detail")}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              viewMode === "detail"
                ? "bg-emerald-600 text-white font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            İlçe İnceleme Kartı
          </button>
          <button
            type="button"
            onClick={() => setViewMode("compare")}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              viewMode === "compare"
                ? "bg-emerald-600 text-white font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            13 İlçe Kıyaslama Tablosu
          </button>
        </div>
      </div>

      {/* ── 13 İlçe Yatay Hızlı Seçim Şeridi (Senkronize Butonlar) ── */}
      <div className="bg-[#101726] border-b border-slate-800 p-2 overflow-x-auto scrollbar-thin">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] text-slate-400 font-mono px-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" /> İlçe Seç:
          </span>
          {districtList.map((district) => {
            const isSelected = activeId === district.id;
            return (
              <button
                key={district.id}
                type="button"
                onClick={() => {
                  onSelectDistrict(district.id);
                  if (onFlyToDistrict) onFlyToDistrict(district.id);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-400 font-bold shadow-md scale-105"
                    : "bg-[#131c2e] text-slate-300 border-slate-700/70 hover:border-slate-500 hover:text-white"
                }`}
                title={`${district.name} - Haritada odaklan ve detayları aç`}
              >
                <span>{district.emoji}</span>
                <span>{district.name}</span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      district.compositeRiskScore >= 70
                        ? "#ef4444"
                        : district.compositeRiskScore >= 55
                        ? "#f59e0b"
                        : "#38bdf8"
                  }}
                  title={`Risk Skoru: ${district.compositeRiskScore}/100`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── İÇERİK ALANI ── */}
      {viewMode === "detail" ? (
        /* ── MOD 1: SEÇİLİ İLÇE DERİNLEMESİNE İNCELEME ── */
        <div className="p-4 space-y-4">
          
          {/* İlçe Başlık Banner'ı */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#131c2e] border border-slate-700/80 p-3.5 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentMetric.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold font-mono text-white tracking-wide">
                    {currentMetric.name} İlçesi
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono border-slate-600 text-slate-300">
                    {currentMetric.type === "coastal" ? "Kıyı Turizm Bölgesi" : "İç İlçe / Tarım & Sanayi"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-sans">
                  Ana Sektör: <span className="text-white font-medium">{currentMetric.primaryEconomicDriver}</span>
                </p>
              </div>
            </div>

            {/* Sağ Taraf: Risk Rozeti, social-collect Tetikleyicisi & Haritada Odaklan Butonu */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`text-xs font-mono font-bold px-2.5 py-1 ${getRiskBadgeColor(currentMetric.compositeRiskScore)}`}>
                Bileşik Risk: {currentMetric.compositeRiskScore}/100 ({currentMetric.riskLabel})
              </Badge>
              {isAuthenticated && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleInvokeSocialCollect}
                  disabled={isCollecting}
                  className={`text-xs gap-1.5 border font-mono cursor-pointer transition-all ${
                    isCollecting
                      ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                      : "border-emerald-500/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50 hover:text-white"
                  }`}
                  title={`${currentMetric.name} ilçesi için Supabase social-collect taramasını başlat`}
                >
                  {isCollecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Toplanıyor...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                      <span>İstihbarat Topla</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (onFlyToDistrict) onFlyToDistrict(currentMetric.id);
                }}
                className="text-xs gap-1 border-slate-700 text-cyan-300 hover:bg-slate-800 hover:text-white cursor-pointer font-mono"
                title="Haritada Bu İlçeye Odaklan"
              >
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Haritada Göster</span>
              </Button>
            </div>
          </div>

          {/* 3 Ana Metrik Kolonu (Nüfus / Turizm / Risk) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. KOLON: NÜFUS VE MEVSİMSEL BASKI */}
            <div className="bg-[#101726] border border-slate-700/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" /> 1. Demografi & Nüfus
                </span>
                <Badge variant="outline" className="text-[9px] font-mono text-slate-400 border-slate-700">TÜİK 2024</Badge>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Yerleşik Nüfus:</span>
                  <span className="text-white font-bold">{currentMetric.populationFormatted}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Yaz Mevsimi Pik:</span>
                  <span className="text-amber-400 font-bold">{currentMetric.summerPopulationPeakFormatted}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Mevsimsel Çarpan:</span>
                  <span className="text-emerald-400 font-bold">{currentMetric.populationMultiplier} Kat Artış</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Nüfus Yoğunluğu:</span>
                  <span className="text-slate-200">{currentMetric.densityPerKm2} kişi/km² ({currentMetric.areaKm2} km²)</span>
                </div>
              </div>
            </div>

            {/* 2. KOLON: TURİZM KAPASİTESİ VE DOLULUK */}
            <div className="bg-[#101726] border border-slate-700/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                  <Palmtree className="w-4 h-4 text-emerald-400" /> 2. Turizm Yoğunluğu
                </span>
                <Badge className={`text-[9px] font-mono ${getTourismBadgeColor(currentMetric.tourismDensityLabel)}`}>
                  {currentMetric.tourismDensityLabel}
                </Badge>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                {/* Turizm Yoğunluk İlerleme Çubuğu */}
                <div className="p-2 rounded bg-[#131c2e] border border-slate-800 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Turizm Endeksi:</span>
                    <span className="text-emerald-400 font-bold">%{currentMetric.tourismScore}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
                      style={{ width: `${currentMetric.tourismScore}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Yıllık Turist Hacmi:</span>
                  <span className="text-cyan-400 font-bold">{currentMetric.annualVisitors}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Kayıtlı Yatak Sayısı:</span>
                  <span className="text-white font-bold">{currentMetric.hotelBedCapacity.toLocaleString("tr-TR")}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-[#131c2e] border border-slate-800">
                  <span className="text-slate-400">Ortalama Doluluk:</span>
                  <span className="text-emerald-400 font-bold">%{currentMetric.averageHotelOccupancy}</span>
                </div>
              </div>
            </div>

            {/* 3. KOLON: ÇOK BOYUTLU RİSK RADARI */}
            <div className="bg-[#101726] border border-slate-700/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> 3. 4 Boyutlu Risk Skoru
                </span>
                <span className="text-[10px] font-mono text-slate-400">100 Üzerinden</span>
              </div>

              {/* 4 Risk İlerleme Çubuğu */}
              <div className="space-y-2 text-xs font-mono">
                {/* Orman Yangını */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-red-400" /> Yangın Riski:
                    </span>
                    <span className="font-bold text-red-400">%{currentMetric.riskBreakdown.fireRisk}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${currentMetric.riskBreakdown.fireRisk}%` }} />
                  </div>
                </div>

                {/* Sismik / Fay */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-purple-400" /> Sismik/Fay:
                    </span>
                    <span className="font-bold text-purple-400">%{currentMetric.riskBreakdown.seismicRisk}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${currentMetric.riskBreakdown.seismicRisk}%` }} />
                  </div>
                </div>

                {/* Trafik Tıkanıklığı */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Car className="w-3 h-3 text-amber-400" /> Trafik Tıkanıklığı:
                    </span>
                    <span className="font-bold text-amber-400">%{currentMetric.riskBreakdown.trafficCongestion}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${currentMetric.riskBreakdown.trafficCongestion}%` }} />
                  </div>
                </div>

                {/* Su Stresi / Kuraklık */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-cyan-400" /> Su Havzası Stresi:
                    </span>
                    <span className="font-bold text-cyan-400">%{currentMetric.riskBreakdown.waterStress}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${currentMetric.riskBreakdown.waterStress}%` }} />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Alt Bölüm: Kritik Altyapı Tesisleri & Operasyonel Not */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Kritik Altyapı */}
            <div className="bg-[#101726] border border-slate-700/80 rounded-xl p-3.5 space-y-2">
              <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Building2 className="w-4 h-4 text-cyan-400" /> Stratejik Altyapı & Koridorlar
              </span>
              <ul className="space-y-1.5 text-xs text-slate-300 font-sans">
                {currentMetric.criticalInfrastructure.map((infra, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{infra}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Operasyonel Özet, Canlı social-collect Kayıtları & İlçe Sayfası Linki */}
            <div className="bg-[#101726] border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Operasyonel Saha Brifingi
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono border-slate-700 text-slate-300">
                    {intelSource === "supabase-edge"
                      ? "social-collect CANLI"
                      : intelSource === "supabase-db"
                      ? "Supabase DB"
                      : "Yerel Yedek Akış"}
                    {lastCollectedAt ? ` · ${new Date(lastCollectedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed mt-2">
                  {currentMetric.operationalSummary}
                </p>

                {districtIntel.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                      {currentMetric.name} Son İstihbarat Sinyalleri ({districtIntel.length})
                    </span>
                    <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
                      {districtIntel.slice(0, 3).map((rec) => (
                        <div
                          key={rec.id}
                          className="text-[11px] bg-[#131c2e] border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 flex items-start justify-between gap-2"
                        >
                          <span className="line-clamp-2">{rec.content}</span>
                          <span className="text-[9px] font-mono text-slate-400 shrink-0">{rec.platform}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400 font-mono">
                  Aktif Olay: <strong className="text-amber-400">{activeDistrictIncidents.length}</strong>
                </span>
                <a
                  href={`/ilce/${currentMetric.id}`}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors font-mono"
                >
                  <span>{currentMetric.name} İlçe Sayfasına Git</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* ── MOD 2: 13 İLÇE KIYASLAMA TABLOSU ── */
        <div className="p-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-700 bg-[#0e1626] text-slate-400">
                  <th className="p-2.5">İlçe</th>
                  <th className="p-2.5">Tür</th>
                  <th className="p-2.5">Yerleşik Nüfus</th>
                  <th className="p-2.5">Yaz Piki (Tahmini)</th>
                  <th className="p-2.5">Turizm Endeksi</th>
                  <th className="p-2.5">Bileşik Risk</th>
                  <th className="p-2.5 text-right">Eylem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {districtList.map((d) => {
                  const isSelected = activeId === d.id;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => {
                        onSelectDistrict(d.id);
                        if (onFlyToDistrict) onFlyToDistrict(d.id);
                      }}
                      className={`hover:bg-[#131c2e] transition-colors cursor-pointer ${
                        isSelected ? "bg-[#131c2e] font-semibold text-white" : "text-slate-300"
                      }`}
                    >
                      <td className="p-2.5 flex items-center gap-2">
                        <span className="text-base">{d.emoji}</span>
                        <span className="font-bold text-white">{d.name}</span>
                        {isSelected && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Seçili</Badge>}
                      </td>
                      <td className="p-2.5">
                        <span className="text-[11px] text-slate-400">
                          {d.type === "coastal" ? "Kıyı Turizm" : "İç İlçe"}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-slate-200">{d.populationFormatted}</td>
                      <td className="p-2.5 font-bold text-amber-400">{d.summerPopulationPeakFormatted} ({d.populationMultiplier})</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-8 font-bold text-emerald-400">%{d.tourismScore}</span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.tourismScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <Badge className={`text-[10px] ${getRiskBadgeColor(d.compositeRiskScore)}`}>
                          {d.compositeRiskScore}/100
                        </Badge>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDistrict(d.id);
                            if (onFlyToDistrict) onFlyToDistrict(d.id);
                            setViewMode("detail");
                          }}
                          className="text-cyan-400 hover:text-cyan-300 text-[11px] font-bold underline"
                        >
                          Detay →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
