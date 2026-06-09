// Muğla İşletme Supabase Edge Function — ücretsiz Google Places + Overpass API
// Madde 12: Turistik işletme doluluk ve puanları
// Kaynak: Google Places API (ücretsiz 28K req/ay) + OpenStreetMap Overpass (ücretsiz)

import { corsHeaders } from '../_shared/cors.ts';

const MUGLA_LAT = 37.2153;
const MUGLA_LON = 28.3636;

// Muğla'nın 5 ana turizm noktası için koordinatlar
const TOURISM_HUBS = [
  { name: 'Bodrum', lat: 37.034, lng: 27.430 },
  { name: 'Marmaris', lat: 36.855, lng: 28.272 },
  { name: 'Fethiye', lat: 36.622, lng: 29.126 },
  { name: 'Dalaman Havalimanı', lat: 36.713, lng: 28.794 },
  { name: 'Muğla Merkez', lat: 37.215, lng: 28.364 },
];

// Saate göre kalabalık tahmini (Mayıs-Eylül sezon modeli)
function estimateOccupancy(hour: number, type: string, isWeekend: boolean): number {
  const base: Record<string, number[]> = {
    restaurant:  [5,5,5,5,5,5,10,20,40,60,80,85,90,80,50,55,60,75,95,90,70,50,30,10],
    beach:       [5,5,5,5,5,5,5,10,30,55,75,85,90,90,85,80,75,60,40,25,15,10,5,5],
    hotel:       [60,60,60,60,60,60,60,55,50,45,40,35,30,25,25,25,25,30,40,50,60,65,65,62],
    bar:         [5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,10,15,20,40,60,80,90,95,80],
    attraction:  [5,5,5,5,5,5,5,10,30,60,80,90,85,80,85,90,85,75,50,30,15,10,5,5],
  };
  const pattern = base[type] ?? base.restaurant;
  const occ = pattern[hour] ?? 50;
  return isWeekend ? Math.min(occ * 1.3, 100) : occ;
}

// Overpass API — ücretsiz OSM işletme verisi
async function fetchOSMVenues(lat: number, lng: number, radius = 3000) {
  const query = `
    [out:json][timeout:15];
    (
      node["tourism"="hotel"](around:${radius},${lat},${lng});
      node["tourism"="attraction"](around:${radius},${lat},${lng});
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      node["amenity"="bar"](around:${radius},${lat},${lng});
      node["natural"="beach"](around:${radius},${lat},${lng});
    );
    out body 20;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.elements ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const district = url.searchParams.get('district') ?? 'bodrum';

    const hub = TOURISM_HUBS.find(h => h.name.toLowerCase() === district.toLowerCase())
      ?? TOURISM_HUBS[0];

    // Fetch from OSM (ücretsiz, API key gerekmez)
    const osmVenues = await fetchOSMVenues(hub.lat, hub.lng, 2500);

    const nowIstanbul = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })
    );
    const hour = nowIstanbul.getHours();
    const dow = nowIstanbul.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 5 || dow === 6;
    const isHighSeason = nowIstanbul.getMonth() >= 5 && nowIstanbul.getMonth() <= 8; // Haz-Eyl

    // Build venue list with estimated occupancy
    const venues = osmVenues.slice(0, 15).map((node: any) => {
      const tags = node.tags ?? {};
      const tourism = tags.tourism;
      const amenity = tags.amenity;
      const natural = tags.natural;

      let type = 'attraction';
      if (amenity === 'restaurant') type = 'restaurant';
      else if (amenity === 'bar' || amenity === 'pub') type = 'bar';
      else if (tourism === 'hotel' || tourism === 'hostel') type = 'hotel';
      else if (natural === 'beach') type = 'beach';

      let occ = estimateOccupancy(hour, type, isWeekend);
      if (isHighSeason) occ = Math.min(occ * 1.2, 100);

      const name = tags.name ?? tags['name:tr'] ?? `${type} (OSM #${node.id})`;
      return {
        id: String(node.id),
        name,
        type,
        lat: node.lat,
        lng: node.lon,
        occupancy_pct: Math.round(occ),
        occupancy_label: occ >= 80 ? 'Çok Kalabalık' : occ >= 55 ? 'Kalabalık' : occ >= 30 ? 'Orta' : 'Sakin',
        estimated: true, // Always honest: this is an estimate
        source: 'OpenStreetMap + Sezonsal Model',
      };
    });

    // Summary stats per type
    const summary: Record<string, { count: number; avg_occ: number }> = {};
    for (const v of venues) {
      if (!summary[v.type]) summary[v.type] = { count: 0, avg_occ: 0 };
      summary[v.type].count++;
      summary[v.type].avg_occ += v.occupancy_pct;
    }
    for (const k of Object.keys(summary)) {
      summary[k].avg_occ = Math.round(summary[k].avg_occ / summary[k].count);
    }

    return new Response(
      JSON.stringify({
        success: true,
        district: hub.name,
        hour,
        is_weekend: isWeekend,
        is_high_season: isHighSeason,
        venues,
        summary,
        note: 'Kalabalık tahminleri sezonsal model ve saatlik örüntülere dayanmaktadır (gerçek zamanlı değil).',
        source: 'OpenStreetMap Overpass API (ücretsiz)',
        queried_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('venue-occupancy error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, venues: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
