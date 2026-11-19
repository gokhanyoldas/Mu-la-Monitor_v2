import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Normalize Vite base prefix so it always starts and ends with "/".
 */
export function normalizeBasePrefix(base = "/") {
  let b = (base || "/").trim();
  if (!b.startsWith("/")) b = `/${b}`;
  if (!b.endsWith("/")) b = `${b}/`;
  return b;
}

/**
 * Verifies built dist/index.html asset URLs against expected deployment base path
 * and confirms every referenced file in `assets/` exists on disk.
 */
export function verifyBuildAssets({
  distDir = path.resolve(process.cwd(), "dist"),
  expectedBase = "/",
} = {}) {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`dist/index.html bulunamadı: ${indexPath}`);
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const normalizedBase = normalizeBasePrefix(expectedBase);
  const expectedAssetPrefix = `${normalizedBase}assets/`;

  const urlMatches = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map(
    (m) => m[1]
  );

  if (urlMatches.length === 0) {
    throw new Error("dist/index.html içinde hiçbir script/link asset referansı bulunamadı.");
  }

  const errors = [];
  const checkedAssets = [];

  for (const rawUrl of urlMatches) {
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:") || rawUrl.startsWith("#")) {
      continue;
    }

    if (rawUrl.includes("//assets/")) {
      errors.push(`Çift slash içeren asset yolu bulundu: ${rawUrl}`);
      continue;
    }

    // Yalnızca Vite'in ürettiği assets/ veya kök/alt-yol asset referanslarını doğrula
    if (rawUrl.includes("assets/")) {
      if (!rawUrl.startsWith(expectedAssetPrefix)) {
        errors.push(
          `Asset öneki beklenen base (${expectedAssetPrefix}) ile eşleşmiyor: ${rawUrl}`
        );
        continue;
      }

      const relFromDist = rawUrl.slice(normalizedBase.length);
      const assetFilePath = path.join(distDir, relFromDist);
      if (!fs.existsSync(assetFilePath)) {
        errors.push(`Referans verilen asset dosyası diskte yok: ${assetFilePath}`);
      } else {
        checkedAssets.push(relFromDist);
      }
    }
  }

  if (checkedAssets.length === 0) {
    errors.push(
      `Beklenen ${expectedAssetPrefix} önekine sahip hiçbir derlenmiş asset bulunamadı.`
    );
  }

  if (errors.length > 0) {
    throw new Error(`Build asset doğrulaması başarısız (${normalizedBase}):\n- ${errors.join("\n- ")}`);
  }

  return {
    ok: true,
    expectedBase: normalizedBase,
    checkedAssets,
  };
}

function parseCliArgs(argv) {
  let base = process.env.EXPECTED_BASE || "/";
  let distDir = path.resolve(process.cwd(), "dist");
  for (const arg of argv) {
    if (arg.startsWith("--base=")) {
      base = arg.slice("--base=".length);
    } else if (arg.startsWith("--dist=")) {
      distDir = path.resolve(process.cwd(), arg.slice("--dist=".length));
    }
  }
  return { base, distDir };
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const { base, distDir } = parseCliArgs(process.argv.slice(2));
  const result = verifyBuildAssets({ distDir, expectedBase: base });
  console.log(
    `[verify-build-assets] OK (${result.expectedBase}): ${result.checkedAssets.length} asset doğrulandı.`
  );
}
