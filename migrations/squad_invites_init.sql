-- ============================================================================
-- 推廣連結追蹤 table — Phase 12.1
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.4 §20.7
--
-- 用途：
--   1. 超級隊長產生專屬推廣 token（URL: /invite/squad/:token）
--   2. 追蹤點擊數 / 轉換數 / 後續場次數
--   3. 一般隊伍也可使用（招募獎勵 1× ；超級隊長 2×）
--
-- 部署：psql $DATABASE_URL -f migrations/squad_invites_init.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS "squad_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"squad_id" varchar NOT NULL,
	"inviter_user_id" varchar NOT NULL,
	"invite_token" varchar(32) NOT NULL,
	"invitee_user_id" varchar,
	"joined_at" timestamp,
	"first_game_played_at" timestamp,
	"total_games_played" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"last_clicked_at" timestamp,
	"rewards_issued" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_squad_invite_token" UNIQUE("invite_token")
);

CREATE INDEX IF NOT EXISTS "idx_invites_inviter"
  ON "squad_invites" ("inviter_user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_invites_token"
  ON "squad_invites" ("invite_token");

CREATE INDEX IF NOT EXISTS "idx_invites_squad"
  ON "squad_invites" ("squad_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_invites_invitee"
  ON "squad_invites" ("invitee_user_id");

DO $$
BEGIN
  RAISE NOTICE '✅ squad_invites 已建立';
END $$;
