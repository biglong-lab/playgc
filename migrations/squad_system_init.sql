-- ============================================================================
-- Squad 系統初始化 migration
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §20
-- 部署時執行：psql $DATABASE_URL -f migrations/squad_system_init.sql
-- ============================================================================

-- 1. squad_match_records — 每場戰績紀錄
CREATE TABLE IF NOT EXISTS "squad_match_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar NOT NULL,
	"squad_type" varchar(20) NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"game_id" varchar,
	"slot_id" varchar,
	"match_id" varchar,
	"session_id" varchar,
	"field_id" varchar NOT NULL,
	"result" varchar(20) NOT NULL,
	"rating_before" integer,
	"rating_after" integer,
	"rating_change" integer DEFAULT 0,
	"exp_points" integer DEFAULT 0,
	"game_count_multiplier" integer DEFAULT 100,
	"performance" jsonb DEFAULT '{}'::jsonb,
	"is_cross_field" boolean DEFAULT false,
	"is_first_visit" boolean DEFAULT false,
	"played_at" timestamp DEFAULT now() NOT NULL,
	"duration_sec" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_squad_records_squad_played"
  ON "squad_match_records" ("squad_id", "played_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_squad_records_game_type"
  ON "squad_match_records" ("game_type");
CREATE INDEX IF NOT EXISTS "idx_squad_records_field"
  ON "squad_match_records" ("field_id", "played_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_squad_records_session"
  ON "squad_match_records" ("session_id");


-- 2. squad_ratings — 各遊戲類型獨立 rating
CREATE TABLE IF NOT EXISTS "squad_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar NOT NULL,
	"squad_type" varchar(20) NOT NULL,
	"game_type" varchar(50) NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"tier" varchar(20) DEFAULT 'silver',
	"win_streak" integer DEFAULT 0,
	"best_win_streak" integer DEFAULT 0,
	"peak_rating" integer DEFAULT 1200,
	"last_played_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_squad_rating_per_game" UNIQUE("squad_id","game_type")
);

CREATE INDEX IF NOT EXISTS "idx_squad_rating_lookup"
  ON "squad_ratings" ("game_type", "rating" DESC);


-- 3. squad_stats — 聚合戰績
CREATE TABLE IF NOT EXISTS "squad_stats" (
	"squad_id" varchar PRIMARY KEY,
	"squad_type" varchar(20) NOT NULL,
	"total_games" integer DEFAULT 0 NOT NULL,
	"total_games_raw" integer DEFAULT 0 NOT NULL,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"total_losses" integer DEFAULT 0 NOT NULL,
	"total_draws" integer DEFAULT 0 NOT NULL,
	"total_exp_points" integer DEFAULT 0 NOT NULL,
	"fields_played" jsonb DEFAULT '[]'::jsonb,
	"recruits_count" integer DEFAULT 0 NOT NULL,
	"monthly_games" integer DEFAULT 0,
	"monthly_recruits" integer DEFAULT 0,
	"super_leader_tier" varchar(20),
	"squad_status" varchar(20) DEFAULT 'active',
	"first_active_at" timestamp,
	"last_active_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_squad_stats_total_games"
  ON "squad_stats" ("total_games" DESC);
CREATE INDEX IF NOT EXISTS "idx_squad_stats_monthly"
  ON "squad_stats" ("monthly_games" DESC);
CREATE INDEX IF NOT EXISTS "idx_squad_stats_status"
  ON "squad_stats" ("squad_status");


-- ============================================================================
-- 獎勵轉換節點 — 6 個 tables（rewards.ts 對應）
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26
-- ============================================================================

-- 4. reward_conversion_rules — 規則
CREATE TABLE IF NOT EXISTS "reward_conversion_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"field_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"triggers" jsonb NOT NULL,
	"rewards" jsonb NOT NULL,
	"quota" jsonb DEFAULT '{}'::jsonb,
	"priority" integer DEFAULT 0,
	"hits_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"valid_until" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_rules_active"
  ON "reward_conversion_rules" ("is_active", "field_id", "priority");


-- 5. reward_conversion_events — 事件流
CREATE TABLE IF NOT EXISTS "reward_conversion_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" varchar NOT NULL,
	"squad_id" varchar,
	"user_id" varchar,
	"event_payload" jsonb NOT NULL,
	"rules_evaluated" jsonb DEFAULT '[]'::jsonb,
	"rewards_issued" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'processed' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_events_source"
  ON "reward_conversion_events" ("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "idx_events_squad"
  ON "reward_conversion_events" ("squad_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_events_status"
  ON "reward_conversion_events" ("status");


-- 6. coupon_templates — 平台券模板
CREATE TABLE IF NOT EXISTS "coupon_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"discount_type" varchar(20) NOT NULL,
	"discount_value" integer,
	"min_purchase" integer DEFAULT 0,
	"applicable_scope" jsonb DEFAULT '{}'::jsonb,
	"validity_days" integer DEFAULT 30,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);


-- 7. platform_coupons — 平台券（已發行）
CREATE TABLE IF NOT EXISTS "platform_coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL UNIQUE,
	"template_id" varchar NOT NULL,
	"issued_to_squad_id" varchar,
	"issued_to_user_id" varchar,
	"status" varchar(20) DEFAULT 'unused' NOT NULL,
	"source_event_id" varchar,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"used_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"redemption_context" jsonb
);

CREATE INDEX IF NOT EXISTS "idx_coupons_user"
  ON "platform_coupons" ("issued_to_user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_coupons_squad"
  ON "platform_coupons" ("issued_to_squad_id", "status");
CREATE INDEX IF NOT EXISTS "idx_coupons_status_expires"
  ON "platform_coupons" ("status", "expires_at");


-- 8. external_reward_integrations — 外部對接設定（aihomi 等）
CREATE TABLE IF NOT EXISTS "external_reward_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(50) NOT NULL UNIQUE,
	"display_name" varchar(100) NOT NULL,
	"api_endpoint" varchar(500),
	"api_credentials_encrypted" text,
	"webhook_secret" varchar(100),
	"is_active" boolean DEFAULT false NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);


-- 9. squad_external_rewards — 外部獎勵紀錄
CREATE TABLE IF NOT EXISTS "squad_external_rewards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar,
	"user_id" varchar,
	"provider" varchar(50) NOT NULL,
	"external_coupon_code" varchar(100),
	"external_coupon_url" varchar(500),
	"display_name" varchar(200),
	"value_description" varchar(200),
	"merchant_name" varchar(100),
	"merchant_address" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"source_event_id" varchar,
	"request_id" varchar,
	"issued_at" timestamp,
	"redeemed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ext_rewards_user"
  ON "squad_external_rewards" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_ext_rewards_request"
  ON "squad_external_rewards" ("request_id");
CREATE INDEX IF NOT EXISTS "idx_ext_rewards_provider"
  ON "squad_external_rewards" ("provider", "status");


-- ============================================================================
-- 部署指令：psql $DATABASE_URL -f migrations/squad_system_init.sql
-- ============================================================================
-- ✅ 安全部署：本 migration 不修改任何既有 table
-- ✅ IF NOT EXISTS：可重複執行不會出錯
-- ✅ 索引使用 btree 預設策略，即時投產
-- ✅ aihomi integration 預設 is_active = false（要 admin 手動啟用）
