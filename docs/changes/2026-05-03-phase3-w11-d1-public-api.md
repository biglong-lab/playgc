# Phase 3 W11 D1 — Public API v1 啟動（read-only endpoints）

**日期**：2026-05-03
**範圍**：W11 D1、ADR-0008 + API key middleware + 3 個 v1 endpoints + smoke test
**狀態**：🟢 W11 D1 完成、代理商可開始整合 read-only API

---

## 🎯 目標達成

> Phase 3 W10 完成付費 / 信件 / 配額三軸
> W11 主軸：對外開放 API、讓代理商可整合
> W11 D1：read-only API + API key 認證機制

---

## 📦 新增

### 1. ADR-0008：Public API 設計原則

`docs/decisions/0008-public-api-design.md`

**核心設計**：
- Versioning：URL path（`/api/v1/`）
- Authentication：Bearer API key（`ck_test_*` / `ck_live_*`）
- Rate limit：每 key 每分鐘 60 req（W11 D2 實作）
- Idempotency：可選 `Idempotency-Key` header（W11 D2 實作）
- Error format：統一 `{ error: { code, message, documentation_url } }`
- Schema 政策：v1 內只新增、不刪除

### 2. `server/middleware/api-key.ts`

**核心**：
- `requireApiKey` middleware
- 從環境變數 `API_KEYS`（逗號分隔）讀 whitelist
- 解析 `Authorization: Bearer ck_xxx`
- 401 + 統一 error 格式
- key masking（log 安全）
- `req.apiKey` context（keyId / isTest）

**未來擴充**：
- W12 改用 DB 表（含 metadata）
- 加 rate limit middleware

### 3. `server/routes/api/v1.ts`

3 個 read-only endpoints：

**GET /api/v1/health**（公開、不需 API key）
```json
{
  "status": "ok",
  "version": "v1",
  "timestamp": "..."
}
```

**GET /api/v1/scenarios**（需 API key）
- 列出所有情境
- query: `?status=live` / `?category=social` 過濾
- 回應含 categoryLabels + 12 情境 metadata

**GET /api/v1/scenarios/:id**（需 API key）
- 單一情境詳情
- 含完整 components 列表
- 含 useCases / valueProposition

### 4. Smoke test 擴充（Section 5a）

```js
GET /api/v1/health → 200 + version=v1
GET /api/v1/scenarios → 401（無 key）
GET /api/v1/scenarios → 401（ck_invalid_xxx 無效 key）
```

從 31 → **34 個檢查**

---

## 💡 設計決策

### 為何 path versioning（而非 header）？

選擇：`/api/v1/...`

理由：
- Stripe / GitHub / 大部分主流 API 用此風格
- URL 中可直接看見版本（debug 友善）
- 路由設定簡單（Express 直接 prefix）

### 為何 ck_ prefix？

選擇：`ck_test_*` / `ck_live_*` 風格

理由：
- 模仿 Stripe pk_/sk_ 命名（代理商熟悉）
- 一眼區分 test/prod
- 不與 Recur.tw 的 sk_ / 既有 OPENROUTER 的 sk-or- 衝突

### 為何 W11 D1 先 read-only？

選擇：先 GET、後 POST instantiate

理由：
- read-only 沒有副作用、風險最低
- 代理商可先測試認證 / 抓資料
- POST instantiate 涉及付費 / 配額（W11 D2-D3 完整實作）
- 漸進式：read → write → 計費

### 為何 health endpoint 不需 API key？

選擇：`/api/v1/health` 公開

理由：
- 監控工具不需 key 即可檢查
- 不洩漏資料（只回 status / version）
- 代理商可先驗證連線、再申請 key

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**34/34 全綠**

---

## ⏭ 下一步：W11 D2-D5

- W11 D2：Rate limit + Idempotency middleware
- W11 D3：POST /api/v1/instances（含計費）
- W11 D4：API 文件（OpenAPI / Postman）
- W11 D5：W11 收尾 + 第一個代理商 demo

---

## 🔗 相關文件

- [ADR-0008 Public API 設計](../decisions/0008-public-api-design.md)
- [Phase 3 規劃](2026-05-02-phase3-plan.md)
- [W10 完整收尾](2026-05-02-phase3-w10-complete.md)
