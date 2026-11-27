import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { StrictMode, useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, act, fireEvent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SINGLETON_REALTIME_CHANNEL_NAME,
  REALTIME_RETRY_DELAY_MS,
  HTTP_FALLBACK_POLL_INTERVAL_MS,
  subscribeToRealtimeTable,
  subscribeToRealtimeStatus,
  getRealtimeSingletonSnapshot,
  resetRealtimeSingleton,
} from "@/lib/supabase-realtime-singleton";
import { useLiveData } from "@/hooks/useLiveData";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { useSupabaseRealtimeSync } from "@/hooks/useSupabaseRealtimeSync";

type StatusCallback = (status: string, err?: Error) => void;

const realtimeSpy = {
  channelCalls: [] as string[],
  subscribeCalls: 0,
  removeChannelCalls: 0,
  removeAllChannelsCalls: 0,
  callOrder: [] as string[],
  selectCalls: [] as string[],
  pollRows: [] as Array<Record<string, unknown>>,
  lastStatusCallback: null as StatusCallback | null,
  tableHandlers: new Map<string, (payload: unknown) => void>(),
};

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseClientConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => {
        realtimeSpy.selectCalls.push(table);
        return chain;
      });
      chain.eq = vi.fn(() => chain);
      chain.neq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(async () => ({
        data: table === "live_data_cache" ? realtimeSpy.pollRows : [],
        error: null,
      }));
      chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      return chain;
    }),
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
    removeAllChannels: vi.fn(async () => {
      realtimeSpy.removeAllChannelsCalls += 1;
      realtimeSpy.callOrder.push("removeAllChannels");
      return [];
    }),
    channel: vi.fn((name: string) => {
      realtimeSpy.channelCalls.push(name);
      realtimeSpy.callOrder.push(`channel:${name}`);
      const ch: Record<string, unknown> = {
        name,
        state: "closed",
      };
      ch.on = vi.fn(
        (
          type: string,
          filter: { table?: string; event?: string },
          cb: (payload: unknown) => void
        ) => {
          if (type === "postgres_changes" && filter?.table) {
            realtimeSpy.tableHandlers.set(filter.table, cb);
          }
          return ch;
        }
      );
      ch.subscribe = vi.fn((statusCb?: StatusCallback) => {
        realtimeSpy.subscribeCalls += 1;
        realtimeSpy.callOrder.push("subscribe");
        ch.state = "joining";
        realtimeSpy.lastStatusCallback = statusCb ?? null;
        return ch;
      });
      return ch;
    }),
    removeChannel: vi.fn((ch: { state?: string } | null) => {
      realtimeSpy.removeChannelCalls += 1;
      realtimeSpy.callOrder.push("removeChannel");
      if (ch) ch.state = "closed";
      return Promise.resolve("ok");
    }),
  },
}));

const MultiConsumerHarness: React.FC = () => {
  const [tick, setTick] = useState(0);
  useSupabaseRealtimeSync(true);
  useLiveData("weather", { extraBody: { tick } });
  useLiveData("air_quality", { extraBody: { tick } });
  useLiveData("dams", { extraBody: { tick } });
  useLiveData("economy", { extraBody: { tick } });
  useLiveData("traffic_density", { extraBody: { tick } });
  useRealtimeAlerts({ onCritical: () => void tick });

  return (
    <button type="button" data-testid="rerender-btn" onClick={() => setTick((t) => t + 1)}>
      tick:{tick}
    </button>
  );
};

describe("Singleton Supabase Realtime Kanalı & Kesin SocketJoinRateLimitReached Koruması", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRealtimeSingleton();
    realtimeSpy.channelCalls = [];
    realtimeSpy.subscribeCalls = 0;
    realtimeSpy.removeChannelCalls = 0;
    realtimeSpy.removeAllChannelsCalls = 0;
    realtimeSpy.callOrder = [];
    realtimeSpy.selectCalls = [];
    realtimeSpy.pollRows = [];
    realtimeSpy.lastStatusCallback = null;
    realtimeSpy.tableHandlers.clear();
  });

  afterEach(() => {
    resetRealtimeSingleton();
    vi.useRealTimers();
  });

  it("1. createClient ayarı eventsPerSecond: 2 içerir ve kanal oluşturulmadan önce supabase.removeAllChannels() çağrılır", () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), "src/integrations/supabase/client.ts"),
      "utf-8"
    );
    expect(clientSource).toMatch(/eventsPerSecond:\s*2/);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { unmount } = render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <MultiConsumerHarness />
        </QueryClientProvider>
      </StrictMode>
    );

    // Önce removeAllChannels, sonra tek bir mugla-monitor-sync kanalı, sonra tek subscribe
    expect(realtimeSpy.callOrder.slice(0, 3)).toEqual([
      "removeAllChannels",
      `channel:${SINGLETON_REALTIME_CHANNEL_NAME}`,
      "subscribe",
    ]);
    expect(realtimeSpy.channelCalls).toEqual([SINGLETON_REALTIME_CHANNEL_NAME]);
    expect(realtimeSpy.subscribeCalls).toBe(1);

    act(() => {
      realtimeSpy.lastStatusCallback?.("SUBSCRIBED");
    });
    expect(getRealtimeSingletonSnapshot().state).toBe("SUBSCRIBED");
    expect(getRealtimeSingletonSnapshot().isConnected).toBe(true);

    // State değişiklikleri yeni kanal/subscribe tetiklemez
    fireEvent.click(screen.getByTestId("rerender-btn"));
    fireEvent.click(screen.getByTestId("rerender-btn"));
    expect(realtimeSpy.channelCalls).toHaveLength(1);
    expect(realtimeSpy.subscribeCalls).toBe(1);

    // Unmount sonrası removeChannel çalışır
    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(realtimeSpy.removeChannelCalls).toBe(1);
    expect(getRealtimeSingletonSnapshot().state).toBe("IDLE");
  });

  it("2. CHANNEL_ERROR / TIMED_OUT / CLOSED anında removeChannel çağrılır, oturumda en fazla 1 kez yeniden dener ve sonra 60sn HTTP select polling moduna geçer", async () => {
    const statuses: boolean[] = [];
    const receivedUpdates: Array<Record<string, unknown>> = [];
    const unsubStatus = subscribeToRealtimeStatus((c) => statuses.push(c));
    const unsubData = subscribeToRealtimeTable("live_data_cache", (payload) => {
      if (payload.new) receivedUpdates.push(payload.new);
    });

    expect(realtimeSpy.subscribeCalls).toBe(1);

    // 1. hata (CHANNEL_ERROR) -> anında removeChannel çağrılır ve 60sn BACKOFF başlar
    act(() => {
      realtimeSpy.lastStatusCallback?.(
        "CHANNEL_ERROR",
        new Error("SocketJoinRateLimitReached: Too many joins on this socket")
      );
    });

    expect(realtimeSpy.removeChannelCalls).toBe(1);
    expect(getRealtimeSingletonSnapshot().state).toBe("BACKOFF");
    expect(statuses[statuses.length - 1]).toBe(false);

    // 4sn / 15sn / 59sn geçse de tekrar join yapılmaz
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(realtimeSpy.subscribeCalls).toBe(1);

    // 60sn dolunca oturumdaki TEK (1.) yeniden deneme yapılır
    act(() => {
      vi.advanceTimersByTime(REALTIME_RETRY_DELAY_MS - 59_000 + 100);
    });
    expect(realtimeSpy.subscribeCalls).toBe(2);

    // 2. hata (TIMED_OUT veya CLOSED) -> anında removeChannel + kalıcı 60sn HTTP polling fallback
    act(() => {
      realtimeSpy.lastStatusCallback?.("TIMED_OUT");
    });

    expect(realtimeSpy.removeChannelCalls).toBe(2);
    expect(getRealtimeSingletonSnapshot().state).toBe("FALLBACK_POLLING");
    expect(getRealtimeSingletonSnapshot().realtimeDisabledForSession).toBe(true);
    expect(getRealtimeSingletonSnapshot().isHttpPollingActive).toBe(true);

    // 60sn sonra hafif HTTP select polling veriyi çeker, WebSocket join sayısı ASLA artmaz!
    const futureIso = new Date(Date.now() + 120_000).toISOString();
    realtimeSpy.pollRows = [
      {
        data_type: "weather",
        data: { temperature: 23.5 },
        fetched_at: futureIso,
      },
    ];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HTTP_FALLBACK_POLL_INTERVAL_MS + 100);
    });

    expect(realtimeSpy.subscribeCalls).toBe(2); // Bir daha ASLA WebSocket .subscribe() yok!
    expect(realtimeSpy.selectCalls).toContain("live_data_cache");
    expect(receivedUpdates).toHaveLength(1);
    expect(receivedUpdates[0].data_type).toBe("weather");

    // 10 dakika daha geçse de WebSocket yeniden bağlanma yapmaz
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
    });
    expect(realtimeSpy.subscribeCalls).toBe(2);

    unsubData();
    unsubStatus();
  });

  it("3. CLOSED durumunda da kanalı hemen kapatıp aynı 1-deneme + HTTP polling korumasını uygular", () => {
    const unsub = subscribeToRealtimeTable("social_posts", () => {});
    expect(realtimeSpy.subscribeCalls).toBe(1);

    act(() => {
      realtimeSpy.lastStatusCallback?.("CLOSED");
    });

    expect(realtimeSpy.removeChannelCalls).toBe(1);
    expect(getRealtimeSingletonSnapshot().state).toBe("BACKOFF");

    unsub();
  });
});
