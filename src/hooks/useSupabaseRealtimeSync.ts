// src/hooks/useSupabaseRealtimeSync.ts
// Sayfa yenilemesiz Supabase Realtime senkronizasyonu:
// Arka plan 7/24 işçisi (scripts/run-autonomous-agent.mjs) veya cron job'lar
// `public.social_keywords`, `public.social_posts`, `public.alert_events` veya
// `public.live_data_cache` tablolarına yeni kayıt yazdığında açık tarayıcı
// ekranı ek Gemini API kotası tüketmeden sessizce güncellenir.

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { useOptionalUnifiedIntelligence } from "@/contexts/UnifiedIntelligenceContext";
import type { LexiconLayer } from "@/services/livingLexiconService";
import {
  TOPIC_GROUNDING_QUERIES,
  writeLocalTopicCache,
  mergeDamIntelligence,
  mergeSecurityIntelligence,
  mergeEconomyIntelligence,
  mergeTourismIntelligence,
  mergeEnergyIntelligence,
  type SectorTopicKey,
  type TopicGroundingPayload,
} from "@/services/topicGroundingService";
import { useMonitorStore } from "@/store/useMonitorStore";

function mapCategoryToLexiconLayer(category?: string | null): LexiconLayer {
  const low = String(category || "").toLocaleLowerCase("tr-TR");
  if (low === "belediye" || low === "protokol") return "protocol_subtext";
  if (low === "altyapi" || low === "ulasim" || low === "cevre") return "micro_geo";
  return "field_jargon";
}

function isSectorTopicKey(value: string): value is SectorTopicKey {
  return value in TOPIC_GROUNDING_QUERIES;
}

export const REALTIME_SYNC_EVENT = "mugla-supabase-realtime-sync";

export function useSupabaseRealtimeSync(enabled = true) {
  const queryClient = useQueryClient();
  const hub = useOptionalUnifiedIntelligence();
  const addLexiconTermRef = useRef(hub?.addLexiconTerm);
  addLexiconTermRef.current = hub?.addLexiconTerm;

  useEffect(() => {
    if (!enabled || !isSupabaseClientConfigured) return;
    if (typeof supabase?.channel !== "function") return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel("mugla-ecosystem-realtime-sync")
        // 1. Yeni takip kelimeleri (public.social_keywords) -> LivingLexicon + cache anında güncellenir
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "social_keywords",
          },
          (payload) => {
            const row = payload.new as
              | { keyword?: string; category?: string; region?: string; is_active?: boolean }
              | undefined;
            if (row?.keyword && row.is_active !== false && addLexiconTermRef.current) {
              addLexiconTermRef.current(
                row.keyword.trim(),
                mapCategoryToLexiconLayer(row.category),
                row.region || undefined
              );
            }
            queryClient.invalidateQueries({ queryKey: ["social-keywords"] });
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent(REALTIME_SYNC_EVENT, {
                  detail: { table: "social_keywords", eventType: payload.eventType },
                })
              );
            }
          }
        )
        // 2. Yeni sosyal/haber kayıtları (public.social_posts) -> Sosyal & Baraj basın önbelleği sessizce yenilenir
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "social_posts",
          },
          (payload) => {
            const row = payload.new as
              | {
                  id?: string;
                  platform?: string;
                  content?: string;
                  sentiment?: string;
                  region?: string;
                  author?: string;
                  url?: string;
                  published_at?: string;
                }
              | undefined;
            if (row?.content) {
              useMonitorStore.getState().prependSocialPost({
                id: String(row.id || `rt-${Date.now()}`),
                platform: String(row.platform || "news"),
                content: String(row.content),
                sentiment: String(row.sentiment || "neutral"),
                districtName: row.region || undefined,
                author: row.author || undefined,
                url: row.url || undefined,
                publishedAt: row.published_at || new Date().toISOString(),
              });
            }
            queryClient.invalidateQueries({ queryKey: ["social-posts"] });
            queryClient.invalidateQueries({ queryKey: ["social-intel"] });
            queryClient.invalidateQueries({ queryKey: ["dam-press-observations"] });
            queryClient.invalidateQueries({ queryKey: ["district-pulse"] });
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent(REALTIME_SYNC_EVENT, {
                  detail: { table: "social_posts", eventType: payload.eventType },
                })
              );
            }
          }
        )
        // 3. Yeni kritik olay/uyarı kayıtları (public.alert_events)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "alert_events",
          },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ["alert-events"] });
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent(REALTIME_SYNC_EVENT, {
                  detail: { table: "alert_events", eventType: payload.eventType },
                })
              );
            }
          }
        )
        // 4. Canlı veri & konu tarama önbelleği (public.live_data_cache) -> sıfır ek Gemini çağrısıyla UI güncellenir
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "live_data_cache",
          },
          (payload) => {
            const row = payload.new as
              | { data_type?: string; data?: unknown; fetched_at?: string }
              | undefined;
            if (!row?.data_type || row.data == null) return;

            if (row.data_type.startsWith("topic_grounding:")) {
              const topicKey = row.data_type.slice("topic_grounding:".length);
              if (isSectorTopicKey(topicKey)) {
                const topicPayload = row.data as TopicGroundingPayload;
                writeLocalTopicCache(topicKey, topicPayload);
                queryClient.setQueryData(["topic-grounding", topicKey], topicPayload);
                if (topicKey === "environment_dams" && Array.isArray(topicPayload.damUpdates)) {
                  const merged = mergeDamIntelligence({
                    groundedUpdates: topicPayload.damUpdates,
                  });
                  useMonitorStore.getState().setDamsSnapshot({
                    records: merged.dams,
                    avgOccupancy: merged.avgOccupancy,
                    verifiedCount: merged.verifiedCount,
                    hasVerifiedLiveData: merged.hasVerifiedLiveData,
                    latestSourceSummary: merged.latestSourceSummary,
                    latestMeasuredAt: merged.latestMeasuredAt,
                    updatedAt: topicPayload.fetchedAt || row.fetched_at || new Date().toISOString(),
                  });
                }
                if (topicKey === "transport_infra" && Array.isArray(topicPayload.transportIncidents)) {
                  useMonitorStore
                    .getState()
                    .setTransportOverride(
                      topicPayload.transportIncidents,
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                }
                if (topicKey === "energy_outages" && Array.isArray(topicPayload.energyOutages)) {
                  const energy = mergeEnergyIntelligence({
                    groundedOutages: topicPayload.energyOutages,
                  });
                  useMonitorStore
                    .getState()
                    .setEnergyOverride(
                      energy,
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                }
                if (topicKey === "security_quakes" && Array.isArray(topicPayload.securityEvents)) {
                  const sec = mergeSecurityIntelligence({
                    groundedEvents: topicPayload.securityEvents,
                  });
                  if (sec.quakes.length > 0) {
                    useMonitorStore.getState().setEarthquakes(
                      sec.quakes.map((q) => ({
                        id: q.id,
                        magnitude: q.magnitude,
                        location: q.location,
                        depthKm: q.depthKm,
                        occurredAt: q.occurredAt,
                        url: q.sourceUrl,
                        sourceName: q.sourceName,
                      })),
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                  }
                  useMonitorStore
                    .getState()
                    .setSecurityOverride(
                      sec,
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                }
                if (topicKey === "tourism_occupancy" && topicPayload.tourismMetrics) {
                  const tour = mergeTourismIntelligence({
                    groundedTourism: topicPayload.tourismMetrics,
                  });
                  useMonitorStore
                    .getState()
                    .setTourismOverride(
                      tour,
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                }
                if (topicKey === "economy_budget" && topicPayload.economyUpdates) {
                  const eco = mergeEconomyIntelligence({
                    groundedEconomy: topicPayload.economyUpdates,
                  });
                  useMonitorStore
                    .getState()
                    .setEconomyOverride(
                      eco,
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                }
                if (topicKey === "protocol_activity" && Array.isArray(topicPayload.protocolActivities)) {
                  useMonitorStore
                    .getState()
                    .setProtocolActivitiesOverride(
                      topicPayload.protocolActivities,
                      topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
                    );
                }
              }
            } else {
              queryClient.setQueriesData(
                { queryKey: ["live-data", row.data_type] },
                row.data
              );
              if (row.data_type === "earthquakes") {
                const sec = mergeSecurityIntelligence({ earthquakeCache: row.data });
                if (sec.quakes.length > 0) {
                  useMonitorStore.getState().setEarthquakes(
                    sec.quakes.map((q) => ({
                      id: q.id,
                      magnitude: q.magnitude,
                      location: q.location,
                      depthKm: q.depthKm,
                      occurredAt: q.occurredAt,
                      url: q.sourceUrl,
                      sourceName: q.sourceName,
                    })),
                    row.fetched_at || new Date().toISOString()
                  );
                }
                useMonitorStore
                  .getState()
                  .setSecurityOverride(sec, row.fetched_at || new Date().toISOString());
              } else if (row.data_type === "dams") {
                const merged = mergeDamIntelligence({ cacheData: row.data });
                useMonitorStore.getState().setDamsSnapshot({
                  records: merged.dams,
                  avgOccupancy: merged.avgOccupancy,
                  verifiedCount: merged.verifiedCount,
                  hasVerifiedLiveData: merged.hasVerifiedLiveData,
                  latestSourceSummary: merged.latestSourceSummary,
                  latestMeasuredAt: merged.latestMeasuredAt,
                  updatedAt: row.fetched_at || new Date().toISOString(),
                });
              } else if (row.data_type === "economy") {
                const eco = mergeEconomyIntelligence({ economyCache: row.data });
                useMonitorStore
                  .getState()
                  .setEconomyOverride(eco, row.fetched_at || new Date().toISOString());
              } else if (row.data_type === "tourism") {
                const tour = mergeTourismIntelligence({ tourismCache: row.data });
                useMonitorStore
                  .getState()
                  .setTourismOverride(tour, row.fetched_at || new Date().toISOString());
              } else if (row.data_type === "energy") {
                const energy = mergeEnergyIntelligence({ energyCache: row.data });
                useMonitorStore
                  .getState()
                  .setEnergyOverride(energy, row.fetched_at || new Date().toISOString());
              }
            }
            useMonitorStore.getState().touchLastSynced(row.fetched_at || new Date().toISOString());

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent(REALTIME_SYNC_EVENT, {
                  detail: {
                    table: "live_data_cache",
                    dataType: row.data_type,
                    eventType: payload.eventType,
                  },
                })
              );
            }
          }
        )
        // 5. Protokol değişiklikleri (public.protocol_changes) -> Aktif protokol listesi canlı güncellenir
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "protocol_changes",
          },
          (payload) => {
            const row = payload.new as
              | { title?: string; unvan?: string; new_name?: string; isim?: string; created_at?: string }
              | undefined;
            const titleMatch = row?.title || row?.unvan || "";
            const newName = row?.new_name || row?.isim || "";
            if (titleMatch && newName) {
              useMonitorStore.getState().upsertProtocolRoleOverride({
                titleMatch,
                newName,
                sourceName: "Resmî Protokol Kaydı",
                updatedAt: row?.created_at || new Date().toISOString(),
              });
            }
            queryClient.invalidateQueries({ queryKey: ["protocol-members"] });
          }
        )
        .subscribe();
    } catch {
      // Realtime desteklenmeyen ortamlarda sessizce polling ile devam et
      return;
    }

    return () => {
      if (channel && typeof supabase?.removeChannel === "function") {
        supabase.removeChannel(channel);
      }
    };
  }, [enabled, queryClient]);
}
