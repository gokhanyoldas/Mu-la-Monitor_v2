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
| Weather | 15 min | useLiveData refetchInterval |
| Air Quality | 30 min | useLiveData refetchInterval |
| Earthquakes | 10 min | useLiveData refetchInterval |
| Economy | 30 min | Frankfurter API |
| News | 15 min | Google News RSS |
| Demographics | 24h | Cached static |
| Budget | 24h | Cached static |
