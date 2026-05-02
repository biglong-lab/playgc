# Phase 3 W12 D1 — API Key Store 抽象層 + JSON metadata

**日期**：2026-05-03
**範圍**：W12 D1、新增 store + middleware 重構 + /keys/me endpoint
**狀態**：🟢 W12 D1 完成、向下相容環境變數 + 升級 metadata 表達能力

---

## 🎯 目標達成

> Phase 3 W11 完成 Public API + 代理商工具
> W12 主軸：擴大 + Phase 3 收尾
> W12 D1：技術後援 — API key 從純字串升級為含 metadata（label / fieldId / quota）

---

## 📦 新增

### 1. `server/lib/api-key-store.ts`

**核心介面**：

```ts
interface ApiKeyMetadata {
  key: string;
  label: string;       // 「Wedding Co.」之類顯示用
  fieldId: string | null;
  quota: number | null;  // 月配額、null = 無限
  isTest: boolean;
  active: boolean;
}
```

**載入優先序**：
1. `API_KEYS_JSON` — 含完整 metadata（推薦）
2. `API_KEYS` 純字串 + `API_KEY_FIELD_*` + `API_KEY_DEFAULT_FIELD`（向下相容）

**JSON 格式範例**：
```json
[
  { "key": "ck_test_xxx", "label": "Wedding Co.", "fieldId": "field_jc_jiacun", "quota": 50 },
  { "key": "ck_live_yyy", "label": "Tour Agency", "fieldId": "field_taipei", "quota": null }
]
```

**Helper 函式**：
- `findApiKey(key)` — 用於 middleware
- `listApiKeys()` — admin 用
- `getApiKeyStats()` — health / dashboard 用
- `reloadApiKeys()` — 測試用

### 2. `server/middleware/api-key.ts` 重構

**改動**：
- 移除 `getValidApiKeys()` 純字串解析
- 改用 `findApiKey(key)` 取得完整 metadata
- `req.apiKey` context 擴充：`fieldId` / `quota` / `label`

**ApiKeyContext 新增欄位**：
```ts
interface ApiKeyContext {
  keyId: string;
  isTest: boolean;
  fieldId: string | null;  // 新
  quota: number | null;     // 新
  label: string;            // 新
}
```

### 3. `server/routes/api/v1.ts` 重構

- 移除 `getFieldIdForApiKey()` helper（邏輯內聯到 store）
- POST /instances 改用 `req.apiKey.fieldId`（metadata 直接帶）

### 4. 新 endpoint：`GET /api/v1/keys/me`

代理商查自己 metadata（不含完整 key、只含 metadata）：

```http
GET /api/v1/keys/me
Authorization: Bearer ck_test_xxx
```

回應：
```json
{
  "object": "api_key_metadata",
  "keyId": "ck_test_***...123",
  "label": "Wedding Co.",
  "isTest": true,
  "fieldId": "field_jc_jiacun",
  "quota": 50
}
```

用途：代理商整合測試時可確認自己的 key 狀態。

### 5. Smoke test 5e

- GET `/api/v1/keys/me` 無 key → 401

從 38 → **39 個檢查**

---

## 💡 設計決策

### 為何不立即升 DB 表？

選擇：JSON 環境變數 + 抽象層 + 未來可換 DB

理由：
- W12 D1 先解決最痛點（metadata 表達不足）
- DB 表需 migration、stake 高
- 抽象層讓未來可換（不動 caller）
- MVP 階段代理商 < 5 個、JSON 夠用

### 為何向下相容舊環境變數？

選擇：legacy `API_KEYS` + new `API_KEYS_JSON` 並存

理由：
- 不破壞現有部署
- W11 setup 過的 admin 可漸進升級
- 一段時間後可廢棄 legacy（Phase 4）

### 為何加 `/keys/me`？

選擇：代理商可查自己 metadata

理由：
- onboarding 時可確認 key 狀態
- debug 用（quota / fieldId 是否設對）
- 仿 GitHub `/user`、Stripe `/account` 慣例

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**39/39 全綠**

---

## ⏭ 下一步：W12 D2-D5

- W12 D2-D3：透過 W10/W11 工具找客戶（業務）+ 真實活動驗證
- W12 D4：依實戰反饋微調 prompt / config / UI
- W12 D5：Phase 3 整體收尾 + Phase 4 規劃

技術後援可選：
- API key 改 DB 表
- TypeScript SDK（npm package）
- Webhook 反向觸發

---

## 🔗 相關文件

- [W11 完整收尾](2026-05-03-phase3-w11-complete.md)
- [代理商 onboarding](../runbooks/agency-onboarding.md)
- [ADR-0008 Public API](../decisions/0008-public-api-design.md)
