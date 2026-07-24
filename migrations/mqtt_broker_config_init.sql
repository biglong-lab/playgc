-- ============================================================================
-- MQTT Broker 連線設定（ADR-0024）— 後台可自訂 broker，不必改 env
--
-- singleton 表（id='singleton'）；連線優先序：此表 enabled → env fallback
-- 只新增、不刪除（遵守專案紅線）
--
-- 部署：psql $DATABASE_URL -f migrations/mqtt_broker_config_init.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS "mqtt_broker_config" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"broker_url" text,
	"username" text,
	"password" text,
	"ca_cert" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by_admin_id" varchar
);

-- 確保 singleton 那筆存在
INSERT INTO "mqtt_broker_config" ("id", "enabled") VALUES ('singleton', false)
	ON CONFLICT ("id") DO NOTHING;
