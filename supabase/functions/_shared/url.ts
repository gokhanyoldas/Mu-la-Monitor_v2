// supabase/functions/_shared/url.ts
// URL kanonikleştirme — sendikasyon/yönlendirme/takip parametrelerinden
// kaynaklanan tekrar haber kayıtlarını tekilleştirmek için.
//
// Amaç: aynı içeriğin farklı kaynaklarda (Google News yönlendirmesi, UTM
// parametreleri, http/https, www farkı, fragment) farklı URL ile gelmesi
// durumunda tek bir normalize anahtar üretmek.

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "utm_name", "utm_reader", "utm_referrer",
  "fbclid", "gclid", "dclid", "msclkid", "yclid", "igshid", "twclid",
  "mc_cid", "mc_eid", "ref", "ref_src", "ref_url", "spm", "_ga", "_gl",
  "oc", "hl", "gl", "ceid",
]);

/**
 * Verilen URL'yi deterministik bir kanonik forma dönüştürür.
 * Anlamsız/güvenli olmayan girdilerde null döner.
 *
 * Kurallar:
 *  - şema ve host küçük harf, `www.` kaldırılır, http → https
 *  - fragment (#...) silinir
 *  - takip/izleme parametreleri (utm_*, fbclid, ...) silinir
 *  - kalan query params alfabetik sıralanır (sıra farkını yok eder)
 *  - sondaki `/` kaldırılır
 *  - Google yönlendirme linkleri (…?url=… / …?q=…) hedef URL'e çözülür
 */
export function canonicalizeUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/&amp;/gi, "&");
  if (!s) return null;

  // Şemasız girdileri normalize et
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = "https://" + s.replace(/^\/+/, "");
  }

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  // Yönlendirme sarmalayıcılarını çöz (Google News / url?q= / url=)
  const redirectTarget = url.searchParams.get("url") ?? url.searchParams.get("q");
  if (redirectTarget && /^https?:\/\//i.test(redirectTarget)) {
    try {
      url = new URL(redirectTarget);
    } catch {
      // hedef geçersizse mevcut URL ile devam et
    }
  }

  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  // Takip parametrelerini temizle (utm_* dahil)
  for (const key of [...url.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (TRACKING_PARAMS.has(k) || k.startsWith("utm_")) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  // Sondaki slash (kök hariç)
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Bir batch içinde kanonik URL'ye göre ilk görüleni tutar, tekrarları atar.
 */
export function dedupeByCanonical<T>(
  items: T[],
  getUrl: (item: T) => string | null | undefined,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const canon = canonicalizeUrl(getUrl(item));
    if (canon) {
      if (seen.has(canon)) continue;
      seen.add(canon);
    }
    out.push(item);
  }
  return out;
}
