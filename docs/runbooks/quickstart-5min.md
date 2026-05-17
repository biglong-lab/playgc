# 5 分鐘上手 — CHITO 場域數位營運

> 對象：第一次用 CHITO 的場域業主
> 目標：5 分鐘內讓玩家能在 LINE 線上預約 + 現場 POS 掃 QR 收款

---

## 🎯 目標
讓 1 個活動上線：玩家透過 LINE 預約 → 收到 QR 卡片 → 現場掃 QR 報到 → 工作人員收款

## ✅ 5 步驟

### 步驟 1：建活動（1 分鐘）

1. https://game.homi.cc/admin → 用 admin 帳號登入
2. 左側選單 → **遊戲中心 → 🎯 活動管理**
3. 點右上「**新增活動**」
4. 必填三項：
   - 活動名稱：「賈村射擊體驗」
   - Slug：`shooting`（英數和 -、URL 用）
   - 單人價：800
5. **儲存**

> 💡 想複製多個活動？點該活動卡片上的 **📋 複製**按鈕即可

### 步驟 2：設定 LINE（一次設定、永久使用）

到 LINE Developers Console 建一個 Messaging API channel + LIFF App，然後：

1. https://game.homi.cc/admin/line-config
2. 填 4 個欄位：
   - Channel ID
   - Channel Secret
   - Channel Access Token
   - LIFF ID
3. **儲存** + 啟用開關打開

> 📖 詳細：[runbooks/multi-activity-pos.md](multi-activity-pos.md)

### 步驟 3：測試預約流程

打開手機 LINE、點連結：`https://game.homi.cc/book/{你的場域代碼}`

1. 看到你剛建的活動卡片
2. 點「立即預約」→ 選日期 + 時段 → 填人數 → 送出
3. 在 LINE 收到 Flex 卡片（含 QR Code）

> 💡 沒收到 LINE 訊息？確認你的 LINE 已加官方好友、且 channel access token 正確

### 步驟 4：現場 POS 工作站

1. 拿一支手機開 https://game.homi.cc/pos
2. 用 admin 帳號登入（建議建 `pos_operator` 專屬帳號）
3. 看到大字 Dashboard：
   - 今日預約 N 組
   - 已到場 / 已收款 / 待現場付款
4. 玩家到場 → 點「掃描 QR」→ 對準客人手機 QR → 自動辨識
5. 點「現場收款」→ 確認金額 → 客付現金、找零自動算 → 確認
6. 收款員姓名 + 時間自動紀錄

### 步驟 5：查看今日小結

1. POS 底部 tab → **小結**
2. 看到今日總收款大字
3. 按活動 / 按收款員分組
4. **CSV 匯出**給會計

---

## 🚀 進階打磨（自選）

| 想做 | 怎麼做 |
|------|--------|
| 多活動排序 | 活動卡片底部「⬆️⬇️」按鈕 |
| 每活動獨立時段 | 活動卡片「📅 時段」按鈕 |
| 設定指定預約活動的 admin filter | AdminBookings → 「活動」下拉 |
| 玩家分享活動給朋友 | BookDonePage 已內建「📤 分享給朋友」按鈕（Web Share + 連結複製） |
| 業主行銷材料 | 玩家完成體驗自動發券、下次來掃券折抵（rewardConversionRules 設定）|

---

## ⚠️ 常見問題

### 預約失敗顯示「伺服器錯誤」
通常是欄位問題。最常見：
- 該時段不在開放時段內 → 確認 booking_configs 或 activity_schedules 有覆蓋該時段
- lineUserId 太短 → 預期 LINE 真實 userId（≥18 字元）

### 玩家掃 QR 後看不到他的預約
- 可能是其他場域的 QR
- 或玩家給錯預約碼

### 想設線上付款（信用卡）
目前線上付款預留欄位、串接 Recur.tw / Stripe / LinePay 需業主有商戶帳號後再上線。線下付款功能已完整可用。

---

## 📞 需要協助？

完整文件：
- [多活動 + POS 操作手冊](multi-activity-pos.md)
- [系統變動紀錄](../CHANGELOG.md)
- [完整設計文件](../changes/2026-05-18-multi-activity-pos.md)
