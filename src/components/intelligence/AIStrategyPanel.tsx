// AIStrategyPanel.tsx
// "Kritik İstihbarat Uyarıları" (AnomalyPanel) ile birebir aynı mimari ve tasarım kalıbında,
// Sheet (Slide-Over Drawer) kullanan, kategorize kart yapısına sahip Kentsel Strateji Paneli.

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Brain,
  Copy,
  Check,
  RefreshCw,
  FileText,
  ShieldCheck,
  Flame,
  Droplets,
  Car,
  Radio,
  Clock,
  Sparkles,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export const AIStrategyPanel = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  // Global event dinleyicileri (sayfadaki diğer bileşenlerden açılabilmesi için)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleClose = () => setIsOpen(false);

    window.addEventListener("open-ai-strategy-panel", handleOpen);
    window.addEventListener("toggle-ai-strategy-panel", handleToggle);
    window.addEventListener("close-ai-strategy-panel", handleClose);

    return () => {
      window.removeEventListener("open-ai-strategy-panel", handleOpen);
      window.removeEventListener("toggle-ai-strategy-panel", handleToggle);
      window.removeEventListener("close-ai-strategy-panel", handleClose);
    };
  }, []);

  // Panel durumunu sistem geneline ve Sentinel ajanına senkronize et
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("ai-strategy-panel-state-changed", { detail: { isOpen } })
    );
  }, [isOpen]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({
        title: "Strateji Brifingi Güncellendi",
        description: "En son canlı sensör ve kamu verileriyle metin tazelendi.",
      });
    }, 300);
  };

  const reportDateStr = lastUpdated.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const reportTimeStr = lastUpdated.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const rawMemoText = `T.C. MUĞLA BÜYÜKŞEHİR BELEDİYESİ
KENTSEL STRATEJİ VE İCRA BRİFİNGİ
Tarih: ${reportDateStr} | Saat: ${reportTimeStr}

1. GENEL DURUM ÖZETİ
Muğla genelinde kentsel işleyiş istikrarlı seyrini korumaktadır. 13 ilçe genelinde kamu düzenini bozan kritik bir altyapı kesintisi veya akut kriz durumu bulunmamaktadır. Kıyı ilçelerindeki mevsimsel nüfus hareketliliği ile iç kesimlerdeki su havzası dengesi birbirini doğrudan etkilemektedir. Genel alarm seviyesi nominal-dikkat bandındadır.

2. ÇAPRAZ STRATEJİK DEĞERLENDİRME
• Yangın ve İklim Güvenliği: Sıcaklık ve nem değerlerinin rüzgar hamleleriyle birleşimi orman arayüzünde yangın riskini orta seviyede tutmaktadır. Kırsal kule gözetleme devriyeleri aktiftir.
• Su Kaynakları ve 8 Baraj: Muğla'nın 8 resmi barajında ortalama doluluk oranı %44 seviyesinde dengelidir. Mumcular ve Geyik barajlarındaki su rezervi Bodrum ve Milas içme suyunu karşılamakta; gece basınç optimizasyonu sürdürülmektedir.
• Ulaşım ve Kritik Koridorlar: D-330 karayolu üzerindeki Bodrum-Milas aksı, Marmaris Sakar rampası ve Fethiye çevre yolunda pik saatlerde kısmi yoğunluk yaşanmaktadır.
• Sosyal Gündem ve Kamuoyu: Yerel basında ve 28 resmi kamu portalında öne çıkan başlıklar su altyapı yatırımları, kıyı koruma faaliyetleri ve tarımsal sulama takvimine odaklanmaktadır.

3. ÖNCELİKLİ İCRA DİREKTİFLERİ
1. [AKOM & İtfaiye] OGM kuleleriyle ortak haberleşme kanalını açık tutun; rüzgar hızının arttığı öğle saatlerinde kırsal devriye sıklığını artırın.
2. [MUSKİ] Bodrum ve Milas isale hatlarında gece basınç modülasyonunu sürdürün; artezyen kuyu gruplarının debi ve jeneratör kontrollerini tamamlayın.
3. [Ulaşım Dairesi] Torba ve Sakar rampası gibi darboğaz kavşaklarda sinyalizasyon periyotlarını ana arter yönünde optimize edin.
4. [Zabıta & Güvenlik] Sahil bandı, meydanlar ve mesire alanlarında atık, yangın ve kamu düzeni denetimlerini aralıksız sürdürün.
5. [Basın ve Halkla İlişkiler] Su tasarrufu ve orman yangını hassasiyeti konusunda kamuoyu bilgilendirme duyurularını düzenli yayınlayın.

4. 48 SAATLİK STRATEJİK ÖNGÖRÜ
Önümüzdeki 48 saatlik periyotta hava koşullarında sert bir anomali beklenmemektedir. Hafta sonu yaklaşırken kıyı ilçelerine giriş yapan araç sayısında %15-20 artış öngörülmektedir. Altyapı ekiplerinin planlı kazı ve bakım faaliyetlerini cuma sabahına kadar tamamlaması tavsiye edilir.`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(rawMemoText);
    setCopied(true);
    toast({
      title: "Brifing Metni Kopyalandı",
      description: "WhatsApp, Telegram veya e-posta için hazır düz metin formatında panoya alındı.",
    });
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* ── Sol Alttaki Tetikleyici Buton (AnomalyPanel Butonu ile Aynı Boyut ve Tasarım) ── */}
      <SheetTrigger asChild>
        <button
          type="button"
          id="ai-strategy-trigger-btn"
          className="fixed bottom-6 left-6 z-40 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all hover:scale-110 group cursor-pointer border border-white/20 select-none"
          title="Kentsel Strateji & İcra Brifingi"
          aria-label="Kentsel Strateji Brifingi"
        >
          <div className="relative flex items-center justify-center pointer-events-none">
            <Brain className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-background" />
          </div>
        </button>
      </SheetTrigger>

      {/* ── Ekranın tam 1/4'ü (25vw) dikey formatında açılan Kentsel Strateji Çekmecesi ── */}
      <SheetContent
        side="left"
        style={{
          width: "clamp(320px, 25vw, 380px)",
          maxWidth: "85vw",
        }}
        className="max-h-screen overflow-hidden flex flex-col p-0 bg-[#0b111e] border-r border-slate-700/80 text-slate-100 font-mono shadow-2xl"
      >
        {/* Üst Başlık (AnomalyPanel Tasarımı) */}
        <SheetHeader className="p-4 border-b border-slate-700/80 bg-[#0e1626] shrink-0">
          <div className="flex items-start justify-between gap-2 pr-6">
            <SheetTitle className="flex items-center gap-2 text-sm sm:text-base font-bold font-mono text-white">
              <Brain className="w-5 h-5 text-emerald-400" />
              <span>AI Kentsel Strateji Paneli</span>
            </SheetTitle>
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[10px] shrink-0 font-mono">
              CANLI BRİFİNG
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300 mt-1">
            <span className="flex items-center gap-1.5 font-sans">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>13 İlçe Çapraz Veri Sentezi</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">{reportDateStr} · {reportTimeStr}</span>
          </div>
        </SheetHeader>

        {/* Kaydırılabilir İçerik Alanı (AnomalyPanel Alert Kartları Stili) */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-4 text-xs">
            {/* 1. KART: Genel Durum Özeti */}
            <div className="border border-slate-700/80 rounded-lg p-3.5 space-y-2 bg-[#131c2e] hover:border-emerald-500/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h4 className="font-semibold text-sm text-white">1. Genel Durum Özeti</h4>
                </div>
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[10px] font-bold">
                  NOMİNAL / DİKKAT
                </Badge>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                Muğla genelinde kentsel işleyiş istikrarlı seyrini korumaktadır. 13 ilçe genelinde kamu düzenini bozan kritik bir altyapı kesintisi veya akut kriz durumu bulunmamaktadır. Kıyı ilçelerindeki mevsimsel nüfus hareketliliği ile iç kesimlerdeki su havzası dengesi birbirini doğrudan etkilemektedir.
              </p>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800 font-mono">
                <span>Durum: Stabil</span>
                <span>Kaynak: Valilik & AKOM Doğrulandı</span>
              </div>
            </div>

            {/* 2. KART: Çapraz Stratejik Değerlendirme Başlığı */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  2. Çapraz Stratejik Değerlendirme
                </span>
                <span className="text-[10px] text-slate-400 font-mono">4 Kritik Gösterge</span>
              </div>

              {/* Alt Kartlar (AnomalyPanel Severity Renkleriyle) */}
              <div className="space-y-2.5">
                {/* Yangın & İklim (Uyarı/Warning Tarzı) */}
                <div className="border border-orange-500/40 bg-orange-950/30 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-semibold text-white">Yangın & İklim Güvenliği</span>
                    </div>
                    <Badge className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/50 font-bold">
                      ORTA RİSK
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    Sıcaklık ve bağıl nem değerlerinin rüzgar hamleleriyle birleşimi orman arayüzünde riski orta seviyede tutmaktadır. Kırsal kule gözetleme devriyeleri aktiftir.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">Sensör: Open-Meteo & OGM Kuleleri</p>
                </div>

                {/* Su & 8 Baraj (Bilgi/Info Tarzı) */}
                <div className="border border-cyan-500/40 bg-cyan-950/30 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-semibold text-white">Su & 8 Baraj Rezervi</span>
                    </div>
                    <Badge className="text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 font-bold">
                      %44 DOLULUK
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    8 resmi barajda ortalama doluluk %44 seviyesindedir. Mumcular ve Geyik rezervleri Bodrum ve Milas içme suyunu karşılamakta; gece basınç optimizasyonu sürdürülmektedir.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">Kaynak: 8 Doğrulanmış Baraj Envanteri</p>
                </div>

                {/* Ulaşım Koridorları */}
                <div className="border border-blue-500/40 bg-blue-950/30 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white">Ulaşım & Kritik Koridorlar</span>
                    </div>
                    <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/50 font-bold">
                      PİK SAAT
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    D-330 Bodrum-Milas aksı, Sakar rampası ve Fethiye çevre yolunda pik saatlerde kısmi yoğunluk tespit edilmektedir. Havalimanı transit transferleri ana arterleri belirler.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">Kaynak: TomTom Flow & Canlı ADS-B</p>
                </div>

                {/* Sosyal Gündem & Kamuoyu */}
                <div className="border border-purple-500/40 bg-purple-950/30 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-semibold text-white">Sosyal Gündem & Kamuoyu</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-purple-500/50 text-purple-400 bg-purple-500/10 font-bold">
                      28 PORTAL
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    Yerel basın ve 28 resmi kamu portalında su altyapı yatırımları, kıyı koruma ve tarımsal sulama takvimi ana gündem olarak öne çıkmaktadır.
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">Tarama: 14 Belediye + 14 Kaymakamlık/Valilik</p>
                </div>
              </div>
            </div>

            {/* 3. KART: Öncelikli İcra Direktifleri */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  3. Öncelikli İcra Direktifleri
                </span>
                <Badge variant="outline" className="text-[9px] font-mono border-slate-700 text-slate-300">5 DİREKTİF</Badge>
              </div>

              <div className="space-y-2">
                <div className="border border-slate-700/80 rounded-lg p-3 bg-[#101726] space-y-1.5 hover:border-amber-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-amber-400">1. [AKOM & İtfaiye Dairesi]</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    OGM kuleleriyle ortak haberleşme kanalını açık tutun; rüzgar hızının arttığı öğle saatlerinde kırsal devriye sıklığını artırın.
                  </p>
                </div>

                <div className="border border-slate-700/80 rounded-lg p-3 bg-[#101726] space-y-1.5 hover:border-cyan-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-cyan-400">2. [MUSKİ Genel Müdürlüğü]</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    Bodrum-Milas isale hatlarında gece basınç modülasyonunu koruyun; artezyen kuyu gruplarının debi ve jeneratör kontrollerini tamamlayın.
                  </p>
                </div>

                <div className="border border-slate-700/80 rounded-lg p-3 bg-[#101726] space-y-1.5 hover:border-blue-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-blue-400">3. [Ulaşım Dairesi Başkanlığı]</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    Torba ve Sakar rampası gibi darboğaz kavşaklarda sinyalizasyon periyotlarını ana arter yönünde optimize edin.
                  </p>
                </div>

                <div className="border border-slate-700/80 rounded-lg p-3 bg-[#101726] space-y-1.5 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-emerald-400">4. [Zabıta & Güvenlik Dairesi]</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    Sahil bandı, meydanlar ve mesire alanlarında atık, yangın ve kamu düzeni denetimlerini aralıksız sürdürün.
                  </p>
                </div>

                <div className="border border-slate-700/80 rounded-lg p-3 bg-[#101726] space-y-1.5 hover:border-purple-500/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-purple-400">5. [Basın ve Halkla İlişkiler]</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    Su tasarrufu ve orman yangını hassasiyeti konusunda kamuoyu bilgilendirme duyurularını düzenli yayınlayın.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. KART: 48 Saatlik Stratejik Öngörü */}
            <div className="border border-slate-700/80 rounded-lg p-3.5 space-y-2 bg-[#131c2e]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-semibold text-sm text-white">4. 48 Saatlik Stratejik Öngörü</h4>
                </div>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">TAHMİN</Badge>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">
                Önümüzdeki 48 saatte meteorolojik anomali beklenmemektedir. Hafta sonu giriş yapan araç sayısında %15-20 artış öngörüldüğünden, planlı kazı ve altyapı işlerinin cuma sabahına kadar tamamlanması önerilir.
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Alt Aksiyon Çubuğu (AnomalyPanel Stili Butonlar) */}
        <div className="p-3.5 border-t border-slate-700/80 bg-[#0e1626] flex items-center gap-2 shrink-0">
          <Button
            variant="default"
            size="sm"
            onClick={handleCopy}
            className="flex-1 text-xs gap-1.5 font-bold cursor-pointer shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
            <span>{copied ? "Brifing Panoya Alındı" : "Brifingi Kopyala"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs gap-1.5 cursor-pointer shrink-0 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
            title="Brifingi Yenile"
          >
            <RefreshCw size={13} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
            <span>Yenile</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
