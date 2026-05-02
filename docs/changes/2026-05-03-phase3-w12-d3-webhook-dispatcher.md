# Phase 3 W12 D3 — Webhook 反向觸發機制

**日期**：2026-05-03
**範圍**：W12 D3、webhook-dispatcher + v1 整合 + ApiDocs 文件
**狀態**：🟢 W12 D3 完成、代理商可被動接收事件

---

## 🎯 目標達成

> Phase 3 W11 完成 outbound API（代理商呼叫 CHITO）
> W12 D3 補上 inbound：CHITO 主動通知代理商（活動建立 / 過期）

---

## 📦 新增

### 1. `server/lib/webhook-dispatcher.ts`

**核心介面**：

```ts
dispatchWebhook({
  type: "instance.created",
  data: { ... },
  apiKeyId: req.apiKey!.keyId,
  eventId?: string,
})
```

**特色**：
- Fire-and-forget（不阻擋呼叫方）
- 從環境變數查 webhook URL：`API_KEY_WEBHOOK_URL_<keyIdShort>`
- HMAC SHA-256 簽章（避免代理商被偽造請求騙）
- Retry 機制：失敗後 1 / 5 / 15 分鐘各重試一次（in-memory `setTimeout`）
- 4xx 不重試（代理商錯誤、重試也沒用）
- 5xx + network error 進重試

**Headers**：
```
X-CHITO-Event: instance.created
X-CHITO-Event-Id: evt_1735693200_abc123
X-CHITO-Signature: t=1735693200,v1=<hmac_sha256>
```

**Payload envelope**：
```json
{
  "id": "evt_xxx",
  "type": "instance.created",
  "createdAt": "...",
  "data": { /* 事件特定資料 */ }
}
```

### 2. v1.ts POST /instances 整合

```ts
// 建場成功後
const responseBody = { /* 完整 instance 資料 */ };
dispatchWebhook({
  type: "instance.created",
  data: responseBody,
  apiKeyId: req.apiKey!.keyId,
});
res.status(201).json(responseBody);
```

順序：先 dispatch（fire-and-forget）→ 再回 response。
- dispatch 失敗不影響呼叫方
- 代理商不需等 webhook 才能拿到 hostUrl

### 3. ApiDocs 加「📡 Webhook 反向觸發」區段

- 列出事件類型
- Headers 格式說明
- HMAC 簽章驗證 Node 範例（含 `timingSafeEqual` 防 timing attack）
- 重試策略說明

### 4. 環境變數命名

| 環境變數 | 說明 |
|---------|------|
| `API_KEY_WEBHOOK_URL_<keyIdShort>` | 代理商接收 webhook 的 URL |
| `API_KEY_WEBHOOK_SECRET_<keyIdShort>` | HMAC 簽章 secret |

例：API key `ck_test_a3f8b2c4d5e6f7g8...` 的 keyIdShort = `ck_test_`

---

## 💡 設計決策

### 為何 in-memory setTimeout 而非 Redis queue？

選擇：純 in-memory（重啟 process 後遺失）

理由：
- W12 D3 階段代理商少（< 5 個）
- 重啟通常 5 秒、影響範圍小
- 加 Redis 增加維運複雜度
- 未來規模擴大可換 BullMQ

### 為何 fire-and-forget 而非同步等待？

選擇：dispatch → 立即 response

理由：
- 代理商網路狀況不可控（可能 timeout）
- 主流程（建場）成功後就該回 response
- webhook 是「補充通知」而非「核心機制」
- 失敗有 retry 機制保底

### 為何 4xx 不重試？

選擇：4xx 直接放棄、5xx 才重試

理由：
- 4xx = 代理商邏輯錯誤（如 webhook URL 過期、簽章驗證失敗）
- 重試也是同樣結果、只浪費資源
- 5xx 才是「暫時性錯誤」（網路 / 部署）

### 為何用自訂 X-CHITO-Signature 格式？

選擇：`t=...,v1=...` 格式（與 Stripe webhook 簽章類似）

理由：
- 包含 timestamp 防 replay attack
- 允許未來簽章演算法升級（v2 / v3）
- 業界標準（Stripe / Slack 都用類似格式）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 39/39（webhook 為 outbound、無 inbound 端點需測試）

---

## ⏭ 下一步：W12 D4-D5

- W12 D4：依實戰反饋微調
- W12 D5：Phase 3 整體收尾 + Phase 4 規劃

技術後援可選（Phase 4+）：
- Redis-backed queue
- Webhook 簽章升級（v2）
- 補事件類型（instance.expired / payment.succeeded）

---

## 🔗 相關文件

- [W12 D2 TypeScript SDK](2026-05-03-phase3-w12-d2-typescript-sdk.md)
- [W12 D1 API Key Store](2026-05-03-phase3-w12-d1-api-key-store.md)
- [W11 完整收尾](2026-05-03-phase3-w11-complete.md)
- [代理商 onboarding](../runbooks/agency-onboarding.md)
