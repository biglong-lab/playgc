-- ============================================================================
-- 規則 A/B Testing — Phase 16.6
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26 商業閉環進階
--
-- 規則加 ab_test_group + ab_test_traffic 欄位
--   - ab_test_group: 'A' / 'B' / null（不參與測試）
--   - ab_test_traffic: 0-100 整數，% 流量（0 = 關閉，100 = 全量）
--
-- 部署：psql $DATABASE_URL -f migrations/squad_rule_ab_test.sql
-- ============================================================================

ALTER TABLE "reward_conversion_rules"
  ADD COLUMN IF NOT EXISTS "ab_test_group" varchar(20);

ALTER TABLE "reward_conversion_rules"
  ADD COLUMN IF NOT EXISTS "ab_test_traffic" integer DEFAULT 100 NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_rules_ab_group"
  ON "reward_conversion_rules" ("ab_test_group", "is_active");

DO $$
BEGIN
  RAISE NOTICE '✅ reward_conversion_rules 加入 A/B testing 欄位';
END $$;
