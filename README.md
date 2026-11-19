# Muğla Monitör v2

Muğla'nın 13 ilçesi için gerçek zamanlı kentsel izleme, çevre/afet sensörleri, ulaşım, yerel ekonomi, protokol takibi, OSINT ve kuvvet yönlendirmeli protokol ağ grafiği platformu.

## Teknoloji Yığını

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Leaflet
- **Backend:** Supabase (PostgreSQL + RLS + Edge Functions + Realtime + `pg_cron`)
- **AI / Harita:** Gemini (`GEMINI_API_KEY` sunucu tarafı secret) + TomTom Flow/Incidents (`VITE_TOMTOM_API_KEY` / `TOMTOM_API_KEY`)

---

## Ortam Değişkenleri

Örnek yapılandırma için kök dizindeki `.env.example` dosyasını `.env` olarak kopyalayın:

- `VITE_SUPABASE_URL` — Supabase proje URL'si (`https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` (veya `VITE_SUPABASE_PUBLISHABLE_KEY`) — Supabase public anon/publishable key
- `VITE_TOMTOM_API_KEY` — İsteğe bağlı harita trafik/olay tile anahtarı (yoksa açık harita katmanı kullanılır)
- `VITE_GEMINI_API_KEY` — İsteğe bağlı geliştirme / ağ topolojisi istemci testi; üretimde AI çağrıları Edge Function üzerinden sunucu tarafı `GEMINI_API_KEY` ile çalıştırılmalıdır

> **Güvenlik Notu:** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` üretim (`vite build`) derlemesinde zorunludur; kaynak kodda hardcoded fallback veya `service_role` anahtarı bulunmaz.

---

## Dağıtım (Vercel ve GitHub Pages)

`vite.config.ts` içindeki `resolveViteBase` fonksiyonu hedefe göre `base` yolunu otomatik belirler:

- **Vercel & Yerel Geliştirme:** Varsayılan `base: "/"` kullanılır. `vercel.json`, `/assets/*`, `/images/*`, `favicon.ico` ve uzantılı statik dosyaların SPA fallback ile `index.html` dönmesini engelleyecek şekilde yapılandırılmıştır.
- **GitHub Pages:** `DEPLOY_TARGET=gh-pages` (veya `GITHUB_PAGES=true`) ayarlandığında `base: "/Mu-la-Monitor_v2/"` üretilir.
  - **Önemli GitHub Ayarı:** GitHub Pages yayınının çalışması için repository ayarlarından **Settings → Pages → Build and deployment → Source: GitHub Actions** seçili olmalıdır.
  - `.github/workflows/deploy-pages.yml` workflow'unda `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` GitHub Actions Secrets olarak tanımlanmalıdır.

---

## Güvenlik Mimarisi (Supabase Edge Functions, RLS & Misafir Modu)

1. **Edge Function Yetkilendirmesi (`supabase/config.toml` & `_shared/auth.ts`):**
   - Yalnızca salt-okunur public endpoint'lerde (`public-api`, `municipality-feed`, `venue-occupancy`) `verify_jwt = false` açıktır (yalnızca `GET`/`OPTIONS` kabul ederler).
   - Cron/worker ve yazma işlevleri (`job-worker`, `news-scrape`, `twitter-collect`, `spike-scan`, `anomaly-scan`, `tourism-data-checker`, `email-alerts-ingest`, `social-cron`) yalnızca iç servis yetkisiyle (`x-internal-secret` veya `service_role` / Supabase secret key) çalışır; tarayıcı CORS'u kapalıdır.
   - Kullanıcı/analist/yönetici endpoint'leri (`ai-summary`, `executive-report`, `city-briefing`, `mock-data-injector`, `social-collect`, `social-analyze`, `osint-lookup`, `protocol-scrape`, `data-scrape`, `reference-data`, `transport-scrape`, `traffic-teyit`) geçerli kullanıcı JWT'si + rol kontrolü + rate limit uygular ve izinli origin listesi (`ALLOWED_ORIGINS`) ile sınırlı CORS döndürür.

2. **RLS & SQL Sertleştirme (`supabase/migrations/20261116000001_security_rls_and_functions_hardening.sql`):**
   - Açık yazma (`WITH CHECK (true)` / `FOR ALL USING (true)`) ve hatalı `auth.role() = 'service_role'` politikaları kaldırılmıştır.
   - `anon` rolü hiçbir tabloya yazamaz; `job_queue` yalnızca `service_role` erişimine açıktır; `email_alerts` ve `osint_searches` anonim kullanıcılara kapalıdır.
   - `claim_jobs`, `find_similar_post` ve `capture_daily_snapshot` fonksiyonları `SECURITY INVOKER SET search_path = public` olarak güncellenmiş ve `PUBLIC`/`anon`/`authenticated` çalıştırma yetkileri kapatılmıştır. `district_pulse` view'ı `security_invoker = true` ile çalışır.
   - Yönetici/analist yazma yetkileri yalnızca sunucu kontrollü `auth.jwt() -> 'app_metadata' ->> 'role'` (`admin` / `analyst`) üzerinden doğrulanır.

3. **Salt-Okunur Misafir Modu (`mugla-guest`):**
   - Misafir erişimi `isAuthenticated: false` olarak değerlendirilir; yalnızca public/cache verilerini salt-okunur gösterir, demo veri enjeksiyonu, yönetici özeti üretimi ve kaynak/anahtar kelime mutasyonlarını gizler.

---

## Yerel Geliştirme ve Doğrulama Komutları

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
node scripts/verify-build-assets.mjs --base=/
DEPLOY_TARGET=gh-pages npm run build
node scripts/verify-build-assets.mjs --base=/Mu-la-Monitor_v2/
```
