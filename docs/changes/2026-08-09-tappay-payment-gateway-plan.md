# TapPay 串接 + 統一金流閘道 — 2026-08-09（規劃階段）

> 範圍：TapPay 文件研究結論 + 金流統一入口設計
> 狀態：🟠 **規劃完成、等業主確認才動工**（尚未寫任何程式碼）
> 觸發：業主要求「信用卡刷卡串接，整合一個地方串接 API」＋「回到我們的平台為主」

---

## 背景

業主提供 TapPay 文件（<https://docs.tappaysdk.com/tutorial/zh/home.html>），
要求兩件事：

1. 研究可用的金流有哪些
2. **整合成「一個地方」串接 API** —— 不要每個金流各寫一套

目標專案：**數位遊戲平台**（業主原話「回到我們的平台為主」）。

---

## TapPay 文件研究結論

### 可用金流（一次串接全包）

| 類別 | 支付方式 | 備註 |
|---|---|---|
| 信用卡 | Direct Pay | 卡號在自家頁面輸入但走 TapPay iframe 欄位，**卡號不經我方伺服器**；Visa / Master / JCB / AmEx / 銀聯；可開 3D 驗證 |
| 手機支付 | Apple Pay / Google Pay / Samsung Pay | 裝置錢包 |
| 電子錢包 | **LINE Pay**、街口 JKO、悠遊付、Pi 錢包 | 台灣在地主流 |
| 先買後付 | Atome、AFTEE | 分期 / 後付 |

### 串接架構（所有支付方式共用同一條流程）

```
前端 Web SDK（TPDirect.setupSDK: App ID + App Key + sandbox/prod）
  └─ 使用者輸入卡號 / 選錢包 → getPrime() → prime token（⚠️ 只有 90 秒有效）
       └─ 送我方後端 → 後端 POST pay-by-prime（partner_key + merchant_id）
            └─ 回 rec_trade_id → 落庫；之後退款 / 查詢 / 綁卡續扣全靠它
```

### 後端 API（`x-api-key: partner_key` + `application/json`）

| 端點 | 用途 | 關鍵欄位 |
|---|---|---|
| `POST /payment/pay-by-prime` | 首次付款 | `prime` `partner_key` `merchant_id` `amount` `details` `cardholder`；`three_domain_secure` 開 3D 時要帶 `result_url.{frontend_redirect_url, backend_notify_url}`；`remember:true` 才回 `card_secret` |
| `POST /payment/pay-by-token` | 綁卡續扣 | `card_key` + `card_token`（來自前次回應）＋ `currency` |
| `POST /transaction/refund` | 退款／取消授權 | `rec_trade_id`；不帶 `amount` = 全額退 |
| `POST /transaction/query` | 對帳查詢 | `filters.time` **上限 90 天**；分頁 max 200/頁 |

Base URL：sandbox `https://sandbox.tappaysdk.com/tpc` ／ 正式 `https://prod.tappaysdk.com/tpc`

### 兩個踩坑預告（文件明載）

- **backend_notify 重試**：失敗時於 1 / 2 / 4 / 8 / 16 分鐘重送，**最多 5 次** → webhook 必須冪等
- **逾時建議 30 秒**（銀行尖峰時段），逾時會造成雙方狀態不同步

---

## 平台金流現況（動工前盤點）

| 項目 | 現況 |
|---|---|
| Recur.tw | `server/lib/recur-tw.ts`（`createRecurCheckoutSession` / `verifyRecurWebhookSignature`），webhook 已驗簽 |
| Stripe | `server/lib/stripe-checkout.ts`（`createCheckoutSession`），webhook 驗 `stripe-signature` |
| 交易表 | `payment_transactions`（`shared/schema/purchases.ts`，含 `recur_checkout_session_id`） |
| 呼叫點 | `server/routes/payments.ts`、`server/routes/player-purchases.ts` **各自直接 import lib** |
| 收款場景 | ①遊戲／章節購買 ②預約付款（`activities.paymentMode`）③POS（`pos-transactions` 已預留 `online_recur` / `online_stripe` / `linepay`） |

**問題**：兩家金流各一支 lib、路由各自呼叫，**沒有統一抽象**。
TapPay 進來若照舊，就是三份散落 —— 正好趁這次做業主要的「一個地方」。

---

## 設計：統一金流閘道

```
server/lib/payments/
├── gateway.ts     唯一對外介面：createPayment / refund / queryStatus
│                   Provider = 'tappay' | 'recur' | 'stripe'
│                   （Recur / Stripe 現有實作包成 adapter 收編、對外行為不變）
├── tappay.ts      TapPay 唯一出口：pay-by-prime / pay-by-token / refund / query
│                   sandbox↔prod 切換、partner_key 只在此檔出現、30s timeout
└── types.ts       統一型別 + 狀態機（PENDING → PAID → REFUNDED，不可逆）

server/routes/payments.ts      入口不變，改呼叫 gateway
  + POST /api/payments/tappay/prime    收 prime → 付款
  + POST /api/payments/tappay/notify   3D／錢包的 backend_notify webhook
```

### 沿用平台既有紀律（皆有前車之鑑）

| 紀律 | 出處 |
|---|---|
| 金額一律整數（分） | 營收系統幣別 bug（[2026-08-01 營收報表](2026-08-01-revenue-analytics.md) 曾誇大 109 倍） |
| `rec_trade_id` / `order_number` 冪等 | MQTT QoS1 去重同思路 |
| webhook 驗來源 | 比照 Recur / Stripe 現行做法 |
| credentials 全走環境變數 | 全域紅線，絕不進 git |
| 狀態機寫成不變式測試 | ADR-0025 的「修類不修實例」 |

---

## 分階段

| Phase | 內容 | 估時 | 需 TapPay 帳號 |
|---|---|---|---|
| 1 | `gateway.ts` 統一介面 + Recur / Stripe 收編為 adapter（**純重構、行為不變**，既有測試守住） | 3-4h | ❌ 可先開工 |
| 2 | TapPay adapter + Direct Pay 信用卡（sandbox 全流程：建單→付→退→查）+ 狀態機測試 | 4-5h | ✅ |
| 3 | 3D 驗證 + `backend_notify` webhook（冪等 + 驗來源） | 2-3h | ✅ |
| 4 | 接三個場景：遊戲購買 → 預約付款 → POS 加 `online_tappay`（營收報表自動涵蓋） | 3-4h | ✅ |
| 5 | LINE Pay（redirect 流程）；Apple / Google Pay 後補 | 2-3h | ✅ |

---

## 前置需求（業主要做的）

1. **TapPay Portal 註冊**（<https://www.tappaysdk.com>）
   - sandbox **免審核**即可開發
   - 正式 merchant 需送營業資料審核、天數不可控 → **建議先送件**
2. 提供 sandbox 的 **App ID / App Key / Partner Key / Merchant ID**（放 `.env`，不進 git）
3. LINE Pay 等錢包需在 Portal **個別申請開通**

---

## 風險

| 風險 | 對策 |
|---|---|
| 正式審核時間不可控 | sandbox 先做完，過審只換 credentials |
| Phase 1 動到現有 Recur / Stripe | 對外 API 不變 + 既有測試全綠才算過 |
| 3D redirect 漏 webhook | Phase 3 專門處理 + 對接 TapPay 5 次重試的冪等測試 |
| prime 90 秒過期 | 前端取得後立即送出，後端逾時錯誤要能辨識並提示重刷 |

---

## 相關文件

- 金額整數原則的由來：[2026-08-01 營收報表](2026-08-01-revenue-analytics.md)
- 既有金流程式碼：`server/lib/recur-tw.ts`、`server/lib/stripe-checkout.ts`、`server/routes/payments.ts`
- 完成後應補：`docs/decisions/` ADR（統一閘道屬影響 ≥3 模組的決策）
