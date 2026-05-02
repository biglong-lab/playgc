# ADR-0006: 付費機制技術選型 — Recur.tw 主導（更新版）

> 日期：2026-05-02（**更新**：原方案 Stripe + Recur.tw 雙軌 → 改為 Recur.tw 主導）
> 狀態：採用中（Phase 3 W10 D2 啟動 Recur.tw 整合）
> 影響：Phase 3 W10 全部工作 + W11 業務 API 計費 + 後續所有變現工作
> 文件：[docs.recur.tw](https://docs.recur.tw/)

---

## 背景

**初版選型**（W9 D5 規劃）：Stripe（一次性）+ Recur.tw（訂閱）雙軌

**用戶決策變更**（2026-05-02）：
- 一次性 + 訂閱皆改用 **Recur.tw**
- 信件服務獨立用 **Resend**（取代既有 SMTP / nodemailer）

理由：
- Recur.tw 是台灣本土方案、抽成更低
- 自動發票（電子發票）已內建、不需另接 ezpay / 智付通
- 支援 LINE Pay / 信用卡 / ATM / 超商
- 一次性 + 訂閱統一一個 vendor、不用兩套程式
- 國際客戶（觀光客）佔比目前極低、Stripe 暫無必要

---

## 最終決定（更新版）

### 主方案：Recur.tw 全包

| 場景 | 工具 |
|------|------|
| 客戶端一次性付費 | Recur.tw（一次性訂單）|
| admin 月訂閱 | Recur.tw（訂閱方案）|
| 季度委辦 | 不入線上（電匯）|

**信件**：Resend
- 付費成功通知
- 訂閱續訂提醒
- 活動回顧寄送
- 業務 onboarding 自動化

### 暫緩：Stripe

W10 D1 已完成 Stripe scaffold（`server/lib/stripe-checkout.ts`）。
**保留為 international fallback** — 若有國際客戶（觀光客 / 海外婚禮）才啟用。
不主動推廣、不顯示 Stripe 入口給客戶。

---

## Recur.tw 整合計畫（W10 D2-D5）

### W10 D2 — Recur.tw API 整合

新增：
- `server/lib/recur-tw.ts` — REST API client（建立訂單 / 訂閱）
- `POST /api/payments/recur/create-order` — 一次性訂單
- `POST /api/payments/recur/create-subscription` — 訂閱
- `POST /api/payments/recur/webhook` — 接收付費通知

### W10 D3 — Pricing 頁切換到 Recur.tw

改動：
- Pricing.tsx 預設用 Recur.tw（不顯示 Stripe）
- 訂閱方案實際下單流程（admin 端）

### W10 D4 — 用量配額追蹤

- games 表加 `metering` jsonb（記錄 admin 月配額用量）
- middleware 攔截 over-quota 的 admin instantiate

### W10 D5 — Resend 信件 + 收尾

- 付費後自動寄發票通知
- 訂閱續訂前 3 天提醒
- 活動結束後寄回顧

---

## 環境變數

| 變數 | 說明 | 範例 |
|------|------|------|
| `RECUR_TW_API_KEY` | Recur.tw 商家 API key | (依文件) |
| `RECUR_TW_WEBHOOK_SECRET` | webhook 簽章驗證 | (依文件) |
| `RESEND_API_KEY` | Resend 信件 API | `re_xxxxx` |
| `STRIPE_SECRET_KEY` | （fallback）國際客戶用 | `sk_test_*` |

---

## 理由（≤ 5 點）

1. **本土化優先**：台灣客戶 95%+、用台灣方案抽成低 + 自動發票合規

2. **單一 vendor 簡化**：一次性 + 訂閱用同一個 API、減少維護

3. **Resend 信件分離**：付費系統 ≠ 信件系統、各自最佳工具

4. **Stripe 保留 fallback**：scaffold 已建好、必要時可啟用、不浪費已寫的程式碼

5. **快速啟動**：跳過 Stripe webhook 簽章 / USD 結算 / 跨國發票等複雜性

---

## 影響

### 程式碼面
- W10 D2：新建 `server/lib/recur-tw.ts` + `server/routes/payments.ts` 擴充 recur 路徑
- W10 D5：新建 `server/lib/resend-mailer.ts` 整合
- 環境變數：3 個新變數待生產設定

### 紅線
- 付費失敗 → 不影響既有 admin 手動建場
- Stripe scaffold 不刪除、保留為國際 fallback
- 退款 → 走 Recur.tw 後台處理（不自動）

### 已知限制
- Recur.tw 文件零散、API 細節要邊試邊摸
- 試用期 / 升降級策略需在 Recur.tw 後台設定（非 API 控制）
- 不支援 Apple Pay / Google Pay（限信用卡 + LINE Pay + ATM）

---

## 後續可能變動

- 若 Recur.tw API 限制太多 → 改自建（接 ezpay / 智付通直接）
- 若國際客戶比例上升至 20%+ → 啟用 Stripe scaffold
- 若 Resend 用量大 → 改自架 SMTP（成本考量）

---

## 相關文件

- [Recur.tw 文件](https://docs.recur.tw/)
- [Resend 文件](https://resend.com/docs)
- [Phase 3 W9 收尾（W10 規劃起點）](../changes/2026-05-02-phase3-w9-complete.md)
- [Phase 3 規劃](../changes/2026-05-02-phase3-plan.md)
- [ADR-0007 Resend 信件](0007-resend-email.md)
