-- ============================================================================
-- 隊伍徽章 table — Phase 11.1
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §9 §26.4
--
-- 部署：psql $DATABASE_URL -f migrations/squad_achievements_init.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS "squad_achievements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar NOT NULL,
	"achievement_key" varchar(50) NOT NULL,
	"category" varchar(30),
	"display_name" varchar(100),
	"description" varchar(200),
	"icon_url" varchar,
	"source_rule_id" varchar,
	"source_event_id" varchar,
	"awarded_by" varchar,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_squad_achievement" UNIQUE("squad_id","achievement_key")
);

CREATE INDEX IF NOT EXISTS "idx_squad_achievements"
  ON "squad_achievements" ("squad_id", "unlocked_at" DESC);

DO $$
BEGIN
  RAISE NOTICE '✅ squad_achievements 已建立';
END $$;
