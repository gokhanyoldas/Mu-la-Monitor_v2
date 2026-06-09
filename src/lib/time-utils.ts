/**
 * Format a date to Turkish relative time string
 * "Şimdi", "2 dk önce", "1 saat önce", "3 gün önce" etc.
 */
export function relativeTime(date: Date | string | number): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  if (diff < 0) return "Şimdi";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 30) return "Şimdi";
  if (seconds < 60) return `${seconds} sn önce`;
  if (minutes < 60) return `${minutes} dk önce`;
  if (hours < 24) return `${hours} saat önce`;
  if (days < 7) return `${days} gün önce`;
  if (weeks < 4) return `${weeks} hafta önce`;

  return new Date(date).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Format for live feed status
 */
export function feedStatus(lastUpdate: Date | string | number | null): {
  label: string;
  isLive: boolean;
  color: string;
} {
  if (!lastUpdate) return { label: "Bağlantı yok", isLive: false, color: "text-muted-foreground" };

  const diff = Date.now() - new Date(lastUpdate).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 2) return { label: "CANLI", isLive: true, color: "text-green-500" };
  if (minutes < 10) return { label: `${minutes} dk önce`, isLive: true, color: "text-cyan-400" };
  if (minutes < 60) return { label: `${minutes} dk önce`, isLive: false, color: "text-yellow-500" };
  return { label: relativeTime(lastUpdate), isLive: false, color: "text-orange-500" };
}

/**
 * MUGLA districts list
 */
export const MUGLA_DISTRICTS = [
  "Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere",
  "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca",
  "Seydikemer", "Yatağan", "Muğla Merkez"
] as const;

export type MuglaDistrict = typeof MUGLA_DISTRICTS[number];

/**
 * Detect region from text content
 */
export function detectRegion(text: string): string | null {
  const lower = text.toLowerCase();
  const regionMap: Record<string, string> = {
    "bodrum": "Bodrum",
    "marmaris": "Marmaris",
    "fethiye": "Fethiye",
    "datça": "Datça",
    "dalaman": "Dalaman",
    "milas": "Milas",
    "köyceğiz": "Köyceğiz",
    "ortaca": "Ortaca",
    "menteşe": "Menteşe",
    "yatağan": "Yatağan",
    "kavaklıdere": "Kavaklıdere",
    "seydikemer": "Seydikemer",
    "ölüdeniz": "Fethiye",
    "göcek": "Dalaman",
    "turgutreis": "Bodrum",
    "gümüşlük": "Bodrum",
    "hisarönü": "Fethiye",
    "dalyan": "Ortaca",
    "akyaka": "Menteşe",
    "muğla": "Muğla Merkez",
  };

  for (const [key, region] of Object.entries(regionMap)) {
    if (lower.includes(key)) return region;
  }
  return null;
}
