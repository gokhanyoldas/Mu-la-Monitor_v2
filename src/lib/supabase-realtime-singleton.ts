// src/lib/supabase-realtime-singleton.ts
// Merkezi Singleton Supabase Realtime Kanal Yöneticisi
// - Tek bir `mugla-monitor-sync` kanalı açar; oluşturmadan önce `supabase.removeAllChannels()` ile
//   artık kanalları temizler.
// - `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` geldiği ANDA `void supabase.removeChannel(channel)`
//   çağırarak Phoenix'in agresif WebSocket yeniden bağlanma döngüsünü tamamen keser.
// - Aynı oturumda en fazla 1 kez yeniden dener; başarısız olursa WebSocket'i tamamen bırakıp
//   60 saniyelik hafif HTTP `select` polling modunda sessizce devam eder.

import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const SINGLETON_REALTIME_CHANNEL_NAME = "mugla-monitor-sync";

export type RealtimeTableName =
  | "live_data_cache"
  | "social_posts"
  | "social_keywords"
  | "alert_events"
  | "anomaly_alerts"
  | "protocol_changes";

export type RealtimeBroadcastEvent = "earthquake_alert" | "fire_alert";

export type RealtimeChannelLifecycleState =
  | "IDLE"
  | "JOINING"
  | "SUBSCRIBED"
  | "BACKOFF"
  | "FALLBACK_POLLING";

export interface PostgresChangePayload {
  eventType: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  table?: string;
  schema?: string;
}

export type TableChangeHandler = (payload: PostgresChangePayload) => void;
export type BroadcastHandler = (message: { payload: Record<string, unknown> }) => void;
export type StatusChangeHandler = (isConnected: boolean) => void;

export const MAX_SESSION_REALTIME_RETRIES = 1;
export const REALTIME_RETRY_DELAY_MS = 60_000; // Tek yeniden deneme öncesi 60sn güvenli bekleme
export const HTTP_FALLBACK_POLL_INTERVAL_MS = 60_000; // 60sn hafif HTTP select polling

function getTeardownGraceMs(): number {
  const isTestEnv =
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: { MODE?: string } }).env?.MODE === "test";
  return isTestEnv ? 25 : 1500;
}

const tableListeners: Record<RealtimeTableName, Set<TableChangeHandler>> = {
  live_data_cache: new Set(),
  social_posts: new Set(),
  social_keywords: new Set(),
  alert_events: new Set(),
  anomaly_alerts: new Set(),
  protocol_changes: new Set(),
};

const broadcastListeners: Record<RealtimeBroadcastEvent, Set<BroadcastHandler>> = {
  earthquake_alert: new Set(),
  fire_alert: new Set(),
};

const statusListeners = new Set<StatusChangeHandler>();

let activeChannel: RealtimeChannel | null = null;
let channelState: RealtimeChannelLifecycleState = "IDLE";
let sessionRetryAttempts = 0;
let consecutiveFailures = 0;
let realtimeDisabledForSession = false;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let pollingInFlight = false;
let lastHttpPollIso: string | null = null;
let isConnectedFlag = false;

function getTotalDataListenerCount(): number {
  let count = 0;
  for (const set of Object.values(tableListeners)) {
    count += set.size;
  }
  for (const set of Object.values(broadcastListeners)) {
    count += set.size;
  }
  return count;
}

function notifyStatus(connected: boolean) {
  if (isConnectedFlag === connected) return;
  isConnectedFlag = connected;
  for (const listener of statusListeners) {
    try {
      listener(connected);
    } catch {
      // Dinleyici hatası diğer abonelikleri etkilemez
    }
  }
}

function clearAllTimers() {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function safeRemoveChannel(channel: RealtimeChannel | null) {
  if (!channel) return;
  try {
    if (typeof supabase?.removeChannel === "function") {
      void Promise.resolve(supabase.removeChannel(channel)).catch(() => {});
    }
  } catch {
    // Temizleme hatasını sessizce yut
  }
}

function safeRemoveAllChannels() {
  try {
    if (typeof supabase?.removeAllChannels === "function") {
      void Promise.resolve(supabase.removeAllChannels()).catch(() => {});
    }
  } catch {
    // Temizleme hatasını sessizce yut
  }
}

function dispatchTableEvent(table: RealtimeTableName, payload: PostgresChangePayload) {
  const listeners = tableListeners[table];
  if (!listeners || listeners.size === 0) return;
  for (const handler of listeners) {
    try {
      handler(payload);
    } catch {
      // Tekil kart hatası paylaşımlı kanalı düşürmez
    }
  }
}

function dispatchBroadcastEvent(
  event: RealtimeBroadcastEvent,
  message: { payload: Record<string, unknown> }
) {
  const listeners = broadcastListeners[event];
  if (!listeners || listeners.size === 0) return;
  for (const handler of listeners) {
    try {
      handler(message);
    } catch {
      // Tekil dinleyici hatası paylaşımlı kanalı düşürmez
    }
  }
}

function isChannelAlreadyActiveOrJoining(channel: RealtimeChannel | null): boolean {
  if (!channel) return false;
  const rawState = String((channel as unknown as { state?: string }).state ?? "").toLowerCase();
  return rawState === "joined" || rawState === "joining";
}

/**
 * 60 saniyelik hafif HTTP `select` fallback senkronizasyonu.
 * WebSocket Realtime devre dışı bırakıldığında aktif dinleyicileri hafif sorgularla besler.
 */
async function runHttpPollingTick() {
  if (pollingInFlight) return;
  if (!isSupabaseClientConfigured || typeof supabase?.from !== "function") return;
  if (getTotalDataListenerCount() === 0) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

  pollingInFlight = true;
  const pollStartedIso = new Date().toISOString();
  const sinceIso = lastHttpPollIso;

  try {
    if (tableListeners.live_data_cache.size > 0) {
      const { data, error } = await supabase
        .from("live_data_cache")
        .select("data_type, data, fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(25);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const rec = row as Record<string, unknown>;
          if (sinceIso && typeof rec.fetched_at === "string" && rec.fetched_at <= sinceIso) {
            continue;
          }
          dispatchTableEvent("live_data_cache", {
            eventType: "UPDATE",
            table: "live_data_cache",
            schema: "public",
            new: rec,
          });
        }
      }
    }

    if (tableListeners.social_posts.size > 0) {
      const { data, error } = await supabase
        .from("social_posts")
        .select("id, platform, content, sentiment, region, author, url, published_at, created_at")
        .order("published_at", { ascending: false })
        .limit(10);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const rec = row as Record<string, unknown>;
          const ts = String(rec.published_at ?? rec.created_at ?? "");
          if (sinceIso && ts && ts <= sinceIso) continue;
          dispatchTableEvent("social_posts", {
            eventType: "INSERT",
            table: "social_posts",
            schema: "public",
            new: rec,
          });
        }
      }
    }

    if (tableListeners.alert_events.size > 0) {
      const { data, error } = await supabase
        .from("alert_events")
        .select("id, type, severity, title, body, source, lat, lon, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const rec = row as Record<string, unknown>;
          if (sinceIso && typeof rec.created_at === "string" && rec.created_at <= sinceIso) {
            continue;
          }
          dispatchTableEvent("alert_events", {
            eventType: "INSERT",
            table: "alert_events",
            schema: "public",
            new: rec,
          });
        }
      }
    }

    if (tableListeners.anomaly_alerts.size > 0) {
      const { data, error } = await supabase
        .from("anomaly_alerts")
        .select("id, severity, category, title, description, detected_at, value_num, baseline_num, is_active")
        .eq("is_active", true)
        .order("detected_at", { ascending: false })
        .limit(10);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const rec = row as Record<string, unknown>;
          if (sinceIso && typeof rec.detected_at === "string" && rec.detected_at <= sinceIso) {
            continue;
          }
          dispatchTableEvent("anomaly_alerts", {
            eventType: "UPDATE",
            table: "anomaly_alerts",
            schema: "public",
            new: rec,
          });
        }
      }
    }

    lastHttpPollIso = pollStartedIso;
  } catch {
    // HTTP polling hatası arayüzü kesmez; bir sonraki 60sn periyodunda tekrar dener
  } finally {
    pollingInFlight = false;
  }
}

function enterHttpPollingFallback() {
  realtimeDisabledForSession = true;
  channelState = "FALLBACK_POLLING";
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  const ch = activeChannel;
  activeChannel = null;
  safeRemoveChannel(ch);
  safeRemoveAllChannels();
  notifyStatus(false);

  if (pollingTimer === null && getTotalDataListenerCount() > 0) {
    lastHttpPollIso = new Date().toISOString();
    pollingTimer = setInterval(() => {
      void runHttpPollingTick();
    }, HTTP_FALLBACK_POLL_INTERVAL_MS);
  }
}

function handleChannelFailure(channel: RealtimeChannel | null) {
  // Hata / timeout / kapanma anında kanalı HEMEN kaldır — Phoenix'in yeniden join döngüsünü durdur
  if (activeChannel === channel) {
    activeChannel = null;
  }
  safeRemoveChannel(channel);
  notifyStatus(false);

  if (getTotalDataListenerCount() === 0) {
    channelState = "IDLE";
    return;
  }

  consecutiveFailures += 1;

  // Aynı oturumda en fazla 1 kez yeniden dene; o da başarısız olursa 60sn HTTP polling moduna geç
  if (sessionRetryAttempts >= MAX_SESSION_REALTIME_RETRIES) {
    enterHttpPollingFallback();
    return;
  }

  sessionRetryAttempts += 1;
  channelState = "BACKOFF";

  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
  }

  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    if (getTotalDataListenerCount() === 0) {
      channelState = "IDLE";
      return;
    }
    if (realtimeDisabledForSession) {
      enterHttpPollingFallback();
      return;
    }
    channelState = "IDLE";
    ensureChannelConnected();
  }, REALTIME_RETRY_DELAY_MS);
}

function ensureChannelConnected() {
  if (!isSupabaseClientConfigured) return;
  if (getTotalDataListenerCount() === 0) return;

  if (realtimeDisabledForSession) {
    enterHttpPollingFallback();
    return;
  }

  if (typeof supabase?.channel !== "function") return;

  // Singleton guard: zaten JOINING, SUBSCRIBED, BACKOFF veya FALLBACK_POLLING ise tekrar .subscribe() çağırma
  if (
    channelState === "JOINING" ||
    channelState === "SUBSCRIBED" ||
    channelState === "BACKOFF" ||
    channelState === "FALLBACK_POLLING"
  ) {
    return;
  }

  if (isChannelAlreadyActiveOrJoining(activeChannel)) {
    return;
  }

  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }

  // Yeni tekil kanal açılmadan önce mevcut tüm artık/aktif kanalları temizle
  safeRemoveAllChannels();

  channelState = "JOINING";

  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase.channel(SINGLETON_REALTIME_CHANNEL_NAME, {
      config: { broadcast: { ack: false } },
    });

    activeChannel = channel;

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_data_cache" },
        (payload) => dispatchTableEvent("live_data_cache", payload as PostgresChangePayload)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "social_posts" },
        (payload) => dispatchTableEvent("social_posts", payload as PostgresChangePayload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_keywords" },
        (payload) => dispatchTableEvent("social_keywords", payload as PostgresChangePayload)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alert_events" },
        (payload) => dispatchTableEvent("alert_events", payload as PostgresChangePayload)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "anomaly_alerts" },
        (payload) => dispatchTableEvent("anomaly_alerts", payload as PostgresChangePayload)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "protocol_changes" },
        (payload) => dispatchTableEvent("protocol_changes", payload as PostgresChangePayload)
      )
      .on("broadcast", { event: "earthquake_alert" }, (msg) =>
        dispatchBroadcastEvent("earthquake_alert", msg as { payload: Record<string, unknown> })
      )
      .on("broadcast", { event: "fire_alert" }, (msg) =>
        dispatchBroadcastEvent("fire_alert", msg as { payload: Record<string, unknown> })
      )
      .subscribe((status) => {
        if (activeChannel !== channel) return;

        if (status === "SUBSCRIBED") {
          channelState = "SUBSCRIBED";
          consecutiveFailures = 0;
          notifyStatus(true);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          handleChannelFailure(channel);
        }
      });
  } catch {
    handleChannelFailure(channel);
  }
}

function scheduleTeardownIfIdle() {
  if (getTotalDataListenerCount() > 0) return;

  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
  }

  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    if (getTotalDataListenerCount() > 0) return;

    clearAllTimers();
    const ch = activeChannel;
    activeChannel = null;
    channelState = realtimeDisabledForSession ? "FALLBACK_POLLING" : "IDLE";
    safeRemoveChannel(ch);
    notifyStatus(false);
  }, getTeardownGraceMs());
}

/**
 * Tekil singleton kanal üzerinden belirli bir Postgres tablosunu dinler.
 * Dönen cleanup fonksiyonu idempotent'tir.
 */
export function subscribeToRealtimeTable(
  table: RealtimeTableName,
  handler: TableChangeHandler
): () => void {
  tableListeners[table].add(handler);
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  ensureChannelConnected();

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    tableListeners[table].delete(handler);
    scheduleTeardownIfIdle();
  };
}

/**
 * Tekil singleton kanal üzerinden broadcast olaylarını dinler.
 */
export function subscribeToRealtimeBroadcast(
  event: RealtimeBroadcastEvent,
  handler: BroadcastHandler
): () => void {
  broadcastListeners[event].add(handler);
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  ensureChannelConnected();

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    broadcastListeners[event].delete(handler);
    scheduleTeardownIfIdle();
  };
}

/**
 * Singleton Realtime bağlantı durumunu (`SUBSCRIBED` -> true) dinler.
 */
export function subscribeToRealtimeStatus(handler: StatusChangeHandler): () => void {
  statusListeners.add(handler);
  handler(isConnectedFlag);
  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    statusListeners.delete(handler);
  };
}

export function getRealtimeSingletonSnapshot() {
  return {
    channelName: SINGLETON_REALTIME_CHANNEL_NAME,
    state: channelState,
    isConnected: isConnectedFlag,
    listenerCount: getTotalDataListenerCount(),
    consecutiveFailures,
    sessionRetryAttempts,
    realtimeDisabledForSession,
    hasActiveChannel: activeChannel !== null,
    isHttpPollingActive: pollingTimer !== null,
  };
}

/**
 * Testler veya tam oturum sıfırlama için singleton kanalı ve polling zamanlayıcılarını hemen sıfırlar.
 */
export function resetRealtimeSingleton() {
  clearAllTimers();
  const ch = activeChannel;
  activeChannel = null;
  channelState = "IDLE";
  sessionRetryAttempts = 0;
  consecutiveFailures = 0;
  realtimeDisabledForSession = false;
  pollingInFlight = false;
  lastHttpPollIso = null;
  isConnectedFlag = false;
  for (const set of Object.values(tableListeners)) {
    set.clear();
  }
  for (const set of Object.values(broadcastListeners)) {
    set.clear();
  }
  statusListeners.clear();
  safeRemoveChannel(ch);
}
