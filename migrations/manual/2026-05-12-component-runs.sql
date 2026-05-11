-- 📊 component_runs — 元件健康度紀錄（Phase 1 / 2026-05-12）
--
-- 用途：每個元件 mount → 完成 / 失敗全紀錄
--   - 業主問「某元件 7 天表現？」→ 量化回答
--   - 找失敗率高的元件、建議重構優先級
--   - 平均互動延遲、loading perf
--
-- finalState 列舉：completed / abandoned / errored / timeout / skipped
-- mounted_at 索引給 90 天 retention cleanup 用

CREATE TABLE IF NOT EXISTS component_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id VARCHAR(100),
  user_id VARCHAR(100),
  team_id VARCHAR(100),
  page_id VARCHAR(100),
  component_type VARCHAR(50) NOT NULL,

  mounted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  first_interaction_at TIMESTAMP,
  completed_at TIMESTAMP,

  final_state VARCHAR(20),
  duration_ms INTEGER,
  interaction_latency_ms INTEGER,

  retry_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  network_error_count INTEGER DEFAULT 0,

  last_error TEXT,

  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_component_runs_session
  ON component_runs (session_id, mounted_at);
CREATE INDEX IF NOT EXISTS idx_component_runs_type_time
  ON component_runs (component_type, mounted_at);
CREATE INDEX IF NOT EXISTS idx_component_runs_user_time
  ON component_runs (user_id, mounted_at);
CREATE INDEX IF NOT EXISTS idx_component_runs_state
  ON component_runs (final_state, mounted_at);
CREATE INDEX IF NOT EXISTS idx_component_runs_cleanup
  ON component_runs (mounted_at);
