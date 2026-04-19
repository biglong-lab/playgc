-- 修補 jiachun-defense-battle 遊戲：補齊碎片 2-5 的發放
-- 原 importJiachunGame 只有 page 8 發碎片 1，其他 4 個碎片玩家永遠拿不到
-- 用 onCompleteActions.add_item 把剩餘 4 個碎片掛到既有 pages
-- （冪等：用 jsonb_set 但只在沒有該 itemId 時插入）

BEGIN;

-- Page 4（歸零靶場）→ 補碎片 2/5 (itemId=14)
UPDATE pages
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{onCompleteActions}',
  COALESCE(config->'onCompleteActions', '[]'::jsonb) ||
    '[{"type":"add_item","itemId":"14"}]'::jsonb
)
WHERE game_id = 'jiachun-defense-battle'
  AND page_order = 4
  AND NOT (
    COALESCE(config->'onCompleteActions', '[]'::jsonb) @>
    '[{"itemId":"14"}]'::jsonb
  );

-- Page 6（射擊訓練）→ 補碎片 3/5 (itemId=15)
UPDATE pages
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{onCompleteActions}',
  COALESCE(config->'onCompleteActions', '[]'::jsonb) ||
    '[{"type":"add_item","itemId":"15"}]'::jsonb
)
WHERE game_id = 'jiachun-defense-battle'
  AND page_order = 6
  AND NOT (
    COALESCE(config->'onCompleteActions', '[]'::jsonb) @>
    '[{"itemId":"15"}]'::jsonb
  );

-- Page 9（化學武器防護）→ 補碎片 4/5 (itemId=16)
UPDATE pages
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{onCompleteActions}',
  COALESCE(config->'onCompleteActions', '[]'::jsonb) ||
    '[{"type":"add_item","itemId":"16"}]'::jsonb
)
WHERE game_id = 'jiachun-defense-battle'
  AND page_order = 9
  AND NOT (
    COALESCE(config->'onCompleteActions', '[]'::jsonb) @>
    '[{"itemId":"16"}]'::jsonb
  );

-- Page 10（防護知識測驗）→ 補碎片 5/5 (itemId=17)
UPDATE pages
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{onCompleteActions}',
  COALESCE(config->'onCompleteActions', '[]'::jsonb) ||
    '[{"type":"add_item","itemId":"17"}]'::jsonb
)
WHERE game_id = 'jiachun-defense-battle'
  AND page_order = 10
  AND NOT (
    COALESCE(config->'onCompleteActions', '[]'::jsonb) @>
    '[{"itemId":"17"}]'::jsonb
  );

-- 顯示更新後的 pages（供驗證）
SELECT page_order, config->'onCompleteActions' AS actions
FROM pages
WHERE game_id = 'jiachun-defense-battle'
  AND page_order IN (4, 6, 8, 9, 10)
ORDER BY page_order;

COMMIT;
