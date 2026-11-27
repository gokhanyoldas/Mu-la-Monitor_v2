// Günlük Muğla Bülteni — KVKK/İYS uyumlu e-posta & Telegram abonelik widget'ı
// Çift Onay (Double Opt-In): kayıt "pending" başlar, e-posta doğrulanınca aktifleşir.
import { useState } from "react";
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, ShieldCheck, MessageCircle } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase, isSupabaseClientConfigured } from "@/integrations/supabase/client";
import { DISTRICTS } from "@/data/districts";
import { resolveEnv } from "@/config/env";
import { useTranslation } from "@/hooks/useTranslation";

const CONSENT_VERSION = "v1.0";
const TELEGRAM_URL = resolveEnv("VITE_TELEGRAM_CHANNEL_URL") || "https://t.me/muglamonitor";

// Ön yüz slug -> RPC kanonik ilçe adı (Menteşe = Muğla Merkez)
const SLUG_TO_CANONICAL: Record<string, string> = {
  bodrum: "Bodrum",
  marmaris: "Marmaris",
  fethiye: "Fethiye",
  milas: "Milas",
  merkez: "Menteşe",
  datca: "Datça",
  koyceğiz: "Köyceğiz",
  ortaca: "Ortaca",
  dalaman: "Dalaman",
  seydikemer: "Seydikemer",
  ula: "Ula",
  yatağan: "Yatağan",
  kavaklidere: "Kavaklıdere",
};

type Feedback = { kind: "success" | "error"; message: string } | null;

export const NewsletterSignupWidget = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]); // boş => Tüm Muğla
  const [consent, setConsent] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const allMugla = selected.length === 0;

  const toggleDistrict = (slug: string) => {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const handleSubmit = async () => {
    setFeedback(null);
    const cleanEmail = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setFeedback({ kind: "error", message: t("Geçerli bir e-posta adresi girin.") });
      return;
    }
    if (!consent) {
      setFeedback({ kind: "error", message: t("Devam etmek için KVKK/İYS onayını işaretleyin.") });
      return;
    }
    if (!isSupabaseClientConfigured) {
      setFeedback({ kind: "error", message: t("Bağlantı yapılandırılmadı; lütfen daha sonra tekrar deneyin.") });
      return;
    }

    setSubmitting(true);
    try {
      const districts = selected
        .map((slug) => SLUG_TO_CANONICAL[slug])
        .filter((name): name is string => Boolean(name));

      const { data, error } = await supabase.rpc("subscribe_newsletter", {
        p_email: cleanEmail,
        p_districts: districts,
        p_consent_version: CONSENT_VERSION,
      });

      if (error) {
        setFeedback({ kind: "error", message: t("Abonelik kaydedilemedi. Lütfen daha sonra tekrar deneyin.") });
        return;
      }

      const res = data as { ok?: boolean; status?: string; error?: string } | null;
      if (res?.ok) {
        setFeedback({
          kind: "success",
          message:
            res.status === "active"
              ? t("Aboneliğiniz zaten aktif. Bülten her sabah 07:15'te gönderilir.")
              : t("Doğrulama e-postası gönderildi. Lütfen gelen kutunuzdaki bağlantıya tıklayarak aboneliği onaylayın."),
        });
        setEmail("");
        setSelected([]);
        setConsent(false);
      } else if (res?.error === "rate_limited") {
        setFeedback({ kind: "error", message: t("Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.") });
      } else {
        setFeedback({ kind: "error", message: t("Geçersiz e-posta adresi.") });
      }
    } catch {
      setFeedback({ kind: "error", message: t("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.") });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardPanel
      title="Günlük Muğla Bülteni"
      subtitle="E-Posta & Telegram · Her sabah 07:15"
      badge="KVKK / İYS"
      badgeVariant="info"
      icon={<Mail size={14} />}
      collapsible
      defaultOpen
    >
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t("Muğla'nın 13 ilçesinden günlük özet; trafik, hava, baraj ve uyarılar. İlçe seçmezseniz tüm Muğla gönderilir.")}
        </p>

        {/* İlçe seçimi */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
            {t("İlçe Filtresi")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelected([])}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                allMugla
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/30 text-muted-foreground border-border/60 hover:border-primary/50"
              }`}
            >
              {t("Tüm Muğla")}
            </button>
            {DISTRICTS.map((d) => {
              const active = selected.includes(d.slug);
              return (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => toggleDistrict(d.slug)}
                  aria-pressed={active}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                    active
                      ? "bg-primary/90 text-primary-foreground border-primary"
                      : "bg-secondary/30 text-muted-foreground border-border/60 hover:border-primary/50"
                  }`}
                >
                  {d.emoji} {d.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* E-posta + gönder */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("E-posta adresiniz")}
            aria-label={t("E-posta adresiniz")}
            className="h-9 text-sm flex-1"
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !consent}
            className="h-9 shrink-0"
            size="sm"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="ml-1.5">{t("Abone Ol")}</span>
          </Button>
        </div>

        {/* KVKK/İYS onay kutusu */}
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
            aria-label={t("KVKK/İYS onayı")}
          />
          <span className="text-[10px] text-muted-foreground leading-snug">
            {t("Günlük bülten için KVKK Aydınlatma Metni'ni okudum ve elektronik ileti almayı onaylıyorum (İYS).")}{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setPrivacyOpen(true);
              }}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {t("Aydınlatma Metni")}
            </button>
          </span>
        </label>

        {/* Telegram 1-tık katılım */}
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-md border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 transition-colors px-3 py-2 text-[11px] font-mono"
        >
          <MessageCircle size={14} />
          {t("Telegram kanalına katıl")}
        </a>

        {feedback && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] ${
              feedback.kind === "success"
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* KVKK Aydınlatma Metni modal */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              {t("KVKK / İYS Aydınlatma Metni")}
            </DialogTitle>
            <DialogDescription>{t("Sürüm")} {CONSENT_VERSION}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-3 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              {t("Bu bülten, Muğla Monitör tarafından 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS) kapsamında sunulur.")}
            </p>
            <p>
              <span className="text-foreground font-semibold">{t("İşlenen veriler:")}</span>{" "}
              {t("Yalnızca e-posta adresiniz, seçtiğiniz ilçeler ve onay anının tarih/saat ile IP/user-agent kaydı (denetim kanıtı).")}
            </p>
            <p>
              <span className="text-foreground font-semibold">{t("İşleme amacı:")}</span>{" "}
              {t("Günlük şehir bülteni göndermek ve çift onaylı abonelik kaydını yürütmek.")}
            </p>
            <p>
              <span className="text-foreground font-semibold">{t("Saklama süresi:")}</span>{" "}
              {t("Onay kanıtı, ispat yükümlülüğü nedeniyle 3 yıl boyunca saklanır.")}
            </p>
            <p>
              <span className="text-foreground font-semibold">{t("Haklarınız:")}</span>{" "}
              {t("Her e-postanın altındaki 'Çıkış' bağlantısıyla veya aydınlatma metnindeki iletişim kanallarıyla aboneliğinizi tek tıkla sonlandırabilirsiniz.")}
            </p>
            <p>
              {t("Abone olmadan önce çift onay gerekir: kaydınızı e-posta ile doğrulayana kadar bülten gönderilmez.")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardPanel>
  );
};

export default NewsletterSignupWidget;
