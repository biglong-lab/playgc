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


-- ✅ 安全部署：本 migration 不修改任何既有 table
-- ✅ IF NOT EXISTS：可重複執行不會出錯
-- ✅ 索引使用 btree 預設策略，即時投產
