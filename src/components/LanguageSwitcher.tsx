// M13: Dil Seçici Bileşeni (Header'a eklenir)
import { useRef, useState, useEffect } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useTranslation, LANGUAGE_LABELS, type Language } from "@/hooks/useTranslation";

export const LanguageSwitcher = () => {
  const { lang, setLang } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <Globe size={10} />
        {lang.toUpperCase()}
        <ChevronDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-36 bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden">
          {(Object.entries(LANGUAGE_LABELS) as [Language, string][]).map(([code, label]) => (
            <button
              key={code}
              onClick={() => { setLang(code); setOpen(false); }}
              className={`w-full flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono text-left transition-colors hover:bg-muted/40 ${
                lang === code ? "text-primary bg-primary/5" : "text-foreground"
              }`}
            >
              {label}
              {lang === code && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
