-- ============================================================================
-- 安全審計強化（Pre-launch hardening）— Phase 20
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md / 審計報告
--
-- 修復項目：
--   C1. team_vote_ballots: 加 UNIQUE(vote_id, user_id) 防重複投票
--   C2. squad_match_records: 加冪等 unique index 防重發灌分
--   C5. 5 個關鍵 FK index（DELETE cascade 性能）
--   C4. idle_in_transaction_session_timeout（防 zombie 連線）
--
-- 部署：psql $DATABASE_URL -f migrations/security_audit_hardening.sql
-- 全部 idempotent（IF NOT EXISTS / DO blocks），可重複執行
-- ============================================================================

-- ============================================================================
-- C1. 防止重複投票（race condition fix）
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_vote_ballot_user'
  ) THEN
    ALTER TABLE team_vote_ballots
      ADD CONSTRAINT uq_vote_ballot_user UNIQUE(vote_id, user_id);
    RAISE NOTICE '✅ C1: team_vote_ballots UNIQUE(vote_id, user_id) 已加';
  END IF;
END $$;

-- ============================================================================
-- C2. squad_match_records 冪等鍵（防 retry / cluster 重發灌分）
-- ============================================================================
-- 一般遊戲：sessionId + squadId 唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_record_session
  ON squad_match_records (session_id, squad_id)
  WHERE session_id IS NOT NULL;

-- 水彈對戰：slotId + squadId 唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_record_slot
  ON squad_match_records (slot_id, squad_id)
  WHERE slot_id IS NOT NULL;

-- 競技 match：matchId + squadId 唯一
CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_record_match
  ON squad_match_records (match_id, squad_id)
  WHERE match_id IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ C2: squad_match_records 三個冪等 unique index 已加';
END $$;

-- ============================================================================
-- C5. 關鍵 FK 缺 index（DELETE cascade / 場域刪除性能）
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_games_creator
  ON games (creator_id);

CREATE INDEX IF NOT EXISTS idx_games_field_id
  ON games (field_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_game
  ON game_sessions (game_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON chat_messages (user_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_session
  ON leaderboard (session_id);

-- 額外幾個常用查詢（高度 benefit）
CREATE INDEX IF NOT EXISTS idx_battle_results_mvp
  ON battle_results (mvp_user_id)
  WHERE mvp_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_leader
  ON teams (leader_id);

DO $$
BEGIN
  RAISE NOTICE '✅ C5: 7 個關鍵 FK index 已加';
END $$;

-- ============================================================================
-- C4. PG 連線管理 — 注意：ALTER SYSTEM 不能在 transaction 內執行
-- 請另外用以下命令套用（不在本 migration 內）：
--   docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -X -c \
--     "ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s'"
--   docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -X -c \
--     "ALTER SYSTEM SET statement_timeout = '30s'"
--   docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -X -c \
--     "SELECT pg_reload_conf();"
-- ============================================================================

-- ============================================================================
-- M2. squads name uniqueness：跨場域不該 unique（賈村 vs 后浦 同名應允許）
-- 但 tag 可以全平台 unique（短碼較少，要避免衝突）
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_squad_name'
  ) THEN
    ALTER TABLE squads DROP CONSTRAINT uq_squad_name;
    -- 改成 (home_field_id, name) 才 unique
    -- 用 partial unique index 避免 NULL home_field_id 卡住
    CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_name_per_field
      ON squads (home_field_id, name)
      WHERE home_field_id IS NOT NULL;
    -- 跨平台型（無 home_field）才用全域 unique
    CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_name_platform
      ON squads (name)
      WHERE home_field_id IS NULL;
    RAISE NOTICE '✅ M2: squads.name 改成場域內 unique';
  END IF;
END $$;

-- ============================================================================
-- 完成
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════';
  RAISE NOTICE '✅ Pre-launch security hardening 完成';
  RAISE NOTICE '════════════════════════════════════════════';
END $$;
