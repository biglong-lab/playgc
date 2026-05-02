# Phase 3 W10 完整收尾 — 付費機制 + 信件系統 + 配額追蹤

**期間**：2026-05-02（W10 5 天連續推進）
**範圍**：Phase 3 W10 D1-D5
**狀態**：🟢 W10 全部完成、付費 / 信件 / 配額三軸就緒（待 admin 設定環境變數啟用）

---

## 🎯 W10 整體目標達成

> Phase 3 W10 主軸：付費機制（讓平台真正開始賺錢）
>
> 技術成果：Recur.tw 付費 + Resend 信件 + 用量配額三軸完整 scaffold
> 運維成果：admin 設好環境變數即可啟用、不需重新編寫程式碼

---

## 📅 5 天時序

### W10 D1（commit `370a4781`）— 付費系統 scaffold + Pricing 公開頁
- Stripe Checkout lib（保留為國際 fallback）
- 3 個 endpoints（create-checkout / webhook / health）
- /pricing 公開頁（三方案 + 12 情境下單）
- ADR-0006 切換 Recur.tw 主導 + ADR-0007 Resend 信件

### W10 D2（commit `4084aeb8`）— Recur.tw API client
- `server/lib/recur-tw.ts`（fetch 直打 https://api.recur.tw/v1）
- 2 個新 endpoints（recur/create-checkout / recur/webhook）
- Health endpoint 加 `recurTwConfigured` 欄位

### W10 D3（commit `9aff6a8d`）— Pricing 切換 Recur.tw
- 前端 Pricing.tsx 改呼叫 `/api/payments/recur/create-checkout`
- 後端從 `RECUR_PRODUCT_<SCENARIO_ID>` 環境變數查 productId
- friendly error 處理 + UI 文案調整

### W10 D4（commit `476c6784`）— 用量配額追蹤
- `GET /api/admin/scenarios/quota`（30 天月窗口）
- AdminDashboard 配額 Card（綠/藍/琥珀進度條 + ≥80% 警告）
- 配額來源：`SCENARIO_QUOTA_FIELD_<id>` > `SCENARIO_QUOTA_DEFAULT` > 50

### W10 D5（本次）— Resend 信件整合 + W10 收尾
- `server/lib/resend-mailer.ts`（fetch 直打 https://api.resend.com）
- 整合到 Recur webhook（payment success email）
- `GET /api/payments/email/test` 測試 endpoint
- Health endpoint 加 `resendConfigured` 欄位
- W10 完整收尾文件（本檔）

---

## 📊 W10 累積成果

### 程式碼貢獻
| 階段 | 檔案 | 行數 |
|------|------|------|
| W10 D1 | 6 | ~574 |
| W10 D2 | 5 | ~365 |
| W10 D3 | 4 | ~174 |
| W10 D4 | 5 | ~270 |
| W10 D5 | 4 | ~250 |
| **總** | **24** | **~1,633** |

### 新 endpoints
- POST /api/payments/create-checkout（Stripe，fallback）
- POST /api/payments/webhook（Stripe）
- GET /api/payments/health（公開）
- POST /api/payments/recur/create-checkout（Recur.tw 主路徑）
- POST /api/payments/recur/webhook（Recur.tw）
- GET /api/payments/email/test（Resend 測試）
- GET /api/admin/scenarios/quota（W10 D4）

### 新公開頁
- `/pricing`（三方案 + 12 情境下單）

### Smoke test
**31/31 全綠**：
- 24 個既有（公開頁 + 情境詳情 + health + 認證守衛 + SPA）
- 4d/4d2/4e/4f/4c2 共 7 個 W10 新增（payments + recur + pricing + quota）
- ＝ 30+1（4d2 email test）

---

## 🛠 環境變數總清單（W10 階段）

### 付費（Recur.tw 主路徑）
- `RECUR_TW_API_KEY` — sk_test_* 或 sk_live_*
- `RECUR_TW_WEBHOOK_SECRET` — whsec_*
- `RECUR_PRODUCT_<SCENARIO_ID>` — 12 個（每情境一個）

### 付費（Stripe 國際 fallback）
- `STRIPE_SECRET_KEY` — sk_test_* / sk_live_*

### 信件
- `RESEND_API_KEY` — re_xxxxx
- `EMAIL_FROM` — 寄件者（如 "CHITO <noreply@homi.cc>"）

### 配額
- `SCENARIO_QUOTA_DEFAULT` — 全域 default（如 50）
- `SCENARIO_QUOTA_FIELD_<fieldId>` — 場域 override

---

## 💡 Phase 3 W10 設計亮點

### 1. 三套外部服務統一風格
- Stripe / Recur.tw / Resend 都用 fetch 直打、不裝 SDK
- 統一的 graceful 503（無 API key 時）
- 統一的環境變數命名（KEY / WEBHOOK_SECRET）

### 2. 兩級 fallback 設計
- 付費：Recur.tw 主 → Stripe 國際 fallback → 線下匯款
- 信件：Resend 主 → 失敗 fire-and-forget log

### 3. Schema 不動、用環境變數
- productId 對應、配額設定都用環境變數
- 符合「Schema 只新增不刪除」紅線
- 未來規模大可再升 DB

### 4. 業務友善 fallback
- AI 預覽失敗 → default 範例 fallback
- Recur 未設 → 「請聯絡業務」訊息
- 每個層級都有 graceful path

---

## ⏭ 下一步：Phase 3 W11

**主軸**：業務 API + 代理商 onboarding

| 日 | 重點 |
|----|------|
| W11 D1 | 設計 public API contract（list / instantiate / health）|
| W11 D2 | API key middleware（rate limit + log）|
| W11 D3 | 代理商 onboarding 流程 + 帳號分潤 |
| W11 D4 | API 文件（OpenAPI / Postman）|
| W11 D5 | W11 收尾 + 第一個代理商 demo |

---

## 🔗 W10 文件索引

### W10 五天 changes
- [W10 D1 付費 scaffold](2026-05-02-phase3-w10-d1-payment-scaffold.md)
- [W10 D2 Recur.tw client](2026-05-02-phase3-w10-d2-recur-tw.md)
- [W10 D3 Pricing 切換](2026-05-02-phase3-w10-d3-pricing-recur-switch.md)
- [W10 D4 配額](2026-05-02-phase3-w10-d4-quota.md)
- [W10 完整收尾（本檔）](2026-05-02-phase3-w10-complete.md)

### Phase 3 規劃
- [Phase 3 主規劃](2026-05-02-phase3-plan.md)
- [W9 完整收尾](2026-05-02-phase3-w9-complete.md)
- [ADR-0005 Phase 3 方向](../decisions/0005-phase3-direction.md)
- [ADR-0006 付費機制 Recur.tw](../decisions/0006-payment-system.md)
- [ADR-0007 Resend 信件](../decisions/0007-resend-email.md)
