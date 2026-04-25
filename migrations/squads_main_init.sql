-- ============================================================================
-- Squads 主表 + Squad Members — Phase 14
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §20.1 §20.2
--
-- 取代 4 種組隊類型（teams / battle_clans / battle_premade_groups / matches.team）
-- Phase 14 過渡期：新建走這張表，舊資料保留，Phase 15 真正遷移
--
-- 部署：psql $DATABASE_URL -f migrations/squads_main_init.sql
-- ============================================================================

-- 1. squads 主表
CREATE TABLE IF NOT EXISTS "squads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"tag" varchar(10) NOT NULL,
	"description" text,
	"emblem_url" varchar,
	"primary_color" varchar(7),
	"leader_id" varchar NOT NULL,
	"home_field_id" varchar,
	"is_public" boolean DEFAULT true NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"dissolved_at" timestamp,
	"name_changed_at" timestamp,
	CONSTRAINT "uq_squad_name" UNIQUE("name"),
	CONSTRAINT "uq_squad_tag" UNIQUE("tag")
);

CREATE INDEX IF NOT EXISTS "idx_squad_leader"
  ON "squads" ("leader_id");

CREATE INDEX IF NOT EXISTS "idx_squad_field"
  ON "squads" ("home_field_id");

CREATE INDEX IF NOT EXISTS "idx_squad_status"
  ON "squads" ("status");

-- 2. squad_members 成員表
CREATE TABLE IF NOT EXISTS "squad_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"join_source" varchar(20) DEFAULT 'self',
	"invite_id" varchar
);

CREATE INDEX IF NOT EXISTS "idx_member_squad"
  ON "squad_members" ("squad_id", "role");

CREATE INDEX IF NOT EXISTS "idx_member_user"
  ON "squad_members" ("user_id", "left_at");

DO $$
BEGIN
  RAISE NOTICE '✅ squads + squad_members 主表已建立';
  RAISE NOTICE '⚠️  Phase 14 過渡期：新隊走 squads 表，舊 battle_clans 仍保留';
END $$;
