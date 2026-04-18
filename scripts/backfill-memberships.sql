-- 🔄 完整回填 field_memberships
-- 從所有歷史互動資料挖掘玩家與場域的關係
-- 此腳本是冪等的（ON CONFLICT DO NOTHING）可重複執行

\echo '== 1. 從 player_progress → game_sessions → games =='
INSERT INTO field_memberships (user_id, field_id, joined_at, player_status, is_admin)
SELECT DISTINCT pp.user_id, g.field_id, MIN(gs.started_at), 'active', false
FROM player_progress pp
JOIN game_sessions gs ON gs.id = pp.session_id
JOIN games g ON g.id = gs.game_id
WHERE g.field_id IS NOT NULL AND pp.user_id IS NOT NULL
GROUP BY pp.user_id, g.field_id
ON CONFLICT (user_id, field_id) DO NOTHING;

\echo '== 2. 從 purchases → games =='
INSERT INTO field_memberships (user_id, field_id, joined_at, player_status, is_admin)
SELECT DISTINCT p.user_id, g.field_id, MIN(p.created_at), 'active', false
FROM purchases p
JOIN games g ON g.id = p.game_id
WHERE g.field_id IS NOT NULL AND p.user_id IS NOT NULL
GROUP BY p.user_id, g.field_id
ON CONFLICT (user_id, field_id) DO NOTHING;

\echo '== 3. 從 leaderboard → games =='
INSERT INTO field_memberships (user_id, field_id, joined_at, player_status, is_admin)
SELECT DISTINCT l.user_id, g.field_id, NOW(), 'active', false
FROM leaderboard l
JOIN games g ON g.id = l.game_id
WHERE g.field_id IS NOT NULL AND l.user_id IS NOT NULL
GROUP BY l.user_id, g.field_id
ON CONFLICT (user_id, field_id) DO NOTHING;

\echo '== 4. 從 team_members → teams → game_sessions → games =='
-- teams 沒有 game_session 直連，用 gameId 關聯（若有）
-- 最簡：跳過此步驟（玩家已透過 player_progress 覆蓋）

\echo '== 5. 從 battle_registrations → battle_slots → battle_venues =='
INSERT INTO field_memberships (user_id, field_id, joined_at, player_status, is_admin)
SELECT DISTINCT br.user_id, bv.field_id, MIN(br.registered_at), 'active', false
FROM battle_registrations br
JOIN battle_slots bs ON bs.id = br.slot_id
JOIN battle_venues bv ON bv.id = bs.venue_id
WHERE bv.field_id IS NOT NULL AND br.user_id IS NOT NULL
GROUP BY br.user_id, bv.field_id
ON CONFLICT (user_id, field_id) DO NOTHING;

\echo '== 6. 從 battle_clan_members → battle_clans =='
INSERT INTO field_memberships (user_id, field_id, joined_at, player_status, is_admin)
SELECT DISTINCT bcm.user_id, bc.field_id, MIN(bcm.joined_at), 'active', false
FROM battle_clan_members bcm
JOIN battle_clans bc ON bc.id = bcm.clan_id
WHERE bc.field_id IS NOT NULL AND bcm.user_id IS NOT NULL
GROUP BY bcm.user_id, bc.field_id
ON CONFLICT (user_id, field_id) DO NOTHING;

\echo '== 7. 從 chat_messages → game_sessions → games =='
INSERT INTO field_memberships (user_id, field_id, joined_at, player_status, is_admin)
SELECT DISTINCT cm.user_id, g.field_id, MIN(cm.created_at), 'active', false
FROM chat_messages cm
JOIN game_sessions gs ON gs.id = cm.session_id
JOIN games g ON g.id = gs.game_id
WHERE g.field_id IS NOT NULL AND cm.user_id IS NOT NULL
GROUP BY cm.user_id, g.field_id
ON CONFLICT (user_id, field_id) DO NOTHING;

\echo '== 完成！檢視結果 =='
SELECT
  f.code AS field,
  COUNT(fm.id) AS total,
  SUM(CASE WHEN fm.is_admin THEN 1 ELSE 0 END) AS admins,
  SUM(CASE WHEN fm.player_status = 'active' THEN 1 ELSE 0 END) AS active_players
FROM fields f
LEFT JOIN field_memberships fm ON fm.field_id = f.id
GROUP BY f.id, f.code
ORDER BY total DESC;
