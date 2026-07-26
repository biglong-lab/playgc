-- ============================================================================
-- MQTT 命中 HMAC 簽章 — arduino_devices 加 device_secret（ADR-0024 安全強化）
--
-- 用途：per-device HMAC 密鑰，設備對命中訊息簽章、server 驗簽才計分。
-- 即使用公用/無加密 broker，攻擊者沒有密鑰也無法偽造命中灌分。
-- 只新增、不刪除。部署：psql $DATABASE_URL -f migrations/device_secret_init.sql
-- ============================================================================
ALTER TABLE "arduino_devices" ADD COLUMN IF NOT EXISTS "device_secret" varchar(128);
