import { formatDistanceToNow } from "date-fns";
import { tr, enUS } from "date-fns/locale";

export type RelativeTimeLang = "tr" | "en" | "de";

export interface FormatRelativeTimeOptions {
  /** Reference timestamp for deterministic formatting & testing (defaults to Date.now()) */
  now?: Date | number;
  /** Include "önce" / "ago" suffix (default: true) */
  addSuffix?: boolean;
  /** Fallback text when date is missing or invalid */
  fallback?: string;
}

function toValidDate(input: Date | string | number | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Standardizes all "how long ago updated" timestamps across Muğla Monitör v2
 * using `date-fns` (`formatDistanceToNow` + `tr` / `enUS` locales).
 *
 * Guarantees zero English abbreviations (`2min`, `1h ago`, `Just now`) in Turkish mode,
 * and zero Turkish words in English mode.
 */
export function formatRelativeTime(
  date: Date | string | number | null | undefined,
  lang: RelativeTimeLang = "tr",
  options: FormatRelativeTimeOptions = {}
): string {
  const { now, addSuffix = true, fallback = "—" } = options;
  const parsed = toValidDate(date);
  if (!parsed) return fallback;

  const nowMs = now instanceof Date ? now.getTime() : typeof now === "number" ? now : Date.now();
  const diffMs = nowMs - parsed.getTime();

  // Very recent (< 30s) or slight clock skew -> localized "just now"
  if (diffMs < 30_000) {
    return lang === "en" ? "Just now" : "Az önce";
  }

  const locale = lang === "en" ? enUS : tr;

  // When a deterministic `now` is supplied, shift the target date relative to real Date.now()
  // so date-fns's formatDistanceToNow computes the exact distance.
  const effectiveDate =
    now !== undefined ? new Date(Date.now() - diffMs) : parsed;

  const formatted = formatDistanceToNow(effectiveDate, {
    addSuffix,
    locale,
  });

  if (lang === "en") {
    return formatted;
  }

  // Ensure crisp Turkish wording with zero stray English time tokens
  return formatted
    .replace(/\b1 dakikadan az önce\b/i, "Az önce")
    .replace(/\byaklaşık\s+/i, "")
    .trim();
}

/**
 * Backwards-compatible helper delegating directly to `formatRelativeTime`.
 */
export function relativeTime(
  date: Date | string | number | null | undefined,
  lang: RelativeTimeLang = "tr"
): string {
  return formatRelativeTime(date, lang);
}

/**
 * Format for live feed status badges (localized TR / EN via `formatRelativeTime`).
 */
export function feedStatus(
  lastUpdate: Date | string | number | null,
  lang: RelativeTimeLang = "tr"
): {
  label: string;
  isLive: boolean;
  color: string;
} {
  const parsed = toValidDate(lastUpdate);
  if (!parsed) {
    return {
      label: lang === "en" ? "Offline" : "Bağlantı yok",
      isLive: false,
      color: "text-muted-foreground",
    };
  }

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 2) {
    return {
      label: lang === "en" ? "LIVE" : "CANLI",
      isLive: true,
      color: "text-green-500",
    };
  }
  if (minutes < 10) {
    return {
      label: formatRelativeTime(parsed, lang),
      isLive: true,
      color: "text-cyan-400",
    };
  }
  if (minutes < 60) {
    return {
      label: formatRelativeTime(parsed, lang),
      isLive: false,
      color: "text-yellow-500",
    };
  }
  return {
    label: formatRelativeTime(parsed, lang),
    isLive: false,
    color: "text-orange-500",
  };
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
