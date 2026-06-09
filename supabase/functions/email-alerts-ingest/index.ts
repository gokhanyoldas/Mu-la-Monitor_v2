// supabase/functions/email-alerts-ingest/index.ts
// Parses Google Alerts and Talkwalker Alert emails
// and stores articles in email_alerts table.
//
// Usage (two modes):
//  POST /email-alerts-ingest          { "emailHtml": "<html>...", "source": "google_alerts" }
//  POST /email-alerts-ingest/bulk     { "emails": [{html, source, receivedAt}, ...] }

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ParsedArticle {
  source: string;
  alertKeyword: string | null;
  articleTitle: string;
  articleUrl: string | null;
  articleSnippet: string | null;
  sourceDomain: string | null;
  publishedAt: string | null;
}

// ─── Google Alerts HTML Parser ───
function parseGoogleAlerts(html: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  // Extract alert keyword from subject/header  
  const keywordMatch = html.match(/Google Alerts.*?["""](.+?)["""]/i) ||
                       html.match(/<title>.*?["""](.+?)["""]/i) ||
                       html.match(/alert[^>]*>\s*(.+?)\s*</i);
  const alertKeyword = keywordMatch?.[1]?.trim() || null;

  // Match each news item — Google Alerts wraps items in <td> blocks with <a> links
  // Pattern: anchor link followed by snippet text
  const itemPatterns = [
    // Standard Google Alert item block
    /<td[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]{5,})<\/a>\s*<\/td>[\s\S]*?<td[^>]*>([^<]{10,})<\/td>/gi,
    // Simplified link + description
    /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,200})<\/a>([\s\S]{0,300}?)<(?:br|tr|td|\/)/gi,
  ];

  for (const pattern of itemPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = decodeGoogleNewsUrl(match[1]);
      const title = stripHtml(match[2]).trim();
      const snippet = match[3] ? stripHtml(match[3]).trim() : null;
      if (title.length < 10 || url.includes("google.com/alerts")) continue;

      articles.push({
        source: "google_alerts",
        alertKeyword,
        articleTitle: title,
        articleUrl: url,
        articleSnippet: snippet?.slice(0, 500) || null,
        sourceDomain: extractDomain(url),
        publishedAt: null,
      });
    }
    if (articles.length > 0) break;
  }

  return dedupeByTitle(articles);
}

// ─── Talkwalker Alerts HTML Parser ───
function parseTalkwalker(html: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  // Talkwalker keyword from subject
  const kwMatch = html.match(/Talkwalker Alert.*?["""](.+?)["""]/i) ||
                  html.match(/alert for[^"">]*["""](.+?)["""]/i);
  const alertKeyword = kwMatch?.[1]?.trim() || null;

  // Talkwalker wraps each result in <a> with title + site info below
  const linkPattern = /<a[^>]+href="(https?:\/\/(?!talkwalker)[^"]+)"[^>]*>([\s\S]{10,300}?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1].trim();
    const title = stripHtml(match[2]).trim();
    if (title.length < 10) continue;

    // Try to get snippet from the following text block
    const afterAnchor = html.slice(match.index + match[0].length, match.index + match[0].length + 400);
    const snippet = stripHtml(afterAnchor).replace(/\s+/g, " ").trim().slice(0, 400) || null;

    articles.push({
      source: "talkwalker",
      alertKeyword,
      articleTitle: title,
      articleUrl: url,
      articleSnippet: snippet,
      sourceDomain: extractDomain(url),
      publishedAt: null,
    });
  }

  return dedupeByTitle(articles);
}

function decodeGoogleNewsUrl(url: string): string {
  // Google wraps URLs: https://news.google.com/url?q=https://...
  try {
    const u = new URL(url);
    return u.searchParams.get("q") || url;
  } catch {
    return url;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dedupeByTitle(articles: ParsedArticle[]): ParsedArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    const key = a.articleTitle.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main Handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
  );

  try {
    const body = await req.json();
    const isBulk = Array.isArray(body.emails);

    const emailsToProcess: Array<{ html: string; source: string; receivedAt?: string }> = isBulk
      ? body.emails
      : [{ html: body.emailHtml || body.html || "", source: body.source || "google_alerts", receivedAt: body.receivedAt }];

    const allArticles: ParsedArticle[] = [];

    for (const { html, source, receivedAt } of emailsToProcess) {
      if (!html) continue;
      const parsed = source === "talkwalker" ? parseTalkwalker(html) : parseGoogleAlerts(html);
      allArticles.push(...parsed.map(a => ({ ...a, source: source || a.source })));
    }

    if (allArticles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No articles parsed", articles: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into email_alerts table (skip duplicates by title)
    const inserts = allArticles.map(a => ({
      source: a.source,
      alert_keyword: a.alertKeyword,
      article_title: a.articleTitle,
      article_url: a.articleUrl,
      article_snippet: a.articleSnippet,
      source_domain: a.sourceDomain,
      published_at: a.publishedAt,
      processed: false,
    }));

    const { data, error } = await supabase
      .from("email_alerts")
      .upsert(inserts, { onConflict: "article_title", ignoreDuplicates: true })
      .select("id");

    return new Response(
      JSON.stringify({
        parsed: allArticles.length,
        inserted: data?.length ?? 0,
        error: error?.message,
        articles: allArticles.slice(0, 5), // preview
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
