import { describe, it, expect, vi, afterEach } from "vitest";
import { ENV, getGeminiApiKey, getAppUrl, resolveEnv, getRuntimeEnvSummary, validateEnvAndWarn } from "@/config/env";

describe("Merkezi ENV Yapılandırması (Vite + Vercel + AI Studio)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("VITE_GEMINI_API_KEY tanımlıysa ENV üzerinden öncelikli olarak okur", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "vite-key-123");
    vi.stubEnv("GEMINI_API_KEY", "ai-studio-key-456");

    expect(ENV.VITE_GEMINI_API_KEY).toBe("vite-key-123");
    expect(getGeminiApiKey()).toBe("vite-key-123");
  });

  it("VITE_GEMINI_API_KEY yoksa AI Studio process.env.GEMINI_API_KEY değişkenine düşer", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "ai-studio-key-456");

    expect(ENV.VITE_GEMINI_API_KEY).toBe("ai-studio-key-456");
    expect(getGeminiApiKey()).toBe("ai-studio-key-456");
  });

  it("VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY ve VITE_TOMTOM_API_KEY değerlerini okur", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-xyz");
    vi.stubEnv("VITE_TOMTOM_API_KEY", "tomtom-key-789");

    expect(ENV.VITE_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(ENV.VITE_SUPABASE_ANON_KEY).toBe("anon-key-xyz");
    expect(ENV.VITE_TOMTOM_API_KEY).toBe("tomtom-key-789");
  });

  it("APP_URL ve VITE_APP_URL değişkenlerini birleştirir", () => {
    vi.stubEnv("VITE_APP_URL", "");
    vi.stubEnv("APP_URL", "https://mugla-monitor.vercel.app");

    expect(ENV.VITE_APP_URL).toBe("https://mugla-monitor.vercel.app");
    expect(getAppUrl()).toBe("https://mugla-monitor.vercel.app");
  });

  it("eksik anahtarlarda çökmez, güvenli fallback ve açıklayıcı uyarılar üretir", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("VITE_TOMTOM_API_KEY", "");
    vi.stubEnv("TOMTOM_API_KEY", "");

    const warnings = validateEnvAndWarn();
    expect(warnings.length).toBe(3);
    expect(ENV.VITE_SUPABASE_URL).toBe("");
    expect(ENV.VITE_GEMINI_API_KEY).toBe("");
    expect(ENV.VITE_TOMTOM_API_KEY).toBe("");
  });

  it("boşlukları temizler ve çalışma zamanı özetini güvenli döndürür", () => {
    vi.stubEnv("VITE_TEST_CUSTOM", "  hello-env  ");
    expect(resolveEnv("VITE_TEST_CUSTOM")).toBe("hello-env");
    expect(resolveEnv("VITE_NON_EXISTENT_KEY")).toBe("");

    const summary = getRuntimeEnvSummary();
    expect(summary).toHaveProperty("appVersion");
    expect(summary).toHaveProperty("hasGeminiKey");
    expect(summary).toHaveProperty("hasSupabaseKey");
    expect(summary).toHaveProperty("hasTomTomKey");
  });
});
