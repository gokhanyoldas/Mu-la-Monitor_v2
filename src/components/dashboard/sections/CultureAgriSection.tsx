import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { MiniChart } from "../MiniChart";
import { Wheat, Palette, Landmark, ChevronDown, ChevronUp, MapPin, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";

const heritageData = {
  unesco: [
    { name: "Letoon Antik Kenti", address: "Kumluova Köyü, Seydikemer/Muğla", coords: "36.3322° N, 29.3128° E" },
    { name: "Xanthos Antik Kenti", address: "Kınık Mahallesi, Kaş/Antalya sınırı", coords: "36.3567° N, 29.3197° E" },
    { name: "Stratonikeia Antik Kenti", address: "Eskihisar Köyü, Yatağan/Muğla", coords: "37.3192° N, 28.0614° E" },
  ],
  antikKentler: [
    { name: "Knidos", address: "Datça Yarımadası ucu, Datça/Muğla" },
    { name: "Kaunos", address: "Dalyan, Ortaca/Muğla" },
    { name: "Halikarnassos", address: "Bodrum Merkez/Muğla" },
    { name: "Euromos", address: "Selimiye Köyü, Milas/Muğla" },
    { name: "Labranda", address: "Kargıcak Köyü, Milas/Muğla" },
    { name: "Herakleia", address: "Kapıkırı Köyü, Milas/Muğla (Bafa Gölü)" },
    { name: "Telmessos", address: "Fethiye Merkez/Muğla" },
    { name: "Mylasa", address: "Milas Merkez/Muğla" },
    { name: "Iasos", address: "Kıyıkışlacık Köyü, Milas/Muğla" },
    { name: "Amos", address: "Turunç-Kumlubük arası, Marmaris/Muğla" },
    { name: "Kedrai", address: "Sedir Adası, Ula/Muğla" },
    { name: "Beçin Kalesi", address: "Beçin Köyü, Milas/Muğla" },
  ],
  muzeOrenYeri: [
    { name: "Bodrum Sualtı Arkeoloji Müzesi", address: "Bodrum Kalesi, Bodrum/Muğla" },
    { name: "Milas Müzesi", address: "Milas Merkez/Muğla" },
    { name: "Fethiye Müzesi", address: "Kesikkapı Mah., Fethiye/Muğla" },
    { name: "Marmaris Kalesi & Müzesi", address: "Marmaris Merkez/Muğla" },
    { name: "Muğla Kent Müzesi", address: "Muğla Merkez" },
    { name: "Kral Kaya Mezarları", address: "Dalyan, Ortaca/Muğla" },
    { name: "Halikarnas Mozolesi", address: "Bodrum Merkez/Muğla" },
  ],
  sanatcilar: [
    "Zeki Müren", "Nail Çakırhan", "Abidin Dino", "Cevat Şakir Kabaağaçlı (Halikarnas Balıkçısı)",
    "Nuri Bilge Ceylan", "Şakir Eczacıbaşı", "Turhan Selçuk",
  ],
  korumaProjeleri: [
    { name: "Stratonikeia Restorasyon", address: "Eskihisar, Yatağan", status: "Devam" },
    { name: "Beçin Kalesi Kazısı", address: "Beçin, Milas", status: "Devam" },
    { name: "Bodrum Kalesi Restorasyon", address: "Bodrum Merkez", status: "Tamamlandı" },
    { name: "Knidos Kazı Projesi", address: "Datça", status: "Devam" },
    { name: "Labranda Kazısı", address: "Milas", status: "Devam" },
    { name: "Kaunos Koruma", address: "Dalyan, Ortaca", status: "Devam" },
    { name: "Letoon Restorasyon", address: "Seydikemer", status: "Devam" },
    { name: "Muğla Tarihi Evler", address: "Muğla Merkez", status: "Devam" },
  ],
};

const HeritageAccordion = () => {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (key: string) => setOpen(open === key ? null : key);

  const Section = ({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) => (
    <div className="rounded bg-muted/20 overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-xs font-mono text-foreground/80">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-primary">{count}</span>
          {open === id ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        </div>
      </button>
      {open === id && <div className="px-2.5 pb-2 space-y-1">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-1.5">
      <Section id="unesco" label="UNESCO Alanları" count={heritageData.unesco.length}>
        {heritageData.unesco.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/50">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-mono font-semibold text-foreground/90 block">{item.name}</span>
              <span className="text-[9px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
      <Section id="antik" label="Antik Kentler" count={heritageData.antikKentler.length}>
        {heritageData.antikKentler.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/50">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-mono font-semibold text-foreground/90 block">{item.name}</span>
              <span className="text-[9px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
      <Section id="muze" label="Müze & Ören Yeri" count={heritageData.muzeOrenYeri.length}>
        {heritageData.muzeOrenYeri.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/50">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-mono font-semibold text-foreground/90 block">{item.name}</span>
              <span className="text-[9px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
      <Section id="sanatci" label="Yerel Sanatçılar" count={heritageData.sanatcilar.length}>
        {heritageData.sanatcilar.map((name, i) => (
          <div key={i} className="py-0.5 px-1.5 text-[11px] font-mono text-foreground/80">{name}</div>
        ))}
      </Section>
      <Section id="koruma" label="Koruma Projeleri" count={heritageData.korumaProjeleri.length}>
        {heritageData.korumaProjeleri.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/50">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold text-foreground/90">{item.name}</span>
                <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${item.status === "Tamamlandı" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>{item.status}</span>
              </div>
              <span className="text-[9px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
};

const defaultProductionData = [
  { name: "Oca", value: 20 }, { name: "Şub", value: 22 }, { name: "Mar", value: 35 },
  { name: "Nis", value: 48 }, { name: "May", value: 55 }, { name: "Haz", value: 42 },
  { name: "Tem", value: 38 }, { name: "Ağu", value: 35 }, { name: "Eyl", value: 50 },
  { name: "Eki", value: 85 }, { name: "Kas", value: 95 }, { name: "Ara", value: 70 },
];

export const CultureAgriSection = () => {
  const { data: agriData, isLoading: aLoading } = useLiveData<any>("agriculture", { refetchInterval: 24 * 60 * 60 * 1000 });
  const { data: cultureData, isLoading: cLoading } = useLiveData<any>("culture", { refetchInterval: 24 * 60 * 60 * 1000 });

  const agri = agriData || {};
  const culture = cultureData || {};
  const productionData = agri.monthly_index || defaultProductionData;

  return (
    <div className="space-y-3">
      <DashboardPanel title="Tarım & Üretim" icon={<Wheat size={14} />} badge="CANLI" badgeVariant="live">
        {aLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Zeytin Üretimi" value={agri.olive_production ?? "185K"} unit={agri.olive_unit ?? "ton"} change={agri.olive_change ?? 4.2} variant="primary" />
          <StatCard label="Narenciye" value={agri.citrus_production ?? "42K"} unit={agri.citrus_unit ?? "ton"} change={agri.citrus_change ?? -2.1} />
          <StatCard label="Bal Üretimi" value={agri.honey_production ?? "8.2K"} unit={agri.honey_unit ?? "ton"} change={agri.honey_change ?? 6.8} variant="primary" />
          <StatCard label="Tarım Alanı" value={agri.farm_area ?? "3,450"} unit={agri.farm_area_unit ?? "km²"} />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground uppercase mb-1 block">Aylık Üretim Endeksi</span>
        <MiniChart data={productionData} color="hsl(142, 71%, 45%)" height={50} showAxis />
        {agri.source && <div className="text-[8px] font-mono text-muted-foreground mt-1 text-right">Kaynak: {agri.source}</div>}
      </DashboardPanel>

      <DashboardPanel title="Kültür & Etkinlikler" icon={<Palette size={14} />} badge="CANLI" badgeVariant="live">
        {cLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <StatCard label="Aktif Etkinlik" value={String(culture.active_events ?? 24)} variant="accent" />
          <StatCard label="Festival (Yıl)" value={String(culture.annual_festivals ?? 38)} />
        </div>
        <StatusList items={
          (culture.upcoming_events || [
            { name: "Bodrum Bale Festivali", date: "15 Tem" },
            { name: "Fethiye Müzik Fest.", date: "22 Tem" },
            { name: "Marmaris Uluslar. Yarış", date: "3 Ağu" },
            { name: "Milas Zeytin Festivali", date: "12 Kas" },
          ]).map((e: any) => ({
            label: e.name,
            value: e.date,
            status: "info" as const,
          }))
        } />
        {culture.source && <div className="text-[8px] font-mono text-muted-foreground mt-1 text-right">Kaynak: {culture.source}</div>}
      </DashboardPanel>

      <DashboardPanel title="Kültürel Miras" icon={<Landmark size={14} />}>
        <HeritageAccordion />
      </DashboardPanel>
    </div>
  );
};
