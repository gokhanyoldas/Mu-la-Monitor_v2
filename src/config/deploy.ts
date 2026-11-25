import { normalizeSupabaseUrl, resolveSupabaseKeyFromRecord } from "./supabase-env-utils";

/**
 * Dağıtım hedefine göre Vite `base` yolunu belirler:
 * - GitHub Pages (`DEPLOY_TARGET=gh-pages` veya `GITHUB_PAGES=true`) -> `/Mu-la-Monitor_v2/`
 * - Vercel (`VERCEL=1` / `DEPLOY_TARGET=vercel`) ve yerel geliştirme -> `/`
 */
export function resolveViteBase(env: Record<string, string | undefined>): string {
  const deployTarget = (env.DEPLOY_TARGET || "").trim().toLowerCase();
  const isGitHubPages =
    deployTarget === "gh-pages" ||
    deployTarget === "github-pages" ||
    env.GITHUB_PAGES === "true";
  return isGitHubPages ? "/Mu-la-Monitor_v2/" : "/";
}

/**
 * Üretim derlemesinde (production build) zorunlu Supabase ortam değişkenlerini doğrular.
 * Hardcoded anahtarların bulunmadığından emin olmak için eksikse derlemeyi durdurur.
 */
export function assertProductionEnv(
  command: string,
  mode: string,
  mergedEnv: Record<string, string | undefined>
): void {
  const supabaseUrl = normalizeSupabaseUrl(
    mergedEnv.VITE_SUPABASE_URL || mergedEnv.SUPABASE_URL || ""
  );
  const supabaseAnonKey = resolveSupabaseKeyFromRecord(mergedEnv, supabaseUrl);

  if (command !== "build" || mode !== "production") return;
  if (supabaseUrl && supabaseAnonKey) return;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY (veya VITE_SUPABASE_PUBLISHABLE_KEY)");

  const msg =
    `[Muğla Monitör Production Build Hatası] Eksik ortam değişkeni: ${missing.join(", ")}. ` +
    "Hardcoded production anahtarları güvenlik nedeniyle kaldırılmıştır. " +
    "Lütfen Vercel Environment Variables, GitHub Actions Secrets veya yerel .env dosyasında tanımlayın.";

  // AI Studio önizleme derleyicisinde ortam değişkeni enjekte edilmeden çalışabilmesi için
  // yalnızca saf AI Studio applet derlemesinde (CI/Vercel/STRICT_ENV dışındayken) uyarı ver.
  const isAiStudioCompiler =
    Boolean(mergedEnv.APPLET_ID) &&
    !mergedEnv.VERCEL &&
    !mergedEnv.GITHUB_ACTIONS &&
    !mergedEnv.CI &&
    mergedEnv.STRICT_ENV !== "true";

  if (isAiStudioCompiler) {
    console.warn(`${msg} (AI Studio önizleme derlemesi salt-okunur fallback ile devam ediyor)`);
    return;
  }

  throw new Error(msg);
}
