# Feature Flags + 自動降級 — Phase 4 of 5 — 2026-05-12

> 範圍：元件遠端開關 + admin UI + 自動降級（高失敗率自動關 + 恢復健康 re-enable）
> 狀態：✅ 完成、tsc 0 / smoke 51/51

## 完成

### 1. Schema + migration
`feature_flags` 表：
- `scope`（global / field）、`fieldId`（null = global）、`moduleKey`
- `enabled` boolean + `disabledReason`（manual / auto:high_failure / auto:low_completion）
- `metrics` JSONB（自動降級時記錄失敗率等）
- unique `(scope, fieldId, moduleKey)`

migration `migrations/manual/2026-05-12-feature-flags.sql`、dev DB 已套用。

### 2. Endpoints（`server/routes/admin-feature-flags.ts`）
- `GET /api/admin/feature-flags` — admin 列表
- `POST /api/admin/feature-flags` — admin upsert（onConflict update）
- `PATCH /api/admin/feature-flags/:id` — admin toggle enabled
- `GET /api/feature-flags/check?moduleKey=X&fieldId=Y` — **公開**、玩家端查詢（fail-open）
- `POST /api/cron/auto-disable-failed-components` — cron 觸發自動降級

### 3. 自動降級邏輯
cron 撈過去 1h `component_runs` 統計：
- 樣本 ≥ 10 才算
- errored / total > 50% → 自動 disabled、reason='auto:high_failure'、記錄 metrics
- 已 disabled 但失敗率回穩 + reason 是 `auto:*` → 自動 re-enable
- `manual` 關閉不會被自動恢復

### 4. admin UI（`/admin/feature-flags`）
- 列表：元件 / 範圍 / 狀態 / 原因 / 關閉時間 / 操作
- 一鍵 toggle 啟用 / 停用
- 自動降級的 flag 顯示 🤖 Bot icon + 失敗率
- 手動新增 flag input
- 30 秒自動 refresh
- admin menu 加「🎚️ 元件開關」

## 5 Phase 進度

- ✅ 1 元件健康度紀錄
- ✅ 2 元件級 ErrorBoundary + 自癒
- ✅ 3 體感升級（Skeleton / Toast dedup / LoadFailureFallback）
- ✅ **4 Feature flags + 自動降級（本次）**
- ⏸ 5 合成監測（Playwright cron）

## 業主可用

部署後：
1. 進 `/admin/feature-flags` 看所有 flag（一開始空、預設所有元件啟用）
2. 出問題的元件可一鍵停用（不用 deploy）
3. 設 crontab `*/60 * * * *` 觸發自動降級：
   ```
   */60 * * * * curl -s -X POST https://game.homi.cc/api/cron/auto-disable-failed-components -H "Authorization: Bearer $CRON_SECRET" > /dev/null
   ```

## 後續整合（可選）

- `GamePageRenderer` 接 `/api/feature-flags/check`、若元件 disabled → 顯示「此元件暫停使用、請通知 admin」+ 跳過按鈕（同 ErrorBoundary 行為）
- 目前 admin 可看可改、但玩家端尚未自動套用 → 下次整合
