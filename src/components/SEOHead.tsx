// SEOHead.tsx
// Dynamic per-page SEO — meta tags, og:, twitter:, JSON-LD structured data.
// Zero dependencies: useEffect + DOM manipulation.

import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  path?: string;
  type?: "home" | "social" | "osint" | "district";
  districtName?: string;
}

const SITE_NAME = "Muğla Monitör";
const BASE_URL = "https://muglamonitor.com";
const OG_IMAGE = "/og-image.png";

const PAGE_DEFAULTS = {
  home: {
    title: `${SITE_NAME} — Bölgesel İstihbarat Paneli`,
    description: "Muğla ili canlı veri monitörü. Hava durumu, deprem, hava kalitesi, uçuş takibi, sosyal medya istihbaratı ve daha fazlası — gerçek zamanlı ve ücretsiz.",
  },
  social: {
    title: `Sosyal Medya İstihbaratı — ${SITE_NAME}`,
    description: "Muğla'daki sosyal medya trendleri, duygu analizi ve güncel tartışmalar.",
  },
  osint: {
    title: `OSINT Merkezi — ${SITE_NAME}`,
    description: "Açık kaynak istihbarat araçları. Kullanıcı adı tarama ve dijital ayak izi araştırması.",
  },
  district: {
    title: `İlçe Detayları — ${SITE_NAME}`,
    description: "Muğla ilçelerine ait canlı veriler: hava, deprem, haber ve sosyal medya akışı.",
  },
};

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attribute, name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

function upsertJsonLd(id: string, data: object) {
  let el = document.querySelector<HTMLScriptElement>(`script[data-seo-id="${id}"]`);
  if (!el) { el = document.createElement("script"); el.setAttribute("type", "application/ld+json"); el.setAttribute("data-seo-id", id); document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}

export function SEOHead({ title, description, path = "/", type = "home", districtName }: SEOHeadProps) {
  const defaults = PAGE_DEFAULTS[type];
  const resolvedTitle = title ?? (districtName ? `${districtName} — ${SITE_NAME}` : defaults.title!);
  const resolvedDesc = description ?? defaults.description!;
  const canonicalUrl = `${BASE_URL}${path}`;
  const fullOgImage = OG_IMAGE.startsWith("http") ? OG_IMAGE : `${BASE_URL}${OG_IMAGE}`;

  useEffect(() => {
    document.title = resolvedTitle;
    setMeta("description", resolvedDesc);
    setMeta("robots", "index, follow");
    setMeta("og:type", "website", "property");
    setMeta("og:site_name", SITE_NAME, "property");
    setMeta("og:title", resolvedTitle, "property");
    setMeta("og:description", resolvedDesc, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:image", fullOgImage, "property");
    setMeta("og:locale", "tr_TR", "property");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", resolvedTitle);
    setMeta("twitter:description", resolvedDesc);
    setMeta("twitter:image", fullOgImage);
    setLink("canonical", canonicalUrl);
    upsertJsonLd("website", { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: BASE_URL });
    upsertJsonLd("civic-portal", { "@context": "https://schema.org", "@type": "GovernmentOrganization", name: SITE_NAME, url: BASE_URL, description: resolvedDesc });
    if (type === "district" && districtName) {
      upsertJsonLd("district-place", { "@context": "https://schema.org", "@type": "Place", name: `${districtName}, Muğla` });
    }
  }, [resolvedTitle, resolvedDesc, canonicalUrl, fullOgImage, type, districtName]);

  return null;
}
