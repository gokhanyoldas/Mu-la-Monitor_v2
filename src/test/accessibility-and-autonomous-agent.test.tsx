import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { AccessibilityProvider, simplifyCitizenText } from "@/contexts/AccessibilityContext";
import { I18nProvider, useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AccessibilityToolbar } from "@/components/dashboard/AccessibilityToolbar";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { getPanelHelpText } from "@/data/panelHelpCatalog";
import { DISTRICTS } from "@/data/districts";
// @ts-expect-error ESM script helper exports verified at runtime
import {
  DISTRICT_GROUPS,
  selectRegionalGroup,
  calculateMonthlyQuotaUsage,
  extractJsonFromModelText,
  normalizeAgentFindings,
  buildSupabasePayloads,
  normalizeSupabaseUrl,
  resolveAgentEnv,
  runAutonomousAgent,
} from "../../scripts/run-autonomous-agent.mjs";

const TestHarness: React.FC = () => {
  const { lang, t } = useTranslation();
  return (
    <div>
      <span data-testid="current-lang">{lang}</span>
      <LanguageSwitcher />
      <AccessibilityToolbar />
      <span data-testid="tab-overview">{t("Genel Bakış")}</span>
      <span data-testid="tab-diagram">{t("Diyagram")}</span>
      <span data-testid="tab-network">{t("Kamu Kurumları Ağı")}</span>
      <span data-testid="pulse-label">{t("Şehir Nabzı")}</span>
      <span data-testid="jargon-sample">
        {t("OSINT ve Google Search Grounding ile ODİT Telemetri analizi")}
      </span>
      <DashboardPanel
        title="Hava Kalitesi (AQI)"
        badge="AKTİF"
        collapsible
        defaultOpen
      >
        <div data-testid="panel-content">Panel İçeriği</div>
      </DashboardPanel>
    </div>
  );
};

describe("3. Ajan — Erişilebilirlik, Dil Seçici (TR/EN), Sade Vatandaş Modu ve ? Bilgi İkonu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-font-scale");
    document.documentElement.removeAttribute("data-view-mode");
    document.documentElement.classList.remove("high-contrast-mode");
  });

  it("varsayılan açılış dili her zaman TR olur ve tek tıkla TR/EN arasında geçiş yapar", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <TestHarness />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("current-lang").textContent).toBe("tr");
    expect(screen.getByTestId("tab-overview").textContent).toBe("Genel Bakış");
    expect(screen.getByTestId("tab-diagram").textContent).toBe("Diyagram");
    expect(screen.getByTestId("pulse-label").textContent).toBe("Şehir Nabzı");

    // Tek tıkla İngilizceye geç
    fireEvent.click(screen.getByTestId("lang-en"));
    expect(screen.getByTestId("current-lang").textContent).toBe("en");
    expect(screen.getByTestId("tab-overview").textContent).toBe("Overview");
    expect(screen.getByTestId("tab-diagram").textContent).toBe("Diagram");
    expect(screen.getByTestId("pulse-label").textContent).toBe("City Pulse");

    // Tekrar Türkçeye dön
    fireEvent.click(screen.getByTestId("lang-tr"));
    expect(screen.getByTestId("current-lang").textContent).toBe("tr");
    expect(screen.getByTestId("tab-overview").textContent).toBe("Genel Bakış");
  });

  it("Sade Vatandaş Modu tüm panelleri koruyarak teknik terimleri günlük dile çevirir (TR ve EN)", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <TestHarness />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    // Sade Moda geç
    fireEvent.click(screen.getByTestId("view-mode-toggle"));
    expect(document.documentElement.dataset.viewMode).toBe("citizen");

    // Panel içeriği gizlenmez, korunur
    expect(screen.getByTestId("panel-content")).toBeTruthy();

    // TR teknik terimler sadeleşir
    expect(screen.getByTestId("tab-diagram").textContent).toBe("Olay Doğrulama");
    expect(screen.getByTestId("tab-network").textContent).toBe("Kurum İletişim Ağı");
    expect(screen.getByTestId("pulse-label").textContent).toBe("Şehir Özeti");
    const simplifiedTr = screen.getByTestId("jargon-sample").textContent || "";
    expect(simplifiedTr).not.toContain("OSINT");
    expect(simplifiedTr).not.toContain("Grounding");
    expect(simplifiedTr).not.toContain("ODİT");
    expect(simplifiedTr).toContain("Canlı Web Doğrulaması");
    expect(simplifiedTr).toContain("Canlı Ölçüm");

    // EN dilinde de Sade Mod terimleri sadeleştirir
    fireEvent.click(screen.getByTestId("lang-en"));
    expect(screen.getByTestId("tab-diagram").textContent).toBe("Event Verification");
    expect(screen.getByTestId("tab-network").textContent).toBe("Public Institution Network");
    expect(screen.getByTestId("pulse-label").textContent).toBe("City Summary");
    expect(simplifyCitizenText("OSINT Grounding Telemetry AQI", "en")).toBe(
      "Public News Web Check Live Readings Air Quality"
    );
  });

  it("A- / A+ yazı boyutu ölçeğini ve yüksek okunabilirlik kontrastını günceller", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <TestHarness />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    const incBtn = screen.getByTestId("font-increase-btn");
    const decBtn = screen.getByTestId("font-decrease-btn");
    const contrastBtn = screen.getByTestId("contrast-toggle-btn");

    expect(document.documentElement.dataset.fontScale).toBe("normal");
    fireEvent.click(incBtn);
    expect(document.documentElement.dataset.fontScale).toBe("large");
    fireEvent.click(incBtn);
    expect(document.documentElement.dataset.fontScale).toBe("xlarge");
    fireEvent.click(decBtn);
    expect(document.documentElement.dataset.fontScale).toBe("large");

    expect(document.documentElement.classList.contains("high-contrast-mode")).toBe(false);
    fireEvent.click(contrastBtn);
    expect(document.documentElement.classList.contains("high-contrast-mode")).toBe(true);
  });

  it("her teknik panel başlığında ? bilgi ikonu gösterir ve tek cümlelik açıklama açar", () => {
    render(
      <MemoryRouter>
        <AccessibilityProvider>
          <I18nProvider>
            <TestHarness />
          </I18nProvider>
        </AccessibilityProvider>
      </MemoryRouter>
    );

    const helpBtn = screen.getByRole("button", {
      name: /Bu panel ne işe yarar\? — Hava Kalitesi \(AQI\)/i,
    });
    expect(helpBtn).toBeTruthy();

    fireEvent.click(helpBtn);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Bu panel ne işe yarar?");
    expect(tooltip.textContent).toContain(getPanelHelpText("Hava Kalitesi (AQI)", "tr"));

    // ? tıklaması katlanabilir paneli yanlışlıkla kapatmamalı
    expect(screen.getByTestId("panel-content")).toBeTruthy();
  });
});

describe("1. Ajan — 7/24 Free-Tier Otonom GitHub Actions İşçisi", () => {
  it("Muğla'nın 13 ilçesinin tamamını 4 bölgesel grupta eksiksiz ve tekrarsız kapsar", () => {
    expect(DISTRICT_GROUPS).toHaveLength(4);
    const groupedDistricts = DISTRICT_GROUPS.flatMap((g: { districts: string[] }) => g.districts);
    expect(groupedDistricts).toHaveLength(13);
    expect(new Set(groupedDistricts).size).toBe(13);

    const expectedOfficialDistricts = [
      "Bodrum",
      "Dalaman",
      "Datça",
      "Fethiye",
      "Kavaklıdere",
      "Köyceğiz",
      "Marmaris",
      "Menteşe",
      "Milas",
      "Ortaca",
      "Seydikemer",
      "Ula",
      "Yatağan",
    ].sort();
    expect(DISTRICTS).toHaveLength(13);
    expect([...groupedDistricts].sort()).toEqual(expectedOfficialDistricts);
  });

  it("6 saatlik UTC dilimlerine göre A/B/C/D gruplarını deterministik sırayla seçer ve aylık ücretsiz kotanın %15'ini aşmaz", () => {
    expect(selectRegionalGroup(new Date("2026-10-01T00:05:00Z")).id).toBe("A");
    expect(selectRegionalGroup(new Date("2026-10-01T06:05:00Z")).id).toBe("B");
    expect(selectRegionalGroup(new Date("2026-10-01T12:05:00Z")).id).toBe("C");
    expect(selectRegionalGroup(new Date("2026-10-01T18:05:00Z")).id).toBe("D");
    expect(selectRegionalGroup("c").id).toBe("C");

    const quota = calculateMonthlyQuotaUsage();
    expect(quota.runsPerDay).toBe(4);
    expect(quota.monthlyCalls).toBe(120);
    expect(quota.percentUsed).toBeLessThanOrEqual(15);
    expect(quota.withinBudget).toBe(true);
  });

  it("Gemini çıktısını ayrıştırır ve social_keywords, social_posts, alert_events için tekilleştirilmiş Supabase kayıtları üretir", () => {
    const rawText = [
      "```json",
      JSON.stringify({
        posts: [
          {
            title: "Bodrum Torba hattında su kesintisi",
            summary: "MUSKİ ekipleri ana isale hattında onarım çalışması yürütüyor.",
            district: "Bodrum",
            category: "altyapi",
            sentiment: "negative",
            severity: "high",
            source_name: "Muğla Yerel Basın",
            source_url: "https://example.org/bodrum-su",
            keywords: ["Torba isale hattı", "MUSKİ"],
          },
          {
            title: "Mevcut URL tekrar testi",
            summary: "Bu kayıt mevcut URL ile çakıştığı için elenmeli.",
            district: "Milas",
            category: "ulasim",
            sentiment: "neutral",
            severity: "low",
            source_url: "https://example.org/already-seen",
            keywords: ["Milas çevre yolu"],
          },
        ],
        new_keywords: [
          { keyword: "Torba isale hattı", category: "altyapi", district: "Bodrum" },
          { keyword: "MUSKİ", category: "altyapi", district: "Bodrum" },
        ],
        alerts: [
          {
            title: "Bodrum Torba su kesintisi uyarısı",
            body: "Onarım nedeniyle 6 saatlik kesinti bildirildi.",
            district: "Bodrum",
            severity: "high",
            type: "altyapi",
          },
        ],
      }),
      "```",
    ].join("\n");

    const parsed = extractJsonFromModelText(rawText);
    const groupA = selectRegionalGroup("A");
    const findings = normalizeAgentFindings(parsed, groupA, [
      { web: { uri: "https://example.org/grounding-source" } },
    ]);

    const payloads = buildSupabasePayloads({
      findings,
      group: groupA,
      existingKeywords: ["muski", "MUSKİ"],
      existingUrls: ["https://example.org/already-seen"],
      systemUserId: "00000000-0000-0000-0000-000000000001",
      now: new Date("2026-10-01T00:00:00Z"),
    });

    // MUSKİ zaten mevcut olduğu için tekrar eklenmez; yeni kelimeler eklenir
    expect(payloads.keywordRows.map((k: { keyword: string }) => k.keyword)).toContain(
      "Torba isale hattı"
    );
    expect(payloads.keywordRows.map((k: { keyword: string }) => k.keyword)).not.toContain("MUSKİ");

    // Tekrarlı URL elenir, yalnızca yeni gönderi kalır
    expect(payloads.postRows).toHaveLength(1);
    expect(payloads.postRows[0].district).toBe("Bodrum");
    expect(payloads.postRows[0].platform).toBe("web_grounding");

    // Yüksek öncelikli uyarı alert_events kaydı olarak oluşur
    expect(payloads.alertRows).toHaveLength(1);
    expect(payloads.alertRows[0].severity).toBe("high");
    expect(payloads.alertRows[0].source).toBe("autonomous-intel-agent");
  });

  it("dry-run modunda ağ veya veritabanı yazımı yapmadan başarıyla tamamlanır ve CI workflow’larını korur", async () => {
    const result = await runAutonomousAgent({ dryRun: true, groupOverride: "B" });
    expect(result.status).toBe("dry_run");
    expect(result.group.id).toBe("B");
    expect(result.group.districts).toEqual(["Marmaris", "Datça", "Ula"]);
    expect(result.quota.withinBudget).toBe(true);
    expect(result.planned.social_keywords).toBeGreaterThan(0);
    expect(result.planned.social_posts).toBeGreaterThan(0);

    const workflowsDir = path.resolve(process.cwd(), ".github/workflows");
    expect(fs.existsSync(workflowsDir)).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
    expect(pkg.scripts["agent:run"]).toBe("node scripts/run-autonomous-agent.mjs");
  });

  it("Node.js 20+ üzerinde ek kurulum gerektirmeden çalışır, SUPABASE_URL /rest/v1 ekini temizler ve SERVICE_ROLE yoksa ANON_KEY ile devam eder", () => {
    const scriptSource = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/run-autonomous-agent.mjs"),
      "utf-8"
    );
    // Üst düzey üçüncü parti paket import'u bulunmaz (ek npm install gerektirmez)
    expect(scriptSource).not.toMatch(/^\s*import\s+.*from\s+["']@google\/genai["']/m);
    expect(scriptSource).not.toMatch(/^\s*import\s+.*from\s+["']@supabase\/supabase-js["']/m);

    // URL temizliği (/rest/v1, /auth/v1, boşluk, tırnak)
    expect(
      normalizeSupabaseUrl('  "https://ntheudveohozxdjgcvif.supabase.co/rest/v1/"  ')
    ).toBe("https://ntheudveohozxdjgcvif.supabase.co");
    expect(
      normalizeSupabaseUrl("https://ntheudveohozxdjgcvif.supabase.co/rest/v1")
    ).toBe("https://ntheudveohozxdjgcvif.supabase.co");
    expect(
      normalizeSupabaseUrl("https://ntheudveohozxdjgcvif.supabase.co/auth/v1/")
    ).toBe("https://ntheudveohozxdjgcvif.supabase.co");

    // SERVICE_ROLE önceliği ve ANON_KEY yedeği
    const withService = resolveAgentEnv({
      GEMINI_API_KEY: "  gem-key-123  ",
      SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co/rest/v1/",
      SUPABASE_SERVICE_ROLE_KEY: "service-secret-key",
      SUPABASE_ANON_KEY: "anon-fallback-key",
    });
    expect(withService.supabaseUrl).toBe("https://ntheudveohozxdjgcvif.supabase.co");
    expect(withService.supabaseKey).toBe("service-secret-key");
    expect(withService.supabaseKeyType).toBe("service_role");
    expect(withService.geminiApiKey).toBe("gem-key-123");

    const withAnonOnly = resolveAgentEnv({
      GEMINI_API_KEY: "gem-key-123",
      SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co/rest/v1",
      SUPABASE_ANON_KEY: "anon-fallback-key",
    });
    expect(withAnonOnly.supabaseKey).toBe("anon-fallback-key");
    expect(withAnonOnly.supabaseKeyType).toBe("anon");
  });

  it("geçici bir ağ hatasında açık log yazar ancak sonraki adımları durdurmadan social_keywords ve live_data_cache yazımını tamamlar", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const requestedUrls: Array<{ method: string; url: string; body?: string }> = [];
    const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = (init?.method || "GET").toUpperCase();
      requestedUrls.push({
        method,
        url,
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      // Gemini REST Grounding çağrısı -> baraj + ulaşım/altyapı + yeni terimler döner
      if (url.includes("generativelanguage.googleapis.com")) {
        const modelPayload = {
          posts: [
            {
              title: "Mumcular Barajı doluluk ve Bodrum isale hattı güncellemesi",
              summary: "MUSKİ ve DSİ verilerine göre Mumcular Barajı %74 seviyesine ulaştı.",
              district: "Bodrum",
              category: "cevre",
              sentiment: "positive",
              severity: "high",
              source_name: "Anter Haber",
              source_url: "https://anterhaber.com/mumcular-baraji-74",
              keywords: ["Mumcular Barajı", "Bodrum isale hattı"],
            },
          ],
          new_keywords: [
            { keyword: "Mumcular Terfi İstasyonu", category: "altyapi", district: "Bodrum" },
            { keyword: "Mevcut Terim", category: "genel", district: "Bodrum" },
          ],
          alerts: [
            {
              title: "Bodrum ana isale hattında planlı bakım",
              body: "6 saatlik basınç düşüşü bekleniyor.",
              district: "Bodrum",
              severity: "high",
              type: "altyapi",
              source_url: "https://anterhaber.com/mumcular-baraji-74",
            },
          ],
          dam_updates: [
            {
              dam_name: "Mumcular Barajı",
              occupancy_rate: 74,
              source_name: "Anter Haber",
              source_url: "https://anterhaber.com/mumcular-baraji-74",
              published_date: "2026-11-25",
              confidence: "high",
            },
          ],
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify(modelPayload) }] },
                groundingMetadata: {
                  groundingChunks: [
                    { web: { uri: "https://anterhaber.com/mumcular-baraji-74", title: "Anter Haber" } },
                  ],
                },
              },
            ],
          }),
        } as unknown as Response;
      }

      // Supabase GET social_keywords -> 1 mevcut terim döner
      if (method === "GET" && url.includes("/rest/v1/social_keywords")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ keyword: "Mevcut Terim", user_id: "u-1" }],
        } as unknown as Response;
      }

      // Supabase GET social_posts -> geçici ağ hatası simülasyonu
      if (method === "GET" && url.includes("/rest/v1/social_posts")) {
        throw new Error("ECONNRESET temporary network blip");
      }

      // Supabase POST social_posts -> geçici ağ hatası simülasyonu (sonraki adımları durdurmamalı!)
      if (method === "POST" && url.includes("/rest/v1/social_posts")) {
        throw new Error("fetch failed: socket hang up");
      }

      // social_keywords, alert_events ve live_data_cache yazımları başarılı
      return {
        ok: true,
        status: 201,
        json: async () => [],
        text: async () => "",
      } as unknown as Response;
    });

    try {
      const result = await runAutonomousAgent({
        now: new Date("2026-11-25T00:05:00Z"), // Grup A (barajlar + ulaşım/altyapı)
        env: {
          GEMINI_API_KEY: "test-gemini-key",
          SUPABASE_URL: "https://ntheudveohozxdjgcvif.supabase.co/rest/v1/",
          SUPABASE_ANON_KEY: "test-anon-key",
        },
        fetchImpl: mockFetch,
        retryDelayMs: 0,
      });

      // Çift /rest/v1/rest/v1 asla oluşmaz
      expect(requestedUrls.some((r) => r.url.includes("/rest/v1/rest/v1"))).toBe(false);
      expect(
        requestedUrls.some((r) =>
          r.url.startsWith("https://ntheudveohozxdjgcvif.supabase.co/rest/v1/social_keywords")
        )
      ).toBe(true);

      // Geçici ağ hataları loglandı ancak sonraki adımlar durdurulmadı
      expect(result.status).toBe("partial_ok");
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(errorSpy).toHaveBeenCalled();

      // Yeni terimler social_keywords tablosuna eklendi (mevcut terim tekrar eklenmedi)
      expect(result.inserted.social_keywords).toBeGreaterThan(0);
      const kwInsert = requestedUrls.find(
        (r) => r.method === "POST" && r.url.includes("/rest/v1/social_keywords")
      );
      expect(kwInsert?.body).toContain("Mumcular Terfi İstasyonu");
      expect(kwInsert?.body).not.toContain("Mevcut Terim");

      // social_posts hata verse bile alert_events ve live_data_cache başarıyla yazıldı
      expect(result.inserted.social_posts).toBe(0);
      expect(result.inserted.alert_events).toBe(1);
      expect(result.inserted.topic_caches).toBeGreaterThanOrEqual(2);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
