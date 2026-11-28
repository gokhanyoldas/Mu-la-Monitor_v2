import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useOptionalAccessibility } from "@/contexts/AccessibilityContext";
import { getPanelHelpText } from "@/data/panelHelpCatalog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

  const helpSentence = customHelpText || getPanelHelpText(panelTitle, lang, a11y?.viewMode);
  const heading = lang === "en" ? "What does this panel do?" : "Bu panel ne işe yarar?";

  return (
    <div
      className="relative inline-flex items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={`${heading} — ${panelTitle}`}
            aria-expanded={open}
            className="inline-flex items-center justify-center w-5 h-5 !min-h-[20px] -my-1 rounded-full text-muted-foreground hover:text-primary data-[state=open]:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
          >
            <HelpCircle size={12} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className="z-[90] w-64 max-w-[calc(100vw-24px)] rounded-md border border-border bg-popover px-3 py-2 shadow-xl text-left normal-case tracking-normal"
        >
          <div className="text-[10px] font-mono font-semibold text-primary mb-0.5">
            {heading}
          </div>
          <p className="text-[11px] font-sans leading-relaxed text-popover-foreground">
            {helpSentence}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
};
