# 🌐 Muğla Monitor — Entegrasyon ve Canlıya Geçiş Kılavuzu

Bu kılavuz, **Muğla Monitor** projesinin Google AI Studio ortamındaki son durumunun mevcut GitHub deponuz (`https://github.com/gokhanyoldas/muglamonitor`) ile nasıl senkronize edileceğini ve Supabase bağlantısının nasıl sürdürülebilir hale getirileceğini adım adım açıklar.

---

## 1. Supabase Bağlantı Kontrolü ve Sağlık Durumu

### Mevcut Konfigürasyon
Projenin veritabanı bağlantı ayarları tam uyumludur:
* **Supabase Project ID:** `wivooargsmcwbiokpklu` (Gökhan Yoldaş adına kayıtlı proje)
* **Yerel Konfigürasyon:** `/supabase/config.toml` içinde `project_id = "wivooargsmcwbiokpklu"` tanımlıdır.
* **Frontend İstemcisi:** `/src/integrations/supabase/client.ts` dosyası, otomatik yedek (fallback) olarak `https://wivooargsmcwbiokpklu.supabase.co` adresini ve anon anahtarını kullanır.

### Supabase Auto-Pause Engelleyici (Uptime Servisi) Kurulumu
Ücretsiz Supabase planları 7 gün boyunca istek almazsa otomatik olarak durdurulur (Paused). Proje veri akışının kesilmemesi için şu adımları takip ederek ücretsiz bir UptimeRobot hesabı kurabilirsiniz:

1. [UptimeRobot.com](https://uptimerobot.com/) adresine gidin ve ücretsiz üye olun.
2. **Add New Monitor** seçeneğine tıklayın.
3. Ayarları şu şekilde tanımlayın:
   * **Monitor Type:** `HTTP(s)`
   * **Friendly Name:** `Mugla Monitor Supabase API`
   * **URL (or IP):** `https://wivooargsmcwbiokpklu.supabase.co/rest/v1/`
   * **Monitoring Interval:** `5 minutes` (veritabanını uyanık tutmaya yeterlidir)
4. Monitörü kaydedin. Artık Supabase projeniz otomatik olarak uyanık kalacaktır.

---

## 2. Mevcut GitHub Deposu (`muglamonitor`) ile Senkronizasyon Akışı

Google AI Studio arayüzündeki **GitHub** sekmesi varsayılan olarak hesabınızda **yeni bir repository** oluşturmayı hedefler. Sizin durumunuzda, mevcut olan `gokhanyoldas/muglamonitor` deposuna doğrudan yazmak istediğimiz için en temiz ve güvenli 2 yöntem aşağıda sunulmuştur:

### 💡 Yöntem A: Arayüzden Yeni Bir Geçici Depoya Push edip Localde Birleştirmek (En Hızlı Çözüm)
1. AI Studio'da sağ üst paneldeki **Publish > GitHub** sekmesinden yeni bir geçici depo oluşturun (Örn: `mugla-monitor-temp`).
2. Bu işlem tamamlandığında en son sandbox kodlarınız GitHub hesabınıza yüklenmiş olacaktır.
3. Kendi bilgisayarınızda (local) terminali açıp kodları ana deponuzla birleştirmek için şu komutları sırasıyla çalıştırın:
   ```bash
   # Ana deponuzu klonlayın (klonlanmadıysa)
   git clone https://github.com/gokhanyoldas/muglamonitor.git
   cd muglamonitor

   # Geçici depoyu remote olarak ekleyin
   git remote add temp-repo https://github.com/gokhanyoldas/mugla-monitor-temp.git
   git fetch temp-repo

   # Geçici depodaki güncel kodları (örn: main branch) mevcut deponuza birleştirin
   git merge temp-repo/main --allow-unrelated-histories -m "Merge AI Studio updates"
   
   # Deşiklikleri ana deponuza geri gönderin
   git push origin main

   # Geçici depoyu artık silebilirsiniz
   git remote remove temp-repo
   ```

### 💡 Yöntem B: Projeyi ZIP Olarak İndirip Mevcut Depoya Yazmak (Garantili Çözüm)
1. AI Studio arayüzünde, sol alt köşedeki Ayarlar veya projenin sağ üst menüsünden **"Export as ZIP"** seçeneğini kullanın.
2. Bilgisayarınızda mevcut `muglamonitor` klasörünün içini açın.
3. İndirdiğiniz ZIP dosyasının içeriğini bu klasöre çıkartarak üzerine yazın (Sadece `.git` klasörünün silinmediğinden emin olun).
4. Terminalinizde şu komutları çalıştırarak değişiklikleri ana deponuza gönderin:
   ```bash
   # Değişiklikleri Git alanına ekleyin
   git add .

   # Commit oluşturun
   git commit -m "style(sync): sync latest modifications from AI Studio"

   # GitHub'a gönderin
   git push origin main
   ```

---

## 3. Kod Durumu Değerlendirmesi

Uygulamada yapılan incelemelere göre:
* **Canlı Veri Takip Modülleri:** Hava Durumu (Open-Meteo), Deprem Verileri (USGS), Uçuş Takibi (ADSB) ve Döviz Göstergeleri (Frankfurter) doğrudan canlı API'ler ile besleniyor ve hatasız render ediliyor.
* **Mock Veriler:** Ekonomi bütçe tabloları, turizm doluluğu gibi alanlar şimdilik statik mock veri formatındadır. Canlıya geçiş sonrası gerçek API ile entegrasyonu için yapı hazırdır.
* **Sentry Hata İzleme:** Önceki adımda yaptığımız güncelleme ile Sentry kütüphanesinin çalışma zamanında beyaz ekrana sebep olması (çevrimdışı ya da yükleme hatası durumunda) engellenmiş, sistem Mock Sentry yapısına geçerek kararlı çalışır hale getirilmiştir.
