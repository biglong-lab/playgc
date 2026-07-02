# 預約時段關閉 / 包場活動註記 — 2026-07-02

> 範圍：預約時段模組（活動層 + 場域層）｜狀態：程式完成、tsc/build/測試過、待部署
> 對應 ADR：[decisions/0022-booking-slot-closures.md](../decisions/0022-booking-slot-closures.md)

## 背景
業主需求（截圖：活動時段規則 — 水彈對戰 > 休假日）：時段只能整天關閉，有包場時段無法只設定時段；要求增加時段層級調整、整日/單一時段活動註記、設定假日或關閉場次都要做紀錄、記錄設定帳號、關閉都要寫原因備註。

## 影響範圍
- `shared/schema/bookings.ts`：新增 `BookingClosure` / `BookingClosureType` + `BookingScheduleTemplate.closures?`
- `server/booking/schedule-resolver.ts`：`getDailySlots` 套用 closures（full_day → 關整天、time_range → 過濾重疊梯次）+ 純函式 `getClosuresForDate/hasFullDayClosure/isSlotClosed`
- `server/booking/closure-service.ts`（新）：`validateAndStampClosures`（原因必填、時段合法性驗證、新 closure 蓋章設定帳號/時間）
- `server/routes/admin-bookings.ts`（場域層 PUT config）+ `server/routes/admin-activities.ts`（活動層 PATCH schedule）：儲存前 validate+stamp、audit metadata 補 closure 數
- `client/src/pages/admin/booking/ClosuresEditor.tsx`（新）：關閉/包場編輯器（日期 + 全日/指定時段 + 類型 + 原因必填 + 顯示設定人）
- `client/src/pages/admin/booking/ScheduleEditor.tsx`：休假日 tab → ClosuresEditor；月曆預覽同步反映 closures

## 解決方案
- 資料模型：`blackoutDates`（保留相容）+ 新 `closures[]`（整日/單一時段、事由、原因、設定人）。
- 唯一過濾點 `getDailySlots`：一處同時擋「玩家看得到的時段」與「下訂驗證」。
- 原因必填 + 設定帳號蓋章由 **server** 強制（`validateAndStampClosures`，防前端繞過）；帳號取 `req.admin`（`displayName ?? username`）。
- 稽核：兩個儲存端點既有 `logAuditAction`，metadata 補 `newClosures` / `closureTotal`。

## 驗證
- `server/booking/__tests__/closures.test.ts`：10/10 過（full_day 關整天、time_range 只關重疊梯次、只影響指定日、舊 blackoutDates 相容、reason 空丟錯、蓋章、既有不覆寫、displayName null → username）
- `npx tsc --noEmit` ✅、`npm run build` ✅
- 待手動 e2e：admin 建「某日 14:00-17:00 包場、原因必填」→ 儲存 → 玩家端該日只剩非重疊時段；清單顯示設定人+時間；auditLogs 有紀錄

## 已知限制 / 後續
- 不支援重複性 closure（每週固定包場）— 未來可加 recurrence
- `closures` 存 JSONB、無獨立索引（量小可接受）
- ScheduleEditor 851 行（原 889，本次降低；仍略高，未來可抽 CalendarPreview）

## 相關文件
- ADR-0022 / `shared/schema/bookings.ts`（BookingClosure）/ `server/booking/schedule-resolver.ts`
