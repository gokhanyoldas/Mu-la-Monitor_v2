import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatDuration, parseTripsFromHtml } from "./obilet-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function scrapeFlight(apiKey: string, airportCode: string): Promise<any> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: airportCode === "DLM"
          ? "https://www.dalaman-airport.com/ucus-bilgileri"
          : "https://www.milas-bodrumairport.com/ucus-bilgileri",
        formats: [{ type: "json", prompt: `Extract all current flights from this airport page. For each flight return: flightNo, airline, destination, scheduled (HH:MM), estimated (HH:MM), status (one of: on_time, delayed, landed, boarding, departed, cancelled), gate, terminal. Also classify each as departure or arrival.` }],
        waitFor: 3000,
      }),
    });

    if (!res.ok) {
      console.error(`Firecrawl scrape error for ${airportCode}:`, res.status);
      return null;
    }

    const data = await res.json();
    const json = data?.data?.json || data?.json;
    return json;
  } catch (e) {
    console.error(`Flight scrape error ${airportCode}:`, e);
    return null;
  }
}

// obilet.com Muğla şehirlerarası rota listesi (statik HTML'deki rota bağlantıları)
const INTERCITY_ROUTES: { to: string; slug: string }[] = [
  { to: "İstanbul", slug: "istanbul" },
  { to: "Ankara", slug: "ankara" },
  { to: "İzmir", slug: "izmir" },
  { to: "Antalya", slug: "antalya" },
  { to: "Denizli", slug: "denizli" },
  { to: "Bursa", slug: "bursa" },
  { to: "Aydın", slug: "aydin" },
  { to: "Konya", slug: "konya" },
  { to: "Afyonkarahisar", slug: "afyonkarahisar" },
  { to: "Adana", slug: "adana" },
  { to: "Eskişehir", slug: "eskisehir" },
  { to: "Kayseri", slug: "kayseri" },
];

// Tek şehirlerarası rotanın seferlerini çek ve normalize et; başarısızsa null.
async function fetchIntercityRoute(route: { to: string; slug: string }): Promise<any | null> {
  try {
    const url = `https://www.obilet.com/otobus-bileti/mugla-${route.slug}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MuglaMonitor/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const trips = parseTripsFromHtml(html);
    if (trips.length === 0) return null;

    // Kalkış saatlerini (gidiş) sıralı ve eşsiz olarak topla
    const departures = Array.from(new Set(trips.map((t) => t.departure))).sort();
    // En düşük fiyatlı seferi referans al (bilet fiyatları gün içinde değişir)
    const best = trips.reduce((a, b) => (b.price > 0 && b.price < a.price ? b : a), trips[0]);

    return {
      line: `MUĞLA-${route.to.toUpperCase()}`,
      from: "Muğla",
      to: route.to,
      departures,
      weekday: departures,
      saturday: departures,
      sunday: departures,
      outbound_weekday: departures,
      outbound_saturday: departures,
      outbound_sunday: departures,
      // Dönüş yönü için aynı saat listesi (simetrik eş; obilet'te ters hat da aynı saatlerde çalışır)
      return_weekday: departures,
      return_saturday: departures,
      return_sunday: departures,
      carrier: Array.from(new Set(trips.map((t) => t.carrier))).slice(0, 3).join(", "),
      duration: formatDuration(trips[0].departure, trips[0].arrival),
      price: best.price > 0 ? `₺${Math.round(best.price)}` : "—",
      type: "şehirlerarası",
      source: url,
    };
  } catch {
    // tek rota hatası diğerlerini etkilemez
    return null;
  }
}

// obilet.com'dan şehirlerarası seferleri paralel çek; her şehir için gidiş yönü seferleri döndürür.
async function scrapeIntercityBuses(): Promise<any[]> {
  const settled = await Promise.all(INTERCITY_ROUTES.map(fetchIntercityRoute));
  return settled.filter((r): r is any => r !== null);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, airports } = await req.json();
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");

    // Yalnızca flights için Firecrawl gerekli; bus MUTTAŞ sayfalarından doğrudan okunur
    if (type === "flights" && !apiKey) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "flights") {
      const codes: string[] = airports || ["DLM", "BJV"];
      const results = await Promise.all(codes.map((c: string) => scrapeFlight(apiKey, c)));

      const airportData = codes.map((code, i) => {
        const raw = results[i];
        if (!raw) return { code, name: code === "DLM" ? "Dalaman Havalimanı" : "Milas-Bodrum Havalimanı", departures: [], arrivals: [] };

        const departures = (raw.departures || raw.flights?.filter((f: any) => f.type === "departure") || []).map((f: any) => ({
          flightNo: f.flightNo || f.flight_no || "",
          airline: f.airline || "",
          destination: f.destination || "",
          scheduled: f.scheduled || "",
          estimated: f.estimated || f.scheduled || "",
          status: f.status || "on_time",
          gate: f.gate || "",
          terminal: f.terminal || "",
        }));

        const arrivals = (raw.arrivals || raw.flights?.filter((f: any) => f.type === "arrival") || []).map((f: any) => ({
          flightNo: f.flightNo || f.flight_no || "",
          airline: f.airline || "",
          destination: f.destination || "",
          scheduled: f.scheduled || "",
          estimated: f.estimated || f.scheduled || "",
          status: f.status || "on_time",
          gate: f.gate || "",
          terminal: f.terminal || "",
        }));

        return {
          code,
          name: code === "DLM" ? "Dalaman Havalimanı" : "Milas-Bodrum Havalimanı",
          departures,
          arrivals,
        };
      });

      return new Response(JSON.stringify({ airports: airportData, scraped_at: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "bus") {
      // MUTTAŞ resmi hat sayfalarından canlı otobüs saatleri çek
      const MUTTAS_LINES = [
        { line: "48-7", from: "Menteşe", to: "Marmaris", url: "https://ulasim.muttas.com.tr/hat/48-7-mentese-marmaris-226" },
        { line: "48-2", from: "Menteşe", to: "Bodrum", url: "https://ulasim.muttas.com.tr/hat/48-2-mentese-bodrum-226" },
        { line: "48-3", from: "Menteşe", to: "Fethiye", url: "https://ulasim.muttas.com.tr/hat/48-3-mentese-fethiye-226" },
        { line: "48-4", from: "Menteşe", to: "Dalaman", url: "https://ulasim.muttas.com.tr/hat/48-4-mentese-dalaman-226" },
        { line: "48-5", from: "Menteşe", to: "Milas", url: "https://ulasim.muttas.com.tr/hat/48-5-mentese-milas-226" },
        { line: "48-6", from: "Menteşe", to: "Datça", url: "https://ulasim.muttas.com.tr/hat/48-6-mentese-datca-226" },
        { line: "48-8", from: "Menteşe", to: "Köyceğiz", url: "https://ulasim.muttas.com.tr/hat/48-8-mentese-koycegiz-226" },
      ];

      const routes: {
        line: string; from: string; to: string;
        weekday: string[]; saturday: string[]; sunday: string[];
        // Gidiş (from kalkış) ve Dönüş (to kalkış) ayrı listeler
        outbound_weekday: string[]; outbound_saturday: string[]; outbound_sunday: string[];
        return_weekday: string[]; return_saturday: string[]; return_sunday: string[];
        carrier: string; source: string; type: string;
        departures?: string[]; duration?: string; price?: string;
      }[] = [];

      for (const l of MUTTAS_LINES) {
        try {
          const res = await fetch(l.url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10000) });
          if (!res.ok) continue;
          const html = await res.text();
          const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

          // İki kalkış bloğunu ayır: "<From> Kalkış" ve "<To> Kalkış"
          const fromKalkis = new RegExp(`${l.from}\\s+Kalkış`, "i");
          const toKalkis = new RegExp(`${l.to}\\s+Kalkış`, "i");
          const parts = text.split(/(?=Menteşe\s+Kalkış|Marmaris\s+Kalkış|Bodrum\s+Kalkış|Fethiye\s+Kalkış|Dalaman\s+Kalkış|Milas\s+Kalkış|Datça\s+Kalkış|Köyceğiz\s+Kalkış)/i);

          const extractTimes = (block: string) =>
            Array.from(new Set(block.match(/\b\d{2}:\d{2}\b/g) ?? [])).sort();

          // İlk blok = from kalkış (gidiş), ikinci = to kalkış (dönüş)
          const outbound = parts.find(p => fromKalkis.test(p)) ?? text;
          const ret = parts.find(p => toKalkis.test(p)) ?? "";
          const outboundTimes = extractTimes(outbound);
          const returnTimes = extractTimes(ret);

          // Dönüş bloğu bulunamadıysa outbound'u dönüş olarak kullan (çift yönlü simetrik hatlar)
          const finalReturn = returnTimes.length > 0 ? returnTimes : outboundTimes;
          routes.push({
            line: l.line, from: l.from, to: l.to,
            weekday: outboundTimes, saturday: outboundTimes, sunday: outboundTimes,
            outbound_weekday: outboundTimes, outbound_saturday: outboundTimes, outbound_sunday: outboundTimes,
            return_weekday: finalReturn, return_saturday: finalReturn, return_sunday: finalReturn,
            carrier: "MUTTAŞ", source: l.url, type: "ilçe",
          });
        } catch { /* tek hat hatası diğerlerini etkilemez */ }
      }

      // obilet.com'dan canlı şehirlerarası seferleri ekle
      const intercity = await scrapeIntercityBuses();
      routes.push(...intercity);

      return new Response(JSON.stringify({
        routes,
        source: "MUTTAŞ resmi hat sayfaları + obilet.com (canlı)",
        source_period: "Güncel hat saatleri",
        scraped_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type. Use 'flights' or 'bus'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transport-scrape error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
