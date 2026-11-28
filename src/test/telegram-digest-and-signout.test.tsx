import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  verifyDigestAuth,
  sendDailyTelegramDigest,
  buildDailyDigestHtml,
  escapeTelegramHtml,
  resetTelegramDigestMemoryGuard,
} from "../../api/telegram/send-digest";
import {
  sendDailyTelegramDigestFromAgent,
  buildAgentTelegramDigestHtml,
} from "../../scripts/run-autonomous-agent.mjs";
import { DashboardHeader, resolveTelegramChannelUrl } from "@/components/dashboard/DashboardHeader";

const mockAuthState = vi.hoisted(() => ({
  user: null as { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    session: mockAuthState.user ? { user: mockAuthState.user } : null,
    isAuthenticated: Boolean(mockAuthState.user),
    isAdmin: false,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: mockAuthState.signOut,
  }),
}));

vi.mock("@/hooks/useNewsletterSubscription", () => ({
  useNewsletterSubscription: () => ({
    subscribed: false,
    isLoading: false,
    isSaving: false,
    errorMessage: null,
    toggleSubscription: vi.fn().mockResolvedValue(true),
  }),
  resetNewsletterSubscriptionState: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    lang: "tr",
    setLang: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/dashboard/AlertPanel", () => ({
  AlertPanel: () => null,
}));

vi.mock("@/components/dashboard/AccessibilityToolbar", () => ({
  AccessibilityToolbar: () => null,
}));

vi.mock("@/components/LanguageSwitcher", () => ({
  LanguageSwitcher: () => null,
}));

vi.mock("@/components/NotificationBell", () => ({
  NotificationBell: () => null,
}));

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Telegram Günlük Bülten API (api/telegram/send-digest.ts)", () => {
  beforeEach(() => {
    resetTelegramDigestMemoryGuard();
  });

  it("Bearer doğrulaması gizli anahtar yoksa 503 fail-closed döner ve yalnızca geçerli TELEGRAM_DIGEST_SECRET / CRON_SECRET kabul eder", () => {
    expect(verifyDigestAuth("Bearer anything", {})).toMatchObject({
      authorized: false,
      statusCode: 503,
    });

    const env = {
      TELEGRAM_DIGEST_SECRET: "digest-secret-123",
      CRON_SECRET: "cron-secret-456",
    };

    expect(verifyDigestAuth(undefined, env)).toMatchObject({
      authorized: false,
      statusCode: 401,
    });
    expect(verifyDigestAuth("Basic abc", env)).toMatchObject({
      authorized: false,
      statusCode: 401,
    });
    expect(verifyDigestAuth("Bearer wrong-secret", env)).toMatchObject({
      authorized: false,
      statusCode: 403,
    });
    expect(verifyDigestAuth("Bearer digest-secret-123", env)).toMatchObject({
      authorized: true,
      statusCode: 200,
    });
    expect(verifyDigestAuth("Bearer cron-secret-456", env)).toMatchObject({
      authorized: true,
      statusCode: 200,
    });
  });

  it("HTML özel karakterlerini kaçışlar ve summary/content şema varyantlarını okur", () => {
    expect(escapeTelegramHtml(`<script>alert("x&y")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;"
    );

    const html = buildDailyDigestHtml({
      dateHeader: "28 Kasım 2026 Cumartesi",
      aiSummaries: [{ type: "daily", summary: "Muğla geneli <sakin> & istikrarlı seyrediyor." }],
      alerts: [{ severity: "high", title: "Bodrum <Su> Kesintisi", body: "Bakım çalışması & hat yenileme." }],
      monitorData: [{ category: "cevre", district_name: "Menteşe", content: "Hava kalitesi 42 AQI" }],
      protocolMembers: [{ isim: "Dr. İdris Akbıyık", unvan: "Muğla Valisi" }],
      siteUrl: "https://muglamonitor.example.com",
    });

    expect(html).not.toContain("<sakin>");
    expect(html).toContain("&lt;sakin&gt; &amp; istikrarlı");
    expect(html).toContain("Bodrum &lt;Su&gt; Kesintisi");
    expect(html).toContain("Dr. İdris Akbıyık");
    expect(html).toContain("https://muglamonitor.example.com");
  });

  it("Supabase tablolarından günlük özeti derler, Telegram'a HTML olarak gönderir ve aynı gün ikinci çağrıyı engeller", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    let cachedDate: string | null = null;

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      const bodyStr = typeof init?.body === "string" ? init.body : undefined;
      calls.push({ url, method, body: bodyStr });

      if (url.includes("/rest/v1/live_data_cache") && method === "GET") {
        return makeJsonResponse(cachedDate ? [{ data: { date: cachedDate } }] : []);
      }
      if (url.includes("/rest/v1/live_data_cache") && method === "POST") {
        const parsed = bodyStr ? JSON.parse(bodyStr) : null;
        cachedDate = parsed?.data?.date ?? null;
        return makeJsonResponse([], 201);
      }
      if (url.includes("/rest/v1/monitor_data")) {
        return makeJsonResponse([
          { category: "cevre", district_name: "Bodrum", content: "Baraj doluluğu %54" },
        ]);
      }
      if (url.includes("/rest/v1/alert_events")) {
        return makeJsonResponse([
          { severity: "high", title: "Rüzgar Uyarısı", body: "Datça açıklarında fırtına" },
        ]);
      }
      if (url.includes("/rest/v1/protocol_members")) {
        return makeJsonResponse([
          { isim: "Dr. İdris Akbıyık", unvan: "Muğla Valisi" },
        ]);
      }
      if (url.includes("/rest/v1/ai_summaries")) {
        return makeJsonResponse([
          { type: "daily", summary: "Muğla genelinde ulaşım akıcı, enerji kesintisi yok." },
        ]);
      }
      if (url.includes("api.telegram.org/bot")) {
        return makeJsonResponse({ ok: true, result: { message_id: 901 } });
      }
      return makeJsonResponse([]);
    }) as unknown as typeof fetch;

    const env = {
      TELEGRAM_BOT_TOKEN: "test-bot-token",
      TELEGRAM_CHAT_ID: "@muglamonitor",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      PUBLIC_APP_URL: "https://muglamonitor.vercel.app",
    };

    const fixedNow = new Date("2026-11-28T07:00:00Z");
    const first = await sendDailyTelegramDigest({
      env,
      fetchImpl: mockFetch,
      now: fixedNow,
    });

    expect(first.ok).toBe(true);
    expect(first.skipped).toBe(false);
    expect(first.messageId).toBe(901);

    const telegramCalls = calls.filter((c) => c.url.includes("api.telegram.org/bot"));
    expect(telegramCalls).toHaveLength(1);
    const sentPayload = JSON.parse(telegramCalls[0].body || "{}");
    expect(sentPayload.chat_id).toBe("@muglamonitor");
    expect(sentPayload.parse_mode).toBe("HTML");
    expect(sentPayload.disable_web_page_preview).toBe(true);
    expect(sentPayload.text).toContain("Muğla genelinde ulaşım akıcı");
    expect(sentPayload.text).toContain("Rüzgar Uyarısı");
    expect(sentPayload.text).toContain("https://muglamonitor.vercel.app");

    // Aynı gün içinde ikinci çağrı: bellek + Supabase cache nedeniyle tekrar göndermemeli
    resetTelegramDigestMemoryGuard();
    const second = await sendDailyTelegramDigest({
      env,
      fetchImpl: mockFetch,
      now: fixedNow,
    });
    expect(second.ok).toBe(true);
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe("already_sent_today");
    expect(calls.filter((c) => c.url.includes("api.telegram.org/bot"))).toHaveLength(1);
  });
});

describe("Otonom Ajan Telegram Bülten Entegrasyonu (scripts/run-autonomous-agent.mjs)", () => {
  it("TELEGRAM_BOT_TOKEN/CHAT_ID yoksa sessizce atlar ve uyarı üretmez", async () => {
    const warnings: string[] = [];
    const result = await sendDailyTelegramDigestFromAgent({
      supabase: { select: vi.fn(), upsert: vi.fn() },
      env: {},
      recordWarning: (step: string) => warnings.push(step),
    });

    expect(result.attempted).toBe(false);
    expect(result.skipped).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it("Telegram API hata verdiğinde ajanı çökertmez, token sızdırmadan uyarı kaydeder", async () => {
    const warnings: { step: string; detail: string }[] = [];
    const secretToken = "99999:SUPER_SECRET_BOT_TOKEN";

    const mockSupabase = {
      select: vi.fn(async (table: string) => {
        if (table === "live_data_cache") return { data: [] };
        return { data: [] };
      }),
      upsert: vi.fn(async () => ({ error: null })),
    };

    const failingFetch = vi.fn(async () =>
      makeJsonResponse({ ok: false, description: `Unauthorized for ${secretToken}` }, 401)
    ) as unknown as typeof fetch;

    const htmlPreview = buildAgentTelegramDigestHtml({
      now: new Date("2026-11-28T07:00:00Z"),
      aiSummaries: [{ summary: "Muğla özeti hazır." }],
    });
    expect(htmlPreview).toContain("MUĞLA GÜNLÜK ŞEHİR BÜLTENİ");

    const result = await sendDailyTelegramDigestFromAgent({
      supabase: mockSupabase,
      env: {
        TELEGRAM_BOT_TOKEN: secretToken,
        TELEGRAM_CHAT_ID: "@muglamonitor",
      },
      fetchImpl: failingFetch,
      now: new Date("2026-11-28T07:00:00Z"),
      recordWarning: (step: string, detail: string) => warnings.push({ step, detail }),
    });

    expect(result.attempted).toBe(true);
    expect(result.sent).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).not.toContain(secretToken);
    expect(warnings[0].detail).toContain("[REDACTED]");
  });

  it("Aynı gün zaten gönderildiyse Telegram'a tekrar istek atmaz", async () => {
    const fetchSpy = vi.fn();
    const mockSupabase = {
      select: vi.fn(async (table: string) => {
        if (table === "live_data_cache") {
          return { data: [{ data: { date: "2026-11-28" } }] };
        }
        return { data: [] };
      }),
      upsert: vi.fn(),
    };

    const result = await sendDailyTelegramDigestFromAgent({
      supabase: mockSupabase,
      env: {
        TELEGRAM_BOT_TOKEN: "valid-token",
        TELEGRAM_CHAT_ID: "@muglamonitor",
      },
      fetchImpl: fetchSpy as unknown as typeof fetch,
      now: new Date("2026-11-28T09:00:00Z"),
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("already_sent_today");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Üst Bar Çıkış Yap & Telegram Bülteni Bağlantısı", () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.signOut.mockClear();
  });

  it("resolveTelegramChannelUrl yalnızca http/https adreslerini kabul eder, zararlı şemaları engeller", () => {
    expect(resolveTelegramChannelUrl("")).toBe("https://t.me/muglamonitor");
    expect(resolveTelegramChannelUrl("javascript:alert(1)")).toBe("https://t.me/muglamonitor");
    expect(resolveTelegramChannelUrl("https://t.me/ozelkanal")).toBe("https://t.me/ozelkanal");
  });

  it("Giriş yapmış kullanıcı üst barda Çıkış Yap butonunu ve Telegram Bülteni bağlantısını görür", () => {
    mockAuthState.user = { id: "u-1", email: "yonetici@mugla.gov.tr" };

    render(
      <MemoryRouter>
        <DashboardHeader activeTab="genel" />
      </MemoryRouter>
    );

    const signOutBtn = screen.getByTestId("header-signout-btn");
    expect(signOutBtn).toBeInTheDocument();
    expect(signOutBtn.textContent).toContain("Çıkış Yap");

    fireEvent.click(signOutBtn);
    expect(mockAuthState.signOut).toHaveBeenCalledTimes(1);

    const tgLink = screen.getByTestId("header-telegram-link");
    expect(tgLink).toBeInTheDocument();
    expect(tgLink).toHaveAttribute("href", "https://t.me/muglamonitor");
    expect(tgLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("Giriş yapmamış misafir kullanıcıda Çıkış Yap butonu gizlidir, Telegram Bülteni görünür", () => {
    mockAuthState.user = null;

    render(
      <MemoryRouter>
        <DashboardHeader activeTab="genel" />
      </MemoryRouter>
    );

    expect(screen.queryByTestId("header-signout-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("header-telegram-link")).toBeInTheDocument();
  });
});
