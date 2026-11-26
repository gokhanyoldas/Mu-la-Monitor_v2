import { create } from "zustand";
import type { MergedDamRecord } from "@/services/topicGroundingService";

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

export interface MonitorStoreState {
  activeDistrict: string | null;
  dams: MonitorDamSlice;
  earthquakes: MonitorEarthquakesSlice;
  socialFeed: MonitorSocialFeedSlice;
  lastSyncedAt: string | null;

  setActiveDistrict: (slug: string | null) => void;
  setDamsSnapshot: (snapshot: Partial<MonitorDamSlice>) => void;
  setEarthquakes: (items: MonitorQuakeItem[], fetchedAt?: string | null) => void;
  setSocialFeed: (patch: Partial<MonitorSocialFeedSlice>) => void;
  prependSocialPost: (post: MonitorSocialItem) => void;
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

export const useMonitorStore = create<MonitorStoreState>((set) => ({
  activeDistrict: null,
  dams: INITIAL_DAMS,
  earthquakes: INITIAL_EARTHQUAKES,
  socialFeed: INITIAL_SOCIAL_FEED,
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
      lastSyncedAt: null,
    }),
}));

// Named atomic selectors — components subscribe only to their own slice
export const selectActiveDistrict = (s: MonitorStoreState) => s.activeDistrict;
export const selectDams = (s: MonitorStoreState) => s.dams;
export const selectEarthquakes = (s: MonitorStoreState) => s.earthquakes;
export const selectSocialFeed = (s: MonitorStoreState) => s.socialFeed;
export const selectLastSyncedAt = (s: MonitorStoreState) => s.lastSyncedAt;
