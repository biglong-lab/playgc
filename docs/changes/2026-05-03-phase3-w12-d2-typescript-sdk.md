# Phase 3 W12 D2 — TypeScript SDK package

**日期**：2026-05-03
**範圍**：W12 D2、`sdk/typescript/` SDK + ApiDocs 連結
**狀態**：🟢 W12 D2 完成、代理商可整合 TypeScript SDK

---

## 🎯 目標達成

> Phase 3 W11 完成 OpenAPI 規格 + 公開文件
> W12 D2 補上「代碼級」工具：TypeScript SDK 含完整 types

---

## 📦 新增

### `sdk/typescript/`

```
sdk/typescript/
├── package.json
├── README.md                  完整使用文件
└── src/
    ├── index.ts               ChitoClient 主類別
    └── types.ts               所有 OpenAPI 對應 types
```

### `ChitoClient` 介面

```ts
import { ChitoClient } from "@chito/api-client";

const chito = new ChitoClient({ apiKey: "ck_test_xxx" });

// Resources
chito.scenarios.list({ status: "live" });
chito.scenarios.get("wedding");
chito.instances.create({ scenarioId, displayName, idempotencyKey });
chito.keys.me();
chito.health();
```

### 特色

- **零依賴**：純 TypeScript + 內建 fetch（Node 18+）
- **完整 types**：對應 OpenAPI 3.1 spec
- **錯誤類別**：`ChitoApiError`（含 code / status）
- **Idempotency 支援**：`instances.create` 可帶 `idempotencyKey`
- **可注入 fetch**：Node < 18 可傳 polyfill

### ApiDocs 整合

`/api-docs` 公開頁加新區段「📦 TypeScript SDK」：
- 含 import + 用法範例
- 連結到 GitHub `sdk/typescript`
- 一鍵複製按鈕

### 配套文件

`sdk/typescript/README.md`（150+ 行）：
- 安裝（複製 / file: dependency）
- 完整 API 用法（5 個 resource）
- 錯誤處理範例
- 速率限制處理
- Idempotency 用法
- Node 版本要求

---

## 💡 設計決策

### 為何不發 npm？

選擇：放 repo 內 `sdk/typescript/`、不發 npm

理由：
- W12 D2 階段先建好、代理商少、複製貼上即可
- npm 發布需要 npm org 帳號 / 版本管理
- 未來代理商多 → 再發 `@chito/api-client`
- 內含 `package.json` 讓未來易發

### 為何零依賴？

選擇：純 fetch、不裝 axios

理由：
- Node 18+ 內建 fetch
- bundle size 重要（代理商可能放前端）
- 可注入自訂 fetch（測試 / polyfill）

### 為何 resource 風格而非 flat？

選擇：`chito.scenarios.list()` 而非 `chito.listScenarios()`

理由：
- 仿 Stripe SDK 慣例
- 方便擴展（未來加 `chito.subscriptions.*`）
- 自動完成體驗好

### 為何 `ChitoApiError` 含 code 不只 message？

選擇：`{ code, status, message }`

理由：
- 代理商能依 code 判斷處理方式（如 rate_limit_exceeded → 退避）
- 對應 API 統一 error 格式
- 比純 message 更穩定（message 可能變、code 不變）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 維持 39/39（純文件 + SDK）

---

## ⏭ 下一步：W12 D3-D5

- W12 D3-D4：業務驗證（找客戶 / 真實活動）
- W12 D5：Phase 3 整體收尾 + Phase 4 規劃

技術後援可選（Phase 4 候選）：
- npm 發布 `@chito/api-client`
- Python / Go SDK
- Webhook 反向觸發

---

## 🔗 相關文件

- [W12 D1 API Key Store](2026-05-03-phase3-w12-d1-api-key-store.md)
- [W11 完整收尾](2026-05-03-phase3-w11-complete.md)
- [代理商 onboarding](../runbooks/agency-onboarding.md)
- [SDK README](../../sdk/typescript/README.md)
