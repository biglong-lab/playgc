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

## 5. 下班結帳卡關修復（2026-06-25）
- **症狀**：清點紀錄都有保留，但下班結帳一直回 400「請填差異原因」，無法結帳
- **根因**：結帳算式「時間窗」不一致
  - `computeExpected("closing")`（前端顯示用）只扣「開帳時間點之後」的清帳 → 預期 550,400、差異 0
  - `settle`（結帳）卻扣「整天」清帳 → 當日有 NT$15,000 清帳 + 使用者重新點過開帳（開帳在清帳之後）→ 預期被算成 0、差異 55 萬 → need_reason → 400
  - 前端說沒差異不帶原因、後端說有差異要原因 → 互相矛盾結不了帳
- **修**：`settle` 與 `computeExpected` 統一用「開帳時間點(opening.countedAt)之後」的現金收/退/清帳/支出窗
  - `cashFlows` / `expensesForDate` 加 `after` 參數；settle 改用 `since = opening.countedAt`
  - 概念：opening 點鈔已反映當下抽屜（含先前所有異動），只算開帳後的異動才不會重複計
- 順手修 `internal-notifier` Map 迭代 `downlevelIteration` tsc 錯（改 Array.from）
- 驗證：生產實測 開帳 550,400 → 下班 550,400 → 預期 550,400 差異 0 → 結帳 200 成功
- commit `e8884ffb`

## 相關
- [2026-06-22-pos-cash-management](2026-06-22-pos-cash-management.md)（現金管理閉環）
