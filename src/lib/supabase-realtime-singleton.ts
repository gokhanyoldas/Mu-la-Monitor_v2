// src/lib/supabase-realtime-singleton.ts
// Merkezi Singleton Supabase Realtime Kanal Yöneticisi
// Tüm uygulama tek bir `mugla-monitor-sync` kanalı üzerinden çalışır.
// Çoklu kanal açılmasını, StrictMode çift mount fırtınalarını ve
// `SocketJoinRateLimitReached: Too many joins on this socket` 4 saniyelik
// yeniden bağlanma döngüsünü tamamen önler.

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

const MAX_RETRIES = 4;
const BASE_ERROR_BACKOFF_MS = 15_000; // Asla 4 saniyelik agresif döngüye girmez
const BASE_RATE_LIMIT_BACKOFF_MS = 60_000; // Rate-limit durumunda en az 60sn geri çekilme
const MAX_BACKOFF_MS = 300_000; // Üst sınır 5 dk

function getTeardownGraceMs(): number {
  const isTestEnv =
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: { MODE?: string } }).env?.MODE === "test";
  // React 18 StrictMode mount -> unmount -> remount döngüsü aynı tick içinde tamamlanır.
  // Kısa bekleme süresi StrictMode çift mount'ta gereksiz leave/join'i engeller,
  // gerçek unmount sonrasında ise `supabase.removeChannel(channel)` temizliğini garanti eder.
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
let consecutiveFailures = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;
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

function clearTimers() {
  if (backoffTimer !== null) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
}

function safeRemoveChannel(channel: RealtimeChannel | null) {
  if (!channel) return;
  try {
    if (typeof supabase?.removeChannel === "function") {
      supabase.removeChannel(channel);
    }
  } catch {
    // Temizleme hatasını sessizce yut
  }
}

function isRateLimitError(err: unknown): boolean {
  const text = String(
    (err as { message?: string } | null)?.message ?? err ?? ""
  ).toLowerCase();
  return (
    text.includes("socketjoinratelimitreached") ||
    text.includes("too many joins") ||
    text.includes("rate limit") ||
    text.includes("429")
  );
}

export function computeBackoffDelayMs(attempt: number, rateLimited: boolean): number {
  const safeAttempt = Math.max(1, attempt);
  const base = rateLimited ? BASE_RATE_LIMIT_BACKOFF_MS : BASE_ERROR_BACKOFF_MS;
  return Math.min(base * 2 ** (safeAttempt - 1), MAX_BACKOFF_MS);
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

function scheduleSafeReconnect(err: unknown) {
  if (getTotalDataListenerCount() === 0) {
    channelState = "IDLE";
    return;
  }

  consecutiveFailures += 1;

  // Maksimum deneme aşıldıysa WebSocket rejoin döngüsünü tamamen durdur;
  // uygulama mevcut periyodik sorgu (polling) katmanıyla sessizce devam eder.
  if (consecutiveFailures > MAX_RETRIES) {
    channelState = "FALLBACK_POLLING";
    return;
  }

  const rateLimited = isRateLimitError(err);
  const delayMs = computeBackoffDelayMs(consecutiveFailures, rateLimited);
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
    // Sekme arka plandaysa görünür olana kadar beklemek yerine bir sonraki adıma ertele
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      channelState = "FALLBACK_POLLING";
      return;
    }
    channelState = "IDLE";
    ensureChannelConnected();
  }, delayMs);
}

function ensureChannelConnected() {
  if (!isSupabaseClientConfigured) return;
  if (typeof supabase?.channel !== "function") return;
  if (getTotalDataListenerCount() === 0) return;

  // Singleton guard: kanal zaten JOINING, SUBSCRIBED, BACKOFF veya FALLBACK_POLLING ise tekrar .subscribe() çağırma
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

  // Bekleyen bir kapatma zamanlayıcısı varsa iptal et
  if (teardownTimer !== null) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }

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
      .subscribe((status, err) => {
        // Eski / değiştirilmiş kanaldan gelen geç geri çağrıları yoksay
        if (activeChannel !== channel) return;

        if (status === "SUBSCRIBED") {
          channelState = "SUBSCRIBED";
          consecutiveFailures = 0;
          notifyStatus(true);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // Phoenix'in 4 saniyelik yerleşik yeniden katılma döngüsünü durdurmak için kanalı hemen kaldır
          activeChannel = null;
          safeRemoveChannel(channel);
          notifyStatus(false);
          scheduleSafeReconnect(err);
        }
      });
  } catch (err) {
    activeChannel = null;
    safeRemoveChannel(channel);
    notifyStatus(false);
    scheduleSafeReconnect(err);
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

    if (backoffTimer !== null) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }

    const ch = activeChannel;
    activeChannel = null;
    channelState = "IDLE";
    consecutiveFailures = 0;
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
    hasActiveChannel: activeChannel !== null,
  };
}

/**
 * Testler veya tam oturum sıfırlama için singleton kanalı hemen kapatır ve tüm dinleyicileri temizler.
 */
export function resetRealtimeSingleton() {
  clearTimers();
  const ch = activeChannel;
  activeChannel = null;
  channelState = "IDLE";
  consecutiveFailures = 0;
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
