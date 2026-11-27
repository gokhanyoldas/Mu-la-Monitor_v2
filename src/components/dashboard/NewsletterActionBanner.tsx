// Bülten URL aksiyon baneri — ?newsletter_verify=<token> ve ?newsletter_unsubscribe=<token>
// Sayfa yüklenişinde ilgili RPC'yi çağırır ve Türkçe onay/uyarı şeridi gösterir.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";

type BannerState = { kind: "success" | "error"; message: string } | null;

export const NewsletterActionBanner = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<BannerState>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const verifyToken = searchParams.get("newsletter_verify");
    const unsubToken = searchParams.get("newsletter_unsubscribe");
    if (!verifyToken && !unsubToken) return;
    handled.current = true;

    // Parametreleri URL'den temizle (sayfa yenilenince tekrar tetiklenmesin)
    const next = new URLSearchParams(searchParams);
    next.delete("newsletter_verify");
    next.delete("newsletter_unsubscribe");
    setSearchParams(next, { replace: true });

    if (!isSupabaseClientConfigured) {
      setState({ kind: "error", message: t("Bağlantı yapılandırılmadı; lütfen daha sonra tekrar deneyin.") });
      return;
    }

    (async () => {
      try {
        if (verifyToken) {
          const { data, error } = await supabase.rpc("verify_newsletter_subscription", {
            p_token: verifyToken,
          });
          if (error) throw error;
          const res = data as { ok?: boolean; error?: string } | null;
          if (res?.ok) {
            setState({
              kind: "success",
              message: t("Aboneliğiniz doğrulandı. Bülten her sabah 07:15'te e-postanıza gelecek."),
            });
          } else {
            setState({
              kind: "error",
              message:
                res?.error === "invalid_token"
                  ? t("Doğrulama bağlantısı geçersiz veya süresi dolmuş.")
                  : t("Abonelik doğrulanamadı."),
            });
          }
        } else if (unsubToken) {
          const { data, error } = await supabase.rpc("unsubscribe_newsletter", { p_token: unsubToken });
          if (error) throw error;
          const res = data as { ok?: boolean; error?: string } | null;
          if (res?.ok) {
            setState({
              kind: "success",
              message: t("Bülten aboneliğiniz sonlandırıldı. İstediğiniz zaman yeniden abone olabilirsiniz."),
            });
          } else {
            setState({
              kind: "error",
              message:
                res?.error === "invalid_token"
                  ? t("Çıkış bağlantısı geçersiz veya süresi dolmuş.")
                  : t("Abonelik sonlandırılamadı."),
            });
          }
        }
      } catch {
        setState({ kind: "error", message: t("İşlem tamamlanamadı. Lütfen tekrar deneyin.") });
      }
    })();
  }, [searchParams, setSearchParams, t]);

  if (!state) return null;

  const isSuccess = state.kind === "success";

  return (
    <div className="px-4 sm:px-5 max-w-[1680px] mx-auto mt-3" role="status" aria-live="polite">
      <div
        className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${
          isSuccess
            ? "border-success/40 bg-success/10 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive"
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        ) : (
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
        )}
        <span className="flex-1 leading-snug">{state.message}</span>
        <button
          type="button"
          onClick={() => setState(null)}
          aria-label={t("Kapat")}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default NewsletterActionBanner;
