# Phase 3 W10 D1 — 付費系統 scaffold + Recur.tw 切換決策

**日期**：2026-05-02
**範圍**：W10 D1
**狀態**：🟢 W10 D1 完成、Pricing 公開頁上線、ADR-0006 切換 Recur.tw 主導

---

## 🎯 目標達成

> Phase 3 W10 D1 主軸：付費系統 scaffold
> 啟動方案：Stripe Checkout（W9 D5 規劃）→ 用戶決定改用 Recur.tw

---

## 📦 改動

### 1. Stripe Checkout scaffold（保留為國際 fallback）

新增（用 fetch 不裝 SDK）：
- `server/lib/stripe-checkout.ts` - createCheckoutSession()
- `server/routes/payments.ts`
  - POST /api/payments/create-checkout（公開）
  - POST /api/payments/webhook（W10 D2 補簽章）
  - GET /api/payments/health（公開健康檢查）

**狀態**：scaffold 完成、無 STRIPE_SECRET_KEY 時 endpoint 回 503
**用途**：保留為國際客戶 fallback、不主動推

### 2. Pricing 公開頁

`/pricing` 公開頁：
- Hero + 三方案（一次性 / 訂閱 / 委辦）
- 列出所有 live 情境（依分類預設價）
- 一次性可下單流程（接 Stripe scaffold）
- 友善處理 503（顯示「系統準備中」訊息）

### 3. Smoke test 擴充

`scripts/smoke-test-scenarios.mjs`：
- 4d: GET /api/payments/health（200，公開）
- 4e: GET /pricing（200）

從 26 → **28 個檢查**

### 4. ADR 更新

- `decisions/0006-payment-system.md` 重寫 — 從 Stripe + Recur.tw 雙軌 → **Recur.tw 主導**
- `decisions/0007-resend-email.md` 新增 — Resend 信件服務選用

---

## 💡 關鍵設計變更

### W9 D5 → W10 D1 決策修正

| 階段 | 一次性付費 | 訂閱 | 信件 |
|------|----------|------|------|
| W9 D5 計畫 | Stripe | Recur.tw | （未定）|
| W10 D1 修正 | **Recur.tw** | Recur.tw | **Resend** |

理由：
- 台灣客戶 95%+、用台灣方案抽成低 + 自動發票
- 單一 vendor 簡化（不用兩套）
- Stripe 保留 scaffold 當國際 fallback

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：commit `370a4781` ✅
- **Smoke test 28/28 全綠** ✅

---

## ⏭ 下一步：W10 D2-D5（Recur.tw 整合）

- W10 D2：Recur.tw API client + endpoints
- W10 D3：Pricing 頁切換到 Recur.tw（Stripe 退場為 fallback）
- W10 D4：用量配額追蹤
- W10 D5：Resend 信件整合

---

## 🔗 相關文件

- [ADR-0006 Recur.tw 主導](../decisions/0006-payment-system.md)
- [ADR-0007 Resend](../decisions/0007-resend-email.md)
- [Recur.tw 文件](https://docs.recur.tw/)
- [Resend 文件](https://resend.com/docs)
- [Phase 3 W9 收尾](2026-05-02-phase3-w9-complete.md)
