import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DISTRICTS, getDistrictBySlug } from "@/data/districts";
import { MapPin, ChevronDown, ExternalLink } from "lucide-react";
import { AlertPanel } from "./AlertPanel";
import { AccessibilityToolbar } from "./AccessibilityToolbar";
import { AccountMenu } from "./AccountMenu";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { useTranslation } from "@/hooks/useTranslation";
import { useMonitorStore, selectLastSyncedAt, selectActiveDistrict } from "@/store/useMonitorStore";
import { formatRelativeTime } from "@/lib/time-utils";

export type DashboardTab = "genel" | "diyagram" | "ekonomi" | "cevre" | "turizm" | "ulasim" | "sosyal" | "guvenlik" | "enerji" | "protokol" | "ag_grafigi";

interface DashboardHeaderProps {
  activeTab?: DashboardTab;
  onTabChange?: (tab: DashboardTab) => void;
  activeDistrict?: string | null;
  onDistrictChange?: (districtSlug: string | null) => void;
}

const tabs: { label: string; value: DashboardTab }[] = [
  { label: "Genel Bakış", value: "genel" },
  { label: "Diyagram", value: "diyagram" },
  { label: "Ekonomi", value: "ekonomi" },
  { label: "Çevre", value: "cevre" },
  { label: "Turizm", value: "turizm" },
  { label: "Ulaşım", value: "ulasim" },
  { label: "Sosyal", value: "sosyal" },
  { label: "Güvenlik", value: "guvenlik" },
  { label: "Enerji", value: "enerji" },
  { label: "Muğla Protokol", value: "protokol" },
];

export const DashboardHeader = ({
  activeTab = "genel",
  onTabChange,
  activeDistrict: activeDistrictProp,
  onDistrictChange,
}: DashboardHeaderProps) => {
  const { lang, t } = useTranslation();
  const storeDistrict = useMonitorStore(selectActiveDistrict);
  const lastSyncedAt = useMonitorStore(selectLastSyncedAt);
  const activeDistrict = activeDistrictProp !== undefined ? activeDistrictProp : storeDistrict;
  const activeDistrictObj = activeDistrict ? getDistrictBySlug(activeDistrict) : undefined;
  const [time, setTime] = useState(new Date());
  const [districtOpen, setDistrictOpen] = useState(false);
  // Dropdown, overflow-x-auto tab barının kırpmasından kaçınmak için fixed konumlanır
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const districtBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDistrictOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDistrictOpen(false);
    };
    const closeOnScroll = () => setDistrictOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, []);

  const toggleDistrictMenu = () => {
    if (!districtOpen && districtBtnRef.current) {
      const r = districtBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 172)) });
    }
    setDistrictOpen((v) => !v);
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d: Date) => {
    const locale = lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR";
    return d.toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString(lang === "en" ? "en-US" : lang === "de" ? "de-DE" : "tr-TR", { hour12: false });
  };

  return (
    <header className="border-b border-border bg-secondary/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-primary font-mono font-bold text-xs sm:text-sm">M</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-mono text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap">
                <span className="text-primary">MUĞLA</span>
                <span className="text-muted-foreground ml-1 sm:ml-1.5">
                  {lang === "en" ? "MONITOR" : "MONİTÖR"}
                </span>
              </h1>
              <p className="text-[8px] sm:text-[9px] font-mono text-muted-foreground tracking-widest uppercase hidden lg:block truncate">
                {t("Bölgesel İstihbarat Paneli")}
              </p>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-2 ml-3 shrink-0">
            <span className="status-dot-live" />
            <span className="text-[10px] font-mono text-destructive font-semibold">{t("CANLI")}</span>
            {lastSyncedAt && (
              <span
                data-testid="header-last-update"
                className="text-[9px] font-mono text-muted-foreground pl-2 border-l border-border/50 whitespace-nowrap"
              >
                {t("SON GÜNCELLEME")}: {formatRelativeTime(lastSyncedAt, lang)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Görünüm menüsü (Sade/Uzman, A-/A+, Yüksek Kontrast) */}
          <AccessibilityToolbar />

          {/* Hızlı TR / EN Dil Seçici */}
          <LanguageSwitcher />

          {/* Hesap durumu, günlük bülten tercihi ve tek tıkla çıkış */}
          <AccountMenu />

          {/* Tarayıcı bildirimleri */}
          <NotificationBell />

          {/* Şehir bildirim merkezi */}
          <AlertPanel />

          <div className="hidden md:block text-right pl-1 border-l border-border/40">
            <div className="text-[11px] sm:text-xs font-mono tabular-nums-stat text-foreground font-medium whitespace-nowrap">
              {formatTime(time)}
            </div>
            <div className="text-[8px] sm:text-[9px] font-mono text-muted-foreground whitespace-nowrap">
              {formatDate(time)}
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs — mobile scrollable */}
      <nav
        aria-label={lang === "en" ? "Dashboard sections" : "Panel sekmeleri"}
        className="flex items-center gap-1 px-2 sm:px-4 py-1.5 overflow-x-auto scrollbar-hide border-t border-border/50"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange?.(tab.value)}
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={`text-[10px] font-mono px-2.5 sm:px-3 py-1 rounded whitespace-nowrap transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === tab.value
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}

        {/* İlçeler dropdown — fixed konum: tab barı overflow kırpmasını aşar */}
        <div className="ml-1 flex-shrink-0" ref={dropdownRef}>
          <button
            ref={districtBtnRef}
            type="button"
            data-testid="district-selector-trigger"
            onClick={toggleDistrictMenu}
            aria-expanded={districtOpen}
            aria-haspopup="menu"
            aria-label={lang === "en" ? "Select district" : "İlçe seç"}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              districtOpen || activeDistrictObj
                ? "text-primary bg-primary/15 border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <MapPin size={10} aria-hidden="true" />
            {activeDistrictObj ? activeDistrictObj.name : t("İlçeler")}
            <ChevronDown size={9} aria-hidden="true" className={`transition-transform ${districtOpen ? "rotate-180" : ""}`} />
          </button>
          {districtOpen && menuPos && (
            <div
              role="menu"
              aria-label={lang === "en" ? "Muğla districts" : "Muğla ilçeleri"}
              className="fixed w-48 bg-background border border-border rounded-md shadow-xl z-[999] overflow-hidden"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <div className="py-0.5 max-h-64 overflow-y-auto scrollbar-thin">
                {onDistrictChange && activeDistrictObj && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="district-option-all"
                    onClick={() => {
                      onDistrictChange(null);
                      setDistrictOpen(false);
                    }}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-primary hover:bg-muted/40 border-b border-border/40 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    {lang === "en" ? "All Muğla (13 Districts)" : "Tüm Muğla (13 İlçe)"}
                  </button>
                )}
                {DISTRICTS.map((d) => {
                  const isSelected = activeDistrictObj?.slug === d.slug;
                  return (
                    <div
                      key={d.slug}
                      className={`flex items-center justify-between transition-colors ${
                        isSelected ? "bg-primary/15 text-primary" : "hover:bg-muted/40"
                      }`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`district-option-${d.slug}`}
                        onClick={() => {
                          if (onDistrictChange) {
                            onDistrictChange(d.slug);
                          } else {
                            navigate(`/ilce/${d.slug}`);
                          }
                          setDistrictOpen(false);
                        }}
                        className="flex-1 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-foreground text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span aria-hidden="true">{d.emoji}</span>
                        <span className={isSelected ? "font-bold text-primary" : ""}>{d.name}</span>
                      </button>
                      {onDistrictChange && (
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/ilce/${d.slug}`);
                            setDistrictOpen(false);
                          }}
                          aria-label={
                            lang === "en"
                              ? `Open ${d.name} detail page`
                              : `${d.name} detay sayfasını aç`
                          }
                          title={lang === "en" ? `${d.name} detail page` : `${d.name} detay sayfası`}
                          className="p-1.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <ExternalLink size={10} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};
