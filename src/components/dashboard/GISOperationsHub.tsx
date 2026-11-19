// src/components/dashboard/GISOperationsHub.tsx
// Muğla 13 İlçe GIS Operasyon & Kentsel Olay Takip Masası

import React, { useState, useEffect } from "react";
import { MuglaLeafletMap } from "@/components/map/MuglaLeafletMap";
import { MUGLA_DISTRICTS, Incident, CATEGORY_COLORS } from "@/data/muglaDistricts";
import { MUGLA_DISTRICTS_GEOJSON } from "@/data/muglaDistrictsGeoJSON";
import { DistrictDetailedAnalysisPanel } from "@/components/dashboard/DistrictDetailedAnalysisPanel";
import { parseUnstructuredTextWithGemini } from "@/services/geminiParser";
import {
  MapPin,
  Flame,
  Car,
  Droplets,
  Shield,
  Palmtree,
  Sparkles,
  Filter,
  Plus,
  Send,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Başlangıç Olay Verileri (Gerçekçi Muğla Saha Verileri)
const SEED_INCIDENTS: Incident[] = [
  {
    id: "inc-1",
    district_id: "bodrum",
    district_name: "Bodrum",
    title: "Torba - Yalıkavak Yolunda Yoğunluk",
    summary: "D-330 karayolu Torba kavşağı istikametinde sinyalizasyon optimizasyonu devrede.",
    category: "Trafik",
    severity: "Orta",
    event_date: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    lat: 37.0344,
    lon: 27.4305
  },
  {
    id: "inc-2",
    district_id: "marmaris",
    district_name: "Marmaris",
    title: "İçmeler - Turunç Orman Gözetleme Devriyesi",
    summary: "Rüzgar hamleleri nedeniyle kırsal devriye araçları orman yangın koruma hattında devriyede.",
    category: "Yangın/Afet",
    severity: "Yüksek",
    event_date: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    lat: 36.8521,
    lon: 28.2706
  },
  {
    id: "inc-3",
    district_id: "milas",
    district_name: "Milas",
    title: "Geyik Barajı İsale Hattı Basınç Dengelenmesi",
    summary: "MUSKİ ekipleri Milas ve Bodrum besleme hattında gece debi kontrollerini tamamladı.",
    category: "Altyapı/Su",
    severity: "Düşük",
    event_date: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
    lat: 37.3166,
    lon: 27.7869
  },
  {
    id: "inc-4",
    district_id: "fethiye",
    district_name: "Fethiye",
    title: "Ölüdeniz - Belcekız Sahil Düzenleme & Güvenlik",
    summary: "Zabıta ve emniyet unsurları kıyı şeridinde yaya koridoru ve düzen denetimlerini sürdürüyor.",
    category: "Asayiş",
    severity: "Düşük",
    event_date: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    lat: 36.6548,
    lon: 29.1165
  },
  {
    id: "inc-5",
    district_id: "mentese",
    district_name: "Menteşe",
    title: "Kötekli Kampüs Kavşağında Asfalt İyileştirme",
    summary: "Belediye fen işleri ekipleri üniversite güzergahında şerit daraltmasıyla bakım yürütüyor.",
    category: "Altyapı/Su",
    severity: "Orta",
    event_date: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    lat: 37.2153,
    lon: 28.3636
  }
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Yangın/Afet": <Flame className="w-3.5 h-3.5 text-red-400" />,
  "Trafik": <Car className="w-3.5 h-3.5 text-amber-400" />,
  "Altyapı/Su": <Droplets className="w-3.5 h-3.5 text-cyan-400" />,
  "Asayiş": <Shield className="w-3.5 h-3.5 text-purple-400" />,
  "Turizm/Çevre": <Palmtree className="w-3.5 h-3.5 text-emerald-400" />
};

export const GISOperationsHub: React.FC = () => {
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFlyToDistrict = (districtId: string) => {
    setSelectedDistrictId(districtId);
    setFocusTrigger((prev) => prev + 1);
    document.getElementById("gis-leaflet-map-container")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // Haritadaki popuptan 'İlçe Detay Analizini İncele' butonuna tıklandığında paneli aç ve oraya kaydır
  useEffect(() => {
    const handleFocus = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setSelectedDistrictId(customEvent.detail);
        setTimeout(() => {
          document.getElementById("district-analysis-panel")?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      }
    };
    window.addEventListener("focus-district-analysis", handleFocus);
    return () => window.removeEventListener("focus-district-analysis", handleFocus);
  }, []);

  // Gemini AI ile Dağınık Metin Ayrıştırma
  const handleAIParse = async (textToParse?: string) => {
    const text = (textToParse || rawText).trim();
    if (!text) return;

    setIsProcessing(true);
    try {
      const parsed = await parseUnstructuredTextWithGemini(text);

      const newIncident: Incident = {
        id: `inc-${Date.now()}`,
        ...parsed,
        event_date: new Date().toISOString()
      };

      setIncidents(prev => [newIncident, ...prev]);
      setRawText("");
      setSelectedDistrictId(parsed.district_id);

      toast({
        title: "Olay Başarıyla Haritaya İşlendi",
        description: `${parsed.district_name} · [${parsed.category}] ${parsed.title}`,
      });
    } catch (err) {
      console.error("AI Parse Hatası:", err);
      toast({
        title: "Ayrıştırma Hatası",
        description: "Metin işlenirken bir sorun oluştu, lütfen tekrar deneyin.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sampleTexts = [
    "Datça Palamutbükü yolunda aşırı rüzgar nedeniyle devrilen ağaç yolu trafiğe kapattı.",
    "Köyceğiz Gölü etrafında taşkın önleme kanallarında temizlik çalışması başlatıldı.",
    "Ortaca Dalyan kanalında tekne trafiği yoğunluğu için jandarma bot devriyeleri sıklaştırıldı."
  ];

  const categories = Object.keys(CATEGORY_ICONS);
  const criticalCount = incidents.filter(i => i.severity === "Kritik" || i.severity === "Yüksek").length;

  return (
    <div className="space-y-4">
      {/* ── Üst Başlık ve Metrik Özeti ── */}
      <div className="bg-[#0b111e] border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold font-mono tracking-wider text-white">
              GIS Kentsel İstihbarat & Olay Haritası
            </h2>
            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono">
              LEAFLET + OSM CANLI
            </Badge>
          </div>
          <p className="text-xs text-slate-300 mt-1 font-sans">
            Muğla genelinde 13 ilçenin koordinatlı olay, altyapı, yangın ve trafik akış izleme masası
          </p>
        </div>

        {/* Canlı İstatistikler */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="bg-[#131c2e] border border-slate-700 px-3 py-1.5 rounded-lg text-center min-w-[70px]">
            <span className="text-[9px] text-slate-400 font-mono block">13 İLÇE</span>
            <span className="text-sm font-bold text-white font-mono">{MUGLA_DISTRICTS.length}</span>
          </div>
          <div className="bg-[#131c2e] border border-slate-700 px-3 py-1.5 rounded-lg text-center min-w-[75px]">
            <span className="text-[9px] text-slate-400 font-mono block">KAYITLI OLAY</span>
            <span className="text-sm font-bold text-cyan-400 font-mono">{incidents.length}</span>
          </div>
          <div className="bg-[#131c2e] border border-slate-700 px-3 py-1.5 rounded-lg text-center min-w-[75px]">
            <span className="text-[9px] text-slate-400 font-mono block">ÖNCELİKLİ</span>
            <span className="text-sm font-bold text-amber-400 font-mono">{criticalCount}</span>
          </div>
        </div>
      </div>

      {/* ── Filtre Çubuğu (Kategori + İlçe Seçimi) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0b111e] border border-slate-700/80 p-2.5 rounded-lg text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-mono flex items-center gap-1 mr-1 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-emerald-400" /> Katman:
          </span>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer ${
              selectedCategory === null 
                ? "bg-emerald-600 text-white font-bold" 
                : "bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
          >
            Tümü ({incidents.length})
          </button>
          {categories.map((cat) => {
            const count = incidents.filter(i => i.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? null : cat)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer border ${
                  isSelected
                    ? "bg-slate-800 text-white border-emerald-500 font-bold"
                    : "bg-[#131c2e] text-slate-300 border-slate-700/80 hover:text-white hover:border-slate-600"
                }`}
              >
                {CATEGORY_ICONS[cat]}
                <span>{cat}</span>
                <span className="text-[9px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* İlçe Hızlı Filtresi */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" /> İlçe:
          </span>
          <select
            value={selectedDistrictId || ""}
            onChange={(e) => setSelectedDistrictId(e.target.value || null)}
            className="bg-[#131c2e] text-slate-200 border border-slate-700 text-xs px-2.5 py-1 rounded focus:outline-none focus:border-emerald-500 font-mono cursor-pointer"
          >
            <option value="">Tüm İlçeler (13)</option>
            {MUGLA_DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {(selectedCategory || selectedDistrictId) && (
            <button
              onClick={() => { setSelectedCategory(null); setSelectedDistrictId(null); }}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
              title="Filtreleri Sıfırla"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Ana GIS Çalışma Alanı (Grid: Harita / Ağ Diyagramı + Olay Akışı / AI Parse) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Sol Kolon: CBS Leaflet Haritası */}
        <div id="gis-leaflet-map-container" className="lg:col-span-2 space-y-2">
          <MuglaLeafletMap
            incidents={incidents}
            selectedCategory={selectedCategory}
            selectedDistrictId={selectedDistrictId}
            onDistrictSelect={(districtId) => setSelectedDistrictId(districtId)}
            focusTrigger={focusTrigger}
            height={560}
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
            <span>İpucu: Haritada ilçe merkezine veya renkli olay noktalarına tıklayarak detayları görebilirsiniz.</span>
            <span>Katman: OpenStreetMap + CartoDB / TomTom Raster</span>
          </div>
        </div>

        {/* Sağ Kolon: Gemini AI Ayrıştırıcı & Canlı Olay Akışı */}
        <div className="space-y-4">
          
          {/* Seçili İlçe GeoJSON Canlı Bilgi Kartı */}
          {selectedDistrictId && (() => {
            const feat = MUGLA_DISTRICTS_GEOJSON.features.find(f => f.id === selectedDistrictId);
            if (!feat) return null;
            const p = feat.properties;
            const distIncidents = incidents.filter(i => i.district_id === p.id);
            return (
              <div className="bg-[#0b111e] border-2 border-emerald-500/70 rounded-xl p-3.5 space-y-2.5 shadow-xl animate-slide-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.emoji}</span>
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                        {p.name}
                        <span className="text-[10px] text-emerald-400 font-sans font-normal">({p.type === 'coastal' ? 'Kıyı' : 'İç İlçe'})</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">GeoJSON Sınırı & Veri Pini Seçili</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDistrictId(null)}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                  >
                    Kapat ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="bg-[#131c2e] p-2 rounded border border-slate-700/60">
                    <span className="text-[9px] text-slate-400 block">NÜFUS (TÜİK)</span>
                    <span className="font-bold text-white text-xs">{p.populationFormatted}</span>
                  </div>
                  <div className="bg-[#131c2e] p-2 rounded border border-slate-700/60">
                    <span className="text-[9px] text-slate-400 block">YÜZÖLÇÜMÜ</span>
                    <span className="font-bold text-slate-200 text-xs">{p.area_km2} km²</span>
                  </div>
                  <div className="bg-[#131c2e] p-2 rounded border border-slate-700/60">
                    <span className="text-[9px] text-slate-400 block">HAVA DURUMU</span>
                    <span className="font-bold text-cyan-400 text-xs">{p.temperature}</span>
                  </div>
                  <div className="bg-[#131c2e] p-2 rounded border border-slate-700/60">
                    <span className="text-[9px] text-slate-400 block">TRAFİK AKIŞI</span>
                    <span className="font-bold text-emerald-400 text-xs">%{p.trafficDensity} Akıcı</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-300 font-sans">
                    Bu ilçede <strong>{distIncidents.length}</strong> aktif olay kaydı var.
                  </span>
                  <a
                    href={`/ilce/${p.id}`}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                  >
                    İlçe Brifingi →
                  </a>
                </div>
              </div>
            );
          })()}

          {/* 1. Gemini AI Metin Ayrıştırma Kartı */}
          <div className="bg-[#0b111e] border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-xs font-bold font-mono text-white">Gemini AI Ham Veri Ayrıştırıcı</h3>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono">
                OTOMATİK GIS
              </Badge>
            </div>

            <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
              Herhangi bir haber veya saha raporu yapıştırın; yapay zekâ metni analiz edip doğru ilçeye ve kategoriye iğneleyecektir.
            </p>

            <textarea
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Örn: 'Milas Ören karayolunda asfalt onarımı sebebiyle trafik tek şeritten kontrollü sağlanıyor.'"
              className="w-full text-xs p-2.5 rounded-lg bg-[#131c2e] border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors font-sans resize-none"
            />

            {/* Hızlı Örnek Şablonları */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-mono block">Hızlı Örnekler:</span>
              <div className="flex flex-col gap-1">
                {sampleTexts.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAIParse(sample)}
                    disabled={isProcessing}
                    className="text-left text-[10px] text-slate-300 hover:text-emerald-300 bg-[#131c2e]/70 hover:bg-[#131c2e] p-1.5 rounded border border-slate-800 transition-colors cursor-pointer truncate"
                  >
                    ↳ {sample}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => handleAIParse()}
              disabled={isProcessing || !rawText.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow transition-all"
            >
              {isProcessing ? (
                <span>Ayrıştırılıyor & Haritaya Ekleniyor...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Yapay Zekâ ile Ayrıştır ve Haritaya Ekle</span>
                </>
              )}
            </Button>
          </div>

          {/* 2. Son Olaylar ve Bildirim Listesi */}
          <div className="bg-[#0b111e] border border-slate-700/80 rounded-xl p-3.5 space-y-2.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <h4 className="text-xs font-bold font-mono text-white">Canlı Olay Akışı</h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{incidents.length} Kayıt</span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
              {incidents.slice(0, 10).map((item) => {
                const color = CATEGORY_COLORS[item.category] || "#38bdf8";
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedDistrictId(item.district_id)}
                    className="p-2.5 rounded-lg bg-[#131c2e] border border-slate-700/70 hover:border-emerald-500/60 transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="font-bold text-white flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {item.district_name}
                      </span>
                      <span className="text-slate-400">
                        {new Date(item.event_date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <h5 className="text-xs font-semibold text-slate-100 line-clamp-1">{item.title}</h5>
                    <p className="text-[11px] text-slate-300 line-clamp-2 font-sans">{item.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* ── İLÇE DETAY ANALİZ PANELİ (Harita Pinleri ve GeoJSON ile Çift Yönlü Senkronize) ── */}
      <div id="district-analysis-panel" className="pt-2">
        <DistrictDetailedAnalysisPanel
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={(districtId) => setSelectedDistrictId(districtId)}
          onFlyToDistrict={handleFlyToDistrict}
          incidents={incidents}
        />
      </div>
    </div>
  );
};
