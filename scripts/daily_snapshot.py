#!/usr/bin/env python3
"""
Muğla Monitör — Günlük Tarihsel Snapshot Scripti (Madde 5) — v2
Çalışma zamanı: Her gün 22:00 Istanbul (via SureThing cron task)

v2: Edge functions yerine doğrudan harici API çağrıları
(Open-Meteo weather + AQI, Frankfurter ECB FX, Supabase DB social query)

Metrikler:
- Hava: sıcaklık, nem, rüzgar, weathercode
- Çevre: AQI (European), PM2.5, PM10, NO2
- Sosyal: günlük post sayısı, duygu dağılımı, pozitif oran
- Ekonomi: USD/TRY, EUR/TRY kuru (Frankfurter/ECB)
"""

import os
import json
import httpx
from datetime import date, datetime
from zoneinfo import ZoneInfo

SUPABASE_URL        = os.environ.get("SUPABASE_URL", "https://wivooargsmcwbiokpklu.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

ISTANBUL = ZoneInfo("Europe/Istanbul")
TODAY    = datetime.now(ISTANBUL).date()

DB_HEADERS = {
    "apikey":        SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type":  "application/json",
}

# Muğla coordinates
LAT, LON = 37.2153, 28.3636


# ── Helpers ─────────────────────────────────────────────────────────────────

def row(category: str, metric_key: str, value_num=None, value_text=None,
        unit: str = "", source: str = "") -> dict:
    r = {
        "snapshot_date": str(TODAY),
        "category":      category,
        "metric_key":    metric_key,
        "unit":          unit,
        "source":        source,
    }
    if value_num  is not None: r["value_num"]  = float(value_num)
    if value_text is not None: r["value_text"] = str(value_text)
    return r


def upsert_snapshots(rows: list[dict]) -> bool:
    if not rows:
        print("[WARN] No rows to upsert")
        return False
    url = f"{SUPABASE_URL}/rest/v1/historical_snapshots?on_conflict=snapshot_date,category,metric_key"
    res = httpx.post(
        url,
        headers={**DB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=rows,
        timeout=15,
    )
    if res.status_code in (200, 201):
        print(f"[OK]   Upserted {len(rows)} rows → {TODAY}")
        return True
    else:
        print(f"[WARN] Upsert failed {res.status_code}: {res.text[:200]}")
        return False


# ── Data collectors ──────────────────────────────────────────────────────────

def snapshot_weather() -> list[dict]:
    try:
        res = httpx.get(
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={LAT}&longitude={LON}"
            "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode,precipitation"
            "&timezone=Europe%2FIstanbul",
            timeout=15,
        )
        c = res.json().get("current", {})
        rows = []
        mappings = [
            ("temperature_2m",        "temperature",  "°C",     "open-meteo"),
            ("relative_humidity_2m",  "humidity",     "%",      "open-meteo"),
            ("wind_speed_10m",        "wind_speed",   "km/h",   "open-meteo"),
            ("precipitation",         "precipitation","mm",     "open-meteo"),
            ("weathercode",           "weathercode",  "",       "open-meteo"),
        ]
        for api_key, snap_key, unit, src in mappings:
            val = c.get(api_key)
            if val is not None:
                rows.append(row("weather", snap_key, value_num=val, unit=unit, source=src))
        print(f"[INFO]  Weather: {len(rows)} metrics")
        return rows
    except Exception as e:
        print(f"[WARN] Weather failed: {e}")
        return []


def snapshot_air_quality() -> list[dict]:
    try:
        res = httpx.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={LAT}&longitude={LON}"
            "&current=pm10,pm2_5,nitrogen_dioxide,european_aqi"
            "&timezone=Europe%2FIstanbul",
            timeout=15,
        )
        c = res.json().get("current", {})
        rows = []
        mappings = [
            ("european_aqi",    "aqi",   "",          "open-meteo-aq"),
            ("pm2_5",           "pm25",  "μg/m³",     "open-meteo-aq"),
            ("pm10",            "pm10",  "μg/m³",     "open-meteo-aq"),
            ("nitrogen_dioxide","no2",   "μg/m³",     "open-meteo-aq"),
        ]
        for api_key, snap_key, unit, src in mappings:
            val = c.get(api_key)
            if val is not None:
                rows.append(row("environment", snap_key, value_num=val, unit=unit, source=src))
        print(f"[INFO]  Air quality: {len(rows)} metrics")
        return rows
    except Exception as e:
        print(f"[WARN] Air quality failed: {e}")
        return []


def snapshot_social() -> list[dict]:
    try:
        today_str = str(TODAY)
        res = httpx.get(
            f"{SUPABASE_URL}/rest/v1/social_posts"
            f"?select=sentiment&published_at=gte.{today_str}T00:00:00Z",
            headers=DB_HEADERS,
            timeout=15,
        )
        posts = res.json() if res.status_code == 200 else []
        total = len(posts)
        pos   = sum(1 for p in posts if p.get("sentiment") == "positive")
        neg   = sum(1 for p in posts if p.get("sentiment") == "negative")
        neu   = sum(1 for p in posts if p.get("sentiment") == "neutral")
        rows  = [
            row("social", "post_count",    total, unit="adet", source="db"),
            row("social", "post_positive", pos,   unit="adet", source="db"),
            row("social", "post_negative", neg,   unit="adet", source="db"),
            row("social", "post_neutral",  neu,   unit="adet", source="db"),
        ]
        if total > 0:
            rows.append(row("social", "positive_ratio",
                            round(pos / total * 100, 1), unit="%", source="db"))
        print(f"[INFO]  Social: {len(rows)} metrics (total posts today: {total})")
        return rows
    except Exception as e:
        print(f"[WARN] Social failed: {e}")
        return []


def snapshot_economy() -> list[dict]:
    """FX rates via open.er-api.com (free, no API key needed)."""
    try:
        res = httpx.get(
            "https://open.er-api.com/v6/latest/USD",
            timeout=15,
        )
        d = res.json()
        rates = d.get("rates", {})
        rows = []
        usd_try = rates.get("TRY")
        if usd_try:
            rows.append(row("economy", "usd_try", round(usd_try, 4), unit="₺", source="er-api"))
        # EUR/TRY = USD/TRY ÷ USD/EUR
        eur_usd = rates.get("EUR")
        if usd_try and eur_usd and eur_usd > 0:
            rows.append(row("economy", "eur_try",
                            round(usd_try / eur_usd, 4), unit="₺", source="er-api"))
        # Static / quarterly unemployment (TÜİK)
        rows.append(row("economy", "unemployment_rate", 11.2, unit="%", source="tuik-static"))
        print(f"[INFO]  Economy: {len(rows)} metrics (USD/TRY={usd_try})")
        return rows
    except Exception as e:
        print(f"[WARN] Economy failed: {e}")
        return []


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    ts = datetime.now(ISTANBUL).strftime("%H:%M")
    print(f"[START] Günlük snapshot — {TODAY} ({ts} Istanbul)")

    all_rows: list[dict] = []
    all_rows.extend(snapshot_weather())
    all_rows.extend(snapshot_air_quality())
    all_rows.extend(snapshot_social())
    all_rows.extend(snapshot_economy())

    print(f"[INFO]  Toplam {len(all_rows)} metrik toplandı")
    upsert_snapshots(all_rows)
    print("[DONE]  Snapshot tamamlandı")


if __name__ == "__main__":
    main()
