// traffic-teyit — TomTom canlı tıkanıklığını yerel/ulusal basın ve resmi kaynak
// haberleriyle çapraz doğrular (confidence arttırır). Her ilçe için:
//   - son 24 saatte trafikle ilgili haber var mı?
//   - ilçe tıkanıklığı ile haber uyuşuyor mu (örn. Milas'ta kaza + Milas %22)?
// Sonuç, Frontend'in "✅ haber teyitli" rozeti göstermesi için ai_summaries
// (type='traffic_verification') içine kaydedilir; kritik eşleşmeler alert_events'e gider.

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";
const CRITICAL_DENSITY = 50;

interface Hotspot { name: string; density: number; speed: number; freeFlow: number; confidence?: number }
interface NewsItem { district: string | null; title: string; summary: string | null; source: string; published_at: string }

// Son N saatlik trafikle ilgili haberleri topla
async function fetchTrafficNews(sb: ReturnType<typeof getServiceClient> & object, hours = 24): Promise<NewsItem[]> {
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const trafficKw = ["trafik", "kaza", "yol", "ulaşım", "araç", "tıkalı", "kapalı", "çalışma", "D400", "D-400", "D550", "geçit", "köprü", "bariyer", "otoyol"];

  const { data } = await sb.from("social_posts")
    .select("district, title, summary, source, published_at")
    .gte("published_at", since)
    .eq("is_duplicate", false)
    .order("published_at", { ascending: false })
    .limit(300);

  const items = (data ?? []) as NewsItem[];
  const text = (n: NewsItem) => `${n.title ?? ""} ${n.summary ?? ""}`.toLowerCase();
  return items.filter((n) => trafficKw.some((k) => text(n).includes(k)));
}

function norm(s?: string | null) { return (s ?? "").toLowerCase().replace(/\s+/g, "_").trim(); }

// AI destekli doğrulama metni üretir ve ai_summaries'e kaydeder.
async function buildAiVerification(
  sb: ReturnType<typeof getServiceClient> & object,
  hotspots: Hotspot[],
  trafficNews: NewsItem[],
): Promise<boolean> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return false;

  const dense = hotspots.filter((h) => h.density >= 25);
  const expected = dense.map((h) => `- ${h.name}: %${h.density} tıkanıklık (${h.speed}/${h.freeFlow} km/h, güven %${Math.round((h.confidence ?? 0) * 100)})`).join("\n") || "Şu an kritik tıkanıklık yok.";
  const headlines = trafficNews.slice(0, 15).map((n) => `[${n.source}][${n.district ?? "genel"}] ${n.title}: ${n.summary ?? ""}`).join("\n") || "Son 24 saatte trafik haberleri bulunamadı.";

  const prompt = `Muğla için TomTom canlı tıkanıklık verisi ve son 24 saat basın/duyuruları aşağıda.\n
Görev: Verilen tıkanıklıkları haberlerle TEYİT et. Her ilçe için (a) o ilçede haber var mı, (b) haber tıkanıklıkla uyumlu mu (kaza/yol çalışması/mesai/yoğunluk). Yalnız gerçek tıkanıklık varsa değerlendir; normal seyir "sum" ise ekleme yapma.
Kısa Türkçe madde listesi üret:
"- İlçe: %doy (veri kaynağı: basın haberi — <başlık>) | (yalnızca TomTom sensör verisi, basın teyidi yok)"
En sona tek satır ekle: "Durum: [kritik/yoğun/normal] — veri güvenilirliği: [açık]".

CANLI TIKANIKLIK:\n${expected}\n\nHABERLER:\n${headlines}`;

  const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 400 } }),
  });
  if (!res.ok) return false;
  const gem = await res.json();
  const text = gem?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) return false;

  const today = new Date().toISOString().split("T")[0];
  await sb.from("ai_summaries").upsert(
    { type: "traffic_verification", summary: text, generated_at: new Date().toISOString(), date: today },
    { onConflict: "type,date" },
  );
  return true;
}

async function pushAlert(sb: ReturnType<typeof getServiceClient> & object, h: Hotspot, severity: "critical" | "warning") {
  const since = new Date(Date.now() - 2 * 3600e3).toISOString();
  const metricKey = `traffic_${norm(h.name)}`;
  const { data: ex } = await sb.from("anomaly_alerts").select("id").eq("metric_key", metricKey).eq("is_active", true)
    .gte("detected_at", since).limit(1);
  if (ex && ex.length) return;

  await sb.from("anomaly_alerts").upsert({
    severity, category: "traffic", metric_key: metricKey,
    title: `Tıkanıklık: ${h.name}`,
    description: `${h.name} yoğunluğu %${h.density} (${h.speed}/${h.freeFlow} km/h).` + (h.confidence !== undefined ? ` TomTom veri güvenirliği: ${Math.round(h.confidence * 100)}%.` : ""),
    value_num: h.density, is_active: true, detected_at: new Date().toISOString(),
  }, { onConflict: "category,metric_key" });

  if (severity === "critical") {
    await sb.from("alert_events").insert({
      type: "traffic", severity: "high", title: `Trafik: ${h.name}`,
      body: `${h.name} yoğunluğu %${h.density} — TomTom + basın teyidi.`,
      source: "traffic-teyit",
    });
  }
}

async function runTrafficVerification() {
  const sb = getServiceClient();
  if (!sb) return { ok: false, error: "no service client" };

  const [cacheRes, news] = await Promise.all([
    sb.from("live_data_cache").select("data, fetched_at").eq("data_type", "traffic_density").maybeSingle(),
    fetchTrafficNews(sb).catch(() => []),
  ]);
  // cacheRes.data = satır; satırın .data alanı { hotspots, source, updated_at } payload'ıdır
  const hotspots = ((cacheRes?.data as { data?: { hotspots?: Hotspot[] } } | null)?.data?.hotspots) ?? [];
  if (hotspots.length === 0) return { ok: false, error: "traffic cache bos" };

  // İlçe adına göre haberleri eşleştir (ör. "Menteşe" haber → "menteşe" hotspot)
  const byDistrict = new Map(hotspots.map((h) => [norm(h.name), h]));
  const trafficNews = news.filter((n) => n.district && byDistrict.has(norm(n.district)));
  const mentionedDistricts = new Set(trafficNews.map((n) => norm(n.district!)));

  // Kritik veya %25+ ve düşük konfidanslı anomali noktaları
  const active = hotspots.filter((h) => h.density >= CRITICAL_DENSITY || (h.density >= 25 && (h.confidence === undefined || h.confidence > 0.7)));

  const aiOk = await buildAiVerification(sb, hotspots, trafficNews);

  // A) Mutlak eşik (≥%50) + haber teşidi → kritik/uyarı alarm
  for (const h of active) {
    const hasNews = mentionedDistricts.has(norm(h.name));
    if (h.density >= CRITICAL_DENSITY && hasNews) await pushAlert(sb, h, "critical");
    else if (h.density >= CRITICAL_DENSITY && !hasNews) await pushAlert(sb, h, "warning");
  }

  // B) Ani değişiklik (spike) algılama: bir önceki koşudaki density ile karşılaştır
  //    (δ≥30 puan ve ≥%20 göreli artış), ardından anlık değeri snapshot'a yaz.
  const spikes = await detectSpikeTraffic(sb, hotspots);

  return {
    ok: true,
    hotspots: hotspots.length,
    traffic_news: trafficNews.length,
    mentioned: [...mentionedDistricts],
    active: active.length,
    spikes: spikes.length,
    ai_ok: aiOk,
  };
}

// Her hotspot için bir önceki camera density'sini okur, ani artış varsa alert_events
// yazar ve güncel değeri keyword_volume_snapshots → snapshot olarak kaydeder.
// (Trend/spike grafikleri için de veri oluşturur.)
async function detectSpikeTraffic(sb: ReturnType<typeof getServiceClient> & object, hotspots: Hotspot[]): Promise<string[]> {
  const spikes: string[] = [];
  const keywordOf = (h: Hotspot) => `traffic_${norm(h.name)}`;
  for (const h of hotspots) {
    const keyword = keywordOf(h);
    // önceki en güncel snapshot (bu fonksiyon her koşuda güncel değeri yazar)
    const { data: prevRow } = await sb.from("keyword_volume_snapshots")
      .select("count, window_end")
      .eq("keyword", keyword)
      .order("window_end", { ascending: false })
      .limit(1);
    const prevCount = (prevRow?.[0]?.count) as number | undefined;

    if (typeof prevCount === "number" && h.density >= TRAFFIC_SPIKE_MIN &&
        h.density - prevCount >= TRAFFIC_SPIKE_ABS &&
        (prevCount <= 0 || h.density / prevCount >= TRAFFIC_SPIKE_RATIO)) {
      await sb.from("alert_events").insert({
        type: "traffic", severity: "medium", title: `Trafik anomali: ${h.name}`,
        body: `${h.name} yoğunluğu %${h.density} (önceki %${prevCount}) — ani artış.`,
        source: "traffic-teyit",
      });
      spikes.push(h.name);
    }

    // güncel anlık değeri snapshot'a yaz (trend/spike grafikleri için)
    await sb.from("keyword_volume_snapshots").insert({
      keyword, district: null, count: h.density,
    });
  }
  return spikes;
}

const TRAFFIC_SPIKE_ABS = 30;  // % puan artış
const TRAFFIC_SPIKE_MIN = 40;  // ilçe en az bu yoğunlukta
const TRAFFIC_SPIKE_RATIO = 1.5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const res = await runTrafficVerification();
    return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});