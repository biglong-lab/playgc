# ADR-0022: 預約時段關閉 / 包場活動註記（template-based closures）

> 日期：2026-07-02　狀態：採用中　影響：預約時段模組（shared 型別 / server 解析+儲存 / admin UI）

## 背景
業主回報：預約「休假日」只能**整天關閉**（`blackoutDates: string[]`），但實務上常有「某日 14:00-17:00 包場、其他時段仍要開放」的需求，且需要：
- 單一時段關閉（不只整天）
- 事由分類（包場 / 保養 / 活動 / 休假）
- 原因備註（必填）
- 記錄設定帳號與時間（稽核）

## 選項
| 方案 | 優點 | 缺點 |
|------|------|------|
| A. 沿用既有 `bookingBlackouts` 表（含 startAt/endAt/reason）| 已有 schema | 死表、目前解析流程完全沒讀它；僅場域層、無活動層；需新增 join 進 resolver |
| B. 在 `scheduleTemplate` JSON 新增 `closures[]`（採用）| 活動層+場域層共用同一 template 與同一 resolver 路徑；不需 DB migration；一處過濾 | JSON 內資料、無獨立查詢索引（可接受，量小）|

## 決定
採 **B：template-based `closures`**。理由：
1. 活動層 (`activity_schedules`) 與場域層 (`booking_configs`) 共用同一份 `scheduleTemplate` 結構與 `schedule-resolver`，一次擴充兩層都生效。
2. 不需 DB migration（JSONB 欄位），符合「schema 只加不刪」紅線。
3. `getDailySlots` 是唯一時段產生點，`getAvailability`(顯示) / `createBooking` / `updateBooking` 全經過它 → 單一過濾點同時擋顯示與下訂。
4. 保留 `blackoutDates`（舊資料相容），不刪。

## 影響
- 程式碼：`shared/schema/bookings.ts`（型別）、`server/booking/schedule-resolver.ts`（過濾）、`server/booking/closure-service.ts`（驗證+蓋章）、`server/routes/admin-bookings.ts` + `admin-activities.ts`（儲存）、`client/.../ClosuresEditor.tsx` + `ScheduleEditor.tsx`（UI）。
- 紅線：只加欄位；原因必填由 server `validateAndStampClosures` 強制（防繞過）；設定帳號由 server 用 `req.admin` 蓋章。
- 已知限制：不支援重複性 closure（每週固定包場）；`closures` 無 DB 索引（量小可接受）。

## 後續可能變動
- 若 closures 量大 / 需跨場域報表 → 再評估搬到獨立表（可 supersede 本 ADR）。
- 重複性規則（每週包場）未來可加 recurrence 欄位。

## 相關文件
- 變動紀錄 → [changes/2026-07-02-booking-slot-closures.md](../changes/2026-07-02-booking-slot-closures.md)
- 資料模型 → `shared/schema/bookings.ts`（BookingClosure）
