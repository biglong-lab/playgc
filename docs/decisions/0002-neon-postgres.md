# ADR-0002: 主資料庫使用 PostgreSQL（Neon → 本地 Docker）

> 日期：2025-Q4 啟用 Neon → 2026-Q1 改本地 Docker
> 狀態：✅ 採用中（生產：本地 Docker；開發：仍可用 Neon dev branch）
> 影響：所有資料儲存、Schema 變動、備份策略

---

## 背景

從 Replit 搬出的專案原用 `@neondatabase/serverless`。本地化後遇到：
- Neon 免費方案配額限制（庫存管理工具已撞到）
- 多場域 + 高頻 WebSocket 連線會吃配額
- 生產 latency（Neon serverless 冷啟動 ~200ms）

---

## 選項

| 方案 | 月成本 | 維運 | 適合度 |
|------|-------|------|--------|
| Neon 主分支 | $0~19 | 零維運 | 開發 OK，生產配額不夠 |
| Linode 自架 PostgreSQL | $0（已有 server） | 中等（備份要自己做） | 適合生產 |
| Supabase | $0~25 | 零維運 | 功能多餘（auth 我用 Firebase） |
| AWS RDS | $30+ | 零維運 | 太貴 |

---

## 決定

**雙軌策略**：
- **生產**：Linode 上的 Docker `gamehomicc-db-1`（PostgreSQL 16）
  - 走 Docker volume 持久化
  - 跟 app 容器同網段，內部通訊 latency < 1ms
  - 每日 `pg_dump` 備份到別處
- **本地開發**：本地 Docker `gameplatform-postgres` (port 5437)
- **dev branch（選用）**：Neon dev branch 給本地連，需要時用

理由：
1. **零成本**（已有 Linode）
2. **無配額限制**
3. **latency 低**（同 Docker 網段）
4. **掌控完整**（pg 升級、tuning、extension 自己決定）

---

## 影響

### 程式碼遷移
- `server/db.ts`：`@neondatabase/serverless` → `pg` (node-postgres)
- `package.json`：移除 `@neondatabase/serverless`
- `script/build.ts`：allowlist 中 `neon` → `pg`

### 紅線
- ❌ **禁止本地開發直連生產 DB**
- ❌ **Schema 變動只 ADD COLUMN，禁 DROP**（生產資料保護）
- ✅ **PR3b / PR4 schema 變動用 SQL 直接 ALTER TABLE**（drizzle-kit push 在 prod 容器跑不順）

### 備份策略
- 每日 cron `pg_dump` → 備份檔
- Linode 整機 snapshot（Linode 內建）
- Git 版本控制（程式碼回滾）

---

## 已知限制

- 沒有 Neon 的 branching、PITR
- 升級 pg 版本需要手動操作
- 容器 down 時整個服務 down（沒高可用）

---

## 後續可能變動

- 流量超過單機負荷 → 加 read replica
- 需要 PITR → 改用 Patroni 或 Cloud RDS
- 需要 zero-downtime migration → 引入 pg_logical

---

## 相關文件

- [architecture/deployment.md](../architecture/deployment.md)
- [runbooks/db-migration.md](../runbooks/db-migration.md)
- 庫存管理工具的 v1.3.0 也做了同樣遷移（參考價值）
