-- ============================================================================
-- 隊名改名歷史 + 冷卻 — Phase 12.5
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §17.3 §17.4
--
-- 規則：
--   1. 建立後 7 天內可改 1 次（防錯字）
--   2. 之後每次改名間隔 30 天
--   3. 改名歷史保留（避免鑽漏洞）
--   4. 解散後鎖名 180 天
--
-- 部署：psql $DATABASE_URL -f migrations/squad_rename_history.sql
-- ============================================================================

-- 1. battle_clans 加 name_changed_at 欄位
ALTER TABLE "battle_clans"
  ADD COLUMN IF NOT EXISTS "name_changed_at" timestamp;

-- 2. 改名歷史表（只記錄成功改名）
CREATE TABLE IF NOT EXISTS "squad_name_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar NOT NULL,
	"old_name" varchar(50) NOT NULL,
	"new_name" varchar(50) NOT NULL,
	"old_tag" varchar(10),
	"new_tag" varchar(10),
	"changed_by_user_id" varchar NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"reason" varchar(200)
);

CREATE INDEX IF NOT EXISTS "idx_name_history_squad"
  ON "squad_name_history" ("squad_id", "changed_at" DESC);

-- 3. 解散後鎖名表（隊名鎖 180 天）
CREATE TABLE IF NOT EXISTS "squad_name_locks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"tag" varchar(10),
	"field_id" varchar,
	"locked_until" timestamp NOT NULL,
	"reason" varchar(50) DEFAULT 'dissolved',
	"original_squad_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_name_locks_name"
  ON "squad_name_locks" ("name", "locked_until");

CREATE INDEX IF NOT EXISTS "idx_name_locks_field"
  ON "squad_name_locks" ("field_id");

DO $$
BEGIN
  RAISE NOTICE '✅ squad_name_history + squad_name_locks 已建立';
  RAISE NOTICE '✅ battle_clans.name_changed_at 已加入';
END $$;
