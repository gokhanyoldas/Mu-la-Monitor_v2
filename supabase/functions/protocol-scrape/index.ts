// supabase/functions/protocol-scrape/index.ts
// Scrapes https://www.mugla.gov.tr/il-protokol-listesi and returns structured data

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Fetch the protocol page
    const res = await fetch("https://www.mugla.gov.tr/il-protokol-listesi", {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();

    // Parse HTML to extract protocol table
    // Table structure: [sıra, ünvan, ad soyad, iş tel, faks tel]
    // Category rows have 2 cells (number + category name with colspan)
    const protocol: Array<{
      sira: string;
      unvan: string;
      isim: string;
      telefon: string;
      faks: string;
      kategori: string;
    }> = [];

    // Simple regex-based HTML parser for the table
    // Find the main protocol table (second table on page)
    const tableMatches = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
    if (!tableMatches || tableMatches.length < 2) {
      throw new Error("Protocol table not found");
    }

    const tableHtml = tableMatches[1];
    const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    let currentCategory = "";

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];

      // Decode all HTML entities including Turkish chars (&#304; = İ, &#305; = ı, etc.)
      const decodeEntities = (s: string) =>
        s
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&#([0-9]+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      // Strip HTML tags, decode entities, normalize whitespace
      const getText = (html: string) =>
        decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
      const texts = cells.map(getText);

      // Check for colspan (category row indicator)
      const hasColspan = cells.some(c => /colspan/i.test(c));

      if (hasColspan || cells.length === 2) {
        // Category row
        currentCategory = texts[texts.length - 1] || texts[0] || "";
        continue;
      }

      if (texts.length < 5) continue;

      const [sira, unvan, isim, telefon, faks] = texts;

      // Skip empty or sub-category rows
      if (!isim && !unvan) continue;
      if (sira && !isim) {
        currentCategory = unvan;
        continue;
      }

      protocol.push({ sira: sira || "", unvan, isim, telefon, faks, kategori: currentCategory });
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocol,
        count: protocol.length,
        source: "https://www.mugla.gov.tr/il-protokol-listesi",
        scraped_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Protocol scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, protocol: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
