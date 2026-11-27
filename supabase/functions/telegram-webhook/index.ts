// supabase/functions/telegram-webhook/index.ts
// Muğla Monitör v2 — Telegram Bot Webhook (ilçe bazlı günlük uyarılar)
//
// Desteklenen komutlar:
//   /baslat  → aboneliği başlatır (KVKK gizlilik bildirimi gönderir)
//   /ilce Bodrum, Marmaris  → ilçe filtresini ayarlar
//   /durdur  → mesajları derhal durdurur (is_active = false)
//
// Kimlik doğrulama: Telegram `X-Telegram-Bot-Api-Secret-Token` başlığı
// (TELEGRAM_WEBHOOK_SECRET) veya iç servis çağrısı (INTERNAL_FUNCTION_SECRET).
// verify_jwt = false (Telegram JWT gönderemez).

import { handleCorsPreflight } from "../_shared/cors.ts";
import { authorizeRequest, timingSafeEqual } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CANONICAL_DISTRICTS = [
  "Bodrum", "Datça", "Dalaman", "Fethiye", "Kavaklıdere",
  "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca",
  "Seydikemer", "Ula", "Yatağan",
];

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

async function reply(botToken: string, chatId: number, html: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Yanıt gönderilemese bile webhook 200 dönmeli (Telegram tekrar denemez)
  }
}

const WELCOME_MESSAGE = [
  "👋 <b>Muğla Monitör</b>'e hoş geldiniz!",
  "",
  "Size her sabah Muğla'nın 13 ilçesinden şehir özetini göndereceğiz.",
  "",
  "🔒 <b>KVKK Gizlilik Bildirimi</b>",
  "Sohbet kimliğiniz (chat_id) yalnızca bülten göndermek amacıyla saklanır.",
  "İstediğiniz zaman <b>/durdur</b> yazarak mesajları durdurabilirsiniz; verileriniz tutulmaz.",
  "",
  "📍 Belirli ilçeleri seçmek için: <code>/ilce Bodrum, Marmaris</code>",
  "Tüm Muğla için bir şey yazmanıza gerek yok.",
  "⏹️ Durmak için: <b>/durdur</b>",
].join("\n");

const HELP_MESSAGE = [
  "ℹ️ <b>Muğla Monitör komutları</b>",
  "",
  "• <b>/baslat</b> — günlük bültene katıl",
  "• <b>/ilce Bodrum, Marmaris</b> — ilçe filtresini ayarla",
  "• <b>/durdur</b> — mesajları durdur",
].join("\n");

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req, false);
  if (preflight) return preflight;

  // ── Kimlik doğrulama: iç servis VEYA Telegram secret token ──
  const internalCheck = await authorizeRequest(req, {
    allowInternal: true,
    allowUser: false,
    allowCors: false,
  });

  if (!internalCheck.ok) {
    const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const provided = (req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "").trim();
    if (!webhookSecret || !provided || !timingSafeEqual(provided, webhookSecret)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!botToken || !supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "service_not_configured" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let update: Record<string, any> = {};
  try {
    update = await req.json();
  } catch {
    return json({ ok: true, skipped: true });
  }

  const message = update?.message ?? update?.edited_message;
  const chatId = message?.chat?.id;
  const username = message?.from?.username ?? message?.chat?.username ?? null;
  const text: string = typeof message?.text === "string" ? message.text : "";

  if (typeof chatId !== "number" || !text) {
    return json({ ok: true, skipped: true });
  }

  const [rawCmd, ...rest] = text.trim().split(/\s+/);
  const command = rawCmd.toLowerCase().replace(/@\w+$/, "");

  try {
    // ── /baslat ──
    if (command === "/start" || command === "/baslat") {
      await supabase
        .from("telegram_subscribers")
        .upsert(
          { chat_id: chatId, username, is_active: true, unsubscribed_at: null },
          { onConflict: "chat_id" },
        );
      await reply(botToken, chatId, WELCOME_MESSAGE);
      return json({ ok: true, action: "subscribed" });
    }

    // ── /durdur ──
    if (command === "/stop" || command === "/durdur") {
      await supabase
        .from("telegram_subscribers")
        .update({ is_active: false, unsubscribed_at: new Date().toISOString() })
        .eq("chat_id", chatId);
      await reply(
        botToken,
        chatId,
        "⏹️ Mesajlar durduruldu. Tekrar başlamak için <b>/baslat</b> yazabilirsiniz.",
      );
      return json({ ok: true, action: "unsubscribed" });
    }

    // ── /ilce ──
    if (command === "/ilce" || command === "/ilçe") {
      const rawTokens = rest
        .join(" ")
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const districts: string[] = [];
      const unknown: string[] = [];
      for (const token of rawTokens) {
        const canonical = canonicalDistrict(token);
        if (canonical) {
          if (!districts.includes(canonical)) districts.push(canonical);
        } else {
          unknown.push(token);
        }
      }

      if (districts.length === 0) {
        await reply(
          botToken,
          chatId,
          [
            "⚠️ Geçerli ilçe bulunamadı.",
            "",
            `Geçerli ilçeler: ${CANONICAL_DISTRICTS.join(", ")}`,
            "Örnek: <code>/ilce Bodrum, Marmaris</code>",
            "Tüm Muğla için: <code>/ilce tum</code>",
          ].join("\n"),
        );
        return json({ ok: true, action: "invalid_districts", unknown });
      }

      // "tum" / "tüm" veya tüm ilçeler seçildiyse filtreyi boşalt (tüm Muğla)
      const allSelected = districts.length === CANONICAL_DISTRICTS.length;
      // normTr("tüm") === "tum"; hem "tum" hem "tüm" yazımını kapsar
      const useAll = normTr(rest.join(" ")).includes("tum") || allSelected;
      const finalDistricts = useAll ? [] : districts;

      await supabase
        .from("telegram_subscribers")
        .upsert(
          { chat_id: chatId, username, districts: finalDistricts, is_active: true, unsubscribed_at: null },
          { onConflict: "chat_id" },
        );

      const scope = useAll ? "Tüm Muğla (13 ilçe)" : finalDistricts.join(", ");
      await reply(
        botToken,
        chatId,
        `✅ İlçe filtreniz güncellendi:\n<b>${scope}</b>\n\nHer sabah bu ilçelerin özetini alacaksınız.`,
      );
      return json({ ok: true, action: "districts_updated", districts: finalDistricts });
    }

    // ── Bilinmeyen komut ──
    await reply(botToken, chatId, HELP_MESSAGE);
    return json({ ok: true, action: "help" });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
