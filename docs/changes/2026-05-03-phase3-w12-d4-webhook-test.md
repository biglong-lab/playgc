# Phase 3 W12 D4 — Webhook 測試 endpoint + SDK 擴充

**日期**：2026-05-03
**範圍**：W12 D4、新 endpoint + SDK 加 webhooks resource + OpenAPI 更新
**狀態**：🟢 W12 D4 完成、代理商 onboarding 階段可主動測試

---

## 🎯 目標達成

> Phase 3 W12 D3 完成 webhook outbound 派送
> W12 D4 補上「代理商可主動觸發測試」 — 整合驗證更輕鬆

---

## 📦 新增

### 1. `POST /api/v1/webhooks/test`

代理商主動觸發一次測試 webhook：
- 不影響真實事件流
- 用途：onboarding 階段驗證 webhook URL + 簽章驗證
- 必須先設環境變數 `API_KEY_WEBHOOK_URL_<keyIdShort>`
- 未設 → 400 + `webhook_not_configured` error code

**回應**：
```json
{
  "object": "webhook_test",
  "dispatched": true,
  "url": "https://agency.example.com/webhook/chito",
  "eventType": "webhook.test",
  "message": "測試事件已派送、請檢查您的 webhook endpoint"
}
```

**事件 payload**（送到代理商）：
```json
{
  "id": "evt_xxx",
  "type": "webhook.test",
  "createdAt": "...",
  "data": {
    "message": "這是測試 webhook、不對應真實活動",
    "keyId": "ck_test_***...123",
    "label": "Wedding Co.",
    "timestamp": "..."
  }
}
```

### 2. OpenAPI 更新

新增 `/keys/me` + `/webhooks/test` 兩個 path 的 schema。

完整 paths 數量從 5 增至 7。

### 3. SDK `chito.webhooks.test()`

```ts
const result = await chito.webhooks.test();
// → { dispatched: true, url, eventType, message }
```

代理商可在自家測試環境中：
```ts
const me = await chito.keys.me();
console.log(`配額：${me.quota}`);
const test = await chito.webhooks.test();
console.log(test.message);
// → 接著去看自家 webhook endpoint log 確認收到 + 簽章正確
```

### 4. Smoke test 5f

- POST `/api/v1/webhooks/test` 無 key → 401

從 39 → **40 個檢查**

---

## 💡 設計決策

### 為何不直接讓代理商設自己的 webhook URL？

選擇：admin 設環境變數、不開 API 自助設定

理由：
- W12 D4 階段代理商少
- 自助設定要寫 admin endpoint + UI
- 環境變數 + 業務人工配對 速度快
- 未來改 DB 表（`api_keys.webhookUrl`）

### 為何測試事件類型用 `webhook.test`？

選擇：明確命名（不混入業務事件）

理由：
- 代理商可在 webhook handler 中略過 `webhook.test` 事件
- 不誤觸發業務邏輯（如建單 / 通知）
- 符合 Stripe 慣例（events.test_webhook）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**40/40 全綠**

---

## ⏭ 下一步：W12 D5

- W12 D5：Phase 3 整體收尾文件 + Phase 4 規劃

---

## 🔗 相關文件

- [W12 D3 Webhook dispatcher](2026-05-03-phase3-w12-d3-webhook-dispatcher.md)
- [W12 D2 TypeScript SDK](2026-05-03-phase3-w12-d2-typescript-sdk.md)
- [代理商 onboarding](../runbooks/agency-onboarding.md)
