import React, { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useOptionalAccessibility } from "@/contexts/AccessibilityContext";
import { getPanelHelpText } from "@/data/panelHelpCatalog";

interface PanelHelpTooltipProps {
  panelTitle: string;
  customHelpText?: string;
}

export const PanelHelpTooltip: React.FC<PanelHelpTooltipProps> = ({
  panelTitle,
  customHelpText,
}) => {
  const { lang } = useTranslation();
  const a11y = useOptionalAccessibility();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const helpSentence = customHelpText || getPanelHelpText(panelTitle, lang, a11y?.viewMode);
  const heading = lang === "en" ? "What does this panel do?" : "Bu panel ne işe yarar?";

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`${heading} — ${panelTitle}`}
        aria-expanded={open}
        title={helpSentence}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors"
      >
        <HelpCircle size={12} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-[80] w-64 rounded-md border border-border bg-popover px-3 py-2 shadow-xl text-left normal-case tracking-normal pointer-events-auto"
        >
          <div className="text-[10px] font-mono font-semibold text-primary mb-0.5">
            {heading}
          </div>
          <p className="text-[11px] font-sans leading-relaxed text-popover-foreground">
            {helpSentence}
          </p>
        </div>
      )}
    </div>
  );
};
