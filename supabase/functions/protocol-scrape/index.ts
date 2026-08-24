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

      // Decode all HTML entities including Turkish chars (named + numeric)
      const NAMED: Record<string, string> = {
        amp: '&', lt: '<', gt: '>', nbsp: ' ', quot: '"', apos: "'",
        ccedil: 'ç', Ccedil: 'Ç', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü',
        iuml: 'ï', Iuml: 'Ï', scedil: 'ş', Scedil: 'Ş', gbreve: 'ğ', Gbreve: 'Ğ',
        icirc: 'î', Icirc: 'Î', acirc: 'â', Acirc: 'Â',
      };
      const decodeEntities = (s: string) =>
        s
          .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name] ?? m)
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

    // ── DB persist + değişiklik takibi (service client varsa) ──
    const sbUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    let changesSummary: { added: number; removed: number; updated: number } | null = null;
    if (sbUrl && sbKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(sbUrl, sbKey);
      const { data: prev } = await sb.from("protocol_members").select("unvan, isim, telefon, kategori");

      const norm = (x: unknown) => (x ?? "").toString().trim().toLocaleLowerCase("tr");
      const keyOf = (m: { unvan: string; isim: string }) => `${norm(m.unvan)}|${norm(m.isim)}`;
      const prevMap = new Map((prev ?? []).map(r => [keyOf({ unvan: r.unvan, isim: r.isim }), r]));

      const changes: { change_type: string; unvan: string; isim_old: string | null; isim_new: string | null; detail: string }[] = [];
      let added = 0, removed = 0, updated = 0;

      for (const m of protocol) {
        const k = keyOf({ unvan: norm(m.unvan), isim: norm(m.isim) });
        const prevRow = prevMap.get(k);
        if (!prevRow) {
          added++;
          changes.push({ change_type: "added", unvan: m.unvan, isim_old: null, isim_new: m.isim, detail: `Yeni protokol üyesi: ${m.unvan} — ${m.isim}` });
        } else if (prevRow.telefon !== m.telefon) {
          updated++;
          changes.push({ change_type: "updated", unvan: m.unvan, isim_old: m.isim, isim_new: m.isim, detail: `İletişim güncellendi (${m.isim}): ${prevRow.telefon} → ${m.telefon}` });
        }
        prevMap.delete(k);
      }
      for (const [k, r] of prevMap) {
        removed++;
        changes.push({ change_type: "removed", unvan: r.unvan, isim_old: r.isim, isim_new: null, detail: `Protokolden kaldırıldı: ${r.unvan} — ${r.isim}` });
      }

      // Snapshot'ı replace et (basit tam yenileme — takip liste hepsini tutar)
      if (protocol.length > 0) {
        await sb.from("protocol_members").delete().neq("unvan", "").then(() => {});
        await sb.from("protocol_members").insert(
          protocol.map(m => ({
            isim: m.isim, unvan: m.unvan, kategori: m.kategori,
            telefon: m.telefon, faks: m.faks,
            district: m.unvan.match(/^(.+?)\s+(Kaymakamı|Belediye\s+Başkanı)$/)?.[1] ?? null,
          }))
        );
      }
      if (changes.length > 0) {
        await sb.from("protocol_changes").insert(
          changes.map(c => ({ ...c, scraped_at: new Date().toISOString() }))
        );
        // Önemli görevlerdeki değişimler haritada uyarı olarak görünür
        const important = changes.filter(c => /Kaymakamı|Vali|Belediye Başkanı|Başsavcısı|Rektör/i.test(c.unvan));
        for (const c of important.slice(0, 5)) {
          await sb.from("alert_events").insert({
            type: "governance", severity: "medium",
            title: `Protokol değişikliği: ${c.unvan}`,
            body: c.detail, source: "Protokol İzleme",
            metadata: { change_type: c.change_type },
          }).then(() => {}, () => {});
        }
      }
      changesSummary = { added, removed, updated };
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocol,
        count: protocol.length,
        changes: changesSummary,
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
