// src/pages/dashboard/DashboardFooter.tsx
// Alt bilgi çubuğu + "Sistem Durumu" geliştirici bağlantısı. Index.tsx'ten ayrıştırıldı.

import { useTranslation } from "@/hooks/useTranslation";

export const DashboardFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="mt-8 pt-4 pb-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans text-muted-foreground">
      <span>{t("Muğla Monitör · Şehir Bilgi Platformu")}</span>
      <button
        type="button"
        data-testid="footer-system-status-btn"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-data-quality-agent", { detail: { tab: "quality" } }));
          }
        }}
        className="text-[11px] text-muted-foreground/70 hover:text-foreground underline-offset-4 hover:underline transition-colors"
      >
        {t("Sistem Durumu")}
      </button>
    </footer>
  );
};
