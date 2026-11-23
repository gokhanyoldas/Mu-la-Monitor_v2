# Güvenlik Notları — Muğla Monitör v2

Bu belge, güvenlik denetiminde tespit edilen zayıf/orta maddelerin kapatılması ve mevcut güvenlik duruşunun özetidir.

## Uygulanan Sertleştirmeler (2026-11-23)

### Security Headers (önceden: Zayıf → İyi)
- `vercel.json` üzerinden tüm yanıtlara eklendi:
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Strict-Transport-Security`
- Yerel Express sunucusu (`server.ts`) aynı header setini uygular.

### Dependency Scanning & CI/CD (önceden: Zayıf → İyi)
- `.github/dependabot.yml` — haftalık npm + GitHub Actions güncellemeleri
- `.github/workflows/security.yml` — her push/PR ve haftalık cron:
  - `npm audit` (production + full)
  - Typecheck
  - Lint
  - Production build kontrolü

### Input Validation & Exception Handling (önceden: Orta → İyileştirildi)
- `/api/intel/*` endpoint'lerinde tip ve uzunluk kontrolleri eklendi.
- JSON body limiti `12mb` → `2mb` düşürüldü (DoS riski azaltıldı).
- Global Express error handler eklendi; kontrollü 500 yanıtı döner.

### Zaten İyi Olan Alanlar (değişmedi)
- Authentication / Authorization (JWT + `app_metadata.role`)
- RLS + SECURITY INVOKER fonksiyonlar
- CORS (whitelist, wildcard yok)
- Rate limiting (Edge Function seviyesinde)
- Secret management (client'a sızdırılmıyor)
- IDOR / ownership kontrolleri (RLS)

## Hâlâ Manuel / Operasyonel Olanlar

| Madde | Durum | Not |
|-------|--------|-----|
| File Upload Validation | N/A | Projede dosya yükleme yok |
| Backup | Supabase planına bağlı | Kritik tablolar için ek snapshot düşünülebilir |
| Audit Log tablosu | Orta | Admin işlemleri için ayrı `audit_logs` eklenebilir |
| XSS sanitization | Düşük risk | React varsayılan koruma + tek `dangerouslySetInnerHTML` (chart CSS) |

## Önerilen Sonraki Adımlar
1. GitHub → Settings → Code security → Dependabot alerts + Secret scanning aç
2. `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` secret'larını Actions'a ekle (build job için)
3. İleride admin/analyst mutasyonları için `audit_logs` tablosu + RLS
4. Edge Function'larda tutarlı Zod şema validasyonu yaygınlaştırılabilir

## Raporlama
Güvenlik açığı bulursanız repository sahibi ile iletişime geçin. Public issue açmadan önce private kanal tercih edin.
