// tourism-data-checker — Haftalık Kültür ve Turizm Bakanlığı veri bülteni kontrolü.
// KTB'nin açık istatistik sayfasını tarar; yeni dönem (örn. "2025 Ç3", "2025 Yıllık")
// tespit ederse alert_events'e uyarı düşer. Kullanıcı onayıyla referans değerler
// güncellenir — yanlış veri çekme riski yok (parse değil, tespit).

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KTB_URL = "https://www.ktb.gov.tr/TR-213203/resmi-turizm-istatistikleri.html";

// Bilinen dönem desenleri (bülten başlıklarından)
const TUIK_URL = "https://veriportali.tuik.gov.tr/tr/press/54158/metadata";

const PERIOD_PATTERNS = [
  /2025[\s\-_/]*(ç|c)([1-4])/gi,
  /2025[\s\-_/]*çeyrek/gi,
  /2025[\s\-_/]*(yıllık|yil)/gi,
  /ocak[\s\-]*(şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)[\s\-]*2025/gi,
];

async function fetchKtbPage(): Promise<string> {
  const res = await fetch(KTB_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`KTB HTTP ${res.status}`);
  return await res.text();
}

function detectPeriods(html: string): string[] {
  const found = new Set<string>();
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const pat of PERIOD_PATTERNS) {
    const matches = text.match(pat) ?? [];
    for (const m of matches.slice(0, 3)) found.add(m.trim());
  }
  return [...found];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Son kontrol zamanını oku (gereksiz tekrar uyarısı önlemi)
    const { data: lastCheck } = await sb.from("alert_events")
      .select("created_at, metadata")
      .eq("source", "Turizm Veri Kontrolü")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let html = "";
    try { html = await fetchKtbPage(); } catch { /* KTB erişilemezse TÜİK dene */ }
    let periods = html ? detectPeriods(html) : [];
    if (periods.length === 0) {
      try {
        const res = await fetch(TUIK_URL, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15000) });
        if (res.ok) periods = detectPeriods(await res.text());
      } catch { /* her iki kaynak da erişilemedi */ }
    }

    // Daha önce bildirilen dönemlerle karşılaştır
    const previousPeriods = new Set(
      (lastCheck?.metadata as { periods?: string[] } | null)?.periods ?? []
    );
    const newPeriods = periods.filter(p => !previousPeriods.has(p));

    let alerted = false;
    if (newPeriods.length > 0) {
      // Son kontrolden 6+ gün geçmişse veya yeni dönem varsa uyarı
      const lastCheckTime = lastCheck?.created_at ? new Date(lastCheck.created_at).getTime() : 0;
      const daysSince = (Date.now() - lastCheckTime) / 86400e3;

      if (daysSince > 6 || !lastCheck) {
        await sb.from("alert_events").insert({
          type: "system",
          severity: "medium",
          title: `Yeni turizm verisi mevcut: ${newPeriods[0]}`,
          body: `Kültür ve Turizm Bakanlığı sayfasında ${newPeriods.length} yeni dönem tespit edildi: ${newPeriods.join(", ")}. ` +
                `data-scrape/fetchTourism referans değerlerini güncellemek için onayınız gerekli.`,
          source: "Turizm Veri Kontrolü",
          metadata: { periods, new_periods: newPeriods, ktb_url: KTB_URL },
        });
        alerted = true;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        periods_found: periods,
        new_periods: newPeriods,
        alerted,
        last_check: lastCheck?.created_at ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
