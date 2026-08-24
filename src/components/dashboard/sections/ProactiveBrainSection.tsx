import { useState, useEffect } from "react";
import {
  Brain, Flame, AlertTriangle, HelpCircle, Users2, ShieldAlert, Sparkles,
  TrendingUp, Compass, ThermometerSun, Droplets, Wind, Heart, Play, Activity, CheckCircle2,
  Newspaper, Scale, Hourglass, Radio, Flag
} from "lucide-react";
import { DashboardPanel } from "../DashboardPanel";
import { MiniChart } from "../MiniChart";
import { StatCard } from "../StatCard";
import { supabase } from "@/integrations/supabase/client";

type Scenario = "normal" | "heatwave" | "mega_tourism" | "social_tension" | "yoruk_toy";

interface Briefing {
  headline: string;
  story: string;
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  lifecycle: {
    before: { title: string; items: string[] };
    during: { title: string; items: string[] };
    after: { title: string; items: string[] };
  };
}

const SWOT_CELLS = [
  { key: "strengths", label: "GÜÇLÜ YÖNLER", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-950/20" },
  { key: "weaknesses", label: "ZAYIF YÖNLER", color: "text-red-400", border: "border-red-500/30", bg: "bg-red-950/20" },
  { key: "opportunities", label: "FIRSATLAR", color: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-950/20" },
  { key: "threats", label: "TEHDİTLER", color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-950/20" },
] as const;

const LIFECYCLE_PHASES = [
  { key: "before", icon: Hourglass, color: "text-blue-400", border: "border-blue-500/30" },
  { key: "during", icon: Radio, color: "text-green-400", border: "border-green-500/30" },
  { key: "after", icon: Flag, color: "text-violet-400", border: "border-violet-500/30" },
] as const;



export const ProactiveBrainSection = () => {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [pulse, setPulse] = useState(true);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Senaryo değişince city-briefing fonksiyonundan AI brifingi çek
  useEffect(() => {
    let cancelled = false;
    setBriefingLoading(true);
    supabase.functions.invoke("city-briefing", { body: { scenario } })
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.briefing) setBriefing(data.briefing as Briefing);
      })
      .catch(() => { /* briefing opsiyonel */ })
      .finally(() => { if (!cancelled) setBriefingLoading(false); });
    return () => { cancelled = true; };
  }, [scenario]);

  // Auto pulsing live effect
  useEffect(() => {
    const iv = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(iv);
  }, []);

  // Dynamically computed metrics based on scenario
  const getMetrics = () => {
    switch (scenario) {
      case "heatwave":
        return {
          fireRisk: 89,
          fireRiskLevel: "AŞIRI (CRITICAL)",
          fireRiskColor: "text-red-500",
          humidity: 11,
          temp: 42.4,
          wind: 28,
          socialTension: 24,
          socialTensionLevel: "Stabil",
          socialTensionColor: "text-green-400",
          tomorrowForecast: "Köyceğiz ve Milas hattında %94 orman yangın başlama riski. Nem dengesi sıfır noktasına yakın.",
          playbookAction: "Önleyici Tedbir: Bölgedeki su tankerleri stratejik noktalara sevk edildi. Orman giriş yolları drone denetimine alındı.",
          tomorrowTourism: 12400,
        };
      case "mega_tourism":
        return {
          fireRisk: 42,
          fireRiskLevel: "Orta",
          fireRiskColor: "text-yellow-400",
          humidity: 38,
          temp: 32.5,
          wind: 12,
          socialTension: 58,
          socialTensionLevel: "Kritik Sınır (İkaz)",
          socialTensionColor: "text-orange-400",
          tomorrowForecast: "Bodrum ve Fethiye ilçelerine 48 saatte toplam +45,000 ek turist girişi bekleniyor. Altyapı yükü %88 artacak.",
          playbookAction: "Önleyici Tedbir: Su şebekesi pompa devirleri %15 artırıldı. Bodrum giriş trafiği alternatif güzergahlara yönlendiriliyor.",
          tomorrowTourism: 45000,
        };
      case "social_tension":
        return {
          fireRisk: 30,
          fireRiskLevel: "Düşük",
          fireRiskColor: "text-green-400",
          humidity: 45,
          temp: 29.8,
          wind: 10,
          socialTension: 82,
          socialTensionLevel: "Yüksek (SOSYAL KRİZ)",
          socialTensionColor: "text-red-500",
          tomorrowForecast: "Datça ve Bodrum mahallelerindeki lokal su kesintisi paylaşımları son 3 saatte %340 artarak kriz seviyesine girdi.",
          playbookAction: "Önleyici Tedbir: Belediye ve MUSKİ koordinasyonuyla 4 acil tanker sevkiyatı koordine edildi, kriz masası duyurusu yapıldı.",
          tomorrowTourism: 8200,
        };
      case "yoruk_toy":
        return {
          fireRisk: 25,
          fireRiskLevel: "Çok Düşük",
          fireRiskColor: "text-blue-400",
          humidity: 48,
          temp: 28.2,
          wind: 14,
          socialTension: 8,
          socialTensionLevel: "Mükemmel (Yüksek Moral)",
          socialTensionColor: "text-cyan-400",
          tomorrowForecast: "17. Uluslararası Muğla Yörük Türkmen Toyu kapsamında 12,400+ aktif bahsetme ve haber akışı platform tarafından konsolide edildi.",
          playbookAction: "Önleyici Tedbir: Ring seferleri ve otopark denetimleri optimize edilerek ulaşımdaki hafif %2'lik otopark şikayeti yatıştırıldı.",
          tomorrowTourism: 14500,
        };
      case "normal":
      default:
        return {
          fireRisk: 38,
          fireRiskLevel: "Orta Risk",
          fireRiskColor: "text-yellow-400",
          humidity: 42,
          temp: 26.5,
          wind: 12,
          socialTension: 16,
          socialTensionLevel: "Normal (Duygu Pozitif)",
          socialTensionColor: "text-green-400",
          tomorrowForecast: "Muğla genelinde yarın hava stabil, orman yangın riski orta, turizm giriş hızı dengeli öngörülmektedir.",
          playbookAction: "Önleyici Tedbir: Otonom sistem rüzgar ve nem dengelerini her 15 dakikada bir analiz etmeye devam ediyor.",
          tomorrowTourism: 11800,
        };
    }
  };

  const metrics = getMetrics();

  // Simulated live trend logic
  const fireTrendData = [
    { name: "09:00", value: metrics.fireRisk - 5 },
    { name: "12:00", value: metrics.fireRisk },
    { name: "15:00", value: metrics.fireRisk + 3 },
    { name: "18:00", value: metrics.fireRisk - 2 },
    { name: "21:00", value: metrics.fireRisk - 4 },
  ];

  return (
    <div className="space-y-4">
      <DashboardPanel
        title="Predictive Regional Brain"
        subtitle="Otonom Tahmin, Erken Uyarı ve Senaryo Yönetim Merkezi"
        icon={<Brain className="text-primary animate-pulse" size={15} />}
        badge="PROAKTİF BEYİN"
        badgeVariant="live"
      >
        <div className="p-3 bg-secondary/20 rounded-lg border border-border/40 space-y-3">
          
          {/* Header Description */}
          <div className="flex items-start gap-2">
            <Sparkles size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
              Bu panel, Muğla genelinden akan anlık hava verileri (nem gradiyenti), sosyal medya eğilimleri ve 
              altyapı göstergelerini otonom yapay zeka modelleriyle işleyerek <span className="text-foreground font-bold">gelecek 24 saatin risk haritasını</span> çıkarır.
            </p>
          </div>

          <hr className="border-border/30" />

          {/* Scenario Sandbox Controls */}
          <div>
            <div className="text-[9px] font-mono font-bold text-primary/80 uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Play size={10} /> Simulator & Karar Destek Senaryoları
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {[
                { value: "normal", label: "Normal Akış", emoji: "🟢" },
                { value: "heatwave", label: "Aşırı Sıcak", emoji: "🔥" },
                { value: "mega_tourism", label: "Yolcu Akını", emoji: "🛳️" },
                { value: "social_tension", label: "Sosyal Kriz", emoji: "⚠️" },
                { value: "yoruk_toy", label: "Yörük Toyu", emoji: "⛺" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => setScenario(btn.value as Scenario)}
                  className={`text-[8px] font-mono px-2 py-1.5 rounded border transition-all text-center flex items-center justify-center gap-1 ${
                    scenario === btn.value
                      ? "bg-primary/20 text-primary border-primary/40 font-bold"
                      : "bg-muted/10 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/20"
                  }`}
                >
                  <span>{btn.emoji}</span> {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Diagnostic Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1.5">
            
            {/* 1. Nem Dengesi ve Yangın Erken Sezi */}
            <div className="p-2.5 rounded-md bg-background/50 border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1.5">
                  <Flame size={12} className="text-red-400 animate-pulse" /> YANGIN ERKEN SEZİ
                </span>
                <span className="text-[7px] font-mono text-muted-foreground bg-muted/40 px-1 py-0.5 rounded">
                  MODEL: FWI-A2
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-md font-mono font-bold ${metrics.fireRiskColor}`}>
                  {metrics.fireRiskLevel}
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  Skor {metrics.fireRisk}/100
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-mono text-muted-foreground">
                  <span>Relative Humidity</span>
                  <span className={metrics.humidity < 15 ? "text-red-400 font-bold" : ""}>
                    {metrics.humidity}%
                  </span>
                </div>
                <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-400 transition-all duration-500" 
                    style={{ width: `${metrics.fireRisk}%` }}
                  />
                </div>
                <p className="text-[8px] font-mono text-muted-foreground/80 leading-tight">
                  Nem/sıcaklık gradiyenti yapraksı yanıcı madde kuruluğunu ve rüzgar yayılımını otonom modeller.
                </p>
              </div>
            </div>

            {/* 2. Sosyal Kriz ve Gerginlik Erken Uyarı */}
            <div className="p-2.5 rounded-md bg-background/50 border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1.5">
                  <ShieldAlert size={12} className="text-amber-400" /> SOSYAL GERGİNLİK GÖSTERGESİ
                </span>
                <span className="text-[7px] font-mono text-muted-foreground bg-muted/40 px-1 py-0.5 rounded">
                  NLP-COEF
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-md font-mono font-bold ${metrics.socialTensionColor}`}>
                  {metrics.socialTensionLevel}
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {metrics.socialTension}% Gerginlik
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-mono text-muted-foreground">
                  <span>Sosyal Altyapı Şikayet Payı</span>
                  <span>{metrics.socialTension > 50 ? "YÜKSEK" : "Normal"}</span>
                </div>
                <div className="w-full h-1 bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-400 transition-all duration-500" 
                    style={{ width: `${metrics.socialTension}%` }}
                  />
                </div>
                <p className="text-[8px] font-mono text-muted-foreground/80 leading-tight">
                  Su kesintisi, elektrik yükü, toplu taşıma şikayetlerinin anlık ivmelenme katsayısı.
                </p>
              </div>
            </div>

            {/* 3. Yarın Ne Olacak Öngörü Odası */}
            <div className="p-2.5 rounded-md bg-background/50 border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1.5">
                  <Compass size={12} className="text-cyan-400" /> TAHMİNİ TURİST & YOLCU GİRİŞİ
                </span>
                <span className="text-[7px] font-mono text-muted-foreground bg-muted/40 px-1 py-0.5 rounded">
                  REGRESSION-V1
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-md font-mono font-bold text-cyan-400">
                  +{metrics.tomorrowTourism.toLocaleString()}
                </span>
                <span className="text-xs font-mono font-bold text-foreground">
                  Ziyaretçi / Gün
                </span>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground/80 leading-normal">
                Uçak uçuş verileri, deniz kruvaziyer planlamaları ve otel rezervasyon doluluk trendlerine dayanan 24 saatlik nüfus simülasyonu.
              </p>
            </div>

          </div>

          {/* AI Prognostic Advice Banner */}
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${pulse ? "bg-red-500" : "bg-red-400"} animate-ping`} />
              <div className="text-[10px] font-mono font-bold text-foreground flex items-center gap-1.5">
                🔮 YARIN NE OLACAK? PROAKTİF AKILLI ROPOR:
              </div>
            </div>
            <p className="text-[11px] font-mono text-foreground leading-relaxed">
              {metrics.tomorrowForecast}
            </p>
            <div className="mt-2 text-[9px] font-mono text-primary/90 bg-primary/5 p-1.5 rounded border border-primary/10">
              ⚡ {metrics.playbookAction}
            </div>
          </div>

          {/* ═══ ŞEHİR GAZETESİ — Günlük AI Manşeti ═══ */}
          {(briefing || briefingLoading) && (
            <div className="relative overflow-hidden rounded-md border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-background to-background p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1">
                  <Newspaper size={11} /> Şehir Gazetesi — {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}
                </span>
                {briefingLoading && <span className="text-[8px] font-mono text-muted-foreground animate-pulse">AI yazıyor…</span>}
              </div>
              {briefing && (
                <>
                  <h3 className="text-sm font-mono font-bold text-foreground leading-snug border-b border-amber-500/20 pb-1.5">
                    📰 {briefing.headline}
                  </h3>
                  <p className="text-[10px] font-mono text-muted-foreground leading-relaxed italic">
                    {briefing.story}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ═══ ETKİNLİK YAŞAM DÖNGÜSÜ — Öncesi / Sırasında / Sonrası ═══ */}
          {briefing && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono font-bold text-primary/80 uppercase tracking-widest flex items-center gap-1">
                <Hourglass size={10} /> Etkinlik Yaşam Döngüsü Raporu
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {LIFECYCLE_PHASES.map(({ key, icon: PhaseIcon, color, border }) => {
                  const phase = briefing.lifecycle[key as keyof Briefing["lifecycle"]];
                  return (
                    <div key={key} className={`p-2.5 rounded-md bg-background/50 border ${border} space-y-1.5`}>
                      <div className={`text-[9px] font-mono font-bold flex items-center gap-1.5 ${color}`}>
                        <PhaseIcon size={11} /> {phase.title}
                      </div>
                      <ul className="space-y-1">
                        {phase.items.map((item, i) => (
                          <li key={i} className="text-[9px] font-mono text-muted-foreground leading-snug flex items-start gap-1">
                            <span className={`${color} flex-shrink-0`}>▸</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ CANLI SWOT ANALİZİ ═══ */}
          {briefing && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono font-bold text-primary/80 uppercase tracking-widest flex items-center gap-1">
                <Scale size={10} /> Stratejik Durum Analizi — Canlı SWOT
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SWOT_CELLS.map(({ key, label, color, border, bg }) => (
                  <div key={key} className={`p-2.5 rounded-md border ${border} ${bg} space-y-1`}>
                    <div className={`text-[9px] font-mono font-bold ${color}`}>{label}</div>
                    <ul className="space-y-0.5">
                      {briefing.swot[key as keyof Briefing["swot"]].map((item, i) => (
                        <li key={i} className="text-[9px] font-mono text-foreground/80 leading-snug">• {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Featured Event Deep Dive: 17. Uluslararası Muğla Yörük Türkmen Toyu Özel Analizi */}
          <div className="p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Heart className="text-cyan-400 animate-pulse fill-cyan-400" size={12} />
                <span className="text-[10px] font-mono font-bold text-cyan-300">
                  Özel Vaka Analiz Alanı: 17. Uluslararası Muğla Yörük Türkmen Toyu
                </span>
              </div>
              <span className="text-[8px] font-mono font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                BAŞARIYLA TESPİT EDİLDİ
              </span>
            </div>
            
            <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
              Muğla Büyükşehir Belediyesi tarafından <span className="text-foreground">5-7 Haziran 2026</span> tarihlerinde düzenlenen devasa etkinlik otonom sistemlerimiz tarafından anında fark edilerek tam teşekküllü sentiment ve protokol haritalandırmasından geçirilmiştir:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-1.5 bg-background/50 border border-border/20 rounded text-center">
                <div className="text-[7px] font-mono text-muted-foreground uppercase">Haber & Paylaşım</div>
                <div className="text-xs font-mono font-bold text-foreground">12,400+</div>
              </div>
              <div className="p-1.5 bg-green-950/20 border border-green-805/30 rounded text-center">
                <div className="text-[7px] font-mono text-muted-foreground uppercase">Pozitif Duygu</div>
                <div className="text-xs font-mono font-bold text-green-400">%94.2</div>
              </div>
              <div className="p-1.5 bg-red-950/20 border border-red-805/30 rounded text-center">
                <div className="text-[7px] font-mono text-muted-foreground uppercase">Negatif Duygu</div>
                <div className="text-xs font-mono font-bold text-red-400">%1.8</div>
              </div>
              <div className="p-1.5 bg-background/50 border border-border/20 rounded text-center">
                <div className="text-[7px] font-mono text-muted-foreground uppercase">Kültürel Etki</div>
                <div className="text-xs font-mono font-bold text-cyan-400">9.8/10</div>
              </div>
            </div>

            <div className="text-[8.5px] font-mono text-muted-foreground/90 space-y-1">
              <div className="flex items-start gap-1">
                <CheckCircle2 size={10} className="text-green-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Sentiment Ayrıştırması:</strong> Pozitif paylaşımlar yörük kültürünün canlandırılması, yerel yönetim desteği, kortej yürüyüşü ve şenlik coşkusuna odaklanırken; asgari düzeyde kalan negatif/nötr eğilimler sadece <span className="text-red-300">"aşırı sıcak hava"</span> ve <span className="text-orange-300">"otopark/ulaşım ring hattındaki yoğunluklar"</span> olarak saptanmıştır.
                </span>
              </div>
              <div className="flex items-start gap-1">
                <CheckCircle2 size={10} className="text-green-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Vali ve Büyükşehir Belediye Başkanı Eşleşmesi:</strong> Basın haberleri ve protokol entegrasyonu başarıyla süzüldü. Yerel kültür ve turizme sinerji etkisi <strong>9.8</strong> olarak skorlandı.
                </span>
              </div>
            </div>
          </div>

        </div>
      </DashboardPanel>
    </div>
  );
};
