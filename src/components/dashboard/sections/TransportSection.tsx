import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Car, PlaneTakeoff, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLiveData } from "@/hooks/useLiveData";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useTransportTopicGrounding,
  formatShortTurkishDate,
} from "@/services/topicGroundingService";

type RoadWorksProject = {
  name: string;
  type?: string;
  status: "devam" | "tamamlandı" | "belirsiz";
  progress: number | null;
  confidence: "high" | "medium" | "low";
  expectedEnd: string;
  latest_news?: { title: string; pubDate: string; link: string }[];
  discovered?: boolean;
  started_at?: string | null;
};

const confidenceLabel = { high: "YÜKSEK", medium: "ORTA", low: "DÜŞÜK" } as const;

const typeLabel: Record<string, string> = {
  yol: "YOL",
  kavşak: "KAVŞAK",
  tünel: "TÜNEL",
  marina: "MARİNA",
  köprü: "KÖPRÜ",
  "bisiklet yolu": "BİSİKLET",
  "akıllı kavşak": "AKILLI KAVŞAK",
  "isale hattı": "İSALE HATTI",
  trafik: "TRAFİK",
};

type TrafficVerificationAlert = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  source: string | null;
  created_at: string;
  metadata: {
    verified?: boolean;
    district?: string;
    verified_sources?: { source?: string; text?: string; url?: string | null; published_at?: string }[];
  } | null;
};

export const TrafficSummaryPanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: trafficData, isLoading: tLoading } = useLiveData<any>("traffic_density", { refetchInterval: 10 * 60 * 1000 });
  const { data: roadWorks, isLoading: rLoading } = useLiveData<any>("road_works", { refetchInterval: 15 * 60 * 1000 });
  const { incidents: topicIncidents, refresh: refreshTopicGrounding } = useTransportTopicGrounding();
  const [trafficAlerts, setTrafficAlerts] = useState<TrafficVerificationAlert[]>([]);
  const [groundingRefreshing, setGroundingRefreshing] = useState(false);

  const refreshGrounding = async () => {
    setGroundingRefreshing(true);
    try {
      await refreshTopicGrounding();
    } catch {
      // Keep existing cached and source-backed road information visible.
    } finally {
      setGroundingRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadTrafficAlerts = async () => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("alert_events")
          .select("id, title, body, severity, source, created_at, metadata")
          .eq("type", "traffic")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!active) return;
        setTrafficAlerts(
          ((data ?? []) as unknown as TrafficVerificationAlert[]).filter((alert) =>
            alert.source === "traffic-teyit" &&
            (alert.metadata?.verified === true || alert.body?.toLocaleLowerCase("tr-TR").includes("basın teyidi"))
          ),
        );
      } catch {
        // Keep transport usable when alerts are unavailable or the query client is mocked.
      }
    };
    void loadTrafficAlerts();
    const interval = setInterval(loadTrafficAlerts, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const hotspots = trafficData?.hotspots ?? trafficData?.zones ?? [];
  const avgDensity =
    Array.isArray(hotspots) && hotspots.length > 0
      ? Math.round(hotspots.reduce((a: number, z: any) => a + Number(z.density ?? 0), 0) / hotspots.length)
      : null;
  const worstZone =
    Array.isArray(hotspots) && hotspots.length > 0
      ? hotspots.reduce((a: any, z: any) => (Number(z.density ?? 0) > Number(a.density ?? 0) ? z : a), hotspots[0])
      : null;

  const projects: RoadWorksProject[] = (
    roadWorks && Array.isArray(roadWorks.projects) ? roadWorks.projects : []
  ) as RoadWorksProject[];

  const groundedRoadItems = topicIncidents.slice(0, 3).map((inc) => ({
    label: `${inc.district}: ${inc.title}`,
    value: inc.status === "tamamlandı" ? "TAMAMLANDI" : inc.status === "uyarı" ? "UYARI" : "DEVAM",
    status: (inc.status === "tamamlandı" ? "ok" : inc.status === "uyarı" ? "critical" : "warning") as
      | "ok"
      | "warning"
      | "critical"
      | "info",
  }));

  const projectRoadItems = projects.slice(0, Math.max(0, 5 - groundedRoadItems.length)).map((p) => ({
    label: p.name,
    value: p.status === "tamamlandı" ? "TAMAMLANDI" : p.status === "devam" ? "DEVAM" : "İZLENİYOR",
    status: (p.status === "tamamlandı" ? "ok" : p.status === "devam" ? "warning" : "info") as
      | "ok"
      | "warning"
      | "critical"
      | "info",
  }));

  const roadItems = [...groundedRoadItems, ...projectRoadItems];

  const hasLiveTraffic = Array.isArray(hotspots) && hotspots.length > 0;
  const trafficStatus = trafficData?.status === "partial" || trafficData?.stale
    ? "partial"
    : trafficData?.cache_hit ? "cached" : hasLiveTraffic ? "live" : "reference";
  const fetchedAt = typeof trafficData?.fetched_at === "string"
    ? trafficData.fetched_at
    : typeof trafficData?.updated_at === "string" ? trafficData.updated_at : null;
  const hasRoadWorks = projects.length > 0 || topicIncidents.length > 0;
  const latestTopic = topicIncidents[0];
  const latestTopicDate = latestTopic ? formatShortTurkishDate(latestTopic.publishedAt) : "";

  return (
    <DashboardPanel
      title="Ulaşım & Trafik Akışı"
      icon={<Car size={14} />}
      badge={trafficStatus === "partial" ? (isEn ? "PARTIAL DATA" : "KISMİ VERİ") : trafficStatus === "cached" ? (isEn ? "CACHED" : "ÖNBELLEK") : trafficStatus === "live" ? "CANLI" : (isEn ? "REFERENCE" : "REFERANS")}
      badgeVariant={trafficStatus === "live" ? "live" : trafficStatus === "partial" ? "warning" : "info"}
      count={(hasLiveTraffic ? 1 : 0) + trafficAlerts.length + projects.length + topicIncidents.length}
    >
      <button
        type="button"
        onClick={refreshGrounding}
        disabled={groundingRefreshing}
        className="mb-2 inline-flex items-center gap-1 rounded border border-border/40 px-2 py-1 text-[9px] font-mono text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw size={10} className={groundingRefreshing ? "animate-spin" : ""} />
        {groundingRefreshing
          ? (isEn ? "Refreshing verified sources..." : "Doğrulanmış kaynaklar yenileniyor...")
          : (isEn ? "Refresh verified sources" : "Doğrulanmış kaynakları yenile")}
      </button>
      {(tLoading || rLoading) && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <StatCard
          label="Ort. Trafik Yoğunluğu"
          value={avgDensity !== null ? String(avgDensity) : "—"}
          unit="%"
          variant="primary"
          info={
            hasLiveTraffic
              ? isEn
                ? "From live TomTom traffic flow (13-district average)"
                : "TomTom canlı akışından (13 ilçe ortalaması)"
              : isEn
              ? "No live traffic feed available yet"
              : "Canlı veri yok; panoya bağlanamadı"
          }
        />
        <StatCard
          label="İzlenen İlçe"
          value={hasLiveTraffic ? String(hotspots.length) : "—"}
          unit={isEn ? "districts" : "ilçe"}
          info={isEn ? "Monitored districts across Muğla (all 13 districts)" : "TomTom izleme noktası sayısı (Muğla'nın 13 ilçesi)"}
        />
        {worstZone && (
          <StatCard
            label="En Yoğun İlçe"
            value={String(worstZone.name ?? "—")}
            unit={
              worstZone.density != null
                ? isEn
                  ? `${Math.round(Number(worstZone.density))}%`
                  : `%${Math.round(Number(worstZone.density))}`
                : ""
            }
            variant={Number(worstZone.density ?? 0) >= 50 ? "warning" : "primary"}
            info={isEn ? "Most congested monitored district right now" : "Şu an en tıkalı izleme noktası"}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-2 text-[8px] font-mono text-muted-foreground">
        <span>
          {isEn ? "Traffic source" : "Trafik kaynağı"}: {String(trafficData?.source ?? (trafficStatus === "reference" ? (isEn ? "District reference data" : "İlçe referans verisi") : "TomTom Traffic Flow"))}
        </span>
        <span>
          {fetchedAt && !Number.isNaN(new Date(fetchedAt).getTime())
            ? `${isEn ? "Fetched" : "Alındı"}: ${new Date(fetchedAt).toLocaleString(isEn ? "en-US" : "tr-TR")}`
            : (isEn ? "Fetch time unavailable" : "Alınma zamanı bilinmiyor")}
        </span>
      </div>

      {trafficAlerts.length > 0 && (
        <div className="mb-3 space-y-1">
          <span className="text-[9px] font-mono text-muted-foreground uppercase block">
            {isEn ? "Verified traffic alerts (last 24h)" : "Teyitli trafik uyarıları (son 24 saat)"}
          </span>
          {trafficAlerts.slice(0, 4).map((alert) => (
            <div key={alert.id} className="rounded border border-warning/30 bg-warning/5 px-2 py-1.5">
              <div className="text-[10px] font-mono font-semibold text-foreground">
                {alert.metadata?.district ? `${alert.metadata.district}: ` : ""}{alert.title}
              </div>
              <p className="text-[9px] text-muted-foreground">{alert.body}</p>
              {alert.metadata?.verified_sources?.slice(0, 2).map((source, index) => (
                <a
                  key={`${alert.id}-${index}`}
                  href={source.url || undefined}
                  target={source.url ? "_blank" : undefined}
                  rel={source.url ? "noreferrer" : undefined}
                  className="block text-[8px] text-primary hover:underline truncate"
                  title={source.text}
                >
                  {source.source ?? (isEn ? "Source" : "Kaynak")}
                  {source.published_at && !Number.isNaN(new Date(source.published_at).getTime())
                    ? ` · ${new Date(source.published_at).toLocaleString(isEn ? "en-US" : "tr-TR")}`
                    : ""}
                  {source.text ? ` — ${source.text}` : ""}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}

      {roadItems.length > 0 ? (
        <>
          <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">
            {t("Altyapı / Yol Durumu (basın takibi)")}
          </span>
          <StatusList items={roadItems} />
          <p className="tech-meta-only text-[8px] font-mono text-muted-foreground/75 mt-1">
            {latestTopic
              ? isEn
                ? `Source: ${latestTopic.sourceName}${latestTopicDate ? ` • ${translate(latestTopicDate)}` : ""} · Road, water main & traffic tracking`
                : `Kaynak: ${latestTopic.sourceName}${latestTopicDate ? ` • ${latestTopicDate}` : ""} · Yol, isale hattı ve trafik taraması`
              : isEn
                ? "Statuses are updated from verified local press and project monitoring."
                : "Durumlar doğrulanmış yerel basın ve proje takibinden güncellenir."}
          </p>
        </>
      ) : (
        <p className="text-[9px] font-mono text-muted-foreground/80 py-1">
          {isEn
            ? "Awaiting live road/infrastructure updates — they will appear here once refreshed."
            : "Canlı yol/altyapı duyurusu bekleniyor — haber akışı tazelenince burada görünür."}
        </p>
      )}
    </DashboardPanel>
  );
};

export const AirportsSummaryPanel = () => {
  const { lang } = useTranslation();
  const isEn = lang === "en";
  const [flightStats, setFlightStats] = useState<{
    dlm: number;
    bjv: number;
    isLive: boolean;
  }>({ dlm: 118, bjv: 104, isLive: false });
  const [flightLoading, setFlightLoading] = useState(false);

  const fetchFlights = async () => {
    try {
      setFlightLoading(true);
      if (typeof fetch === "function") {
        try {
          const resp = await fetch("/api/flights");
          if (resp.ok) {
            const json = await resp.json();
            if (json?.airports?.DLM || json?.airports?.BJV) {
              const isLive = json.source === "adsb";
              setFlightStats({
                dlm: isLive
                  ? Number(json.airports.DLM?.active_count ?? 0)
                  : Number(json.airports.DLM?.daily_reference_flights ?? 118),
                bjv: isLive
                  ? Number(json.airports.BJV?.active_count ?? 0)
                  : Number(json.airports.BJV?.daily_reference_flights ?? 104),
                isLive,
              });
              return;
            }
          }
        } catch {
          // fallback below
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      let payload: any = null;
      if (session?.access_token) {
        const { data, error } = await supabase.functions.invoke("transport-scrape", {
          body: { type: "flights", source: "adsb" },
        });
        if (!error && data?.airports?.length) payload = data;
      } else {
        const { data: cache } = await supabase
          .from("live_data_cache")
          .select("data")
          .eq("data_type", "flights")
          .maybeSingle();
        if ((cache?.data as any)?.airports?.length) payload = cache!.data;
      }
      if (payload?.airports?.length) {
        const dlm = payload.airports.find((a: any) => a.code === "DLM");
        const bjv = payload.airports.find((a: any) => a.code === "BJV");
        setFlightStats({
          dlm: dlm?.departures?.length ?? 0,
          bjv: bjv?.departures?.length ?? 0,
          isLive: true,
        });
        return;
      }
      setFlightStats({ dlm: 118, bjv: 104, isLive: false });
    } catch {
      setFlightStats({ dlm: 118, bjv: 104, isLive: false });
    } finally {
      setFlightLoading(false);
    }
  };

  useEffect(() => {
    fetchFlights();
    const interval = setInterval(fetchFlights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardPanel
      title="Havalimanları"
      icon={<PlaneTakeoff size={14} />}
      badge={flightStats.isLive ? "CANLI" : "REFERANS VERİ"}
      badgeVariant={flightStats.isLive ? "live" : "info"}
      count={2}
    >
      {flightLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatCard
          label="DLM Havalimanı"
          value={String(flightStats.dlm)}
          unit={
            flightStats.isLive
              ? isEn
                ? "aircraft (live)"
                : "uçak (şu an)"
              : isEn
              ? "flights/day (ref)"
              : "sefer/gün (ref)"
          }
          variant="accent"
          info={
            flightStats.isLive
              ? isEn
                ? "Live ADS-B: aircraft currently detected within 40 NM of DLM"
                : "Canlı ADS-B: DLM 40 NM yarıçapında tespit edilen uçaklar"
              : isEn
              ? "DHMİ daily average flight traffic reference for Dalaman Airport"
              : "DHMİ Dalaman Havalimanı günlük ortalama sefer referansı"
          }
        />
        <StatCard
          label="BJV Havalimanı"
          value={String(flightStats.bjv)}
          unit={
            flightStats.isLive
              ? isEn
                ? "aircraft (live)"
                : "uçak (şu an)"
              : isEn
              ? "flights/day (ref)"
              : "sefer/gün (ref)"
          }
          variant="accent"
          info={
            flightStats.isLive
              ? isEn
                ? "Live ADS-B: aircraft currently detected within 40 NM of BJV"
                : "Canlı ADS-B: BJV 40 NM yarıçapında tespit edilen uçaklar"
              : isEn
              ? "DHMİ daily average flight traffic reference for Milas-Bodrum Airport"
              : "DHMİ Milas-Bodrum Havalimanı günlük ortalama sefer referansı"
          }
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={fetchFlights}
          disabled={flightLoading}
          aria-label={isEn ? "Refresh flight data" : "Uçuş verisini yenile"}
          className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {flightLoading ? (isEn ? "Loading…" : "Yükleniyor…") : isEn ? "↻ Refresh flights" : "↻ Uçuşları yenile"}
        </button>
      </div>
    </DashboardPanel>
  );
};

export const InfrastructureProjectsPanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const dateLocale = isEn ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";
  const { data: roadWorks, isLoading: rLoading } = useLiveData<any>("road_works", { refetchInterval: 15 * 60 * 1000 });
  const { incidents: topicIncidents } = useTransportTopicGrounding();
  const hub = useOptionalUnifiedIntelligence();
  const baseProjects: RoadWorksProject[] = (
    roadWorks && Array.isArray(roadWorks.projects) ? roadWorks.projects : []
  ) as RoadWorksProject[];
  const groundedProjects: RoadWorksProject[] = topicIncidents.map((inc) => ({
    name: `${inc.district} — ${inc.title}`,
    type: inc.category === "isale_hatti" ? "isale hattı" : inc.category === "trafik" ? "trafik" : "yol",
    status: inc.status === "tamamlandı" ? "tamamlandı" : "devam",
    progress: null,
    confidence: inc.confidence,
    expectedEnd: "",
    discovered: true,
    latest_news: [
      {
        title: `${inc.sourceName} • ${formatShortTurkishDate(inc.publishedAt)} — ${inc.title}`,
        pubDate: inc.publishedAt,
        link: inc.sourceUrl,
      },
    ],
  }));
  const seenNames = new Set(baseProjects.map((p) => p.name.toLocaleLowerCase("tr-TR")));
  const projects: RoadWorksProject[] = [
    ...groundedProjects.filter((gp) => !seenNames.has(gp.name.toLocaleLowerCase("tr-TR"))),
    ...baseProjects,
  ];
  const citizenInfraReports = (hub?.arbitratedEvents ?? []).flatMap((ev) =>
    ev.issues
      .filter((iss) => ["altyapi_yol", "belediye_proje", "trafik_uyumsuzluk"].includes(iss.category))
      .map((iss) => ({
        id: `${ev.id}-${iss.id}`,
        districtName: ev.districtName,
        topic: iss.topic,
        locality: iss.locality,
        summary: iss.summary,
        dossierCode: ev.dossier.code,
      }))
  );

  const matchesCitizenReport = (projectName: string) => {
    const pLow = projectName.toLocaleLowerCase("tr-TR");
    return citizenInfraReports.filter(
      (r) =>
        pLow.includes(r.districtName.toLocaleLowerCase("tr-TR")) ||
        pLow.includes(r.locality.toLocaleLowerCase("tr-TR")) ||
        r.topic
          .toLocaleLowerCase("tr-TR")
          .split(" ")
          .some((w) => w.length > 4 && pLow.includes(w))
    );
  };

  return (
    <DashboardPanel
      title="Altyapı Projeleri"
      badge={
        citizenInfraReports.length > 0
          ? "HABER + SAHA İHBARI"
          : projects.length > 0
          ? "HABER TAKİBİ"
          : "BEKLEYEN"
      }
      badgeVariant={citizenInfraReports.length > 0 ? "warning" : projects.length > 0 ? "info" : "warning"}
      count={projects.length > 0 ? projects.length + citizenInfraReports.length : citizenInfraReports.length || undefined}
      collapsible
      defaultOpen={true}
    >
      {rLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      {citizenInfraReports.length > 0 && (
        <div className="mb-2.5 space-y-1.5">
          {citizenInfraReports.slice(0, 4).map((rep) => (
            <div key={rep.id} className="px-2.5 py-2 rounded border border-rose-500/40 bg-rose-500/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold text-foreground">
                  {rep.districtName} · {rep.locality} — {translate(rep.topic)}
                </span>
                <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40">
                  {isEn ? "🔴 Live Field Report" : "🔴 Sahadan Canlı Vatandaş İhbarı"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                {translate(rep.summary)} ({rep.dossierCode})
              </p>
            </div>
          ))}
        </div>
      )}
      {projects.length > 0 ? (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {projects.map((p, i) => {
            const newsCount = p.latest_news?.length ?? 0;
            const endRaw = p.expectedEnd ? new Date(p.expectedEnd) : null;
            const validEnd = endRaw && !isNaN(endRaw.getTime());
            const daysLeft = validEnd ? Math.ceil((endRaw.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
            const isDone = p.status === "tamamlandı";
            const typeKey = p.type ? typeLabel[p.type] ?? p.type.toUpperCase() : null;
            const matchedField = matchesCitizenReport(p.name);
            return (
              <div
                key={i}
                className={`px-2.5 py-2 rounded transition-colors ${
                  matchedField.length > 0
                    ? "bg-rose-500/10 border border-rose-500/40"
                    : "bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold text-foreground/90 leading-tight">
                    {translate(p.name)}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold ${
                      isDone ? "text-success" : p.status === "devam" ? "text-warning" : "text-muted-foreground"
                    }`}
                  >
                    {t(isDone ? "TAMAMLANDI" : p.status === "devam" ? "DEVAM EDİYOR" : "İZLENİYOR")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  {matchedField.length > 0 && (
                    <span className="text-[8px] font-mono font-bold px-1.5 py-px rounded bg-rose-500/20 text-rose-200 border border-rose-500/40">
                      {isEn
                        ? `🔴 Live Field Report (${matchedField[0].dossierCode})`
                        : `🔴 Sahadan Canlı Vatandaş İhbarı (${matchedField[0].dossierCode})`}
                    </span>
                  )}
                  {p.discovered && (
                    <span className="text-[8px] font-mono font-bold px-1 py-px rounded bg-success/15 text-success uppercase">
                      {t("YENİ")}
                    </span>
                  )}
                  {typeKey && (
                    <span className="text-[8px] font-mono font-bold px-1 py-px rounded bg-primary/10 text-primary/80 uppercase">
                      {t(typeKey)}
                    </span>
                  )}
                  <span className="tech-meta-only text-[9px] text-muted-foreground">
                    {isEn ? "Confidence" : "Güven"}:{" "}
                    <b className="text-foreground/70">{t(confidenceLabel[p.confidence] ?? "—")}</b>
                    {daysLeft !== null && (
                      <span className="ml-1.5">
                        {isEn ? "ETA" : "Bitiş"}:{" "}
                        <b className="text-foreground/70">
                          {daysLeft < 0 ? (isEn ? "TBD" : "belirsiz") : `${daysLeft} ${isEn ? "days" : "gün"}`}
                        </b>
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent ml-auto">
                    {newsCount} {isEn ? "news" : "haber"}
                  </span>
                </div>
                {p.latest_news && p.latest_news.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {p.latest_news.slice(0, 2).map((n, j) => (
                      <a
                        key={j}
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[9px] leading-snug text-muted-foreground hover:text-foreground hover:underline truncate"
                        title={n.title}
                      >
                        • {translate(n.title)}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className="tech-meta-only text-[8px] font-mono text-muted-foreground/70 mt-2 pt-2 border-t border-border/30">
            {translate(
              String(
                roadWorks?.note ??
                  "Durumlar Google News RSS'ten proje bazlı izlenir; ilerleme yüzdeleri yalnızca doğrulanmış tamamlanmalarda gösterilir."
              )
            )}
            {roadWorks?.updated_at && (
              <span className="block mt-0.5 text-muted-foreground/60">
                {isEn ? "Last updated" : "Son güncelleme"}:{" "}
                {new Date(roadWorks.updated_at).toLocaleString(dateLocale, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>
      ) : citizenInfraReports.length === 0 ? (
        <p className="text-[9px] font-mono text-muted-foreground/80 py-1">
          {t("Altyapı projeleri için haber akışı bekleniyor — basın verisi toplanınca burada görünür.")}
        </p>
      ) : null}
    </DashboardPanel>
  );
};

export const TransportSection = () => {
  return (
    <div className="space-y-3">
      <TrafficSummaryPanel />
      <AirportsSummaryPanel />
      <InfrastructureProjectsPanel />
    </div>
  );
};
