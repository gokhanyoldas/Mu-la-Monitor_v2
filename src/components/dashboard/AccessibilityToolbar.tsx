import React, { useState, useRef, useEffect } from "react";
import { Eye, Sparkles, Contrast, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useOptionalAccessibility } from "@/contexts/AccessibilityContext";
import { useTranslation } from "@/hooks/useTranslation";

export const AccessibilityToolbar: React.FC = () => {
  const a11y = useOptionalAccessibility();
  const { lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  if (!a11y) return null;

  const {
    viewMode,
    toggleViewMode,
    fontScale,
    increaseFontScale,
    decreaseFontScale,
    canIncreaseFont,
    canDecreaseFont,
    highContrast,
    toggleHighContrast,
  } = a11y;

  const isCitizen = viewMode === "citizen";
  const isEn = lang === "en";

  const modeLabel = isEn
    ? isCitizen
      ? "Citizen"
      : "Analyst"
    : isCitizen
    ? "Sade Mod"
    : "Uzman";

  const modeTitle = isEn
    ? isCitizen
      ? "Plain Citizen Mode active — click to switch to Expert Analyst Mode"
      : "Expert Analyst Mode active — click to switch to Plain Citizen Mode"
    : isCitizen
    ? "Sade Vatandaş Modu açık — Uzman Analist Moduna geçmek için tıklayın"
    : "Uzman Analist Modu açık — Sade Vatandaş Moduna geçmek için tıklayın";

  const contrastTitle = isEn
    ? highContrast
      ? "High readability contrast active"
      : "Enable high readability contrast"
    : highContrast
    ? "Yüksek okunabilirlik kontrastı açık"
    : "Yüksek okunabilirlik kontrastını aç";

  const scaleBadge = fontScale === "xlarge" ? "125%" : fontScale === "large" ? "112%" : "100%";
  const hasCustomDisplay = isCitizen || highContrast || fontScale !== "normal";
  const triggerLabel = isEn ? "Display" : "Görünüm";
  const triggerAria = isEn
    ? "Display and accessibility settings menu"
    : "Görünüm ve erişilebilirlik ayarları menüsü";

  return (
    <div
      ref={containerRef}
      className="relative flex items-center flex-shrink-0"
      role="group"
      aria-label={isEn ? "Display and accessibility controls" : "Görünüm ve erişilebilirlik araçları"}
    >
      {/* Tek zarif Görünüm menüsü tetikleyicisi — 13" dizüstü ve mobilde üst barı sıkıştırmaz */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={triggerAria}
        title={triggerAria}
        data-testid="display-menu-trigger"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-mono whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
          open || hasCustomDisplay
            ? "bg-primary/15 text-primary border-primary/40 font-semibold"
            : "bg-muted/20 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted/40"
        }`}
      >
        <SlidersHorizontal size={12} aria-hidden="true" />
        <span>{triggerLabel}</span>
        {isCitizen && (
          <span className="hidden sm:inline text-[9px] px-1 py-0.2 rounded bg-primary/20 text-primary">
            {isEn ? "Plain" : "Sade"}
          </span>
        )}
        <ChevronDown
          size={10}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Açılır Görünüm Paneli (DOM'da erişilebilir tutulur, kapalıyken hidden ile gizlenir) */}
      <div
        role="menu"
        aria-label={triggerAria}
        data-testid="display-menu-panel"
        className={`${
          open ? "block" : "hidden"
        } absolute top-full right-0 mt-1.5 w-64 rounded-lg border border-border bg-background/95 backdrop-blur-md shadow-2xl z-[100] p-3 space-y-3`}
      >
        {/* 1. Görünüm Modu: Sade / Uzman */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isEn ? "Reading Mode" : "Okuma Modu"}
            </span>
            <span className="text-[10px] font-mono text-primary font-semibold">{modeLabel}</span>
          </div>
          <button
            type="button"
            onClick={toggleViewMode}
            aria-pressed={isCitizen}
            aria-label={modeTitle}
            title={modeTitle}
            data-testid="view-mode-toggle"
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border text-xs font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isCitizen
                ? "bg-primary/20 text-primary border-primary/40 font-semibold"
                : "bg-muted/20 text-foreground border-border/60 hover:bg-muted/40"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {isCitizen ? <Eye size={13} aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
              <span>{modeLabel}</span>
            </span>
            <span className="text-[10px] opacity-75">
              {isEn
                ? isCitizen
                  ? "Switch to Analyst"
                  : "Switch to Plain"
                : isCitizen
                ? "Uzman'a geç"
                : "Sade'ye geç"}
            </span>
          </button>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {isEn
              ? isCitizen
                ? "Larger text, higher contrast, plain everyday labels."
                : "Technical indicators, sensor feeds, and full metadata."
              : isCitizen
              ? "Daha büyük yazı, yüksek kontrast ve günlük dil."
              : "Teknik göstergeler, sensör etiketleri ve tüm detaylar."}
          </p>
        </div>

        {/* 2. Yazı Boyutu (A- / A+) */}
        <div className="pt-2 border-t border-border/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {isEn ? "Text Size" : "Yazı Boyutu"}
            </span>
            <span className="text-[10px] font-mono tabular-nums-stat text-foreground/80">
              {scaleBadge}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={decreaseFontScale}
              disabled={!canDecreaseFont}
              data-testid="font-decrease-btn"
              title={isEn ? `Decrease font size (${scaleBadge})` : `Yazı boyutunu küçült (${scaleBadge})`}
              aria-label={isEn ? "Decrease font size" : "Yazı boyutunu küçült"}
              className="px-2.5 py-1.5 rounded-md border border-border/60 bg-muted/20 text-xs font-mono text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              A-
            </button>
            <button
              type="button"
              onClick={increaseFontScale}
              disabled={!canIncreaseFont}
              data-testid="font-increase-btn"
              title={isEn ? `Increase font size (${scaleBadge})` : `Yazı boyutunu büyüt (${scaleBadge})`}
              aria-label={isEn ? "Increase font size" : "Yazı boyutunu büyüt"}
              className="px-2.5 py-1.5 rounded-md border border-border/60 bg-muted/20 text-xs font-mono text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              A+
            </button>
          </div>
        </div>

        {/* 3. Yüksek Kontrast */}
        <div className="pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={toggleHighContrast}
            aria-pressed={highContrast}
            data-testid="contrast-toggle-btn"
            title={contrastTitle}
            aria-label={contrastTitle}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              highContrast
                ? "bg-primary/20 text-primary border-primary/40 font-semibold"
                : "bg-muted/20 text-foreground border-border/60 hover:bg-muted/40"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Contrast size={13} aria-hidden="true" />
              <span>{isEn ? "High Contrast" : "Yüksek Kontrast"}</span>
            </span>
            <span className="text-[10px] uppercase">
              {highContrast ? (isEn ? "ON" : "AÇIK") : isEn ? "OFF" : "KAPALI"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
