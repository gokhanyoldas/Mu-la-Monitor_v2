import { describe, it, expect, beforeEach } from "vitest";
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
    expect(screen.getByTestId("tab-diagram").textContent).toBe("Doğrulama Merkezi");
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
    expect(screen.getByTestId("tab-diagram").textContent).toBe("Verification Center");
    expect(screen.getByTestId("tab-network").textContent).toBe("Public Institution Network");
    expect(screen.getByTestId("pulse-label").textContent).toBe("City Summary");
    expect(simplifyCitizenText("OSINT Grounding Telemetry AQI", "en")).toBe(
      "Public News Web Check Live Readings Air Score"
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

  it("dry-run modunda ağ veya veritabanı yazımı yapmadan başarıyla tamamlanır ve GitHub Actions workflow dosyası geçerlidir", async () => {
    const result = await runAutonomousAgent({ dryRun: true, groupOverride: "B" });
    expect(result.status).toBe("dry_run");
    expect(result.group.id).toBe("B");
    expect(result.group.districts).toEqual(["Marmaris", "Datça", "Ula"]);
    expect(result.quota.withinBudget).toBe(true);
    expect(result.planned.social_keywords).toBeGreaterThan(0);
    expect(result.planned.social_posts).toBeGreaterThan(0);

    const workflowPath = path.resolve(
      process.cwd(),
      ".github/workflows/autonomous-intel-agent.yml"
    );
    if (fs.existsSync(workflowPath)) {
      const workflowYaml = fs.readFileSync(workflowPath, "utf-8");
      expect(workflowYaml).toContain("0 */6 * * *");
      expect(workflowYaml).toContain("scripts/run-autonomous-agent.mjs");
      expect(workflowYaml).toContain("GEMINI_API_KEY");
      expect(workflowYaml).toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
