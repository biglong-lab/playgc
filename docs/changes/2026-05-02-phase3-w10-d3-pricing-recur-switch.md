# Phase 3 W10 D3 — Pricing 切換 Recur.tw（Stripe 退場）

**日期**：2026-05-02
**範圍**：W10 D3、Pricing 頁前端切換 + 後端 productId 環境變數對應
**狀態**：🟢 W10 D3 完成、Recur.tw 為主要付費路徑

---

## 🎯 目標達成

> Phase 3 W10 D2 完成 Recur.tw API client + endpoints
> W10 D3 切換 Pricing 頁前端為 Recur.tw 主路徑、Stripe 完全退場為國際 fallback

---

## 📦 改動

### 1. 前端 `client/src/pages/Pricing.tsx`

**handleCheckout 改寫**：
- 前：呼叫 `/api/payments/create-checkout`（Stripe）
- 後：呼叫 `/api/payments/recur/create-checkout`（Recur.tw）

**friendly error 處理**：
- `RECUR_NOT_CONFIGURED`（503）→ 「付費系統準備中、請聯絡業務」
- `RECUR_PRODUCT_NOT_MAPPED`（400）→ 「此情境尚未設定 productId」（同樣顯示「請聯絡業務」）
- 其他錯誤 → destructive toast

**UI 文案調整**：
- 「跳轉到 Stripe 安全付款頁面」→ 「跳轉到 Recur.tw 安全付款頁面」
- 加註「信用卡 / LINE Pay / ATM / 超商」+「自動開立電子發票」

### 2. 後端 `server/routes/payments.ts`

**productId 環境變數對應**：

```ts
// W10 D3: productId 從環境變數查
// RECUR_PRODUCT_<SCENARIO_ID>=prod_xxx
// 例如：RECUR_PRODUCT_WEDDING / RECUR_PRODUCT_KIDS_ADVENTURE
const envKey = `RECUR_PRODUCT_${scenarioId.toUpperCase().replace(/-/g, "_")}`;
productId = process.env[envKey];
```

當前端不傳 productId 時，後端自動依 scenarioId 查環境變數。
這讓 admin 在生產環境設定一次後，前端就不用每次帶 productId。

### 3. 環境變數規格（W10 D3 新）

| 環境變數 | 範例 | 對應情境 |
|---------|------|---------|
| `RECUR_PRODUCT_WEDDING` | `prod_xxx` | 婚禮派對 |
| `RECUR_PRODUCT_BIRTHDAY` | `prod_xxx` | 生日派對 |
| `RECUR_PRODUCT_REUNION` | `prod_xxx` | 同學會 |
| `RECUR_PRODUCT_KIDS_ADVENTURE` | `prod_xxx` | 親子冒險 |
| `RECUR_PRODUCT_CARNIVAL_STAGE` | `prod_xxx` | 園遊會主舞台 |
| `RECUR_PRODUCT_ICEBREAKER` | `prod_xxx` | 破冰熱場 |
| `RECUR_PRODUCT_AWARDS_CEREMONY` | `prod_xxx` | 頒獎典禮 |
| `RECUR_PRODUCT_STREET_WALK` | `prod_xxx` | 街區走讀 |
| `RECUR_PRODUCT_DISTRICT_CHECKIN` | `prod_xxx` | 商圈打卡 |
| `RECUR_PRODUCT_CORPORATE_TRAINING` | `prod_xxx` | 企業內訓 |
| `RECUR_PRODUCT_COMPANY_TRIP` | `prod_xxx` | 員工旅遊 |
| `RECUR_PRODUCT_VENUE_STORYLINE` | `prod_xxx` | 場域故事 |

admin 在 Recur.tw 後台建好 12 個產品（每個對應一個情境），把 productId 填到生產環境變數。

---

## 💡 設計決策

### 為何用環境變數而非 DB？

選擇：環境變數（productId 對應）

理由：
- 簡單：`RECUR_PRODUCT_*` 命名直觀、admin 易維護
- 不動 schema（符合「Schema 只新增不刪除」紅線）
- Recur.tw productId 是 stable 的（不常變）
- 未來若情境 > 30 個 → 改 DB 表（field_settings.recurProductMap jsonb）

### 為何 Stripe 不直接刪？

選擇：保留 Stripe scaffold（W10 D1 既有）

理由：
- 國際客戶 fallback（觀光客付款）
- 已寫好的程式碼不浪費
- ADR-0006 明確標示「scaffold 保留」
- Pricing 頁不顯示 Stripe 入口（admin 才能啟用）

### 為何 friendly error 用同樣訊息對應 RECUR_NOT_CONFIGURED + RECUR_PRODUCT_NOT_MAPPED？

選擇：合併為「付費系統準備中、請聯絡業務」

理由：
- 對客戶而言兩者結果一樣（無法線上付）
- 區分「key 沒設」vs「product 沒對應」對客戶沒意義
- admin 看 console / 503 response code 區分即可
- 簡化客戶 UX

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：29/29 全綠

---

## ⏭ 下一步：W10 D4-D5

- W10 D4：用量配額追蹤（games 表 metering）
- W10 D5：Resend 信件 + Recur webhook 簽章驗證

---

## 🔗 相關文件

- [W10 D2 Recur.tw API client](2026-05-02-phase3-w10-d2-recur-tw.md)
- [W10 D1 付費 scaffold](2026-05-02-phase3-w10-d1-payment-scaffold.md)
- [ADR-0006 Recur.tw 主導](../decisions/0006-payment-system.md)
- [Recur.tw 文件](https://docs.recur.tw/)
