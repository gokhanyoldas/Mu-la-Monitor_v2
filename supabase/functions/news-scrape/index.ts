// news-scrape — Muğla yerel haber kaynakları + belediye duyuruları + RSS.
// User-agent rotasyonu, timeout koruması ve NLP zenginleştirme ile
// social_posts tablosuna yazar (content_hash unique — otomatik dedupe).

import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/cache.ts";
import { analyzeText } from "../_shared/nlp.ts";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "MuglaMonitorBot/1.0 (+https://mu-la-monitor-v2.vercel.app)",
];
let uaIdx = 0;
const nextUA = () => USER_AGENTS[uaIdx++ % USER_AGENTS.length];

interface FeedSource { name: string; url: string; type: "rss" | "html"; }

const SOURCES: FeedSource[] = [
  // Muğla yerel basın RSS
  { name: "Muğla Haber (Google News RSS)", type: "rss", url: "https://news.google.com/rss/search?q=Mu%C4%9Fla&hl=tr&gl=TR&ceid=TR:tr" },
  { name: "Bodrum (Google News RSS)", type: "rss", url: "https://news.google.com/rss/search?q=Bodrum+Mu%C4%9Fla&hl=tr&gl=TR&ceid=TR:tr" },
  { name: "Marmaris (Google News RSS)", type: "rss", url: "https://news.google.com/rss/search?q=Marmaris&hl=tr&gl=TR&ceid=TR:tr" },
  { name: "Fethiye (Google News RSS)", type: "rss", url: "https://news.google.com/rss/search?q=Fethiye&hl=tr&gl=TR&ceid=TR:tr" },
  { name: "Datça (Google News RSS)", type: "rss", url: "https://news.google.com/rss/search?q=Dat%C3%A7a&hl=tr&gl=TR&ceid=TR:tr" },
  // Belediye duyuruları
  { name: "Muğla Büyükşehir Belediyesi", type: "html", url: "https://www.mugla.bel.tr/haberler" },
  { name: "Menteşe Belediyesi", type: "html", url: "https://www.mentese.bel.tr/haberler" },
];

function parseRssItems(xml: string, limit = 20): { title: string; link: string; pubDate: string; description: string }[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];
  return items.slice(0, limit).map(item => ({
    title: stripCdata(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    link: stripCdata(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ""),
    pubDate: item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? new Date().toISOString(),
    description: stripCdata(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "").replace(/<[^>]+>/g, ""),
  })).filter(i => i.title.length > 5);
}

const stripCdata = (s: string) =>
  s.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

// Basit HTML başlık kazıma (belediye siteleri RSS sunmuyorsa)
function parseHtmlTitles(html: string, limit = 15): { title: string; link: string }[] {
  const anchors = html.match(/<a[^>]+href="([^"]*(?:haber|duyuru|news)[^"]*)"[^>]*>([^<]{10,200})<\/a>/gi) ?? [];
  const out: { title: string; link: string }[] = [];
  for (const a of anchors.slice(0, limit)) {
    const href = a.match(/href="([^"]+)"/i)?.[1] ?? "";
    const text = a.replace(/<[^>]+>/g, "").trim();
    if (text.length > 10 && href) out.push({ title: text, link: href });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = getServiceClient();
  if (!sb) {
    return new Response(JSON.stringify({ ok: false, error: "no service client" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const stats: Record<string, { fetched: number; inserted: number }> = {};

  for (const src of SOURCES) {
    stats[src.name] = { fetched: 0, inserted: 0 };
    try {
      const resp = await fetch(src.url, {
        headers: { "User-Agent": nextUA(), Accept: src.type === "rss" ? "application/rss+xml,application/xml,text/xml" : "text/html" },
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) continue;
      const body = await resp.text();

      const items = src.type === "rss"
        ? parseRssItems(body).map(i => ({ ...i, text: `${i.title} ${i.description}` }))
        : parseHtmlTitles(body).map(i => ({ ...i, pubDate: new Date().toISOString(), text: i.title }));

      stats[src.name].fetched = items.length;

      for (const item of items) {
        const nlp = analyzeText(item.text);
        const url = item.link.startsWith("http") ? item.link : new URL(item.link, src.url).href;
        const { error } = await sb.from("social_posts").upsert({
          platform: "news",
          content: item.text.slice(0, 2000),
          author: src.name,
          url,
          published_at: new Date(item.pubDate).toISOString(),
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
        if (!error) stats[src.name].inserted++;
      }
    } catch (err) {
      console.warn(`[news-scrape] ${src.name} başarısız:`, err);
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
