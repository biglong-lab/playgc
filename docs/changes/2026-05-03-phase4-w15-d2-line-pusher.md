# Phase 4 W15 D2 — LINE Pusher + activity reminder endpoint

**日期**：2026-05-03
**範圍**：W15 D2、line-pusher lib + admin notify endpoint
**狀態**：🟢 W15 D2 完成、admin 可主動推播 LINE 通知

---

## 🎯 目標達成

> Phase 4 W15 D1 完成 LINE Bot scaffold（被動接收 + echo）
> W15 D2 補上主動推播：activity created / reminder / ended 三種通知

---

## 📦 新增

### 1. `server/lib/line-pusher.ts`

**3 個高層 helper**：

```ts
pushActivityCreated({ userId, displayName, activityName, playUrl, startsAt? })
pushActivityReminder({ userId, displayName, activityName, playUrl, remindType: "24h"|"1h" })
pushActivityEnded({ userId, displayName, activityName, recapUrl?, closingMessage? })
```

**訊息範本範例**：

`activity-created`：
```
🎉 {displayName} 您好！

「{activityName}」已準備好，請點以下連結進入：

{playUrl}

🕐 開始時間：5/15 18:00

（透過 LINE 點擊可自動帶入您的名字）
```

`reminder-24h`：
```
📅 提醒一下、明天「{activityName}」就要開始囉！

{displayName}，到時候再用以下連結進入：
{playUrl}
```

`activity-ended`：
```
🎊 {displayName}，「{activityName}」已結束！
{closingMessage}

📸 回顧連結：{recapUrl}
```

### 2. `broadcastToUsers()` helper

整批推播 + 100ms throttle（避免 LINE 1000/min rate limit）：
```ts
const result = await broadcastToUsers(playerList, pushActivityReminder);
// → { success: 95, failed: 5 }
```

### 3. `POST /api/admin/scenarios/notify-line`

```http
POST /api/admin/scenarios/notify-line
Authorization: <admin session>

{
  "userId": "Uxxxxx",
  "displayName": "Hung",
  "activityName": "Hung & Anita 5/15 婚禮",
  "playUrl": "https://game.homi.cc/liff/play/abc",
  "type": "created",  // created | reminder-24h | reminder-1h | ended
  "recapUrl": "...",       // ended 用
  "closingMessage": "..."  // ended 用
}
```

回應：`{ ok: true, type, dispatched: true, to: userId }`

未設環境變數 → 503 + LINE_BOT_NOT_CONFIGURED。

### 4. Smoke test 4c3

- POST `/api/admin/scenarios/notify-line` 無認證 → 401

從 43 → **44 個檢查**

---

## 💡 設計決策

### 為何單一 endpoint 處理 4 種 type？

選擇：`type` switch 而非 4 個 endpoint

理由：
- 簡化 admin UI（同一個按鈕、不同 dropdown）
- 共用驗證邏輯
- 未來加新 type 不增 endpoint

### 為何 throttle 100ms？

選擇：每則間隔 100ms = 600 則/min

理由：
- LINE Messaging API 限制 1000/min
- 留 buffer 給其他 push（如 webhook 觸發的）
- 100ms 足夠順、客戶端等不久

### 為何不 cron 自動推？

選擇：W15 D2 純手動觸發、cron 留 W15 D5

理由：
- W15 D2 重點是 helper + endpoint
- cron 需要 schema（記錄活動開始時間 + 玩家名單）
- 漸進式：先做手動、後做自動

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**44/44 全綠**

---

## ⏭ 下一步：W15 D3-D5

- W15 D3：admin 文字建場（DeepSeek NLU）
- W15 D4：活動後推播鉤子（從 host_session 完成事件觸發）
- W15 D5：W15 收尾 + W16 規劃

---

## 🔗 相關文件

- [W15 D1 Bot scaffold](2026-05-03-phase4-w15-d1-line-bot-scaffold.md)
- [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)
