# Phase 3 W11 完整收尾 — Public API + 代理商 onboarding 工具

**期間**：2026-05-02 末 ~ 2026-05-03（W11 連續 5 天）
**範圍**：Phase 3 W11 D1-D5
**狀態**：🟢 W11 全部完成、代理商可立即整合

---

## 🎯 W11 整體目標達成

> Phase 3 W10 完成付費 / 信件 / 配額三軸
> W11 主軸：對外 Public API、讓代理商可整合
>
> 技術成果：完整 v1 API（read + write）+ rate limit + idempotency + OpenAPI 文件
> 業務成果：代理商 onboarding runbook + API key 發放流程

---

## 📅 5 天時序

### W11 D1（commit `0932a57c`）— Public API 啟動
- ADR-0008 Public API 設計原則
- `server/middleware/api-key.ts` Bearer 認證
- 3 個 read-only endpoints（health / scenarios / scenarios/:id）
- smoke test 31 → 34（health + 401 守衛 ×2）

### W11 D2（commit `967b14c6`）— Rate limit + Idempotency
- `server/middleware/rate-limit.ts` 60 req/min sliding window
- `server/middleware/idempotency.ts` 24h cache
- v1 routes 整合 rateLimit
- smoke test 34 → 35（middleware 順序驗證）

### W11 D3（commit `170e4933`）— POST /instances
- 代理商一鍵建場 endpoint
- API key → fieldId mapping（環境變數）
- description 標記 `[via:api/v1]`
- Idempotency-Key support
- smoke test 35 → 36

### W11 D4（commit `4d5db5c4`）— OpenAPI + ApiDocs
- `GET /api/v1/openapi.json` OpenAPI 3.1 規格
- `client/src/pages/ApiDocs.tsx` 公開頁
- 4 endpoints + Schemas 完整文件化
- smoke test 36 → 38

### W11 D5（本次）— 收尾文件
- `docs/runbooks/agency-onboarding.md` 代理商 SOP
- W11 完整收尾（本檔）

---

## 📊 W11 累積成果

### 程式碼貢獻
| 階段 | 檔案 | 行數 |
|------|------|------|
| W11 D1 | 7 | ~556 |
| W11 D2 | 6 | ~363 |
| W11 D3 | 4 | ~396 |
| W11 D4 | 6 | ~691 |
| W11 D5 | 3 | ~600 |
| **總** | **26** | **~2,606** |

### 新 endpoints
| Endpoint | 認證 | 用途 |
|----------|------|------|
| GET /api/v1/health | 公開 | 連線測試 |
| GET /api/v1/openapi.json | 公開 | OpenAPI 3.1 規格 |
| GET /api/v1/scenarios | API key | 列情境（過濾用） |
| GET /api/v1/scenarios/:id | API key | 情境詳情 |
| POST /api/v1/instances | API key | 一鍵建場 |

### 新公開頁
- `/api-docs` — API 文件頁（含 curl 範例）

### Smoke test
**38/38 全綠**（從 W10 31 + W11 7 個新檢查）

---

## 🛠 環境變數總清單（W11 階段）

### Public API
- `API_KEYS` — 逗號分隔的有效 API key
- `API_KEY_FIELD_<keyIdShort>` — key 對應的 fieldId
- `API_KEY_DEFAULT_FIELD` — fallback fieldId

完整清單見 [agency-onboarding.md Step 3](../runbooks/agency-onboarding.md#step-3api-key-發放admin-操作)

---

## 💼 代理商完整工具鏈

```
1. 看 /api-docs / /pitch        → 評估
   ↓
2. 簽合作協議 → 收費約定
   ↓
3. admin 設環境變數 → 發 ck_test_xxx
   ↓
4. 代理商照 /api-docs 步驟測試（health → list → instances）
   ↓
5. 通知測試完成 → 發 ck_live_xxx
   ↓
6. 代理商整合到自家系統（CRM / widget）
   ↓
7. 開始接單 → CHITO 月底對帳
```

---

## 🛡 安全 / 紅線

- ✅ Bearer token 認證（401 不吃 quota）
- ✅ 每 key 60 req/min（防濫用）
- ✅ Idempotency 防重發
- ✅ 場域隔離（代理商只能建自己場域）
- ✅ key masking（log 不洩漏完整 key）
- ✅ description 標記 `[via:api/v1]` 區分代理商建立的 game

---

## ⏭ Phase 3 W12 規劃

### W12 主軸：擴大 + Phase 3 收尾

| 日 | 重點 |
|----|------|
| W12 D1-D2 | 透過 W10/W11 工具找付費客戶（業務）|
| W12 D3 | 第二場真實活動（搜集案例）|
| W12 D4 | 第三場活動 + 業務簡報（用真實案例）|
| W12 D5 | Phase 3 整體收尾 + Phase 4 規劃 |

### 技術後援（W12 視需求補強）

- API key DB 表（取代環境變數）
- 代理商 dashboard 看自己用量 / 帳務
- Webhook 反向觸發（活動結束通知代理商）
- TypeScript SDK（npm package）

---

## 🔗 W11 文件索引

### W11 五天 changes
- [W11 D1 Public API](2026-05-03-phase3-w11-d1-public-api.md)
- [W11 D2 Rate limit + Idempotency](2026-05-03-phase3-w11-d2-rate-limit-idempotency.md)
- [W11 D3 POST /instances](2026-05-03-phase3-w11-d3-instances-endpoint.md)
- [W11 D4 OpenAPI + ApiDocs](2026-05-03-phase3-w11-d4-api-docs.md)
- [W11 完整收尾（本檔）](2026-05-03-phase3-w11-complete.md)

### Runbook
- [代理商 onboarding SOP](../runbooks/agency-onboarding.md)
- [客戶 onboarding（B2C）](../runbooks/customer-onboarding.md)

### ADR
- [ADR-0008 Public API 設計](../decisions/0008-public-api-design.md)

### Phase 3 規劃
- [Phase 3 主規劃](2026-05-02-phase3-plan.md)
- [W9 收尾](2026-05-02-phase3-w9-complete.md)
- [W10 收尾](2026-05-02-phase3-w10-complete.md)

### 公開頁
- [API 文件](https://game.homi.cc/api-docs)
- [OpenAPI JSON](https://game.homi.cc/api/v1/openapi.json)
