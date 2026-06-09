// M14: Açık Veri API Endpoint — Muğla Monitör Public REST API
// Ücretsiz, anonim erişim, CORS açık
// Endpoints: GET /public-api?type=weather|earthquakes|air_quality|social_summary

import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const HEADERS_DB = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Rate limiting via simple in-memory counter (resets on cold start)
const requestCounts = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 60; // req/min per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.reset) {
    requestCounts.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

async function getWeather() {
  const res = await fetch(
    'https://api.open-meteo.com/v1/forecast?latitude=37.2153&longitude=28.3636' +
    '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weathercode' +
    '&timezone=Europe%2FIstanbul',
    { signal: AbortSignal.timeout(8000) }
  );
  const d = await res.json();
  const c = d.current ?? {};
  return {
    temperature_c: c.temperature_2m,
    humidity_pct: c.relative_humidity_2m,
    wind_speed_kmh: c.wind_speed_10m,
    precipitation_mm: c.precipitation,
    location: { lat: 37.2153, lon: 28.3636, name: 'Muğla' },
    source: 'Open-Meteo',
    queried_at: new Date().toISOString(),
  };
}

async function getEarthquakes() {
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}` +
    `&minmagnitude=2.5&maxradiuskm=300&latitude=37.2153&longitude=28.3636&orderby=time&limit=20`,
    { signal: AbortSignal.timeout(10000) }
  );
  const d = await res.json();
  return {
    count: d.features?.length ?? 0,
    events: (d.features ?? []).slice(0, 10).map((f: any) => ({
      magnitude: f.properties?.mag,
      place: f.properties?.place,
      time: new Date(f.properties?.time).toISOString(),
      depth_km: f.geometry?.coordinates?.[2],
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0],
    })),
    source: 'USGS FDSN',
    queried_at: new Date().toISOString(),
  };
}

async function getAirQuality() {
  const res = await fetch(
    'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.2153&longitude=28.3636' +
    '&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,european_aqi' +
    '&timezone=Europe%2FIstanbul',
    { signal: AbortSignal.timeout(8000) }
  );
  const d = await res.json();
  const c = d.current ?? {};
  return {
    european_aqi: c.european_aqi,
    pm10: c.pm10,
    pm2_5: c.pm2_5,
    nitrogen_dioxide: c.nitrogen_dioxide,
    aqi_level:
      c.european_aqi <= 20 ? 'iyi' :
      c.european_aqi <= 40 ? 'orta' :
      c.european_aqi <= 60 ? 'hassas gruplar için kötü' :
      c.european_aqi <= 80 ? 'kötü' : 'çok kötü',
    location: { lat: 37.2153, lon: 28.3636, name: 'Muğla' },
    source: 'Open-Meteo Air Quality',
    queried_at: new Date().toISOString(),
  };
}

async function getSocialSummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/social_posts?select=sentiment,platform&published_at=gte.${since}`,
    { headers: HEADERS_DB }
  );
  const posts = res.ok ? await res.json() : [];
  const total    = posts.length;
  const positive = posts.filter((p: any) => p.sentiment === 'positive').length;
  const negative = posts.filter((p: any) => p.sentiment === 'negative').length;
  const neutral  = posts.filter((p: any) => p.sentiment === 'neutral').length;
  const platforms = [...new Set(posts.map((p: any) => p.platform))];
  return {
    period: 'last_24h',
    total_posts: total,
    sentiment: { positive, negative, neutral, positive_ratio: total > 0 ? +(positive / total * 100).toFixed(1) : 0 },
    platforms,
    source: 'Muğla Monitör DB',
    queried_at: new Date().toISOString(),
  };
}

async function getHistoricalSnapshot(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/historical_snapshots?snapshot_date=gte.${since}&order=snapshot_date.desc&limit=200`,
    { headers: HEADERS_DB }
  );
  const rows = res.ok ? await res.json() : [];
  return { period: `last_${days}d`, snapshots: rows, count: rows.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 60 req/min.' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url  = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'info';
  const days = parseInt(url.searchParams.get('days') ?? '7');

  try {
    let data: unknown;
    switch (type) {
      case 'weather':     data = await getWeather();     break;
      case 'earthquakes': data = await getEarthquakes(); break;
      case 'air_quality': data = await getAirQuality();  break;
      case 'social_summary': data = await getSocialSummary(); break;
      case 'historical':  data = await getHistoricalSnapshot(Math.min(days, 90)); break;
      case 'info':
      default:
        data = {
          api: 'Muğla Monitör Public API',
          version: '1.0.0',
          endpoints: [
            { type: 'weather',        description: 'Current weather in Muğla (Open-Meteo)' },
            { type: 'earthquakes',    description: 'Recent M2.5+ earthquakes within 300km (USGS)' },
            { type: 'air_quality',    description: 'Current AQI & pollutants (Open-Meteo)' },
            { type: 'social_summary', description: 'Last 24h social media sentiment summary' },
            { type: 'historical',     description: 'Historical daily metric snapshots (add ?days=30)' },
          ],
          usage: 'GET /functions/v1/public-api?type=<type>',
          rate_limit: '60 req/min per IP',
          license: 'CC BY 4.0',
          contact: 'github.com/gokhanyoldas/muglamonitor',
        };
    }
    return new Response(JSON.stringify({ success: true, type, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error: any) {
    console.error('public-api error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
