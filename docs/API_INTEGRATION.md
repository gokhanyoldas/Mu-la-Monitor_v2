# Muğla Monitor — API Integration Guide

Real data sources powering each dashboard section.
All APIs used here are **free** (no paid tier required).

---

## Free APIs Used

| Category | API / Source | Key Required? | Endpoint |
|----------|-------------|---------------|----------|
| **Weather** | Open-Meteo | ❌ No | `api.open-meteo.com/v1/forecast` |
| **Air Quality** | Open-Meteo AQ | ❌ No | `air-quality-api.open-meteo.com/v1/air-quality` |
| **Earthquakes** | USGS | ❌ No | `earthquake.usgs.gov/fdsnws/event/1/query` |
| **Exchange Rates** | Frankfurter (ECB) | ❌ No | `api.frankfurter.app/latest` |
| **News & Trends** | Google News RSS | ❌ No | `news.google.com/rss/search?q=Muğla&hl=tr` |
| **Dams** | DSİ — Seasonal Model | ❌ N/A | Static (no free RT API) |
| **Tourism** | TÜİK / KTB Static | ❌ N/A | Static (quarterly update) |
| **Demographics** | TÜİK ADNKS 2023 | ❌ N/A | Static |
| **Budget** | Belediye Bütçe Raporu | ❌ N/A | Static (annual update) |

---

## Edge Functions

### `data-scrape` — Real-time Data
Handles: `weather`, `air_quality`, `earthquakes`, `economy`, `news`, `trends`,
`dams`, `tourism`, `energy`, `real_estate`, `road_works`

### `reference-data` — Semi-static Reference Data
Handles: `demographics`, `education`, `health`, `agriculture`, `traffic_density`,
`gastronomy`, `budget`, `culture`, `life_quality`

---

## Deploying Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref gsjypruivdsiufaeqtoc

# Deploy all functions
supabase functions deploy data-scrape
supabase functions deploy reference-data
```

---

## Future Upgrades (Free Tier)

| Feature | API | Notes |
|---------|-----|-------|
| Better Air Quality | WAQI / aqicn.org | Free token from aqicn.org/data-platform/token |
| Real-time Traffic | OpenStreetMap Overpass | Free, no key |
| Social Monitoring | RSS + Nitter | No API key |
| Weather Radar | Open-Meteo | Already integrated |
| Wildfire Risk | NASA FIRMS | Free API key |

---

## CORS Configuration
All edge functions return:
```
Access-Control-Allow-Origin: *
```
This allows the Vite dev server and production frontend to call them directly.

---

## Data Update Frequency

| Type | Refresh Interval | Method |
|------|-----------------|--------|
| Weather | 10 min | pg_cron → live_data_cache → Realtime push |
| Air Quality | 20 min | pg_cron → live_data_cache → Realtime push |
| Earthquakes | 5-10 min | pg_cron → live_data_cache → Realtime push |
| Economy | 30 min | pg_cron → live_data_cache |
| News | 15 min | pg_cron → live_data_cache |
| Dams / Tourism / Energy | 6 h | pg_cron → live_data_cache |
| Demographics / Budget | 24 h | pg_cron → live_data_cache |
| Anomaly scan | 15 min | pg_cron → anomaly-scan → anomaly_alerts |
| AI Şehir Nabzı | 6 h | pg_cron → ai-summary (pulse) → ai_summaries |
| Historical snapshot | Daily 23:55 | capture_daily_snapshot() → historical_snapshots |

---

## Yaşayan Veri Hattı (Live Pipeline)

`20260820000001_live_pipeline.sql` migration'ı ile kurulan mimari:

```
pg_cron ──► Edge Functions ──► live_data_cache ──► Realtime ──► React Query cache
                 │                                        (useLiveData push)
                 ├──► alert_events ──────────────► RealtimeAlertBanner
                 └──► anomaly-scan ─► anomaly_alerts ─► intelligenceHub ─► AnomalyPanel
```

### Bileşenler

1. **`live_data_cache`** — Kalıcı önbellek. Edge function'lar her başarılı çekimden
   sonra buraya yazar; upstream API çökerse son iyi veri `stale: true` ile sunulur.
   Frontend, edge function'a ulaşamazsa doğrudan bu tablodan okur.
2. **`alert_events`** — Kalıcı kritik olay akışı. `data-scrape` yeni M≥4 depremleri,
   `anomaly-scan` kritik anomalileri buraya yazar. Realtime ile anında banner'a düşer.
3. **`anomaly_alerts`** — `anomaly-scan` edge function'ının çıktısı. Güncel değerler
   7 günlük `historical_snapshots` baseline'ı ile karşılaştırılır; her
   `category+metric_key` için tek aktif kayıt tutulur (upsert). Artık geçerli
   olmayan anomaliler otomatik `is_active=false` yapılır.
4. **`capture_daily_snapshot()`** — Günlük 23:55'te cache'teki metrikleri
   `historical_snapshots`'a işler; bu tablo anomali baseline'ını ve
   tarihsel karşılaştırmayı besler.
5. **AI "Şehir Nabzı" (`pulse`)** — `ai-summary` fonksiyonunun yeni tipi.
   Tüm canlı katmanları (hava, deprem, ekonomi, haber, sosyal) birleştirip
   6 saatte bir Gemini ile brifing üretir. Ana sayfadaki `AISummaryCard type="pulse"`
   kartında gösterilir.

### Realtime Publication

`live_data_cache`, `alert_events`, `anomaly_alerts` ve `ai_summaries` tabloları
`supabase_realtime` publication'ına eklenir (migration bunu idempotent yapar).

### Gerekli Supabase Ayarları

```sql
-- pg_cron job'larının edge function'ları çağırabilmesi için (bir kez):
alter database postgres set app.supabase_url = 'https://<proje-ref>.supabase.co';
alter database postgres set app.anon_key = '<anon-public-key>';
```

Edge function secret'ları:
```bash
supabase secrets set GEMINI_API_KEY=<gemini-key>   # ai-summary için
```

### Yedek Zamanlayıcı (GitHub Actions)

pg_cron kullanılamıyorsa `.github/workflows/data-pipeline.yml` aynı yenileme
çağrılarını 30 dakikada bir yapar. Repo secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
