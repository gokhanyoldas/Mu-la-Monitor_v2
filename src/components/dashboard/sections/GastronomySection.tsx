import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { UtensilsCrossed, Star, ChevronDown, ChevronUp, MapPin, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

type Restaurant = {
  name: string;
  rating: number;
  cuisine: string;
  michelin?: boolean;
  michelinType?: string;
  priceRange: string;
};

type District = {
  name: string;
  restaurants: Restaurant[];
};

const fallbackDistricts: District[] = [
  {
    name: "Bodrum",
    restaurants: [
      { name: "Maçakızı", rating: 4.6, cuisine: "Akdeniz", michelin: true, michelinType: "⭐", priceRange: "₺₺₺₺" },
      { name: "Zuma Bodrum", rating: 4.5, cuisine: "Japon Füzyon", michelin: true, michelinType: "Bib Gourmand", priceRange: "₺₺₺₺" },
      { name: "Orfoz Restaurant", rating: 4.7, cuisine: "Deniz Ürünleri", michelin: true, michelinType: "⭐", priceRange: "₺₺₺₺" },
      { name: "Limon Bodrum", rating: 4.4, cuisine: "Ege Mutfağı", priceRange: "₺₺₺" },
      { name: "Memedof", rating: 4.5, cuisine: "Türk Mutfağı", priceRange: "₺₺" },
      { name: "Kısmet Lokantası", rating: 4.3, cuisine: "Ev Yemekleri", priceRange: "₺₺" },
    ],
  },
  {
    name: "Fethiye",
    restaurants: [
      { name: "Mozaik Bahçe", rating: 4.8, cuisine: "Türk-Ege", michelin: true, michelinType: "Bib Gourmand", priceRange: "₺₺₺" },
      { name: "Hilmi Et Balık", rating: 4.6, cuisine: "Et & Balık", priceRange: "₺₺₺" },
      { name: "Megri Restaurant", rating: 4.5, cuisine: "Akdeniz", priceRange: "₺₺₺" },
      { name: "Cin Bal", rating: 4.4, cuisine: "Pide & Kebap", priceRange: "₺₺" },
      { name: "Özsüt Fethiye", rating: 4.2, cuisine: "Pastane & Kafe", priceRange: "₺₺" },
    ],
  },
  {
    name: "Marmaris",
    restaurants: [
      { name: "Fellini Restaurant", rating: 4.5, cuisine: "İtalyan-Akdeniz", priceRange: "₺₺₺" },
      { name: "Ney Marmaris", rating: 4.6, cuisine: "Deniz Ürünleri", priceRange: "₺₺₺₺" },
      { name: "Pineapple", rating: 4.3, cuisine: "Uluslararası", priceRange: "₺₺₺" },
      { name: "Çınar Balık", rating: 4.4, cuisine: "Balık", priceRange: "₺₺" },
    ],
  },
  {
    name: "Datça",
    restaurants: [
      { name: "Culinarium", rating: 4.7, cuisine: "Farm-to-Table", michelin: true, michelinType: "Bib Gourmand", priceRange: "₺₺₺" },
      { name: "Datça Sofrası", rating: 4.5, cuisine: "Ege Mutfağı", priceRange: "₺₺" },
      { name: "Betül'ün Mutfağı", rating: 4.6, cuisine: "Ev Yemekleri", priceRange: "₺" },
    ],
  },
  {
    name: "Dalyan / Ortaca",
    restaurants: [
      { name: "Riverside", rating: 4.4, cuisine: "Akdeniz", priceRange: "₺₺₺" },
      { name: "Saki", rating: 4.3, cuisine: "Türk", priceRange: "₺₺" },
    ],
  },
  {
    name: "Milas",
    restaurants: [
      { name: "Beçin Han", rating: 4.3, cuisine: "Osmanlı Mutfağı", priceRange: "₺₺" },
      { name: "Boncuk Restaurant", rating: 4.1, cuisine: "Yerel", priceRange: "₺" },
    ],
  },
  {
    name: "Muğla Merkez",
    restaurants: [
      { name: "Yörük Konağı", rating: 4.4, cuisine: "Muğla Mutfağı", priceRange: "₺₺" },
      { name: "Antik Teras", rating: 4.2, cuisine: "Türk", priceRange: "₺₺" },
      { name: "Karabağlar Sofrası", rating: 4.3, cuisine: "Ev Yemekleri", priceRange: "₺" },
    ],
  },
  {
    name: "Köyceğiz",
    restaurants: [
      { name: "Köyceğiz Göl Restaurant", rating: 4.3, cuisine: "Balık", priceRange: "₺₺" },
      { name: "Ali Baba", rating: 4.1, cuisine: "Yerel", priceRange: "₺" },
    ],
  },
];

const StarRating = ({ rating }: { rating: number }) => {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.3;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={9}
          className={i < full ? "text-warning fill-warning" : i === full && hasHalf ? "text-warning fill-warning/50" : "text-muted-foreground/30"}
        />
      ))}
      <span className="text-[10px] font-mono font-bold text-warning ml-1">{rating}</span>
    </div>
  );
};

export const GastronomySection = () => {
  const [openDistrict, setOpenDistrict] = useState<string | null>("Bodrum");
  const { data: gastroData, isLoading } = useLiveData<any>("gastronomy", { refetchInterval: 24 * 60 * 60 * 1000 });

  const districts: District[] = gastroData?.districts || fallbackDistricts;
  const isLive = !!gastroData?.districts;

  const totalRestaurants = districts.reduce((a, d) => a + d.restaurants.length, 0);
  const michelinCount = districts.reduce((a, d) => a + d.restaurants.filter(r => r.michelin).length, 0);
  const avgRating = (districts.reduce((a, d) => a + d.restaurants.reduce((b, r) => b + r.rating, 0), 0) / totalRestaurants).toFixed(1);

  return (
    <div className="space-y-3">
      <DashboardPanel title="Gastronomi" icon={<UtensilsCrossed size={14} />} badge={isLive ? "CANLI" : "CANLI"} badgeVariant="live">
        {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatCard label="Toplam Restoran" value={String(totalRestaurants)} variant="primary" />
          <StatCard label="Michelin" value={String(michelinCount)} variant="accent" />
          <StatCard label="Ort. Puan" value={avgRating} variant="warning" />
        </div>
        {gastroData?.source && <div className="text-[8px] font-mono text-muted-foreground text-right">Kaynak: {gastroData.source}</div>}
      </DashboardPanel>

      <DashboardPanel title="Michelin Yıldızlı & Öne Çıkanlar" icon={<Star size={14} />} badge={`${michelinCount} RESTORAN`} badgeVariant="active">
        <div className="space-y-1.5 mb-2">
          {districts.flatMap(d => d.restaurants.filter(r => r.michelin).map(r => ({ ...r, district: d.name }))).map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-warning font-bold shrink-0">{r.michelinType}</span>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-semibold text-foreground/90 block truncate">{r.name}</span>
                  <span className="text-[9px] text-muted-foreground">{r.district} · {r.cuisine}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StarRating rating={r.rating} />
                <span className="text-[9px] font-mono text-muted-foreground">{r.priceRange}</span>
              </div>
            </div>
          ))}
        </div>
      </DashboardPanel>

      <DashboardPanel title="İlçe Bazlı Restoranlar" icon={<MapPin size={14} />} badge={`${districts.length} İLÇE`} badgeVariant="info">
        <div className="space-y-1">
          {districts.map((district) => (
            <div key={district.name} className="rounded bg-muted/20 overflow-hidden">
              <button
                onClick={() => setOpenDistrict(openDistrict === district.name ? null : district.name)}
                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-foreground/80">{district.name}</span>
                  {district.restaurants.some(r => r.michelin) && (
                    <span className="text-[8px] font-mono bg-warning/20 text-warning px-1 py-0.5 rounded">MICHELIN</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{district.restaurants.length} restoran</span>
                  {openDistrict === district.name ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                </div>
              </button>
              {openDistrict === district.name && (
                <div className="px-2.5 pb-2 space-y-1">
                  {district.restaurants.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-1.5 rounded bg-background/50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {r.michelin && <span className="text-[9px] text-warning font-bold">{r.michelinType}</span>}
                          <span className="text-[11px] font-mono text-foreground/90 truncate">{r.name}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">{r.cuisine} · {r.priceRange}</span>
                      </div>
                      <StarRating rating={r.rating} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
};
