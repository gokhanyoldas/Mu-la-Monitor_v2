// supabase/functions/dispatch-digest/index.ts
// Muğla Monitör v2 — KVKK/İYS Uyumlu Günlük Bülten & Telegram Dağıtımı
//
// İki mod:
//   { "mode": "digest" }                    → günlük sabah özeti (pg_cron 07:15)
//   { "mode": "verify", email, token }      → çift onay (double opt-in) doğrulama e-postası
//
// Davranış:
//   • TELEGRAM_BOT_TOKEN + TELEGRAM_CHANNEL_ID varsa public kanala özet yayınlar.
//   • Aktif telegram_subscribers için ilçe filtreli özet gönderir.
//   • RESEND_API_KEY veya BREVO_API_KEY varsa 'active' abonelere HTML bülten gönderir
//     (ilçe bazlı kişiselleştirme + zorunlu 1-tık çıkış bağlantısı).
//   • Sağlayıcı anahtarları yoksa HİÇBİR canlı işlem yapmaz; açıklayıcı JSON döner.
//
// Kimlik doğrulama: yalnızca iç servis / cron (INTERNAL_FUNCTION_SECRET veya service_role).

import { handleCorsPreflight } from "../_shared/cors.ts";
import { authorizeRequest } from "../_shared/auth.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Sabitler ───────────────────────────────────────────────────────────────
const PUBLIC_SITE_URL =
  Deno.env.get("SITE_URL") ||
  Deno.env.get("APP_URL") ||
  "https://muglamonitor.vercel.app";

// Bir çalıştırmada gönderilecek en fazla e-posta (edge fonksiyon zaman aşımını korur)
const EMAIL_BATCH_LIMIT = 200;
const TELEGRAM_SUBSCRIBER_LIMIT = 500;

const CANONICAL_DISTRICTS = [
  "Bodrum", "Datça", "Dalaman", "Fethiye", "Kavaklıdere",
  "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca",
  "Seydikemer", "Ula", "Yatağan",
];

// ─── Yardımcılar ────────────────────────────────────────────────────────────
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normTr(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function canonicalDistrict(value: string): string | null {
  const n = normTr(value);
  return CANONICAL_DISTRICTS.find((d) => normTr(d) === n) ?? null;
}

function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "numeric",
      month: "long",
      year: "numeric",
      weekday: "long",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function sentimentLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

interface DistrictPulse {
  district: string;
  post_count: number | null;
  avg_sentiment: number | null;
  positive_count: number | null;
  negative_count: number | null;
  latest_at: string | null;
  disaster_count: number | null;
  infra_count: number | null;
  governance_count: number | null;
  tourism_count: number | null;
}

interface AlertRow {
  type: string | null;
  severity: string | null;
  title: string;
  body: string | null;
  source: string | null;
  created_at: string;
}

/** Parses "Ad Soyad <eposta@alan>" → { name, email }. */
function parseFromAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1] || "Muğla Monitör", email: match[2].trim() };
  }
  return { name: "Muğla Monitör", email: raw.trim() };
}

function getEmailProvider(): { provider: "resend" | "brevo"; apiKey: string; from: string } | null {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  const from = Deno.env.get("NEWSLETTER_FROM_EMAIL") || "Muğla Monitör <onboarding@resend.dev>";
  if (resendKey) return { provider: "resend", apiKey: resendKey, from };
  if (brevoKey) return { provider: "brevo", apiKey: brevoKey, from };
  return null;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; provider: string; error?: string }> {
  const config = getEmailProvider();
  if (!config) return { ok: false, provider: "none", error: "email_provider_not_configured" };

  const sender = parseFromAddress(config.from);

  try {
    if (config.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.from, to: [to], subject, html }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, provider: "resend", error: `HTTP ${res.status} ${detail.slice(0, 200)}` };
      }
      return { ok: true, provider: "resend" };
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, provider: "brevo", error: `HTTP ${res.status} ${detail.slice(0, 200)}` };
    }
    return { ok: true, provider: "brevo" };
  } catch (e) {
    return { ok: false, provider: config.provider, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Bülten içeriği ─────────────────────────────────────────────────────────
function filterPulse(pulse: DistrictPulse[], districts: string[] | null): DistrictPulse[] {
  const sorted = [...pulse].sort((a, b) => (b.post_count ?? 0) - (a.post_count ?? 0));
  if (!districts || districts.length === 0) return sorted;
  const wanted = new Set(districts.map((d) => normTr(canonicalDistrict(d) ?? d)));
  return sorted.filter((p) => wanted.has(normTr(p.district)));
}

function filterAlerts(alerts: AlertRow[]): AlertRow[] {
  const important = alerts.filter(
    (a) => a.severity && !["info", "bilgi", "low", "düşük"].includes(String(a.severity).toLowerCase()),
  );
  return (important.length > 0 ? important : alerts).slice(0, 5);
}

/** Telegram kanalı / abone mesajı — HTML parse_mode (dinamik içerik escape edilir). */
function buildTelegramDigest(opts: {
  summary: string | null;
  pulse: DistrictPulse[];
  alerts: AlertRow[];
  districts: string[] | null;
}): string {
  const parts: string[] = [];
  parts.push("🌅 <b>Muğla Monitör — Günlük Şehir Bülteni</b>");
  parts.push(`📅 ${escapeHtml(todayLabel())}`);

  if (opts.summary) {
    parts.push("");
    parts.push("📰 <b>Günün Özeti</b>");
    parts.push(escapeHtml(opts.summary.trim()).slice(0, 1800));
  }

  const pulse = filterPulse(opts.pulse, opts.districts);
  if (pulse.length > 0) {
    parts.push("");
    parts.push("🏙️ <b>İlçe Nabzı (son 24 saat)</b>");
    const lines = pulse.map(
      (p) =>
        `• <b>${escapeHtml(p.district)}</b>: ${p.post_count ?? 0} gönderi · duygu ${sentimentLabel(p.avg_sentiment)}`,
    );
    parts.push(lines.join("\n"));
  }

  const alerts = filterAlerts(opts.alerts);
  if (alerts.length > 0) {
    parts.push("");
    parts.push("⚠️ <b>Öne Çıkan Uyarılar</b>");
    const lines = alerts.map((a) => {
      const sev = a.severity ? `[${escapeHtml(String(a.severity).toUpperCase())}] ` : "";
      return `• ${sev}${escapeHtml(a.title)}`;
    });
    parts.push(lines.join("\n"));
  }

  parts.push("");
  parts.push("— Muğla Monitör · yaşayan şehir istihbaratı");
  parts.push("Bülteni durdurmak için: /durdur");
  return parts.join("\n");
}

/** E-posta HTML bülteni — responsive, ilçe bazlı kişiselleştirilmiş, zorunlu çıkış bağlantılı. */
function buildNewsletterEmail(opts: {
  summary: string | null;
  pulse: DistrictPulse[];
  alerts: AlertRow[];
  districts: string[] | null;
  unsubscribeUrl: string;
}): string {
  const pulse = filterPulse(opts.pulse, opts.districts);
  const alerts = filterAlerts(opts.alerts);

  const scopeLabel =
    opts.districts && opts.districts.length > 0
      ? `${opts.districts.join(", ")} seçili ilçeler`
      : "Tüm Muğla (13 ilçe)";

  const pulseRows = pulse
    .map(
      (p) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;">${escapeHtml(p.district)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;text-align:right;">${p.post_count ?? 0} gönderi</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#334155;text-align:right;">${sentimentLabel(p.avg_sentiment)}</td>
        </tr>`,
    )
    .join("");

  const alertItems = alerts
    .map(
      (a) =>
        `<li style="margin:6px 0;color:#0f172a;"><strong>${escapeHtml(String(a.severity ?? "").toUpperCase())}</strong> — ${escapeHtml(a.title)}</li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Muğla Monitör — Günlük Bülten</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px 12px;">
      <div style="background:#0f172a;border-radius:14px 14px 0 0;padding:20px 24px;">
        <div style="color:#38bdf8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Muğla Monitör</div>
        <div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:4px;">Günlük Şehir Bülteni</div>
        <div style="color:#94a3b8;font-size:13px;margin-top:4px;">${escapeHtml(todayLabel())} · ${escapeHtml(scopeLabel)}</div>
      </div>

      <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
        ${
          opts.summary
            ? `<h2 style="font-size:15px;color:#0f172a;margin:0 0 8px;">📰 Günün Özeti</h2>
               <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px;">${escapeHtml(opts.summary.trim())}</p>`
            : ""
        }

        ${
          pulse.length > 0
            ? `<h2 style="font-size:15px;color:#0f172a;margin:0 0 8px;">🏙️ İlçe Nabzı (son 24 saat)</h2>
               <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px;">
                 ${pulseRows}
               </table>`
            : ""
        }

        ${
          alertItems
            ? `<h2 style="font-size:15px;color:#0f172a;margin:0 0 8px;">⚠️ Öne Çıkan Uyarılar</h2>
               <ul style="padding-left:18px;font-size:14px;line-height:1.6;margin:0 0 20px;">${alertItems}</ul>`
            : ""
        }
      </div>

      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px;padding:18px 24px;text-align:center;">
        <p style="font-size:12px;color:#64748b;margin:0 0 10px;">
          Bu bülteni Muğla Monitör'e kaydolduğunuz için alıyorsunuz (KVKK/İYS onayı).
        </p>
        <a href="${opts.unsubscribeUrl}" style="display:inline-block;font-size:12px;color:#0ea5e9;text-decoration:underline;">
          Tek tıkla abonelikten çık
        </a>
      </div>

      <p style="font-size:11px;color:#94a3b8;text-align:center;margin:16px 0 0;">
        Muğla Monitör · yaşayan şehir istihbarat platformu · 13 ilçe
      </p>
    </div>
  </body>
</html>`;
}

function buildVerificationEmail(verifyUrl: string): string {
  return `<!doctype html>
<html lang="tr">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 12px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px 24px;text-align:center;">
        <div style="color:#0ea5e9;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Muğla Monitör</div>
        <h1 style="font-size:20px;color:#0f172a;margin:8px 0 12px;">Aboneliğinizi doğrulayın</h1>
        <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px;">
          Günlük Muğla bültenine kaydınızı tamamlamak için aşağıdaki düğmeye tıklayın.
          Bu adım KVKK/İYS kapsamında Çift Onay (double opt-in) için zorunludur.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
          Aboneliğimi doğrula
        </a>
        <p style="font-size:12px;color:#94a3b8;margin:20px 0 0;">
          Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

// ─── Mod: doğrulama e-postası ───────────────────────────────────────────────
async function handleVerify(body: Record<string, unknown>): Promise<Response> {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!email || !token) {
    return json({ ok: false, error: "missing_email_or_token" }, 400);
  }

  if (!getEmailProvider()) {
    return json({
      ok: true,
      skipped: true,
      reason: "email_provider_not_configured",
      hint: "RESEND_API_KEY veya BREVO_API_KEY secret'ı tanımlandığında doğrulama e-postası gönderilir.",
      email,
    });
  }

  const verifyUrl = `${PUBLIC_SITE_URL}/?newsletter_verify=${encodeURIComponent(token)}`;
  const result = await sendEmail(
    email,
    "Muğla Monitör — Aboneliğinizi doğrulayın",
    buildVerificationEmail(verifyUrl),
  );

  if (!result.ok) {
    return json({ ok: false, provider: result.provider, error: result.error, email }, 502);
  }
  return json({ ok: true, sent: true, provider: result.provider, email });
}

// ─── Mod: günlük bülten dağıtımı ────────────────────────────────────────────
async function handleDigest(supabase: SupabaseClient): Promise<Response> {
  const [summaryRes, pulseRes, alertsRes] = await Promise.all([
    supabase
      .from("ai_summaries")
      .select("summary, date, generated_at")
      .eq("type", "executive")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("district_pulse")
      .select("district, post_count, avg_sentiment, positive_count, negative_count, latest_at, disaster_count, infra_count, governance_count, tourism_count"),
    supabase
      .from("alert_events")
      .select("type, severity, title, body, source, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const summary: string | null = summaryRes.data?.summary ?? null;
  const pulse: DistrictPulse[] = Array.isArray(pulseRes.data) ? (pulseRes.data as DistrictPulse[]) : [];
  const alerts: AlertRow[] = Array.isArray(alertsRes.data) ? (alertsRes.data as AlertRow[]) : [];

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const channelId = Deno.env.get("TELEGRAM_CHANNEL_ID");
  const telegramChannelConfigured = Boolean(botToken && channelId);
  const emailConfigured = Boolean(getEmailProvider());

  const result = {
    ok: true,
    date: todayLabel(),
    data: { summary: Boolean(summary), districts: pulse.length, alerts: alerts.length },
    telegram: { channel: "skipped", subscribers: { total: 0, sent: 0, failed: 0, skipped: true } },
    email: { skipped: true, total: 0, sent: 0, failed: 0, truncated: false },
    reasons: [] as string[],
  };

  // ── Telegram kanalı ──
  if (telegramChannelConfigured) {
    const channelMessage = buildTelegramDigest({ summary, pulse, alerts, districts: null });
    const send = await sendTelegramMessage(botToken!, channelId!, channelMessage);
    result.telegram.channel = send.ok ? "sent" : `failed: ${send.error}`;
  } else {
    result.reasons.push("telegram_channel_not_configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)");
  }

  // ── Telegram ilçe filtreli aboneler ──
  if (botToken) {
    result.telegram.subscribers.skipped = false;
    const { data: subs } = await supabase
      .from("telegram_subscribers")
      .select("chat_id, username, districts")
      .eq("is_active", true)
      .limit(TELEGRAM_SUBSCRIBER_LIMIT);

    const rows = Array.isArray(subs) ? subs : [];
    result.telegram.subscribers.total = rows.length;

    for (const sub of rows) {
      const districts = Array.isArray(sub.districts) ? (sub.districts as string[]) : [];
      const message = buildTelegramDigest({
        summary: districts.length === 0 ? summary : null,
        pulse,
        alerts,
        districts: districts.length === 0 ? null : districts,
      });
      const send = await sendTelegramMessage(botToken, sub.chat_id as number, message);
      if (send.ok) result.telegram.subscribers.sent += 1;
      else result.telegram.subscribers.failed += 1;
    }
  } else {
    result.reasons.push("telegram_bot_not_configured (TELEGRAM_BOT_TOKEN)");
  }

  // ── E-posta bülteni ──
  if (emailConfigured) {
    result.email.skipped = false;
    const { data: emailSubs } = await supabase
      .from("newsletter_subscribers")
      .select("email, districts, unsubscribe_token")
      .eq("status", "active")
      .limit(EMAIL_BATCH_LIMIT + 1);

    const rows = Array.isArray(emailSubs) ? emailSubs : [];
    if (rows.length > EMAIL_BATCH_LIMIT) {
      result.email.truncated = true;
      rows.length = EMAIL_BATCH_LIMIT;
    }
    result.email.total = rows.length;

    for (const sub of rows) {
      const districts = Array.isArray(sub.districts) ? (sub.districts as string[]) : [];
      const unsubscribeUrl = `${PUBLIC_SITE_URL}/?newsletter_unsubscribe=${encodeURIComponent(String(sub.unsubscribe_token))}`;
      const html = buildNewsletterEmail({
        summary: districts.length === 0 ? summary : null,
        pulse,
        alerts,
        districts: districts.length === 0 ? null : districts,
        unsubscribeUrl,
      });
      const send = await sendEmail(String(sub.email), "Muğla Monitör — Günlük Şehir Bülteni", html);
      if (send.ok) result.email.sent += 1;
      else result.email.failed += 1;
    }
  } else {
    result.reasons.push("email_provider_not_configured (RESEND_API_KEY / BREVO_API_KEY)");
  }

  return json(result);
}

// ─── Giriş noktası ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req, false);
  if (preflight) return preflight;

  const authCheck = await authorizeRequest(req, {
    allowInternal: true,
    allowUser: false,
    allowCors: false,
  });
  if (!authCheck.ok) return authCheck.response;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service credentials not configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    if (body.mode === "verify") return await handleVerify(body);
    return await handleDigest(supabase);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
