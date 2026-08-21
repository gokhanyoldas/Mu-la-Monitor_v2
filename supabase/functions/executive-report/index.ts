// executive-report — Gemini destekli günlük/haftalık 1 sayfalık yönetici özeti.
// Son 24 saatin (veya 7 günün) ilçe bazlı nabzı + kritik olaylar + duygu
// trendini işleyip yapılandırılmış rapor üretir; ai_summaries'e 'executive'
// tipiyle kaydeder (UI'daki AIStrategyPanel + yeni ExecutiveReportPanel okur).

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

interface DistrictStat {
  district: string; post_count: number; negative_count: number; positive_count: number;
  avg_sentiment: number; disaster_count: number; infra_count: number;
  tourism_count: number; governance_count: number;
}

async function gatherContext(sb: ReturnType<typeof createClient>, periodHours: number) {
  const since = new Date(Date.now() - periodHours * 3600e3).toISOString();

  const { data: pulse } = await sb.from("district_pulse").select("*");
  const { data: alerts } = await sb.from("alert_events").select("type, severity, title, created_at")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(15);
  const { data: topPosts } = await sb.from("social_posts")
    .select("district, category, sentiment, content, platform, published_at")
    .gte("published_at", since).eq("is_duplicate", false)
    .order("published_at", { ascending: false }).limit(60);

  // İlçe bazlı en çok şikayet (negatif) başlıkları
  const complaintsByDistrict: Record<string, string[]> = {};
  for (const p of topPosts ?? []) {
    if (p.sentiment !== "negative" || !p.district) continue;
    (complaintsByDistrict[p.district] ??= []).push(String(p.content).slice(0, 80));
  }
  for (const k of Object.keys(complaintsByDistrict)) {
    complaintsByDistrict[k] = [...new Set(complaintsByDistrict[k])].slice(0, 3);
  }

  // Kategori dağılımı
  const catCount: Record<string, number> = {};
  for (const p of topPosts ?? []) {
    const c = p.category ?? "general";
    catCount[c] = (catCount[c] ?? 0) + 1;
  }

  return { pulse: (pulse ?? []) as DistrictStat[], alerts: alerts ?? [], complaintsByDistrict, catCount, totalPosts: topPosts?.length ?? 0 };
}

function buildPrompt(ctx: Awaited<ReturnType<typeof gatherContext>>, period: string): string {
  const pulseLines = ctx.pulse
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 13)
    .map(d => `- ${d.district}: ${d.post_count} gönderi, ${d.negative_count} negatif, ort. duygu ${(d.avg_sentiment ?? 0).toFixed(2)} (afet:${d.disaster_count}, altyapı:${d.infra_count}, turizm:${d.tourism_count}, yönetim:${d.governance_count})`)
    .join("\n");

  const alertLines = ctx.alerts.slice(0, 10)
    .map(a => `- [${a.severity}] ${a.title} (${new Date(a.created_at).toLocaleString("tr-TR")})`)
    .join("\n");

  const complaintLines = Object.entries(ctx.complaintsByDistrict)
    .map(([d, items]) => `- ${d}: ${items.slice(0, 3).join(" | ")}`)
    .join("\n");

  return `Sen Muğla Büyükşehir Belediyesi'nin yapay zeka destekli şehir istihbarat analistisin.
Aşağıdaki ${period} verileriyle TEK SAYFALIK bir yönetici özeti hazırla. Türkçe yaz.
Format tam olarak şöyle olsun (markdown başlıkları kullan):

## 1. Öne Çıkan Gelişmeler
(3-4 madde, en kritik olaylar)

## 2. İlçe Bazında Durum
(En aktif 5 ilçe için kısa değerlendirme)

## 3. Şikâyet ve Risk Haritası
(En çok şikayet edilen konular + hangi ilçede)

## 4. Duygu Trendi
(Genel bölgesel hava: olumlu/olumsuz yön ve kısa gerekçe)

## 5. Önerilen Aksiyonlar
(3 somut, uygulanabilir öneri)

VERİLER:
Toplam analiz edilen içerik: ${ctx.totalPosts}
Kategori dağılımı: ${JSON.stringify(ctx.catCount)}

İLÇE NABZI (son ${period}):
${pulseLines || "Veri yok"}

AKTİF UYARILAR:
${alertLines || "Aktif uyarı yok"}

İLÇE BAZLI ŞİKÂYET ÖRNEKLERİ:
${complaintLines || "Negatif içerik örneği yok"}

Kısa, net, karar vericiye yönelik yaz. Spekülasyon yapma, sadece veriye dayan.`;
}

// Gemini erişilemediğinde/anahtar yoksa veriden otomatik üretilen şablon rapor.
// UI'ın markdown başlık formatı korunur — kullanıcı kesinti hissetmez.
function buildFallbackReport(ctx: Awaited<ReturnType<typeof gatherContext>>, period: string): string {
  const CAT_TR: Record<string, string> = {
    fire_disaster: "yangın/afet", infrastructure_transport: "altyapı/ulaşım",
    tourism: "turizm", governance: "kamu yönetimi", general: "genel",
  };
  const sorted = [...ctx.pulse].sort((a, b) => b.post_count - a.post_count);
  const top5 = sorted.slice(0, 5);
  const totalNeg = ctx.pulse.reduce((s, d) => s + (d.negative_count ?? 0), 0);
  const totalPos = ctx.pulse.reduce((s, d) => s + (d.positive_count ?? 0), 0);
  const mood = totalNeg > totalPos * 1.3 ? "olumsuz eğilimli" : totalPos > totalNeg * 1.3 ? "olumlu eğilimli" : "dengeli";
  const topCat = Object.entries(ctx.catCount).sort((a, b) => b[1] - a[1])[0];

  const highlights = ctx.alerts.slice(0, 4).map(a => `- [${a.severity}] ${a.title}`).join("\n") || "- Kayda değer kritik olay yok.";
  const districtLines = top5.map(d =>
    `- **${d.district}**: ${d.post_count} içerik (${d.negative_count} olumsuz), duygu ${(d.avg_sentiment ?? 0).toFixed(2)}`
  ).join("\n") || "- Yeterli ilçe verisi yok.";
  const complaintLines = Object.entries(ctx.complaintsByDistrict).slice(0, 6)
    .map(([d, items]) => `- **${d}**: ${items.slice(0, 2).join(" | ")}`).join("\n") || "- Öne çıkan şikâyet kümesi yok.";

  return `## 1. Öne Çıkan Gelişmeler
${highlights}
- Son ${period} ${ctx.totalPosts} içerik analiz edildi; baskın tema: ${CAT_TR[topCat?.[0] ?? "general"] ?? "genel"} (${topCat?.[1] ?? 0} kayıt).

## 2. İlçe Bazında Durum
${districtLines}

## 3. Şikâyet ve Risk Haritası
${complaintLines}

## 4. Duygu Trendi
Bölgesel hava **${mood}** — ${totalNeg} olumsuz / ${totalPos} olumlu kayıt. ${totalNeg > totalPos ? "Altyapı ve afet başlıkları negatif ağırlığı artırıyor." : "Turizm odaklı olumlu içerik dengede."}

## 5. Önerilen Aksiyonlar
- En yüksek hacimli ilçelerde (${top5.slice(0, 3).map(d => d.district).join(", ") || "—"}) saha ekiplerinin durumu yerinde doğrulaması.
- Olanumsuz yoğunluklu kategoriler için proaktif kamu bilgilendirmesi yapılması.
- Kritik uyarıların belediye kriz masasıyla 4 saat içinde senkronize edilmesi.

---
*Bu rapor otomatik şablonla üretildi (Gemini devre dışı/rate-limit). Veriler canlıdır.*`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));
    const period = body.period === "weekly" ? "weekly" : "daily";
    const periodHours = period === "weekly" ? 168 : 24;
    const periodLabel = period === "weekly" ? "haftalık" : "günlük (24 saat)";

    const ctx = await gatherContext(sb, periodHours);
    let report: string;
    let source: "gemini" | "template" = "gemini";

    if (!geminiKey) {
      // Free-tier: anahtar yoksa rapor şablonla üretilir, UI asla bozulmaz
      report = buildFallbackReport(ctx, periodLabel);
      source = "template";
    } else {
      try {
        const prompt = buildPrompt(ctx, periodLabel);
        const gemRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // Free-tier dostu: kısa çıktı, düşük sıcaklık
            generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
          }),
        });
        if (!gemRes.ok) throw new Error(`Gemini ${gemRes.status}`);
        const gemData = await gemRes.json();
        report = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (!report) throw new Error("Boş Gemini yanıtı");
      } catch (err) {
        // 429 rate-limit veya ağ hatası → şablon fallback, UI kesintisiz
        console.warn("[executive-report] Gemini fallback:", err);
        report = buildFallbackReport(ctx, periodLabel);
        source = "template";
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const type = period === "weekly" ? "executive_weekly" : "executive";
    await sb.from("ai_summaries").upsert(
      { type, summary: report, generated_at: new Date().toISOString(), date: today },
      { onConflict: "type,date" },
    );

    return new Response(
      JSON.stringify({ ok: true, type, source, report, context: { totalPosts: ctx.totalPosts, districts: ctx.pulse.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
