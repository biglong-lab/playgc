#!/bin/bash
# 將生產 DB（game.homi.cc）同步到本地（localhost:5437/gameplatform）
# 用法：npm run sync:db

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUPS="$PROJECT_ROOT/backups"
SSH_HOST="root@172.233.89.147"
PROD_CONTAINER="gamehomicc-db-1"
LOCAL_CONTAINER="gameplatform-postgres"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUPS"

echo "=============================================="
echo "  生產 → 本地 DB 同步"
echo "=============================================="
echo ""

# 1. 備份本地現有資料
echo "▶ 1/5 備份本地現有 DB..."
LOCAL_BACKUP="$BACKUPS/local-before-sync-$TIMESTAMP.dump"
docker exec "$LOCAL_CONTAINER" pg_dump -U postgres -Fc gameplatform > "$LOCAL_BACKUP"
echo "  ✓ 本地備份：$LOCAL_BACKUP ($(du -h "$LOCAL_BACKUP" | cut -f1))"
echo ""

# 2. 生產端 pg_dump
echo "▶ 2/5 從生產 dump 資料..."
ssh "$SSH_HOST" "docker exec $PROD_CONTAINER pg_dump -U postgres -Fc gameplatform > /tmp/prod-dump.bin"
echo "  ✓ 生產端 dump 完成"
echo ""

# 3. 下載到本地
echo "▶ 3/5 下載到本地..."
PROD_DUMP="$BACKUPS/prod-$TIMESTAMP.dump"
scp -q "$SSH_HOST:/tmp/prod-dump.bin" "$PROD_DUMP"
echo "  ✓ 下載完成：$PROD_DUMP ($(du -h "$PROD_DUMP" | cut -f1))"
echo ""

# 4. Restore 到本地（忽略 FK 錯誤，稍後處理）
echo "▶ 4/5 Restore 到本地（清空舊資料）..."
docker cp "$PROD_DUMP" "$LOCAL_CONTAINER:/tmp/prod-dump.bin"
docker exec "$LOCAL_CONTAINER" pg_restore \
  -U postgres -d gameplatform \
  --clean --if-exists --no-owner --no-privileges \
  /tmp/prod-dump.bin 2>&1 | grep -cE "ignored on restore" > /tmp/restore-errcount.txt || true
ERR_COUNT=$(cat /tmp/restore-errcount.txt 2>/dev/null || echo "0")
echo "  ✓ Restore 完成（忽略 $ERR_COUNT 個 FK 警告）"
echo ""

# 5. 清孤兒 + 重建 FK
echo "▶ 5/5 清孤兒記錄、重建外鍵..."
docker exec "$LOCAL_CONTAINER" psql -U postgres -d gameplatform -q -c "
DELETE FROM field_memberships WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
DELETE FROM player_chapter_progress WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
DELETE FROM player_progress WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);

DO \$\$
BEGIN
  -- 若 FK 不存在才建（重複執行安全）
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_memberships_user_id_fkey') THEN
    ALTER TABLE field_memberships ADD CONSTRAINT field_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_chapter_progress_user_id_users_id_fk') THEN
    ALTER TABLE player_chapter_progress ADD CONSTRAINT player_chapter_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_progress_user_id_users_id_fk') THEN
    ALTER TABLE player_progress ADD CONSTRAINT player_progress_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END\$\$;
"
echo "  ✓ 資料完整性已恢復"
echo ""

# 統計
echo "=============================================="
echo "  同步完成！資料統計"
echo "=============================================="
docker exec "$LOCAL_CONTAINER" psql -U postgres -d gameplatform -c "
SELECT
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM admin_accounts WHERE status='active') as active_admins,
  (SELECT COUNT(*) FROM games) as games,
  (SELECT COUNT(*) FROM pages) as pages,
  (SELECT COUNT(*) FROM game_sessions) as sessions;
"

# 清除超過 7 天的舊備份（自動清理）
find "$BACKUPS" -name "*.dump" -mtime +7 -delete 2>/dev/null || true

echo ""
echo "✓ 本地備份保留於：$LOCAL_BACKUP"
echo "✓ 可用 docker exec -i $LOCAL_CONTAINER pg_restore -U postgres -d gameplatform --clean --if-exists < $LOCAL_BACKUP 還原"
echo ""
