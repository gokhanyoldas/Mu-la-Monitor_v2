// supabase/functions/osint-lookup/index.ts
// Username OSINT lookup — checks multiple platforms with NO API keys
// Uses: public JSON APIs (GitHub, Reddit, Keybase, HN), HEAD/GET requests for others
// Called from: OSINTCenter.tsx -> POST { username: string }

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PlatformResult {
  platform: string;
  label: string;
  icon: string;
  profileUrl: string;
  status: "found" | "not_found" | "link_only" | "error";
  method: "api" | "head" | "link";
  detail?: string;
}

// ─── Platform definitions ────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "github",    label: "GitHub",       icon: "🐙", method: "api"  as const },
  { id: "reddit",    label: "Reddit",       icon: "👽", method: "api"  as const },
  { id: "keybase",   label: "Keybase",      icon: "🔑", method: "api"  as const },
  { id: "hackernews",label: "Hacker News",  icon: "🟠", method: "api"  as const },
  { id: "twitter",   label: "X (Twitter)",  icon: "🐦", method: "head" as const },
  { id: "eksisozluk",label: "Ekşi Sözlük", icon: "📝", method: "head" as const },
  { id: "instagram", label: "Instagram",    icon: "📸", method: "link" as const },
  { id: "linkedin",  label: "LinkedIn",     icon: "💼", method: "link" as const },
  { id: "tiktok",    label: "TikTok",       icon: "🎵", method: "link" as const },
  { id: "youtube",   label: "YouTube",      icon: "📺", method: "link" as const },
  { id: "facebook",  label: "Facebook",     icon: "📘", method: "link" as const },
  { id: "mastodon",  label: "Mastodon",     icon: "🦣", method: "head" as const },
];

function getProfileUrl(platform: string, username: string): string {
  const u = encodeURIComponent(username);
  switch (platform) {
    case "github":      return `https://github.com/${u}`;
    case "reddit":      return `https://www.reddit.com/user/${u}`;
    case "keybase":     return `https://keybase.io/${u}`;
    case "hackernews":  return `https://news.ycombinator.com/user?id=${u}`;
    case "twitter":     return `https://nitter.privacydev.net/${u}`;
    case "eksisozluk":  return `https://eksisozluk.com/biri/${u}`;
    case "instagram":   return `https://www.instagram.com/${u}/`;
    case "linkedin":    return `https://www.linkedin.com/in/${u}/`;
    case "tiktok":      return `https://www.tiktok.com/@${u}`;
    case "youtube":     return `https://www.youtube.com/@${u}`;
    case "facebook":    return `https://www.facebook.com/${u}`;
    case "mastodon":    return `https://fosstodon.org/@${u}`;
    default:            return "#";
  }
}

// ─── API-based checks ─────────────────────────────────────────────────────────

async function checkGitHub(username: string): Promise<"found" | "not_found" | "error"> {
  try {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { "User-Agent": "MuglaMonitor-OSINT/1.0", "Accept": "application/vnd.github+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 200) return "found";
    if (r.status === 404) return "not_found";
    return "error";
  } catch { return "error"; }
}

async function checkReddit(username: string): Promise<"found" | "not_found" | "error"> {
  try {
    const r = await fetch(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`, {
      headers: { "User-Agent": "MuglaMonitor-OSINT/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 200) {
      const data = await r.json();
      return data?.data?.name ? "found" : "not_found";
    }
    if (r.status === 404) return "not_found";
    return "error";
  } catch { return "error"; }
}

async function checkKeybase(username: string): Promise<"found" | "not_found" | "error"> {
  try {
    const r = await fetch(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return "error";
    const data = await r.json();
    const status = data?.them?.[0];
    return status ? "found" : "not_found";
  } catch { return "error"; }
}

async function checkHackerNews(username: string): Promise<"found" | "not_found" | "error"> {
  try {
    const r = await fetch(
      `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return "error";
    const data = await r.json();
    return data !== null ? "found" : "not_found";
  } catch { return "error"; }
}


// ─── Nitter failover list + checker ──────────────────────────────────────────
// Multiple public Nitter instances — if one is down the next is tried automatically

const NITTER_INSTANCES = [
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://nitter.1d4.us",
  "https://nitter.kavin.rocks",
  "https://nitter.unixfox.eu",
  "https://twiiit.com",
  "https://nitter.moomoo.me",
];

async function checkNitterWithFailover(username: string): Promise<"found" | "not_found" | "error"> {
  const path = `/${encodeURIComponent(username)}`;
  for (const instance of NITTER_INSTANCES) {
    try {
      const r = await fetch(`${instance}${path}`, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MuglaMonitor-OSINT/1.0)" },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      if (r.status === 200)  return "found";
      if (r.status === 404)  return "not_found";
      // Non-200/404 (e.g. 502, 503) → try next instance
      continue;
    } catch {
      // Timeout / network error → try next instance
      continue;
    }
  }
  return "error"; // all instances exhausted
}

async function checkHead(url: string): Promise<"found" | "not_found" | "error"> {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MuglaMonitor-OSINT/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (r.status === 200 || r.status === 301 || r.status === 302) return "found";
    if (r.status === 404) return "not_found";
    return "error";
  } catch { return "error"; }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username || username.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Username too short" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanUsername = username.trim().replace(/^@/, "");

    // Run all checks in parallel
    const checks = await Promise.allSettled([
      checkGitHub(cleanUsername),
      checkReddit(cleanUsername),
      checkKeybase(cleanUsername),
      checkHackerNews(cleanUsername),
      checkHead(getProfileUrl("twitter", cleanUsername)),
      checkHead(getProfileUrl("eksisozluk", cleanUsername)),
      checkHead(getProfileUrl("mastodon", cleanUsername)),
    ]);

    const apiChecks: Record<string, "found" | "not_found" | "error"> = {
      github:     checks[0].status === "fulfilled" ? checks[0].value : "error",
      reddit:     checks[1].status === "fulfilled" ? checks[1].value : "error",
      keybase:    checks[2].status === "fulfilled" ? checks[2].value : "error",
      hackernews: checks[3].status === "fulfilled" ? checks[3].value : "error",
      twitter:    checks[4].status === "fulfilled" ? checks[4].value : "error",
      eksisozluk: checks[5].status === "fulfilled" ? checks[5].value : "error",
      mastodon:   checks[6].status === "fulfilled" ? checks[6].value : "error",
    };

    const results: PlatformResult[] = PLATFORMS.map((p) => {
      const profileUrl = getProfileUrl(p.id, cleanUsername);
      let status: PlatformResult["status"] = "link_only";
      if (p.method === "api" || p.method === "head") {
        status = apiChecks[p.id] ?? "error";
      }
      return { platform: p.id, label: p.label, icon: p.icon, profileUrl, status, method: p.method };
    });

    const foundCount = results.filter((r) => r.status === "found").length;

    // Persist to Supabase
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    await db.from("osint_searches").insert({
      search_type: "username",
      query: cleanUsername,
      results: results,
      platform_count: PLATFORMS.length,
      found_count: foundCount,
    });

    return new Response(
      JSON.stringify({ username: cleanUsername, results, found_count: foundCount, searched_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
