# ADR-0020: 多活動預約 + POS 工作站架構

> 日期：2026-05-18
> 狀態：採用中
> 影響：大 — 新增 activities/activity_schedules/pos_transactions 三表、新增 13 endpoint、10 UI 頁、6 permissions

## 背景

業主需求（5/18）：把賈村平台從「一館一預約」升級成「一館多活動 + 現場 POS」，讓場域有實質可重複的收入機制。

當時系統限制：
- `booking_configs` 是 `1:1 fieldId`、不能設多種活動
- 沒有現場 POS 工具、admin 27 頁太複雜
- 預約、體驗、券核銷分散、無整合
- 線上金流欄位已有、但實際串接未上線

## 選項

| 方案 | 優點 | 缺點 |
|------|------|------|
| **A. 重構 booking_configs** | 改動最少 | schema 衝擊大、影響既有預約 |
| **B. 新表 activities** | 向下相容、各自獨立 | 多一張表、需設計 fallback 邏輯 |
| **C. 改用 products 統一模型** | 通用性高 | 過度設計、Phase 4-C 高風險 |

## 決定

採 **方案 B：新增 activities 表 + activityId nullable**

### 核心理由
1. **向下相容**：`bookings.activityId` 可為 null、既有預約不受影響
2. **獨立性**：每個活動可獨立封面 / 價格 / 時段 / capacity / paymentMode
3. **可漸進**：場域可選擇用 activity 模式或 fallback booking_configs
4. **避免 Phase 4-C 重構風險**：products 表 over-engineering、活動就用 activities

### Schema 設計
```
activities
├─ id, fieldId, slug, name, shortDesc, description, coverUrl, locationNote
├─ priceCents, currency, durationMinutes, capacityPerSlot
├─ paymentMode (online|onsite|both)
├─ isActive, sortOrder
└─ UNIQUE(fieldId, slug)

activity_schedules（per-activity 時段、可選）
├─ activityId（FK）
├─ scheduleTemplate (JSONB)
└─ cancellable / reminderMinutesBefore

bookings 加 7 欄位（全 nullable、向下相容）
├─ activityId, paymentMode
├─ paidByStaffId, paidAt, paidAmountCents（POS 收款 trace）
├─ qrToken（POS 掃描安全碼）
└─ checkedInAt, checkedInByStaffId（報到 trace）

pos_transactions（POS 收款紀錄）
├─ fieldId, staffId, bookingId, activityId
├─ amountCents, paidAmountCents, paymentMethod
├─ voucherId, voucherDiscountCents
├─ customerName, customerPhone, note
└─ shiftCloseId（班次結算用）
```

### Fallback 設計
- BookEntryPage 智能判斷：有 activities → 列表頁、沒有 → 既有 BookPage
- getAvailability 接 activityId：優先 activity_schedules、fallback booking_configs
- createBooking 接 activityId：用 activity.priceCents 覆寫、否則 booking_configs

### POS 為什麼獨立 `/pos` 而不是 `/admin/pos`
- mobile-first、與 27 頁 admin 完全不同 UX
- 給現場人員專用、避免進到設定頁出錯
- 獨立 layout 含底部 6 tab 導航
- 之後 pos_operator 角色可只進 /pos、不進 /admin

### QR Token 設計
- Format: `BK_<base64url 28 chars>` = 31 字元
- 用 crypto.randomBytes(28) 產、不只是 bookingCode（避免猜）
- 寫入 bookings.qr_token、POS 掃描時匹配
- LINE Flex Message 和 BookDonePage 都用同一 token 顯示 QR

### 線上金流為什麼預留但不串
- 業主明確 5/18 確認：「金流可以預留、之後再處理」
- 業主還沒有 Recur.tw / Stripe / LinePay 商戶帳號
- 後端 booking-service 在 paymentMode=online 時自動 fallback 為 onsite（避免玩家卡關）
- AdminActivities online / both 選項 disabled、業主只能選 onsite
- 等業主有商戶帳號 → 移除 fallback + 加 checkout endpoint

## 影響

### 程式碼
- **新檔**：9 個（3 schema + admin-activities + public-activities + pos + line-login-config + 4 UI 元件）
- **改動**：booking-service.ts (createBooking + getAvailability) / booking-notifier.ts (Flex Message)
- **新 endpoint**：13 個 + 6 個既有 endpoint enrichment
- **新 UI**：10 個頁面（admin 1、玩家 3、POS 6）

### 紅線
- ❌ Schema 只 ADD COLUMN、無 DROP（守 schema 紅線）
- ❌ booking_configs 保留、向下相容（既有預約不破）
- ❌ 線上金流預留欄位、不誤導玩家（online 自動 fallback）

### 已知限制
1. activity_schedules 編輯目前用 ScheduleEditor、視覺上和 booking_configs 一致（業主可能混淆）
2. 線上金流串接後、需移除 createBooking 的 fallback 邏輯
3. pos_operator 角色 permissions seed 完成、但 admin UI「指派角色」還沒整合 pos:* 6 個 permission 進選單（業主目前手動指派）

## 後續可能變動

| 情境 | 重新評估 |
|------|---------|
| 業主取得 Recur.tw 商戶帳號 | 移除 online fallback、實作 checkout endpoint |
| 業主想為單一活動多區塊（如「水彈 A 區 / B 區」） | 加 activity_zones 表 |
| 第二、三、四個場域加入 | 確認 multi-field 隔離（已內建） |
| 線上付款 + 退款流程 | 接 Phase 4-A 退款管理（task #34）|

## 相關文件

- 變動紀錄：[changes/2026-05-18-multi-activity-pos.md](../changes/2026-05-18-multi-activity-pos.md)
- 業主操作手冊：[runbooks/multi-activity-pos.md](../runbooks/multi-activity-pos.md)
- 5 分鐘快速啟用：[runbooks/quickstart-5min.md](../runbooks/quickstart-5min.md)
- 取代既有計畫：Phase 4-C 統一商品資料模型（task #36、暫不執行）

## 取代/被取代

- 取代：[ADR-0006 payment-system](0006-payment-system.md) 部分內容（POS 為主、線上預留）
- 補足：[ADR-0010 line-bot-integration](0010-line-bot-integration.md)（per-field LINE 已 ADR-0010 處理）
- 啟動：Phase 4-A 退款（task #34、等業主商戶帳號）
