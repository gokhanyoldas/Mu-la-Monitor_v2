// supabase/functions/social-collect/index.ts
// Collects social data from: Google News RSS, Reddit, Ekşi Sözlük
// Persists to DB: social_posts, social_trends, source_reliability
// No API keys needed - all free sources

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CollectedPost {
  platform: string;
  content: string;
  author: string;
  url: string;
  published_at: string;
  keywords_matched: string[];
  region?: string;
}

const DEFAULT_KEYWORDS = ["Muğla", "Bodrum", "Fethiye", "Marmaris", "Milas", "Datça", "Dalaman", "Menteşe", "Ortaca", "Seydikemer"];

// Region detection
const REGION_MAP: Record<string, string> = {
  "bodrum": "Bodrum", "marmaris": "Marmaris", "fethiye": "Fethiye",
  "datça": "Datça", "dalaman": "Dalaman", "milas": "Milas",
  "köyceğiz": "Köyceğiz", "ortaca": "Ortaca", "menteşe": "Menteşe",
  "yatağan": "Yatağan", "kavaklıdere": "Kavaklıdere", "seydikemer": "Seydikemer",
  "ölüdeniz": "Fethiye", "göcek": "Dalaman", "turgutreis": "Bodrum",
  "gümüşlük": "Bodrum", "hisarönü": "Fethiye", "dalyan": "Ortaca",
  "akyaka": "Menteşe", "muğla": "Muğla Merkez",
};

function detectRegion(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, region] of Object.entries(REGION_MAP)) {
    if (lower.includes(key)) return region;
  }
  return null;
}

// ─── Google News RSS ───
async function fetchGoogleNews(keywords: string[]): Promise<CollectedPost[]> {
  const posts: CollectedPost[] = [];
  const queries = [
    keywords.slice(0, 3).join(" OR "),
    keywords.slice(3, 6).join(" OR "),
  ];

  for (const query of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;
      const resp = await fetch(url, { 
        headers: { "User-Agent": "MuglaMonitor/1.0" },
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      
      for (const item of items.slice(0, 15)) {
        const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/&lt;!\[CDATA\[(.*?)\]\]&gt;|<!\[CDATA\[(.*?)\]\]>/g, "$1$2") || "";
        const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
        const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
        const source = item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, "$1") || "Google News";
        
        const matchedKw = keywords.filter(kw => title.toLowerCase().includes(kw.toLowerCase()));
        if (matchedKw.length > 0) {
          posts.push({
            platform: "news",
            content: title.trim(),
            author: source.trim(),
            url: link.trim(),
            published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            keywords_matched: matchedKw,
            region: detectRegion(title),
          });
        }
      }
    } catch (e) {
      console.error("Google News fetch error:", e);
    }
  }
  return posts;
}

// ─── Reddit ───
async function fetchReddit(keywords: string[]): Promise<CollectedPost[]> {
  const posts: CollectedPost[] = [];
  const subreddits = ["Turkey", "turkiye"];
  const searchQuery = keywords.slice(0, 5).join(" OR ");
  
  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(searchQuery)}&sort=new&limit=15&restrict_sr=on&t=week`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "MuglaMonitor/1.0 (Educational)" },
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const children = data?.data?.children || [];
      
      for (const child of children) {
        const post = child.data;
        if (!post) continue;
        const text = `${post.title || ""} ${post.selftext || ""}`;
        const matchedKw = keywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
        
        if (matchedKw.length > 0) {
          posts.push({
            platform: "reddit",
            content: (post.title || "").slice(0, 300),
            author: `u/${post.author || "unknown"}`,
            url: `https://reddit.com${post.permalink || ""}`,
            published_at: new Date((post.created_utc || 0) * 1000).toISOString(),
            keywords_matched: matchedKw,
            region: detectRegion(text),
          });
        }
      }
    } catch (e) {
      console.error("Reddit fetch error:", e);
    }
  }
  return posts;
}

// ─── Ekşi Sözlük ───
async function fetchEksiSozluk(keywords: string[]): Promise<CollectedPost[]> {
  const posts: CollectedPost[] = [];
  const topics = ["mugla", "bodrum", "fethiye", "marmaris", "datca"];
  
  for (const topic of topics.slice(0, 3)) {
    try {
      const url = `https://eksisozluk1923.com/basliklar/gundem?q=${encodeURIComponent(topic)}`;
      const resp = await fetch(url, {
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html"
        },
        signal: AbortSignal.timeout(10000)
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      const titleMatches = html.match(/<a[^>]*href="\/([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];
      
      for (const match of titleMatches.slice(0, 10)) {
        const hrefMatch = match.match(/href="\/([^"]+)"/);
        const textMatch = match.match(/>([^<]+)</);
        if (hrefMatch && textMatch) {
          const title = textMatch[1].trim();
          const href = hrefMatch[1];
          const matchedKw = keywords.filter(kw => title.toLowerCase().includes(kw.toLowerCase()));
          if (matchedKw.length > 0 && title.length > 5) {
            posts.push({
              platform: "eksisozluk",
              content: title,
              author: "Ekşi Sözlük",
              url: `https://eksisozluk1923.com/${href}`,
              published_at: new Date().toISOString(),
              keywords_matched: matchedKw,
              region: detectRegion(title),
            });
          }
        }
      }
    } catch (e) {
      console.error("Ekşi Sözlük fetch error:", e);
    }
  }
  return posts;
}

// ─── Persist to Database ───

// ─── Local News RSS Scraper ───
async function fetchLocalNewsSources(supabase: any, keywords: string[]): Promise<CollectedPost[]> {
  const posts: CollectedPost[] = [];

  try {
    // Load active sources with RSS feeds from DB
    const { data: sources } = await supabase
      .from("news_sources")
      .select("name, url, rss_url, region")
      .eq("is_active", true)
      .not("rss_url", "is", null);

    if (!sources || sources.length === 0) return posts;

    for (const src of sources) {
      try {
        const resp = await fetch(src.rss_url, {
          headers: { "User-Agent": "MuglaMonitor/1.0 RSS Reader" },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) continue;
        const xml = await resp.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const item of items.slice(0, 20)) {
          const rawTitle = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "";
          const title = rawTitle.replace(/<!\[CDATA\[(.*)\]\]>/g, "$1").replace(/&amp;/g, "&").trim();
          const rawLink = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ||
                          item.match(/<link[^>]*href="([^"]+)"/)?.[1] || "";
          const link = rawLink.replace(/<!\[CDATA\[(.*)\]\]>/g, "$1").trim();
          const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
          const descRaw = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "";
          const description = descRaw.replace(/<[^>]+>/g, "").replace(/<!\[CDATA\[(.*)\]\]>/g, "$1").slice(0, 300).trim();

          const text = `${title} ${description}`;
          const matchedKw = keywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
          if (matchedKw.length === 0 || title.length < 5) continue;

          posts.push({
            platform: `news_rss:${src.name.toLowerCase().replace(/\s+/g, "_")}`,
            content: description || title,
            author: src.name,
            url: link,
            published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            keywords_matched: matchedKw,
            region: src.region || detectRegion(text),
          });
        }
      } catch (e) {
        console.error(`RSS fetch error for ${src.name}:`, e);
      }
    }
  } catch (e) {
    console.error("fetchLocalNewsSources error:", e);
  }

  return posts;
}

// ─── Monitored Accounts Fetcher ───
// Collects public posts from user-configured social media usernames.
// Twitter: via Nitter (no auth needed)  |  YouTube: via RSS feed
async function fetchMonitoredAccounts(supabase: any, keywords: string[]): Promise<CollectedPost[]> {
  const posts: CollectedPost[] = [];
  try {
    const { data: accounts } = await supabase
      .from("monitored_accounts")
      .select("*")
      .eq("is_active", true);
    if (!accounts || accounts.length === 0) return posts;

    const kw = keywords.map((k: string) => k.toLowerCase());

    for (const account of accounts) {
      try {
        if (account.platform === "twitter") {
          // Use Nitter to fetch public tweets without authentication
          const NITTER_INSTANCES = [
            "nitter.net", "nitter.privacydev.net", "nitter.poast.org",
            "nitter.moomoo.me", "nitter.pussthecat.org",
          ];
          for (const instance of NITTER_INSTANCES) {
            try {
              const url = `https://${instance}/${account.username}/rss`;
              const resp = await fetch(url, {
                headers: { "User-Agent": "MuglaMonitor/1.0 RSS" },
                signal: AbortSignal.timeout(8000),
              });
              if (!resp.ok) continue;
              const xml = await resp.text();
              const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
              for (const item of items.slice(0, 10)) {
                const title    = item.match(/<title><![CDATA[(.*?)]]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || "";
                const desc     = item.match(/<description><![CDATA[(.*?)]]><\/description>/)?.[1] || item.match(/<description>(.*?)<\/description>/)?.[1] || "";
                const link     = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
                const pubDate  = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
                const text     = title + " " + desc;
                const textLow  = text.toLowerCase();
                const matched  = kw.filter((k: string) => textLow.includes(k));
                if (matched.length === 0) continue;
                posts.push({
                  platform: "twitter",
                  content: text.slice(0, 500),
                  source_url: link,
                  source_author: account.display_name || account.username,
                  collected_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                  keywords_matched: matched,
                  region: null,
                });
              }
              break; // success — no need to try other instances
            } catch { continue; }
          }
          // Update last_checked
          await supabase.from("monitored_accounts").update({ last_checked: new Date().toISOString() }).eq("id", account.id);

        } else if (account.platform === "youtube") {
          // YouTube channel RSS (no API key needed)
          const channelId = account.channel_id || account.username;
          const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          const resp = await fetch(url, {
            headers: { "User-Agent": "MuglaMonitor/1.0" },
            signal: AbortSignal.timeout(8000),
          });
          if (resp.ok) {
            const xml = await resp.text();
            const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
            for (const entry of entries.slice(0, 10)) {
              const title   = entry.match(/<title>(.*?)<\/title>/)?.[1] || "";
              const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";
              const desc    = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || "";
              const pubDate = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";
              const text    = title + " " + desc;
              const textLow = text.toLowerCase();
              const matched = kw.filter((k: string) => textLow.includes(k));
              if (matched.length === 0) continue;
              posts.push({
                platform: "web",
                content: text.slice(0, 500),
                source_url: videoId ? `https://youtube.com/watch?v=${videoId}` : "",
                source_author: account.display_name || account.username,
                collected_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                keywords_matched: matched,
                region: null,
              });
            }
            await supabase.from("monitored_accounts").update({ last_checked: new Date().toISOString() }).eq("id", account.id);
          }
        }
        // Instagram, Facebook, LinkedIn: public scraping not reliable without auth;
        // they are stored in the table but skipped until a reliable source is available.
      } catch { /* skip this account */ }
    }
  } catch { /* table may not exist yet */ }
  return posts;
}


// ─── Email Alerts Processor ───
async function processEmailAlerts(supabase: any, keywords: string[]): Promise<CollectedPost[]> {
  const posts: CollectedPost[] = [];
  try {
    const { data: alerts } = await supabase
      .from("email_alerts")
      .select("*")
      .eq("processed", false)
      .order("email_received_at", { ascending: false })
      .limit(50);

    if (!alerts || alerts.length === 0) return posts;

    for (const alert of alerts) {
      const text = `${alert.article_title || ""} ${alert.article_snippet || ""}`;
      const matchedKw = keywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));

      posts.push({
        platform: alert.source || "email_alerts",
        content: alert.article_snippet || alert.article_title,
        author: alert.source_domain || alert.source,
        url: alert.article_url || "",
        published_at: alert.published_at || alert.email_received_at,
        keywords_matched: matchedKw.length > 0 ? matchedKw : [alert.alert_keyword || ""],
        region: detectRegion(text),
      });

      // Mark as processed
      await supabase.from("email_alerts").update({ processed: true }).eq("id", alert.id);
    }
  } catch (e) {
    console.error("processEmailAlerts error:", e);
  }
  return posts;
}

async function persistToDB(posts: CollectedPost[], keywords: string[]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Insert posts (upsert via content_hash)
  // ── Inline keyword sentiment analysis (no API needed) ──────────────────────
  const NEGATIVE_KW = [
    "ölü","ölüm","hayatını kaybetti","can kaybı","yaralı","kaza",
    "yangın","yanıyor","sel","deprem","sarsıntı","patlama",
    "bomba","saldırı","çöktü","yıkıldı","feci",
    "çöp","kirlilik","duman","rezalet","skandal","yolsuzluk","usulsüz","kaçak",
    "sorun","problem","hata","tepki yağdı","şok","endişe",
    "itiraz","grev","protesto","eleştiri","kriz",
  ];
  const POSITIVE_KW = [
    "yatırım","tamamlandı","açıldı","başarı","ödül","ihracat",
    "büyüme","kalkınma","gelişme","rekor","artış",
    "turizm","festival","etkinlik","ziyaretçi","güzel","mükemmel",
    "şampiyon","final","zafer","gol","kazandı",
    "işbirliği","proje","imzalandı","katkı","destek",
  ];

  function analyzeSentiment(text: string): { sentiment: string; confidence: number } {
    const lower = text.toLowerCase();
    const negHits = NEGATIVE_KW.filter(kw => lower.includes(kw)).length;
    const posHits = POSITIVE_KW.filter(kw => lower.includes(kw)).length;
    if (negHits > posHits) return { sentiment: "negative", confidence: Math.min(0.5 + negHits * 0.12, 0.95) };
    if (posHits > negHits) return { sentiment: "positive", confidence: Math.min(0.5 + posHits * 0.12, 0.95) };
    return { sentiment: "neutral", confidence: 0.55 };
  }

  const postsToInsert = posts.map(p => {
    const { sentiment, confidence } = analyzeSentiment(p.content);
    return {
      platform: p.platform,
      content: p.content,
      author: p.author,
      url: p.url,
      published_at: p.published_at,
      keywords_matched: p.keywords_matched,
      region: p.region || null,
      collected_at: new Date().toISOString(),
      sentiment,
      sentiment_confidence: confidence,
      sentiment_method: "keyword",
      analyzed_at: new Date().toISOString(),
    };
  });

  if (postsToInsert.length > 0) {
    const { error } = await supabase
      .from("social_posts")
      .upsert(postsToInsert, { onConflict: "content_hash", ignoreDuplicates: true });
    if (error) console.error("Posts insert error:", error.message);
  }

  // 2. Update source reliability
  const sourceMap = new Map<string, { platform: string; count: number }>();
  for (const p of posts) {
    const key = `${p.platform}:${p.author}`;
    if (!sourceMap.has(key)) sourceMap.set(key, { platform: p.platform, count: 0 });
    sourceMap.get(key)!.count++;
  }

  for (const [key, value] of sourceMap) {
    const source_name = key.split(":").slice(1).join(":");
    // Upsert: increment total_posts, update last_seen
    const { data: existing } = await supabase
      .from("source_reliability")
      .select("total_posts, reliability_score")
      .eq("platform", value.platform)
      .eq("source_name", source_name)
      .single();

    if (existing) {
      const newTotal = existing.total_posts + value.count;
      // Score increases with frequency (capped at 0.95)
      const newScore = Math.min(0.95, existing.reliability_score + (value.count * 0.02));
      await supabase
        .from("source_reliability")
        .update({ total_posts: newTotal, reliability_score: newScore, last_seen_at: new Date().toISOString() })
        .eq("platform", value.platform)
        .eq("source_name", source_name);
    } else {
      // Base score by platform
      const baseScore: Record<string, number> = { news: 0.65, reddit: 0.45, eksisozluk: 0.40 };
      await supabase
        .from("source_reliability")
        .insert({
          platform: value.platform,
          source_name,
          total_posts: value.count,
          reliability_score: baseScore[value.platform] || 0.5,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        });
    }
  }

  // 3. Create trend data point (hourly aggregate)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
  const periodEnd = new Date(periodStart.getTime() + 60 * 60 * 1000);

  // Group by region
  const regionGroups = new Map<string, { pos: number; neg: number; neu: number; total: number }>();
  regionGroups.set("__all__", { pos: 0, neg: 0, neu: 0, total: posts.length });

  for (const p of posts) {
    const region = p.region || "__all__";
    if (!regionGroups.has(region)) regionGroups.set(region, { pos: 0, neg: 0, neu: 0, total: 0 });
    regionGroups.get(region)!.total++;
  }

  // Insert overall trend (sentiment will be updated after analysis)
  await supabase.from("social_trends").insert({
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    period_type: "hourly",
    mention_count: posts.length,
    top_keywords: keywords.slice(0, 5),
    created_at: now.toISOString(),
  });

  // 4. Log collection run
  await supabase.from("social_collection_runs").insert({
    platforms_queried: [...new Set(posts.map(p => p.platform))],
    keywords_used: keywords,
    posts_collected: posts.length,
    status: "completed",
    completed_at: now.toISOString(),
  });
}

// ─── Main Handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const keywords: string[] = body.keywords || DEFAULT_KEYWORDS;
    const platforms: string[] = body.platforms || ["news", "reddit", "eksisozluk"];

    const results: CollectedPost[] = [];
    const errors: string[] = [];

    // Create supabase client for DB-sourced scrapers
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fetchers: Promise<CollectedPost[]>[] = [];
    if (platforms.includes("news")) fetchers.push(fetchGoogleNews(keywords));
    if (platforms.includes("reddit")) fetchers.push(fetchReddit(keywords));
    if (platforms.includes("eksisozluk")) fetchers.push(fetchEksiSozluk(keywords));
    if (platforms.includes("local_rss") || !platforms.length) fetchers.push(fetchLocalNewsSources(supabase, keywords));
    if (platforms.includes("email_alerts")) fetchers.push(processEmailAlerts(supabase, keywords));
    // Always include monitored accounts (username-based monitoring)
    fetchers.push(fetchMonitoredAccounts(supabase, keywords));

    const allResults = await Promise.allSettled(fetchers);
    for (const result of allResults) {
      if (result.status === "fulfilled") {
        results.push(...result.value);
      } else {
        errors.push(result.reason?.message || "Unknown error");
      }
    }

    results.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

    // Persist to DB (fire-and-forget, don't block response)
    persistToDB(results, keywords).catch(e => console.error("Persist error:", e));

    return new Response(
      JSON.stringify({
        data: {
          posts: results.slice(0, 50),
          total: results.length,
          platforms_queried: platforms,
          keywords_used: keywords,
          collected_at: new Date().toISOString(),
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
