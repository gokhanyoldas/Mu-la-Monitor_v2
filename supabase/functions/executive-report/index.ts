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
    .order("published_at", { ascending: false }).limit(80);

  // İlçe bazlı en çok şikayet (negatif) başlıkları
  const complaintsByDistrict: Record<string, string[]> = {};
  for (const p of topPosts ?? []) {
    if (p.sentiment !== "negative" || !p.district) continue;
    (complaintsByDistrict[p.district] ??= []).push(String(p.content).slice(0, 120));
  }
  for (const k of Object.keys(complaintsByDistrict)) {
    complaintsByDistrict[k] = [...new Set(complaintsByDistrict[k])].slice(0, 5);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY secret eksik." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));
    const period = body.period === "weekly" ? "weekly" : "daily";
    const periodHours = period === "weekly" ? 168 : 24;

    const ctx = await gatherContext(sb, periodHours);
    const prompt = buildPrompt(ctx, period === "weekly" ? "haftalık" : "günlük (24 saat)");

    const gemRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200 },
      }),
    });
    if (!gemRes.ok) throw new Error(`Gemini API error ${gemRes.status}: ${await gemRes.text()}`);

    const gemData = await gemRes.json();
    const report = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Rapor üretilemedi.";

    const today = new Date().toISOString().split("T")[0];
    const type = period === "weekly" ? "executive_weekly" : "executive";
    await sb.from("ai_summaries").upsert(
      { type, summary: report, generated_at: new Date().toISOString(), date: today },
      { onConflict: "type,date" },
    );

    return new Response(
      JSON.stringify({ ok: true, type, report, context: { totalPosts: ctx.totalPosts, districts: ctx.pulse.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
