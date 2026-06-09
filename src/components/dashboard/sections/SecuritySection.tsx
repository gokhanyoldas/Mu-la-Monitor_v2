import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Gauge } from "../Gauge";
import { Shield, AlertTriangle, Landmark, Newspaper, MapPin, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useState, useEffect } from "react";

const radarPoints = [
  { name: "Bodrum - Milas Arası", lat: 37.28, lng: 27.67, type: "radar" },
  { name: "Marmaris Giriş D400", lat: 36.85, lng: 28.27, type: "radar" },
  { name: "Fethiye - Göcek Arası", lat: 36.65, lng: 29.12, type: "radar" },
  { name: "Muğla - Yatağan Yolu", lat: 37.18, lng: 28.33, type: "radar" },
  { name: "Dalaman Havalimanı Çevresi", lat: 36.71, lng: 28.79, type: "denetim" },
  { name: "Ortaca - Dalyan Kavşağı", lat: 36.84, lng: 28.76, type: "denetim" },
  { name: "Datça Yarımada Girişi", lat: 36.73, lng: 27.69, type: "denetim" },
  { name: "Köyceğiz - Muğla Yolu", lat: 37.07, lng: 28.65, type: "radar" },
  { name: "Milas Şehir İçi", lat: 37.32, lng: 27.78, type: "denetim" },
  { name: "Ula - Muğla Bağlantısı", lat: 37.10, lng: 28.41, type: "radar" },
];

const TrafficMap = () => {
  const mapWidth = 400;
  const mapHeight = 280;
  const minLat = 36.5, maxLat = 37.5;
  const minLng = 27.3, maxLng = 29.5;

  const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (mapWidth - 40) + 20;
  const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * (mapHeight - 40) + 20;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-auto" style={{ minHeight: 200 }}>
        <rect width={mapWidth} height={mapHeight} fill="hsl(var(--background))" rx="4" />
        <path
          d={`M ${toX(27.4)} ${toY(37.4)} L ${toX(28.0)} ${toY(37.45)} L ${toX(28.8)} ${toY(37.35)} L ${toX(29.3)} ${toY(37.1)} L ${toX(29.4)} ${toY(36.8)} L ${toX(29.2)} ${toY(36.55)} L ${toX(28.7)} ${toY(36.6)} L ${toX(28.2)} ${toY(36.75)} L ${toX(27.8)} ${toY(36.65)} L ${toX(27.4)} ${toY(36.7)} L ${toX(27.35)} ${toY(37.0)} Z`}
          fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1"
        />
        {[27.5, 28.0, 28.5, 29.0].map(lng => (
          <line key={`lng-${lng}`} x1={toX(lng)} y1={20} x2={toX(lng)} y2={mapHeight - 20}
            stroke="hsl(var(--border) / 0.3)" strokeWidth="0.5" strokeDasharray="3,3" />
        ))}
        {[36.7, 37.0, 37.3].map(lat => (
          <line key={`lat-${lat}`} x1={20} y1={toY(lat)} x2={mapWidth - 20} y2={toY(lat)}
            stroke="hsl(var(--border) / 0.3)" strokeWidth="0.5" strokeDasharray="3,3" />
        ))}
        {radarPoints.map((p, i) => (
          <g key={i}>
            <circle cx={toX(p.lng)} cy={toY(p.lat)} r="8"
              fill={p.type === "radar" ? "hsl(var(--destructive) / 0.15)" : "hsl(var(--warning) / 0.15)"}
              className="animate-pulse" />
            <circle cx={toX(p.lng)} cy={toY(p.lat)} r="3.5"
              fill={p.type === "radar" ? "hsl(var(--destructive))" : "hsl(var(--warning))"}
              stroke="hsl(var(--background))" strokeWidth="1" />
            <text x={toX(p.lng)} y={toY(p.lat) - 8}
              textAnchor="middle" fontSize="5" fontFamily="monospace"
              fill="hsl(var(--muted-foreground))">
              {p.name.length > 20 ? p.name.substring(0, 18) + "…" : p.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-[10px] font-mono text-muted-foreground">Radar Noktası</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-warning" />
          <span className="text-[10px] font-mono text-muted-foreground">Trafik Denetim</span>
        </div>
      </div>
    </div>
  );
};

const defaultRoadWorks = [
  { road: "Muğla-Bodrum D330 (Km 42-48)", status: "KAPALI", detail: "Asfalt yenileme — Tahmini bitiş: 15 Mar", type: "closed" as const },
  { road: "Fethiye-Ölüdeniz Yolu", status: "TEK ŞERİT", detail: "Kanalizasyon çalışması — Kontrollü geçiş", type: "partial" as const },
  { road: "Marmaris-Datça D400 (Km 12-15)", status: "TEK ŞERİT", detail: "Heyelan önleme çalışması — Gece 22:00-06:00 kapalı", type: "partial" as const },
  { road: "Milas Çevreyolu Kavşak", status: "KAPALI", detail: "Kavşak düzenleme — Alternatif güzergah: D525", type: "closed" as const },
  { road: "Ortaca-Dalyan Köprü", status: "NORMAL", detail: "Bakım tamamlandı — Trafiğe açıldı", type: "open" as const },
  { road: "Yatağan-Muğla Arası (Km 8)", status: "TEK ŞERİT", detail: "Boru hattı döşeme — 08:00-18:00 arası kontrollü", type: "partial" as const },
];

const defaultNews = [
  { time: "14:32", text: "Bodrum'da yeni marina projesi onaylandı", type: "info" as const, reads: "12.4K", shares: 842, trend: 18 },
  { time: "13:50", text: "Muğla'da sıcaklık mevsim normallerinin üstünde", type: "info" as const, reads: "8.7K", shares: 324, trend: 5 },
  { time: "12:15", text: "Marmaris'te orman yangını riski düşük seviyede", type: "ok" as const, reads: "15.2K", shares: 1240, trend: 32 },
  { time: "11:40", text: "Datça'da yeni arkeolojik keşif yapıldı", type: "info" as const, reads: "6.1K", shares: 512, trend: 24 },
  { time: "10:45", text: "Fethiye belediyesi bisiklet yolu ihalesini açıkladı", type: "info" as const, reads: "4.8K", shares: 215, trend: -3 },
  { time: "09:20", text: "Dalaman Havalimanı sezon hazırlıkları tamamlandı", type: "ok" as const, reads: "9.3K", shares: 678, trend: 12 },
  { time: "08:00", text: "Muğla'da hava kalitesi 'İYİ' seviyesinde", type: "ok" as const, reads: "3.2K", shares: 145, trend: 0 },
];

export const SecuritySection = () => {
  const [keywords, setKeywords] = useState<string[]>(() => {
    const saved = localStorage.getItem("social-intel-keywords");
    return saved ? JSON.parse(saved) : ["Muğla", "Bodrum", "Fethiye", "Marmaris"];
  });

  // Listen for keyword changes from SocialIntel page
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "social-intel-keywords" && e.newValue) {
        setKeywords(JSON.parse(e.newValue));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const { data: liveNews, isLoading: newsLoading } = useLiveData<any[]>("news", {
    refetchInterval: 5 * 60 * 1000,
    extraBody: { keywords },
  });
  const { data: liveRoadWorks, isLoading: rwLoading } = useLiveData<any[]>("road_works", { refetchInterval: 15 * 60 * 1000 });

  const newsItems = liveNews && liveNews.length > 0
    ? liveNews.map((n: any, i: number) => ({
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false }),
        text: n.title || n.description || "",
        type: "info" as const,
        reads: "",
        shares: 0,
        trend: 0,
        source: n.source || "",
        url: n.url || "",
      }))
    : defaultNews;

  const roadWorkItems = liveRoadWorks && liveRoadWorks.length > 0
    ? liveRoadWorks.map((rw: any) => ({
        road: rw.title || "",
        status: "BİLGİ",
        detail: rw.description || "",
        type: "partial" as const,
      }))
    : defaultRoadWorks;

  return (
    <div className="space-y-3">
      <DashboardPanel title="Güvenlik" icon={<Shield size={14} />} badge="AKTİF" badgeVariant="active">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Asayiş Olayı (Ay)" value="485" variant="primary" />
          <StatCard label="Trafik Kazası (Ay)" value="128" variant="warning" />
        </div>
        <div className="flex justify-around">
          <Gauge value={78} max={100} label="Güvenlik Skoru" variant="primary" />
          <Gauge value={22} max={100} label="Suç Oranı İndeks" variant="primary" />
        </div>
      </DashboardPanel>

      <DashboardPanel title="Radar & Trafik Denetim Haritası" icon={<MapPin size={14} />} badge="CANLI" badgeVariant="live">
        <TrafficMap />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <StatCard label="Aktif Radar" value={`${radarPoints.filter(p => p.type === "radar").length}`} variant="destructive" />
          <StatCard label="Denetim Noktası" value={`${radarPoints.filter(p => p.type === "denetim").length}`} variant="warning" />
        </div>
      </DashboardPanel>

      <DashboardPanel title="Yol Çalışmaları & Kapanmalar" icon={<AlertTriangle size={14} />} badge="AKTİF" badgeVariant="warning">
        {rwLoading && <Loader2 size={12} className="animate-spin text-muted-foreground mb-2" />}
        <div className="space-y-2">
          {roadWorkItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                item.type === "closed" ? "bg-destructive" : item.type === "partial" ? "bg-warning" : "bg-success"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground/90 truncate">{item.road}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    item.type === "closed" ? "bg-destructive/20 text-destructive" : item.type === "partial" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                  }`}>{item.status}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <span className="text-[10px] font-mono text-muted-foreground">Kapalı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-warning" />
            <span className="text-[10px] font-mono text-muted-foreground">Tek Şerit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="text-[10px] font-mono text-muted-foreground">Açık</span>
          </div>
        </div>
      </DashboardPanel>

      <DashboardPanel title="Acil Durum" badge="NORMAL" badgeVariant="active">
        <StatusList items={[
          { label: "Deprem Riski", value: "ORTA", status: "warning" },
          { label: "Sel Riski", value: "DÜŞÜK", status: "ok" },
          { label: "Yangın Riski", value: "DÜŞÜK", status: "ok" },
          { label: "Kriz Yönetimi", value: "HAZIR", status: "ok" },
          { label: "Aktif Uyarı", value: "YOK", status: "ok" },
        ]} />
      </DashboardPanel>

      <DashboardPanel title="Yerel Yönetim" icon={<Landmark size={14} />}>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Belediye Bütçesi" value="8.2" unit="Myr ₺" />
          <StatCard label="Yatırım" value="1.4" unit="Myr ₺" variant="primary" />
        </div>
        <StatusList items={[
          { label: "Altyapı Harcama", value: "32%", status: "ok" },
          { label: "Sosyal Hizmetler", value: "18%", status: "info" },
          { label: "Kültür & Sanat", value: "8%", status: "info" },
          { label: "Şeffaflık Skoru", value: "72/100", status: "ok" },
          { label: "Meclis Kararları", value: "48 karar", status: "info" },
        ]} />
      </DashboardPanel>

      <DashboardPanel title="Haber Akışı" icon={<Newspaper size={14} />} badge="CANLI" badgeVariant="live">
        {newsLoading && <Loader2 size={12} className="animate-spin text-muted-foreground mb-2" />}
        <div className="space-y-2">
          {newsItems.map((news, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">{news.time}</span>
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${news.type === "ok" ? "bg-success" : "bg-accent"}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground/80 block">{news.text}</span>
                <div className="flex items-center gap-3 mt-0.5">
                  {news.source && <span className="text-[9px] font-mono text-primary">{news.source}</span>}
                  {news.reads && <span className="text-[9px] font-mono text-muted-foreground">👁 {news.reads}</span>}
                  {news.shares > 0 && <span className="text-[9px] font-mono text-muted-foreground">↗ {news.shares}</span>}
                  {news.trend !== 0 && (
                    <span className={`text-[9px] font-mono font-bold ${news.trend > 0 ? "text-success" : "text-destructive"}`}>
                      {news.trend > 0 ? "▲" : "▼"} {Math.abs(news.trend)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
};
