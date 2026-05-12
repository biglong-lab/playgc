-- 🎚️ feature_flags — 元件遠端開關（Phase 4 / 2026-05-12）
--
-- 用途：admin 遠端關閉問題元件（不用 deploy）+ 自動降級
--
-- disabled_reason 列舉：
--   manual / auto:high_failure / auto:low_completion

CREATE TABLE IF NOT EXISTS feature_flags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scope VARCHAR(20) NOT NULL DEFAULT 'global',
  field_id VARCHAR(100),
  module_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_reason VARCHAR(50),
  disabled_at TIMESTAMP,
  disabled_by VARCHAR(100),
  metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_lookup
  ON feature_flags (scope, field_id, module_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_module
  ON feature_flags (module_key);

-- 同 scope+fieldId+module 只能 1 條（unique）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_feature_flags_scope_field_module
  ON feature_flags (scope, COALESCE(field_id, ''), module_key);
