// obilet.com şehirlerarası otobüs seferlerini statik HTML mikrodata'dan ayrıştırır.
// Firecrawl gerekmez: schema.org itemprop blokları doğrudan HTML'de yer alır.

export interface ObiletTrip {
  carrier: string;
  departure: string;
  arrival: string;
  price: number;
}

// "HH:MM" string'ini dakikaya çevir.
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h * 60 + m) || 0;
}

// Kalkış-varış farkını "Ns NMdk" formatına çevir; negatifse ertesi güne sarar.
export function formatDuration(dep: string, arr: string): string {
  if (!dep || !arr) return "—";
  let diff = timeToMinutes(arr) - timeToMinutes(dep);
  if (diff < 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h > 0 ? (m > 0 ? `${h}s ${m}dk` : `${h}s`) : `${m}dk`;
}

// obilet.com rota detay sayfasındaki statik mikrodata'dan seferleri ayrıştır.
export function parseTripsFromHtml(html: string): ObiletTrip[] {
  const trips: ObiletTrip[] = [];
  const blocks = html.split(/(?=<li\s+itemscope\s+itemprop="busTrip")/i);
  for (const block of blocks) {
    if (!/busTrip/i.test(block)) continue;
    const carrier = block.match(/itemprop="name"\s+content="([^"]+)"/)?.[1] ?? "";
    const dep = block.match(/itemprop="departureTime">\s*([\d:]+)/)?.[1] ?? "";
    const arr = block.match(/itemprop="arrivalTime">\s*([\d:]+)/)?.[1] ?? "";
    const price = block.match(/class="no-cache-price"[^>]*data-price="([0-9,]+)"/)?.[1];
    if (!carrier || !dep) continue;
    trips.push({
      carrier,
      departure: dep,
      arrival: arr,
      price: price ? parseFloat(price.replace(",", ".")) : 0,
    });
  }
  return trips;
}