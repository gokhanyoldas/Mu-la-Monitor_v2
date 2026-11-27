// scripts/backfill-canonical-urls.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Tek seferlik (idempotent) backfill: mevcut social_posts satırları için
// url_canonical alanını doldurur ve aynı kanonik URL'ye sahip tekrarları
// is_duplicate=true olarak işaretler (satır silinmez).
//
// Çalıştırma:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run backfill:canonical
//
// Sadece url_canonical IS NULL olan satırlar işlenir → güvenle tekrar çalışır.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.");
  process.exit(1);
}

// ─── _shared/url.ts ile birebir aynı kanonikleştirme mantığı ────────────────
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "utm_name", "utm_reader", "utm_referrer",
  "fbclid", "gclid", "dclid", "msclkid", "yclid", "igshid", "twclid",
  "mc_cid", "mc_eid", "ref", "ref_src", "ref_url", "spm", "_ga", "_gl",
  "oc", "hl", "gl", "ceid",
]);

function canonicalizeUrl(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/&amp;/gi, "&");
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let url;
  try { url = new URL(s); } catch { return null; }
  const target = url.searchParams.get("url") ?? url.searchParams.get("q");
  if (target && /^https?:\/\//i.test(target)) {
    try { url = new URL(target); } catch { /* keep */ }
  }
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (TRACKING_PARAMS.has(k) || k.startsWith("utm_")) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

// ─── REST yardımcıları ──────────────────────────────────────────────────────
const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/social_posts`;
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function fetchPendingRows() {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const url =
      `${REST}?select=id,url,published_at&url_canonical=is.null&url=not.is.null` +
      `&order=published_at.asc.nullslast,id.asc&limit=${pageSize}&offset=${from}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`Fetch failed ${resp.status}: ${await resp.text()}`);
    const page = await resp.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function patchRow(id, body) {
  const resp = await fetch(`${REST}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Patch ${id} failed ${resp.status}: ${await resp.text()}`);
}

async function runPool(items, worker, concurrency = 8) {
  let idx = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

async function main() {
  console.log("[backfill] Kanonik URL backfill başlıyor…");
  const rows = await fetchPendingRows();
  console.log(`[backfill] İşlenecek satır: ${rows.length}`);
  if (rows.length === 0) {
    console.log("[backfill] Yapılacak iş yok. Çıkılıyor.");
    return;
  }

  const seen = new Set();
  const updates = [];
  let flagged = 0;

  for (const row of rows) {
    const canonical = canonicalizeUrl(row.url);
    if (!canonical) continue;
    if (seen.has(canonical)) {
      updates.push({ id: row.id, body: { is_duplicate: true } });
      flagged++;
    } else {
      seen.add(canonical);
      updates.push({ id: row.id, body: { url_canonical: canonical } });
    }
  }

  console.log(`[backfill] Güncellenecek: ${updates.length} (tekrar işaretlenen: ${flagged})`);
  let done = 0;
  await runPool(updates, async (u) => {
    await patchRow(u.id, u.body);
    done++;
    if (done % 200 === 0) console.log(`[backfill] … ${done}/${updates.length}`);
  });

  console.log(`[backfill] Tamamlandı. Güncellenen satır: ${done}`);
}

main().catch((err) => {
  console.error("[backfill] HATA:", err);
  process.exit(1);
});
