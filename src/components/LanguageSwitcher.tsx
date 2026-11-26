// M13 + 3. Ajan: Hızlı 1-Tık TR / EN Dil Seçici Bileşeni
import { Globe } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export const LanguageSwitcher = () => {
  const { lang, setLang } = useTranslation();

  return (
    <div
      className="inline-flex items-center rounded-md border border-border/50 bg-muted/20 overflow-hidden flex-shrink-0"
      role="group"
      aria-label={lang === "en" ? "Language selector" : "Dil seçici"}
    >
      <span className="hidden sm:inline-flex items-center pl-1.5 pr-1 text-muted-foreground" aria-hidden="true">
        <Globe size={11} />
      </span>
      <button
        type="button"
        onClick={() => setLang("tr")}
        aria-pressed={lang === "tr"}
        aria-label={lang === "en" ? "Switch language to Turkish" : "Dili Türkçe yap"}
        data-testid="lang-tr"
        title="Türkçe"
        className={`px-2 py-1.5 text-[10px] font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
          lang === "tr"
            ? "bg-primary/20 text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        TR
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        aria-label={lang === "en" ? "Switch language to English" : "Dili İngilizce yap"}
        data-testid="lang-en"
        title="English"
        className={`px-2 py-1.5 text-[10px] font-mono border-l border-border/40 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
          lang === "en"
            ? "bg-primary/20 text-primary font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        EN
      </button>
    </div>
  );
};
