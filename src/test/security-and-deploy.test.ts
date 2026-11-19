import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveViteBase, assertProductionEnv } from "@/config/deploy";
// @ts-expect-error ESM script without .d.ts
import { verifyBuildAssets } from "../../scripts/verify-build-assets.mjs";

const ROOT = path.resolve(__dirname, "../..");

function walkFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

describe("1. Vite Base, Vercel SPA Rewrite & Asset Path Verification", () => {
  it("resolveViteBase returns '/' for Vercel & local dev, and '/Mu-la-Monitor_v2/' only for GitHub Pages", () => {
    expect(resolveViteBase({})).toBe("/");
    expect(resolveViteBase({ VERCEL: "1" })).toBe("/");
    expect(resolveViteBase({ DEPLOY_TARGET: "vercel" })).toBe("/");
    expect(resolveViteBase({ DEPLOY_TARGET: "gh-pages" })).toBe("/Mu-la-Monitor_v2/");
    expect(resolveViteBase({ DEPLOY_TARGET: "github-pages" })).toBe("/Mu-la-Monitor_v2/");
    expect(resolveViteBase({ GITHUB_PAGES: "true" })).toBe("/Mu-la-Monitor_v2/");
  });

  it("assertProductionEnv throws cleanly when VITE_SUPABASE_URL or anon key is missing in production build", () => {
    expect(() =>
      assertProductionEnv("build", "production", { CI: "true" })
    ).toThrow(/VITE_SUPABASE_URL/);

    expect(() =>
      assertProductionEnv("build", "production", {
        VERCEL: "1",
        VITE_SUPABASE_URL: "https://example.supabase.co",
      })
    ).toThrow(/VITE_SUPABASE_ANON_KEY/);

    expect(() =>
      assertProductionEnv("build", "production", {
        CI: "true",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_ANON_KEY: "sb_publishable_test_key",
      })
    ).not.toThrow();

    expect(() =>
      assertProductionEnv("serve", "development", {})
    ).not.toThrow();
  });

  it("vercel.json excludes /assets/* and static files from SPA index.html rewrite", () => {
    const vercelJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")
    );
    expect(vercelJson.rewrites?.length).toBeGreaterThan(0);
    const sourcePattern: string = vercelJson.rewrites[0].source;
    // Express/Vercel style regex check: convert `/(.*)` negative lookahead
    const regexBody = sourcePattern.replace(/^\//, "");
    const re = new RegExp(`^/${regexBody}$`);

    // SPA routes MUST match rewrite -> /index.html
    expect(re.test("/")).toBe(true);
    expect(re.test("/sosyal-istihbarat")).toBe(true);
    expect(re.test("/ilce/bodrum")).toBe(true);
    expect(re.test("/osint")).toBe(true);

    // Static assets MUST NOT match rewrite -> prevent returning HTML MIME for JS/CSS
    expect(re.test("/assets/index-Abc123.js")).toBe(false);
    expect(re.test("/assets/index-Abc123.css")).toBe(false);
    expect(re.test("/images/mugla.png")).toBe(false);
    expect(re.test("/favicon.ico")).toBe(false);
    expect(re.test("/robots.txt")).toBe(false);
  });

  it("verifyBuildAssets validates '/' and '/Mu-la-Monitor_v2/' asset prefixes and rejects mismatched or missing assets", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mugla-assets-"));
    try {
      const assetsDir = path.join(tmpDir, "assets");
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(assetsDir, "main.js"), "console.log('ok');");
      fs.writeFileSync(path.join(assetsDir, "main.css"), "body{}");

      // Valid Vercel root build
      fs.writeFileSync(
        path.join(tmpDir, "index.html"),
        `<html><head><link rel="stylesheet" href="/assets/main.css"></head><body><script type="module" src="/assets/main.js"></script></body></html>`
      );
      expect(verifyBuildAssets({ distDir: tmpDir, expectedBase: "/" }).ok).toBe(true);
      expect(() =>
        verifyBuildAssets({ distDir: tmpDir, expectedBase: "/Mu-la-Monitor_v2/" })
      ).toThrow();

      // Valid GitHub Pages subpath build
      fs.writeFileSync(
        path.join(tmpDir, "index.html"),
        `<html><head><link rel="stylesheet" href="/Mu-la-Monitor_v2/assets/main.css"></head><body><script type="module" src="/Mu-la-Monitor_v2/assets/main.js"></script></body></html>`
      );
      expect(
        verifyBuildAssets({ distDir: tmpDir, expectedBase: "/Mu-la-Monitor_v2/" }).ok
      ).toBe(true);
      expect(() =>
        verifyBuildAssets({ distDir: tmpDir, expectedBase: "/" })
      ).toThrow();

      // Double slash defect rejection
      fs.writeFileSync(
        path.join(tmpDir, "index.html"),
        `<html><script src="//assets/main.js"></script></html>`
      );
      expect(() =>
        verifyBuildAssets({ distDir: tmpDir, expectedBase: "/" })
      ).toThrow(/Çift slash/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("2. Guest Access Model & Privileged UI Guards", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("mugla-guest grants read-only dashboard access but strictly keeps isAuthenticated = false and all mutation capabilities disabled", async () => {
    localStorage.setItem("mugla-guest", "true");

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
          })),
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        functions: {
          invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      },
      isSupabaseClientConfigured: false,
    }));

    const { AuthProvider, useAuth } = await import("@/hooks/useAuth");
    const { DemoDataButton } = await import("@/components/intelligence/DemoDataButton");
    const { ExecutiveReportPanel } = await import("@/components/intelligence/ExecutiveReportPanel");
    const { AISummaryCard } = await import("@/components/AISummaryCard");
    const { I18nProvider } = await import("@/hooks/useTranslation");

    let capturedAuth: ReturnType<typeof useAuth> | null = null;
    function AuthProbe() {
      capturedAuth = useAuth();
      return null;
    }

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(
          I18nProvider,
          null,
          React.createElement(
            AuthProvider,
            null,
            React.createElement(AuthProbe),
            React.createElement(DemoDataButton),
            React.createElement(ExecutiveReportPanel),
            React.createElement(AISummaryCard, { type: "daily" })
          )
        )
      )
    );

    await waitFor(() => {
      expect(capturedAuth?.isLoading).toBe(false);
    });

    expect(capturedAuth?.isGuest).toBe(true);
    expect(capturedAuth?.hasDashboardAccess).toBe(true);
    expect(capturedAuth?.isAuthenticated).toBe(false);
    expect(capturedAuth?.role).toBe("guest");
    expect(capturedAuth?.isAdmin).toBe(false);
    expect(capturedAuth?.canManageData).toBe(false);
    expect(capturedAuth?.canGenerateAI).toBe(false);
    expect(capturedAuth?.canGenerateExecutiveReport).toBe(false);
    expect(capturedAuth?.canRunAdminActions).toBe(false);

    // Privileged action buttons must NOT render for guests
    expect(screen.queryByText(/Demo Veri Yükle/i)).toBeNull();
    expect(screen.queryByText(/Şimdi Üret/i)).toBeNull();
    expect(screen.queryByText(/İlk Raporu Üret/i)).toBeNull();
    expect(screen.queryByTitle("Yenile")).toBeNull();
  });

  it("Frontend codebase contains zero hardcoded Supabase keys, service-role secrets, Gemini keys, or TomTom keys", () => {
    const clientCode = fs.readFileSync(
      path.join(ROOT, "src/integrations/supabase/client.ts"),
      "utf8"
    );
    expect(clientCode).not.toMatch(/wivooargsmcwbiokpklu/i);
    expect(clientCode).not.toMatch(/sb_publishable_/i);
    expect(clientCode).not.toMatch(/eyJhbGci/i);

    const srcFiles = walkFiles(path.join(ROOT, "src"), [".ts", ".tsx"]);
    for (const file of srcFiles) {
      if (file.includes(`${path.sep}test${path.sep}`)) continue;
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(content).not.toMatch(/AQ\.Ab8RN6/);
      expect(content).not.toMatch(/H5rqs8XkfQHOw1D5uQZgF4UkGti2Esat/);
    }
  });
});

describe("3. Supabase Edge Functions Auth, CORS & Secret Hygiene", () => {
  it("supabase/config.toml sets verify_jwt = false ONLY on read-only public endpoints", () => {
    const configToml = fs.readFileSync(
      path.join(ROOT, "supabase/config.toml"),
      "utf8"
    );
    const blocks = configToml.split(/\[functions\./).slice(1);
    const unverified: string[] = [];

    for (const block of blocks) {
      const fnName = block.split("]")[0].trim();
      if (/verify_jwt\s*=\s*false/.test(block)) {
        unverified.push(fnName);
      }
    }

    expect(unverified.sort()).toEqual([
      "municipality-feed",
      "public-api",
      "venue-occupancy",
    ]);
  });

  it("Protected Edge Functions call authorizeRequest and Edge Functions contain zero hardcoded API keys or wildcard CORS", () => {
    const mustAuthorize = [
      "job-worker",
      "mock-data-injector",
      "executive-report",
      "city-briefing",
      "ai-summary",
      "data-scrape",
      "traffic-teyit",
      "spike-scan",
      "anomaly-scan",
      "news-scrape",
      "twitter-collect",
      "tourism-data-checker",
      "email-alerts-ingest",
      "social-cron",
      "social-collect",
      "social-analyze",
      "osint-lookup",
      "protocol-scrape",
      "reference-data",
      "transport-scrape",
    ];

    for (const fn of mustAuthorize) {
      const fnFile = path.join(ROOT, `supabase/functions/${fn}/index.ts`);
      const content = fs.readFileSync(fnFile, "utf8");
      expect(content, `${fn} must call authorizeRequest`).toMatch(/authorizeRequest\(/);
    }

    const fnFiles = walkFiles(path.join(ROOT, "supabase/functions"), [".ts"]);
    for (const file of fnFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(content, `Hardcoded Gemini key found in ${file}`).not.toMatch(/AQ\.Ab8RN6/);
      expect(content, `Hardcoded TomTom key found in ${file}`).not.toMatch(/H5rqs8X/);
      expect(content, `Wildcard CORS found in ${file}`).not.toMatch(
        /["']Access-Control-Allow-Origin["']\s*:\s*["']\*["']/
      );
    }
  });
});

describe("4. Supabase RLS & SQL Security Migration Invariants", () => {
  const migrationPath = path.join(
    ROOT,
    "supabase/migrations/20261116000001_security_rls_and_functions_hardening.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  it("drops open write / service_role anti-pattern policies and never defines WITH CHECK (true) or FOR ALL USING (true)", () => {
    expect(sql).not.toMatch(/WITH\s+CHECK\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/FOR\s+ALL[\s\S]*?USING\s*\(\s*true\s*\)/i);
    expect(sql).toMatch(/'job_queue'/);
    expect(sql).toMatch(/ALTER TABLE public\.%I ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.job_queue FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/i);
  });

  it("locks down SECURITY DEFINER functions to SECURITY INVOKER + fixed search_path + service_role EXECUTE", () => {
    expect(sql).toMatch(/claim_jobs[\s\S]*SECURITY INVOKER[\s\S]*SET search_path = public/i);
    expect(sql).toMatch(/find_similar_post[\s\S]*SECURITY INVOKER[\s\S]*SET search_path = public/i);
    expect(sql).toMatch(/capture_daily_snapshot[\s\S]*SECURITY INVOKER[\s\S]*SET search_path = public/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_jobs\(int(?:eger)?\) FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_jobs\(int(?:eger)?\) TO service_role/i);
    expect(sql).toMatch(/ALTER VIEW public\.district_pulse SET \(security_invoker = true\)/i);
  });

  it("reschedules pg_cron jobs with x-internal-secret and service_role_key rather than app.anon_key", () => {
    expect(sql).not.toMatch(/app\.anon_key/i);
    expect(sql).toMatch(/app\.internal_function_secret/i);
    expect(sql).toMatch(/app\.service_role_key/i);
    expect(sql).toMatch(/x-internal-secret/i);
  });
});
