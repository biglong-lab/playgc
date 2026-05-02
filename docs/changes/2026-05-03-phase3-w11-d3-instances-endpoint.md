# Phase 3 W11 D3 — POST /api/v1/instances（代理商一鍵建場）

**日期**：2026-05-03
**範圍**：W11 D3、新 endpoint + API key→fieldId mapping + smoke test
**狀態**：🟢 W11 D3 完成、代理商可呼叫 API 自動建場

---

## 🎯 目標達成

> Phase 3 W11 D2 完成 rate limit + idempotency middleware
> W11 D3 補上代理商核心需求：一鍵建場 API（含上述兩個 middleware）

---

## 📦 新增

### 1. `POST /api/v1/instances`

**Request**：
```http
POST /api/v1/instances
Authorization: Bearer ck_test_xxx
Idempotency-Key: agency-order-20260503-001
Content-Type: application/json

{
  "scenarioId": "wedding",
  "displayName": "Hung & Anita 5/15 婚禮",
  "customerEmail": "agency@example.com"
}
```

**Response**（201）：
```json
{
  "object": "instance",
  "scenario": { "id": "wedding", "name": "婚禮派對情境包" },
  "displayName": "Hung & Anita 5/15 婚禮",
  "customerEmail": "agency@example.com",
  "expiresAt": "2026-05-04T...",
  "totalCreated": 3,
  "breakdown": { "host": 3, "multi": 0, "other": 0 },
  "components": [
    {
      "axis": "host",
      "gameId": "...",
      "pageType": "host_polaroid_collage",
      "label": "拍立得紀念牆",
      "hostUrl": "/host/...?token=...",
      "playUrl": "/play/..."
    },
    ...
  ],
  "createdBy": "ck_test_***...123"
}
```

**Middleware 鏈**：
- `requireApiKey` — Bearer 認證
- `rateLimit` — 60 req/min
- `idempotency` — 24h cache（Idempotency-Key）

### 2. API key → fieldId mapping

新增 `getFieldIdForApiKey()` helper：
- 環境變數 `API_KEY_FIELD_<keyIdShort>` （keyIdShort 是 maskKey 前 8 字元）
- Fallback：`API_KEY_DEFAULT_FIELD`
- 找不到 → 回 400 + `api_key_not_mapped_to_field` error code

### 3. instantiate logic 內嵌（W11 D3）

`instantiateForApi()` 簡化版：
- 與 admin scenarios.ts 邏輯類似
- 每元件建 game + page + host_session/publicSlug
- description 含 `[scenario:<id>] [via:api/v1]` 標記（區分代理商建立的）
- 預設 config 簡化（W11 D5 可整合 default config helper 共用）

### 4. Smoke test 5c

- POST `/api/v1/instances` 無 key → 401

從 35 → **36 個檢查**

---

## 💡 設計決策

### 為何 API key → fieldId 用環境變數？

選擇：`API_KEY_FIELD_<keyIdShort>`

理由：
- W11 D3 速度優先（不動 schema）
- 實際代理商少（1-3 個）、環境變數可管理
- W12 規模擴大可改 DB（api_keys 表加 fieldId 欄）

### 為何 instantiate logic 內嵌而非共用？

選擇：W11 D3 內嵌簡化版、之後重構

理由：
- admin scenarios.ts 的 instantiate 與 API 需求略不同（admin 有 req.admin / API 有 apiKey）
- 重構需要抽象層、增加 W11 D3 範圍
- 80/20 法則：先讓 API 可用、之後重構 default config helper 共用

未來重構：抽 `server/lib/scenario-instantiator.ts` 共用。

### 為何不擋配額（W10 D4 有 quota endpoint）？

選擇：W11 D3 暫不擋配額

理由：
- 代理商付費模式 ≠ admin 訂閱（不同計費邏輯）
- 配額擋邏輯需要結合代理商計費（W11 D4 / W12 補上）
- 現在純 functional：先讓 API 跑通

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**36/36 全綠**

---

## ⏭ 下一步：W11 D4-D5

- W11 D4：API 文件（OpenAPI / Postman collection）
- W11 D5：W11 收尾 + 第一個代理商 demo

---

## 🔗 相關文件

- [W11 D1 Public API 啟動](2026-05-03-phase3-w11-d1-public-api.md)
- [W11 D2 Rate limit + Idempotency](2026-05-03-phase3-w11-d2-rate-limit-idempotency.md)
- [ADR-0008 Public API 設計](../decisions/0008-public-api-design.md)
