// Muğla Monitor — anomaly-scan Edge Function
// Yaşayan istihbarat katmanı: live_data_cache'teki güncel değerleri
// historical_snapshots'taki 7 günlük baseline ile karşılaştırır,
// sapmaları anomaly_alerts'e yazar. Kritik anomaliler ayrıca
// alert_events'e düşer (realtime banner + bildirim).
// pg_cron ile 15 dakikada bir çağrılır.

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";

type Severity = "critical" | "warning" | "info";

interface Anomaly {
  severity: Severity;
  category: string;
  metric_key: string;
  title: string;
  description: string;
  value_num?: number | null;
  baseline_num?: number | null;
}

async function loadBaselines(
  sb: NonNullable<ReturnType<typeof getServiceClient>>,
): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await sb
    .from("historical_snapshots")
    .select("category, metric_key, value_num")
    .gte("snapshot_date", since)
    .not("value_num", "is", null);

  // category:metric_key -> arithmetic mean of the last 7 daily snapshots
  const sums = new Map<string, { sum: number; n: number }>();
  for (const row of data ?? []) {
    const key = `${row.category}:${row.metric_key}`;
    const acc = sums.get(key) ?? { sum: 0, n: 0 };
    acc.sum += Number(row.value_num);
    acc.n += 1;
    sums.set(key, acc);
  }
  const out = new Map<string, number>();
  for (const [key, acc] of sums) out.set(key, acc.sum / acc.n);
  return out;
}

function scanAll(
  cache: Map<string, any>,
  baseline: Map<string, number>,
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const push = (a: Anomaly) => anomalies.push(a);
  const base = (k: string) => baseline.get(k) ?? null;

  // ── Weather ─────────────────────────────────────────────────────────
  const w = cache.get("weather");
  if (w) {
    const temp = Number(w.temperature);
    const humidity = Number(w.humidity);
    const wind = Number(w.windspeed ?? w.wind_speed);
    const tempBase = base("weather:temperature");

    if (!isNaN(temp) && temp > 40) {
      push({ severity: "warning", category: "weather", metric_key: "temperature",
        title: "Aşırı Sıcaklık", value_num: temp, baseline_num: tempBase,
        description: `Sıcaklık ${temp}°C'ye ulaştı.${tempBase ? ` (7 günlük ortalama: ${tempBase.toFixed(1)}°C)` : ""}` });
    } else if (!isNaN(temp) && tempBase !== null && temp - tempBase >= 8) {
      push({ severity: "warning", category: "weather", metric_key: "temperature",
        title: "Sıcaklık Anomalisi", value_num: temp, baseline_num: tempBase,
        description: `Sıcaklık 7 günlük ortalamanın ${(temp - tempBase).toFixed(1)}°C üzerinde.` });
    }
    if (!isNaN(humidity) && !isNaN(wind) && humidity < 20 && wind > 30) {
      push({ severity: "critical", category: "weather", metric_key: "fire_weather",
        title: "Yangın Hava Koşulları", value_num: humidity,
        description: `Nem %${humidity}, rüzgar ${wind} km/h — orman yangını riski kritik seviyede.` });
    } else if (!isNaN(humidity) && humidity < 15) {
      push({ severity: "warning", category: "weather", metric_key: "fire_weather",
        title: "Kritik Nem Seviyesi", value_num: humidity,
        description: `Nem oranı %${humidity}'e düştü. Yangın riski yükseliyor.` });
    }
  }

  // ── Air quality ─────────────────────────────────────────────────────
  const aq = cache.get("air_quality");
  if (aq) {
    const aqi = Number(aq.aqi);
    if (!isNaN(aqi) && aqi > 100) {
      push({ severity: "critical", category: "environment", metric_key: "aqi",
        title: "Tehlikeli Hava Kalitesi", value_num: aqi, baseline_num: base("environment:aqi"),
        description: `Avrupa Hava Kalitesi Endeksi ${aqi} — açık hava aktivitelerinden kaçınılmalı.` });
    } else if (!isNaN(aqi) && aqi > 80) {
      push({ severity: "warning", category: "environment", metric_key: "aqi",
        title: "Hava Kalitesi Bozuldu", value_num: aqi, baseline_num: base("environment:aqi"),
        description: `Hava kalitesi endeksi ${aqi} — hassas gruplar için sağlıksız.` });
    }
  }

  // ── Earthquakes ─────────────────────────────────────────────────────
  const eq = cache.get("earthquakes");
  if (eq) {
    const count = Number(eq.count ?? 0);
    const maxMag = Math.max(0, ...(eq.earthquakes ?? []).map((q: any) => Number(q.magnitude) || 0));
    if (maxMag >= 4.5) {
      push({ severity: "warning", category: "security", metric_key: "max_magnitude",
        title: "Belirgin Deprem Aktivitesi", value_num: maxMag, baseline_num: base("earthquakes:max_magnitude"),
        description: `Bölgede M${maxMag.toFixed(1)} büyüklüğünde deprem kaydedildi.` });
    }
    if (count >= 12) {
      push({ severity: "info", category: "security", metric_key: "event_count",
        title: "Yoğun Sismik Aktivite", value_num: count, baseline_num: base("earthquakes:event_count"),
        description: `Son gözlem penceresinde ${count} deprem kaydedildi.` });
    }
  }

  // ── Economy ─────────────────────────────────────────────────────────
  const eco = cache.get("economy");
  if (eco?.usd_try != null) {
    const usd = Number(eco.usd_try);
    const usdBase = base("economy:usd_try");
    if (!isNaN(usd) && usdBase && usdBase > 0) {
      const changePct = ((usd - usdBase) / usdBase) * 100;
      if (Math.abs(changePct) >= 3) {
        push({ severity: "warning", category: "economy", metric_key: "usd_try",
          title: "Döviz Kuru Anomalisi", value_num: usd, baseline_num: usdBase,
          description: `USD/TRY 7 günlük ortalamaya göre %${changePct.toFixed(1)} ${changePct > 0 ? "yükseldi" : "düştü"} (${usd.toFixed(2)}).` });
      }
    }
  }

  // ── Dams ────────────────────────────────────────────────────────────
  const dams = cache.get("dams");
  if (dams?.avg_occupancy != null) {
    const occ = Number(dams.avg_occupancy);
    if (!isNaN(occ) && occ < 25) {
      push({ severity: "critical", category: "environment", metric_key: "dam_occupancy",
        title: "Kritik Baraj Doluluğu", value_num: occ, baseline_num: base("environment:dam_occupancy"),
        description: `Baraj ortalama doluluk oranı %${occ} — su kısıntısı riski.` });
    } else if (!isNaN(occ) && occ < 35) {
      push({ severity: "warning", category: "environment", metric_key: "dam_occupancy",
        title: "Düşük Baraj Doluluğu", value_num: occ, baseline_num: base("environment:dam_occupancy"),
        description: `Baraj ortalama doluluk oranı %${occ} seviyesinde.` });
    }
  }

  // ── Tourism ─────────────────────────────────────────────────────────
  const tourism = cache.get("tourism");
  if (tourism?.hotel_occupancy != null) {
    const occ = Number(tourism.hotel_occupancy);
    const occBase = base("tourism:hotel_occupancy");
    if (!isNaN(occ) && occBase !== null && occBase - occ >= 20) {
      push({ severity: "info", category: "tourism", metric_key: "hotel_occupancy",
        title: "Otel Doluluğunda Düşüş", value_num: occ, baseline_num: occBase,
        description: `Otel doluluğu 7 günlük ortalamanın ${(occBase - occ).toFixed(0)} puan altında (%${occ}).` });
    }
  }

  return anomalies;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = getServiceClient();
    if (!sb) {
      return new Response(JSON.stringify({ error: "Service client unavailable" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [cacheRes, baseline] = await Promise.all([
      sb.from("live_data_cache").select("data_type, data"),
      loadBaselines(sb),
    ]);

    const cache = new Map<string, any>();
    for (const row of cacheRes.data ?? []) cache.set(row.data_type, row.data);

    const anomalies = scanAll(cache, baseline);
    const now = new Date().toISOString();
    const activeKeys = new Set(anomalies.map((a) => `${a.category}:${a.metric_key}`));

    // Upsert current anomalies (one row per category+metric_key)
    for (const a of anomalies) {
      const { data: existing } = await sb
        .from("anomaly_alerts")
        .select("id, severity")
        .eq("category", a.category)
        .eq("metric_key", a.metric_key)
        .maybeSingle();

      await sb.from("anomaly_alerts").upsert(
        { ...a, is_active: true, detected_at: now },
        { onConflict: "category,metric_key" },
      );

      // A newly-escalated critical anomaly also enters the realtime alert feed
      if (a.severity === "critical" && existing?.severity !== "critical") {
        await sb.from("alert_events").insert({
          type: "crisis",
          severity: "critical",
          title: a.title,
          body: a.description,
          source: "Anomali Motoru",
          metadata: { anomaly_key: `${a.category}:${a.metric_key}` },
        });
      }
    }

    // Anomalies that no longer hold get resolved
    const { data: activeRows } = await sb
      .from("anomaly_alerts")
      .select("id, category, metric_key")
      .eq("is_active", true);
    const staleIds = (activeRows ?? [])
      .filter((r) => !activeKeys.has(`${r.category}:${r.metric_key}`))
      .map((r) => r.id);
    if (staleIds.length > 0) {
      await sb.from("anomaly_alerts").update({ is_active: false }).in("id", staleIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        detected: anomalies.length,
        resolved: staleIds.length,
        keys: [...activeKeys],
        timestamp: now,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[anomaly-scan] error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
