# Phase 3 W10 D2 — Recur.tw API client 整合

**日期**：2026-05-02
**範圍**：W10 D2、Recur.tw client + endpoints + smoke test 擴充
**狀態**：🟢 W10 D2 完成、Recur.tw 路徑就緒（待 admin 設定 RECUR_TW_API_KEY 即可啟用）

---

## 🎯 目標達成

> Phase 3 W10 D1 完成 Stripe scaffold + Pricing 頁
> ADR-0006 切換 Recur.tw 主導
> W10 D2 啟動 Recur.tw API client + endpoints

---

## 📦 新增

### 1. `server/lib/recur-tw.ts`

依 [docs.recur.tw](https://docs.recur.tw/) 文件實作（用 fetch 不裝 SDK）：

**核心 API**：
- `createRecurCheckoutSession({ apiKey, mode, productId, successUrl, cancelUrl, customerEmail?, metadata? })`
- `verifyRecurWebhookSignature(payload, signature, webhookSecret)` — TODO（W10 D5 補實作）

**參數**：
- `apiKey`：sk_test_* 或 sk_live_*（Bearer token）
- `mode`：`PAYMENT`（一次性）/ `SUBSCRIPTION`（訂閱）
- `productId`：在 Recur.tw 後台預先建立的產品 ID
- `metadata`：自訂資料（webhook 會回傳）

**API base**：`https://api.recur.tw/v1`

### 2. `server/routes/payments.ts` 擴充

新增 2 個 endpoint：

**`POST /api/payments/recur/create-checkout`**（公開）
- Body: `{ scenarioId, productId, mode?: "PAYMENT"|"SUBSCRIPTION", customerEmail? }`
- 回應：`{ checkoutUrl, sessionId }`
- 503：未設 RECUR_TW_API_KEY
- 400：缺 scenarioId / productId

**`POST /api/payments/recur/webhook`**
- 接收 Recur.tw 付費完成事件
- TODO（W10 D5）：簽章驗證 + 解鎖權限 + 寄付費通知

### 3. Health endpoint 擴充

`GET /api/payments/health` 新增欄位：
```json
{
  "status": "ok",
  "stripeConfigured": false,
  "recurTwConfigured": false,    // 新
  "recurWebhookConfigured": false, // 新
  "timestamp": "..."
}
```

### 4. Smoke test 擴充

`scripts/smoke-test-scenarios.mjs` 加 Section 4f：
- POST `/api/payments/recur/create-checkout`（缺欄位 → 400 或 503）
- 接受 400 / 503（兩者都是 expected behavior）

從 28 → **29 個檢查**

---

## 💡 設計決策

### 為何沒裝 recur-tw npm SDK？

選擇：fetch 直接打 API（與 stripe-checkout.ts 風格一致）

理由：
- 文件透露 Recur.tw API 結構與 Stripe 雷同（POST /v1/checkout/sessions）
- 不增加新 dependency
- 統一 fetch 風格、未來換 vendor 容易
- Recur.tw 沒有官方 Node SDK（目前文件未列出）

### 為何 productId 設計成「在後台建立」？

選擇：admin 在 Recur.tw 後台建產品 → API call 帶 productId

理由：
- Recur.tw 設計如此（與 Stripe 一致 — Product / Price 物件）
- 定價策略集中在 Recur.tw 後台（admin 友善）
- API 不負責定價邏輯（單一責任）
- 未來換 vendor 也只需改 productId 對應

### 為何 webhook 簽章驗證留 TODO？

選擇：W10 D5 才補實作

理由：
- W10 D2 重點是 endpoint scaffold + Pricing 切換流程
- 簽章驗證需查 Recur.tw 文件細節（HMAC SHA-256 規格）
- 開發階段可先不驗（測試環境用）
- 上線前必補（紅線）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**29/29 全綠**

---

## ⏭ 下一步：W10 D3-D5

- W10 D3：Pricing 頁切換到 Recur.tw（Stripe 退場為 fallback）
- W10 D4：用量配額追蹤（games 表加 metering）
- W10 D5：Resend 信件 + Recur webhook 簽章驗證

---

## 🔗 相關文件

- [ADR-0006 Recur.tw 主導](../decisions/0006-payment-system.md)
- [W10 D1 付費 scaffold](2026-05-02-phase3-w10-d1-payment-scaffold.md)
- [Recur.tw 官方文件](https://docs.recur.tw/)
