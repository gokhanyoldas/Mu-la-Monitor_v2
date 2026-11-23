# Muğla Monitor v2 — Production Runbook

Bu belge production release öncesi ve sonrası uygulanacak operasyon prosedürüdür.

## 1. Kesin merge sırası

1. **PR #9 — dependency uyumluluk düzeltmesi:** Tüm GitHub/Vercel kontrolleri yeşil olmalı. Merge sonrası `main` branch üzerinde tam CI tekrar çalıştırılır.
2. **PR #6 — production foundation:** `main` güncel olduktan sonra branch rebase edilir. Typecheck, lint, test, audit, build ve asset kontrolleri tekrar çalıştırılır. Conflict varsa otomatik çözüm yapılmaz; ilgili dosya sahibi incelemelidir.
3. **PR #7 ve #8 — GitHub Actions güncellemeleri:** Mevcut branch’ler `package.json`/`package-lock.json` uyumsuzluğu nedeniyle önce düzeltilir. Temiz checkout üzerinde `npm ci` başarılı olmadan merge edilmez. İki PR ayrı ayrı merge edilir.
4. Son `main` üzerinde production smoke test ve Supabase doğrulaması yapılır.
5. Production deployment Vercel’de promotion/merge sonrası izlenir.

> PR #7 ve #8’in aynı anda merge edilmesi önerilmez. Bir action güncellemesi merge edildikten sonra CI yeşile dönmeli, sonra diğeri ele alınmalıdır.

## 2. Release gate

Release sorumlusu aşağıdaki tüm koşullar sağlanmadan production promotion yapmamalıdır:

- `npm ci` temiz checkout’ta başarılı
- `npm audit --audit-level=high` başarılı
- `npm run typecheck` başarılı
- `npm run lint` başarılı
- `npm test -- --run` başarılı
- `npm run build` başarılı
- `npm run verify:assets -- --base=/` başarılı
- Vercel Preview deployment başarılı
- Supabase migration geçmişi hedef production projesiyle uyumlu
- Kritik Edge Function’lar deploy edilmiş
- Vercel Production environment değişkenleri kontrol edilmiş
- Smoke test başarılı

## 3. Vercel ortam değişkenleri kontrolü

Vercel Project Settings → Environment Variables bölümünde Preview ve Production kapsamları ayrı ayrı kontrol edilir.

### Frontend build için zorunlu

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` veya `VITE_SUPABASE_PUBLISHABLE_KEY`

### İsteğe bağlı veya özellik bazlı

- `VITE_APP_URL`
- `VITE_SENTRY_DSN`
- `VITE_TOMTOM_API_KEY`

### Server/API ortamı — Vercel client bundle’ına eklenmemeli

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_FUNCTION_SECRET`
- `ALLOWED_ORIGINS`
- `GEMINI_MODEL`

Service role ve Gemini anahtarları `VITE_` prefix’iyle tanımlanmaz. Bu değerler tarayıcı bundle’ına girmemelidir.

## 4. Supabase migration ve Edge Function doğrulaması

Canlı Supabase projesinde release sorumlusu şu kontrolleri yapar:

1. Hedef project ref’in doğru olduğunu doğrula.
2. Migration geçmişinde repository’deki son migration dosyalarının uygulandığını doğrula.
3. Özellikle şu migration’ları kontrol et:
   - `20261116000001_security_rls_and_functions_hardening.sql`
   - `20261118000001_social_keywords_living_lexicon_sync.sql`
4. Edge Function listesinde kritik function’ların son commit ile uyumlu deploy edildiğini doğrula:
   - `public-api`
   - `reference-data`
   - `ai-summary`
   - `social-collect`
   - `social-analyze`
   - `protocol-scrape`
   - `transport-scrape`
   - `job-worker`
   - `anomaly-scan`
5. Secret Store’da server-side secret’ların bulunduğunu doğrula.
6. RLS ile public read ve protected write davranışını staging/test kullanıcılarıyla doğrula.
7. Cron/job worker çağrılarında `anon_key` kullanılmadığını doğrula.

Canlı migration veya function deploy işlemi, project ref ve yetkili Supabase CLI oturumu doğrulanmadan çalıştırılmaz.

## 5. Smoke testler

Vercel Preview veya Production URL üzerinde:

```sh
SMOKE_BASE_URL=https://preview.example.com npm run smoke:production
```

Bu komut şu kontrolleri yapar:

- `/` HTML ve başarılı HTTP yanıtı
- `/investigation` SPA deep-link fallback
- `/api/health` JSON ve serverless endpoint erişimi
- AI proxy endpoint’ini maliyetsiz varsayılan modda atlar

AI proxy’nin gerçek ama kontrollü çağrısını ayrıca doğrulamak için:

```sh
SMOKE_BASE_URL=https://preview.example.com \
SMOKE_AI_PROXY=true \
npm run smoke:production
```

Bu ikinci komut Gemini çağrısı oluşturabilir; yalnızca quota ve maliyet kabul edildiğinde çalıştırılır.

### Authentication ve Supabase manuel smoke testi

- Misafir modunda dashboard görüntülenebilmeli.
- Misafir kullanıcı mutation/administrator aksiyonlarını görememeli veya çalıştıramamalı.
- Yetkili analist kullanıcı ile korunan panel açılmalı.
- Yetkisiz kullanıcı protected Edge Function çağrısından 401/403 almalı.
- Public read endpoint’leri çalışmalı.
- Yazma işlemleri yalnızca rol ve RLS politikasına uygun kullanıcı/service role üzerinden çalışmalı.

## 6. Rollback prosedürü

### Vercel rollback

1. Vercel Deployments ekranında son başarılı production deployment’ı tespit et.
2. Başarısız deployment’ın URL’sini ve commit SHA’sını kaydet.
3. Son başarılı deployment için “Promote to Production”/rollback işlemini uygula.
4. `SMOKE_BASE_URL` ile kök sayfa, deep-link ve `/api/health` testini çalıştır.
5. Incident kaydına rollback zamanı, SHA, hata ve etkilenen route’ları yaz.

### Database rollback

Supabase migration’ları otomatik olarak tersine çevrilmez. Database değişiklikleri için:

- destructive migration yerine backward-compatible migration kullanılır;
- gerektiğinde forward-fix migration hazırlanır;
- migration öncesi kritik tablolarda backup/PITR durumu kontrol edilir;
- Edge Function rollback’u önceki bilinen başarılı function sürümüne dönülerek yapılır.

Uygulama rollback’u ile database rollback’u aynı işlem kabul edilmez; önce geriye uyumlu uygulama sürümüyle servis stabilize edilir.

## 7. Monitoring ve Sentry

Production release sonrası ilk 30 dakika ve ilk 24 saat izlenir:

- Vercel Function error rate ve duration
- `/api/health` yanıt kodları
- Gemini fallback oranı ve quota hataları
- Supabase Edge Function error logları
- RLS/401/403 artışı
- veri kaynaklarının güncellik zamanı
- GitHub Actions autonomous agent başarısız/tekrar deneme sayısı

Sentry kullanılıyorsa:

- `VITE_SENTRY_DSN` Preview ve Production kapsamlarında doğru tanımlı olmalı;
- release/version bilgisi `VITE_APP_VERSION` ile eşlenmeli;
- secret veya kullanıcı hassas verisi event payload’ına yazılmamalı;
- source map yükleme politikası belirlenmeli;
- alert owner ve escalation kanalı atanmalı.

## 8. Veri kaynağı kesintisi prosedürü

Bir veri kaynağı başarısız olduğunda:

1. Kullanıcıya verinin son güncellenme zamanı ve fallback durumu gösterilir.
2. Mock veya yerel fallback veri gerçek veri gibi etiketlenmez.
3. İlk hata loglanır; tekrar deneme exponential backoff ile yapılır.
4. 15 dakikadan uzun kesintide operasyon sorumlusuna alarm gönderilir.
5. 60 dakikadan uzun kesintide ilgili panel “veri güncel değil” durumuna alınır.
6. Kaynak geri geldiğinde veri tutarlılığı ve duplicate kayıt kontrol edilir.
7. Olay kaydı, başlangıç/bitiş zamanı ve etkilenen ilçelerle kapatılır.

## 9. Incident kayıt şablonu

- Olay ID:
- Başlangıç zamanı:
- Tespit eden:
- Etkilenen environment:
- Etkilenen route/function/data source:
- İlk belirti:
- Uygulanan geçici çözüm:
- Rollback yapıldı mı:
- Kök neden:
- Kalıcı düzeltme PR’ı:
- Kapanış zamanı:
- Tekrarlamayı önleyici aksiyon:
