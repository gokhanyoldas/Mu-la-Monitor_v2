// city-briefing — Günlük "Şehir Gazetesi" + SWOT + 3-fazlı etkinlik raporu.
// Mevcut canlı veriyi (district_pulse, sosyal içerik, haberler) toplayıp
// Gemini ile tek seferde yapılandırılmış JSON üretir; ai_summaries'e
// type='briefing_<senaryo>' olarak günlük cache'lenir. Gemini yoksa/hata
// verirse veriden şablon üretilir — UI asla boş kalmaz. Free-tier: günde 1-2 çağrı.

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

interface Briefing {
  headline: string;
  story: string;
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  lifecycle: {
    before: { title: string; items: string[] };
    during: { title: string; items: string[] };
    after: { title: string; items: string[] };
  };
}

async function gatherContext(sb: ReturnType<typeof createClient>, scenario: string) {
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { data: pulse } = await sb.from("district_pulse").select("*");
  const { data: posts } = await sb.from("social_posts")
    .select("district, category, sentiment, content")
    .gte("published_at", since).eq("is_duplicate", false)
    .order("published_at", { ascending: false }).limit(50);

  const total = (pulse ?? []).reduce((s: number, d: { post_count?: number }) => s + (d.post_count ?? 0), 0);
  const neg = (pulse ?? []).reduce((s: number, d: { negative_count?: number }) => s + (d.negative_count ?? 0), 0);
  const pos = (pulse ?? []).reduce((s: number, d: { positive_count?: number }) => s + (d.positive_count ?? 0), 0);
  const topDistricts = [...(pulse ?? [])]
    .sort((a: { post_count?: number }, b: { post_count?: number }) => (b.post_count ?? 0) - (a.post_count ?? 0))
    .slice(0, 5)
    .map((d: { district?: string; post_count?: number; negative_count?: number }) =>
      `${d.district}: ${d.post_count} içerik (${d.negative_count} olumsuz)`);

  const headlines = (posts ?? []).slice(0, 10).map((p: { content?: string }) => String(p.content ?? "").slice(0, 90));

  return { total, neg, pos, topDistricts, headlines, scenario };
}

const SCENARIO_TR: Record<string, string> = {
  normal: "Normal şehir akışı",
  heatwave: "Aşırı sıcak dalgası",
  mega_tourism: "Turist/yolcu akını",
  social_tension: "Sosyal kriz/gerginlik",
  yoruk_toy: "17. Uluslararası Muğla Yörük Türkmen Toyu",
};

function buildPrompt(ctx: Awaited<ReturnType<typeof gatherContext>>): string {
  return `Sen Muğla'nın yapay zeka şehir analistisisin. Senaryo: "${SCENARIO_TR[ctx.scenario] ?? ctx.scenario}".

VERİLER (son 24 saat):
Toplam içerik: ${ctx.total}, olumlu: ${ctx.pos}, olumsuz: ${ctx.neg}
En aktif ilçeler: ${ctx.topDistricts.join(" | ") || "veri yok"}
Öne çıkan başlıklar:
${ctx.headlines.map(h => "- " + h).join("\n") || "başlık yok"}

Bu senaryo için SADECE aşağıdaki JSON şemasında geçerli JSON üret (markdown yok, açıklama yok):
{
  "headline": "Bugünün şehir manşeti (maks 12 kelime, gazete başlığı gibi, çarpıcı)",
  "story": "Günün hikâyesi: 2-3 cümlelik akıcı özet",
  "swot": {
    "strengths": ["2-3 güçlü yön, kısa madde"],
    "weaknesses": ["2-3 zayıf yön, kısa madde"],
    "opportunities": ["2-3 fırsat, kısa madde"],
    "threats": ["2-3 tehdit, kısa madde"]
  },
  "lifecycle": {
    "before": { "title": "ÖNCESİ (hazırlık)", "items": ["3 kısa madde: beklenen yoğunluk, hazırlık, kaynak planı"] },
    "during": { "title": "SIRASINDA (canlı)", "items": ["3 kısa madde: anlık izleme, yoğunluk, aktif aksiyon"] },
    "after": { "title": "SONRASI (bilanço)", "items": ["3 kısa madde: etki değerlendirmesi, öğrenilen ders, sonraki adım"] }
  }
}

Kurallar: Türkçe yaz. Veriye dayan, spekülasyonu minimumda tut. Maddeler kısa ve vurucu olsun (her biri maks 12 kelime).`;
}

function buildFallback(ctx: Awaited<ReturnType<typeof gatherContext>>): Briefing {
  const name = SCENARIO_TR[ctx.scenario] ?? "şehir akışı";
  const mood = ctx.neg > ctx.pos ? "gergin" : "dengeli";
  const top = ctx.topDistricts[0]?.split(":")[0] ?? "Muğla";
  return {
    headline: `${top} odağında ${name.toLowerCase()}: ${ctx.total} içerik izlendi`,
    story: `Son 24 saatte ${ctx.total} içerik analiz edildi; bölgesel hava ${mood}. En aktif ilçe ${top}. Sistem ${name.toLowerCase()} senaryosunu izlemeye devam ediyor.`,
    swot: {
      strengths: ["Güçlü veri altyapısı ve 13 ilçe kapsaması", "Yüksek izleme frekansı (15 dk)"],
      weaknesses: ["Sosyal kaynak çeşitliliği sınırlı", "İlçe bazlı saha doğrulaması eksik"],
      opportunities: ["Turizm sezonu veri zenginliği", "Protokol entegrasyonu ile hızlı koordinasyon"],
      threats: ["Ani olaylarda veri gecikmesi", "Tek kaynak bağımlılığı riski"],
    },
    lifecycle: {
      before: { title: "ÖNCESİ (hazırlık)", items: [`${ctx.total} içerikle baz oluşturuldu`, "Risk matrisi güncellendi", "İzleme frekansı optimize edildi"] },
      during: { title: "SIRASINDA (canlı)", items: [`${top} başta olmak üzere canlı izleme`, "Duygu skoru anlık hesaplanıyor", "Anomali taraması 10 dk'da bir"] },
      after: { title: "SONRASI (bilanço)", items: ["Tahmin-gerçekleşen karşılaştırması", "İlçe etki skorları raporlanacak", "Öğrenilen dersler kayda geçecek"] },
    },
  };
}

function extractJson(text: string): Briefing | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    if (parsed.headline && parsed.swot && parsed.lifecycle) return parsed as Briefing;
    return null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const body = await req.json().catch(() => ({}));
    const scenario = typeof body.scenario === "string" ? body.scenario : "normal";
    const force = body.force === true;
    const today = new Date().toISOString().split("T")[0];
    const type = `briefing_${scenario}`;

    // Günlük cache — aynı senaryo günde bir kez üretilir (force hariç)
    if (!force) {
      const { data: cached } = await sb.from("ai_summaries")
        .select("summary").eq("type", type).eq("date", today).maybeSingle();
      if (cached?.summary) {
        return new Response(
          JSON.stringify({ ok: true, source: "cache", briefing: JSON.parse(cached.summary) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const ctx = await gatherContext(sb, scenario);
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    let briefing: Briefing;
    let source: "gemini" | "template" = "gemini";

    if (!geminiKey) {
      briefing = buildFallback(ctx);
      source = "template";
    } else {
      try {
        const gemRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(ctx) }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 900, responseMimeType: "application/json" },
          }),
        });
        if (!gemRes.ok) throw new Error(`Gemini ${gemRes.status}`);
        const gemData = await gemRes.json();
        const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const parsed = extractJson(text);
        briefing = parsed ?? buildFallback(ctx);
        if (!parsed) source = "template";
      } catch (err) {
        console.warn("[city-briefing] fallback:", err);
        briefing = buildFallback(ctx);
        source = "template";
      }
    }

    await sb.from("ai_summaries").upsert(
      { type, summary: JSON.stringify(briefing), generated_at: new Date().toISOString(), date: today },
      { onConflict: "type,date" },
    );

    return new Response(
      JSON.stringify({ ok: true, source, briefing, context: { total: ctx.total } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
