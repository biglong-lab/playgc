# 預約改時間「不在開放時段」修復 — 2026-06-30

> 範圍：預約編輯 / getBookingConfig　狀態：已修復（待部署）

## 背景

業主回報：把預約 7/12 改成 7/9 出現「更新失敗 — 新時段不在開放時段內」，但**單獨新增**同一天時段卻成功。

## 根因

`field_id` 混用 UUID 與場域代碼：
- `fields`：id=`72cc204d-…`（UUID）/ code=`JIACHUN`
- `bookings.field_id`：`72cc204d-…`（UUID）
- **`booking_configs.field_id`：`JIACHUN`（代碼）** ← 不一致

改時間流程：PATCH `/api/pos/bookings/:code` → `updateBooking({ fieldId: scope.id })`（**UUID**）→ `getAvailability(UUID)` → 無 activityId → fallback `getBookingConfig(UUID)`。但 `getBookingConfig` 用 `lower(field_id)=lower(UUID)` 比對，表裡是 `JIACHUN` → **查不到 → 回 null → getAvailability 回 `[]`** → `slots.find()` undefined → 拋「新時段不在開放時段內」。

**為何新增不受影響**：人工新增走 `createManualBooking`（直接 insert、不查開放時段），所以任何時間都成功。只有「改時間」走 `updateBooking` 才觸發開放時段檢查。

## 解決方案（首選：根治、不動資料/schema）

`getBookingConfig` 先用 `fields` 表把傳入值（UUID 或 code）正規化成 `id + code`，再用兩者一起比對 `booking_configs`。一處修好，`getAvailability`／預約頁／所有用 config 的地方全受惠。

```ts
const [field] = await db.select({ id: fields.id, code: fields.code }).from(fields)
  .where(sql`${fields.id} = ${fieldId} OR lower(${fields.code}) = lower(${fieldId})`).limit(1);
const cond = field
  ? sql`lower(${bookingConfigs.fieldId}) IN (lower(${field.id}), lower(${field.code}))`
  : sql`lower(${bookingConfigs.fieldId}) = lower(${fieldId})`;
```

## 驗證

- `npx tsc --noEmit` 通過
- 生產 DB 模擬新查詢：`getBookingConfig('72cc204d-…')` → 找到 `JIACHUN` config（啟用）✓

## 已知限制 / 後續

- 次要可選（未做）：`updateBooking` 改時間的時段比對目前用 `toISOString()` 字串比對；現行時段皆整點（毫秒 .000Z）不會出錯，故先不動。若未來有非整點時段，建議改 `getTime()` 數值比對與新增路徑一致。
- 根本面：`field_id` UUID/code 混存是歷史遺留，長期應統一（見 6/24 CHANGELOG）。

## 相關文件

- [domains/multi-field.md](../domains/multi-field.md)
