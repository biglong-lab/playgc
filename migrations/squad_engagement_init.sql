-- ============================================================================
-- 場域行銷與留存設定 — 3 個 tables
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13 §14 §16 §18
--
-- 部署：psql $DATABASE_URL -f migrations/squad_engagement_init.sql
-- 安全：IF NOT EXISTS（重跑不會出錯）
-- ============================================================================

-- 1. field_engagement_settings — 場域行銷設定（每場域一筆）
CREATE TABLE IF NOT EXISTS "field_engagement_settings" (
	"field_id" varchar PRIMARY KEY,

	-- 超級隊長條件
	"super_leader_min_games" integer DEFAULT 100,
	"super_leader_min_recruits" integer DEFAULT 10,
	"super_leader_min_fields" integer DEFAULT 2,
	"super_leader_min_win_rate" integer DEFAULT 50,
	"super_leader_auto_enabled" boolean DEFAULT true,
	"super_leader_manual_ids" jsonb DEFAULT '[]'::jsonb,

	-- 歡迎隊伍設定
	"welcome_mode" varchar(20) DEFAULT 'auto' NOT NULL,
	"welcome_auto_top_n" integer DEFAULT 5,
	"welcome_auto_criteria" varchar(30) DEFAULT 'total_games',
	"welcome_manual_ids" jsonb DEFAULT '[]'::jsonb,

	-- 通知設定
	"notification_channels" jsonb DEFAULT '["in_app"]'::jsonb,
	"notify_on_first_game" boolean DEFAULT true,
	"notify_on_rank_change" boolean DEFAULT true,
	"notify_on_reward_issued" boolean DEFAULT true,
	"notify_on_tier_upgrade" boolean DEFAULT true,
	"notify_on_dormancy_warning" boolean DEFAULT true,
	"notification_cooldown_hours" integer DEFAULT 24,

	-- 休眠規則
	"dormancy_days_threshold" integer DEFAULT 30,
	"dormancy_warning_days" jsonb DEFAULT '[3, 7, 14]'::jsonb,

	-- 升級門檻
	"tier_games_thresholds" jsonb DEFAULT '{"newbie": 1, "active": 10, "veteran": 50, "legend": 100}'::jsonb,

	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);


-- 2. notification_channels — 多管道設定
CREATE TABLE IF NOT EXISTS "notification_channels" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" varchar NOT NULL,
	"channel_type" varchar(30) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"config" jsonb NOT NULL,

	"sent_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"last_sent_at" timestamp,
	"last_error_message" text,

	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notify_field_active"
  ON "notification_channels" ("field_id", "is_active");


-- 3. notification_events — 已發通知紀錄
CREATE TABLE IF NOT EXISTS "notification_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" varchar,
	"squad_id" varchar,
	"user_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"channel_type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"error_message" text,
	"dedupe_key" varchar(200),
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notify_dedupe"
  ON "notification_events" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "idx_notify_event_user"
  ON "notification_events" ("event_type", "user_id", "sent_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_notify_squad"
  ON "notification_events" ("squad_id", "created_at" DESC);


-- ============================================================================
-- 預設設定 seed（為「賈村」與「後浦」場域建預設設定）
-- ============================================================================
INSERT INTO field_engagement_settings (field_id)
SELECT 'jiachun' WHERE NOT EXISTS (
  SELECT 1 FROM field_engagement_settings WHERE field_id = 'jiachun'
);

INSERT INTO field_engagement_settings (field_id)
SELECT 'hpspace' WHERE NOT EXISTS (
  SELECT 1 FROM field_engagement_settings WHERE field_id = 'hpspace'
);

-- ============================================================================
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM field_engagement_settings;
  RAISE NOTICE '✅ Engagement schema 完成：% 個場域已建立預設設定', cnt;
END $$;
