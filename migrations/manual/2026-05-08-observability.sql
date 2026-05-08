-- 🔭 Observability tables（Phase 0.2 / 2026-05-08）
-- 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §3.3
--
-- 用途：
--   - ws_event_log: WS 事件完整紀錄（連線/斷線/訊息/廣播/grace 等）
--   - db_write_log: 多人遊戲關鍵 DB 寫入紀錄（含樂觀鎖衝突）
--
-- Retention: 90 天（user 決定、爭議仲裁長期需求）
-- 後續優化方向：PostgreSQL declarative partitioning by day
--
-- 部署步驟：
--   1. 確認連線到正確 DB（dev / prod 都需要）
--   2. psql ... -f migrations/manual/2026-05-08-observability.sql
--   3. 確認 cleanup cron 已設（server/index.ts 啟動時自動排程）
--

-- ===== ws_event_log =====
CREATE TABLE IF NOT EXISTS ws_event_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  session_id VARCHAR(100),
  team_id VARCHAR(100),
  user_id VARCHAR(100),
  user_name VARCHAR(200),
  event_type VARCHAR(30) NOT NULL,
  direction VARCHAR(10),
  message_type VARCHAR(50),
  payload JSONB,
  client_ip VARCHAR(50),
  user_agent VARCHAR(500),
  close_code INTEGER,
  reason VARCHAR(200),
  latency_ms INTEGER,
  recipient_count INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ws_event_session_time ON ws_event_log (session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ws_event_team_time    ON ws_event_log (team_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ws_event_user_time    ON ws_event_log (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ws_event_type_time    ON ws_event_log (event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_ws_event_cleanup      ON ws_event_log (timestamp);

-- ===== db_write_log =====
CREATE TABLE IF NOT EXISTS db_write_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL,
  primary_key VARCHAR(200),
  session_id VARCHAR(100),
  team_id VARCHAR(100),
  user_id VARCHAR(100),
  before JSONB,
  after JSONB,
  conflict_type VARCHAR(50),
  retry_succeeded BOOLEAN,
  triggered_by VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_db_write_session_time  ON db_write_log (session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_db_write_team_time     ON db_write_log (team_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_db_write_table_time    ON db_write_log (table_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_db_write_conflict_time ON db_write_log (conflict_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_db_write_cleanup       ON db_write_log (timestamp);

-- ===== Retention cleanup function（90 天）=====
-- 由 server cron 每天 03:00 呼叫（server/lib/observability-cleanup.ts）
-- 也可手動跑：SELECT cleanup_observability_logs(90);
CREATE OR REPLACE FUNCTION cleanup_observability_logs(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(table_name TEXT, deleted_count BIGINT) AS $$
DECLARE
  ws_deleted BIGINT;
  db_deleted BIGINT;
BEGIN
  DELETE FROM ws_event_log
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS ws_deleted = ROW_COUNT;

  DELETE FROM db_write_log
  WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS db_deleted = ROW_COUNT;

  RETURN QUERY VALUES
    ('ws_event_log'::TEXT, ws_deleted),
    ('db_write_log'::TEXT, db_deleted);
END;
$$ LANGUAGE plpgsql;
