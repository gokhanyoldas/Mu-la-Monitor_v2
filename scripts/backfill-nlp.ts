/**
 * scripts/backfill-nlp.ts — Idempotent NLP zenginleştirme backfill'i
 * ─────────────────────────────────────────────────────────────────────────────
 * social_posts tablosunda `district IS NULL` olan eski (legacy) satırları
 * TEK DOĞRULUK KAYNAĞI olan `supabase/functions/_shared/nlp.ts` (analyzeText)
 * ile işler ve şu alanları doldurur: `district`, `category`, `sentiment_score`,
 * `entities`.
 *
 * • Idempotent: yalnızca `district IS NULL` satırlar seçilir; NLP deterministik
 *   olduğundan yeniden çalıştırmak aynı değerleri üretir (kayma olmaz).
 * • Zaman damgaları DEĞİŞTİRİLMEZ — PATCH gövdesinde collected_at / analyzed_at /
 *   published_at bulunmaz.
 * • Harici API çağrısı YAPILMAZ (yalnızca yerel kural tabanlı NLP → 0 maliyet).
 * • Güvenli gruplar (batch) + sınırlı eşzamanlılık ile çalışır.
 *
 * Kullanım:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run backfill:nlp
 *
 *   # Önce yazmadan prova (canlı çalıştırmadan önce önerilir):
 *   npm run backfill:nlp -- --dry-run
 *
 *   # Sınırlı sayıda satır (test/güvenli çalıştırma):
 *   npm run backfill:nlp -- --limit=100
 *
 *   # Grup boyutu / eşzamanlılık:
 *   npm run backfill:nlp -- --batch-size=500   NLP_BACKFILL_CONCURRENCY=8
 *
 * .env.local / .env içindeki SUPABASE_URL ve service_role anahtarı otomatik
 * okunur (varsa).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeSupabaseUrl } from "../src/config/supabase-env-utils";
import { analyzeText } from "../supabase/functions/_shared/nlp";

// ─── .env / .env.local yükleme ──────────────────────────────────────────────
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

const SUPABASE_URL = normalizeSupabaseUrl(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ""
);
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "❌ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (service_role) ortam değişkenleri gerekli."
  );
  process.exit(1);
}

// ─── CLI / ortam parametreleri ──────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run") || process.env.NLP_BACKFILL_DRY_RUN === "true";
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : 0;
const batchArg = argv.find((a) => a.startsWith("--batch-size="));
const BATCH_SIZE = batchArg ? Math.max(50, Number(batchArg.split("=")[1]) || 500) : 500;
const CONCURRENCY = Math.max(1, Number(process.env.NLP_BACKFILL_CONCURRENCY || 8));

// ─── REST yardımcıları ──────────────────────────────────────────────────────
const REST = `${SUPABASE_URL}/rest/v1/social_posts`;
const HEADERS: Record<string, string> = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

interface PendingRow {
  id: string;
  content: string | null;
}

async function fetchPendingRows(): Promise<PendingRow[]> {
  const rows: PendingRow[] = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const url =
      `${REST}?select=id,content&district=is.null` +
      `&order=id.asc&limit=${BATCH_SIZE}&offset=${offset}`;
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) throw new Error(`Fetch ${resp.status}: ${await resp.text()}`);
    const page = (await resp.json()) as PendingRow[];
    rows.push(...page);
    if (LIMIT && rows.length >= LIMIT) return rows.slice(0, LIMIT);
    if (page.length < BATCH_SIZE) break;
  }
  return rows;
}

async function patchRow(id: string, body: Record<string, unknown>): Promise<void> {
  const resp = await fetch(`${REST}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Patch ${id} ${resp.status}: ${await resp.text()}`);
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
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
  console.log(
    `[backfill:nlp] Başlıyor${DRY_RUN ? " (DRY-RUN — DB'ye yazma yapılmaz)" : ""}` +
      ` · batch=${BATCH_SIZE} · eşzamanlılık=${CONCURRENCY}${LIMIT ? ` · limit=${LIMIT}` : ""}…`
  );

  const rows = await fetchPendingRows();
  console.log(`[backfill:nlp] \`district IS NULL\` işlenecek satır: ${rows.length}`);
  if (rows.length === 0) {
    console.log("[backfill:nlp] Yapılacak iş yok. Çıkılıyor.");
    return;
  }

  const updates: { id: string; body: Record<string, unknown> }[] = [];
  let districtFilled = 0;
  for (const row of rows) {
    const nlp = analyzeText(row.content ?? "");
    if (nlp.district) districtFilled++;
    updates.push({
      id: row.id,
      // Yalnızca istenen 4 alan — zaman damgalarına dokunulmaz.
      body: {
        district: nlp.district,
        category: nlp.category,
        sentiment_score: nlp.sentimentScore,
        entities: nlp.entities,
      },
    });
  }

  console.log(
    `[backfill:nlp] İlçe atandı: ${districtFilled} · atanamadı (null kalır): ${
      rows.length - districtFilled
    }`
  );

  if (DRY_RUN) {
    console.log("[backfill:nlp] DRY-RUN örnek (ilk 3):");
    console.log(JSON.stringify(updates.slice(0, 3), null, 2));
    console.log("[backfill:nlp] Yazma yapılmadı. Canlı için --dry-run parametresini kaldırın.");
    return;
  }

  let done = 0;
  let failed = 0;
  await runPool(updates, CONCURRENCY, async (u) => {
    try {
      await patchRow(u.id, u.body);
    } catch (err) {
      failed++;
      console.error("[backfill:nlp] satır hatası:", (err as Error).message);
    }
    done++;
    if (done % 500 === 0) console.log(`[backfill:nlp] … ${done}/${updates.length}`);
  });

  console.log(`[backfill:nlp] Tamamlandı. Güncellenen: ${done - failed} · Hata: ${failed}`);
}

main().catch((err) => {
  console.error("[backfill:nlp] ÖLÜMCÜL HATA:", err);
  process.exit(1);
});
