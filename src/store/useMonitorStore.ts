import { create } from "zustand";
import type {
  MergedDamRecord,
  EconomyIntelligenceSnapshot,
  TourismIntelligenceSnapshot,
  SecurityIntelligenceSnapshot,
  EnergyIntelligenceSnapshot,
  TransportTopicIncident,
  ProtocolTopicActivity,
} from "@/services/topicGroundingService";
import type { ProtocolMember } from "@/data/protocol-data";

export interface MonitorDamSlice {
  records: MergedDamRecord[];
  avgOccupancy: number | null;
  verifiedCount: number;
  hasVerifiedLiveData: boolean;
  latestSourceSummary: string;
  latestMeasuredAt: string | null;
  updatedAt: string | null;
}

export interface MonitorQuakeItem {
  id: string;
  magnitude: number;
  location: string;
  depthKm: number | null;
  occurredAt: string;
  lat?: number;
  lng?: number;
  url?: string;
  sourceName?: string;
}

export interface MonitorEarthquakesSlice {
  items: MonitorQuakeItem[];
  latest: MonitorQuakeItem | null;
  lastFetchedAt: string | null;
}

export interface MonitorSocialItem {
  id: string;
  platform: string;
  content: string;
  sentiment: string;
  districtSlug?: string;
  districtName?: string;
  author?: string;
  url?: string;
  publishedAt: string;
}

export interface MonitorSocialFeedSlice {
  items: MonitorSocialItem[];
  totalMentions: number;
  positiveRatio: number;
  negativeRatio: number;
  lastUpdatedAt: string | null;
}

export interface LiveDiagramEvent {
  id: string;
  tab:
    | "ekonomi"
    | "cevre"
    | "turizm"
    | "ulasim"
    | "sosyal"
    | "guvenlik"
    | "enerji"
    | "protokol"
    | "ilce";
  district: string;
  title: string;
  summary?: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: string;
}

export interface ProtocolRoleOverride {
  titleMatch: string;
  newName: string;
  sourceName: string;
  sourceUrl?: string;
  updatedAt: string;
}

export interface DistrictLiveOverride {
  signals: Array<{
    id: string;
    content: string;
    platform: string;
    sentiment: string;
    author?: string;
    url?: string;
    publishedAt: string;
  }>;
  updatedAt: string;
}

export interface MonitorLiveOverrides {
  economy: (EconomyIntelligenceSnapshot & { updatedAt: string | null }) | null;
  tourism: (TourismIntelligenceSnapshot & { updatedAt: string | null }) | null;
  security: (SecurityIntelligenceSnapshot & { updatedAt: string | null }) | null;
  energy: (EnergyIntelligenceSnapshot & { updatedAt: string | null }) | null;
  transport: {
    incidents: TransportTopicIncident[];
    updatedAt: string | null;
  };
  protocol: {
    activities: ProtocolTopicActivity[];
    roleOverrides: Record<string, ProtocolRoleOverride>;
    updatedAt: string | null;
  };
  districts: Record<string, DistrictLiveOverride>;
  diagramEvents: LiveDiagramEvent[];
}

export interface MonitorTabRecord {
  id: string;
  tabKey: string;
  title: string;
  metrics: Record<string, unknown>;
  summary?: string | null;
  source?: string | null;
  updatedAt: string;
}

export interface MonitorDistrictRecord {
  id: string;
  name: string;
  lat: number;
  lon: number;
  population: number | null;
}

export interface MonitorProtocolMemberRecord {
  id: string;
  isim: string;
  unvan: string;
  kategori: string;
  telefon: string;
  faks: string;
  district: string | null;
  updatedAt: string;
}

export interface MonitorAiSummaryRecord {
  type: string;
  date: string;
  summary: string;
  generatedAt: string;
}

export interface MonitorStoreState {
  activeDistrict: string | null;
  dams: MonitorDamSlice;
  earthquakes: MonitorEarthquakesSlice;
  socialFeed: MonitorSocialFeedSlice;
  liveOverrides: MonitorLiveOverrides;
  monitorTabs: Record<string, MonitorTabRecord>;
  districtsRegistry: MonitorDistrictRecord[];
  protocolMembers: MonitorProtocolMemberRecord[];
  aiSummaries: Record<string, MonitorAiSummaryRecord>;
  lastSyncedAt: string | null;

  setActiveDistrict: (slug: string | null) => void;
  setDamsSnapshot: (snapshot: Partial<MonitorDamSlice>) => void;
  setEarthquakes: (items: MonitorQuakeItem[], fetchedAt?: string | null) => void;
  setSocialFeed: (patch: Partial<MonitorSocialFeedSlice>) => void;
  prependSocialPost: (post: MonitorSocialItem) => void;

  // Central live override setters (verified live data always overrides fallback/defaults)
  setEconomyOverride: (snapshot: EconomyIntelligenceSnapshot, updatedAt?: string | null) => void;
  setTourismOverride: (snapshot: TourismIntelligenceSnapshot, updatedAt?: string | null) => void;
  setSecurityOverride: (snapshot: SecurityIntelligenceSnapshot, updatedAt?: string | null) => void;
  setEnergyOverride: (snapshot: EnergyIntelligenceSnapshot, updatedAt?: string | null) => void;
  setTransportOverride: (incidents: TransportTopicIncident[], updatedAt?: string | null) => void;
  setProtocolActivitiesOverride: (
    activities: ProtocolTopicActivity[],
    updatedAt?: string | null
  ) => void;
  upsertProtocolRoleOverride: (override: ProtocolRoleOverride) => void;
  upsertDistrictSignals: (
    districtSlug: string,
    signals: DistrictLiveOverride["signals"],
    updatedAt?: string | null
  ) => void;
  recordDiagramEvents: (events: LiveDiagramEvent[]) => void;

  // Direct Supabase table slices (monitor_data, districts, protocol_members, ai_summaries)
  upsertMonitorTab: (record: MonitorTabRecord) => void;
  setMonitorTabs: (records: MonitorTabRecord[]) => void;
  setDistrictsRegistry: (records: MonitorDistrictRecord[]) => void;
  setProtocolMembers: (records: MonitorProtocolMemberRecord[]) => void;
  upsertAiSummary: (record: MonitorAiSummaryRecord) => void;

  touchLastSynced: (iso?: string) => void;
  resetStore: () => void;
}

const INITIAL_DAMS: MonitorDamSlice = {
  records: [],
  avgOccupancy: null,
  verifiedCount: 0,
  hasVerifiedLiveData: false,
  latestSourceSummary: "Canlı resmi ölçüm yok · Yerel basın/DSİ teyidi bekleniyor",
  latestMeasuredAt: null,
  updatedAt: null,
};

const INITIAL_EARTHQUAKES: MonitorEarthquakesSlice = {
  items: [],
  latest: null,
  lastFetchedAt: null,
};

const INITIAL_SOCIAL_FEED: MonitorSocialFeedSlice = {
  items: [],
  totalMentions: 0,
  positiveRatio: 0,
  negativeRatio: 0,
  lastUpdatedAt: null,
};

const INITIAL_LIVE_OVERRIDES: MonitorLiveOverrides = {
  economy: null,
  tourism: null,
  security: null,
  energy: null,
  transport: {
    incidents: [],
    updatedAt: null,
  },
  protocol: {
    activities: [],
    roleOverrides: {},
    updatedAt: null,
  },
  districts: {},
  diagramEvents: [],
};

function normKey(raw: string): string {
  return raw
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü]+/g, " ")
    .trim();
}

function dedupeDiagramEvents(
  existing: LiveDiagramEvent[],
  incoming: LiveDiagramEvent[]
): LiveDiagramEvent[] {
  const map = new Map<string, LiveDiagramEvent>();
  for (const ev of [...incoming, ...existing]) {
    if (!ev.title?.trim()) continue;
    const key = `${ev.tab}::${normKey(ev.title).slice(0, 72)}`;
    const prev = map.get(key);
    if (!prev || new Date(ev.publishedAt).getTime() >= new Date(prev.publishedAt).getTime()) {
      map.set(key, ev);
    }
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 40);
}

function damsEqual(a: MonitorDamSlice, b: MonitorDamSlice): boolean {
  if (
    a.avgOccupancy !== b.avgOccupancy ||
    a.verifiedCount !== b.verifiedCount ||
    a.hasVerifiedLiveData !== b.hasVerifiedLiveData ||
    a.latestSourceSummary !== b.latestSourceSummary ||
    a.latestMeasuredAt !== b.latestMeasuredAt ||
    a.records.length !== b.records.length
  ) {
    return false;
  }
  for (let i = 0; i < a.records.length; i++) {
    if (
      a.records[i].id !== b.records[i].id ||
      a.records[i].occupancyRate !== b.records[i].occupancyRate ||
      a.records[i].measuredAt !== b.records[i].measuredAt
    ) {
      return false;
    }
  }
  return true;
}

function quakesEqual(a: MonitorQuakeItem[], b: MonitorQuakeItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].magnitude !== b[i].magnitude ||
      a[i].occurredAt !== b[i].occurredAt
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Merges static PROTOCOL_DATA with any live verified appointment/decree overrides
 * (e.g. a new Vali, Kaymakam, or Belediye Başkanı decree) so live data always wins.
 */
export function resolveProtocolMembers(
  baseMembers: ProtocolMember[],
  roleOverrides: Record<string, ProtocolRoleOverride>
): ProtocolMember[] {
  const overrideList = Object.values(roleOverrides);
  if (overrideList.length === 0) return baseMembers;

  return baseMembers.map((member) => {
    const memberTitleNorm = normKey(member.unvan);
    for (const ov of overrideList) {
      const targetNorm = normKey(ov.titleMatch);
      if (!targetNorm || !ov.newName.trim()) continue;
      const isValiMatch =
        (targetNorm === "vali" || targetNorm === "muğla valisi") &&
        (memberTitleNorm === "vali" || memberTitleNorm === "muğla valisi");
      const isExactOrContained =
        memberTitleNorm === targetNorm ||
        (targetNorm.length >= 8 && memberTitleNorm.includes(targetNorm));
      if (isValiMatch || isExactOrContained) {
        return {
          ...member,
          isim: ov.newName.trim(),
        };
      }
    }
    return member;
  });
}

export const useMonitorStore = create<MonitorStoreState>((set) => ({
  activeDistrict: null,
  dams: INITIAL_DAMS,
  earthquakes: INITIAL_EARTHQUAKES,
  socialFeed: INITIAL_SOCIAL_FEED,
  liveOverrides: INITIAL_LIVE_OVERRIDES,
  monitorTabs: {},
  districtsRegistry: [],
  protocolMembers: [],
  aiSummaries: {},
  lastSyncedAt: null,

  setActiveDistrict: (slug) =>
    set((state) => {
      const normalized = slug && slug.trim() ? slug.trim().toLowerCase() : null;
      if (state.activeDistrict === normalized) return state;
      return { activeDistrict: normalized };
    }),

  setDamsSnapshot: (snapshot) =>
    set((state) => {
      const next: MonitorDamSlice = {
        ...state.dams,
        ...snapshot,
        updatedAt: snapshot.updatedAt ?? snapshot.latestMeasuredAt ?? state.dams.updatedAt,
      };
      if (damsEqual(state.dams, next)) return state;
      return {
        dams: next,
        lastSyncedAt: next.latestMeasuredAt || new Date().toISOString(),
      };
    }),

  setEarthquakes: (items, fetchedAt) =>
    set((state) => {
      const sorted = [...items].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
      const nextFetchedAt = fetchedAt ?? new Date().toISOString();
      if (
        quakesEqual(state.earthquakes.items, sorted) &&
        state.earthquakes.lastFetchedAt === nextFetchedAt
      ) {
        return state;
      }
      return {
        earthquakes: {
          items: sorted,
          latest: sorted[0] ?? null,
          lastFetchedAt: nextFetchedAt,
        },
        lastSyncedAt: nextFetchedAt,
      };
    }),

  setSocialFeed: (patch) =>
    set((state) => {
      const next: MonitorSocialFeedSlice = {
        ...state.socialFeed,
        ...patch,
      };
      if (
        state.socialFeed.totalMentions === next.totalMentions &&
        state.socialFeed.positiveRatio === next.positiveRatio &&
        state.socialFeed.negativeRatio === next.negativeRatio &&
        state.socialFeed.lastUpdatedAt === next.lastUpdatedAt &&
        state.socialFeed.items === next.items
      ) {
        return state;
      }
      return {
        socialFeed: next,
        lastSyncedAt: next.lastUpdatedAt || new Date().toISOString(),
      };
    }),

  prependSocialPost: (post) =>
    set((state) => {
      if (state.socialFeed.items.some((existing) => existing.id === post.id)) {
        return state;
      }
      const nextItems = [post, ...state.socialFeed.items].slice(0, 60);
      const ts = post.publishedAt || new Date().toISOString();
      return {
        socialFeed: {
          ...state.socialFeed,
          items: nextItems,
          totalMentions: state.socialFeed.totalMentions + 1,
          lastUpdatedAt: ts,
        },
        lastSyncedAt: ts,
      };
    }),

  setEconomyOverride: (snapshot, updatedAt) =>
    set((state) => {
      // Conflict rule: never downgrade a verified live override with an empty fallback
      if (!snapshot.hasVerifiedLiveData && state.liveOverrides.economy?.hasVerifiedLiveData) {
        return state;
      }
      const ts = updatedAt ?? snapshot.latestMeasuredAt ?? new Date().toISOString();
      const prev = state.liveOverrides.economy;
      if (
        prev &&
        prev.combinedTotalBillionTry === snapshot.combinedTotalBillionTry &&
        prev.budgetYear === snapshot.budgetYear &&
        prev.municipalBudgets.length === snapshot.municipalBudgets.length &&
        prev.budgetItems.length === snapshot.budgetItems.length &&
        prev.latestSourceSummary === snapshot.latestSourceSummary
      ) {
        return state;
      }
      const events: LiveDiagramEvent[] = snapshot.municipalBudgets.slice(0, 3).map((b) => ({
        id: `eco-budget-${normKey(b.institution)}-${b.year ?? "cur"}`,
        tab: "ekonomi",
        district: "Muğla",
        title: `${b.institution}: ${b.amountBillionTry.toFixed(1)} Milyar ₺ (${b.year ?? ""})`.trim(),
        sourceName: b.sourceName,
        sourceUrl: b.sourceUrl,
        publishedAt: b.publishedAt || ts,
      }));
      return {
        liveOverrides: {
          ...state.liveOverrides,
          economy: { ...snapshot, updatedAt: ts },
          diagramEvents:
            events.length > 0
              ? dedupeDiagramEvents(state.liveOverrides.diagramEvents, events)
              : state.liveOverrides.diagramEvents,
        },
        lastSyncedAt: snapshot.hasVerifiedLiveData ? ts : state.lastSyncedAt,
      };
    }),

  setTourismOverride: (snapshot, updatedAt) =>
    set((state) => {
      if (!snapshot.hasVerifiedLiveData && state.liveOverrides.tourism?.hasVerifiedLiveData) {
        return state;
      }
      const ts = updatedAt ?? snapshot.latestMeasuredAt ?? new Date().toISOString();
      const prev = state.liveOverrides.tourism;
      if (
        prev &&
        prev.hotelOccupancyPct === snapshot.hotelOccupancyPct &&
        prev.annualTourists === snapshot.annualTourists &&
        prev.airportPassengers === snapshot.airportPassengers &&
        prev.headlines.length === snapshot.headlines.length &&
        prev.occupancySourceSummary === snapshot.occupancySourceSummary
      ) {
        return state;
      }
      const events: LiveDiagramEvent[] = snapshot.headlines.slice(0, 3).map((h, idx) => ({
        id: `tour-hl-${idx}-${normKey(h.title).slice(0, 32)}`,
        tab: "turizm",
        district: h.district || "Muğla",
        title: h.title,
        sourceName: h.sourceName,
        sourceUrl: h.sourceUrl,
        publishedAt: h.publishedAt || ts,
      }));
      return {
        liveOverrides: {
          ...state.liveOverrides,
          tourism: { ...snapshot, updatedAt: ts },
          diagramEvents:
            events.length > 0
              ? dedupeDiagramEvents(state.liveOverrides.diagramEvents, events)
              : state.liveOverrides.diagramEvents,
        },
        lastSyncedAt: snapshot.hasVerifiedLiveData ? ts : state.lastSyncedAt,
      };
    }),

  setSecurityOverride: (snapshot, updatedAt) =>
    set((state) => {
      if (!snapshot.hasVerifiedLiveData && state.liveOverrides.security?.hasVerifiedLiveData) {
        return state;
      }
      const ts = updatedAt ?? snapshot.latestMeasuredAt ?? new Date().toISOString();
      const prev = state.liveOverrides.security;
      if (
        prev &&
        prev.quakes.length === snapshot.quakes.length &&
        prev.publicOrderEvents.length === snapshot.publicOrderEvents.length &&
        prev.latestSourceSummary === snapshot.latestSourceSummary
      ) {
        return state;
      }
      const events: LiveDiagramEvent[] = snapshot.publicOrderEvents.slice(0, 4).map((ev) => ({
        id: `sec-${ev.id}`,
        tab: "guvenlik",
        district: ev.district || "Muğla",
        title: ev.title,
        sourceName: ev.sourceName,
        sourceUrl: ev.sourceUrl,
        publishedAt: ev.publishedAt || ts,
      }));
      return {
        liveOverrides: {
          ...state.liveOverrides,
          security: { ...snapshot, updatedAt: ts },
          diagramEvents:
            events.length > 0
              ? dedupeDiagramEvents(state.liveOverrides.diagramEvents, events)
              : state.liveOverrides.diagramEvents,
        },
        lastSyncedAt: snapshot.hasVerifiedLiveData ? ts : state.lastSyncedAt,
      };
    }),

  setEnergyOverride: (snapshot, updatedAt) =>
    set((state) => {
      if (!snapshot.hasVerifiedLiveData && state.liveOverrides.energy?.hasVerifiedLiveData) {
        return state;
      }
      const ts = updatedAt ?? snapshot.latestMeasuredAt ?? new Date().toISOString();
      const prev = state.liveOverrides.energy;
      if (
        prev &&
        prev.activeOutageCount === snapshot.activeOutageCount &&
        prev.dailyConsumptionGwh === snapshot.dailyConsumptionGwh &&
        prev.outages.length === snapshot.outages.length &&
        prev.latestSourceSummary === snapshot.latestSourceSummary
      ) {
        return state;
      }
      const events: LiveDiagramEvent[] = snapshot.outages.slice(0, 3).map((out) => ({
        id: `energy-${out.id}`,
        tab: "enerji",
        district: out.district || "Muğla",
        title: `${out.district}: ${out.summary}`,
        sourceName: out.sourceName,
        sourceUrl: out.sourceUrl,
        publishedAt: out.publishedAt || ts,
      }));
      return {
        liveOverrides: {
          ...state.liveOverrides,
          energy: { ...snapshot, updatedAt: ts },
          diagramEvents:
            events.length > 0
              ? dedupeDiagramEvents(state.liveOverrides.diagramEvents, events)
              : state.liveOverrides.diagramEvents,
        },
        lastSyncedAt: snapshot.hasVerifiedLiveData ? ts : state.lastSyncedAt,
      };
    }),

  setTransportOverride: (incidents, updatedAt) =>
    set((state) => {
      if (incidents.length === 0 && state.liveOverrides.transport.incidents.length > 0) {
        return state;
      }
      const ts = updatedAt ?? new Date().toISOString();
      const prevIds = state.liveOverrides.transport.incidents.map((i) => i.title).join("|");
      const nextIds = incidents.map((i) => i.title).join("|");
      if (prevIds === nextIds && state.liveOverrides.transport.updatedAt === ts) {
        return state;
      }
      const events: LiveDiagramEvent[] = incidents.slice(0, 3).map((inc) => ({
        id: `transport-${inc.id}`,
        tab: "ulasim",
        district: inc.district || "Muğla",
        title: inc.title,
        sourceName: inc.sourceName,
        sourceUrl: inc.sourceUrl,
        publishedAt: inc.publishedAt || ts,
      }));
      return {
        liveOverrides: {
          ...state.liveOverrides,
          transport: { incidents, updatedAt: ts },
          diagramEvents:
            events.length > 0
              ? dedupeDiagramEvents(state.liveOverrides.diagramEvents, events)
              : state.liveOverrides.diagramEvents,
        },
        lastSyncedAt: incidents.length > 0 ? ts : state.lastSyncedAt,
      };
    }),

  setProtocolActivitiesOverride: (activities, updatedAt) =>
    set((state) => {
      if (activities.length === 0 && state.liveOverrides.protocol.activities.length > 0) {
        return state;
      }
      const ts = updatedAt ?? activities[0]?.publishedAt ?? new Date().toISOString();
      const prevSig = state.liveOverrides.protocol.activities
        .map((a) => `${a.actorName}:${a.summary}`)
        .join("|");
      const nextSig = activities.map((a) => `${a.actorName}:${a.summary}`).join("|");
      if (prevSig === nextSig) return state;

      // Auto-apply any verified gorev_degisikligi decrees to roleOverrides
      const nextRoleOverrides = { ...state.liveOverrides.protocol.roleOverrides };
      for (const act of activities) {
        if (act.category === "gorev_degisikligi" && act.actorName && act.actorTitle) {
          const rKey = normKey(act.actorTitle);
          nextRoleOverrides[rKey] = {
            titleMatch: act.actorTitle,
            newName: act.actorName,
            sourceName: act.sourceName,
            sourceUrl: act.sourceUrl,
            updatedAt: act.publishedAt || ts,
          };
        }
      }

      const events: LiveDiagramEvent[] = activities.slice(0, 4).map((act) => ({
        id: `proto-${act.id}`,
        tab: "protokol",
        district: "Muğla",
        title: `${act.actorName || act.actorTitle}: ${act.summary}`,
        sourceName: act.sourceName,
        sourceUrl: act.sourceUrl,
        publishedAt: act.publishedAt || ts,
      }));

      return {
        liveOverrides: {
          ...state.liveOverrides,
          protocol: {
            activities,
            roleOverrides: nextRoleOverrides,
            updatedAt: ts,
          },
          diagramEvents:
            events.length > 0
              ? dedupeDiagramEvents(state.liveOverrides.diagramEvents, events)
              : state.liveOverrides.diagramEvents,
        },
        lastSyncedAt: activities.length > 0 ? ts : state.lastSyncedAt,
      };
    }),

  upsertProtocolRoleOverride: (override) =>
    set((state) => {
      const rKey = normKey(override.titleMatch);
      if (!rKey || !override.newName.trim()) return state;
      const prev = state.liveOverrides.protocol.roleOverrides[rKey];
      if (prev && prev.newName === override.newName && prev.updatedAt === override.updatedAt) {
        return state;
      }
      return {
        liveOverrides: {
          ...state.liveOverrides,
          protocol: {
            ...state.liveOverrides.protocol,
            roleOverrides: {
              ...state.liveOverrides.protocol.roleOverrides,
              [rKey]: override,
            },
            updatedAt: override.updatedAt,
          },
        },
        lastSyncedAt: override.updatedAt,
      };
    }),

  upsertDistrictSignals: (districtSlug, signals, updatedAt) =>
    set((state) => {
      const slug = districtSlug.trim().toLowerCase();
      if (!slug || signals.length === 0) return state;
      const existing = state.liveOverrides.districts[slug]?.signals ?? [];
      const seen = new Set<string>();
      const merged: DistrictLiveOverride["signals"] = [];
      for (const item of [...signals, ...existing]) {
        const key = normKey(item.content).slice(0, 72);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
      const ts = updatedAt ?? new Date().toISOString();
      const events: LiveDiagramEvent[] = signals.slice(0, 2).map((sig) => ({
        id: `dist-${slug}-${sig.id}`,
        tab: "ilce",
        district: slug,
        title: sig.content.slice(0, 120),
        sourceName: sig.author || sig.platform,
        sourceUrl: sig.url,
        publishedAt: sig.publishedAt || ts,
      }));
      return {
        liveOverrides: {
          ...state.liveOverrides,
          districts: {
            ...state.liveOverrides.districts,
            [slug]: {
              signals: merged.slice(0, 40),
              updatedAt: ts,
            },
          },
          diagramEvents: dedupeDiagramEvents(state.liveOverrides.diagramEvents, events),
        },
        lastSyncedAt: ts,
      };
    }),

  recordDiagramEvents: (events) =>
    set((state) => {
      if (!events.length) return state;
      return {
        liveOverrides: {
          ...state.liveOverrides,
          diagramEvents: dedupeDiagramEvents(state.liveOverrides.diagramEvents, events),
        },
      };
    }),

  upsertMonitorTab: (record) =>
    set((state) => {
      const key = (record.tabKey || record.id || "").trim().toLowerCase();
      if (!key) return state;
      const prev = state.monitorTabs[key];
      if (
        prev &&
        prev.updatedAt === record.updatedAt &&
        prev.summary === record.summary &&
        JSON.stringify(prev.metrics) === JSON.stringify(record.metrics)
      ) {
        return state;
      }
      return {
        monitorTabs: {
          ...state.monitorTabs,
          [key]: { ...record, tabKey: key },
        },
        lastSyncedAt: record.updatedAt || state.lastSyncedAt,
      };
    }),

  setMonitorTabs: (records) =>
    set((state) => {
      if (!Array.isArray(records) || records.length === 0) return state;
      const next = { ...state.monitorTabs };
      let latestIso = state.lastSyncedAt;
      for (const rec of records) {
        const key = (rec.tabKey || rec.id || "").trim().toLowerCase();
        if (!key) continue;
        next[key] = { ...rec, tabKey: key };
        if (rec.updatedAt && (!latestIso || rec.updatedAt > latestIso)) {
          latestIso = rec.updatedAt;
        }
      }
      return { monitorTabs: next, lastSyncedAt: latestIso };
    }),

  setDistrictsRegistry: (records) =>
    set((state) => {
      if (!Array.isArray(records) || records.length === 0) return state;
      return {
        districtsRegistry: records,
        lastSyncedAt: state.lastSyncedAt || new Date().toISOString(),
      };
    }),

  setProtocolMembers: (records) =>
    set((state) => {
      if (!Array.isArray(records) || records.length === 0) return state;
      // Sync live Vali / key roles into roleOverrides automatically
      const nextRoleOverrides = { ...state.liveOverrides.protocol.roleOverrides };
      for (const member of records) {
        if (!member.unvan || !member.isim) continue;
        const rKey = normKey(member.unvan);
        if (
          rKey === "muğla valisi" ||
          rKey === "vali" ||
          rKey.includes("kaymakamı") ||
          rKey.includes("belediye başkanı")
        ) {
          nextRoleOverrides[rKey] = {
            titleMatch: member.unvan,
            newName: member.isim,
            sourceName: "Supabase Protokol Kaydı",
            updatedAt: member.updatedAt || new Date().toISOString(),
          };
        }
      }
      return {
        protocolMembers: records,
        liveOverrides: {
          ...state.liveOverrides,
          protocol: {
            ...state.liveOverrides.protocol,
            roleOverrides: nextRoleOverrides,
            updatedAt: records[0]?.updatedAt || state.liveOverrides.protocol.updatedAt,
          },
        },
        lastSyncedAt: records[0]?.updatedAt || state.lastSyncedAt,
      };
    }),

  upsertAiSummary: (record) =>
    set((state) => {
      const key = (record.type || "").trim().toLowerCase();
      if (!key || !record.summary) return state;
      const prev = state.aiSummaries[key];
      if (prev && prev.generatedAt === record.generatedAt && prev.summary === record.summary) {
        return state;
      }
      return {
        aiSummaries: {
          ...state.aiSummaries,
          [key]: { ...record, type: key },
        },
        lastSyncedAt: record.generatedAt || state.lastSyncedAt,
      };
    }),

  touchLastSynced: (iso) =>
    set({
      lastSyncedAt: iso || new Date().toISOString(),
    }),

  resetStore: () =>
    set({
      activeDistrict: null,
      dams: INITIAL_DAMS,
      earthquakes: INITIAL_EARTHQUAKES,
      socialFeed: INITIAL_SOCIAL_FEED,
      liveOverrides: INITIAL_LIVE_OVERRIDES,
      monitorTabs: {},
      districtsRegistry: [],
      protocolMembers: [],
      aiSummaries: {},
      lastSyncedAt: null,
    }),
}));

// Named atomic selectors — components subscribe only to their own slice
export const selectActiveDistrict = (s: MonitorStoreState) => s.activeDistrict;
export const selectDams = (s: MonitorStoreState) => s.dams;
export const selectEarthquakes = (s: MonitorStoreState) => s.earthquakes;
export const selectSocialFeed = (s: MonitorStoreState) => s.socialFeed;
export const selectLiveOverrides = (s: MonitorStoreState) => s.liveOverrides;
export const selectEconomyOverride = (s: MonitorStoreState) => s.liveOverrides.economy;
export const selectTourismOverride = (s: MonitorStoreState) => s.liveOverrides.tourism;
export const selectSecurityOverride = (s: MonitorStoreState) => s.liveOverrides.security;
export const selectEnergyOverride = (s: MonitorStoreState) => s.liveOverrides.energy;
export const selectTransportOverride = (s: MonitorStoreState) => s.liveOverrides.transport;
export const selectProtocolOverride = (s: MonitorStoreState) => s.liveOverrides.protocol;
export const selectDistrictOverrides = (s: MonitorStoreState) => s.liveOverrides.districts;
export const selectDiagramEvents = (s: MonitorStoreState) => s.liveOverrides.diagramEvents;
export const selectMonitorTabs = (s: MonitorStoreState) => s.monitorTabs;
export const selectDistrictsRegistry = (s: MonitorStoreState) => s.districtsRegistry;
export const selectProtocolMembers = (s: MonitorStoreState) => s.protocolMembers;
export const selectAiSummaries = (s: MonitorStoreState) => s.aiSummaries;
export const selectLastSyncedAt = (s: MonitorStoreState) => s.lastSyncedAt;
