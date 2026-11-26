import { useState } from "react";
import { DashboardPanel } from "../DashboardPanel";
import { StatCard } from "../StatCard";
import { StatusList } from "../StatusList";
import { Wheat, Palette, Landmark, ChevronDown, ChevronUp, MapPin, Loader2 } from "lucide-react";
import { useLiveData } from "@/hooks/useLiveData";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t, translate } = useTranslation();
  const [open, setOpen] = useState<string | null>("unesco");
  const toggle = (key: string) => setOpen(open === key ? null : key);

  const Section = ({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) => (
    <div className="rounded bg-muted/20 overflow-hidden border border-border/40">
      <button
        type="button"
        aria-expanded={open === id}
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-mono text-foreground/85 font-medium">{t(label)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-primary tabular-nums-stat">{count}</span>
          {open === id ? (
            <ChevronUp size={12} className="text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown size={12} className="text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </button>
      {open === id && <div className="px-2 pb-2 pt-1 space-y-1 bg-background/30 max-h-[140px] overflow-y-auto">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
      <Section id="unesco" label="UNESCO Alanları" count={heritageData.unesco.length}>
        {heritageData.unesco.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/60 border border-border/30">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <span className="text-[10px] font-mono font-semibold text-foreground/90 block">{translate(item.name)}</span>
              <span className="text-[8px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
      <Section id="antik" label="Antik Kentler" count={heritageData.antikKentler.length}>
        {heritageData.antikKentler.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/60 border border-border/30">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <span className="text-[10px] font-mono font-semibold text-foreground/90 block">{item.name}</span>
              <span className="text-[8px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
      <Section id="muze" label="Müze & Ören Yeri" count={heritageData.muzeOrenYeri.length}>
        {heritageData.muzeOrenYeri.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/60 border border-border/30">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <span className="text-[10px] font-mono font-semibold text-foreground/90 block">{translate(item.name)}</span>
              <span className="text-[8px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
      <Section id="sanatci" label="Yerel Sanatçılar" count={heritageData.sanatcilar.length}>
        {heritageData.sanatcilar.map((name, i) => (
          <div key={i} className="py-0.5 px-1.5 text-[10px] font-mono text-foreground/80">{name}</div>
        ))}
      </Section>
      <Section id="koruma" label="Koruma Projeleri" count={heritageData.korumaProjeleri.length}>
        {heritageData.korumaProjeleri.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 py-1 px-1.5 rounded bg-background/60 border border-border/30">
            <MapPin size={10} className="text-accent mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold text-foreground/90">{translate(item.name)}</span>
                <span className={`text-[7px] font-mono px-1 py-0.2 rounded ${item.status === "Tamamlandı" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                  {t(item.status === "Tamamlandı" ? "TAMAMLANDI" : "DEVAM")}
                </span>
              </div>
              <span className="text-[8px] text-muted-foreground">{item.address}</span>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
};

export const AgriculturePanel = () => {
  const { lang, t, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: agriData, isLoading } = useLiveData<any>("agriculture", { refetchInterval: 24 * 60 * 60 * 1000 });
  const agri = agriData || {};

  return (
    <DashboardPanel title="Tarım & Üretim" icon={<Wheat size={14} />} badge="Tarım-Orman Bk. 2024" badgeVariant="info">
      {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <StatCard
          label="Zeytin Üretimi"
          value={agri.olive_production ?? "145K"}
          unit={agri.olive_unit ?? (isEn ? "tons" : "ton")}
          change={agri.olive_change ?? 4.2}
          variant="primary"
          info={isEn ? "Ministry of Agriculture 2024 olive production (Muğla)." : "Tarım ve Orman Bakanlığı 2024 zeytin üretimi (Muğla)."}
        />
        <StatCard
          label="Narenciye"
          value={agri.citrus_production ?? "89K"}
          unit={agri.citrus_unit ?? (isEn ? "tons" : "ton")}
          change={agri.citrus_change ?? -2.1}
          info={isEn ? "Ministry of Agriculture 2024 citrus production." : "Tarım ve Orman Bakanlığı 2024 turunçgil üretimi."}
        />
        <StatCard
          label="Bal Üretimi"
          value={agri.honey_production ?? "8.2K"}
          unit={agri.honey_unit ?? (isEn ? "tons" : "ton")}
          change={agri.honey_change ?? 6.8}
          variant="primary"
          info={isEn ? "Ministry of Agriculture 2024 pine honey production." : "Tarım ve Orman Bakanlığı 2024 bal üretimi (çam balı ağırlıklı)."}
        />
        <StatCard
          label="Tarım Alanı"
          value={agri.farm_area ?? "412K"}
          unit={agri.farm_area_unit ?? "ha"}
          info={isEn ? "Total agricultural land area (412,000 ha)." : "Tarım ve Orman Bakanlığı 2024 toplam tarım alanı (412,000 hektar)."}
        />
      </div>
      <div className="p-2 rounded bg-muted/20 border border-border/30">
        <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-1">
          <span>{t("Ürün Dağılımı")}</span>
          <span className="text-primary font-bold">
            {isEn ? "Olive 42% · Citrus 26%" : "Zeytin %42 · Narenciye %26"}
          </span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full w-[42%]" title={isEn ? "Olive: 42%" : "Zeytin: %42"} />
          <div className="bg-amber-500 h-full w-[26%]" title={isEn ? "Citrus: 26%" : "Narenciye: %26"} />
          <div className="bg-yellow-400 h-full w-[18%]" title={isEn ? "Pine Honey: 18%" : "Çam Balı: %18"} />
          <div className="bg-cyan-500 h-full w-[14%]" title={isEn ? "Other: 14%" : "Diğer: %14"} />
        </div>
      </div>
      {agri.source && (
        <div className="tech-meta-only text-[8px] font-mono text-muted-foreground mt-1.5 text-right">
          {isEn ? "Source" : "Kaynak"}: {translate(String(agri.source))}
        </div>
      )}
    </DashboardPanel>
  );
};

export const CultureEventsPanel = () => {
  const { lang, translate } = useTranslation();
  const isEn = lang === "en";
  const { data: cultureData, isLoading } = useLiveData<any>("culture", { refetchInterval: 24 * 60 * 60 * 1000 });
  const culture = cultureData || {};

  return (
    <DashboardPanel title="Kültür & Etkinlikler" icon={<Palette size={14} />} badge="Kültür-Turizm Bk. 2024" badgeVariant="info">
      {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground mb-1" />}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <StatCard
          label="Aktif Etkinlik"
          value={String(culture.active_events ?? 24)}
          variant="accent"
          info={isEn ? "Registered active cultural events across Muğla." : "Kültür ve Turizm Bakanlığı 2024 — şu an aktif/kayıtlı etkinlik sayısı."}
        />
        <StatCard
          label="Festival (Yıl)"
          value={String(culture.annual_festivals ?? 28)}
          info={isEn ? "Annual cultural festivals in Muğla." : "Kültür ve Turizm Bakanlığı 2024 — yıllık toplam festival sayısı (Muğla)."}
        />
      </div>
      <div className="max-h-[160px] overflow-y-auto pr-0.5">
        <StatusList
          items={(
            culture.upcoming_events || [
              { name: "Bodrum Bale Festivali", date: "15 Tem" },
              { name: "Fethiye Müzik Fest.", date: "22 Tem" },
              { name: "Marmaris Uluslar. Yarış", date: "3 Ağu" },
              { name: "Milas Zeytin Festivali", date: "12 Kas" },
            ]
          ).map((e: any) => ({
            label: translate(e.name),
            value: translate(e.date),
            status: "info" as const,
          }))}
        />
      </div>
      {culture.source && (
        <div className="tech-meta-only text-[8px] font-mono text-muted-foreground mt-1.5 text-right">
          {isEn ? "Source" : "Kaynak"}: {translate(String(culture.source))}
        </div>
      )}
    </DashboardPanel>
  );
};

export const CulturalHeritagePanel = () => {
  const { lang, t } = useTranslation();
  const isEn = lang === "en";
  return (
    <DashboardPanel title="Kültürel Miras" icon={<Landmark size={14} />} badge="UNESCO & Tescilli" badgeVariant="info">
      <div className="mb-2 px-2 py-1 rounded bg-secondary/30 border border-border/30 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
        <span>{t("Kültür Envanteri")}</span>
        <span className="text-foreground font-semibold">
          {isEn ? "3 UNESCO · 12 Ancient Cities · 7 Museums" : "3 UNESCO · 12 Antik Kent · 7 Müze"}
        </span>
      </div>
      <HeritageAccordion />
    </DashboardPanel>
  );
};

export const CultureAgriSection = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      <AgriculturePanel />
      <CultureEventsPanel />
      <CulturalHeritagePanel />
    </div>
  );
};
