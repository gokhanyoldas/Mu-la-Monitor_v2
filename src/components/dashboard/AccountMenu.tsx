import { useState, useRef, useEffect } from "react";
import { User, LogOut, Mail, ChevronDown, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { useToast } from "@/hooks/use-toast";
import {
  useNewsletterSubscription,
  resetNewsletterSubscriptionState,
} from "@/hooks/useNewsletterSubscription";
import type { User as AuthUser } from "@supabase/supabase-js";

export function formatUserShortLabel(user: AuthUser): string {
  const metaName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name.trim()
        : "";

  if (metaName) {
    return metaName.length > 20 ? `${metaName.slice(0, 19)}…` : metaName;
  }

  const email = (user.email ?? "").trim();
  if (!email) return "Hesabım";
  return email;
}

export const AccountMenu = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const { lang } = useTranslation();
  const { toast } = useToast();
  const isEn = lang === "en";

  const {
    subscribed,
    isLoading: isNewsletterLoading,
    isSaving: isNewsletterSaving,
    errorMessage,
    toggleSubscription,
  } = useNewsletterSubscription();

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!isAuthenticated || !user) {
    return null;
  }

  const displayLabel = formatUserShortLabel(user);
  const fullEmail = (user.email ?? "").trim();

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setOpen(false);
    try {
      await signOut();
      resetNewsletterSubscriptionState();
      toast({
        title: isEn ? "Signed out" : "Çıkış yapıldı",
        description: isEn
          ? "Your session has been safely closed."
          : "Oturumunuz güvenli şekilde kapatıldı.",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const handleToggleNewsletter = async () => {
    const nextValue = !subscribed;
    const saved = await toggleSubscription(nextValue);
    if (saved) {
      toast({
        title: isEn
          ? "Daily Muğla Briefing (08:30)"
          : "Günlük Muğla Gündem Bülteni (08:30)",
        description: nextValue
          ? isEn
            ? "You will receive the daily morning summary by email at 08:30."
            : "Her sabah 08:30'da e-posta adresinize günlük özet gönderilecektir."
          : isEn
            ? "Daily email briefing has been turned off."
            : "Günlük e-posta bülteni kapatıldı.",
      });
    }
  };

  const newsletterTitle = isEn
    ? "Daily Muğla Briefing (08:30)"
    : "Günlük Muğla Gündem Bülteni (08:30)";

  return (
    <div className="relative flex items-center gap-1.5 shrink-0" ref={menuRef}>
      {/* Sade kullanıcı rozeti + hesap/bülten menüsü tetikleyicisi */}
      <button
        type="button"
        data-testid="header-account-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={isEn ? `Account menu for ${fullEmail || displayLabel}` : `${fullEmail || displayLabel} hesap menüsü`}
        title={fullEmail || displayLabel}
        className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          open
            ? "bg-primary/20 border-primary/40 text-primary"
            : "bg-muted/20 border-border/50 text-foreground hover:bg-muted/40"
        }`}
      >
        <span className="w-4 h-4 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0">
          <User size={10} aria-hidden="true" />
        </span>
        <span
          data-testid="header-user-badge"
          className="max-w-[96px] sm:max-w-[140px] truncate font-medium"
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={10}
          aria-hidden="true"
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Tek tıkla Çıkış Yap / Sign Out butonu */}
      <button
        type="button"
        data-testid="header-signout-btn"
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label={isEn ? "Sign Out" : "Çıkış Yap"}
        title={isEn ? "Sign Out" : "Çıkış Yap"}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-border/50 bg-muted/15 hover:bg-destructive/15 hover:border-destructive/40 hover:text-destructive text-[10px] font-mono text-muted-foreground transition-colors whitespace-nowrap disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {signingOut ? (
          <Loader2 size={11} className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut size={11} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{isEn ? "Sign Out" : "Çıkış Yap"}</span>
      </button>

      {/* Hesap ve Günlük Bülten Menüsü */}
      {open && (
        <div
          role="dialog"
          data-testid="header-account-menu"
          aria-label={isEn ? "Account and Briefing Preferences" : "Hesap ve Bülten Tercihleri"}
          className="absolute top-full right-0 mt-1.5 w-72 bg-background border border-border rounded-lg shadow-xl z-50 overflow-hidden"
        >
          {/* Üst bilgi */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/20">
            <div className="min-w-0 pr-2">
              <div className="text-[11px] font-mono font-bold text-foreground">
                {isEn ? "My Account" : "Hesabım"}
              </div>
              {fullEmail && (
                <div className="text-[10px] font-mono text-muted-foreground truncate" title={fullEmail}>
                  {fullEmail}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={isEn ? "Close account menu" : "Hesap menüsünü kapat"}
              className="p-0.5 rounded hover:text-foreground text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </div>

          {/* Günlük Muğla Gündem Bülteni (08:30) */}
          <div className="p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-foreground leading-snug">
                  <Mail size={12} className="text-primary shrink-0" aria-hidden="true" />
                  <span>{newsletterTitle}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {isEn
                    ? "Receive Muğla's daily summary by email every morning at 08:30."
                    : "Her sabah 08:30'da e-posta adresinize günün Muğla özeti gönderilir."}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                data-testid="newsletter-optin-toggle"
                aria-checked={subscribed}
                aria-label={newsletterTitle}
                disabled={isNewsletterLoading || isNewsletterSaving}
                onClick={handleToggleNewsletter}
                className={`mt-0.5 w-9 h-5 rounded-full transition-colors flex-shrink-0 flex items-center cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  subscribed ? "bg-primary/70" : "bg-muted/50"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    subscribed ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className={subscribed ? "text-primary font-medium" : "text-muted-foreground"}>
                {isNewsletterLoading
                  ? isEn
                    ? "Loading..."
                    : "Yükleniyor..."
                  : isNewsletterSaving
                    ? isEn
                      ? "Saving..."
                      : "Kaydediliyor..."
                    : subscribed
                      ? isEn
                        ? "Active · Every morning at 08:30"
                        : "Aktif · Her sabah 08:30"
                      : isEn
                        ? "Off"
                        : "Kapalı"}
              </span>
            </div>

            {errorMessage && (
              <p className="text-[10px] font-mono text-destructive" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
