-- 🩺 資料健康檢查（2026-08-05）
--
-- 純唯讀，不改任何資料。定期跑一次，及早發現資料層面的問題。
-- 用法：
--   本地: docker exec -i gameplatform-postgres psql -U postgres -d gameplatform -q < scripts/data-health-check.sql
--   生產: ssh root@172.233.67.87 "docker exec -i gamehomicc-db-1 psql -U postgres -d gameplatform -q" < scripts/data-health-check.sql
--
-- 檢查項目來自 2026-08-05 實際踩到的問題（ADR-0024）。

\pset border 2

\echo '════════ 🩺 資料健康檢查 ════════'
\echo ''
\echo '① 殭屍隊伍（狀態進行中、但成員全離隊）'
\echo '   > 0 表示玩家介面會列出早就沒人的隊伍，rejoin 也可能把人加回空隊'
SELECT t.status AS 狀態, count(*) AS 隊伍數
FROM teams t
WHERE t.status IN ('forming','ready','playing')
  AND NOT EXISTS (SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.left_at IS NULL)
GROUP BY 1;

\echo ''
\echo '② leftAt / leftReason 不變式（在隊上卻標著離隊原因）'
\echo '   > 0 表示某個清除點漏改 —— 應為 0'
SELECT count(*) AS 違反筆數 FROM team_members
WHERE left_at IS NULL AND left_reason IS NOT NULL;

\echo ''
\echo '③ 未定義的 left_reason 值（只允許 auto_leave / manual / kicked）'
SELECT COALESCE(string_agg(DISTINCT left_reason, ', '), '(無)') AS 未定義值
FROM team_members
WHERE left_reason IS NOT NULL
  AND left_reason NOT IN ('auto_leave','manual','kicked');

\echo ''
\echo '④ 孤兒資料（外鍵指向不存在的資料）'
SELECT 'team_members → teams' AS 關聯, count(*) AS 孤兒數
FROM team_members m WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id=m.team_id)
UNION ALL
SELECT 'pos_transaction_items → pos_transactions', count(*)
FROM pos_transaction_items i
WHERE NOT EXISTS (SELECT 1 FROM pos_transactions p WHERE p.id=i.transaction_id);

\echo ''
\echo '⑤ POS 幣別健全性（金額應為正、且以「分」為單位）'
SELECT count(*) FILTER (WHERE paid_amount_cents < 0) AS 負數金額,
       count(*) FILTER (WHERE deleted_at IS NOT NULL) AS 已軟刪除
FROM pos_transactions;

\echo ''
\echo '════════ 檢查完畢 ════════'
