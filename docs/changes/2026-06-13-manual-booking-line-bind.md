# 手動預約 → LINE 綁定閉環 — 2026-06-13

> 範圍：預約來源整合｜狀態：完成待部署

## 背景
顧客 LINE 直訂流程順暢；但電話/信箱/現場的手動預約沒進 LINE → 無提醒、難查詢。
需求：手動建單後產短連結，顧客點了綁 LINE（順便建遊戲帳號），所有來源都歸整到 LINE，
方便提醒與自助查詢。不綁也可以（只是沒通知、難查），系統記錄來源。

## 流程
```
現場手動建單(電話/信箱/現場) → 系統產短連結 game.homi.cc/b/<預約碼>
  → 顧客點 → /b/<碼> 看摘要 → 「用 LINE 綁定接收提醒」
  → LINE OAuth(既有) → 自動建遊戲帳號(line:<userId>)
  → callback 伺服器端把預約綁到此 LINE(line_user_id + source=manual_linked)
  → 回 /b/<碼> 顯示「已綁定」+「查看我的預約」
綁定後：booking-reminder-cron 自動提醒、MyBookings 可查
```

## 影響範圍
- `shared/schema/bookings.ts`：加 `source` 欄位（line_direct / manual / manual_linked）
- `server/booking/booking-service.ts`：createManualBooking 標 source=manual；新增
  getBookingSummaryByCode（公開最小摘要、名稱遮罩、含 fieldCode）、bindBookingLine（只綁未綁的）
- `server/routes/auth-line-login.ts`：OAuth 帶 `bindBooking` 進 state、callback 完成綁定
- `server/routes/bookings.ts`：新增公開 `GET /api/bookings/by-code/:code`
- `client/src/pages/booking/BindBookingPage.tsx`：新短連結頁 `/b/:code`
- `client/src/pages/admin/AdminBookings.tsx`：人工登記後顯示+複製綁定短連結
- `App.tsx`：`/b/:code` 路由

## 設計重點
- 短連結用既有 `bookingCode`（本就短）→ /b/<code>，免新欄位
- 綁定在 LINE callback **伺服器端**完成（bookingCode 帶進 OAuth state）→ 顧客零摩擦、最穩
- 只綁「line_user_id 仍是 manual: 前綴」的預約，不覆蓋既有 LINE 直訂
- 公開摘要遮罩名稱（王＊＊）避免短連結被猜到看到全名
- DB 查詢只 select 需要欄位（避開本地 schema drift，如 checked_in_at）

## 需在生產 DB 跑（部署時）
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source varchar(20) DEFAULT 'line_direct';
```

## 驗證
- tsc PASS；shared + audit 92 單元 passed
- by-code 端點回正確摘要（遮罩名/fieldCode/alreadyBound）；/b/:code 頁渲染正常
- 完整 LINE OAuth 綁定需真 LINE 帳號（生產驗證）

## 已知限制
- 短連結用 bookingCode（可被猜）；綁定需顧客自己 LINE 登入（綁到陌生人預約風險低、僅多收提醒），未加 phone 末４碼驗證
- 單場域：賈村；多場域同機制可複用
