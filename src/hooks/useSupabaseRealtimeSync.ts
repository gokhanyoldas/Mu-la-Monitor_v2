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
import { subscribeToRealtimeTable } from "@/lib/supabase-realtime-singleton";
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
import { useMonitorStore, parseMonitorDataRow } from "@/store/useMonitorStore";

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
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const hub = useOptionalUnifiedIntelligence();
  const addLexiconTermRef = useRef(hub?.addLexiconTerm);
  addLexiconTermRef.current = hub?.addLexiconTerm;

  useEffect(() => {
    if (!enabled || !isSupabaseClientConfigured) return;

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const applyLiveCacheRow = (row: { data_type?: string; data?: unknown; fetched_at?: string }) => {
      try {
        if (!row || typeof row !== "object" || typeof row.data_type !== "string" || !row.data_type || row.data == null) return;
        if (row.data_type.startsWith("topic_grounding:")) {
          const topicKey = row.data_type.slice("topic_grounding:".length);
          if (isSectorTopicKey(topicKey) && typeof row.data === "object") {
            const topicPayload = row.data as TopicGroundingPayload;
          writeLocalTopicCache(topicKey, topicPayload);
          queryClientRef.current.setQueryData(["topic-grounding", topicKey], topicPayload);
          if (topicKey === "environment_dams" && Array.isArray(topicPayload.damUpdates)) {
            const merged = mergeDamIntelligence({ groundedUpdates: topicPayload.damUpdates });
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
            const energy = mergeEnergyIntelligence({ groundedOutages: topicPayload.energyOutages });
            useMonitorStore
              .getState()
              .setEnergyOverride(
                energy,
                topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
              );
          }
          if (topicKey === "security_quakes" && Array.isArray(topicPayload.securityEvents)) {
            const sec = mergeSecurityIntelligence({ groundedEvents: topicPayload.securityEvents });
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
            const tour = mergeTourismIntelligence({ groundedTourism: topicPayload.tourismMetrics });
            useMonitorStore
              .getState()
              .setTourismOverride(
                tour,
                topicPayload.fetchedAt || row.fetched_at || new Date().toISOString()
              );
          }
          if (topicKey === "economy_budget" && topicPayload.economyUpdates) {
            const eco = mergeEconomyIntelligence({ groundedEconomy: topicPayload.economyUpdates });
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
        queryClientRef.current.setQueriesData({ queryKey: ["live-data", row.data_type] }, row.data);
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
          useMonitorStore.getState().setSecurityOverride(sec, row.fetched_at || new Date().toISOString());
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
          useMonitorStore.getState().setEconomyOverride(eco, row.fetched_at || new Date().toISOString());
        } else if (row.data_type === "tourism") {
          const tour = mergeTourismIntelligence({ tourismCache: row.data });
          useMonitorStore.getState().setTourismOverride(tour, row.fetched_at || new Date().toISOString());
        } else if (row.data_type === "energy") {
          const energy = mergeEnergyIntelligence({ energyCache: row.data });
          useMonitorStore.getState().setEnergyOverride(energy, row.fetched_at || new Date().toISOString());
        }
      }
        useMonitorStore.getState().touchLastSynced(row.fetched_at || new Date().toISOString());
      } catch (err) {
        console.warn("[RealtimeSync] live_data_cache satırı işlenemedi:", row?.data_type, err);
      }
    };

    // Başlangıç senkronizasyonu: Supabase çekirdek tablolarından (monitor_data, districts,
    // protocol_members, protocol_changes, ai_summaries, live_data_cache) store'u besle
    if (typeof supabase?.from === "function") {
      const safeSelect = async (
        table:
          | "monitor_data"
          | "districts"
          | "protocol_members"
          | "protocol_changes"
          | "ai_summaries"
          | "live_data_cache"
          | "social_posts",
        columns: string,
        orderCol: string,
        ascending: boolean,
        limitCount: number
      ): Promise<{ data: unknown[] | null; error: unknown }> => {
        try {
          const qb = supabase.from(table) as unknown as {
            select?: (cols: string) => {
              order?: (
                col: string,
                opts: { ascending: boolean }
              ) => { limit?: (n: number) => Promise<{ data: unknown[] | null; error: unknown }> };
            };
          };
          const ordered = qb?.select?.(columns)?.order?.(orderCol, { ascending });
          if (ordered && typeof ordered.limit === "function") {
            return await ordered.limit(limitCount);
          }
          return { data: null, error: null };
        } catch {
          return { data: null, error: null };
        }
      };

      void (async () => {
        const results = await Promise.allSettled([
          safeSelect(
            "monitor_data",
            "source, district_name, content, sentiment, category, created_at",
            "created_at",
            false,
            40
          ),
          safeSelect("districts", "id, name, lat, lng", "name", true, 20),
          safeSelect(
            "protocol_members",
            "id, isim, unvan, kategori, telefon, faks, district, updated_at",
            "updated_at",
            false,
            100
          ),
          safeSelect("protocol_changes", "unvan, isim_new, scraped_at", "scraped_at", false, 20),
          safeSelect("ai_summaries", "type, date, summary, generated_at", "generated_at", false, 6),
          safeSelect("live_data_cache", "data_type, data, fetched_at", "fetched_at", false, 30),
          safeSelect(
            "social_posts",
            "id, platform, content, sentiment, region, author, url, published_at, keywords_matched",
            "published_at",
            false,
            120
          ),
        ]);

        if (cancelled) return;
        const store = useMonitorStore.getState();

        const [monitorRes, districtsRes, membersRes, changesRes, summariesRes, cacheRes, socialRes] = results;

        if (monitorRes.status === "fulfilled" && !monitorRes.value.error && Array.isArray(monitorRes.value.data)) {
          try {
            // En güncel kayıtlar önce geldiği için her kategori için ilk (en yeni) satırı koru
            const seenTabKeys = new Set<string>();
            const tabRows = [];
            for (const raw of monitorRes.value.data) {
              try {
                if (!raw || typeof raw !== "object") continue;
                const parsed = parseMonitorDataRow(raw as Record<string, unknown>);
                if (!parsed || seenTabKeys.has(parsed.tabKey)) continue;
                seenTabKeys.add(parsed.tabKey);
                tabRows.push(parsed);
              } catch {
                // Hatalı monitor_data satırını atla
              }
            }
            if (tabRows.length > 0) {
              store.setMonitorTabs(tabRows);
            }
          } catch (err) {
            console.warn("[RealtimeSync] monitor_data yüklenemedi:", err);
          }
        }

        if (districtsRes.status === "fulfilled" && !districtsRes.value.error && Array.isArray(districtsRes.value.data)) {
          try {
            const districtRows = districtsRes.value.data
              .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
              .map((r) => {
                const numericId = Number(r.id);
                const lat = Number(r.lat ?? 0);
                const lng = Number(r.lng ?? r.lon ?? 0);
                return {
                  id:
                    Number.isInteger(numericId) && numericId > 0
                      ? numericId
                      : String(r.id ?? ""),
                  name: String(r.name || "").trim(),
                  lat: Number.isFinite(lat) ? lat : 0,
                  lng: Number.isFinite(lng) ? lng : 0,
                };
              })
              .filter((r) => Boolean(r.id !== "" && r.name));
            if (districtRows.length > 0) {
              store.setDistrictsRegistry(districtRows);
            }
          } catch (err) {
            console.warn("[RealtimeSync] districts yüklenemedi:", err);
          }
        }

        if (membersRes.status === "fulfilled" && !membersRes.value.error && Array.isArray(membersRes.value.data)) {
          try {
            const memberRows = membersRes.value.data
              .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
              .map((r) => ({
                id: String(r.id ?? ""),
                isim: String(r.isim ?? "").trim(),
                unvan: String(r.unvan ?? "").trim(),
                kategori: String(r.kategori ?? "").trim(),
                telefon: String(r.telefon ?? ""),
                faks: String(r.faks ?? ""),
                district: typeof r.district === "string" ? r.district : null,
                updatedAt: typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
              }))
              .filter((r) => Boolean(r.isim && r.unvan));
            if (memberRows.length > 0) {
              store.setProtocolMembers(memberRows);
            }
          } catch (err) {
            console.warn("[RealtimeSync] protocol_members yüklenemedi:", err);
          }
        }

        if (changesRes.status === "fulfilled" && !changesRes.value.error && Array.isArray(changesRes.value.data)) {
          for (const row of changesRes.value.data) {
            try {
              if (!row || typeof row !== "object") continue;
              const rec = row as Record<string, unknown>;
              const titleMatch = String(rec.unvan || "").trim();
              const newName = String(rec.isim_new || "").trim();
              if (titleMatch && newName) {
                store.upsertProtocolRoleOverride({
                  titleMatch,
                  newName,
                  sourceName: "Resmî Protokol Kaydı",
                  updatedAt: typeof rec.scraped_at === "string" ? rec.scraped_at : new Date().toISOString(),
                });
              }
            } catch {
              // Hatalı protocol_changes satırını atla
            }
          }
        }

        if (summariesRes.status === "fulfilled" && !summariesRes.value.error && Array.isArray(summariesRes.value.data)) {
          for (const row of summariesRes.value.data) {
            try {
              if (!row || typeof row !== "object") continue;
              const rec = row as Record<string, unknown>;
              const type = String(rec.type || "").trim();
              const summary = String(rec.summary || "").trim();
              if (type && summary) {
                store.upsertAiSummary({
                  type,
                  date: String(rec.date || ""),
                  summary,
                  generatedAt:
                    typeof rec.generated_at === "string" ? rec.generated_at : new Date().toISOString(),
                });
              }
            } catch {
              // Hatalı ai_summaries satırını atla
            }
          }
        }

        if (cacheRes.status === "fulfilled" && !cacheRes.value.error && Array.isArray(cacheRes.value.data)) {
          for (const row of cacheRes.value.data) {
            if (!row || typeof row !== "object") continue;
            applyLiveCacheRow(
              row as {
                data_type?: string;
                data?: unknown;
                fetched_at?: string;
              }
            );
          }
        }

        if (socialRes.status === "fulfilled" && !socialRes.value.error && Array.isArray(socialRes.value.data)) {
          try {
            const posts = socialRes.value.data
              .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object" && r.content))
              .map((r) => ({
                id: String(r.id ?? `sp-${Math.random().toString(36).slice(2)}`),
                platform: String(r.platform ?? "news"),
                content: String(r.content ?? ""),
                sentiment: String(r.sentiment ?? "neutral"),
                districtName: typeof r.region === "string" ? r.region : undefined,
                author: typeof r.author === "string" ? r.author : undefined,
                url: typeof r.url === "string" ? r.url : undefined,
                publishedAt:
                  typeof r.published_at === "string" && r.published_at
                    ? r.published_at
                    : new Date().toISOString(),
              }));
            if (posts.length > 0) {
              const posCount = posts.filter((p) => p.sentiment.toLowerCase() === "positive").length;
              const negCount = posts.filter((p) => p.sentiment.toLowerCase() === "negative").length;
              store.setSocialFeed({
                items: posts,
                totalMentions: Math.max(posts.length, store.socialFeed.totalMentions),
                positiveRatio: Math.round((posCount / posts.length) * 100),
                negativeRatio: Math.round((negCount / posts.length) * 100),
                lastUpdatedAt: posts[0]?.publishedAt || new Date().toISOString(),
              });
            }
          } catch (err) {
            console.warn("[RealtimeSync] social_posts yüklenemedi:", err);
          }
        }
      })();
    }

    // 1. Yeni takip kelimeleri (public.social_keywords) -> LivingLexicon + cache anında güncellenir
    unsubscribers.push(
      subscribeToRealtimeTable("social_keywords", (payload) => {
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
        queryClientRef.current.invalidateQueries({ queryKey: ["social-keywords"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(REALTIME_SYNC_EVENT, {
              detail: { table: "social_keywords", eventType: payload.eventType },
            })
          );
        }
      })
    );

    // 2. Yeni sosyal/haber kayıtları (public.social_posts) -> Sosyal & Baraj basın önbelleği sessizce yenilenir
    unsubscribers.push(
      subscribeToRealtimeTable("social_posts", (payload) => {
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
        queryClientRef.current.invalidateQueries({ queryKey: ["social-posts"] });
        queryClientRef.current.invalidateQueries({ queryKey: ["social-intel"] });
        queryClientRef.current.invalidateQueries({ queryKey: ["dam-press-observations"] });
        queryClientRef.current.invalidateQueries({ queryKey: ["district-pulse"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(REALTIME_SYNC_EVENT, {
              detail: { table: "social_posts", eventType: payload.eventType },
            })
          );
        }
      })
    );

    // 3. Yeni kritik olay/uyarı kayıtları (public.alert_events)
    unsubscribers.push(
      subscribeToRealtimeTable("alert_events", (payload) => {
        queryClientRef.current.invalidateQueries({ queryKey: ["alert-events"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(REALTIME_SYNC_EVENT, {
              detail: { table: "alert_events", eventType: payload.eventType },
            })
          );
        }
      })
    );

    // 4. Canlı veri & konu tarama önbelleği (public.live_data_cache) -> sıfır ek Gemini çağrısıyla UI güncellenir
    unsubscribers.push(
      subscribeToRealtimeTable("live_data_cache", (payload) => {
        const row = payload.new as
          | { data_type?: string; data?: unknown; fetched_at?: string }
          | undefined;
        if (!row?.data_type || row.data == null) return;
        applyLiveCacheRow(row);

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
      })
    );

    // 5. Protokol değişiklikleri (public.protocol_changes) -> Aktif protokol listesi canlı güncellenir
    unsubscribers.push(
      subscribeToRealtimeTable("protocol_changes", (payload) => {
        const row = payload.new as
          | {
              title?: string;
              unvan?: string;
              isim_new?: string;
              new_name?: string;
              isim?: string;
              scraped_at?: string;
              created_at?: string;
            }
          | undefined;
        const titleMatch = row?.title || row?.unvan || "";
        const newName = row?.isim_new || row?.new_name || row?.isim || "";
        if (titleMatch && newName) {
          useMonitorStore.getState().upsertProtocolRoleOverride({
            titleMatch,
            newName,
            sourceName: "Resmî Protokol Kaydı",
            updatedAt: row?.scraped_at || row?.created_at || new Date().toISOString(),
          });
        }
        queryClientRef.current.invalidateQueries({ queryKey: ["protocol-members"] });
      })
    );

    // 6. 11 ana sekme metrikleri (public.monitor_data — content JSON veya düz metin)
    unsubscribers.push(
      subscribeToRealtimeTable("monitor_data", (payload) => {
        try {
          const parsed = parseMonitorDataRow(payload.new as Record<string, unknown> | undefined);
          if (parsed) {
            useMonitorStore.getState().upsertMonitorTab(parsed);
          }
          queryClientRef.current.invalidateQueries({ queryKey: ["monitor-data"] });
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(REALTIME_SYNC_EVENT, {
                detail: {
                  table: "monitor_data",
                  tabKey: parsed?.tabKey || "",
                  eventType: payload.eventType,
                },
              })
            );
          }
        } catch (err) {
          console.warn("[RealtimeSync] monitor_data olayı işlenemedi:", err);
        }
      })
    );

    // 7. İlçeler (public.districts) ve Protokol üyeleri (public.protocol_members)
    unsubscribers.push(
      subscribeToRealtimeTable("districts", () => {
        queryClientRef.current.invalidateQueries({ queryKey: ["districts"] });
      })
    );

    unsubscribers.push(
      subscribeToRealtimeTable("protocol_members", (payload) => {
        const row = payload.new as
          | { isim?: string; unvan?: string; updated_at?: string }
          | undefined;
        if (row?.isim && row?.unvan) {
          useMonitorStore.getState().upsertProtocolRoleOverride({
            titleMatch: row.unvan,
            newName: row.isim,
            sourceName: "Supabase Protokol Kaydı",
            updatedAt: row.updated_at || new Date().toISOString(),
          });
        }
        queryClientRef.current.invalidateQueries({ queryKey: ["protocol-members"] });
      })
    );

    // 8. Günlük özet & şehir nabzı (public.ai_summaries)
    unsubscribers.push(
      subscribeToRealtimeTable("ai_summaries", (payload) => {
        const row = payload.new as
          | { type?: string; date?: string; summary?: string; generated_at?: string }
          | undefined;
        if (row?.type && row?.summary) {
          useMonitorStore.getState().upsertAiSummary({
            type: row.type,
            date: row.date || "",
            summary: row.summary,
            generatedAt: row.generated_at || new Date().toISOString(),
          });
        }
        queryClientRef.current.invalidateQueries({ queryKey: ["ai-summaries"] });
      })
    );

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [enabled]);
}
