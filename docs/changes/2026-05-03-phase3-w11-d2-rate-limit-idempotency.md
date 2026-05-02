# Phase 3 W11 D2 — Rate limit + Idempotency middleware

**日期**：2026-05-03
**範圍**：W11 D2、2 個新 middleware + v1 routes 整合
**狀態**：🟢 W11 D2 完成、API key 60 req/min 限速 + idempotency 防重發

---

## 🎯 目標達成

> Phase 3 W11 D1 完成 read-only API + API key 認證
> W11 D2 補上 rate limit + idempotency（生產級保障）

---

## 📦 新增

### 1. `server/middleware/rate-limit.ts`

**設計**：sliding window in-memory（每 key 60 req/min）

**邏輯**：
- 每 key 維護 `timestamps[]`（最近 60s 的請求時間）
- 第 61 個請求 → 429 + Retry-After header
- 每 5 分鐘清理過期 entries（避免 Map 無限成長）

**Response headers**：
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1735693200
Retry-After: 35（達上限時）
```

**回應 429 格式**：
```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "每分鐘最多 60 個請求，請等 35 秒後重試",
    "retryAfterSeconds": 35
  }
}
```

### 2. `server/middleware/idempotency.ts`

**設計**：24 小時 in-memory cache（避免重複建場 / 扣款）

**用法**：
```ts
app.post("/api/v1/instances", requireApiKey, idempotency, handler)
```

**邏輯**：
- 沒帶 `Idempotency-Key` header → 略過、正常處理
- 帶了且 cache hit → 直接回 cached response（含 `Idempotent-Replay: true` header）
- 帶了且 miss → 執行 handler、cache 結果

**Cache key 格式**：`<apiKeyId>:<idempotencyKey>`
- 不同 API key 用同一 idempotency key 視為不同請求（隔離）

**Cache TTL**：24 小時、每 1 小時清理過期

### 3. v1 routes 整合

```ts
// W11 D2: 加入 rateLimit middleware
app.get("/api/v1/scenarios", requireApiKey, rateLimit, handler);
app.get("/api/v1/scenarios/:id", requireApiKey, rateLimit, handler);
```

順序：`requireApiKey` → `rateLimit` → handler
- 認證先行：401 不耗 rate quota（避免被 brute force 吃光）
- idempotency 留待 W11 D3 POST endpoints 才用

### 4. Smoke test 5b（W11 D2）

```js
// 驗證 middleware 順序：401 不該帶 X-RateLimit-Limit
await check("401 不執行 rate-limit", ...)
```

從 34 → **35 個檢查**

---

## 💡 設計決策

### 為何 in-memory 而非 Redis？

選擇：in-memory

理由：
- W11 階段單 server（Docker 1 實例）
- 重啟 process 重新計算可接受（短暫）
- 不增加新依賴（Redis 設定 / 維運）
- W12 規模擴大再升 Redis

### 為何 sliding window 而非 token bucket？

選擇：sliding window

理由：
- 直觀（記錄 timestamps、過濾舊的）
- 對代理商透明（X-RateLimit-Remaining 反映即時剩餘）
- token bucket 較難實作精確 reset

### 為何 idempotency 不放 DB？

選擇：in-memory cache

理由：
- 24 小時 TTL → 不需持久化
- 重啟 process 後重新計算 = 代理商重發即可（idempotency 本身就有這個語義）
- 加 DB 表反而增加維運（migration / cleanup）

### 為何 401 不執行 rate limit？

選擇：先 requireApiKey、後 rateLimit

理由：
- 401 對 brute force 沒實際成本（無 DB 查詢）
- 若 401 也吃 quota → 攻擊者可耗盡其他用戶的 quota
- 標準慣例：認證失敗不計 rate quota

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**35/35 全綠**

---

## ⏭ 下一步：W11 D3-D5

- W11 D3：POST /api/v1/instances（含 idempotency + 配額檢查 + 計費）
- W11 D4：API 文件（OpenAPI / Postman collection）
- W11 D5：W11 收尾 + 第一個代理商 demo

---

## 🔗 相關文件

- [W11 D1 Public API 啟動](2026-05-03-phase3-w11-d1-public-api.md)
- [ADR-0008 Public API 設計](../decisions/0008-public-api-design.md)
- [Phase 3 規劃](2026-05-02-phase3-plan.md)
