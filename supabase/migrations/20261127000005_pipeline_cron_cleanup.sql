-- ═══════════════════════════════════════════════════════════════════════════
-- Muğla Monitör — Pipeline cron temizliği (P0)
--
-- Kaldırılan iş: 'muglamonitor-social-verifier'
--   Hedefi olan /functions/v1/social-verifier fonksiyonu DEPLOYE DEĞİL
--   (supabase/functions altında yok) → her 20 dakikada bir 404 üretiyordu.
--   Çapraz kaynak doğrulama (social_posts.verification_*) hiçbir iş tarafından
--   doldurulmuyor; toplama + duygu analizi zaten 15 dakikalık 'social-cron'
--   zincirinde yapılıyor. Bu nedenle mevcut sosyal/dürtü cronlarıyla gereksiz
--   çakışan bu iş kaldırıldı.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'muglamonitor-social-verifier';
  END IF;
END $$;
