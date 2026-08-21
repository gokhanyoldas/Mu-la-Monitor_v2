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

interface FeedSource { name: string; url: string; type: "rss" | "html"; platform: "news" | "emergency"; }

// 13 ilçeyi kapsayan Google News RSS sorguları (NLP NER ilçe etiketlemesi yapar)
const GN = (q: string) => `https://news.google.com/rss/search?q=${q}&hl=tr&gl=TR&ceid=TR:tr`;

const SOURCES: FeedSource[] = [
  // ── Acil durum & kamu kaynakları ──
  { name: "AFAD Duyurular", type: "html", platform: "emergency", url: "https://www.afad.gov.tr/haberler" },
  {
    name: "Deprem İzleme (USGS)",
    type: "rss", platform: "emergency",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.atom",
  },
  // ── Muğla Büyükşehir & İlçe Belediyeleri ──
  { name: "Muğla Büyükşehir Belediyesi", type: "html", platform: "news", url: "https://www.mugla.bel.tr/haberler" },
  { name: "Bodrum Belediyesi", type: "html", platform: "news", url: "https://www.bodrum.bel.tr/haberler" },
  { name: "Marmaris Belediyesi", type: "html", platform: "news", url: "https://www.marmaris.bel.tr/" },
  { name: "Fethiye Belediyesi", type: "html", platform: "news", url: "https://www.fethiye.bel.tr/" },
  { name: "Menteşe Belediyesi", type: "html", platform: "news", url: "https://www.mentese.bel.tr/haberler" },
  // ── İlçe bazlı yerel haber akışları (13 ilçe) ──
  { name: "Muğla Genel", type: "rss", platform: "news", url: GN("Mu%C4%9Fla") },
  { name: "Bodrum", type: "rss", platform: "news", url: GN("Bodrum+Mu%C4%9Fla") },
  { name: "Marmaris", type: "rss", platform: "news", url: GN("Marmaris") },
  { name: "Fethiye", type: "rss", platform: "news", url: GN("Fethiye") },
  { name: "Datça", type: "rss", platform: "news", url: GN("Dat%C3%A7a") },
  { name: "Menteşe", type: "rss", platform: "news", url: GN("Mente%C5%9Fe") },
  { name: "Milas", type: "rss", platform: "news", url: GN("Milas") },
  { name: "Dalaman", type: "rss", platform: "news", url: GN("Dalaman") },
  { name: "Ortaca", type: "rss", platform: "news", url: GN("Ortaca") },
  { name: "Seydikemer", type: "rss", platform: "news", url: GN("Seydikemer") },
  { name: "Köyceğiz", type: "rss", platform: "news", url: GN("K%C3%B6yce%C4%9Fiz") },
  { name: "Ula", type: "rss", platform: "news", url: GN("Ula+Mu%C4%9Fla") },
  { name: "Yatağan", type: "rss", platform: "news", url: GN("Yata%C4%9Fan") },
  { name: "Kavaklıdere", type: "rss", platform: "news", url: GN("Kavakl%C4%B1dere") },
];

function parseRssItems(xml: string, limit = 20): { title: string; link: string; pubDate: string; description: string }[] {
  // Atom feed'leri (USGS vb.) <entry> kullanır — ikisini de destekle
  const atom = xml.match(/<entry>([\s\S]*?)<\/entry>/g);
  if (atom) {
    return atom.slice(0, limit).map(e => ({
      title: stripCdata(e.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ""),
      link: e.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "",
      pubDate: e.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] ?? e.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? new Date().toISOString(),
      description: stripCdata(e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "").replace(/<[^>]+>/g, ""),
    })).filter(i => i.title.length > 5);
  }
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
          platform: src.platform === "emergency" ? "emergency_feed" : "news",
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
        if (!error) {
          stats[src.name].inserted++;
          // Acil durum kaynağından gelen ve afet kategorisine düşen içerikler
          // canlı haritada kritik pin olarak görünsün
          if (src.platform === "emergency" && nlp.category === "fire_disaster") {
            await sb.from("alert_events").insert({
              type: "fire", severity: "high",
              title: item.title.slice(0, 180),
              body: (item.description || item.text || "").slice(0, 400),
              source: src.name,
              lat: nlp.lat, lon: nlp.lon,
              metadata: { url },
            }).then(() => {}, () => {});
          }
        }
      }
    } catch (err) {
      console.warn(`[news-scrape] ${src.name} başarısız:`, err);
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
