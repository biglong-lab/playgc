# ADR-0008: Public API 設計原則

> 日期：2026-05-02
> 狀態：採用中（Phase 3 W11 啟動）
> 影響：Phase 3 W11-W12 對外 API + 代理商 onboarding

---

## 背景

Phase 3 W10 完成付費系統。
W11 主軸：對外開放 API、讓代理商可整合。

代理商使用情境：
1. **婚禮顧問公司** — 客戶端 widget 直接建場（不用客戶進 game.homi.cc）
2. **活動公司** — 整合到自家 CRM、收 lead 後自動派場
3. **教育平台** — 內訓課程結束自動建破冰場
4. **其他 SaaS** — 把 CHITO 當情境模板供應商

---

## 設計原則

### 1. Versioning：URL path 版本

選擇：`/api/v1/...`

理由：
- 簡單、直觀
- 未來破壞性更新可同時運作 v1 + v2
- vs header versioning（複雜、難 debug）

### 2. Authentication：API key（Bearer token）

選擇：`Authorization: Bearer ck_xxx`

格式：
- `ck_test_*` — 測試環境
- `ck_live_*` — 生產環境
- 32 字元 hex random

理由：
- 簡單、易發放
- 不需要 OAuth 流程（代理商不是 user）
- vs 動態 token（增加複雜度）

### 3. Rate limit：每 key 每分鐘

預設：60 req/min（可依方案調整）

實作：in-memory（W11 D2 做）+ 未來換 Redis

### 4. Idempotency：可選 Idempotency-Key header

POST 端點支援 `Idempotency-Key` header（24 小時內重發回相同結果）。

理由：
- 代理商網路不穩、重試常見
- 避免重複建場 / 扣款

### 5. Error response 統一格式

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "...",
    "documentation_url": "https://game.homi.cc/api/docs#rate_limit_exceeded"
  }
}
```

### 6. Schema 變更政策

- v1 內：只新增欄位、不刪除/重命名
- 廢棄欄位：標 `deprecated` warning header
- 破壞性變更 → v2

---

## API 設計（Phase 3 W11-W12）

### W11 D1（read-only）— 本次

```
GET  /api/v1/scenarios                 列出所有情境
GET  /api/v1/scenarios/:id             單一情境詳情
GET  /api/v1/health                    API health check
```

### W11 D2-D3 規劃

```
POST /api/v1/instances                 建立情境實例（一鍵建場）
GET  /api/v1/instances/:id             查詢實例狀態
POST /api/v1/instances/:id/end         結束實例
```

### W11 D4-W12 規劃

```
POST /api/v1/customers                 代理商管理客戶
GET  /api/v1/usage                     用量查詢（計費用）
POST /api/v1/refunds                   退款（後台處理）
```

---

## 環境變數

| 變數 | 說明 |
|------|------|
| `API_KEYS` | 逗號分隔的有效 API key（W11 D1 暫時用環境變數）|

W12 規劃：改用 DB 表 `api_keys`（含 metadata：誰的 key、配額、狀態）

---

## 理由（≤ 5 點）

1. **路徑版本最務實**：Stripe / GitHub API 都用 `/v1/`，業界標準

2. **API key 不用 OAuth**：代理商是 server-to-server，OAuth 太重

3. **Idempotency 必須**：付費 + 建場都不可重複

4. **統一 error 格式**：對應 Stripe 風格、代理商熟悉

5. **W11 D1 先 read-only**：建立基礎、降低風險

---

## 影響

### 程式碼面
- W11 D1：`server/routes/api/v1/scenarios.ts` + `server/middleware/api-key.ts`
- W11 D2：rate limit + idempotency
- W11 D3：instantiate endpoint（含計費）
- W11 D4：API 文件

### 紅線
- API 不洩漏 admin / fieldId（除非 key owner 明確擁有權限）
- Rate limit 上限不可繞過（即使是 enterprise key）
- 廢棄欄位需保留 ≥ 6 個月

### 已知限制
- W11 D1 環境變數 API_KEYS 不適合大規模（需 DB）
- 沒有 OAuth → 適合 server-to-server，不適合最終用戶
- 多語系錯誤訊息留 W12+

---

## 後續可能變動

- API key → DB 表（W12 D1+）
- 加 GraphQL endpoint（若代理商要求）
- 加 SSE / WebSocket（即時資料推送）

---

## 相關文件

- [Phase 3 W11 規劃](../changes/2026-05-02-phase3-plan.md)
- [W10 完整收尾](../changes/2026-05-02-phase3-w10-complete.md)
- [Stripe API 設計參考](https://stripe.com/docs/api)
