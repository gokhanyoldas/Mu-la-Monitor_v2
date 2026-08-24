import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DISTRICTS } from "@/data/districts";
import { MapPin, ChevronDown } from "lucide-react";
import { AlertPanel } from "./AlertPanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";

export type DashboardTab = "genel" | "ekonomi" | "cevre" | "turizm" | "ulasim" | "sosyal" | "guvenlik" | "enerji" | "protokol";

interface DashboardHeaderProps {
  activeTab?: DashboardTab;
  onTabChange?: (tab: DashboardTab) => void;
}

const tabs: { label: string; value: DashboardTab }[] = [
  { label: "Genel Bakış", value: "genel" },
  { label: "Ekonomi", value: "ekonomi" },
  { label: "Çevre", value: "cevre" },
  { label: "Turizm", value: "turizm" },
  { label: "Ulaşım", value: "ulasim" },
  { label: "Sosyal", value: "sosyal" },
  { label: "Güvenlik", value: "guvenlik" },
  { label: "Enerji", value: "enerji" },
  { label: "Muğla Protokol", value: "protokol" },
];

export const DashboardHeader = ({ activeTab = "genel", onTabChange }: DashboardHeaderProps) => {
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
    const closeOnScroll = () => setDistrictOpen(false);
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, []);

  const toggleDistrictMenu = () => {
    if (!districtOpen && districtBtnRef.current) {
      const r = districtBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setDistrictOpen(v => !v);
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d: Date) => {
    return d.toLocaleDateString("tr-TR", {
      weekday: "short", day: "2-digit", month: "short", year: "numeric",
    });
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("tr-TR", { hour12: false });
  };

  return (
    <header className="border-b border-border bg-secondary/20 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-mono font-bold text-xs sm:text-sm">M</span>
            </div>
            <div>
              <h1 className="font-mono text-xs sm:text-sm font-bold tracking-wider">
                <span className="text-primary">MUĞLA</span>
                <span className="text-muted-foreground ml-1 sm:ml-1.5">MONİTÖR</span>
              </h1>
              <p className="text-[8px] sm:text-[9px] font-mono text-muted-foreground tracking-widest uppercase hidden sm:block">
                Bölgesel İstihbarat Paneli
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 ml-4">
            <span className="status-dot-live" />
            <span className="text-[10px] font-mono text-destructive font-semibold">CANLI</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden lg:flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 border border-border/50">
              <span>📡</span>
              <span>48 KAYNAK</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 border border-border/50">
              <span>⏱</span>
              <span>SON GÜNCELLEME: 2dk</span>
            </div>
          </div>

          {/* M13: Language switcher */}
          <LanguageSwitcher />

          {/* M4: Notification bell */}
          <NotificationBell />

          {/* Existing alert bell */}
          <AlertPanel />

          <div className="text-right">
            <div className="text-[11px] sm:text-xs font-mono text-foreground font-medium">{formatTime(time)}</div>
            <div className="text-[8px] sm:text-[9px] font-mono text-muted-foreground">{formatDate(time)}</div>
          </div>
        </div>
      </div>

      {/* Category tabs — mobile scrollable */}
      <div className="flex items-center gap-1 px-2 sm:px-4 py-1.5 overflow-x-auto scrollbar-hide border-t border-border/50">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onTabChange?.(tab.value)}
            className={`text-[9px] sm:text-[10px] font-mono px-2 sm:px-3 py-1 rounded whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === tab.value
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* İlçeler dropdown — fixed konum: tab barı overflow kırpmasını aşar */}
        <div className="ml-1 flex-shrink-0" ref={dropdownRef}>
          <button
            ref={districtBtnRef}
            onClick={toggleDistrictMenu}
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono whitespace-nowrap transition-colors ${
              districtOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin size={10} />
            İlçeler
            <ChevronDown size={9} className={`transition-transform ${districtOpen ? "rotate-180" : ""}`} />
          </button>
          {districtOpen && menuPos && (
            <div
              className="fixed w-40 bg-background border border-border rounded-md shadow-xl z-[999] overflow-hidden"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <div className="py-0.5 max-h-64 overflow-y-auto scrollbar-thin">
                {DISTRICTS.map(d => (
                  <button
                    key={d.slug}
                    onClick={() => { navigate(`/ilce/${d.slug}`); setDistrictOpen(false); }}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono text-foreground hover:bg-muted/40 transition-colors text-left"
                  >
                    <span>{d.emoji}</span> {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
