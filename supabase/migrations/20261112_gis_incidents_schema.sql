-- supabase/migrations/20261112_gis_incidents_schema.sql
-- Muğla Monitör v2: 13 İlçe PostGIS Veritabanı ve Olay Akış Şeması

-- 1. PostGIS Eklentisi (Coğrafi Fonksiyonlar ve Geometri Desteği)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. 13 İlçe Resmi Referans Tablosu
CREATE TABLE IF NOT EXISTS public.districts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lat NUMERIC(9,6) NOT NULL,
    lon NUMERIC(9,6) NOT NULL,
    population INTEGER,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED
);

-- 3. Olaylar, İhbarlar ve İstihbarat Akış Tablosu
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id TEXT REFERENCES public.districts(id) ON DELETE SET NULL,
    district_name TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Yangın/Afet', 'Trafik', 'Altyapı/Su', 'Asayiş', 'Turizm/Çevre', 'Genel')),
    severity TEXT NOT NULL CHECK (severity IN ('Düşük', 'Orta', 'Yüksek', 'Kritik')),
    event_date TIMESTAMPTZ DEFAULT NOW(),
    lat NUMERIC(9,6) NOT NULL,
    lon NUMERIC(9,6) NOT NULL,
    geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED,
    raw_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mekansal ve Zamansal İndeksler (Yüksek Performanslı CBS Sorguları İçin)
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON public.incidents USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_districts_geom ON public.districts USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_incidents_district ON public.incidents(district_id);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON public.incidents(category);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON public.incidents(event_date DESC);

-- 4. 13 İlçe Resmi Veri Tohumlama (Seed)
INSERT INTO public.districts (id, name, lat, lon, population) VALUES
('mentese',     'Menteşe',     37.2153, 28.3636, 123284),
('bodrum',      'Bodrum',      37.0344, 27.4305, 198335),
('fethiye',     'Fethiye',     36.6548, 29.1165, 181415),
('marmaris',    'Marmaris',    36.8521, 28.2706, 97818),
('milas',       'Milas',       37.3166, 27.7869, 151590),
('dalaman',     'Dalaman',     36.7752, 28.7929, 49012),
('ortaca',      'Ortaca',      36.8344, 28.7682, 55437),
('koycegiz',    'Köyceğiz',    36.9705, 28.6854, 40167),
('datca',       'Datça',       36.7344, 27.6866, 25741),
('ula',         'Ula',         37.1035, 28.4266, 27537),
('yatagan',     'Yatağan',     37.3396, 28.1376, 45283),
('seydikemer',  'Seydikemer',  36.9183, 29.1286, 63870),
('kavaklidere', 'Kavaklıdere', 37.4460, 28.3904, 10738)
ON CONFLICT (id) DO UPDATE SET
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  population = EXCLUDED.population;

-- 5. Realtime Yayın İzni ve Satır Düzeyi Güvenlik (RLS)
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Incidents" ON public.incidents FOR SELECT USING (true);
CREATE POLICY "Public Insert Incidents" ON public.incidents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Read Districts" ON public.districts FOR SELECT USING (true);
