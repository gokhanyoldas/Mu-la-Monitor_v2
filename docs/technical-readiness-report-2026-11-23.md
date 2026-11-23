# Muğla Monitor v2 — Teknik Hazırlık ve Yayın Öncesi Uzman Raporu

**Rapor tarihi:** 23 Kasım 2026  
**İncelenen repository:** `gokhanyoldas/Mu-la-Monitor_v2`  
**İncelenen ana çalışma branch’i:** `feature/production-foundation`  
**İncelenen sürüm:** `a837cf0` (`chore: update dependencies for security fixes`)

## 1. Yönetici özeti

Muğla Monitor v2’nin mevcut `feature/production-foundation` branch’i teknik kalite açısından yayın adayı durumundadır. Temiz çalışma ağacı, `npm audit` sonucu sıfır güvenlik açığı, başarılı TypeScript kontrolü, lint, test, production build ve hem kök hem de GitHub Pages asset doğrulamalarına sahiptir.

Vercel’de başarısız olan Dependabot preview problemi de kök nedeni bulunarak düzeltildi. Sorun tek bir paket hatası değil, aynı Dependabot PR’ında birbirinden bağımsız major güncellemelerin birlikte uygulanmasıydı. PR #9’a TypeScript, Tailwind ve ESLint sürümlerini mevcut proje konfigürasyonuyla uyumlu tutan düzeltmeler push edildi. PR #9’un son kontrol durumunda beş kontrolün tamamı başarılıdır ve Vercel deployment kontrolü geçmiştir.

Buna karşın repository’nin `main` branch’ine doğrudan merge edilmeden önce aşağıdaki yönetişim adımları tamamlanmalıdır:

1. PR #9 kontrollü biçimde incelenmeli ve uygun görülürse merge edilmelidir.
2. PR #7 ve PR #8 şu an başarısızdır; mevcut halleriyle merge edilmemelidir. Her ikisinde de `package-lock.json` ile `package.json` uyumsuzluğu nedeniyle `npm ci` çalışmamaktadır.
3. PR #6 (`feature/production-foundation`) ile Dependabot PR’larının merge sırası belirlenmelidir; aynı dosyalara dokunan PR’lar sırayla ve tekrar doğrulama yapılarak birleştirilmelidir.
4. Vercel ve Supabase production ortam değişkenleri ile Supabase migration/Edge Function dağıtım durumu canlı ortamda ayrıca doğrulanmalıdır. Bu inceleme repository ve CI seviyesinde yapılmıştır; canlı Supabase projesine yazma/dağıtım doğrulaması yapılmamıştır.
5. Üretim sonrası gözlemleme, rollback ve veri toplama işçisi için operasyonel prosedür hazırlanmalıdır.

**Genel karar:** Kod tabanı teknik olarak iyi durumda; ancak production go-live kararı için yazılım kalitesi kadar branch/PR yönetimi ve canlı altyapı doğrulaması da tamamlanmalıdır.

## 2. Denetim kapsamı ve kanıtlar

İncelenen alanlar:

- Git branch, commit ve açık pull request durumu
- npm bağımlılıkları ve lockfile bütünlüğü
- Dependabot ve Vercel deployment sonuçları
- TypeScript, ESLint, Vitest ve Vite production build kontrolleri
- GitHub Actions CI tanımı
- Vercel yapılandırması
- ortam değişkeni ve secret kullanım modeli
- Supabase migration, Edge Function ve RLS sertleştirme dosyaları
- GitHub Pages asset üretimi

Çalıştırılan kontroller ve sonuçları:

| Kontrol | Sonuç |
|---|---:|
| `npm audit` | **0 vulnerability** |
| `npm run typecheck` | **Başarılı** |
| `npm run lint` | **Başarılı** |
| `npm test -- --run` | **15 test dosyası / 78 test başarılı** |
| Vercel production build | **Başarılı** |
| `npm run verify:assets -- --base=/` | **Başarılı, 5 asset** |
| GitHub Pages build + asset doğrulaması | **Başarılı, 5 asset** |
| Dependabot PR #9 checks | **5/5 başarılı** |
| Çalışma ağacı | **Temiz** |

Testler sırasında bazı React `act(...)` uyarıları ve Vite/Rolldown geçiş uyarıları görüldü. Bunlar test sonucunu başarısız yapmıyor; ancak teknik borç olarak izlenmelidir.

## 3. GitHub ve branch durumu

Açık PR’lar:

| PR | Konu | Durum | Öneri |
|---:|---|---|---|
| #6 | `feature/production-foundation` | Açık; kalite kontrolü olumlu | Fonksiyonel ve güvenlik incelemesi sonrası merge planına alınmalı |
| #9 | Development dependency grubu, 23 update | **Tüm kontroller başarılı** | Merge edilebilir; önce branch sırası netleştirilmeli |
| #7 | `actions/checkout` 4 → 7 | **CI başarısız** | Mevcut haliyle merge edilmemeli; lockfile/base branch güncellenmeli |
| #8 | `actions/setup-node` 4 → 7 | **CI başarısız** | Mevcut haliyle merge edilmemeli; lockfile/base branch güncellenmeli |

### PR #9 — çözülen Vercel problemi

İlk hata şu dependency çatışmasından kaynaklanıyordu:

- `typescript@7.0.2`
- `typescript-eslint@8.73.0` peer aralığı: `typescript >=4.8.4 <6.1.0`

Ayrıca Tailwind 4, projedeki mevcut PostCSS yapılandırmasıyla uyumlu değildi. ESLint 10 da mevcut kodu yeni React Hooks kuralları nedeniyle hata seviyesinde reddediyordu.

PR #9’a uygulanan uyumluluk yaklaşımı:

- TypeScript: `^5.9.3`
- Tailwind CSS: `^3.4.19`
- ESLint: `^9.39.5`
- `@eslint/js`: `^9.32.0`
- `eslint-plugin-react-hooks`: `^5.2.0`
- `eslint-plugin-react-refresh`: `^0.4.26`
- `globals`: `^15.15.0`

Bu düzeltmelerden sonra temiz checkout üzerinde `npm ci`, typecheck, lint ve Vite production build başarılı oldu. PR #9’un son commit’i `5b91cfb` durumundadır.

### PR #7 ve #8 — kök neden

Her iki PR’ın CI logunda `npm ci` şu tip hatalarla durmaktadır:

```text
npm error code EUSAGE
npm error Missing: ... from lock file
```

Bu, GitHub Actions sürüm güncellemesinden çok repository’deki `package.json` ve `package-lock.json` dosyalarının aynı dependency ağacını temsil etmediğini gösterir. `npm ci`, lockfile ile package manifest’in birebir uyumlu olmasını zorunlu kılar.

Önerilen çözüm:

1. PR branch’ini güncel `main` veya nihai release branch’i üzerine rebase edin.
2. Node 22 ve repository’de kullanılan npm sürümüyle `rm -rf node_modules && npm install` çalıştırın.
3. Üretilen `package-lock.json` dosyasını commit edin.
4. Temiz ortamda `npm ci` çalıştırın.
5. CI’nin tamamını yeniden çalıştırın.
6. Sadece GitHub Actions değişikliğini içeren PR’ları, uygulama dependency PR’larından ayrı merge edin.

## 4. Bağımlılık ve toolchain değerlendirmesi

Mevcut production foundation branch’i aşağıdaki açıdan dengeli görünmektedir:

- TypeScript 5.9.x, mevcut `typescript-eslint` sürümüyle uyumludur.
- Tailwind 3.4.x, mevcut PostCSS yapılandırmasıyla uyumludur.
- ESLint 9.x, mevcut flat config ve React koduyla uyumludur.
- Vite 8.x üzerinde build başarılıdır; Vite’in Rolldown/native config geçiş uyarıları izlenmelidir.
- Vitest 5.x ile tüm testler geçmektedir.
- npm lockfile v3 ile temiz kurulum doğrulanmıştır.

### Bağımlılık yönetimi için öneri

Dependabot’un 23 development dependency güncellemesini tek PR’da birleştirmesi riskli olmuştur. Bundan sonra major güncellemeler aşağıdaki gibi ayrılmalıdır:

- `toolchain`: TypeScript, Vite, Vitest, ESLint, Tailwind
- `testing`: Testing Library, jsdom
- `deployment`: Vercel CLI ve GitHub Actions
- `minor-patch`: güvenli semver aralığı içindeki patch/minor güncellemeler

Major güncellemeler için ayrı PR ve ayrı smoke test uygulanmalıdır. Özellikle Tailwind 3 → 4, ESLint 9 → 10 ve TypeScript 5 → 7 aynı PR’da birlikte yükseltilmemelidir.

Repository’de görünür bir `.github/dependabot.yml` yapılandırması bulunmadığı için Dependabot davranışı varsayılan/harici ayarlara bırakılmış görünmektedir. Bu dosyanın repository’ye eklenmesi önerilir.

## 5. Güvenlik değerlendirmesi

### Olumlu bulgular

- `npm audit` sonucu: 0 düşük, 0 orta, 0 yüksek, 0 kritik açık.
- Kaynak taramasında gerçek API key veya private key değeri bulunmadı.
- `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` ve diğer secret’lar kaynak kodda değer olarak değil, environment variable adı olarak kullanılıyor.
- Production build, Supabase public URL ve anon/publishable key yoksa hata veriyor; hardcoded production fallback kaldırılmış.
- Gemini çağrıları server-side proxy/API/Edge Function mimarisine taşınmış.
- Supabase security migration’ında açık yazma politikaları, RLS, `SECURITY INVOKER`, sabit `search_path` ve service-role erişimi için sertleştirmeler mevcut.
- Misafir modu salt-okunur olarak tasarlanmış; mutation yetkileri ayrıştırılmış.
- GitHub Actions workflow’unda `permissions: contents: read` kullanılmış.

### Canlı ortamda ayrıca doğrulanması gerekenler

Repository taraması tek başına Supabase ve Vercel ayarlarının doğru olduğunu kanıtlamaz. Aşağıdaki kontroller canlı panelde yapılmalıdır:

- Vercel’de Production ve Preview environment ayrımı
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` veya `VITE_SUPABASE_PUBLISHABLE_KEY`
- gerekli `VITE_APP_URL`, `VITE_SENTRY_DSN` ve isteğe bağlı harita değişkenleri
- Supabase secret store içinde `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `INTERNAL_FUNCTION_SECRET`, `ALLOWED_ORIGINS`
- GitHub Actions secrets içinde otonom ajan için gerekli dört secret
- Supabase Edge Function’ların son migration’larla aynı sürümde olması
- RLS policy’lerinin production database üzerinde gerçekten uygulanmış olması
- cron job’ların `anon_key` yerine internal secret/service role akışıyla çalışması
- CORS allowlist’in gerçek Vercel ve GitHub Pages domain’lerini içermesi

Service role ve Gemini anahtarları Vercel client-side `VITE_*` değişkenleri olarak kesinlikle tanımlanmamalıdır.

## 6. CI/CD ve deployment değerlendirmesi

### Mevcut güçlü taraflar

CI workflow’u aşağıdaki aşamaları kapsıyor:

1. `npm ci`
2. high severity seviyesinde npm audit
3. typecheck
4. lint
5. test
6. production build
7. root asset doğrulaması
8. GitHub Pages asset doğrulaması

Vercel tarafında:

- build command: `npm run build`
- output directory: `dist`
- framework: Vite
- SPA route fallback yapılandırılmış
- asset cache header’ı immutable olarak tanımlanmış

### Riskler ve iyileştirmeler

1. **Release branch standardı eksik:** `feature/production-foundation` açık PR olarak duruyor. Production’a hangi branch’in kaynak olacağı yazılı hale getirilmeli.
2. **Preview ve production ayrımı:** Vercel Environment Variables için Preview/Production kapsamları ayrı ayrı kontrol edilmeli.
3. **Rollback prosedürü:** Son başarılı Vercel deployment’a dönüş ve Supabase migration rollback planı yazılı değil.
4. **Smoke test eksikliği:** Build başarılı olsa da canlı URL üzerinde `/`, SPA deep-link, `/api/health`, authentication, Supabase read-only data ve AI proxy smoke testleri CI’da görünmüyor.
5. **Action runtime geçişi:** PR #7 ve #8’in amacı GitHub Actions runtime uyumluluğunu güncellemek. Bu güncellemeler lockfile’dan bağımsız bir branch üzerinde temiz şekilde yapılmalı.
6. **Node/npm sabitleme:** `package.json` içinde beklenen Node/npm sürümü açıkça tanımlanmalı; `.nvmrc` veya `engines` alanı eklenmesi önerilir.

## 7. Ürün ve operasyonel hazır olma durumu

Teknik build ve test seviyesi iyi olsa da platformun gerçek değer üretmesi için aşağıdaki operasyonel konulara karar verilmelidir:

- 13 ilçe için hangi veri kaynaklarının kritik olduğu ve her kaynağın güncellik SLA’sı
- veri kaynağı kesildiğinde fallback/mock verinin kullanıcıya nasıl etiketleneceği
- OSINT ve istihbarat verilerinin saklama süresi
- kişisel veri, sosyal medya verisi ve erişim kayıtları için veri yönetişimi
- admin/analyst rollerinin kim tarafından atanacağı
- AI özetlerinin insan onayından geçip geçmeyeceği
- yanlış pozitif/yanlış negatif olaylar için düzeltme ve audit süreci
- Supabase maliyet ve GitHub Actions free-tier kota takibi
- e-posta/alert kanalının sahibi ve nöbet prosedürü

Özellikle “otonom istihbarat ajanı” workflow’u için dry-run, quota limit, başarısız çalışma, tekrar deneme ve insan onayı senaryoları üretim öncesinde belgelenmelidir.

## 8. Önceliklendirilmiş aksiyon planı

### P0 — Merge ve production öncesi zorunlu

| Aksiyon | Sorumlu | Kabul kriteri |
|---|---|---|
| PR #9’u inceleyip merge sırasını belirlemek | Repo sahibi | PR kontrolleri yeşil, conflict yok |
| PR #7 ve #8’de lockfile’ı yeniden üretmek | Geliştirici | Temiz ortamda `npm ci` başarılı |
| PR #6, #9 ve action PR’ları için tek merge planı oluşturmak | Repo sahibi | `main` üzerinde tekrar CI başarılı |
| Vercel env değişkenlerini Production/Preview ayrımıyla doğrulamak | Deployment sahibi | Preview ve Production build başarılı |
| Supabase migration ve Edge Function sürümünü production’da doğrulamak | Backend sahibi | Migration geçmişi ve function deploy listesi eşleşiyor |
| `/api/health` ve temel canlı smoke testleri eklemek | Geliştirici | CI veya post-deploy job sonucu görünür |

### P1 — İlk production sprint’i

| Aksiyon | Kabul kriteri |
|---|---|
| `.github/dependabot.yml` eklemek | Major toolchain güncellemeleri ayrı PR’lara bölünüyor |
| Node/npm sürümünü sabitlemek | CI, lokal ve Vercel aynı major runtime kullanıyor |
| Vercel preview → production promotion prosedürü yazmak | Rollback adımları dokümante |
| Sentry veya eşdeğer error monitoring’i doğrulamak | Frontend/API hata alarmı çalışıyor |
| Supabase Edge Function health/check endpoint’leri eklemek | Kritik function’lar izlenebilir |
| AI çağrıları için quota, timeout ve retry politikası eklemek | Kota aşımı kullanıcı deneyimini bozmuyor |
| Testlerdeki `act(...)` uyarılarını temizlemek | Test çıktısı gereksiz React uyarılarından arındırılmış |

### P2 — Orta vadeli teknik iyileştirme

| Aksiyon | Hedef |
|---|---|
| Vite native config/Rolldown geçişini planlamak | Gelecek Vite major geçişinde sürpriz risk azaltma |
| Test environment kurulumu ve Vitest worker optimizasyonu | Test süresini ve jsdom maliyetini düşürme |
| Dependency update botunu grup ve approval kurallarıyla yapılandırmak | Büyük güncellemelerin production’ı bloke etmemesi |
| Veri kaynağı kalite metrikleri eklemek | Güncellik, hata oranı ve coverage dashboard’u |
| Güvenlik regression testlerini Supabase staging’de çalıştırmak | RLS ve Edge Function auth davranışının canlıya yakın doğrulanması |
| Release notes ve migration runbook oluşturmak | Tekrarlanabilir release süreci |

## 9. Önerilen merge sırası

En düşük riskli sıra:

1. PR #9’un başarılı dependency düzeltmelerini gözden geçirip merge edin.
2. `main` güncellendikten sonra PR #6’yı rebase edin ve testleri yeniden çalıştırın.
3. PR #6 merge edildikten sonra PR #7 ve #8’i ayrı ayrı güncel `main` üzerine rebase edin.
4. Her action PR’ında lockfile değişmemesi gerekiyorsa, PR’ın neden lockfile’a dokunduğunu kontrol edin; `npm ci` hatası devam ediyorsa lockfile’ı base branch ile yeniden oluşturun.
5. Son `main` üzerinde tam CI ve Vercel production/preview smoke test çalıştırın.
6. Supabase migration/function production doğrulamasından sonra release’i yayınlayın.

## 10. Son karar ve risk seviyesi

**Kod kalitesi:** Yeşil  
**Bağımlılık güvenliği:** Yeşil, incelenen production foundation branch’inde `npm audit` temiz  
**Vercel build:** Yeşil  
**PR yönetimi:** Sarı; birden fazla açık PR ve başarısız action PR’ları var  
**Canlı altyapı doğrulaması:** Sarı; Supabase/Vercel panel doğrulaması ayrıca gerekli  
**Operasyonel hazırlık:** Sarı; monitoring, rollback ve data governance belgelenmeli  

**Uzman önerisi:** Uygulama şu an “teknik olarak yayınlanabilir aday” seviyesindedir; “kontrollü production release” seviyesine geçmek için önce merge sırası, canlı environment doğrulaması ve post-deploy smoke testleri tamamlanmalıdır. PR #7 ve #8 mevcut halleriyle birleştirilmemeli; lockfile bütünlüğü düzeltilmeden action güncellemeleri production branch’ine alınmamalıdır.

---

## Ek: Release checklist

- [ ] PR #9 incelendi ve merge edildi
- [ ] PR #6 güncel `main` üzerine rebase edilip tüm CI’dan geçti
- [ ] PR #7 ve #8 `npm ci` uyumsuzluğu giderilerek ayrı ayrı doğrulandı
- [ ] `npm audit` temiz
- [ ] `npm run typecheck` başarılı
- [ ] `npm run lint` başarılı
- [ ] `npm test -- --run` başarılı
- [ ] Vercel production build başarılı
- [ ] Vercel Preview/Production env değişkenleri kontrol edildi
- [ ] Supabase migration geçmişi kontrol edildi
- [ ] Edge Function deployment listesi kontrol edildi
- [ ] RLS ve auth smoke testleri yapıldı
- [ ] `/api/health` ve SPA deep-link testleri yapıldı
- [ ] Sentry/error monitoring doğrulandı
- [ ] Rollback sorumlusu ve prosedürü belirlendi
- [ ] Release notu ve son commit kaydedildi
