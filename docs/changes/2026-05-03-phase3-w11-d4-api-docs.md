# Phase 3 W11 D4 — OpenAPI 規格 + 公開 API 文件頁

**日期**：2026-05-03
**範圍**：W11 D4、OpenAPI 3.1 spec endpoint + ApiDocs 公開頁
**狀態**：🟢 W11 D4 完成、代理商可下載 OpenAPI / 看 curl 範例

---

## 🎯 目標達成

> Phase 3 W11 D3 完成 POST /instances 代理商建場 API
> W11 D4 補上文件 — 讓代理商有官方參考、不用問業務細節

---

## 📦 新增

### 1. `GET /api/v1/openapi.json`（公開）

完整 OpenAPI 3.1 規格，含：

**Info**：
- title / version / description
- contact

**Servers**：
- 動態：`{baseUrl}/api/v1`

**Security**：
- ApiKeyAuth（Bearer token）

**Schemas**：
- Error / ScenarioListItem / Instance / InstanceComponent

**Paths**（4 個 endpoint）：
- GET /health
- GET /scenarios（含 query params）
- GET /scenarios/{id}
- POST /instances（含 Idempotency-Key header）

**用途**：
- 代理商匯入 Postman / Insomnia 直接測試
- Swagger UI 視覺化（用戶可自行 host）
- TypeScript 用戶可 `openapi-typescript` 自動產 types

### 2. `client/src/pages/ApiDocs.tsx`（路徑 `/api-docs`）

**結構**：
- Hero（標題 + 3 個 badges：Bearer / 60 req/min / Idempotent）
- 🔑 認證（Bearer token + ck_test / ck_live 規格）
- 🚦 速率限制（headers + 429 處理）
- 🔁 Idempotency（用法 + cache 隔離）
- 🌐 Endpoints（4 個 endpoint 含 curl 範例）
- ⚠️ Error 格式（5 個常見 code）
- CTA（聯絡業務取得 API key）

**特色**：
- 每個 curl 範例可一鍵複製（hover 顯示按鈕）
- 右上角「OpenAPI JSON」連結（直接下載 spec）
- 重點 endpoint（POST /instances）標「推薦」badge

### 3. App.tsx 路由

```tsx
const ApiDocs = lazy(() => import("@/pages/ApiDocs"));
<Route path="/api-docs" component={ApiDocs} />
```

### 4. Smoke test 5d

- GET `/api/v1/openapi.json` → 200 + openapi=3.1.0 + 含 /instances path
- GET `/api-docs` → 200

從 36 → **38 個檢查**

---

## 💡 設計決策

### 為何 OpenAPI 規格內嵌而非檔案？

選擇：`buildOpenApiSpec(baseUrl)` runtime 產出

理由：
- baseUrl 動態（local / staging / production 不同）
- 規格較小（< 5KB）、cache 不必要
- 改 endpoint 時不會忘記更新 JSON 檔
- 未來複雜可改 `docs/api/openapi.yaml` + 載入

### 為何不用 Swagger UI？

選擇：自寫 React 文件頁

理由：
- Swagger UI 樣式不一致（與 CHITO 設計差異大）
- 額外 ~200KB JS
- 我們的需求簡單（4 個 endpoint）
- 想要的代理商可以自行 host Swagger UI（用 OpenAPI JSON）

### 為何不需要登入即可看 OpenAPI？

選擇：`/api/v1/openapi.json` 公開

理由：
- 業界標準（Stripe / GitHub OpenAPI 都公開）
- 不洩漏敏感資料（只有 schema 定義）
- 代理商評估時就能看到、降低申請門檻

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**38/38 全綠**

---

## ⏭ 下一步：W11 D5

- W11 D5：W11 完整收尾 + 代理商 onboarding runbook + W12 規劃

---

## 🔗 相關文件

- [W11 D1 Public API](2026-05-03-phase3-w11-d1-public-api.md)
- [W11 D2 Rate limit](2026-05-03-phase3-w11-d2-rate-limit-idempotency.md)
- [W11 D3 POST /instances](2026-05-03-phase3-w11-d3-instances-endpoint.md)
- [ADR-0008 Public API](../decisions/0008-public-api-design.md)
