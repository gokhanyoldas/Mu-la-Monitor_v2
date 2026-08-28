import { describe, it, expect } from "vitest";
import { parseTripsFromHtml, formatDuration } from "../../supabase/functions/transport-scrape/obilet-parser";

// obilet.com rota detay sayfalarındaki statik mikrodata bloğunun örneği
const SAMPLE_HTML = `
<li itemscope itemprop="busTrip" itemtype="http://schema.org/BusTrip" class="">
  <div>
    <div itemscope itemprop="provider" itemtype="http://schema.org/Organization">
      <meta itemprop="name" content="Pamukkale Turizm" />
    </div>
    <div></div>
    <div><svg class="seat"><use link:href="#seat-symbol"></use></svg> 2&#x2B;1</div>
  </div>
  <div>
    <div>Muğla<br /><span itemprop="departureBusStop" itemscope itemtype="http://schema.org/BusStation"><span itemprop="name">Muğla Otogarı</span></span></div>
    <div><svg class="point-right"></svg></div>
    <div>İstanbul Avrupa<br /><span itemprop="arrivalBusStop" itemscope itemtype="http://schema.org/BusStation"><span itemprop="name">Alibeyköy Otogarı</span></span></div>
    <div itemprop="offers" itemscope="" itemtype="http://schema.org/AggregateOffer">
      <div itemprop="lowPrice" class="no-cache-price" data-currency="TRY" data-price="2290,0000">2.290 TL</div>
    </div>
  </div>
  <div>
    <div itemprop="departureTime">09:30</div>
    <div></div>
    <div itemprop="arrivalTime">20:00</div>
    <div><button class="journey btn" data-origin-id="395" data-origin-name="Muğla">SATIN AL</button></div>
  </div>
</li>
<li itemscope itemprop="busTrip" itemtype="http://schema.org/BusTrip">
  <meta itemprop="name" content="Kamil Koç" />
  <div itemprop="departureTime">21:29</div>
  <div itemprop="arrivalTime">08:01</div>
  <div itemprop="lowPrice" class="no-cache-price" data-price="1600,0000">1.600 TL</div>
</li>
`;

describe("obilet-parser", () => {
  it("obelisteki seferleri ayrıştırır", () => {
    const trips = parseTripsFromHtml(SAMPLE_HTML);
    expect(trips).toHaveLength(2);
    expect(trips[0]).toMatchObject({
      carrier: "Pamukkale Turizm",
      departure: "09:30",
      arrival: "20:00",
      price: 2290,
    });
    expect(trips[1]).toMatchObject({
      carrier: "Kamil Koç",
      departure: "21:29",
      arrival: "08:01",
      price: 1600,
    });
  });

  it("boş/sahte HTML'de boş dizi döndürür", () => {
    expect(parseTripsFromHtml("<html><body><h1>Yok</h1></body></html>")).toEqual([]);
  });

  it("süreyi doğru formatlar (gece seferi ertesi güne sarar)", () => {
    expect(formatDuration("09:30", "20:00")).toBe("10s 30dk");
    expect(formatDuration("21:29", "08:01")).toBe("10s 32dk");
    expect(formatDuration("08:00", "09:30")).toBe("1s 30dk");
    expect(formatDuration("12:00", "12:45")).toBe("45dk");
  });
});