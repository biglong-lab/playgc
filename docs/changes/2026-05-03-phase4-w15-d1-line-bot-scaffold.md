# Phase 4 W15 D1 — LINE Bot scaffold

**日期**：2026-05-03
**範圍**：W15 D1、line-bot lib + webhook receiver + smoke test
**狀態**：🟢 W15 D1 完成、Bot 預設 echo（待 admin 設環境變數啟用）

---

## 🎯 目標達成

> Phase 4 W14 完成 LIFF（玩家被動入口）
> W15 D1 補上 Bot scaffold（雙向溝通基礎）

---

## 📦 新增

### 1. `server/lib/line-bot.ts`

**核心函式**：
- `verifyLineSignature(rawPayload, signature, channelSecret)` — HMAC SHA-256 + base64
  - 用 `crypto.timingSafeEqual` 防 timing attack
- `replyMessage({ accessToken, replyToken, messages })` — Reply API（30 秒內）
- `pushMessage({ accessToken, to, messages })` — Push API（W15 D2 用）

**Type 定義**：
- `LineMessage`（text / image / sticker）
- `LineWebhookEvent`（type / source / message）
- `LineWebhookBody`（events 陣列）

### 2. `server/routes/line-webhook.ts`

**端點**：
- `GET /api/webhooks/line/health`（公開、含 lineBotConfigured 欄位）
- `POST /api/webhooks/line`（接收 events）

**處理流程**：
1. 取 `req.body` raw（用 `express.raw({ type: "application/json" })`）
2. 驗證 X-Line-Signature
3. 解析 events
4. 處理（fire-and-forget）
5. 立即回 200（LINE 期望 < 5 秒）

**W15 D1 預設行為**：
- echo bot：「您說：xxx（W15 D1 echo mode）」
- 只處理 text message
- 略過其他 event type

**未設環境變數**：503 + LINE_BOT_NOT_CONFIGURED error code

### 3. 環境變數

| 變數 | 說明 |
|------|------|
| `LINE_CHANNEL_SECRET` | 簽章驗證 |
| `LINE_CHANNEL_ACCESS_TOKEN` | reply / push API |

需在 [LINE Developers Console](https://developers.line.biz/) 申請 Bot Channel。

### 4. Smoke test 5h

- GET `/api/webhooks/line/health` → 200 + `lineBotConfigured` 欄位
- POST `/api/webhooks/line`（無簽章）→ 401 / 503 graceful

從 41 → **43 個檢查**

---

## 💡 設計決策

### 為何用 express.raw 而非 json parser？

選擇：raw body parser

理由：
- LINE 簽章驗證必須用「原始 bytes」
- 若 Express json parser 先 parse → 重新 stringify 可能換序、簽章失敗
- raw 取得後再手動 JSON.parse 安全

### 為何 fire-and-forget？

選擇：events 處理不阻擋 200 回應

理由：
- LINE 期望 < 5 秒回應
- DeepSeek NLU 可能 5-10 秒
- 處理慢 → LINE 重試 → 重複處理（idempotency 問題）
- 改 fire-and-forget：先回 200、後台處理

### 為何只處理 text message？

選擇：W15 D1 限制 text

理由：
- 大部分 use case 是 text（@chito 婚禮 / 報名）
- image / sticker 後續 W15 D2-D3 視需求加
- 簡化 W15 D1 範圍

### 為何 timingSafeEqual？

選擇：用 crypto.timingSafeEqual

理由：
- 防 timing attack（攻擊者用回應時間推斷 secret）
- LINE 官方建議的驗章方式
- Node 內建、不增依賴

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**43/43 全綠**

---

## ⏭ 下一步：W15 D2-D5

- W15 D2：推播（24h / 1h 前活動提醒）
- W15 D3：admin 文字建場（DeepSeek NLU）
- W15 D4：活動後推播 + 回顧連結
- W15 D5：W15 收尾 + W16 規劃

---

## 🔗 相關文件

- [ADR-0010 LINE Bot 整合](../decisions/0010-line-bot-integration.md)
- [W14 完整收尾](2026-05-03-phase4-w14-complete.md)
- [LINE Messaging API 文件](https://developers.line.biz/en/reference/messaging-api/)
