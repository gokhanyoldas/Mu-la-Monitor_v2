// spike-scan — ani kelime hacmi sıçramalarını tespit eder (+300% / 1 saat).
// Son 1 saatlik ilçe+kategori hacmini önceki 6 saatin saatlik ortalamasıyla
// kıyaslar; eşik aşılırsa anomaly_alerts + alert_events'e yazar (Realtime push).

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";

const SPIKE_THRESHOLD = 3.0; // +300%
const MIN_BASELINE = 2;      // çok düşük tabanlarda gürültüyü önle

interface VolumeRow { district: string | null; category: string | null; }

async function countBy(sb: ReturnType<typeof getServiceClient> & object, from: Date, to: Date): Promise<Map<string, number>> {
  const { data } = await sb.from("social_posts")
    .select("district, category")
    .gte("published_at", from.toISOString())
    .lt("published_at", to.toISOString())
    .eq("is_duplicate", false);
  const map = new Map<string, number>();
  for (const row of (data ?? []) as VolumeRow[]) {
    const key = `${row.district ?? "genel"}::${row.category ?? "general"}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = getServiceClient();
  if (!sb) {
    return new Response(JSON.stringify({ ok: false, error: "no service client" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600e3);
  const sevenHoursAgo = new Date(now.getTime() - 7 * 3600e3);

  const recent = await countBy(sb, hourAgo, now);
  const baseline = await countBy(sb, sevenHoursAgo, hourAgo);

  const spikes: { key: string; ratio: number; current: number; baselineAvg: number }[] = [];
  for (const [key, current] of recent) {
    const baselineAvg = (baseline.get(key) ?? 0) / 6;
    if (baselineAvg < MIN_BASELINE / 6 && current < 5) continue; // gürültü filtresi
    const ratio = baselineAvg === 0 ? (current >= 5 ? SPIKE_THRESHOLD : 0) : current / baselineAvg;
    if (ratio >= SPIKE_THRESHOLD) spikes.push({ key, ratio, current, baselineAvg });
  }

  for (const spike of spikes) {
    const [district, category] = spike.key.split("::");
    const title = `Ani yoğunluk sıçraması: ${category} — ${district}`;
    const description = `Son 1 saatte ${spike.current} gönderi (baseline ~${spike.baselineAvg.toFixed(1)}/sa, ×${spike.ratio.toFixed(1)} artış).`;

    // Aynı spike'ın tekrar alarm üretmesini önle (son 2 saatte aynı metric_key varsa atla)
    const metricKey = `spike_${category}_${district}`;
    const { data: existing } = await sb.from("anomaly_alerts")
      .select("id").eq("metric_key", metricKey).eq("is_active", true)
      .gte("detected_at", new Date(now.getTime() - 2 * 3600e3).toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;

    // severity enum: critical | warning | info (mevcut tablo şeması)
    const severity = spike.ratio >= 6 ? "critical" : "warning";
    await sb.from("anomaly_alerts").upsert({
      severity,
      category: "social",
      metric_key: metricKey,
      title,
      description,
      value_num: spike.current,
      baseline_num: spike.baselineAvg,
      is_active: true,
      detected_at: new Date().toISOString(),
    }, { onConflict: "category,metric_key" });
    if (severity === "critical") {
      await sb.from("alert_events").insert({
        type: "crisis", severity, title, body: description, source: "Spike Scanner",
      });
    }

    // Hacim snapshot'ı (trend grafikleri için)
    await sb.from("keyword_volume_snapshots").insert({
      keyword: category, district: district === "genel" ? null : district, count: spike.current,
    });
  }

  return new Response(JSON.stringify({ ok: true, spikes: spikes.length, details: spikes }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
