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
  type SectorTopicKey,
  type TopicGroundingPayload,
} from "@/services/topicGroundingService";

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
              }
            } else {
              queryClient.setQueriesData(
                { queryKey: ["live-data", row.data_type] },
                row.data
              );
            }

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
