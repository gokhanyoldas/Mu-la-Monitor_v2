import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

async function scrapeBusSchedules(apiKey: string): Promise<any[]> {
  try {
    const sources = [
      "https://www.obilet.com/otobus-bileti/mugla",
      "https://www.neredennereye.com/otobus/mugla",
    ];

    for (const url of sources) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            formats: [{ type: "json", prompt: `Extract bus routes departing from Muğla. For each route return: carrier (bus company name), from (always "Muğla"), to (destination city), departures (array of departure times as HH:MM strings), duration (e.g. "3s 30dk"), price (e.g. "₺250"), type ("ilçe" for district routes within Muğla province like Bodrum/Fethiye/Marmaris/Milas/Dalaman, "şehirlerarası" for intercity routes).` }],
            waitFor: 3000,
          }),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const json = data?.data?.json || data?.json;
        if (json && Array.isArray(json)) return json;
        if (json?.routes && Array.isArray(json.routes)) return json.routes;
      } catch {
        continue;
      }
    }
    return [];
  } catch (e) {
    console.error("Bus scrape error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, airports } = await req.json();
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!apiKey) {
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
      const routes = await scrapeBusSchedules(apiKey);
      return new Response(JSON.stringify({ routes, scraped_at: new Date().toISOString() }), {
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
