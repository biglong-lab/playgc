# 整合規格：game.homi.cc ↔ coupon.aihomi.cc

> 文件類型：對外整合規格書（可傳給對方平台工程師）
> 撰寫日期：2026-05-07
> 雙方：
>   - 發券方：`game.homi.cc`（賈村數位遊戲平台、由 Hung 維護）
>   - 兌換方：`coupon.aihomi.cc`（優惠券平台）
> 狀態：草案 v1（待對方平台確認 / 雙方對 spec）

---

## 1. 整合目的與分工

### 1.1 角色分工

| | game.homi.cc（發券方）| coupon.aihomi.cc（兌換方）|
|---|---|---|
| 玩家識別 | ✅ 持有 LINE userId、姓名、訂單史 | ❌ **完全不接觸 PII** |
| 商家管理 | ❌ 無 | ✅ 上架、商家後台、對帳 |
| 券資料 | 只存 `voucher_token`（中介 ID）| 持有完整券資料、QR、有效期 |
| 兌換驗證 | ❌ 無 | ✅ 商家掃 QR / 兌換流程 |
| 玩家行為紀錄 | ✅ 完整（觸發來源、累積點數、招募鏈）| ❌ 只看到「token X 被某商家兌換」|

### 1.2 隱私分隔（PII Partition）原則

> **coupon.aihomi.cc 永遠不會收到 LINE userId、phone、email、姓名等個資**
> 兩邊的橋是隨機產生的 `voucher_token`（≥ 32 字元、unguessable）

這是合**個資法**且**對對方平台友善**的設計：對方不需處理 GDPR / 個資合規。

---

## 2. 整合架構（一張圖看完）

```
┌─────────────────────────────┐                ┌──────────────────────────────┐
│  game.homi.cc               │                │  coupon.aihomi.cc            │
│                             │                │                              │
│  玩家完成遊戲、累積點數      │                │  ┌─────────────────────┐    │
│  ↓                          │  POST          │  │  vouchers 表         │    │
│  觸發轉換規則                │  /api/v1/      │  │  - token             │    │
│  ↓                          │  vouchers ────→│  │  - template_id       │    │
│  產生 voucher_token         │  Issue API     │  │  - issued_by         │    │
│  ↓                          │                │  │  - valid_until       │    │
│  記錄 (token, lineUserId,   │                │  │  - status            │    │
│   triggerSource)            │                │  └─────────────────────┘    │
│                             │                │                              │
│  ┌──────────────────────┐   │                │  玩家用 LINE 開啟連結 ↓      │
│  │ vouchers 表（我方）   │   │                │  顯示券 + QR ↓               │
│  │ - token (FK)         │   │                │  商家掃 QR / 兌換 ↓          │
│  │ - line_user_id       │   │                │                              │
│  │ - trigger_source     │   │  POST          │  Webhook 通知 ────────────→ │
│  │ - issued_at          │   │  /api/         │                              │
│  │ - redeemed_at        │ ←─│  webhooks/     │                              │
│  └──────────────────────┘   │  redeemed      │                              │
│                             │                │                              │
│  收到 webhook → 用 token     │                │                              │
│  查回 LINE userId            │                │                              │
│  → 推 LINE 通知玩家          │                │                              │
│  → 紀錄商業迴圈完成          │                │                              │
└─────────────────────────────┘                └──────────────────────────────┘
```

---

## 3. 認證機制

### 3.1 雙向 API Key

兩邊各自核發給對方一把 key：

| 方向 | Key 名稱 | 持有方 | 用途 |
|------|---------|--------|------|
| game → coupon | `COUPON_API_KEY` | game.homi.cc 持有、coupon.aihomi.cc 簽發 | 呼叫 Issue API |
| coupon → game | `GAME_WEBHOOK_KEY` | coupon.aihomi.cc 持有、game.homi.cc 簽發 | 呼叫 Webhook |

### 3.2 Header 規範

```http
Authorization: Bearer <api_key>
X-Request-Id: <uuid>           # 雙方都要、用於 idempotency 與 trace
X-Timestamp: <unix_seconds>    # 防 replay attack（5 分鐘內有效）
Content-Type: application/json
```

### 3.3 Webhook 多一層 HMAC 簽章

webhook 走公網、API key 外洩風險高、加 HMAC：

```http
X-Webhook-Signature: sha256=<hmac_sha256(secret, timestamp + "." + raw_body)>
```

接收方驗：
1. timestamp 在 5 分鐘內
2. signature 比對通過
3. 才視為合法

---

## 4. API 1：Issue Coupon（發券）

> 方向：`game.homi.cc` → `coupon.aihomi.cc`
> 用途：玩家在遊戲中觸發了某條轉換規則、需要發一張券給他

### 4.1 Endpoint

```http
POST https://coupon.aihomi.cc/api/v1/vouchers
```

### 4.2 Request

```http
Authorization: Bearer <COUPON_API_KEY>
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
X-Timestamp: 1715040000
Content-Type: application/json

{
  "voucher_token": "vch_8a4b2c9e1f7d6a3b5c8e2f9a1d4b7c6e",
  "template_id": "drink_9_discount",
  "valid_from": "2026-05-07T12:00:00Z",
  "valid_until": "2026-06-07T23:59:59Z",
  "issued_by": "game.homi.cc",
  "metadata": {
    "trigger_source": "mvp_award",
    "field_id": "jiacun",
    "season": "2026Q2"
  }
}
```

#### 欄位說明

| 欄位 | 必填 | 型別 | 說明 |
|------|------|------|------|
| `voucher_token` | ✅ | string(32-64) | 我方產生的隨機 token、為 idempotency key、unique |
| `template_id` | ✅ | string | 對方平台預先定義的券模板（飲料 9 折、伴手禮 50 元等）|
| `valid_from` | ✅ | ISO 8601 | 生效時間 |
| `valid_until` | ✅ | ISO 8601 | 失效時間 |
| `issued_by` | ✅ | string | 來源平台（固定 `"game.homi.cc"`）|
| `metadata` | ❌ | object | 自由欄位、雙方追蹤用、**不含 PII** |

### 4.3 Response（成功）

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "voucher_token": "vch_8a4b2c9e1f7d6a3b5c8e2f9a1d4b7c6e",
  "voucher_url": "https://coupon.aihomi.cc/v/vch_8a4b2c9e1f7d6a3b5c8e2f9a1d4b7c6e",
  "qr_image_url": "https://coupon.aihomi.cc/v/vch_8a4b2c9e1f7d6a3b5c8e2f9a1d4b7c6e/qr.png",
  "template": {
    "id": "drink_9_discount",
    "name": "飲料 9 折券",
    "merchant_name": "金門酒廠",
    "discount_value": 90,
    "discount_unit": "percent"
  },
  "valid_until": "2026-06-07T23:59:59Z",
  "status": "issued"
}
```

### 4.4 Response（錯誤）

| HTTP | 情境 | Body 範例 |
|------|------|----------|
| 400 | template_id 不存在 | `{"error":"template_not_found","detail":"..."}` |
| 401 | API key 無效 | `{"error":"unauthorized"}` |
| 409 | voucher_token 已存在（idempotency）| 回傳原本那筆 ✅（不視為錯誤）|
| 422 | valid_until < now | `{"error":"invalid_date"}` |
| 429 | rate limited | `{"error":"too_many_requests","retry_after":60}` |
| 500 | 服務異常 | `{"error":"internal_error"}` |

### 4.5 Idempotency 行為

呼叫同一個 `voucher_token` 多次 → **回傳相同結果**、不重複產生券。
這讓 game.homi.cc 可以安全重試（網路斷了再打）。

### 4.6 Rate Limit

建議：每分鐘 ≤ 60 次（容量小但夠用）。

---

## 5. API 2：Redemption Webhook（兌換通知）

> 方向：`coupon.aihomi.cc` → `game.homi.cc`
> 用途：商家完成兌換、回呼通知遊戲平台

### 5.1 Endpoint（game.homi.cc 提供）

```http
POST https://game.homi.cc/api/webhooks/coupon-redeemed
```

### 5.2 Request

```http
Authorization: Bearer <GAME_WEBHOOK_KEY>
X-Request-Id: 22d4be41-0a36-4bdc-9b88-7e1f2cb05b9a
X-Timestamp: 1715050000
X-Webhook-Signature: sha256=a3b5c8e2f9a1d4b7c6e8a4b2c9e1f7d6...
Content-Type: application/json

{
  "voucher_token": "vch_8a4b2c9e1f7d6a3b5c8e2f9a1d4b7c6e",
  "event": "redeemed",
  "redeemed_at": "2026-05-15T14:30:22Z",
  "merchant_id": "kinmenwine_001",
  "merchant_name": "金門酒廠",
  "amount": 90,
  "currency": "TWD",
  "metadata": {
    "store_location": "金城店"
  }
}
```

#### 欄位說明

| 欄位 | 必填 | 說明 |
|------|------|------|
| `voucher_token` | ✅ | 對應發券時的 token、game.homi.cc 用此查回玩家 |
| `event` | ✅ | `redeemed` / `expired` / `cancelled`（未來擴充）|
| `redeemed_at` | event=redeemed 時必填 | 兌換時間 |
| `merchant_id` | event=redeemed 時必填 | 對方平台的商家 ID |
| `merchant_name` | ✅ | 商家顯示名稱 |
| `amount` | ❌ | 抵扣金額或實際付款金額 |
| `metadata` | ❌ | 自由欄位、**不含 PII** |

### 5.3 Response（game.homi.cc 回應）

| HTTP | 意義 | coupon 端動作 |
|------|------|---------------|
| 200 | 收到並處理 | 不再重試 |
| 4xx | 永久錯誤（簽章無效、token 不存在）| 不再重試 |
| 5xx / timeout | 暫時失敗 | 重試（指數退避：1s / 5s / 30s / 5min / 30min）|

### 5.4 Idempotency

同一個 `(voucher_token, event)` 重複收到時、game.homi.cc 視為冪等、回 200 但不重複處理。

### 5.5 重試與失敗策略（coupon 端必做）

- 失敗時退避重試：1s → 5s → 30s → 5min → 30min → 30min（最多 6 次、共約 1 小時）
- 6 次都失敗 → 寫進對方平台的 dead letter queue、人工或 dashboard 處理
- 不可因為 webhook 失敗而 rollback 兌換（兌換是 source of truth）

---

## 6. 資料模型

### 6.1 game.homi.cc 端（我方）

```sql
CREATE TABLE vouchers (
  id              SERIAL PRIMARY KEY,
  token           VARCHAR(64) UNIQUE NOT NULL,    -- 給對方平台的中介 ID
  line_user_id    VARCHAR(64) NOT NULL,            -- 玩家身份（PII、不出我方）
  field_id        VARCHAR(40),                     -- 場域（哪個遊戲觸發）
  trigger_source  VARCHAR(40) NOT NULL,            -- mvp_award / cross_field / referral
  template_id     VARCHAR(60) NOT NULL,            -- 對方的券模板 ID
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ NOT NULL,
  redeemed_at     TIMESTAMPTZ,                     -- webhook 收到時填
  redeem_metadata JSONB,                           -- 商家、金額等
  status          VARCHAR(20) NOT NULL DEFAULT 'issued',
  CONSTRAINT chk_status CHECK (status IN ('issued','redeemed','expired','cancelled'))
);

CREATE INDEX idx_vouchers_user ON vouchers(line_user_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
```

### 6.2 coupon.aihomi.cc 端（對方建議）

```sql
CREATE TABLE vouchers (
  token           VARCHAR(64) PRIMARY KEY,
  template_id     VARCHAR(60) NOT NULL,
  issued_by       VARCHAR(40) NOT NULL,            -- 'game.homi.cc'
  valid_from      TIMESTAMPTZ NOT NULL,
  valid_until     TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'issued',
  redeemed_at     TIMESTAMPTZ,
  redeemed_by_merchant VARCHAR(60),
  metadata        JSONB
);
```

⚠️ **不存任何 PII**（line_user_id、phone、email 一律不收、不存）

---

## 7. 完整流程範例

### 7.1 場景：玩家在賈村獲得 MVP、發飲料 9 折券

```
1. 遊戲結算 → game.homi.cc 觸發轉換規則 "mvp_award"
2. game.homi.cc 產生 token: "vch_8a4b2c..."
3. game.homi.cc INSERT vouchers (token, line_user_id, ...)
4. game.homi.cc → POST coupon.aihomi.cc/api/v1/vouchers
5. coupon.aihomi.cc 回 voucher_url + qr_image_url
6. game.homi.cc 推 LINE 訊息給玩家:
   "🎉 恭喜獲得金門酒廠 9 折券！點此查看 → <voucher_url>"
   （此處 LINE Push 1 則、扣 1 quota）
7. 玩家點開連結 → 在 coupon.aihomi.cc 看到券 + QR
8. 玩家到金酒實體店、商家掃 QR
9. coupon.aihomi.cc 完成兌換、UPDATE vouchers SET status='redeemed'
10. coupon.aihomi.cc → POST game.homi.cc/api/webhooks/coupon-redeemed
11. game.homi.cc UPDATE 自己的 vouchers + 推 LINE 給玩家:
    "✅ 兌換成功、感謝光臨金門酒廠！"
    （此處可選：用 reply API 不扣 quota；或 push 扣 1）
```

---

## 8. 安全考量

### 8.1 Token 不可猜
- voucher_token 至少 32 字元、隨機（crypto.randomBytes(24).toString('hex')）
- 不可使用流水號、不可從 user_id 計算

### 8.2 連結公開但難猜
- voucher_url 設計成「知道 token 的人才能看」、無需登入即可查看
- 因為 token 不可猜、實質上是 URL-as-secret 模式
- 玩家分享連結 ≠ 分享他的個資（對方平台沒 PII）

### 8.3 兌換驗證
- 兌換動作只能由商家側發起（商家後台掃 QR）
- 同一張券只能兌換一次（status 機台檢查）

### 8.4 Webhook 簽章
- HMAC SHA-256，secret 雙方協議、寫進雙方 .env
- 5 分鐘 timestamp window 防 replay
- 簽章失敗 → 直接 401、不洩漏 detail

---

## 9. 開發 / 測試 / 上線時程建議

### Phase 1：spec 對齊（1 週）
- [ ] 雙方 review 本文件、確認欄位 / 行為
- [ ] 雙方各自實作 mock endpoint（用 mock data 跑通流程）

### Phase 2：sandbox 整合（1 週）
- [ ] coupon.aihomi.cc 提供 sandbox URL（如 `coupon.aihomi.cc.sandbox/api/v1`）
- [ ] game.homi.cc 配出 webhook 接收端 + 模擬一條完整鏈
- [ ] 兩邊各跑 5+ 個 e2e 測試案例（成功、失敗、idempotency、重試）

### Phase 3：production 上線（1 週）
- [ ] 雙方互發 production API key
- [ ] 真實一張券 e2e（找一家配合商家試）
- [ ] 監控雙邊：發券成功率、webhook 成功率、兌換到通知延遲

---

## 10. 需要對方平台確認的問題清單

請對方工程師回覆：

1. ☐ 同意 voucher_token 為 idempotency key 嗎？
2. ☐ template_id 怎麼取得？（dashboard 自動產生 / 我方申請）
3. ☐ qr_image_url 是即時產 png 還是預先存？size 多大？
4. ☐ webhook retry 政策上限同意嗎？（6 次、最多 1 小時）
5. ☐ sandbox 環境提供方式？
6. ☐ 預計什麼時程上 v1 API？

---

## 11. 雙方責任分工總結

| 工作 | game.homi.cc | coupon.aihomi.cc |
|------|--------------|------------------|
| 產生 voucher_token | ✅ | — |
| 持有玩家 PII | ✅ | ❌ 嚴禁 |
| 觸發發券 | ✅ | — |
| 接收發券 API、產生 voucher_url + QR | — | ✅ |
| 商家後台、上架、兌換 UI | — | ✅ |
| 兌換完成發 webhook | — | ✅ |
| 接收 webhook、查回玩家、推通知 | ✅ | — |
| 對玩家的客服 | ✅ | — |
| 對商家的客服 / 對帳 | — | ✅ |

---

## 12. 聯絡窗口

| 平台 | 角色 | 聯絡 |
|------|------|------|
| game.homi.cc | Hung（負責人 / 工程）| (待補) |
| coupon.aihomi.cc | (待對方填) | (待對方填) |

---

## 13. 變動紀錄

| 版本 | 日期 | 變動 |
|------|------|------|
| v1 (草案) | 2026-05-07 | 初版、待對方平台 review |

---

**END OF SPEC**
