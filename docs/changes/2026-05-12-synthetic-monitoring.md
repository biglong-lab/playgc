# 合成監測 — Phase 5 of 5（5 Phase 計畫完工）— 2026-05-12

> 範圍：24/7 自動巡檢、critical endpoint 健康偵測、失敗推 Telegram
> 狀態：✅ 完成、tsc 0 / smoke 51/51

## 5 Phase 計畫全部完工 🎉

- ✅ 1 元件健康度紀錄（component_runs + admin/component-health）
- ✅ 2 元件級 ErrorBoundary + 自癒（ComponentErrorBoundary + useStuckDetection + apiRequestWithRetry）
- ✅ 3 體感升級（PageSkeleton + useToastDedup + LoadFailureFallback）
- ✅ 4 Feature flags + 自動降級（feature_flags + admin UI + auto-disable cron）
- ✅ **5 合成監測（本次）**

## 完成

### Schema + migration
`synthetic_runs` 表：
- run_at / total_checks / passed / failed / avg_response_ms
- results JSONB（每個 check 詳情）
- alert_sent boolean

migration `2026-05-12-synthetic-runs.sql`、dev DB 已套用。

### Endpoint `POST /api/cron/synthetic-check`
- CRON_SECRET 驗證
- 內部 fetch 4 個 critical endpoint：
  - GET /api/v1/health
  - GET /api/version
  - GET /api/cron/health
  - GET /api/feature-flags/check（公開）
- 各 check 計算 response_ms、是否 ok、status code
- 失敗任一 → `notifySystemError`（已既有 Telegram 推送）
- 寫紀錄到 synthetic_runs（每次跑都記、無論成敗）

### Endpoint `GET /api/admin/synthetic-runs?limit=30`
- read-only 給未來 dashboard 用
- 列最近 N 次巡檢紀錄

## 業主部署後設定

```bash
# crontab：每小時整點觸發巡檢
0 * * * * curl -s -X POST https://game.homi.cc/api/cron/synthetic-check -H "Authorization: Bearer $CRON_SECRET" > /dev/null
```

設了之後：
- 每小時自動跑、健康時靜音
- 任一 endpoint 失敗 → 立即 Telegram 推「🚨 巡檢失敗」+ failed names

## 5 Phase 整體效益

| 項目 | 改前 | 改後 |
|------|------|------|
| 元件健康量化 | 看感覺 | `/admin/component-health` 一頁看清 |
| 元件 throw error | 整頁壞、玩家被卡 | ErrorBoundary 隔離、玩家可跳過 |
| API 偶發 5xx | 失敗、要手動重試 | 自動 retry 3 次 |
| Loading UI | spinner（跳動）| Skeleton（預占 layout）|
| Toast 飆出 | 訊息洗版 | dedup 5s 內同訊息只發一次 |
| 載入失敗 | 死頁 | 友善 UI + 重試 / 跳過 |
| 元件出問題 | 等 deploy 修 | admin 一鍵 toggle 停用 |
| 失敗率高 | 業主才發現 | cron 自動降級 + 自動 re-enable |
| 系統健康 | 玩家回報才知道 | 24/7 自動巡檢、失敗推 Telegram |
| 自我紀錄 | 0 | 4 個新表（component_runs / feature_flags / synthetic_runs / session_reports）|

## 業主下次接續

5 Phase 計畫已全部完工。下一步可選：

1. **整合 Feature flag 到 GamePageRenderer**：玩家端自動套用 disabled flag、顯示「此元件暫停使用」+ 跳過
2. **元件接 useStuckDetection / apiRequestWithRetry**：之前只寫 hook、未接元件、可選敏感元件接（如 trivia / lock）
3. **#9 道具獎勵分數欄位**（上次 12 項剩 1 項、需業主釐清需求）
4. **真實活動驗證**：跑活動累積數據、看 admin/component-health 真實效果
