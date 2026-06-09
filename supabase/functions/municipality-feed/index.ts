import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function parseRSSItems(xml: string, limit = 10) {
  const items: { title: string; link: string; pubDate: string; description: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const item = match[1];
    const get = (tag: string) => { const m = item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i")); return m ? m[1].trim() : ""; };
    items.push({ title: get("title"), link: get("link"), pubDate: get("pubDate"), description: get("description").replace(/<[^>]+>/g, "").slice(0, 200) });
  }
  return items;
}

async function fetchWithTimeout(url: string, ms = 5000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "MuglaMonitor/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(timeout); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "municipality";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10"), 30);
  try {
    let allItems: ReturnType<typeof parseRSSItems> = [];
    const googleNewsUrl = "https://news.google.com/rss/search?q=Mu%C4%9Fla+belediye&hl=tr&gl=TR&ceid=TR:tr";
    const feedUrls = source === "municipality" ? ["https://www.mugla.bel.tr/rss"] : source === "afad" ? ["https://afad.gov.tr/rss/haberler.rss"] : ["https://www.mugla.bel.tr/rss", "https://afad.gov.tr/rss/haberler.rss"];
    for (const feedUrl of feedUrls) {
      try { const xml = await fetchWithTimeout(feedUrl, 4000); allItems = [...allItems, ...parseRSSItems(xml, limit)]; } catch { /* try next */ }
    }
    if (allItems.length === 0) { const xml = await fetchWithTimeout(googleNewsUrl, 5000); allItems = parseRSSItems(xml, limit); }
    return new Response(JSON.stringify({ source, count: allItems.length, fetched_at: new Date().toISOString(), items: allItems.slice(0, limit) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), items: [] }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
