import React from "react";
import { Eye, Sparkles, Contrast } from "lucide-react";
import { useOptionalAccessibility } from "@/contexts/AccessibilityContext";
import { useTranslation } from "@/hooks/useTranslation";

export const AccessibilityToolbar: React.FC = () => {
  const a11y = useOptionalAccessibility();
  const { lang } = useTranslation();

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
  const modeLabel =
    lang === "en"
      ? isCitizen
        ? "Citizen"
        : "Analyst"
      : isCitizen
      ? "Sade Mod"
      : "Uzman";

  const modeTitle =
    lang === "en"
      ? isCitizen
        ? "Plain Citizen Mode active — click to switch to Expert Analyst Mode"
        : "Expert Analyst Mode active — click to switch to Plain Citizen Mode"
      : isCitizen
      ? "Sade Vatandaş Modu açık — Uzman Analist Moduna geçmek için tıklayın"
      : "Uzman Analist Modu açık — Sade Vatandaş Moduna geçmek için tıklayın";

  const contrastTitle =
    lang === "en"
      ? highContrast
        ? "High readability contrast active"
        : "Enable high readability contrast"
      : highContrast
      ? "Yüksek okunabilirlik kontrastı açık"
      : "Yüksek okunabilirlik kontrastını aç";

  const scaleBadge = fontScale === "xlarge" ? "125%" : fontScale === "large" ? "112%" : "100%";

  return (
    <div
      className="flex items-center gap-1 flex-shrink-0"
      role="group"
      aria-label={lang === "en" ? "Display and accessibility controls" : "Görünüm ve erişilebilirlik araçları"}
    >
      {/* 1. View Mode: Sade Vatandaş / Uzman Analist */}
      <button
        type="button"
        onClick={toggleViewMode}
        aria-pressed={isCitizen}
        title={modeTitle}
        data-testid="view-mode-toggle"
        className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
          isCitizen
            ? "bg-primary/20 text-primary border-primary/40 font-semibold"
            : "bg-muted/20 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted/40"
        }`}
      >
        {isCitizen ? <Eye size={11} /> : <Sparkles size={11} />}
        <span>{modeLabel}</span>
      </button>

      {/* 2. Font Scale (A- / A+) & High Contrast */}
      <div className="flex items-center rounded border border-border/50 bg-muted/20 overflow-hidden shrink-0">
        <button
          type="button"
          onClick={decreaseFontScale}
          disabled={!canDecreaseFont}
          data-testid="font-decrease-btn"
          title={lang === "en" ? `Decrease font size (${scaleBadge})` : `Yazı boyutunu küçült (${scaleBadge})`}
          aria-label={lang === "en" ? "Decrease font size" : "Yazı boyutunu küçült"}
          className="px-1.5 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          A-
        </button>
        <button
          type="button"
          onClick={increaseFontScale}
          disabled={!canIncreaseFont}
          data-testid="font-increase-btn"
          title={lang === "en" ? `Increase font size (${scaleBadge})` : `Yazı boyutunu büyüt (${scaleBadge})`}
          aria-label={lang === "en" ? "Increase font size" : "Yazı boyutunu büyüt"}
          className="px-1.5 py-1 text-[10px] font-mono border-l border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-35 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          A+
        </button>
        <button
          type="button"
          onClick={toggleHighContrast}
          aria-pressed={highContrast}
          data-testid="contrast-toggle-btn"
          title={contrastTitle}
          aria-label={contrastTitle}
          className={`px-1.5 py-1 border-l border-border/40 transition-colors flex items-center justify-center ${
            highContrast
              ? "bg-primary/25 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Contrast size={11} />
        </button>
      </div>
    </div>
  );
};
