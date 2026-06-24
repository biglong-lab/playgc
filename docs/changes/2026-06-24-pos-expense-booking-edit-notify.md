# POS 收支/支出 + 預約編輯 + 晨報修復 + 推播整治 — 2026-06-24

> 範圍：POS 收支、預約編輯、今日預約晨報、Telegram 推播
> 狀態：🟢 部署上線（commit 範圍 `dbdbffda`…`beb5d8b9`）

## 1. 預約編輯（今日 + 未來）
- 今日/未來預約每筆可「✏️ 編輯」：改人數/時間/姓名/電話
- **修改原因必填**（標籤：人數修改/時間修改/姓名電話修正/其他 + 補充）
- 改時間/加人數會檢查時段容量；稽核記「誰/何時/原→新」（audit_logs，append-only 不刪）
- 後端 `updateBooking`（booking-service）+ `PATCH /api/pos/bookings/:code`
- 坑：時間輸入截到分，須只在日期/時間字串真的變動才送 slotStart（否則秒差誤觸發時段驗證）

## 2. POS 現金支出 → 「收支」頁
- 支出：採購/雜支記帳，**扣櫃檯現金**、納入下班結算對帳 + 結帳 Telegram + 報表現金卡
- 分類標籤（補貨/材料、維修/清潔、雜支/其他）可自訂；軟刪除 + 原因 + 稽核
- 介面：原放現金頁 → 改放**收款頁並改名「收支」**（收款/支出切換）；現金頁留入口 + 今日支出摘要
- 新表 `pos_expenses`；settlement 加 `expenses_cents`
- API：`POST/GET /api/pos/expenses`、`POST /api/pos/expenses/:id/delete`
- 對帳算式更新：開帳 + 現金收 − 退 − 清帳 − **支出** = 預期

## 3. 今日預約晨報修復 + 統計
- **bug**：晨報只用 fieldId(UUID) 過濾，但 bookings.field_id 歷史混存 UUID/code → 漏掉存 code 的預約（孫聖凱組沒推）
- **修**：同時比對 UUID + code（比照 resolveFieldScope）
- 加**項目統計**：總組數/總人數 + 各活動小計（未來新活動類型自動納入）
- 新增手動「📣 重發今日預約到群組」按鈕 + `POST /api/pos/bookings/resend-today-report`

## 4. Telegram 推播整治
- **根因**：生產 CLUSTER_WORKERS=4，cron + 啟動通知每 worker 各跑一次 → 每則 ×4 重複
- **修**：`IS_SCHEDULER_INSTANCE` 守衛，cron + 啟動通知只在單一 worker 跑
- chat id 去重（new Set）；開帳首日無基礎不算差異不推
- 啟動通知改白話「🟢 系統已更新上線」（移除 commit 術語）+ 所有現金通知加 HH:MM
- 面額清點補 NT$5

## 驗證
- 全程 Playwright e2e + API e2e（避免測試推播污染群組，用直接 SQL 建測試資料）
- 預約編輯、收支切換、支出扣現金對帳、晨報雙組+統計、推播去重 均通過

## 相關
- [2026-06-22-pos-cash-management](2026-06-22-pos-cash-management.md)（現金管理閉環）
