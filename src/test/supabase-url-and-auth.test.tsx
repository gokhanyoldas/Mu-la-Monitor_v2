import { describe, it, expect, vi, afterEach } from "vitest";
import { ENV, normalizeSupabaseUrl } from "@/config/env";
import {
  AUTH_CONFIG_FALLBACK_MESSAGE,
  formatAuthErrorMessage,
  getSafeEmailRedirectOrigin,
} from "@/lib/supabase-auth-utils";
import { checkSupabaseConfigured, getSupabaseClient } from "@/services/supabaseService";

describe("normalizeSupabaseUrl & Supabase Auth Güvenliği", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("baş/son boşlukları, tek/çift/kıvrık tırnakları, KEY=VALUE önekini ve sondaki slash karakterlerini temizler", () => {
    expect(normalizeSupabaseUrl('  "https://wivooargsmcwbiokpklu.supabase.co/"  ')).toBe(
      "https://wivooargsmcwbiokpklu.supabase.co"
    );
    expect(normalizeSupabaseUrl(" 'https://wivooargsmcwbiokpklu.supabase.co///' ")).toBe(
      "https://wivooargsmcwbiokpklu.supabase.co"
    );
    expect(normalizeSupabaseUrl('\\"https://wivooargsmcwbiokpklu.supabase.co/\\"')).toBe(
      "https://wivooargsmcwbiokpklu.supabase.co"
    );
    expect(normalizeSupabaseUrl("VITE_SUPABASE_URL=https://wivooargsmcwbiokpklu.supabase.co/")).toBe(
      "https://wivooargsmcwbiokpklu.supabase.co"
    );
    expect(normalizeSupabaseUrl("%22https://wivooargsmcwbiokpklu.supabase.co/%22")).toBe(
      "https://wivooargsmcwbiokpklu.supabase.co"
    );
  });

  it("Supabase Dashboard URL formatını otomatik olarak https://<PROJECT_REF>.supabase.co adresine dönüştürür", () => {
    expect(
      normalizeSupabaseUrl("https://supabase.com/dashboard/project/wivooargsmcwbiokpklu")
    ).toBe("https://wivooargsmcwbiokpklu.supabase.co");

    expect(
      normalizeSupabaseUrl(
        "https://supabase.com/dashboard/project/wivooargsmcwbiokpklu/settings/api?tab=keys"
      )
    ).toBe("https://wivooargsmcwbiokpklu.supabase.co");

    expect(
      normalizeSupabaseUrl("https://app.supabase.com/project/WivooArgSMcwbiokpklu/auth/users")
    ).toBe("https://wivooargsmcwbiokpklu.supabase.co");
  });

  it("sonundaki /rest/v1, /auth/v1 gibi alt yolları kaldırıp temiz origin bırakır", () => {
    expect(normalizeSupabaseUrl("https://xyz123.supabase.co/rest/v1")).toBe(
      "https://xyz123.supabase.co"
    );
    expect(normalizeSupabaseUrl("https://xyz123.supabase.co/auth/v1/signup")).toBe(
      "https://xyz123.supabase.co"
    );
    expect(normalizeSupabaseUrl("https://xyz123.supabase.co/storage/v1/?foo=bar#hash")).toBe(
      "https://xyz123.supabase.co"
    );
  });

  it("geçersiz veya boş adreslerde boş string döndürür ve bozuk URL ile createClient çağırmaz", () => {
    expect(normalizeSupabaseUrl("")).toBe("");
    expect(normalizeSupabaseUrl("   ")).toBe("");
    expect(normalizeSupabaseUrl("not-a-valid-url")).toBe("");
    expect(normalizeSupabaseUrl("ftp://xyz.supabase.co")).toBe("");
    expect(normalizeSupabaseUrl("https://supabase.com/dashboard")).toBe("");
    expect(normalizeSupabaseUrl("https://just-a-hostname")).toBe("");

    vi.stubEnv("VITE_SUPABASE_URL", "https://supabase.com/dashboard");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

    expect(ENV.VITE_SUPABASE_URL).toBe("");
    expect(checkSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it("ENV.VITE_SUPABASE_URL üzerinden bozuk girilmiş ortam değişkenlerini otomatik normalize eder", () => {
    vi.stubEnv(
      "VITE_SUPABASE_URL",
      '  "https://supabase.com/dashboard/project/wivooargsmcwbiokpklu/editor"  '
    );
    expect(ENV.VITE_SUPABASE_URL).toBe("https://wivooargsmcwbiokpklu.supabase.co");

    expect(
      normalizeSupabaseUrl('  "VITE_SUPABASE_URL=http://wivooargsmcwbiokpklu.supabase.co/rest/v1/"  ')
    ).toBe("https://wivooargsmcwbiokpklu.supabase.co");
    expect(
      normalizeSupabaseUrl("  'https://wivooargsmcwbiokpklu.supabase.co/auth/v1/'  ")
    ).toBe("https://wivooargsmcwbiokpklu.supabase.co");
    expect(normalizeSupabaseUrl("wivooargsmcwbiokpklu.supabase.co/rest/v1")).toBe(
      "https://wivooargsmcwbiokpklu.supabase.co"
    );
  });

  it("yalnızca VITE_SUPABASE_PUBLISHABLE_KEY ve tırnaklı /rest/v1 URL ile Supabase istemcisi sorunsuz başlar", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", '  "https://proj123.supabase.co/rest/v1/"  ');
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", ' "sb_publishable_vercel_auto" ');

    expect(checkSupabaseConfigured()).toBe(true);
    const serviceClient = getSupabaseClient();
    expect(serviceClient).not.toBeNull();

    vi.resetModules();
    const clientMod = await import("@/integrations/supabase/client");
    expect(clientMod.isSupabaseClientConfigured).toBe(true);
    expect((clientMod.supabase as unknown as { supabaseUrl?: string }).supabaseUrl).toBe(
      "https://proj123.supabase.co"
    );
    expect((clientMod.supabase as unknown as { supabaseKey?: string }).supabaseKey).toBe(
      "sb_publishable_vercel_auto"
    );
  });

  it("emailRedirectTo için yalnızca temiz origin üretir ve alt yolları atar", () => {
    expect(getSafeEmailRedirectOrigin("https://mugla-monitor.vercel.app/auth/callback?x=1")).toBe(
      "https://mugla-monitor.vercel.app"
    );
    expect(getSafeEmailRedirectOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(getSafeEmailRedirectOrigin("null")).toBeUndefined();
    expect(getSafeEmailRedirectOrigin("javascript:alert(1)")).toBeUndefined();
  });

  it("Invalid path specified in request URL ve bağlantı hatalarını anlaşılır Türkçe mesaja çevirir", () => {
    expect(formatAuthErrorMessage(new Error("Invalid path specified in request URL"))).toBe(
      AUTH_CONFIG_FALLBACK_MESSAGE
    );
    expect(formatAuthErrorMessage({ message: "Failed to fetch" })).toBe(
      AUTH_CONFIG_FALLBACK_MESSAGE
    );
    expect(formatAuthErrorMessage({ message: "Invalid login credentials" })).toBe(
      "E-posta veya şifre hatalı"
    );
    expect(formatAuthErrorMessage({ message: "User already registered" })).toBe(
      "User already registered"
    );
  });

  it("AuthPage kayıt çağrısında yalnızca temiz window.location.origin emailRedirectTo gönderir ve URL hatasında Türkçe uyarı gösterir", async () => {
    const signUpMock = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid path specified in request URL" },
    });
    const toastMock = vi.fn();

    vi.resetModules();
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        auth: {
          signUp: signUpMock,
          signInWithPassword: vi.fn(),
        },
      },
      isSupabaseClientConfigured: true,
    }));
    vi.doMock("@/hooks/use-toast", () => ({
      useToast: () => ({ toast: toastMock }),
    }));

    try {
      const React = await import("react");
      const { render, screen, fireEvent, waitFor } = await import("@testing-library/react");
      const { AuthPage } = await import("@/components/auth/AuthPage");

      render(React.createElement(AuthPage, { onAuth: vi.fn() }));

      fireEvent.click(screen.getByRole("button", { name: "KAYIT OL" }));
      fireEvent.change(screen.getByPlaceholderText("ornek@email.com"), {
        target: { value: "  kullanici@mugla.gov.tr  " },
      });
      fireEvent.change(screen.getByPlaceholderText("••••••••"), {
        target: { value: "guvenli123" },
      });

      const submitButtons = screen.getAllByRole("button", { name: "KAYIT OL" });
      fireEvent.submit(submitButtons[submitButtons.length - 1].closest("form")!);

      await waitFor(() => {
        expect(signUpMock).toHaveBeenCalledTimes(1);
      });

      expect(signUpMock).toHaveBeenCalledWith({
        email: "kullanici@mugla.gov.tr",
        password: "guvenli123",
        options: { emailRedirectTo: window.location.origin },
      });

      await waitFor(() => {
        expect(toastMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Hata",
            description: AUTH_CONFIG_FALLBACK_MESSAGE,
            variant: "destructive",
          })
        );
      });
    } finally {
      vi.doUnmock("@/integrations/supabase/client");
      vi.doUnmock("@/hooks/use-toast");
    }
  });

  it("başka bir Supabase projesine ait JWT anahtarını eler ve URL ile eşleşen anahtarı otomatik seçer", () => {
    const makeFakeJwt = (ref: string) => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ iss: "supabase", ref, role: "anon" })).toString("base64url");
      return `${header}.${payload}.signature`;
    };

    const wrongProjectJwt = makeFakeJwt("wrongproj999");
    const rightProjectJwt = makeFakeJwt("targetproj123");

    // ANON_KEY başka projeye aitse otomatik olarak URL ile eşleşen PUBLISHABLE_KEY seçilir
    vi.stubEnv("VITE_SUPABASE_URL", "https://targetproj123.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", wrongProjectJwt);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", rightProjectJwt);

    expect(ENV.VITE_SUPABASE_ANON_KEY).toBe(rightProjectJwt);
    expect(checkSupabaseConfigured()).toBe(true);

    // Yalnızca yanlış projeye ait JWT varsa istemci yapılandırılmamış kabul edilir
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(ENV.VITE_SUPABASE_ANON_KEY).toBe("");
    expect(checkSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it("KeywordManager Invalid API key hatasında console.error fırlatmadan yerel sözlüğe düşer ve devre kesiciyi açar", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const orderMock = vi.fn();
    orderMock
      .mockReturnValueOnce({ order: orderMock })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Invalid API key",
          hint: "Double check the provided API key for typos. This API key might also be owned by another Supabase project.",
        },
      });

    vi.resetModules();
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        from: () => ({
          select: () => ({ order: orderMock }),
        }),
      },
      isSupabaseClientConfigured: true,
    }));
    vi.doMock("@/hooks/useAuth", () => ({
      useAuth: () => ({ canManageData: false }),
    }));
    vi.doMock("@/hooks/use-toast", () => ({
      useToast: () => ({ toast: vi.fn() }),
    }));

    const {
      resetSupabaseRuntimeGuard,
      isSupabaseRuntimeAvailable,
    } = await import("@/lib/supabase-runtime-guard");
    resetSupabaseRuntimeGuard();

    try {
      const React = await import("react");
      const { render, waitFor } = await import("@testing-library/react");
      const { KeywordManager } = await import("@/components/social/KeywordManager");
      const onKeywordsChange = vi.fn();

      render(React.createElement(KeywordManager, { onKeywordsChange }));

      await waitFor(() => {
        expect(onKeywordsChange).toHaveBeenCalled();
      });

      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(onKeywordsChange.mock.calls[0][0].length).toBeGreaterThan(0);
      expect(isSupabaseRuntimeAvailable(true)).toBe(false);
    } finally {
      resetSupabaseRuntimeGuard();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      vi.doUnmock("@/integrations/supabase/client");
      vi.doUnmock("@/hooks/useAuth");
      vi.doUnmock("@/hooks/use-toast");
    }
  });
});
