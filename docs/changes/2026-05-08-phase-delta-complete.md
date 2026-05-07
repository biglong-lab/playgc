# Phase δ 完整收尾 + 方案 C 整合 — 2026-05-08

> 範圍：預約系統（Booking）+ LINE 通知 + Telegram 內部通知 + Rich Menu + Battle 對齊
> 狀態：🟢 生產上線 commit `df22764c`、e2e 5/5 全綠、賈村已 init
> 部署：booking schema migrated + jiacun preset + TZ=Asia/Taipei + Telegram chat_id 5858549388

---

## 1. 背景

W14 D1 LINE LIFF MVP 後、客戶端（玩家）有 LINE 整合、但**業主缺場域預約工具**。
2026-05-07 user 提出「場地需要預約工具 + LINE 提醒迴圈 + 結束送禮」需求、開啟 Phase δ。

過程中 user 釐清關鍵架構決策：
- 商家後台**不在我們系統內做**、用 [coupon.aihomi.cc](https://coupon.aihomi.cc/) 串接（spec 已給對方）
- 預約系統**不要與遊戲整合**、現場活動為主、業主手動標記完成觸發 game_completed 推播
- 水彈對戰系統 vs 預約系統選**方案 C 獨立但對齊基礎設施**

---

## 2. 11 個 commit 完整列表（依時序）

| # | Phase | Commit | 範圍 |
|---|-------|--------|------|
| 1 | W1 D1 | `483116d6` | Schema 4 表 + rule-based template + schedule resolver |
| 2 | W1 D2 | `622f104d` | 16 玩家 + 14 admin endpoints + booking-service + e2e 5/5 |
| 3 | W1 D3 | `b1038fe7` | LIFF 預約頁 + 完成頁 + 我的預約 |
| 4 | W1 D4 | `1ad7f23f` | Admin 4-tab 管理頁（列表 / 設定 / 黑名單 / 通知模板）|
| 5 | W2 D1 | `19ddeec2` | LINE 通知 service（5 種訊息）+ 30 分鐘前提醒 cron |
| 6 | W3 D1 | `50db78d3` | Telegram bot 內部通知（10 事件）+ admin endpoint |
| 7 | W3 D5 | `0e45a875` | LINE Rich Menu 6 鍵 + postback dispatcher |
| 8 | Deploy | `c375649a` | 生產上線（schema migration + jiacun init + TZ）|
| 9 | W1 D5 | `a1c0c66b` | ScheduleEditor 月曆勾選 + 規則編輯 + 選單入口 |
| 10 | P0 補 | `9db81349` | 業主標記完成 / no-show + 30 天區間 + 場域錯誤 |
| 11 | 方案 C | `df22764c` | Battle 接 internal-notifier（4 事件）+ rich menu 加水彈鈕 |

---

## 3. 完整檔案清單

### 新增（11 個）
```
shared/schema/bookings.ts                                          (374 行)
server/booking/schedule-resolver.ts                               (196 行)
server/booking/booking-service.ts                                 (508 行)
server/booking/booking-notifier.ts                                (264 行)
server/booking/booking-reminder-cron.ts                           (90 行)
server/lib/telegram-bot.ts                                        (157 行)
server/lib/internal-notifier.ts                                   (368 行)
server/lib/line-rich-menu.ts                                      (244 行)
server/routes/bookings.ts                                         (170 行)
server/routes/admin-bookings.ts                                   (442 行)
client/src/pages/booking/BookPage.tsx                             (440 行)
client/src/pages/booking/BookDonePage.tsx                         (180 行)
client/src/pages/booking/MyBookingsPage.tsx                       (110 行)
client/src/pages/admin/AdminBookings.tsx                          (820 行)
client/src/pages/admin/booking/ScheduleEditor.tsx                 (889 行)
migrations/manual/2026-05-07-booking-system.sql                   (60 行)
```

### 修改
```
shared/schema/index.ts                       (加 booking exports)
client/src/App.tsx                           (加 4 個 routes + lazy import)
client/src/config/admin-menu.ts              (加「📅 預約管理」)
client/src/components/CommandPalette.tsx     (⌘K 搜尋項)
server/routes/index.ts                       (註冊 booking routes)
server/routes/line-webhook.ts                (postback dispatcher + 關鍵字)
server/lib/line-bot.ts                       (LineWebhookEvent.postback)
server/index.ts                              (boot cron + Telegram boot)
server/booking/booking-service.ts            (createBooking 串 LINE + Telegram)
server/routes/battle-registration.ts         (接 Telegram 報名通知)
server/routes/battle-results.ts              (接 Telegram 結束通知)
.env / .env.example / .env.production.example  (加 TELEGRAM env)
```

---

## 4. DB Schema（4 新表）

| 表名 | 用途 |
|------|------|
| `booking_configs` | 場域預約設定（每場域一筆、含 schedule_template）|
| `bookings` | 預約紀錄（LINE 身份、付費、通知 trace、遊戲整合可關聯）|
| `booking_blackouts` | 業主臨時關閉時段 |
| `booking_notification_templates` | 預約通知訊息模板（業主自訂）|

migration: [`migrations/manual/2026-05-07-booking-system.sql`](../../migrations/manual/2026-05-07-booking-system.sql)（生產已 apply）

---

## 5. API 端點（30 個）

### 玩家（6）
- `GET /api/bookings/availability/:fieldId` - 30 天區間 slots
- `GET /api/bookings/config/:fieldId` - 場域預約設定（不含私人欄位）
- `POST /api/bookings` - 建預約
- `GET /api/bookings/mine?lineUserId=` - 玩家所有預約
- `GET /api/bookings/:bookingCode?lineUserId=` - 單筆查看
- `POST /api/bookings/:bookingCode/cancel` - 玩家自助取消

### Admin（含 requireAdminAuth）
- `GET/PUT /api/admin/bookings/:fieldId/config` - 場域設定
- `POST /api/admin/bookings/:fieldId/init` - 一鍵初始化（jiacun preset）
- `GET /api/admin/bookings/:fieldId/list` - 列表（filter）
- `POST /api/admin/bookings/:bookingCode/cancel` - admin 強制取消
- `POST /api/admin/bookings/:bookingCode/mark-completed` - 標記完成 + 推 LINE
- `POST /api/admin/bookings/:bookingCode/mark-no-show` - 標記未到場
- `GET/POST/DELETE /api/admin/bookings/:fieldId/blackouts(/:id)` - 黑名單 CRUD
- `GET/PUT /api/admin/bookings/:fieldId/templates(/:key)` - 通知模板
- `GET/POST /api/admin/telegram/status,test` - Telegram 狀態 + 測試
- `GET /api/admin/line/rich-menu/preview` - Rich menu PNG 預覽
- `POST /api/admin/line/rich-menu/setup` - 一鍵建立 + 上傳 + 設預設
- `GET /api/admin/line/rich-menu/list` - 列現有
- `DELETE /api/admin/line/rich-menu/:id` - 清舊版

---

## 6. 通知整合（14 種 Telegram 事件）

### Booking
1. `notifyBookingCreated` - 新預約
2. `notifyBookingCancelled` - 取消（含 admin/self 區分）

### 系統
3. `notifyDeploy` - 部署完成
4. `notifySystemError` - 系統錯誤（含 30 秒冷卻）
5. `notifyServerBoot` - server 啟動

### 商業
6. `notifyPaymentReceived` - 新付款

### 玩家活動
7. `notifyPlayerJoined` - 玩家進入
8. `notifyPlayerCompleted` - 玩家完成

### 監控
9. `notifySmokeFail` - smoke test 失敗
10. `notifyDailyReport` - 每日早報
11. `notifyQuotaAlert` - LINE / Cloudinary / AI 配額告警

### Battle（方案 C）
12. `notifyBattleRegistered` - 水彈報名
13. `notifyBattleSlotConfirmed` - 場次成局
14. `notifyBattleSlotFull` - 場次滿員
15. `notifyBattleCompleted` - 對戰結束

### LINE 通知（玩家、5 種、含 quota cooldown）
- booking_confirmed - 預約成功（push, 1 quota）
- reminder_30min - 開始前 N 分鐘（push, 1 quota, cron）
- game_start_keyword - 玩家傳關鍵字（reply, 0 quota）
- game_completed - 業主標記完成觸發（push, 1 quota）
- booking_cancelled - admin 取消通知（push, 1 quota）

---

## 7. LINE Quota 設計

每客戶最大 push = 3（confirmed + reminder + completed）+ N 個 reply（免費）

| 月客戶量 | 用 push | LINE 月費 |
|---------|---------|----------|
| ≤ 67 | ≤ 200 則 | 免費 |
| 67-1500 | ≤ 5000 則 | NT$880 |
| 1500-8000 | ≤ 25000 則 | NT$1,750 |

---

## 8. 場域 / 入口 / Routes

### 客戶端
- `/book/:fieldCode` - 預約頁（LIFF 自動帶 LINE 名字）
- `/book/:fieldCode/done/:bookingCode` - 完成頁 + 取消
- `/book/:fieldCode/mine` - 我的所有預約

### Admin
- `/admin/bookings` - 預約管理（4 tabs）
- ScheduleEditor 整合於「⚙️ 場域設定」tab 下方
- 加進「🎮 遊戲中心」側選單 + ⌘K 搜尋

### Battle（方案 C 已對齊）
- `/battle` - 對戰中心（既有）
- Rich menu 加紅色「🎯 水彈報名 / PK 賽事」按鈕

---

## 9. 環境變數（必要 / 待設）

### 已設（生產）
- ✅ `TELEGRAM_BOT_TOKEN` = `8678471785:AAEUo47o3qXD-336bbqEPWQ7ooY_JOQsXTg`
- ✅ `TELEGRAM_BOT_USERNAME` = `twchito_bot`
- ✅ `TELEGRAM_NOTIFY_CHAT_IDS` = `5858549388`
- ✅ `APP_BASE_URL` = `https://game.homi.cc`
- ✅ `TZ` = `Asia/Taipei`
- ✅ `RESEND_API_KEY` = `re_HV9eJbvd_3VqhEVdgp5Q8sL33crAahZe4`
- ✅ `EMAIL_FROM` = `noreply@homi.cc`
- ✅ `VITE_FCM_VAPID_KEY` = `FLYaiQXNlVcYNgdg6EHHfHCvhbWUZOuTjIr2dAbXR84`

### 待設（卡 LINE 通知 + LIFF）
- ⚠️ `LINE_CHANNEL_ACCESS_TOKEN` - 從 LINE Developer Console 拿
- ⚠️ `LINE_CHANNEL_SECRET` - webhook 簽章驗證
- ⚠️ `VITE_LIFF_ID_BOOK` - 玩家不再需要 dev fallback 表單
- ⚠️ `VITE_LIFF_ID_BATTLE` - 水彈頁 LIFF（既有 + 待補）

---

## 10. 已知缺口（保留）

### P0（補完即可跑第一場真實活動）
- LINE token 設定（你給）
- LIFF App 建立（你建後給 ID）

### P1（高價值非阻塞）
- CSV 匯出（業主對帳用）
- 玩家搜尋 / filter
- 統計 dashboard（總預約 / 完成率 / 取消率）
- 月曆編輯器：specificDates 多日勾選 UI（schema 支援、UI 缺）
- 規則 reorder（拖拉 priority）
- 規則衝突警告
- 預約完成 QR code（現場報到）
- .ics 行事曆下載
- 改時段（目前只能取消重訂）
- 通知模板「預覽 / 發測試」按鈕
- LINE quota 監控 dashboard

### P2（nice to have）
- 多人折扣 / 會員價
- 候補名單
- 場域多日連續預約
- 模板 A/B test
- Audit log

### 方案 C 後續
- battle 接 LINE notifier（玩家報名成功 push）— 1 小時
- 共用付費 service 抽 common — 4 小時
- Coupon.aihomi.cc 整合（兩邊都用）— 等對方 spec

---

## 11. 待你決定 / 提供（接續用）

| 項目 | 動作 | 影響 |
|------|------|------|
| LINE_CHANNEL_ACCESS_TOKEN / SECRET | 你從 LINE Developer Console 拿給我 | LINE 通知整套活起來、Rich menu 可正式部署 |
| VITE_LIFF_ID_BOOK / BATTLE | 你建 LIFF App 給 ID | 玩家無感登入、不用 dev fallback |
| Telegram token rotate | BotFather `/revoke` 拿新 token | 安全、舊 token 已暴露在 chat |
| Coupon.aihomi.cc spec 對方回 | 等對方平台工程師 review v1.1 spec | 啟動 coupon 串接實作 |
| 第一個試水溫客戶 | 賈村負責人安排測 1-2 場 | 真實上線驗證 |

---

## 12. 下次接續從哪開始

### 路線 A：補 P1 高價值缺口（不卡 LINE token）
- CSV 匯出 + 統計 dashboard - 1 天
- 月曆編輯器補 specificDates UI - 4 小時
- 模板預覽 + 發測試 - 2 小時

### 路線 B：等 LINE token 設定 + 真實 e2e
- 收 LINE token → 設 .env → 建 rich menu → 真實玩家測試流程

### 路線 C：方案 C 後續（battle 接 LINE）
- battle-registration 接 LINE push - 1 小時
- 共用付費 service - 4 小時

### 路線 D：多人穩定盤點優化（user 剛要求）
- 待開始

---

## 13. 相關文件

- [bookings schema](../../shared/schema/bookings.ts)
- [coupon spec v1.1](2026-05-07-coupon-integration-spec.md)
- [CHANGELOG](../CHANGELOG.md)
- [Phase δ migration SQL](../../migrations/manual/2026-05-07-booking-system.sql)

---

**END Phase δ — 2026-05-08**
