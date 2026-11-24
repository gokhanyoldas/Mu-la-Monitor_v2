// Merkezi İstihbarat ve Çapraz Doğrulama Hub Context (UnifiedIntelligenceContext)
// Tüm sekmelerin (Genel Bakış, Sorgu Odası, Ekonomi, Çevre, Turizm, Ulaşım, Sosyal, Güvenlik, Enerji, Protokol, Ağ Grafiği, 13 İlçe) birbiriyle konuşmasını sağlar.

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import {
  loadLivingLexicon,
  appendToLivingLexicon,
  type LexiconEntry,
  type LexiconLayer,
} from "@/services/livingLexiconService";
import {
  analyzeAndArbitrateFieldSubmission,
  type ArbitratedFieldEvent,
  type GroundTruthTrafficPatch,
  type ProtocolAgendaLink,
} from "@/services/fieldArbitrationEngine";
import type {
  InvestigationDossier,
  InvestigationNode,
  InvestigationLink,
} from "@/data/investigationData";
import type { DistrictFeedItem } from "@/data/districtSocialBaselines";

const LEGACY_HUB_EVENTS_STORAGE_KEY = "mugla_unified_hub_events_v1";
const HUB_EVENTS_STORAGE_KEY = "mugla_unified_hub_events_v2";

function isVerifiedArbitratedEvent(evt: ArbitratedFieldEvent | null | undefined): evt is ArbitratedFieldEvent {
  if (!evt || typeof evt !== "object") return false;
  if (evt.verification?.verified !== true) return false;
  if (
    evt.verification.verificationMethod !== "official_or_grounding_url" &&
    evt.verification.verificationMethod !== "multi_source_corroborated"
  ) {
    return false;
  }
  return true;
}

export interface HubTabNotification {
  id: string;
  eventId: string;
  dossierCode: string;
  districtName: string;
  title: string;
  updatedTabs: string[];
  hasSensorDiscrepancy: boolean;
  timestamp: string;
  read: boolean;
}

interface UnifiedIntelligenceContextValue {
  lexicon: LexiconEntry[];
  lexiconCountByLayer: Record<LexiconLayer, number>;
  newlyLearnedCount: number;
  isLexiconDrawerOpen: boolean;
  setLexiconDrawerOpen: (open: boolean) => void;
  addLexiconTerm: (term: string, layer: LexiconLayer, district?: string) => void;

  arbitratedEvents: ArbitratedFieldEvent[];
  latestEvent: ArbitratedFieldEvent | null;
  isIngesting: boolean;

  ingestFieldSubmission: (params: {
    text: string;
    imageBase64?: string;
    imageMimeType?: string;
    imageName?: string;
    sourceUrl?: string;
    corroborationCount?: number;
    isVerifiedSource?: boolean;
    tomtomHotspots?: Array<{ name: string; lat: number; lng: number; density: number; speed?: number }>;
  }) => Promise<ArbitratedFieldEvent>;

  dynamicDossiers: InvestigationDossier[];
  dynamicInvestigationNodes: InvestigationNode[];
  dynamicInvestigationLinks: InvestigationLink[];
  activeDynamicDossierId: string | null;
  setActiveDynamicDossierId: (id: string | null) => void;

  groundTruthPatches: GroundTruthTrafficPatch[];
  protocolAgendaLinks: ProtocolAgendaLink[];
  ingestedDistrictPosts: DistrictFeedItem[];
  cityPulseInjections: string[];
  tabNotifications: HubTabNotification[];
  unreadTabNotificationsCount: number;
  markNotificationsRead: () => void;
  dismissHubNotification: (id: string) => void;

  getEnergyOutageBonus: () => number;
  getBudgetAlertsForMunicipality: (municipalityName: string) => ArbitratedFieldEvent["budgetAlert"][];
  getProtocolLinksForActor: (actorName: string, actorTitle?: string, districtName?: string) => ProtocolAgendaLink[];
}

const UnifiedIntelligenceContext = createContext<UnifiedIntelligenceContextValue | null>(null);

function loadStoredEvents(): ArbitratedFieldEvent[] {
  if (typeof window === "undefined") return [];
  try {
    // Legacy v1 cache contained unverified/preset field submissions — purge it cleanly
    if (window.localStorage.getItem(LEGACY_HUB_EVENTS_STORAGE_KEY) !== null) {
      window.localStorage.removeItem(LEGACY_HUB_EVENTS_STORAGE_KEY);
    }
    const raw = window.localStorage.getItem(HUB_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isVerifiedArbitratedEvent).slice(0, 15);
  } catch {
    return [];
  }
}

export const UnifiedIntelligenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lexicon, setLexicon] = useState<LexiconEntry[]>(() => loadLivingLexicon());
  const [isLexiconDrawerOpen, setLexiconDrawerOpen] = useState(false);
  const [arbitratedEvents, setArbitratedEvents] = useState<ArbitratedFieldEvent[]>(() => loadStoredEvents());
  const [isIngesting, setIsIngesting] = useState(false);
  const [activeDynamicDossierId, setActiveDynamicDossierId] = useState<string | null>(null);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set());
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  const persistEvents = useCallback((next: ArbitratedFieldEvent[]) => {
    if (typeof window === "undefined") return;
    try {
      // Only verified events may ever be persisted; strip oversized base64 images
      const sanitized = next
        .filter(isVerifiedArbitratedEvent)
        .slice(0, 12)
        .map((evt) => ({
          ...evt,
          imagePreview: evt.imagePreview && evt.imagePreview.length > 80_000 ? undefined : evt.imagePreview,
        }));
      window.localStorage.setItem(HUB_EVENTS_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore quota error
    }
  }, []);

  const addLexiconTerm = useCallback(
    (term: string, layer: LexiconLayer, district?: string) => {
      setLexicon((prev) => {
        const { nextEntries } = appendToLivingLexicon(prev, [
          { term, layer, district, source: "manual", isNewlyLearned: true },
        ]);
        return nextEntries;
      });
    },
    []
  );

  const ingestFieldSubmission = useCallback(
    async (params: {
      text: string;
      imageBase64?: string;
      imageMimeType?: string;
      imageName?: string;
      sourceUrl?: string;
      corroborationCount?: number;
      isVerifiedSource?: boolean;
      tomtomHotspots?: Array<{ name: string; lat: number; lng: number; density: number; speed?: number }>;
    }): Promise<ArbitratedFieldEvent> => {
      setIsIngesting(true);
      try {
        const event = await analyzeAndArbitrateFieldSubmission({
          ...params,
          lexiconTerms: lexicon.map((l) => l.term),
        });

        // Strict Verification Gate: unverified / single-source social reports never publish
        // into LivingLexicon, alerts, map patches, pulse injections, or localStorage.
        if (!isVerifiedArbitratedEvent(event)) {
          return event;
        }

        // Step 1: Append extracted terms to LivingLexicon (append-only, never deletes)
        if (event.extractedLexiconTerms.length > 0) {
          setLexicon((prev) => {
            const { nextEntries } = appendToLivingLexicon(
              prev,
              event.extractedLexiconTerms.map((t) => ({
                ...t,
                source: "ingested",
                isNewlyLearned: true,
              }))
            );
            return nextEntries;
          });
        }

        // Prepend verified event & persist
        setArbitratedEvents((prev) => {
          const next = [event, ...prev].slice(0, 15);
          persistEvents(next);
          return next;
        });
        setActiveDynamicDossierId(event.dossier.id);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("unified-intelligence-arbitrated", {
              detail: { eventId: event.id, updatedTabs: event.updatedTabs },
            })
          );
        }

        return event;
      } finally {
        setIsIngesting(false);
      }
    },
    [lexicon, persistEvents]
  );

  const lexiconCountByLayer = useMemo(() => {
    const counts: Record<LexiconLayer, number> = {
      core: 0,
      micro_geo: 0,
      protocol_subtext: 0,
      field_jargon: 0,
    };
    for (const item of lexicon) {
      counts[item.layer] = (counts[item.layer] || 0) + 1;
    }
    return counts;
  }, [lexicon]);

  const newlyLearnedCount = useMemo(
    () => lexicon.filter((l) => l.isNewlyLearned).length,
    [lexicon]
  );

  const latestEvent = arbitratedEvents[0] ?? null;

  const dynamicDossiers = useMemo(
    () => arbitratedEvents.map((e) => e.dossier),
    [arbitratedEvents]
  );

  const dynamicInvestigationNodes = useMemo(
    () => arbitratedEvents.flatMap((e) => e.graphNodes),
    [arbitratedEvents]
  );

  const dynamicInvestigationLinks = useMemo(
    () => arbitratedEvents.flatMap((e) => e.graphLinks),
    [arbitratedEvents]
  );

  const groundTruthPatches = useMemo(
    () => arbitratedEvents.map((e) => e.trafficPatch).filter((p): p is GroundTruthTrafficPatch => Boolean(p)),
    [arbitratedEvents]
  );

  const protocolAgendaLinks = useMemo(
    () => arbitratedEvents.flatMap((e) => e.protocolLinks),
    [arbitratedEvents]
  );

  const ingestedDistrictPosts = useMemo<DistrictFeedItem[]>(
    () =>
      arbitratedEvents.map((e) => ({
        id: e.id,
        districtSlug: e.districtSlug,
        platform: e.rawText.toLocaleLowerCase("tr-TR").includes("instagram")
          ? "instagram"
          : e.rawText.toLocaleLowerCase("tr-TR").includes("facebook")
          ? "facebook"
          : "twitter",
        author: e.imageName ? `Saha İhbarı + 📷 (${e.dossier.code})` : `Saha İhbarı (${e.dossier.code})`,
        content: e.rawText,
        sentiment: e.sentiment,
        published_at: e.timestamp,
        sourceKind: "field-ingested",
        matchedTerms: e.extractedLexiconTerms.map((t) => t.term),
      })),
    [arbitratedEvents]
  );

  const cityPulseInjections = useMemo(
    () =>
      arbitratedEvents
        .filter(isVerifiedArbitratedEvent)
        .map((e) => e.pulseLine)
        .filter((line) => Boolean(line && line.trim().length > 0))
        .slice(0, 4),
    [arbitratedEvents]
  );

  const tabNotifications = useMemo<HubTabNotification[]>(
    () =>
      arbitratedEvents
        .filter(isVerifiedArbitratedEvent)
        .filter((e) => !dismissedNotifIds.has(e.id))
        .map((e) => ({
          id: `notif-${e.id}`,
          eventId: e.id,
          dossierCode: e.dossier.code,
          districtName: e.districtName,
          title: e.trafficPatch?.sensorDiscrepancy
            ? `${e.districtName} (${e.trafficPatch.location}) çevresinde yoğunluk bildirildi`
            : `${e.districtName} için doğrulanmış saha güncellemesi`,
          updatedTabs: e.updatedTabs,
          hasSensorDiscrepancy: Boolean(e.trafficPatch?.sensorDiscrepancy),
          timestamp: e.timestamp,
          read: readNotifIds.has(`notif-${e.id}`),
        })),
    [arbitratedEvents, dismissedNotifIds, readNotifIds]
  );

  const unreadTabNotificationsCount = useMemo(
    () => tabNotifications.filter((n) => !n.read).length,
    [tabNotifications]
  );

  const markNotificationsRead = useCallback(() => {
    setReadNotifIds((prev) => {
      const next = new Set(prev);
      tabNotifications.forEach((n) => next.add(n.id));
      return next;
    });
  }, [tabNotifications]);

  const dismissHubNotification = useCallback((id: string) => {
    const cleanId = id.replace(/^notif-/, "");
    setDismissedNotifIds((prev) => new Set(prev).add(cleanId));
  }, []);

  const getEnergyOutageBonus = useCallback(
    () => arbitratedEvents.reduce((sum, e) => sum + (e.energyOutageDelta || 0), 0),
    [arbitratedEvents]
  );

  const getBudgetAlertsForMunicipality = useCallback(
    (municipalityName: string) => {
      const targetLower = municipalityName.toLocaleLowerCase("tr-TR");
      return arbitratedEvents
        .map((e) => e.budgetAlert)
        .filter(
          (b): b is NonNullable<ArbitratedFieldEvent["budgetAlert"]> =>
            Boolean(b && b.municipalityNames.some((m) => m.toLocaleLowerCase("tr-TR") === targetLower))
        );
    },
    [arbitratedEvents]
  );

  const getProtocolLinksForActor = useCallback(
    (actorName: string, actorTitle?: string, districtName?: string) => {
      const aLow = actorName.toLocaleLowerCase("tr-TR");
      const tLow = (actorTitle || "").toLocaleLowerCase("tr-TR");
      return protocolAgendaLinks.filter((pl) => {
        const plName = pl.actorName.toLocaleLowerCase("tr-TR");
        if (aLow.includes(plName) || plName.includes(aLow)) return true;
        if (districtName && pl.districtName.toLocaleLowerCase("tr-TR") === districtName.toLocaleLowerCase("tr-TR") && tLow.includes("başkan")) {
          return pl.actorTitle.toLocaleLowerCase("tr-TR").includes("başkan");
        }
        return false;
      });
    },
    [protocolAgendaLinks]
  );

  const value: UnifiedIntelligenceContextValue = {
    lexicon,
    lexiconCountByLayer,
    newlyLearnedCount,
    isLexiconDrawerOpen,
    setLexiconDrawerOpen,
    addLexiconTerm,
    arbitratedEvents,
    latestEvent,
    isIngesting,
    ingestFieldSubmission,
    dynamicDossiers,
    dynamicInvestigationNodes,
    dynamicInvestigationLinks,
    activeDynamicDossierId,
    setActiveDynamicDossierId,
    groundTruthPatches,
    protocolAgendaLinks,
    ingestedDistrictPosts,
    cityPulseInjections,
    tabNotifications,
    unreadTabNotificationsCount,
    markNotificationsRead,
    dismissHubNotification,
    getEnergyOutageBonus,
    getBudgetAlertsForMunicipality,
    getProtocolLinksForActor,
  };

  return (
    <UnifiedIntelligenceContext.Provider value={value}>
      {children}
    </UnifiedIntelligenceContext.Provider>
  );
};

export function useOptionalUnifiedIntelligence(): UnifiedIntelligenceContextValue | null {
  return useContext(UnifiedIntelligenceContext);
}

export function useUnifiedIntelligence(): UnifiedIntelligenceContextValue {
  const ctx = useContext(UnifiedIntelligenceContext);
  if (!ctx) {
    throw new Error("useUnifiedIntelligence must be used inside UnifiedIntelligenceProvider");
  }
  return ctx;
}
