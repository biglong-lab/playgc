-- ============================================================================
-- Squad 系統 — 預設規則 + 券模板 seed data
-- 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.8
--
-- 部署：psql $DATABASE_URL -f migrations/squad_seed_data.sql
-- 安全：用 INSERT ... ON CONFLICT DO NOTHING（重跑不會出錯）
-- ============================================================================

-- ============================================================================
-- 1. 券模板（6 個範本）
-- ============================================================================
INSERT INTO coupon_templates (id, name, description, discount_type, discount_value, validity_days, is_active)
VALUES
  ('TPL_NEWBIE_50', '新人賀禮券 50 元', '打滿 10 場可領，平台內折抵', 'amount', 50, 30, true),
  ('TPL_VETERAN_100', '老隊伍犒賞券 100 元', '打滿 50 場可領', 'amount', 100, 60, true),
  ('TPL_LEGEND_500', '傳奇隊伍 500 元獎金', '打滿 100 場入名人堂', 'amount', 500, 90, true),
  ('TPL_RECRUIT_200', '招募達人 200 元獎金', '招募 10 人加入並完成首戰', 'amount', 200, 60, true),
  ('TPL_CROSS_FIELD_15PCT', '跨場域勇者 9 折', '在 2 個以上場域累積戰績', 'percentage', 15, 30, true),
  ('TPL_PARTY_MASTER_30PCT', '派對達人 7 折', '參加 5 場特殊活動（嘉年華/派對）', 'percentage', 30, 30, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. 預設規則（5 個範例）
-- ============================================================================

-- 規則 1：打滿 10 場新人賀禮
INSERT INTO reward_conversion_rules (name, description, is_active, triggers, rewards, quota, priority)
SELECT
  '🌱 打滿 10 場新人賀禮',
  '隊伍累計 10 場後送 50 元平台券（每隊一次）',
  true,
  '{"eventType": "game_complete", "minTotalGames": 10}'::jsonb,
  '[{"type": "platform_coupon", "templateId": "TPL_NEWBIE_50", "target": "squad"}]'::jsonb,
  '{"perSquad": 1}'::jsonb,
  100
WHERE NOT EXISTS (SELECT 1 FROM reward_conversion_rules WHERE name = '🌱 打滿 10 場新人賀禮');

-- 規則 2：跨場域首航獎
INSERT INTO reward_conversion_rules (name, description, is_active, triggers, rewards, quota, priority)
SELECT
  '🚀 跨場域首航獎',
  '第一次在新場域玩 → 送跨域勇者券（每隊每場域 1 次）',
  true,
  '{"eventType": "game_complete", "firstVisit": true}'::jsonb,
  '[{"type": "platform_coupon", "templateId": "TPL_CROSS_FIELD_15PCT", "target": "squad"}]'::jsonb,
  '{"perSquad": 5}'::jsonb,
  90
WHERE NOT EXISTS (SELECT 1 FROM reward_conversion_rules WHERE name = '🚀 跨場域首航獎');

-- 規則 3：MVP 即時獎
INSERT INTO reward_conversion_rules (name, description, is_active, triggers, rewards, quota, priority)
SELECT
  '🏆 MVP 即時獎',
  '對戰拿 MVP → 送平台券',
  true,
  '{"eventType": "game_complete", "result": ["win"]}'::jsonb,
  '[{"type": "platform_coupon", "templateId": "TPL_NEWBIE_50", "target": "leader"}]'::jsonb,
  '{"perDay": 3}'::jsonb,
  80
WHERE NOT EXISTS (SELECT 1 FROM reward_conversion_rules WHERE name = '🏆 MVP 即時獎');

-- 規則 4：百戰隊伍名人堂
INSERT INTO reward_conversion_rules (name, description, is_active, triggers, rewards, quota, priority)
SELECT
  '🌟 百戰隊伍入名人堂',
  '累計 100 場 → 送 500 元獎金',
  true,
  '{"eventType": "game_complete", "minTotalGames": 100}'::jsonb,
  '[{"type": "platform_coupon", "templateId": "TPL_LEGEND_500", "target": "squad"}, {"type": "badge", "value": "hall_of_fame"}]'::jsonb,
  '{"perSquad": 1}'::jsonb,
  70
WHERE NOT EXISTS (SELECT 1 FROM reward_conversion_rules WHERE name = '🌟 百戰隊伍入名人堂');

-- 規則 5：老隊伍犒賞
INSERT INTO reward_conversion_rules (name, description, is_active, triggers, rewards, quota, priority)
SELECT
  '💎 老隊伍犒賞',
  '累計 50 場 → 送 100 元犒賞券',
  true,
  '{"eventType": "game_complete", "minTotalGames": 50}'::jsonb,
  '[{"type": "platform_coupon", "templateId": "TPL_VETERAN_100", "target": "squad"}]'::jsonb,
  '{"perSquad": 1}'::jsonb,
  60
WHERE NOT EXISTS (SELECT 1 FROM reward_conversion_rules WHERE name = '💎 老隊伍犒賞');

-- ============================================================================
-- 完成提示
-- ============================================================================
DO $$
DECLARE
  rule_count int;
  tpl_count int;
BEGIN
  SELECT count(*) INTO rule_count FROM reward_conversion_rules WHERE is_active = true;
  SELECT count(*) INTO tpl_count FROM coupon_templates WHERE is_active = true;
  RAISE NOTICE '✅ Squad seed 完成：% 條規則、% 個券模板', rule_count, tpl_count;
END $$;
