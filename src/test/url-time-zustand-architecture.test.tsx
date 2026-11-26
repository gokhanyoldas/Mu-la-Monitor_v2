import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useMonitorUrlState } from "@/hooks/useMonitorUrlState";
import { formatRelativeTime, feedStatus } from "@/lib/time-utils";
import {
  useMonitorStore,
  selectActiveDistrict,
  selectDams,
  selectEarthquakes,
  selectSocialFeed,
} from "@/store/useMonitorStore";
import { I18nProvider } from "@/hooks/useTranslation";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { AuthProvider } from "@/hooks/useAuth";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

function UrlStateHarness() {
  const { activeTab, activeDistrict, setActiveTab, setActiveDistrict } = useMonitorUrlState();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div data-testid="active-district">{activeDistrict ?? "all"}</div>
      <div data-testid="current-search">{location.search}</div>
      <button onClick={() => setActiveTab("cevre")}>Tab Cevre</button>
      <button onClick={() => setActiveTab("ulasim")}>Tab Ulasim</button>
      <button onClick={() => setActiveDistrict("bodrum")}>District Bodrum</button>
      <button onClick={() => setActiveDistrict("fethiye")}>District Fethiye</button>
      <button onClick={() => setActiveDistrict(null)}>District Clear</button>
      <button onClick={() => navigate(-1)}>Browser Back</button>
      <button onClick={() => navigate(1)}>Browser Forward</button>
    </div>
  );
}

describe("URL Query State Sync (?tab=...&district=...)", () => {
  beforeEach(() => {
    useMonitorStore.getState().resetStore();
  });

  it("opens directly to the tab and district specified in a shared URL", () => {
    render(
      <MemoryRouter initialEntries={["/?tab=cevre&district=bodrum"]}>
        <UrlStateHarness />
      </MemoryRouter>
    );

    expect(screen.getByTestId("active-tab").textContent).toBe("cevre");
    expect(screen.getByTestId("active-district").textContent).toBe("bodrum");
    expect(useMonitorStore.getState().activeDistrict).toBe("bodrum");
  });

  it("preserves legacy ?tab=ag_grafigi links by routing to diyagram", () => {
    render(
      <MemoryRouter initialEntries={["/?tab=ag_grafigi"]}>
        <UrlStateHarness />
      </MemoryRouter>
    );

    expect(screen.getByTestId("active-tab").textContent).toBe("diyagram");
  });

  it("updates URL params on tab/district clicks and supports Browser Back/Forward", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <UrlStateHarness />
      </MemoryRouter>
    );

    expect(screen.getByTestId("active-tab").textContent).toBe("genel");
    expect(screen.getByTestId("active-district").textContent).toBe("all");

    fireEvent.click(screen.getByText("Tab Cevre"));
    expect(screen.getByTestId("active-tab").textContent).toBe("cevre");
    expect(screen.getByTestId("current-search").textContent).toBe("?tab=cevre");

    fireEvent.click(screen.getByText("District Bodrum"));
    expect(screen.getByTestId("active-district").textContent).toBe("bodrum");
    expect(screen.getByTestId("current-search").textContent).toBe("?tab=cevre&district=bodrum");

    fireEvent.click(screen.getByText("Tab Ulasim"));
    expect(screen.getByTestId("active-tab").textContent).toBe("ulasim");
    expect(screen.getByTestId("current-search").textContent).toBe("?tab=ulasim&district=bodrum");

    // Browser Back should return to cevre + bodrum
    fireEvent.click(screen.getByText("Browser Back"));
    expect(screen.getByTestId("active-tab").textContent).toBe("cevre");
    expect(screen.getByTestId("active-district").textContent).toBe("bodrum");

    // Browser Back again should return to cevre + all
    fireEvent.click(screen.getByText("Browser Back"));
    expect(screen.getByTestId("active-tab").textContent).toBe("cevre");
    expect(screen.getByTestId("active-district").textContent).toBe("all");

    // Browser Forward restores bodrum
    fireEvent.click(screen.getByText("Browser Forward"));
    expect(screen.getByTestId("active-tab").textContent).toBe("cevre");
    expect(screen.getByTestId("active-district").textContent).toBe("bodrum");
  });
});

describe("Standardized Relative Time (date-fns formatRelativeTime TR / EN)", () => {
  const NOW = new Date("2026-11-25T12:00:00.000Z");

  it("formats Turkish relative times with zero English abbreviations", () => {
    const cases = [
      new Date(NOW.getTime() - 10 * 1000),
      new Date(NOW.getTime() - 2 * 60 * 1000),
      new Date(NOW.getTime() - 60 * 60 * 1000),
      new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
    ];

    const outputs = cases.map((d) => formatRelativeTime(d, "tr", { now: NOW }));
    expect(outputs[0]).toBe("Az önce");
    expect(outputs[1]).toContain("dakika önce");
    expect(outputs[2]).toContain("saat önce");
    expect(outputs[3]).toContain("gün önce");

    for (const out of outputs) {
      expect(out).not.toMatch(/\b(min|ago|just now|hour|hours|minute|minutes|day|days)\b/i);
      expect(out).not.toMatch(/\d+\s*(m|h|d)\b/i);
    }
  });

  it("formats English relative times with zero Turkish words", () => {
    const cases = [
      new Date(NOW.getTime() - 10 * 1000),
      new Date(NOW.getTime() - 5 * 60 * 1000),
      new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
      new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000),
    ];

    const outputs = cases.map((d) => formatRelativeTime(d, "en", { now: NOW }));
    expect(outputs[0]).toBe("Just now");
    expect(outputs[1]).toMatch(/5 minutes ago/i);
    expect(outputs[2]).toMatch(/2 hours ago/i);
    expect(outputs[3]).toMatch(/3 days ago/i);

    for (const out of outputs) {
      expect(out).not.toMatch(/(önce|dakika|saat|gün|Az önce)/i);
    }
  });

  it("localizes feedStatus labels for TR and EN", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const trStatus = feedStatus(fiveMinAgo, "tr");
    const enStatus = feedStatus(fiveMinAgo, "en");

    expect(trStatus.label).toContain("dakika önce");
    expect(trStatus.label).not.toMatch(/ago|min/i);
    expect(enStatus.label).toMatch(/minutes ago/i);
  });

  it("renders SON GÜNCELLEME in DashboardHeader with Turkish relative time and zero English tokens", () => {
    useMonitorStore.getState().resetStore();
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    useMonitorStore.getState().touchLastSynced(twoMinAgo);
    localStorage.setItem("mugla-monitor-lang", "tr");

    render(
      <MemoryRouter>
        <AuthProvider>
          <AccessibilityProvider>
            <I18nProvider>
              <DashboardHeader activeTab="genel" onTabChange={() => {}} />
            </I18nProvider>
          </AccessibilityProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const badge = screen.getByTestId("header-last-update");
    expect(badge.textContent).toContain("SON GÜNCELLEME");
    expect(badge.textContent).toContain("dakika önce");
    expect(badge.textContent).not.toMatch(/\b(min|ago|just now|1h)\b/i);
  });
});

describe("Selective Zustand Store (useMonitorStore) Render Isolation", () => {
  beforeEach(() => {
    useMonitorStore.getState().resetStore();
  });

  it("re-renders ONLY the card subscribed to the mutated slice", () => {
    const renderCounts = {
      district: 0,
      dams: 0,
      earthquakes: 0,
      social: 0,
    };

    function DistrictProbe() {
      const activeDistrict = useMonitorStore(selectActiveDistrict);
      const countRef = useRef(0);
      countRef.current += 1;
      renderCounts.district = countRef.current;
      return <div data-testid="probe-district">{activeDistrict ?? "none"}</div>;
    }

    function DamsProbe() {
      const dams = useMonitorStore(selectDams);
      const countRef = useRef(0);
      countRef.current += 1;
      renderCounts.dams = countRef.current;
      return <div data-testid="probe-dams">{dams.avgOccupancy ?? "none"}</div>;
    }

    function EarthquakesProbe() {
      const quakes = useMonitorStore(selectEarthquakes);
      const countRef = useRef(0);
      countRef.current += 1;
      renderCounts.earthquakes = countRef.current;
      return <div data-testid="probe-quakes">{quakes.latest?.magnitude ?? "none"}</div>;
    }

    function SocialProbe() {
      const social = useMonitorStore(selectSocialFeed);
      const countRef = useRef(0);
      countRef.current += 1;
      renderCounts.social = countRef.current;
      return <div data-testid="probe-social">{social.totalMentions}</div>;
    }

    render(
      <div>
        <DistrictProbe />
        <DamsProbe />
        <EarthquakesProbe />
        <SocialProbe />
      </div>
    );

    expect(renderCounts).toEqual({ district: 1, dams: 1, earthquakes: 1, social: 1 });

    // 1. Update ONLY dams slice
    act(() => {
      useMonitorStore.getState().setDamsSnapshot({
        avgOccupancy: 64.5,
        verifiedCount: 4,
        hasVerifiedLiveData: true,
        latestSourceSummary: "Kaynak: DSİ • 25 Kas",
      });
    });
    expect(screen.getByTestId("probe-dams").textContent).toBe("64.5");
    expect(renderCounts).toEqual({ district: 1, dams: 2, earthquakes: 1, social: 1 });

    // 2. Update ONLY earthquakes slice
    act(() => {
      useMonitorStore.getState().setEarthquakes([
        {
          id: "eq-1",
          magnitude: 3.8,
          location: "Datça Açıkları",
          depthKm: 11.4,
          occurredAt: new Date().toISOString(),
        },
      ]);
    });
    expect(screen.getByTestId("probe-quakes").textContent).toBe("3.8");
    expect(renderCounts).toEqual({ district: 1, dams: 2, earthquakes: 2, social: 1 });

    // 3. Update ONLY socialFeed slice
    act(() => {
      useMonitorStore.getState().prependSocialPost({
        id: "post-1",
        platform: "news",
        content: "Bodrum altyapı çalışması tamamlandı",
        sentiment: "positive",
        publishedAt: new Date().toISOString(),
      });
    });
    expect(screen.getByTestId("probe-social").textContent).toBe("1");
    expect(renderCounts).toEqual({ district: 1, dams: 2, earthquakes: 2, social: 2 });

    // 4. Update ONLY activeDistrict slice
    act(() => {
      useMonitorStore.getState().setActiveDistrict("marmaris");
    });
    expect(screen.getByTestId("probe-district").textContent).toBe("marmaris");
    expect(renderCounts).toEqual({ district: 2, dams: 2, earthquakes: 2, social: 2 });

    // 5. No-op identical activeDistrict update triggers 0 extra renders
    act(() => {
      useMonitorStore.getState().setActiveDistrict("marmaris");
    });
    expect(renderCounts).toEqual({ district: 2, dams: 2, earthquakes: 2, social: 2 });
  });
});
