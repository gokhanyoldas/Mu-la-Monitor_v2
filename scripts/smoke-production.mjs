#!/usr/bin/env node

/**
 * Read-only deployment smoke tests.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://example.vercel.app npm run smoke:production
 *   SMOKE_BASE_URL=https://example.vercel.app SMOKE_AI_PROXY=true npm run smoke:production
 */

const baseUrl = (process.env.SMOKE_BASE_URL || process.argv[2] || "").replace(/\/$/, "");
const checkAiProxy = process.env.SMOKE_AI_PROXY === "true";

if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
  console.error("Kullanım: SMOKE_BASE_URL=https://domain.example npm run smoke:production");
  process.exit(2);
}

const failures = [];

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      ...options,
    });
    return response;
  } catch (error) {
    failures.push(`${path}: ağ hatası (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

async function expectHtml(path) {
  const response = await request(path);
  if (!response) return;
  const contentType = response.headers.get("content-type") || "";
  if (response.status >= 400 || !contentType.includes("text/html")) {
    failures.push(`${path}: ${response.status} / ${contentType || "content-type yok"}`);
  } else {
    console.log(`OK  ${path} (${response.status})`);
  }
}

async function expectJson(path) {
  const response = await request(path);
  if (!response) return;
  const contentType = response.headers.get("content-type") || "";
  let payload;
  try {
    payload = await response.json();
  } catch {
    failures.push(`${path}: JSON yanıtı okunamadı (${response.status})`);
    return;
  }
  if (response.status >= 500 || !contentType.includes("application/json")) {
    failures.push(`${path}: ${response.status} / ${contentType || "content-type yok"}`);
  } else {
    console.log(`OK  ${path} (${response.status}) ${JSON.stringify(payload)}`);
  }
}

await expectHtml("/");
// SPA fallback/deep-link: server tarafında 200 HTML dönmelidir.
await expectHtml("/investigation");
await expectJson("/api/health");

if (checkAiProxy) {
  const response = await request("/api/intel/analyze-post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: "Smoke test: Muğla merkezde örnek saha bildirimi." }),
  });
  if (response) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // handled below
    }
    if (response.status >= 500 || !payload || typeof payload !== "object") {
      failures.push(`/api/intel/analyze-post: ${response.status} geçersiz JSON yanıtı`);
    } else {
      console.log(`OK  /api/intel/analyze-post (${response.status})`);
    }
  }
} else {
  console.log("SKIP /api/intel/analyze-post (maliyetli AI çağrısını çalıştırmak için SMOKE_AI_PROXY=true verin)");
}

if (failures.length) {
  console.error("\nSmoke test başarısız:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nProduction smoke test başarılı.");
