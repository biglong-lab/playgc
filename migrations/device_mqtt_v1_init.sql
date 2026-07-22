-- ============================================================================
-- MQTT v1 裝置整合 — 資料庫地基（ADR-0024 / MVP Step 2）
--
-- 只新增、不刪除任何既有欄位或表（遵守專案紅線：Schema 只加不刪）
--   1. arduino_devices：場域隔離(field_id)、裝置憑證(api_key)、佈署狀態、撤銷時間
--   2. shooting_records：event_id 去重鍵（MQTT QoS 1 一定會重送）
--   3. device_session_bindings：裝置↔場次租約(lease)，決定「這一擊算誰的」
--
-- 部署：psql $DATABASE_URL -f migrations/device_mqtt_v1_init.sql
-- 可重複執行（全部 IF NOT EXISTS）
-- ============================================================================

-- 1. arduino_devices 追加欄位（先 nullable，backfill 後由應用層強制）
ALTER TABLE "arduino_devices" ADD COLUMN IF NOT EXISTS "field_id" varchar;
ALTER TABLE "arduino_devices" ADD COLUMN IF NOT EXISTS "api_key" varchar(255);
ALTER TABLE "arduino_devices" ADD COLUMN IF NOT EXISTS "provision_status" varchar(20) DEFAULT 'unprovisioned';
ALTER TABLE "arduino_devices" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_arduino_devices_field" ON "arduino_devices" ("field_id");

-- 2. shooting_records 去重鍵（partial unique：舊資料 NULL 不受影響）
ALTER TABLE "shooting_records" ADD COLUMN IF NOT EXISTS "event_id" varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_shooting_records_event_id"
  ON "shooting_records" ("event_id") WHERE "event_id" IS NOT NULL;

-- 3. 裝置↔場次租約：命中歸屬的唯一真實來源（不信任設備自報 sessionId）
CREATE TABLE IF NOT EXISTS "device_session_bindings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar(50) NOT NULL,
	"field_id" varchar NOT NULL,
	"session_id" varchar,
	"page_id" varchar,
	"user_id" varchar,
	"team_id" varchar,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"leased_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"released_at" timestamp
);

-- 同一台設備同時只允許一個 active 租約 —— DB 層互斥，防兩場遊戲搶用同一靶
CREATE UNIQUE INDEX IF NOT EXISTS "idx_device_binding_active"
  ON "device_session_bindings" ("device_id") WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_device_binding_session" ON "device_session_bindings" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_device_binding_field" ON "device_session_bindings" ("field_id");
