import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { DashboardTab } from "@/components/dashboard/DashboardHeader";
import type { InvestigationHubView } from "@/components/investigation/InvestigationHub";
import { DISTRICTS } from "@/data/districts";
import { useMonitorStore } from "@/store/useMonitorStore";

export const VALID_DASHBOARD_TABS: readonly DashboardTab[] = [
  "genel",
  "diyagram",
  "ekonomi",
  "cevre",
  "turizm",
  "ulasim",
  "sosyal",
  "guvenlik",
  "enerji",
  "protokol",
] as const;

const VALID_DISTRICT_SLUGS = new Set(DISTRICTS.map((d) => d.slug.toLowerCase()));

export function parseTabFromParams(params: URLSearchParams): {
  tab: DashboardTab;
  hubView: InvestigationHubView;
} {
  const rawTab = (params.get("tab") || "").trim().toLowerCase();
  const rawView = (params.get("view") || "").trim().toLowerCase();

  if (rawTab === "ag_grafigi") {
    return { tab: "diyagram", hubView: "protocol_network" };
  }

  if ((VALID_DASHBOARD_TABS as readonly string[]).includes(rawTab)) {
    return {
      tab: rawTab as DashboardTab,
      hubView: rawTab === "diyagram" && rawView === "network" ? "protocol_network" : "verification",
    };
  }

  return { tab: "genel", hubView: "verification" };
}

export function parseDistrictFromParams(params: URLSearchParams): string | null {
  const raw = (params.get("district") || "").trim().toLowerCase();
  if (!raw) return null;
  if (VALID_DISTRICT_SLUGS.has(raw)) return raw;
  return null;
}

/**
 * URLSearchParams-synchronized hook for `?tab=...&district=...`.
 * - Pushing updates (`replace: false`) lets Browser Back / Forward buttons navigate
 *   seamlessly across tabs and districts.
 * - Direct link sharing or page refresh restores the exact tab and selected district.
 * - Automatically mirrors `district` into `useMonitorStore` so subscribed cards update
 *   selectively without prop drilling.
 */
export function useMonitorUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setStoreDistrict = useMonitorStore((s) => s.setActiveDistrict);

  const { tab: activeTab, hubView: hubInitialView } = useMemo(
    () => parseTabFromParams(searchParams),
    [searchParams]
  );

  const activeDistrict = useMemo(
    () => parseDistrictFromParams(searchParams),
    [searchParams]
  );

  // Sync URL ?district=... -> Zustand store (handles initial load, refresh & Back/Forward)
  useEffect(() => {
    setStoreDistrict(activeDistrict);
  }, [activeDistrict, setStoreDistrict]);

  const setActiveTab = useCallback(
    (nextTab: DashboardTab) => {
      const normalized: DashboardTab = nextTab === "ag_grafigi" ? "diyagram" : nextTab;
      const next = new URLSearchParams(searchParams);

      if (normalized === "genel") {
        next.delete("tab");
        next.delete("view");
      } else {
        next.set("tab", normalized);
        if (nextTab === "ag_grafigi") {
          next.set("view", "network");
        } else if (normalized !== "diyagram") {
          next.delete("view");
        }
      }

      if (next.toString() === searchParams.toString()) return;
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const setActiveDistrict = useCallback(
    (districtSlug: string | null) => {
      const normalized =
        districtSlug && VALID_DISTRICT_SLUGS.has(districtSlug.trim().toLowerCase())
          ? districtSlug.trim().toLowerCase()
          : null;

      const next = new URLSearchParams(searchParams);
      if (normalized) {
        next.set("district", normalized);
      } else {
        next.delete("district");
      }

      setStoreDistrict(normalized);
      if (next.toString() === searchParams.toString()) return;
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams, setStoreDistrict]
  );

  return {
    activeTab,
    hubInitialView,
    activeDistrict,
    setActiveTab,
    setActiveDistrict,
  };
}
