// twitter-collect — FREE-TIER modunda lokal sosyal feed üreticisine yönlenir.
// X (Twitter) API v2 yalnızca TWITTER_LIVE_ENABLED="1" secret'ı varsa çağrılır;
// aksi halde (varsayılan) gerçekçi demo sosyal sinyal mock-data-injector'den gelir.
// Canlı modda: OAuth 2.0 token yenileme + 429 rate-limit backoff koruması aktif.

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";
import { analyzeText } from "../_shared/nlp.ts";

const TWITTER_API = "https://api.twitter.com/2";
const SEARCH_QUERY =
  '(Muğla OR Bodrum OR Fethiye OR Marmaris OR Datça OR Seydikemer OR Menteşe OR Milas OR Ortaca OR Dalaman OR Yatağan OR Köyceğiz OR Ula OR Kavaklıdere) lang:tr -is:retweet';

// OAuth 2.0 user-context token yenileme (PKCE akışı sonrası refresh_token)
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = Deno.env.get("TWITTER_REFRESH_TOKEN");
  const clientId = Deno.env.get("TWITTER_CLIENT_ID");
  const clientSecret = Deno.env.get("TWITTER_CLIENT_SECRET");
  if (!refreshToken || !clientId) return null;

  const resp = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${clientId}:${clientSecret ?? ""}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!resp.ok) return null;
  const json = await resp.json();

  // Yeni token'ları sonraki çalıştırmalar için cache tablosunda sakla
  // (edge function secret store'a yazamaz — read-only).
  const sb = getServiceClient();
  if (sb && json.access_token) {
    await sb.from("live_data_cache").upsert({
      data_type: "_twitter_tokens",
      data: { access_token: json.access_token, refresh_token: json.refresh_token ?? refreshToken, expires_at: Date.now() + (json.expires_in ?? 7200) * 1000 },
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 3600e3).toISOString(),
      source: "twitter-oauth",
    }, { onConflict: "data_type" });
  }
  return json.access_token ?? null;
}

async function getToken(): Promise<string | null> {
  // 1) App-only bearer (arama için yeterli, en basit yol)
  const bearer = Deno.env.get("TWITTER_BEARER_TOKEN");
  if (bearer) return bearer;

  // 2) Cache'lenmiş user-context token (hâlâ geçerliyse)
  const sb = getServiceClient();
  if (sb) {
    const { data } = await sb.from("live_data_cache").select("data")
      .eq("data_type", "_twitter_tokens").maybeSingle();
    const cached = data?.data as { access_token?: string; expires_at?: number } | undefined;
    if (cached?.access_token && (cached.expires_at ?? 0) > Date.now() + 60e3) {
      return cached.access_token;
    }
  }

  // 3) Refresh
  return await refreshAccessToken();
}

interface TweetLite { id: string; text: string; author_id?: string; created_at?: string; }

async function searchRecent(token: string): Promise<{ tweets: TweetLite[]; retryAfterSec?: number; status: number }> {
  const params = new URLSearchParams({
    query: SEARCH_QUERY,
    max_results: "100",
    "tweet.fields": "created_at,author_id,geo,public_metrics",
  });
  const resp = await fetch(`${TWITTER_API}/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (resp.status === 429) {
    return { tweets: [], retryAfterSec: Number(resp.headers.get("x-rate-limit-reset") ?? 0), status: 429 };
  }
  if (!resp.ok) return { tweets: [], status: resp.status };
  const json = await resp.json();
  return { tweets: (json.data ?? []) as TweetLite[], status: 200 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // FREE-TIER (varsayılan): canlı X API çağrısı keskülde; yerel feed üret
  if (Deno.env.get("TWITTER_LIVE_ENABLED") !== "1") {
    const base = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    try {
      const resp = await fetch(`${base}/functions/v1/mock-data-injector`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ perDistrict: 4, hours: 6 }),
      });
      const out = await resp.json().catch(() => ({}));
      return new Response(JSON.stringify({ ok: true, mode: "local-feed", ...out }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ ok: true, mode: "local-feed", error: String(err) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // CANLI MOD (TWITTER_LIVE_ENABLED=1)
  const sb = getServiceClient();
  const token = await getToken();

  // API anahtarı yoksa sessizce başarılı dön — serbest kaynak akışı devam eder
  if (!sb || !token) {
    // Canlı mod açık ama kimlik yok → lokal feed'e düş (boş veriden iyi)
    const base = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    try {
      await fetch(`${base}/functions/v1/mock-data-injector`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ perDistrict: 4, hours: 6 }),
      });
    } catch { /* sessizce geç */ }
    return new Response(JSON.stringify({ ok: true, mode: "local-feed-fallback", skipped: "twitter credentials not configured" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { tweets, retryAfterSec, status } = await searchRecent(token);

  // Rate-limit: işi kuyruğa backoff ile geri bırak, crash etme
  if (status === 429) {
    const backoffSec = retryAfterSec ? Math.max(retryAfterSec - Math.floor(Date.now() / 1000), 60) : 900;
    await sb.from("job_queue").insert({
      job_type: "twitter_fetch", payload: { query: SEARCH_QUERY },
      run_after: new Date(Date.now() + backoffSec * 1000).toISOString(), priority: 50,
    });
    return new Response(JSON.stringify({ ok: true, rateLimited: true, retryInSec: backoffSec }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let inserted = 0;
  for (const t of tweets) {
    const nlp = analyzeText(t.text ?? "");
    const { error } = await sb.from("social_posts").upsert({
      platform: "twitter",
      content: t.text ?? "",
      author: t.author_id ?? null,
      url: `https://x.com/i/web/status/${t.id}`,
      published_at: t.created_at ?? new Date().toISOString(),
      keywords_matched: nlp.entities.map(e => e.name),
      region: nlp.district,
      district: nlp.district,
      category: nlp.category,
      sentiment: nlp.sentiment,
      sentiment_score: nlp.sentimentScore,
      sentiment_method: "keyword",
      analyzed_at: new Date().toISOString(),
      entities: nlp.entities,
      lat: nlp.lat,
      lon: nlp.lon,
    }, { onConflict: "content_hash", ignoreDuplicates: true });
    if (!error) inserted++;
  }

  return new Response(JSON.stringify({ ok: true, fetched: tweets.length, inserted }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
