# `districts` Şema Geçiş Planı

## Mevcut Production yapısı

Production'daki `public.districts` tablosu mevcut uygulama ile ilişkilidir:

- `id integer` — sequence ile üretiliyor
- `name varchar` — unique
- `lat numeric`
- `lng numeric`
- `monitor_data.district_name -> districts.name` foreign key'i mevcut

Tablo şu anda RLS açık ve public read policy ile korunuyor.

## Repository GIS modeli

Repository'deki GIS migration'ı farklı bir model bekliyor:

- `id text`
- `name text`
- `lat numeric`
- `lon numeric`
- PostGIS `geom` generated column
- `incidents.district_id -> districts.id` ilişkisi

Bu iki modeli doğrudan `ALTER TABLE` ile dönüştürmek güvenli değildir. Özellikle `id` tipinin integer'dan text'e çevrilmesi ve `monitor_data` foreign key'inin etkilenmesi veri/uyumluluk riski taşır.

## Önerilen güvenli geçiş

1. Mevcut `public.districts` ve `public.monitor_data` tablolarına dokunulmaz.
2. `postgis` extension'ı Production'da doğrulanır.
3. Yeni `public.districts_gis` tablosu oluşturulur:
   - `id text primary key`
   - `name text not null unique`
   - `lat numeric(9,6)`
   - `lon numeric(9,6)`
   - `population integer`
   - generated `geom geometry(Point,4326)`
4. 13 ilçe seed'i `id` olarak slug kullanılarak yüklenir.
5. Yeni `public.incidents` tablosu `districts_gis(id)` foreign key'i ile oluşturulur.
6. Realtime ve RLS yalnızca yeni GIS tablolarında açılır.
7. Uygulama endpoint'leri yeni tabloya geçirildikten sonra en az bir production gözlem döngüsü beklenir.
8. `monitor_data` ve eski `districts` tablosu geriye dönük uyumluluk için korunur.
9. Ayrı bir bakım penceresinde, kullanım metrikleri doğrulandıktan sonra eski tablo için kaldırma kararı alınır; otomatik silme yapılmaz.

## Geçiş öncesi zorunlu kontroller

- `monitor_data` içindeki tüm `district_name` değerlerinin `districts.name` ile eşleşmesi
- 13 ilçe için isim/slug mapping tablosu
- PostGIS extension ve Realtime publication durumu
- Frontend ve Edge Function sorgularının yeni tabloya yönlendirilmesi
- Backup ve rollback doğrulaması

Bu plan uygulanmadan mevcut `public.districts` tablosunda id veya kolon tipi dönüşümü yapılmamalıdır.
