# Muğla Monitor v2 — Proje Bilgisi (Kalıcı Referans)

> Bu dosya yeni konuşmalarda otomatik yüklenir. Önceki konuşma geçmişi silinse bile
> proje bağlamı burada korunur.

## 🎯 Proje
**Muğla Monitor v2** — 5 modüllü "yaşayan şehir istihbarat platformu" (Vite + React + TS + Supabase)

## 🏗️ Mimari (Free-Tier, 0 USD)
- **Frontend:** Vite + React + TypeScript + Tailwind + shadcn/ui + Leaflet
- **Backend:** Supabase (PostgreSQL + Edge Functions + Realtime + pg_cron)
- **AI:** Gemini 3.5-flash-lite (GEMINI_API_KEY secret'ta)

## 🔑 Supabase Bağlantısı
- **Proje ref:** `wivooargsmcwbiokpklu`
- **URL:** `https://wivooargsmcwbiokpklu.supabase.co`
- **Access token:** `SUPABASE_ACCESS_TOKEN` env var (gokhanyoldas hesabı)

## 📦 Deploy Edilen Edge Functions
`twitter-collect` · `news-scrape` · `job-worker` · `spike-scan` · `executive-report` · `mock-data-injector` · `protocol-scrape` · `data-scrape` · `reference-data` · `city-briefing` · `tourism-data-checker` · `transport-scrape`

## 🗄️ Önemli Tablolar
`social_posts` (ilçe/kategori/sentiment/lat/lon) · `alert_events` (uyarılar) · `ai_summaries` (AI raporları, günlük cache) · `live_data_cache` (canlı veri snapshot) · `protocol_members` + `protocol_changes` (protokol izleme) · `district_pulse` (ilçe nabzı view)

## ⏰ pg_cron Jobları
- `news-scrape` */15dk · `spike-scan` */10dk · `executive-report` 07:00 · `protocol-scrape` 05:17 · `tourism-data-checker` Pzt 06:33

## 📊 Veri Kaynakları (doğrulanmış)
- **Hava/AQI:** Open-Meteo (canlı, 15dk)
- **Deprem:** USGS Atom feed (canlı)
- **Barajlar:** Wikipedia "Muğla ilindeki barajlar" (8 gerçek baraj — Ören/Akgün/Yazır uydurmaydı, düzeltildi)
- **Ekonomi:** TÜİK 2024/Ç4 + Kültür-Turizm Bk. + Frankfurter/ECB kur
- **Gayrimenkul:** REIDIN-GYODER 2024 (13 ilçe) + TCMB HPI
- **Turizm:** 2025/Ç2 ön veri (4.2M projeksiyon)
- **Otobüs:** MUTTAŞ resmi hat sayfaları (7 hat, gidiş/dönüş ayrı)
- **Uçuş:** adsb.fi ADS-B (DLM/BJV, transit filtreli)
- **Protokol:** mugla.gov.tr il-protokol-listesi (412 üye, 13 kaymakam)

## 🎨 UI Kalıpları
- `DashboardPanel` — `collapsible` + `defaultOpen` (katlanabilir), `badge` (kaynak etiketi), `badgeVariant`
- `StatCard` — `info` prop (hover tooltip: kaynak + periyot)
- Layout: `items-start` grid (paneller kendi içeriği kadar yükseklik)
- `rta_dismissed` localStorage — kalıcı bildirim kapatma

## ⚠️ Bilinen Düzeltmeler (tekrarlanmasın)
- Baraj listesi: Wikipedia doğrulamalı (Ören/Akgün/Yazır Muğla'da YOK)
- Hava Kalitesi: AQI 51 → "Orta" (İyi değil), renk aralığa göre
- İlçe route: `/ilce/:ilceId` + `/ilce/:slug` ikisi de desteklenir
- Uçuş: transit (distance_km>60) filtrelenir, sadece gerçek iniş/kalkış
- Gemini model: `gemini-3.5-flash-lite` (1.5/2.5 yeni hesaplarda çalışmaz)
- Turizm: 2025/Ç2 ön veri (kesin yıl sonu Şubat-Mart 2026'da)
- Şehirlerarası otobüs: `transport-scrape` obilet.com statik mikrodata'sından çeker; sonuç `live_data_cache(bus_schedule)` içinde 30 dk TTL tutulur, pg_cron `refresh-bus` her 30 dk tazeler, frontend hata olursa cache'ten son-bilinen veriyi gösterir (mock'a düşmez)
- Uçuş: `transport-scrape?type=flights&source=adsb` — adsb.fi `opendata.adsb.fi/api/v3/lat/lon/dist` (DLM 36.7167/28.7833, BJV 37.2529/27.6643, 40NM). Firecrawl key GEREKMEZ; Havalimanları özet paneli + FlightTrackerSection buradan canlı uçak sayısı gösterir (Firecrawl tabanlı type=flights yalnızca key varken çalışır)
- Altyapı Projeleri: `data-scrape?type=road_works` — INFRA_PROJECTS = KGM/Büyükşehir doğrulamalı **14 gerçek proje** (8 temel + Bodrum Çevre Yolu YİD, Milas Ören, Marmaris-Selimiye, Muğla-Denizli-Kale, Milas Hastane Kavşağı, Datça Yarımada). Her proje Google News RSS proje bazlı izlenir; `type` alanı (yol/kavşak/tünel) proje türü rozeti için; `latest_news` başlıkları panele tıklanabilir link; `updated_at` son güncelleme satırı. **Otomatik keşif:** DISCOVERY_QUERIES (temel atma/ihale/yatırım programı/inşaat başladı) geniş tarama + Gemini (`gemini-3.5-flash-lite`) haber başlığından yeni proje adı çıkarır; listelenmemiş projeler `discovered=true` + `YENİ` rozetiyle envantere girer (en fazla 6/tur). Uydurma projeler (Ören/Akgün/Yazır vb.) EKLENMEZ.

## 🔧 Komutlar
- `npm run dev` — Vite dev (port 8080)
- `npm run build` — production build
- `npm test` — vitest (12 test)
- `npm run seed:live` — ilk veri dolumu (news-scrape → mock-data-injector → executive-report)
- `npx supabase functions deploy <name> --project-ref wivooargsmcwbiokpklu`
- `npx supabase db push` — migrasyonları uygula

## 🔗 Canlı Önizleme
OpenHands: `https://work-1-zwbiqdduqptktlmq.prod-runtime.all-hands.dev/` (port 12000)
Vercel (kalıcı): claim linki ile `*.vercel.app` adresi alınabilir

## 🚦 Canlı Trafik (TomTom)
- `reference-data` → `fetchTrafficDensity`, TomTom Flow Segment API ile **gerçek zamanlı** ilçe yoğunlukları üretir (segment 30 sn tazeleme, edge cache TTL 5 dk)
- `TOMTOM_API_KEY` secret'ı gerekli (edge function'da `Deno.env.get("TOMTOM_API_KEY")`); API key son kullanıcıya sızmaz
- `TRAFFIC_POINTS` = **Muğla'nın 13 ilçesi** (Bodrum, Datça, Marmaris, Fethiye, Milas, Menteşe, Dalaman, Ortaca, Köyceğiz, Yatağan, Ula, Seydikemer, Kavaklıdere); yoğunluk = 1 − currentSpeed/freeFlowSpeed
- **Otomatik güncelleme:** pg_cron job `refresh-traffic-live` her 5 dk `reference-data` traffic_density'yi çağırır → `live_data_cache` arka planda tazelenir, frontend Realtime/poll ile güncel veriyi alır
- Frontend `TrafficDensityMap.tsx` backend'in `hotspots` alanını okur (`zones` eski şema), hover'da anlık hız + veri güvenirliği (%) gösterir; kartlar: Ort. Yoğunluk / En Yoğun Bölge / Kritik Bölge
- `TransportSection.tsx` (Ulaşım sekmesi özet paneli): gerçek `hotspots` verisinden Ort. Yoğunluk / İzlenen İlçe (13) / En Yoğun İlçe gösterir; "Günlük Araç 285K" ve "Kaza 128" gibi statik metrikler KALDIRILDI (uydurmaydı); yol durumu listesi `road_works.projects`'ten (haber takibi) gelir, veri yoksa "belki bekleniyor" notu

### ✅ Teyit katmanı (traffic-teyit)
- `traffic-teyit` edge function: son 24 saat haberleri (social_posts, trafik anahtar kelimeleri) ile TomTom tıkanıklığını AI destekli çapraz doğrular
- Sonuç `ai_summaries(type='traffic_verification')` içine yazılır → panel altında "✅ Basın teyidi (AI)" kutusu
- Kritik (≥%50) tıkanıklıklar `anomaly_alerts` + `alert_events`'e gider; bir önceki değerden ani artış (δ≥30, ≥%40) spike alarmı üretir
- Cron: `refresh-traffic-live` (5 dk, TomTom) + `traffic-verify` (15 dk, AI teyidi) — AI maliyeti sınırlı
- `TOMTOM_API_KEY` secret'ı gerekli; `GEMINI_API_KEY` zaten mevcut
- Not: Muğla kırsal ilçelerinde TomTom probe verisi zayıftır → %0 değerleri "sakin" ya da "ölçülemiyor" olabilir; bu yüzden teyit katmanı değerlidir

## 📅 Son Güncelleme
2026-08-28 — TomTom canlı trafik: 13 ilçe + 5dk otomatik tazeleme (pg_cron refresh-traffic-live) + AI/basın teyit katmanı (traffic-teyit, 15 dk), confidence anomali flagleri; otobüs verisi kalıcı cache (bus_schedule + refresh-bus cron 30 dk)
2026-08-27 — Uçuş takip ADS-B + transit filtre, MUTTAŞ gidiş/dönüş, turizm 2025/Ç2, altyapı haber takibi
