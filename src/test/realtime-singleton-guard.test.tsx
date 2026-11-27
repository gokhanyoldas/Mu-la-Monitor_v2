import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { StrictMode, useState } from "react";
import { render, act, fireEvent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  SINGLETON_REALTIME_CHANNEL_NAME,
  subscribeToRealtimeTable,
  subscribeToRealtimeStatus,
  getRealtimeSingletonSnapshot,
  resetRealtimeSingleton,
  computeBackoffDelayMs,
} from "@/lib/supabase-realtime-singleton";
import { useLiveData } from "@/hooks/useLiveData";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { useSupabaseRealtimeSync } from "@/hooks/useSupabaseRealtimeSync";

type StatusCallback = (status: string, err?: Error) => void;

const realtimeSpy = {
  channelCalls: [] as string[],
  subscribeCalls: 0,
  removeChannelCalls: 0,
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
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.neq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(async () => ({ data: [], error: null }));
      chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      return chain;
    }),
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
    channel: vi.fn((name: string) => {
      realtimeSpy.channelCalls.push(name);
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
        ch.state = "joining";
        realtimeSpy.lastStatusCallback = statusCb ?? null;
        return ch;
      });
      return ch;
    }),
    removeChannel: vi.fn((ch: { state?: string } | null) => {
      realtimeSpy.removeChannelCalls += 1;
      if (ch) ch.state = "closed";
    }),
  },
}));

const MultiConsumerHarness: React.FC = () => {
  const [tick, setTick] = useState(0);
  useSupabaseRealtimeSync(true);
  // Inline extraBody ve inline onCritical — state değişiminde kanal yeniden açılmamalı
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

describe("Singleton Supabase Realtime Kanalı & SocketJoinRateLimitReached Koruması", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRealtimeSingleton();
    realtimeSpy.channelCalls = [];
    realtimeSpy.subscribeCalls = 0;
    realtimeSpy.removeChannelCalls = 0;
    realtimeSpy.lastStatusCallback = null;
    realtimeSpy.tableHandlers.clear();
  });

  afterEach(() => {
    resetRealtimeSingleton();
    vi.useRealTimers();
  });

  it("1. StrictMode çift mount, 7 eşzamanlı hook ve state re-render'ları tek bir mugla-monitor-sync kanalı ve tek .subscribe() çağrısı yapar", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { unmount } = render(
      <StrictMode>
        <QueryClientProvider client={qc}>
          <MultiConsumerHarness />
        </QueryClientProvider>
      </StrictMode>
    );

    expect(realtimeSpy.channelCalls).toEqual([SINGLETON_REALTIME_CHANNEL_NAME]);
    expect(realtimeSpy.subscribeCalls).toBe(1);
    expect(getRealtimeSingletonSnapshot().state).toBe("JOINING");

    // SUBSCRIBED durumuna geç
    act(() => {
      realtimeSpy.lastStatusCallback?.("SUBSCRIBED");
    });
    expect(getRealtimeSingletonSnapshot().state).toBe("SUBSCRIBED");
    expect(getRealtimeSingletonSnapshot().isConnected).toBe(true);

    // State değişiklikleri ve re-render'lar yeni kanal/subscribe tetiklememeli
    fireEvent.click(screen.getByTestId("rerender-btn"));
    fireEvent.click(screen.getByTestId("rerender-btn"));
    fireEvent.click(screen.getByTestId("rerender-btn"));

    expect(realtimeSpy.channelCalls).toHaveLength(1);
    expect(realtimeSpy.subscribeCalls).toBe(1);

    // Gerçek unmount sonrası supabase.removeChannel(channel) çağrılır
    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(realtimeSpy.removeChannelCalls).toBe(1);
    expect(getRealtimeSingletonSnapshot().state).toBe("IDLE");
    expect(getRealtimeSingletonSnapshot().hasActiveChannel).toBe(false);
  });

  it("2. SocketJoinRateLimitReached hatasında 4 saniyelik döngüye girmez; kanalı hemen kapatır ve 60sn+ üstel geri çekilme + polling fallback uygular", () => {
    const statuses: boolean[] = [];
    const unsubStatus = subscribeToRealtimeStatus((c) => statuses.push(c));
    const unsubData = subscribeToRealtimeTable("live_data_cache", () => {});

    expect(realtimeSpy.subscribeCalls).toBe(1);

    // Rate-limit hatası simüle et
    act(() => {
      realtimeSpy.lastStatusCallback?.(
        "CHANNEL_ERROR",
        new Error("SocketJoinRateLimitReached: Too many joins on this socket")
      );
    });

    // Hatalı kanal hemen kaldırılmış ve durum BACKOFF olmuş olmalı
    expect(realtimeSpy.removeChannelCalls).toBe(1);
    expect(getRealtimeSingletonSnapshot().state).toBe("BACKOFF");
    expect(statuses[statuses.length - 1]).toBe(false);

    // 4 saniye, 10 saniye ve 59 saniye sonra ASLA tekrar join denememeli!
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(realtimeSpy.subscribeCalls).toBe(1);

    act(() => {
      vi.advanceTimersByTime(55_000);
    });
    expect(realtimeSpy.subscribeCalls).toBe(1);

    // 60 saniye dolunca 1 kontrollü deneme yapılır
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(realtimeSpy.subscribeCalls).toBe(2);

    // Üst üste hatalar devam ederse backoff artar ve maksimum denemeden sonra FALLBACK_POLLING'e geçip tamamen durur
    for (let attempt = 2; attempt <= 5; attempt++) {
      act(() => {
        realtimeSpy.lastStatusCallback?.(
          "CHANNEL_ERROR",
          new Error("SocketJoinRateLimitReached: Too many joins on this socket")
        );
      });
      const expectedDelay = computeBackoffDelayMs(attempt, true);
      act(() => {
        vi.advanceTimersByTime(expectedDelay + 1_000);
      });
    }

    const callsAtFallback = realtimeSpy.subscribeCalls;
    expect(getRealtimeSingletonSnapshot().state).toBe("FALLBACK_POLLING");

    // 10 dakika geçse bile artık agresif WebSocket join denemesi yapılmaz
    act(() => {
      vi.advanceTimersByTime(600_000);
    });
    expect(realtimeSpy.subscribeCalls).toBe(callsAtFallback);

    unsubData();
    unsubStatus();
  });

  it("3. Tekil kanal üzerinden gelen olaylar aynı tabloyu dinleyen tüm bileşenlere eksiksiz iletilir", () => {
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];

    const unsubA = subscribeToRealtimeTable("social_posts", (p) => receivedA.push(p.new));
    const unsubB = subscribeToRealtimeTable("social_posts", (p) => receivedB.push(p.new));

    expect(realtimeSpy.subscribeCalls).toBe(1);

    const handler = realtimeSpy.tableHandlers.get("social_posts");
    expect(handler).toBeTruthy();

    handler!({ eventType: "INSERT", new: { id: "post-48", content: "Muğla canlı test" } });

    expect(receivedA).toEqual([{ id: "post-48", content: "Muğla canlı test" }]);
    expect(receivedB).toEqual([{ id: "post-48", content: "Muğla canlı test" }]);

    unsubA();
    // Hâlâ 1 aktif dinleyici olduğu için kanal kapatılmaz
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(realtimeSpy.removeChannelCalls).toBe(0);

    // Son dinleyici de ayrılınca kanal temizlenir
    unsubB();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(realtimeSpy.removeChannelCalls).toBe(1);
  });
});
