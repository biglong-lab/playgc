# Runbook: DB Schema 變動

> 觸發：需要新增 / 修改 schema
> 估時：5-10 分鐘
> 風險：中（資料完整性影響）

---

## 紅線（無一例外）

- ❌ **禁止 DROP TABLE** — 廢棄表保留只讀，不刪
- ❌ **禁止 DROP COLUMN** — 廢棄欄位保留 nullable，不刪
- ❌ **禁止改欄位 type** — 改型別會導致資料 cast 失敗，要新增欄位代替
- ❌ **禁止改欄位 NOT NULL → 必須提供 default**（避免既有 row 失敗）
- ✅ **只允許 ADD COLUMN / CREATE INDEX / CREATE TABLE**

---

## 情境 A — 加新欄位（最常見）

### Step 1：改 schema 檔

```typescript
// shared/schema/{table}.ts
export const tableX = pgTable("table_x", {
  // ... 既有欄位 ...

  // 🆕 新欄位（必須 nullable 或有 default，避免破壞既有 row）
  newField: varchar("new_field"),
}, (table) => [
  // 🆕 必要時加 index
  index("idx_table_x_new_field").on(table.newField),
]);
```

### Step 2：本地測試（用 dev DB）

```bash
# 本地 Docker DB
docker exec -i gameplatform-postgres psql -U postgres -d gameplatform <<EOF
ALTER TABLE table_x ADD COLUMN IF NOT EXISTS new_field varchar;
CREATE INDEX IF NOT EXISTS idx_table_x_new_field ON table_x(new_field);
EOF

# 確認加成功
docker exec gameplatform-postgres psql -U postgres -d gameplatform -c "\d table_x"
```

### Step 3：commit + push

注意 commit message 要明確說「**部署後需執行 schema 同步**」。

### Step 4：部署生產（[deploy.md](deploy.md)）

### Step 5：在生產同步 schema

**注意**：drizzle-kit push 在 production 容器中跑不順（drizzle.config.ts 不在 dist）。
**解法**：直接走 SQL：

```bash
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -c \"ALTER TABLE table_x ADD COLUMN IF NOT EXISTS new_field varchar; CREATE INDEX IF NOT EXISTS idx_table_x_new_field ON table_x(new_field);\""
```

### Step 6：驗證

```bash
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -c \"\\d table_x\" | grep new_field"
```

---

## 情境 B — 加新表

```bash
# 1. shared/schema/{new-table}.ts 加 table 定義
# 2. shared/schema/index.ts export
# 3. 本地測試 SQL
# 4. commit + push + 部署
# 5. 生產執行 SQL：
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 psql -U postgres -d gameplatform <<'EOF'
CREATE TABLE IF NOT EXISTS new_table (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);
CREATE INDEX IF NOT EXISTS idx_new_table_xxx ON new_table(xxx);
EOF"
```

---

## 情境 C — 廢棄欄位（只能標記不能刪）

不要改 schema 檔！改用：
1. 在程式碼層面停止寫入該欄位
2. 在註解標記 `// @deprecated 2026-XX-XX use {newField} instead`
3. 半年後若確認無讀取，再開新 ADR 評估是否真刪除

---

## 情境 D — 大型 schema 重組（多表、多欄位）

> ⚠️ 高風險 — 必須先寫 ADR

1. 在 `docs/decisions/` 新增 ADR 評估方案
2. 在 `docs/changes/` 開新檔規劃步驟
3. 拆成 ≥ 3 個 PR：
   - PR 1：新欄位 / 新表（仍向後相容）
   - PR 2：應用層雙寫
   - PR 3：應用層只讀新欄位
4. 每個 PR 部署後驗證至少 24 小時
5. 舊欄位保留 30 天才考慮停寫

範例參考：[changes/2026-05-02-squad-unification.md](../changes/2026-05-02-squad-unification.md)

---

## 失敗回滾

### Schema 加錯了但還沒寫資料

```sql
-- 移除剛加的欄位（資料尚未污染）
ALTER TABLE table_x DROP COLUMN IF EXISTS new_field;
DROP INDEX IF EXISTS idx_table_x_new_field;
```

### Schema 加錯且已有寫入

不可直接 DROP — 改用：
1. 應用層停止寫入
2. 標記 deprecated
3. 之後再評估

---

## 備份策略

> **⚠️ scp 使用界線（澄清全域「禁 scp」規則）**
> 全域紅線禁止的是**用 scp 部署程式碼 / 變更**（必須走 git）。
> 本節的 scp 是**資料庫備份維運**——備份 dump 本來就不能進 git（含生產資料，已從版控移除），
> 走 scp 傳 dump 是正當例外。但仍須遵守：
> - dump 落地本地後**不可** `git add`（`.gitignore` 已擋 `backups/`、`db-backups/` 請一併確認）
> - 還原（上傳覆蓋）僅限緊急，且務必先確認目標環境

### 部署高風險變動前手動備份

```bash
# 在生產跑 pg_dump 到時間戳檔名
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 pg_dump -U postgres gameplatform > /tmp/backup-$(date +%Y%m%d-%H%M%S).sql"

# 下載到本地（DB 備份維運，非程式碼部署）
scp root@172.233.89.147:/tmp/backup-*.sql ./db-backups/
```

### 還原備份

```bash
# 上傳備份檔
scp ./db-backups/backup-XXX.sql root@172.233.89.147:/tmp/

# 還原（會覆蓋現有資料！）
ssh root@172.233.89.147 "docker exec -i gamehomicc-db-1 psql -U postgres gameplatform < /tmp/backup-XXX.sql"
```

---

## 相關文件

- [decisions/0002-neon-postgres.md](../decisions/0002-neon-postgres.md) — DB 選型決策
- [runbooks/deploy.md](deploy.md) — 部署流程
- [runbooks/backup-restore.md](backup-restore.md) — 完整備份還原（待建）
