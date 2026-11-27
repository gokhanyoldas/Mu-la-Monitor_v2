import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { I18nProvider } from "@/hooks/useTranslation";
import { UnifiedIntelligenceProvider } from "@/contexts/UnifiedIntelligenceContext";
import { AuthProvider } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { resetNewsletterSubscriptionState } from "@/hooks/useNewsletterSubscription";

const mockAuthState: {
  session: {
    access_token: string;
    user: {
      id: string;
      email: string;
      app_metadata: Record<string, unknown>;
      user_metadata: Record<string, unknown>;
    };
  } | null;
  newsletterRow: {
    id: string;
    user_id: string;
    email: string;
    subscribed: boolean;
    preferred_language: string;
    updated_at: string;
  } | null;
} = {
  session: null,
  newsletterRow: null,
};

const signOutMock = vi.fn(async () => {
  mockAuthState.session = null;
  return { error: null };
});

const upsertMock = vi.fn(async (payload: Record<string, unknown>) => {
  mockAuthState.newsletterRow = {
    id: "sub-1",
    user_id: String(payload.user_id),
    email: String(payload.email),
    subscribed: Boolean(payload.subscribed),
    preferred_language: String(payload.preferred_language ?? "tr"),
    updated_at: String(payload.updated_at ?? new Date().toISOString()),
  };
  return { data: mockAuthState.newsletterRow, error: null };
});

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseClientConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockAuthState.session },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: () => signOutMock(),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.in = vi.fn(() => chain);
      chain.gte = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.order = vi.fn(async () => ({ data: [], error: null }));
      chain.maybeSingle = vi.fn(async () => {
        if (table === "newsletter_subscribers") {
          return { data: mockAuthState.newsletterRow, error: null };
        }
        return { data: null, error: null };
      });
      chain.upsert = vi.fn((payload: Record<string, unknown>, opts?: unknown) => {
        if (table === "newsletter_subscribers") {
          return upsertMock(payload, opts);
        }
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    }),
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
  },
}));

function renderHeader() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <AccessibilityProvider>
            <I18nProvider>
              <AuthProvider>
                <UnifiedIntelligenceProvider>
                  <DashboardHeader activeTab="genel" />
                </UnifiedIntelligenceProvider>
              </AuthProvider>
            </I18nProvider>
          </AccessibilityProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("Üst Bar Hesap Durumu, Tek Tık Çıkış ve Günlük Muğla Gündem Bülteni (08:30)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetNewsletterSubscriptionState();
    mockAuthState.session = null;
    mockAuthState.newsletterRow = null;
    signOutMock.mockClear();
    upsertMock.mockClear();
  });

  it("1. Giriş yapmamış / misafir kullanıcıda üst bar hesap rozeti ve çıkış butonu görünmez", async () => {
    renderHeader();

    await waitFor(() => {
      expect(screen.getByTestId("lang-tr")).toBeTruthy();
    });

    expect(screen.queryByTestId("header-account-trigger")).toBeNull();
    expect(screen.queryByTestId("header-signout-btn")).toBeNull();
  });

  it("2. Giriş yapmış kullanıcıda sade kullanıcı rozeti ve tek tıkla Çıkış Yap / Sign Out çalışır", async () => {
    mockAuthState.session = {
      access_token: "test-token",
      user: {
        id: "user-uuid-48",
        email: "vatandas@mugla.example",
        app_metadata: { role: "user" },
        user_metadata: {},
      },
    };

    renderHeader();

    const badge = await screen.findByTestId("header-user-badge");
    expect(badge.textContent).toBe("vatandas@mugla.example");

    const signOutBtn = screen.getByTestId("header-signout-btn");
    expect(signOutBtn.textContent).toContain("Çıkış Yap");

    // EN diline geçince buton etiketi Sign Out olur
    fireEvent.click(screen.getByTestId("lang-en"));
    expect(signOutBtn.textContent).toContain("Sign Out");
    expect(signOutBtn.getAttribute("aria-label")).toBe("Sign Out");

    // Tek tıkla çıkış yap -> supabase.auth.signOut() çağrılır ve oturum UI temizlenir
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("header-account-trigger")).toBeNull();
      expect(screen.queryByTestId("header-signout-btn")).toBeNull();
    });
  });

  it("3. Günlük Muğla Gündem Bülteni (08:30) aç/kapa anahtarı Supabase'e true/false olarak kaydeder ve teknik terim içermez", async () => {
    mockAuthState.session = {
      access_token: "test-token",
      user: {
        id: "user-uuid-48",
        email: "bulten@mugla.example",
        app_metadata: { role: "user" },
        user_metadata: { full_name: "Gökhan Y." },
      },
    };

    renderHeader();

    const trigger = await screen.findByTestId("header-account-trigger");
    expect(screen.getByTestId("header-user-badge").textContent).toBe("Gökhan Y.");

    // Hesap menüsünü aç
    fireEvent.click(trigger);

    const menu = await screen.findByTestId("header-account-menu");
    expect(menu.textContent).toContain("Günlük Muğla Gündem Bülteni (08:30)");
    expect(menu.textContent).toContain("bulten@mugla.example");

    // Teknik/geliştirici jargonu içermemeli
    expect(menu.textContent).not.toMatch(/Supabase|RLS|opt-in|user_id|PostgreSQL|SQL/i);

    const toggle = screen.getByTestId("newsletter-optin-toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    // Bülteni aç -> subscribed: true
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });
    expect(upsertMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        user_id: "user-uuid-48",
        email: "bulten@mugla.example",
        subscribed: true,
        preferred_language: "tr",
      }),
      { onConflict: "user_id" }
    );
    await waitFor(() => {
      expect(toggle.getAttribute("aria-checked")).toBe("true");
    });

    // Dili EN yap ve bülteni kapat -> subscribed: false, preferred_language: "en"
    fireEvent.click(screen.getByTestId("lang-en"));
    expect(menu.textContent).toContain("Daily Muğla Briefing (08:30)");

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(2);
    });
    expect(upsertMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        user_id: "user-uuid-48",
        email: "bulten@mugla.example",
        subscribed: false,
        preferred_language: "en",
      }),
      { onConflict: "user_id" }
    );
    await waitFor(() => {
      expect(toggle.getAttribute("aria-checked")).toBe("false");
    });
  });

  it("4. SQL migration dosyası newsletter_subscribers tablosunu ve strict kullanıcı bazlı RLS kurallarını tanımlar", () => {
    const sqlPath = resolve(
      process.cwd(),
      "supabase/migrations/20261127000001_newsletter_subscribers.sql"
    );
    const sql = readFileSync(sqlPath, "utf-8");

    expect(sql).toMatch(/create table if not exists public\.newsletter_subscribers/i);
    expect(sql).toMatch(/user_id\s+uuid\s+not null\s+unique\s+references auth\.users\(id\)/i);
    expect(sql).toMatch(/email\s+text\s+not null/i);
    expect(sql).toMatch(/subscribed\s+boolean\s+not null\s+default false/i);
    expect(sql).toMatch(/preferred_language\s+text\s+not null\s+default 'tr'/i);
    expect(sql).toMatch(/updated_at\s+timestamptz\s+not null\s+default now\(\)/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.newsletter_subscribers from public, anon/i);
    expect(sql).toMatch(/using \(auth\.uid\(\) = user_id\)/i);
    expect(sql).toMatch(/with check \(auth\.uid\(\) = user_id\)/i);
  });
});
