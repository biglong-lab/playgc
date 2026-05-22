-- 🎯 多元定位驗證系統（Phase 1 / 2026-05-22）
--
-- 用途：GPS 失效時提供 QR、代碼、PDR、AR、Admin 救援等備援驗證方式
-- 相關文件：docs/changes/2026-05-22-multi-tier-location-verification.md
-- 相關 ADR：docs/decisions/0021-multi-tier-location-verification.md
--
-- ⚠️ 紅線：只新增欄位，不刪不改既有資料（生產資料保護）

-- ============================================================================
-- locations 表 — 新增驗證設定欄位
-- ============================================================================

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS verification_mode VARCHAR(20) DEFAULT 'gps';
-- 值：'gps' | 'qr' | 'code' | 'hybrid' | 'any'
-- gps  = 只能 GPS（向後相容預設）
-- qr   = 只能掃 QR
-- code = 只能輸入代碼
-- hybrid = GPS + (QR 或代碼) 擇一
-- any  = 三種都可（最寬鬆，建議學校場域用）

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10);
-- 4-6 位短碼（admin 自訂或自動生成，玩家手動輸入）

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64);
-- QR 內嵌 token（HMAC 簽章，防偽造）

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS allow_admin_rescue BOOLEAN DEFAULT true;
-- 是否允許管理員手動標記到達

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS reference_image_hash VARCHAR(16);
-- AR 比對：參考照片 dHash（Phase 3）

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT;
-- AR 比對：參考照片 URL（admin 預覽用）

-- ============================================================================
-- location_visits 表 — 紀錄使用哪種驗證方式
-- ============================================================================

ALTER TABLE location_visits
  ADD COLUMN IF NOT EXISTS verify_method VARCHAR(20) DEFAULT 'gps';
-- 值：'gps' | 'qr' | 'code' | 'pdr' | 'ar' | 'admin'

ALTER TABLE location_visits
  ADD COLUMN IF NOT EXISTS verify_metadata JSONB;
-- 對應方式的詳細資料：
--   gps    -> { lat, lng, accuracy, distance }
--   qr     -> { tokenHash, scanTime }
--   code   -> { codeInput, attemptCount }
--   pdr    -> { startLat, startLng, stepsSinceReset }
--   ar     -> { matchScore, referenceImageId }
--   admin  -> { adminUserId, reason, timestamp }

-- ============================================================================
-- 索引（可選但建議）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_locations_verification_mode
  ON locations(verification_mode);

CREATE INDEX IF NOT EXISTS idx_location_visits_verify_method
  ON location_visits(verify_method);
