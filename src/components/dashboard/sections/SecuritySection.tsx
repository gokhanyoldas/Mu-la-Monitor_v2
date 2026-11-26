import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Shield, AlertTriangle, Landmark, Newspaper, MapPin, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useState, useEffect } from "react";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useSecurityIntelligence,
  useEconomyIntelligence,
  canonicalizeBudgetInstitution,
  formatShortTurkishDate,
  type SecurityTopicEvent,
} from "@/services/topicGroundingService";
import { formatQuakeLocation } from "@/hooks/useAISummary";
import { formatRelativeTime } from "@/lib/time-utils";
import { useMonitorStore, selectEarthquakes } from "@/store/useMonitorStore";
import { DataOriginBadge } from "../DataOriginBadge";

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
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const mapWidth = 400;
  const mapHeight = 280;
  const minLat = 36.5,
    maxLat = 37.5;
  const minLng = 27.3,
    maxLng = 29.5;

  const toX = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * (mapWidth - 40) + 20;
  const toY = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * (mapHeight - 40) + 20;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-auto" style={{ minHeight: 200 }}>
        <rect width={mapWidth} height={mapHeight} fill="hsl(var(--background))" rx="4" />
        <path
          d={`M ${toX(27.4)} ${toY(37.4)} L ${toX(28.0)} ${toY(37.45)} L ${toX(28.8)} ${toY(37.35)} L ${toX(29.3)} ${toY(37.1)} L ${toX(29.4)} ${toY(36.8)} L ${toX(29.2)} ${toY(36.55)} L ${toX(28.7)} ${toY(36.6)} L ${toX(28.2)} ${toY(36.75)} L ${toX(27.8)} ${toY(36.65)} L ${toX(27.4)} ${toY(36.7)} L ${toX(27.35)} ${toY(37.0)} Z`}
          fill="hsl(var(--muted) / 0.3)"
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
        {[27.5, 28.0, 28.5, 29.0].map((lng) => (
          <line
            key={`lng-${lng}`}
            x1={toX(lng)}
            y1={20}
            x2={toX(lng)}
            y2={mapHeight - 20}
            stroke="hsl(var(--border) / 0.3)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        ))}
        {[36.7, 37.0, 37.3].map((lat) => (
          <line
            key={`lat-${lat}`}
            x1={20}
            y1={toY(lat)}
            x2={mapWidth - 20}
            y2={toY(lat)}
            stroke="hsl(var(--border) / 0.3)"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        ))}
        {radarPoints.map((p, i) => (
          <g key={i}>
            <circle
              cx={toX(p.lng)}
              cy={toY(p.lat)}
              r="8"
              fill={p.type === "radar" ? "hsl(var(--destructive) / 0.15)" : "hsl(var(--warning) / 0.15)"}
              className="animate-pulse"
            />
            <circle
              cx={toX(p.lng)}
              cy={toY(p.lat)}
              r="3.5"
              fill={p.type === "radar" ? "hsl(var(--destructive))" : "hsl(var(--warning))"}
              stroke="hsl(var(--background))"
              strokeWidth="1"
            />
            <text
              x={toX(p.lng)}
              y={toY(p.lat) - 8}
              textAnchor="middle"
              fontSize="5"
              fontFamily="monospace"
              fill="hsl(var(--muted-foreground))"
            >
              {p.name.length > 20 ? p.name.substring(0, 18) + "…" : p.name}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {isEn ? "Speed Radar" : "Radar Noktası"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-warning" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {isEn ? "Traffic Check" : "Trafik Denetim"}
          </span>
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

const getSecurityCategoryLabel = (
  category: SecurityTopicEvent["category"],
  isEn: boolean
): { label: string; className: string } => {
  switch (category) {
    case "yangin":
      return {
        label: isEn ? "Fire" : "Yangın",
        className: "bg-destructive/20 text-destructive border-destructive/30",
      };
    case "trafik_kazasi":
      return {
        label: isEn ? "Traffic" : "Kaza",
        className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      };
    case "deniz_guvenligi":
      return {
        label: isEn ? "Coast Guard" : "Sahil Güv.",
        className: "bg-sky-500/20 text-sky-300 border-sky-500/30",
      };
    default:
      return {
        label: isEn ? "Public Order" : "Asayiş",
        className: "bg-primary/15 text-primary border-primary/30",
      };
  }
};

export const SecurityOverviewPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const storeQuakes = useMonitorStore(selectEarthquakes);
  const {
    quakes: queryQuakes,
    latestQuake: queryLatestQuake,
    publicOrderEvents,
    publicOrderCount,
    hasVerifiedLiveData: queryHasLive,
    latestSourceSummary,
    isLoading,
  } = useSecurityIntelligence();

  const quakes =
    storeQuakes.items.length > 0
      ? storeQuakes.items.map((q) => ({
          id: q.id,
          magnitude: q.magnitude,
          location: q.location,
          depthKm: q.depthKm,
          occurredAt: q.occurredAt,
          sourceName: q.sourceName || "AFAD/USGS",
          sourceUrl: q.url,
        }))
      : queryQuakes;
  const latestQuake = quakes[0] ?? queryLatestQuake;
  const hasVerifiedLiveData = queryHasLive || quakes.length > 0;

  return (
    <DashboardPanel
      title="Güvenlik & Asayiş"
      icon={<Shield size={14} />}
      badge={hasVerifiedLiveData ? "GÜNCEL" : "ÖLÇÜM BEKLENİYOR"}
      badgeVariant={hasVerifiedLiveData ? "live" : "warning"}
      count={publicOrderEvents.length > 0 ? publicOrderEvents.length : undefined}
    >
      <DataOriginBadge origin={hasVerifiedLiveData ? "live" : "pending"} className="mb-2" />
      {isLoading && !hasVerifiedLiveData && (
        <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard
          label="Son Deprem"
          value={latestQuake ? `M${latestQuake.magnitude.toFixed(1)}` : "—"}
          variant={latestQuake && latestQuake.magnitude >= 4 ? "destructive" : "primary"}
        />
        <StatCard
          label="Aktif Olay / Asayiş"
          value={publicOrderCount !== null ? String(publicOrderCount) : "—"}
          variant="warning"
        />
      </div>
      {quakes.length > 0 && (
        <div className="space-y-1 mb-2">
          {quakes.slice(0, 3).map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-muted/20 text-[10px] font-mono">
              <span className="font-bold text-primary shrink-0">M{q.magnitude.toFixed(1)}</span>
              <span className="truncate flex-1 text-foreground/85">
                {formatQuakeLocation(q.location, isEn ? "en" : "tr")}
              </span>
              {q.occurredAt && (
                <span className="text-[9px] text-muted-foreground/80 shrink-0">
                  {formatRelativeTime(q.occurredAt, lang)}
                </span>
              )}
              {q.depthKm !== null && (
                <span className="text-[9px] text-muted-foreground shrink-0">{q.depthKm} km</span>
              )}
            </div>
          ))}
        </div>
      )}
      {publicOrderEvents.length > 0 && (
        <div className="space-y-1 mb-2" data-testid="security-incident-stream">
          {publicOrderEvents.slice(0, 5).map((ev) => {
            const catBadge = getSecurityCategoryLabel(ev.category, isEn);
            return (
              <a
                key={ev.id}
                href={ev.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-muted/20 hover:bg-muted/40 transition-colors text-[10px] font-mono"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${catBadge.className}`}
                  >
                    {catBadge.label}
                  </span>
                  <span className="truncate text-foreground/90">
                    <b className="text-primary">{ev.district}:</b> {translate(ev.title)}
                  </span>
                </div>
                <span className="text-[8px] text-muted-foreground shrink-0">
                  {ev.sourceName}
                  {ev.publishedAt ? ` · ${formatShortTurkishDate(ev.publishedAt)}` : ""}
                </span>
              </a>
            );
          })}
        </div>
      )}
      <p className="text-[8px] font-mono text-muted-foreground/75 mt-2" data-testid="security-source-note">
        {translate(latestSourceSummary)}
      </p>
    </DashboardPanel>
  );
};

export const RadarTrafficMapPanel = () => {
  return (
    <DashboardPanel title="Radar & Trafik Denetim Haritası" icon={<MapPin size={14} />} badge="REFERANS · HARİTA" badgeVariant="info">
      <DataOriginBadge origin="reference" className="mb-2" />
      <TrafficMap />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <StatCard label="Aktif Radar" value={`${radarPoints.filter((p) => p.type === "radar").length}`} variant="destructive" />
        <StatCard label="Denetim Noktası" value={`${radarPoints.filter((p) => p.type === "denetim").length}`} variant="warning" />
      </div>
    </DashboardPanel>
  );
};

export const EmergencyPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const hub = useOptionalUnifiedIntelligence();
  const {
    fireEvents,
    trafficAccidentEvents,
    fireRiskLevel,
    quakeRiskLevel,
    activeAlertCount,
    hasVerifiedLiveData,
    latestSourceSummary,
  } = useSecurityIntelligence();

  const floodAlerts = (hub?.arbitratedEvents ?? [])
    .map((e) => e.floodSecurityAlert)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const latestFlood = floodAlerts[0] ?? null;
  const latestFire = fireEvents[0] ?? null;
  const totalActiveAlerts = floodAlerts.length + activeAlertCount;

  const panelBadge = latestFlood
    ? "SEL UYARISI"
    : fireRiskLevel === "YÜKSEK"
    ? "YANGIN UYARISI"
    : totalActiveAlerts > 0
    ? "AKTİF OLAY"
    : "NORMAL";
  const panelVariant =
    latestFlood?.riskLevel === "YÜKSEK" || fireRiskLevel === "YÜKSEK"
      ? "alert"
      : latestFlood || totalActiveAlerts > 0
      ? "warning"
      : "active";

  return (
    <DashboardPanel
      title="Acil Durum & Kriz"
      badge={panelBadge}
      badgeVariant={panelVariant}
    >
      <DataOriginBadge origin={hasVerifiedLiveData || Boolean(latestFlood) ? "live" : "pending"} className="mb-2" />
      <StatusList
        items={[
          {
            label: "Deprem Riski",
            value: quakeRiskLevel,
            status:
              quakeRiskLevel === "YÜKSEK"
                ? "critical"
                : quakeRiskLevel === "ORTA"
                ? "warning"
                : "ok",
          },
          {
            label: "Sel Riski",
            value: latestFlood ? latestFlood.riskLevel : "DÜŞÜK",
            status: latestFlood
              ? latestFlood.riskLevel === "YÜKSEK"
                ? "critical"
                : "warning"
              : "ok",
          },
          {
            label: "Yangın Riski",
            value: fireRiskLevel,
            status:
              fireRiskLevel === "YÜKSEK"
                ? "critical"
                : fireRiskLevel === "ORTA"
                ? "warning"
                : "ok",
          },
          {
            label: "Trafik Kazası",
            value:
              trafficAccidentEvents.length > 0
                ? `${trafficAccidentEvents.length} ${isEn ? "reports" : "kayıt"}`
                : "—",
            status: trafficAccidentEvents.length > 0 ? "warning" : "info",
          },
          {
            label: "Aktif Uyarı",
            value:
              totalActiveAlerts > 0
                ? `${totalActiveAlerts} ${isEn ? "Alerts" : "Bildirim"}`
                : "YOK",
            status: totalActiveAlerts > 0 ? "warning" : "ok",
          },
        ]}
      />
      {latestFlood && (
        <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[9px] font-mono text-rose-200">
          🌊 <b>{latestFlood.districtName}:</b> {translate(latestFlood.detail)}
        </div>
      )}
      {latestFire && (
        <a
          href={latestFire.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block rounded border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 transition-colors px-2 py-1.5 text-[9px] font-mono text-rose-200"
        >
          🔥 <b>{latestFire.district}:</b> {translate(latestFire.title)}
          <span className="block text-[8px] text-rose-200/75 mt-0.5">
            {latestFire.sourceName}
            {latestFire.publishedAt ? ` · ${formatShortTurkishDate(latestFire.publishedAt)}` : ""}
          </span>
        </a>
      )}
      <p className="text-[8px] font-mono text-muted-foreground/75 mt-2" data-testid="emergency-source-note">
        {translate(latestSourceSummary)}
      </p>
    </DashboardPanel>
  );
};

export const LocalGovQuickPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const {
    municipalBudgets,
    combinedTotalBillionTry,
    budgetYear,
    budgetYoyChangePct,
    budgetSourceSummary,
    hasVerifiedBudgetUpdate,
    budgetItems,
    isLoading,
  } = useEconomyIntelligence();

  const mbbBudget =
    municipalBudgets.find(
      (b) => canonicalizeBudgetInstitution(b.institution) === "Büyükşehir Belediyesi"
    ) ?? null;
  const muskiBudget =
    municipalBudgets.find((b) => canonicalizeBudgetInstitution(b.institution) === "MUSKİ") ?? null;

  const primaryBudgetBn =
    combinedTotalBillionTry ?? mbbBudget?.amountBillionTry ?? municipalBudgets[0]?.amountBillionTry ?? null;
  const secondaryLabel = muskiBudget ? "MUSKİ Bütçesi" : "Yatırım";
  const secondaryValueBn =
    muskiBudget?.amountBillionTry ?? mbbBudget?.investmentBillionTry ?? null;

  const statusRows = hasVerifiedBudgetUpdate
    ? municipalBudgets.slice(0, 5).map((b) => ({
        label: translate(b.institution),
        value: `${b.amountBillionTry.toFixed(1)} ${isEn ? "B ₺" : "Milyar ₺"}`,
        status: "ok" as const,
      }))
    : budgetItems.slice(0, 4).map((it) => ({
        label: translate(it.institution),
        value: it.amountLabel ? translate(it.amountLabel) : isEn ? "Notice" : "Duyuru",
        status: "info" as const,
      }));

  return (
    <DashboardPanel
      title="Yerel Yönetim Bütçeleri"
      icon={<Landmark size={14} />}
      badge={hasVerifiedBudgetUpdate ? `${budgetYear ?? 2026} GÜNCEL` : "ÖLÇÜM BEKLENİYOR"}
      badgeVariant={hasVerifiedBudgetUpdate ? "live" : "warning"}
    >
      <DataOriginBadge origin={hasVerifiedBudgetUpdate ? "live" : "pending"} className="mb-2" />
      {isLoading && !hasVerifiedBudgetUpdate && (
        <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />
      )}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard
          label={combinedTotalBillionTry !== null ? "Toplam Bütçe" : "Belediye Bütçesi"}
          value={primaryBudgetBn !== null ? primaryBudgetBn.toFixed(1) : "—"}
          unit={primaryBudgetBn !== null ? (isEn ? "B ₺" : "Milyar ₺") : undefined}
          change={hasVerifiedBudgetUpdate && budgetYoyChangePct !== null ? budgetYoyChangePct : undefined}
          variant="primary"
        />
        <StatCard
          label={secondaryLabel}
          value={secondaryValueBn !== null ? secondaryValueBn.toFixed(1) : "—"}
          unit={secondaryValueBn !== null ? (isEn ? "B ₺" : "Milyar ₺") : undefined}
          variant="accent"
        />
      </div>
      {statusRows.length > 0 && <StatusList items={statusRows} />}
      <p
        className="text-[8px] font-mono text-muted-foreground/75 mt-2"
        data-testid="localgov-quick-source-note"
      >
        {translate(budgetSourceSummary)}
      </p>
    </DashboardPanel>
  );
};

export const SecuritySection = () => {
  const { lang, t, translate } = useTranslation();
  const dateLocale = lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";
  const [keywords, setKeywords] = useState<string[]>(() => {
    const saved = localStorage.getItem("social-intel-keywords");
    return saved ? JSON.parse(saved) : ["Muğla", "Bodrum", "Fethiye", "Marmaris"];
  });

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
  const { data: liveRoadWorks, isLoading: rwLoading } = useLiveData<any[]>("road_works", {
    refetchInterval: 15 * 60 * 1000,
  });

  const newsItems =
    liveNews && liveNews.length > 0
      ? liveNews.map((n: any) => ({
          time: new Date().toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false }),
          text: n.title || n.description || "",
          type: "info" as const,
          reads: "",
          shares: 0,
          trend: 0,
          source: n.source || "",
          url: n.url || "",
        }))
      : defaultNews;

  const roadWorkItems =
    liveRoadWorks && liveRoadWorks.length > 0
      ? liveRoadWorks.map((rw: any) => ({
          road: rw.title || "",
          status: "BİLGİ",
          detail: rw.description || "",
          type: "partial" as const,
        }))
      : defaultRoadWorks;

  return (
    <div className="space-y-3">
      <SecurityOverviewPanel />
      <RadarTrafficMapPanel />

      <DashboardPanel
        title="Yol Çalışmaları & Kapanmalar"
        icon={<AlertTriangle size={14} />}
        badge={liveRoadWorks?.length ? "CANLI" : "REFERANS · 2024"}
        badgeVariant={liveRoadWorks?.length ? "live" : "info"}
      >
        {!liveRoadWorks?.length && <DataOriginBadge origin="reference" className="mb-2" />}
        {rwLoading && <Loader2 size={12} className="animate-spin text-muted-foreground mb-2" />}
        <div className="space-y-2">
          {roadWorkItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
              <span
                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  item.type === "closed" ? "bg-destructive" : item.type === "partial" ? "bg-warning" : "bg-success"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground/90 truncate">{translate(item.road)}</span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      item.type === "closed"
                        ? "bg-destructive/20 text-destructive"
                        : item.type === "partial"
                        ? "bg-warning/20 text-warning"
                        : "bg-success/20 text-success"
                    }`}
                  >
                    {t(item.status)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{translate(item.detail)}</span>
              </div>
            </div>
          ))}
        </div>
      </DashboardPanel>

      <EmergencyPanel />
      <LocalGovQuickPanel />

      <DashboardPanel title="Haber Akışı" icon={<Newspaper size={14} />} badge="CANLI" badgeVariant="live">
        {newsLoading && <Loader2 size={12} className="animate-spin text-muted-foreground mb-2" />}
        <div className="space-y-2">
          {newsItems.map((news, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">{news.time}</span>
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${news.type === "ok" ? "bg-success" : "bg-accent"}`} />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground/80 block">{translate(news.text)}</span>
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
