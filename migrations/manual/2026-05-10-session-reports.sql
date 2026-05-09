-- 📊 session_reports — 活動結束自動報告（Phase 3 / 2026-05-10）
--
-- 用途：每場 multi session 結束自動產一份報告
--   - WS 健康度（reconnect / grace / auto_leave / 平均延遲）
--   - 業務指標（完成率、合照率、答對率）
--   - 跟前 5 場對比、算 anomaly score
--   - Telegram 推給業主、admin UI 看歷史
--
-- 配套：
--   - server/lib/generateSessionReport.ts — 撈資料 + 算指標
--   - GET /api/admin/reports — 列表
--   - GET /api/admin/reports/:sessionId — 詳情
--   - session 結束 webhook + 每日 cron 補跑

CREATE TABLE IF NOT EXISTS session_reports (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id VARCHAR(100) NOT NULL,
  game_id VARCHAR(100),
  field_id VARCHAR(100),

  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_ms INTEGER,

  total_players INTEGER DEFAULT 0,
  completed_players INTEGER DEFAULT 0,

  ws_connects INTEGER DEFAULT 0,
  ws_closes INTEGER DEFAULT 0,
  ws_config_change_closes INTEGER DEFAULT 0,
  ws_abnormal_closes INTEGER DEFAULT 0,
  grace_start_count INTEGER DEFAULT 0,
  grace_expired_count INTEGER DEFAULT 0,
  auto_leave_count INTEGER DEFAULT 0,
  avg_ws_latency_ms INTEGER,

  completion_rate INTEGER,
  trivia_answer_count INTEGER DEFAULT 0,
  trivia_correct_rate INTEGER,
  photo_team_completed_count INTEGER DEFAULT 0,

  anomaly_score INTEGER DEFAULT 0,
  anomalies JSONB,

  baseline_snapshot JSONB,

  telegram_sent BOOLEAN DEFAULT FALSE,
  telegram_sent_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_reports_session
  ON session_reports (session_id);
CREATE INDEX IF NOT EXISTS idx_session_reports_created
  ON session_reports (created_at);
CREATE INDEX IF NOT EXISTS idx_session_reports_anomaly
  ON session_reports (anomaly_score, created_at);

-- 同 session 只能有 1 份報告（避免重複觸發）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_reports_session_id
  ON session_reports (session_id);
