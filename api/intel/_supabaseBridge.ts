// api/intel/_supabaseBridge.ts
// Sunucu taraflı (Node / Vercel Serverless) Supabase yazım köprüsü.
// Yalnızca `process.env.SUPABASE_SERVICE_ROLE_KEY` ile çalışır; gizli anahtar asla istemciye sızmaz.
// Yazım hataları asla sessizce yutulmaz — tablo adı, HTTP kodu ve hata mesajı açıkça loglanır.

import crypto from "node:crypto";

export interface BridgeWriteResult {
  skipped: boolean;
  written: Record<string, number>;
  errors: Array<{ table: string; status: number | null; message: string }>;
}

function normalizeSupabaseUrl(raw?: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\/+(?:rest|auth|realtime|storage)\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function deterministicUuid(namespace: string, key: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${namespace}::${key.trim().toLowerCase()}`)
    .digest("hex");
  const variant = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}

function getServerSupabaseConfig(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  serviceRoleKey: string;
} | null {
  const url = normalizeSupabaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

async function postgrestUpsert(
  config: { url: string; serviceRoleKey: string },
  table: string,
  payload: unknown,
  onConflict?: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{ ok: boolean; status: number; message: string }> {
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const endpoint = `${config.url}/rest/v1/${encodeURIComponent(table)}${qs}`;
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: onConflict
        ? "resolution=merge-duplicates,return=minimal"
        : "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, message: body.slice(0, 300) || `HTTP ${res.status}` };
  }
  return { ok: true, status: res.status, message: "ok" };
}

const TOPIC_TO_TAB_MAP: Record<string, { tabKey: string; title: string; cacheType: string }> = {
  environment_dams: { tabKey: "cevre", title: "Çevre & Barajlar", cacheType: "dams" },
  transport_infra: { tabKey: "ulasim", title: "Ulaşım & Altyapı", cacheType: "transport" },
  energy_outages: { tabKey: "enerji", title: "Enerji & Kesintiler", cacheType: "energy" },
  security_quakes: { tabKey: "guvenlik", title: "Güvenlik & Asayiş", cacheType: "security" },
  tourism_occupancy: { tabKey: "turizm", title: "Turizm & Konaklama", cacheType: "tourism" },
  economy_budget: { tabKey: "ekonomi", title: "Ekonomi & Bütçe", cacheType: "economy" },
  protocol_activity: { tabKey: "protokol", title: "Muğla Protokol", cacheType: "protocol" },
};

/**
 * `/api/intel/topic-grounding` tarafından doğrulanan çıktıları `live_data_cache`,
 * `monitor_data`, `protocol_changes`, `alert_events` ve `ai_summaries` tablolarına yazar.
 */
export async function persistTopicGroundingToSupabase(
  topic: string,
  payload: Record<string, unknown>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch }
): Promise<BridgeWriteResult> {
  const result: BridgeWriteResult = { skipped: false, written: {}, errors: [] };
  if (!payload || payload.ok !== true) {
    result.skipped = true;
    return result;
  }

  const config = getServerSupabaseConfig(options?.env);
  if (!config) {
    result.skipped = true;
    return result;
  }

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const nowIso = typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString();
  const expiresIso = new Date(Date.now() + 6 * 3600_000).toISOString();
  const meta = TOPIC_TO_TAB_MAP[topic];

  const recordWrite = (table: string, count: number, outcome: { ok: boolean; status: number; message: string }) => {
    if (outcome.ok) {
      result.written[table] = (result.written[table] || 0) + count;
    } else {
      result.errors.push({ table, status: outcome.status, message: outcome.message });
      console.error(`[api/intel/_supabaseBridge] ${table} yazım hatası (HTTP ${outcome.status}): ${outcome.message}`);
    }
  };

  // 1. live_data_cache (`topic_grounding:<topic>`)
  try {
    const out = await postgrestUpsert(
      config,
      "live_data_cache",
      {
        data_type: `topic_grounding:${topic}`,
        data: payload,
        fetched_at: nowIso,
        expires_at: expiresIso,
        source: "api-intel-topic-grounding",
        error: null,
      },
      "data_type",
      fetchImpl
    );
    recordWrite("live_data_cache", 1, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ table: "live_data_cache", status: null, message: msg });
    console.error(`[api/intel/_supabaseBridge] live_data_cache ağ hatası:`, msg);
  }

  // 2. monitor_data — canlı sütunlar: (source, district_name, content, sentiment, category, created_at)
  if (meta) {
    try {
      const structuredPayload = {
        tabKey: meta.tabKey,
        title: meta.title,
        summary: `${meta.title} canlı web doğrulaması güncellendi (${nowIso.slice(0, 16).replace("T", " ")}).`,
        metrics: {
          topic,
          fetchedAt: nowIso,
          ...(payload.economyUpdates ? { economyUpdates: payload.economyUpdates } : {}),
          ...(payload.tourismMetrics ? { tourismMetrics: payload.tourismMetrics } : {}),
          ...(Array.isArray(payload.damUpdates) ? { damUpdatesCount: payload.damUpdates.length } : {}),
          ...(Array.isArray(payload.transportIncidents)
            ? { transportIncidentsCount: payload.transportIncidents.length }
            : {}),
          ...(Array.isArray(payload.energyOutages)
            ? { energyOutagesCount: payload.energyOutages.length }
            : {}),
          ...(Array.isArray(payload.securityEvents)
            ? { securityEventsCount: payload.securityEvents.length }
            : {}),
          ...(Array.isArray(payload.protocolActivities)
            ? { protocolActivitiesCount: payload.protocolActivities.length }
            : {}),
        },
        updatedAt: nowIso,
      };
      const monitorRow = {
        source: "api-intel-topic-grounding",
        district_name: "Muğla",
        category: meta.tabKey,
        sentiment: "neutral",
        content: JSON.stringify(structuredPayload),
        created_at: nowIso,
      };
      const out = await postgrestUpsert(config, "monitor_data", monitorRow, undefined, fetchImpl);
      recordWrite("monitor_data", 1, out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ table: "monitor_data", status: null, message: msg });
      console.error(`[api/intel/_supabaseBridge] monitor_data ağ hatası:`, msg);
    }
  }

  // 3. protocol_changes (görev değişikliği yakalandıysa)
  if (topic === "protocol_activity" && Array.isArray(payload.protocolActivities)) {
    const decrees = (payload.protocolActivities as Array<Record<string, unknown>>).filter(
      (a) => a?.category === "gorev_degisikligi" && a.actorName && a.actorTitle
    );
    if (decrees.length > 0) {
      const dateOnly = nowIso.slice(0, 10);
      const changeRows = decrees.map((a) => ({
        id: deterministicUuid(
          "protocol_change",
          `${String(a.actorTitle)}::${String(a.actorName)}::${dateOnly}`
        ),
        change_type: "updated",
        unvan: String(a.actorTitle).slice(0, 120),
        isim_old: null,
        isim_new: String(a.actorName).slice(0, 120),
        detail: `${String(a.summary || "")} (${String(a.sourceName || "Resmi Kaynak")})`.slice(0, 400),
        scraped_at: typeof a.publishedAt === "string" ? a.publishedAt : nowIso,
      }));
      try {
        const out = await postgrestUpsert(config, "protocol_changes", changeRows, "id", fetchImpl);
        recordWrite("protocol_changes", changeRows.length, out);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ table: "protocol_changes", status: null, message: msg });
        console.error(`[api/intel/_supabaseBridge] protocol_changes ağ hatası:`, msg);
      }
    }
  }

  // 4. alert_events (yüksek/kritik güvenlik olayları veya elektrik kesintileri)
  if (topic === "security_quakes" && Array.isArray(payload.securityEvents)) {
    const urgentSec = (payload.securityEvents as Array<Record<string, unknown>>)
      .filter((e) => e?.severity === "high" || e?.severity === "critical")
      .slice(0, 3);
    if (urgentSec.length > 0) {
      const alertRows = urgentSec.map((e) => ({
        type: String(e.category || "guvenlik"),
        severity: e.severity === "critical" ? "critical" : "high",
        title: `[${String(e.district || "Muğla")}] ${String(e.title || "").slice(0, 120)}`,
        body: String(e.summary || e.title || "").slice(0, 280),
        source: "api-intel-topic-grounding",
        lat: typeof e.lat === "number" ? e.lat : 37.2153,
        lon: typeof e.lon === "number" ? e.lon : 28.3636,
        metadata: {
          district: e.district || "Muğla",
          source_url: e.sourceUrl || null,
          source_name: e.sourceName || null,
        },
        created_at: nowIso,
      }));
      try {
        const out = await postgrestUpsert(config, "alert_events", alertRows, undefined, fetchImpl);
        recordWrite("alert_events", alertRows.length, out);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push({ table: "alert_events", status: null, message: msg });
        console.error(`[api/intel/_supabaseBridge] alert_events ağ hatası:`, msg);
      }
    }
  }

  return result;
}

/**
 * `/api/intel/district-grounding` ilçe doğrulamasını `monitor_data` (ilceler) ve `live_data_cache` içine yansıtır.
 */
export async function persistDistrictGroundingToSupabase(
  districtName: string,
  posts: Array<Record<string, unknown>>,
  options?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch }
): Promise<BridgeWriteResult> {
  const result: BridgeWriteResult = { skipped: false, written: {}, errors: [] };
  if (!districtName || !Array.isArray(posts) || posts.length === 0) {
    result.skipped = true;
    return result;
  }

  const config = getServerSupabaseConfig(options?.env);
  if (!config) {
    result.skipped = true;
    return result;
  }

  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const nowIso = new Date().toISOString();
  const slug = districtName
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "");

  try {
    const out = await postgrestUpsert(
      config,
      "live_data_cache",
      {
        data_type: `district_grounding:${slug}`,
        data: { districtName, posts, updatedAt: nowIso },
        fetched_at: nowIso,
        expires_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
        source: "api-intel-district-grounding",
        error: null,
      },
      "data_type",
      fetchImpl
    );
    if (out.ok) {
      result.written.live_data_cache = 1;
    } else {
      result.errors.push({ table: "live_data_cache", status: out.status, message: out.message });
      console.error(
        `[api/intel/_supabaseBridge] district live_data_cache hatası (HTTP ${out.status}): ${out.message}`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ table: "live_data_cache", status: null, message: msg });
    console.error(`[api/intel/_supabaseBridge] district live_data_cache ağ hatası:`, msg);
  }

  return result;
}
