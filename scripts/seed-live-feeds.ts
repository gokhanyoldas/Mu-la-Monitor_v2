/**
 * seed-live-feeds.ts — Deploy sonrası ilk veri dolumu (data hydration).
 *
 * Deploy edilen Supabase projesindeki free-tier edge function'larını sırayla
 * tetikleyerek UI'ı anında gerçek içerikle doldurur:
 *   1. news-scrape        → 13 ilçe RSS + belediye/AFAD duyuruları
 *   2. mock-data-injector → koordinatlı sosyal sinyal + kritik demo uyarıları
 *   3. executive-report   → ilk yönetici özeti (Gemini yoksa şablon fallback)
 *
 * Kullanım:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... npx tsx scripts/seed-live-feeds.ts
 *
 * .env.local içindeki VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * değerleri de otomatik kullanılır (varsa).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// .env / .env.local'dan Supabase bağlantısını doldur
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]+)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("❌ SUPABASE_URL ve SUPABASE_ANON_KEY (veya VITE_* muadilleri) gerekli.");
  process.exit(1);
}

const FN = `${SUPABASE_URL}/functions/v1`;

async function invoke(name: string, body: Record<string, unknown> = {}): Promise<unknown> {
  process.stdout.write(`▶ ${name} tetikleniyor… `);
  const resp = await fetch(`${FN}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const json = await resp.json().catch(() => ({}));
  console.log(resp.ok ? "✓" : `✗ (HTTP ${resp.status})`);
  return json;
}

const results: Record<string, unknown> = {};

// 1) Gerçek RSS/haber akışı
results.news = await invoke("news-scrape");

// 2) Koordinatlı sosyal sinyal + kritik demo uyarıları (13 ilçe)
results.mock = await invoke("mock-data-injector", { perDistrict: 12, hours: 24 });

// 3) İlk yönetici özeti (Gemini varsa AI, yoksa şablon)
results.report = await invoke("executive-report", { period: "daily" });

console.log("\n═══ Seed Sonucu ═══");
console.log(JSON.stringify(results, null, 2).slice(0, 2000));
console.log("\n✅ Tamamlandı. Dashboard'u yenileyin — harita, filtreler ve rapor dolu olmalı.");
