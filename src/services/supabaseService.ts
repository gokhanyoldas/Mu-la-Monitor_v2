// src/services/supabaseService.ts
// Muğla Monitör v2 — Modüler Supabase & `social-collect` Edge Function Servis Katmanı

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  ENV,
  normalizeSupabaseUrl,
  sanitizeSupabaseKey,
  isSupabaseKeyCompatibleWithUrl,
} from "@/config/env";
import { MUGLA_DISTRICTS } from "@/data/muglaDistricts";
import { INVESTIGATION_DOSSIERS } from "@/data/investigationData";
import { safeStorage } from "@/lib/safe-storage";

export interface IntelRecord {
  id: string;
  platform: string;
  content: string;
  author: string;
  url: string;
  published_at: string;
  keywords_matched: string[];
  region: string | null;
  district_id?: string;
  sentiment?: "positive" | "negative" | "neutral" | string | null;
  sentiment_confidence?: number | null;
  source_mode: "supabase-edge" | "supabase-db" | "local-fallback";
}

export interface SocialCollectResponse {
  ok: boolean;
  source: "supabase-edge" | "local-fallback";
  configured: boolean;
  district: string | null;
  keyword: string | null;
  posts: IntelRecord[];
  total: number;
  collected_at: string;
  error: string | null;
}

export interface DistrictIntelResult {
  ok: boolean;
  source: "supabase-db" | "local-fallback";
  district: string | null;
  records: IntelRecord[];
  fetched_at: string;
  error: string | null;
}

export interface SyncIntelResult {
  ok: boolean;
  source: "supabase-edge" | "supabase-db" | "local-fallback";
  district: string | null;
  keyword: string | null;
  records: IntelRecord[];
  total: number;
  synced_at: string;
  error: string | null;
}

/**
 * Supabase istemci ortam değişkenlerinin tanımlı olup olmadığını kontrol eder.
 */
export function checkSupabaseConfigured(): boolean {
  const url = normalizeSupabaseUrl(ENV.VITE_SUPABASE_URL);
  const key =
    sanitizeSupabaseKey(ENV.VITE_SUPABASE_ANON_KEY) ||
    sanitizeSupabaseKey(ENV.VITE_SUPABASE_PUBLISHABLE_KEY);
  return Boolean(url && key && isSupabaseKeyCompatibleWithUrl(key, url));
}

export const isSupabaseConfigured: boolean = checkSupabaseConfigured();

let cachedClient: SupabaseClient<Database> | null = null;
let cachedSignature = "";

/**
 * Güvenli Supabase istemci oluşturucu.
 * Anahtarlar eksik veya URL geçersizse `createClient` çağırıp uygulamanın çökmesini önler, `null` döner.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  const url = normalizeSupabaseUrl(ENV.VITE_SUPABASE_URL);
  const anonKey =
    sanitizeSupabaseKey(ENV.VITE_SUPABASE_ANON_KEY) ||
    sanitizeSupabaseKey(ENV.VITE_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !anonKey || !isSupabaseKeyCompatibleWithUrl(anonKey, url)) {
    return null;
  }

  const signature = `${url}::${anonKey}`;
  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient<Database>(url, anonKey, {
    auth: {
      storage: safeStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  cachedSignature = signature;
  return cachedClient;
}

function normalizeDistrictMeta(district?: string) {
  if (!district) return null;
  const lower = district.trim().toLowerCase();
  return (
    MUGLA_DISTRICTS.find(
      (d) =>
        d.id.toLowerCase() === lower ||
        d.name.toLowerCase() === lower ||
        lower.includes(d.id.toLowerCase()) ||
        lower.includes(d.name.toLowerCase())
    ) ?? null
  );
}

/**
 * Supabase bağlantısı olmadığında veya önizleme modunda UI'ın kesintisiz
 * çalışmasını sağlayan gerçekçi yerel Muğla istihbarat kayıtları üretir.
 */
function buildLocalFallbackIntel(district?: string, keyword?: string): IntelRecord[] {
  const now = Date.now();
  const matchedDistrict = normalizeDistrictMeta(district);

  const dossierRecords: IntelRecord[] = INVESTIGATION_DOSSIERS.map((dossier, idx) => ({
    id: `local-dossier-${dossier.id}`,
    platform: "local_osint",
    content: `${dossier.title} — ${dossier.summary}`,
    author: "Muğla Yerel OSINT Arşivi",
    url: `#dossier-${dossier.id}`,
    published_at: new Date(now - (idx + 1) * 45 * 60 * 1000).toISOString(),
    keywords_matched: [dossier.districtName, dossier.category],
    region: dossier.districtName,
    district_id: dossier.districtId,
    sentiment: dossier.severity === "Kritik" ? "negative" : "neutral",
    sentiment_confidence: 0.78,
    source_mode: "local-fallback",
  }));

  const districtRecords: IntelRecord[] = MUGLA_DISTRICTS.map((d, idx) => ({
    id: `local-district-${d.id}`,
    platform: idx % 2 === 0 ? "news" : "municipality",
    content: `${d.name} saha özeti: ${d.weatherDesc}, anlık trafik yoğunluğu %${d.trafficDensity}, yerleşik nüfus ${d.population.toLocaleString("tr-TR")}.`,
    author: `${d.name} Yerel İzleme Masası`,
    url: `/ilce/${d.id}`,
    published_at: new Date(now - (idx + 2) * 20 * 60 * 1000).toISOString(),
    keywords_matched: [d.name, d.type === "coastal" ? "Turizm" : "Altyapı"],
    region: d.name,
    district_id: d.id,
    sentiment: d.trafficDensity >= 65 ? "negative" : "positive",
    sentiment_confidence: 0.72,
    source_mode: "local-fallback",
  }));

  let combined = [...dossierRecords, ...districtRecords];

  if (matchedDistrict) {
    combined = combined.filter(
      (item) =>
        item.district_id === matchedDistrict.id ||
        (item.region && item.region.toLowerCase() === matchedDistrict.name.toLowerCase()) ||
        item.content.toLowerCase().includes(matchedDistrict.name.toLowerCase())
    );
  } else if (district && district.trim()) {
    const q = district.trim().toLowerCase();
    combined = combined.filter(
      (item) =>
        item.content.toLowerCase().includes(q) ||
        (item.region && item.region.toLowerCase().includes(q))
    );
  }

  if (keyword && keyword.trim()) {
    const kw = keyword.trim().toLowerCase();
    const filtered = combined.filter(
      (item) =>
        item.content.toLowerCase().includes(kw) ||
        item.keywords_matched.some((k) => k.toLowerCase().includes(kw))
    );
    if (filtered.length > 0) {
      combined = filtered;
    }
  }

  return combined;
}

function mapRawPostsToIntel(
  rawPosts: unknown[],
  sourceMode: "supabase-edge" | "supabase-db"
): IntelRecord[] {
  return rawPosts.map((raw, idx) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const region = typeof p.region === "string" ? p.region : null;
    const content = String(p.content ?? "");
    const matchedDistrict = normalizeDistrictMeta(region || content);
    return {
      id: String(p.id ?? `${sourceMode}-${idx}-${Date.now()}`),
      platform: String(p.platform ?? "news"),
      content,
      author: String(p.author ?? "Bilinmeyen Kaynak"),
      url: String(p.url ?? ""),
      published_at: String(p.published_at ?? p.collected_at ?? new Date().toISOString()),
      keywords_matched: Array.isArray(p.keywords_matched)
        ? p.keywords_matched.map(String)
        : [],
      region: region ?? matchedDistrict?.name ?? null,
      district_id: matchedDistrict?.id,
      sentiment: typeof p.sentiment === "string" ? p.sentiment : null,
      sentiment_confidence:
        typeof p.sentiment_confidence === "number" ? p.sentiment_confidence : null,
      source_mode: sourceMode,
    };
  });
}

/**
 * Supabase `social-collect` Edge Function tetikleyicisi.
 * Anahtar yoksa veya önizleme modunda hata oluşursa yerel Muğla istihbarat verilerine düşer.
 */
export async function invokeSocialCollect(
  district?: string,
  keyword?: string
): Promise<SocialCollectResponse> {
  const configured = checkSupabaseConfigured();
  const client = configured ? getSupabaseClient() : null;
  const collectedAt = new Date().toISOString();

  if (!configured || !client) {
    console.info(
      "[supabaseService] Supabase ortam değişkenleri tanımlı değil; `social-collect` için yerel yedek istihbarat verileri döndürülüyor."
    );
    const fallbackPosts = buildLocalFallbackIntel(district, keyword);
    return {
      ok: true,
      source: "local-fallback",
      configured: false,
      district: district ?? null,
      keyword: keyword ?? null,
      posts: fallbackPosts,
      total: fallbackPosts.length,
      collected_at: collectedAt,
      error: null,
    };
  }

  try {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) {
      const fallbackPosts = buildLocalFallbackIntel(district, keyword);
      return {
        ok: true,
        source: "local-fallback",
        configured: true,
        district: district ?? null,
        keyword: keyword ?? null,
        posts: fallbackPosts,
        total: fallbackPosts.length,
        collected_at: collectedAt,
        error: null,
      };
    }

    const { data, error } = await client.functions.invoke("social-collect", {
      body: { district, keyword },
    });

    if (error) {
      const errMsg = error.message || "social-collect Edge Function hatası";
      console.warn(`[supabaseService] social-collect çağrısı başarısız (${errMsg}); yerel yedeğe geçiliyor.`);
      const fallbackPosts = buildLocalFallbackIntel(district, keyword);
      return {
        ok: false,
        source: "local-fallback",
        configured: true,
        district: district ?? null,
        keyword: keyword ?? null,
        posts: fallbackPosts,
        total: fallbackPosts.length,
        collected_at: collectedAt,
        error: errMsg,
      };
    }

    const rawList: unknown[] = Array.isArray(data?.data?.posts)
      ? data.data.posts
      : Array.isArray(data?.posts)
      ? data.posts
      : [];

    let posts = mapRawPostsToIntel(rawList, "supabase-edge");

    // İlçe belirtilmişse ilgili ilçe kayıtlarını öne çıkar / filtrele
    const matchedDistrict = normalizeDistrictMeta(district);
    if (matchedDistrict && posts.length > 0) {
      const exactDistrictPosts = posts.filter(
        (post) =>
          post.district_id === matchedDistrict.id ||
          (post.region && post.region.toLowerCase() === matchedDistrict.name.toLowerCase()) ||
          post.content.toLowerCase().includes(matchedDistrict.name.toLowerCase())
      );
      if (exactDistrictPosts.length > 0) {
        posts = exactDistrictPosts;
      }
    }

    if (posts.length === 0) {
      posts = buildLocalFallbackIntel(district, keyword);
      return {
        ok: true,
        source: "local-fallback",
        configured: true,
        district: district ?? null,
        keyword: keyword ?? null,
        posts,
        total: posts.length,
        collected_at: data?.data?.collected_at ?? collectedAt,
        error: null,
      };
    }

    return {
      ok: true,
      source: "supabase-edge",
      configured: true,
      district: district ?? null,
      keyword: keyword ?? null,
      posts,
      total: posts.length,
      collected_at: data?.data?.collected_at ?? collectedAt,
      error: null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[supabaseService] social-collect istisnası (${errMsg}); yerel yedeğe geçiliyor.`);
    const fallbackPosts = buildLocalFallbackIntel(district, keyword);
    return {
      ok: false,
      source: "local-fallback",
      configured: true,
      district: district ?? null,
      keyword: keyword ?? null,
      posts: fallbackPosts,
      total: fallbackPosts.length,
      collected_at: collectedAt,
      error: errMsg,
    };
  }
}

/**
 * İlçe bazlı haber ve istihbarat kayıtlarını Supabase `social_posts` tablosundan çeker.
 */
export async function fetchDistrictIntel(
  district?: string,
  limit = 15
): Promise<DistrictIntelResult> {
  const client = getSupabaseClient();
  const matchedDistrict = normalizeDistrictMeta(district);
  const fetchedAt = new Date().toISOString();

  if (!client) {
    console.info("[supabaseService] Supabase bağlantısı yok; yerel ilçe istihbarat arşivi kullanılıyor.");
    const fallback = buildLocalFallbackIntel(district).slice(0, limit);
    return {
      ok: true,
      source: "local-fallback",
      district: matchedDistrict?.name ?? district ?? null,
      records: fallback,
      fetched_at: fetchedAt,
      error: null,
    };
  }

  try {
    let query = client
      .from("social_posts")
      .select("id, platform, content, author, url, published_at, keywords_matched, region, sentiment, sentiment_confidence, collected_at")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (matchedDistrict) {
      query = query.or(
        `region.ilike.%${matchedDistrict.name}%,content.ilike.%${matchedDistrict.name}%`
      );
    } else if (district && district.trim()) {
      const clean = district.trim();
      query = query.or(`region.ilike.%${clean}%,content.ilike.%${clean}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn(`[supabaseService] fetchDistrictIntel DB hatası (${error.message}); yerel yedeğe düşüldü.`);
      const fallback = buildLocalFallbackIntel(district).slice(0, limit);
      return {
        ok: false,
        source: "local-fallback",
        district: matchedDistrict?.name ?? district ?? null,
        records: fallback,
        fetched_at: fetchedAt,
        error: error.message,
      };
    }

    const mapped = mapRawPostsToIntel(data ?? [], "supabase-db");
    if (mapped.length === 0) {
      const fallback = buildLocalFallbackIntel(district).slice(0, limit);
      return {
        ok: true,
        source: "local-fallback",
        district: matchedDistrict?.name ?? district ?? null,
        records: fallback,
        fetched_at: fetchedAt,
        error: null,
      };
    }

    return {
      ok: true,
      source: "supabase-db",
      district: matchedDistrict?.name ?? district ?? null,
      records: mapped,
      fetched_at: fetchedAt,
      error: null,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const fallback = buildLocalFallbackIntel(district).slice(0, limit);
    return {
      ok: false,
      source: "local-fallback",
      district: matchedDistrict?.name ?? district ?? null,
      records: fallback,
      fetched_at: fetchedAt,
      error: errMsg,
    };
  }
}

/**
 * Hem `social-collect` Edge Function taramasını tetikler hem de veritabanı kayıtlarıyla senkronize eder.
 */
export async function syncIntelData(
  district?: string,
  keyword?: string
): Promise<SyncIntelResult> {
  const matchedDistrict = normalizeDistrictMeta(district);
  const districtParam = matchedDistrict?.name ?? district;

  const [collectRes, dbRes] = await Promise.all([
    invokeSocialCollect(districtParam, keyword),
    fetchDistrictIntel(districtParam, 15),
  ]);

  const seen = new Set<string>();
  const merged: IntelRecord[] = [];

  for (const item of [...collectRes.posts, ...dbRes.records]) {
    const key = `${item.platform}:${item.content.slice(0, 80).toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return {
    ok: collectRes.ok || dbRes.ok,
    source:
      collectRes.source === "supabase-edge"
        ? "supabase-edge"
        : dbRes.source === "supabase-db"
        ? "supabase-db"
        : "local-fallback",
    district: districtParam ?? null,
    keyword: keyword ?? null,
    records: merged,
    total: merged.length,
    synced_at: new Date().toISOString(),
    error: collectRes.error || dbRes.error,
  };
}
