-- 🔍 synthetic_runs — 合成監測紀錄（Phase 5 / 2026-05-12）

CREATE TABLE IF NOT EXISTS synthetic_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_at TIMESTAMP DEFAULT NOW() NOT NULL,
  total_checks INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  avg_response_ms INTEGER,
  results JSONB,
  alert_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_synthetic_runs_time ON synthetic_runs (run_at);
CREATE INDEX IF NOT EXISTS idx_synthetic_runs_failed ON synthetic_runs (failed, run_at);
