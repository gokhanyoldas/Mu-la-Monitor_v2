import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

interface SummaryRequest { type: "daily" | "social" | "earthquake" | "weather"; context?: string; }

async function fetchSocialContext(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase.from("social_analyses")
    .select("title, sentiment, summary, source, created_at")
    .order("created_at", { ascending: false }).limit(20);
  if (!data?.length) return "Son 24 saatte analiz edilecek sosyal medya verisi bulunamadı.";
  return data.map((r) => `[${r.source}][${r.sentiment}] ${r.title}: ${r.summary ?? ""}`).join("\n");
}

function buildPrompt(type: SummaryRequest["type"], context: string): string {
  const base = `Sen Muğla ili için çalışan bir bölgesel istihbarat asistanısın.\nGörevin kısa, net ve bilgilendirici Türkçe özetler üretmek.\nMaksimum 3 madde halinde, her madde 1 cümle, toplam 60-80 kelime.`;
  const prompts = {
    daily: `${base}\n\nAşağıdaki bugünkü Muğla veri akışına dayanarak günlük özet üret:\n\n${context}`,
    social: `${base}\n\nAşağıdaki sosyal medya analizlerine dayanarak kamuoyu özeti üret:\n\n${context}`,
    earthquake: `${base}\n\nAşağıdaki deprem verilerine dayanarak risk özeti üret:\n\n${context}`,
    weather: `${base}\n\nAşağıdaki hava durumu verilerine dayanarak kısa tahmin özeti üret:\n\n${context}`,
  };
  return prompts[type];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY secret eksik." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let body: SummaryRequest = { type: "daily" };
    if (req.method === "POST") body = await req.json().catch(() => ({ type: "daily" }));
    else { const url = new URL(req.url); body.type = (url.searchParams.get("type") as SummaryRequest["type"]) ?? "daily"; }
    const context = body.context ?? (await fetchSocialContext(supabase));
    const prompt = buildPrompt(body.type, context);
    const gemRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 256 } }),
    });
    if (!gemRes.ok) { const err = await gemRes.text(); throw new Error(`Gemini API error ${gemRes.status}: ${err}`); }
    const gemData = await gemRes.json();
    const summary = gemData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Özet üretilemedi.";
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("ai_summaries").upsert({ type: body.type, summary, generated_at: new Date().toISOString(), date: today }, { onConflict: "type,date" });
    return new Response(JSON.stringify({ type: body.type, summary, generated_at: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
