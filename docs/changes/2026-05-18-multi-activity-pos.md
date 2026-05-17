# 多活動預約 + 現場 POS 工作站 — 2026-05-18 起

> 範圍：多活動商品模型 + 玩家分流預約 + 現場 POS 收款核銷 + 角色權限 + 營收整合
> 狀態：✅ 規劃確認、開始實作（任務 #41-53）
> 工期：5-6 週 + 持續打磨
> 金流：本輪只預留欄位、實際 API 串接延後
> 業主決定（5/18）：全部推展、慢慢打磨

---

## 目錄

1. [背景與業主目標](#背景與業主目標)
2. [Schema 變動清單](#schema-變動清單)
3. [API 規格](#api-規格)
4. [前端頁面 / 路由](#前端頁面--路由)
5. [角色權限模型](#角色權限模型)
6. [LINE 整合升級](#line-整合升級)
7. [收費 / 換券 / 核銷整合矩陣](#收費--換券--核銷整合矩陣)
8. [實作順序與里程碑](#實作順序與里程碑)
9. [風險與緩解](#風險與緩解)

---

## 背景與業主目標

業主希望把現有「一館一活動」預約系統升級成「多活動、可獨立行銷、可現場 POS 結帳」的營運工具：

- 每個活動有獨立頁面（射擊體驗 / 水彈對戰 / 實境闖關 / 文化導覽…）
- 各活動可上自己的封面、價格、時段、容量
- 預約後給 QR + 編碼、現場掃描核銷
- 現場工作人員有專用簡易介面（不是現在 27 頁的複雜後台）
- 整合「收費 / 換券 / 核銷」成 POS 概念
- 遊戲發券 → 現場消費 → 帶來下次回流

商業意圖：把賈村從「拍照打卡點」升級成「可重複消費的體驗中心」。

---

## Schema 變動清單

**原則：只新增、不刪除、向下相容**（紅線 #4）

### 新表 1：`activities`

```sql
CREATE TABLE activities (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        VARCHAR NOT NULL REFERENCES fields(id),
  slug            VARCHAR(50) NOT NULL,       -- URL：/book/JIACHUN/shooting
  name            VARCHAR(100) NOT NULL,      -- "賈村射擊體驗"
  short_desc      VARCHAR(200),               -- 卡片顯示
  description     TEXT,                       -- 詳細頁顯示
  cover_url       TEXT,                       -- Cloudinary URL（LINE Flex + 預約頁封面）
  location_note   TEXT,                       -- "賈村集合點：靶場入口"
  price_cents     INTEGER NOT NULL DEFAULT 0,
  currency        VARCHAR(3) NOT NULL DEFAULT 'TWD',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  capacity_per_slot INTEGER NOT NULL DEFAULT 1,
  payment_mode    VARCHAR(20) NOT NULL DEFAULT 'onsite',  -- online | onsite | both
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (field_id, slug)
);
CREATE INDEX idx_activities_field_active ON activities (field_id, is_active);
```

### 新表 2：`activity_schedules`

```sql
CREATE TABLE activity_schedules (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     VARCHAR NOT NULL REFERENCES activities(id),
  schedule_template JSONB NOT NULL,           -- 同既有 booking_configs.scheduleTemplate
  cancellable     BOOLEAN DEFAULT true,
  cancel_before_minutes INTEGER DEFAULT 120,
  reminder_minutes_before INTEGER DEFAULT 30,
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

### 新表 3：`pos_transactions`（POS 收款紀錄）

```sql
CREATE TABLE pos_transactions (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id        VARCHAR NOT NULL REFERENCES fields(id),
  staff_id        VARCHAR NOT NULL,            -- 收款員 admin_id
  booking_id      INTEGER REFERENCES bookings(id),  -- nullable（現場散客可不綁）
  activity_id     VARCHAR REFERENCES activities(id),
  amount_cents    INTEGER NOT NULL,
  paid_amount_cents INTEGER NOT NULL,          -- 實收（折抵後）
  payment_method  VARCHAR(20) NOT NULL,        -- cash | online_recur | online_stripe | linepay
  voucher_id      VARCHAR,                     -- 用了哪張券（nullable）
  voucher_discount_cents INTEGER DEFAULT 0,
  customer_name   VARCHAR(100),                -- 散客可手填
  note            TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_pos_tx_field_date ON pos_transactions (field_id, created_at);
CREATE INDEX idx_pos_tx_staff_date ON pos_transactions (staff_id, created_at);
```

### 既有表加欄位（ADD COLUMN only）

```sql
-- bookings：加多活動 + 線下收款追蹤
ALTER TABLE bookings ADD COLUMN activity_id VARCHAR REFERENCES activities(id);
ALTER TABLE bookings ADD COLUMN payment_mode VARCHAR(20) DEFAULT 'onsite';  -- online/onsite/both
ALTER TABLE bookings ADD COLUMN paid_by_staff_id VARCHAR;                    -- 收款員
ALTER TABLE bookings ADD COLUMN paid_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN qr_token VARCHAR(64);                        -- 給 POS 掃的安全碼（不只是 bookingCode）
ALTER TABLE bookings ADD COLUMN checked_in_at TIMESTAMP;                     -- 報到時間
ALTER TABLE bookings ADD COLUMN checked_in_by_staff_id VARCHAR;

-- coupons：加面額 + 兌換品項（Phase 5 用）
ALTER TABLE coupon_templates ADD COLUMN face_value_cents INTEGER DEFAULT 0;
ALTER TABLE coupon_templates ADD COLUMN deliverable_sku_id VARCHAR;          -- 兌換特定品項
ALTER TABLE platform_coupons ADD COLUMN qr_token VARCHAR(64);                -- POS 掃描用

-- roles：新權限項目（Phase 6）
INSERT INTO permissions (key, name, category) VALUES
  ('pos:view', 'POS 工作站', 'pos'),
  ('pos:scan', 'POS 掃描核銷', 'pos'),
  ('pos:checkout', 'POS 現金收款', 'pos'),
  ('pos:voucher_redeem', 'POS 券核銷', 'pos'),
  ('booking:view_today', '查看今日預約', 'booking'),
  ('booking:mark_attended', '標記到場', 'booking');
```

### 向下相容策略

- `bookings.activityId` nullable → 既有預約 activityId=null，原本流程不破
- `booking_configs` 保留、活動沒設時 fallback 既有單一預約配置
- 沒有 DROP，全部 ADD COLUMN

---

## API 規格

### 玩家端

```
GET  /api/fields/:fieldCode/activities          公開列表（只回 is_active=true）
GET  /api/fields/:fieldCode/activities/:slug    單一活動詳細
GET  /api/activities/:activityId/availability   時段查詢（取代 /api/bookings/availability）
POST /api/bookings                              帶 activityId 建立預約
```

### Admin 端（field_manager+）

```
GET    /api/admin/activities                    列出當前場域的活動
POST   /api/admin/activities                    新增
PATCH  /api/admin/activities/:id                編輯
DELETE /api/admin/activities/:id                軟刪除（is_active=false）
POST   /api/admin/activities/:id/cover          上傳封面 → Cloudinary
PATCH  /api/admin/activities/:id/schedule       編輯時段規則
```

### POS 端（pos_operator+）

```
GET  /api/pos/dashboard?fieldId=                今日數字 + 下個時段預約
POST /api/pos/checkin                           掃 QR token → 自動判別 + 確認資料
POST /api/pos/bookings/:id/check-in             手動標記到場
POST /api/pos/bookings/:id/no-show              標記未到
POST /api/pos/checkout                          現金收款（綁 booking 或散客）
POST /api/pos/voucher/lookup                    券 token 查資料
POST /api/pos/voucher/redeem                    券核銷
GET  /api/pos/summary?date=                     今日小結
POST /api/pos/shift/close                       班次結算
```

### 金流預留（Phase 3、不實作 API）

```
POST /api/payments/booking/:id/checkout         stub：回 503 not_implemented
                                                 將來：建 Recur/Stripe/LinePay session
POST /api/webhooks/recur                        已有（不動）
POST /api/webhooks/stripe                       已有（不動）
POST /api/webhooks/linepay                      新增 stub
```

---

## 前端頁面 / 路由

### 玩家端（mobile-first、LINE LIFF 友善）

```
/book/:fieldCode                  改：活動列表（卡片 grid、封面+價格+「立即預約」）
/book/:fieldCode/:activitySlug    新：該活動的預約頁（封面 hero + 詳細 + 時段選擇）
/book/:fieldCode/done/:code       改：用該預約對應的活動封面
/book/:fieldCode/mine             保留：我的預約（含活動名稱）
```

### POS 工作站（獨立路徑、給現場人員、手機優先）

```
/pos                              首頁 Dashboard
/pos/scan                         全螢幕 QR 掃描
/pos/bookings/today               今日預約清單
/pos/checkout                     現金收款（含散客）
/pos/voucher                      券核銷
/pos/summary                      今日小結
/pos/settings                     POS 設定（顯示偏好、機器名稱）
```

### Admin（既有 /admin/* 保留、加新頁）

```
/admin/activities                 新：活動管理（卡片列表）
/admin/activities/:id             新：活動編輯
/admin/activities/:id/schedule    新：時段規則
/admin/pos-transactions           新：POS 交易歷史（給 manager 查）
/admin/revenue                    改：加活動維度切片
```

---

## 角色權限模型

### 角色定位

| 角色 | 看得到什麼 | 改得到什麼 |
|------|----------|----------|
| super_admin | 全平台 | 全平台 |
| field_manager | 場域全部 + Admin 全 27 頁 | 場域內全設定 |
| field_director | 場域大部分 | 設定 + 報表（不可改金流） |
| field_executor | 預約 + 場次 + 設備 | 操作（不可改設定） |
| **pos_operator（新）** | POS 工作站 + 今日預約 | POS 收款 / 核銷 / 報到 |
| custom | 動態組合 | 動態組合 |
| player | 自己的玩 / 預約 / 券 | 自己的資料 |

### pos_operator 權限細節

✅ 可以：
- 查今日預約清單（自己場域）
- 掃 QR 報到
- 收現金 / 紀錄收款
- 核銷券
- 看自己班次小結

❌ 不可以：
- 改活動設定 / 定價 / 時段
- 看歷史月份報表（只看今日 + 自己班次）
- 跨場域看別館資料
- 改 LINE / 場域設定 / 角色

### 登入後 redirect 邏輯

```
super_admin / field_manager → /admin
field_director              → /admin
field_executor              → /admin/bookings（精簡視圖）
pos_operator                → /pos
player                      → /f/{lastVisitedField}/home
```

---

## LINE 整合升級

### Flex Message 卡片（每個活動專屬封面）

```
[封面圖 — activity.coverUrl]
✅ 簡瑞鴻 預約成功！
賈村射擊體驗 / 賈村競技場
─────────────
📅 時間  5/20 (三) 14:00
👥 人數  2 人
🎟️ 預約碼  C3WJAZ
💰 金額  NT$1,600（現場付款）

活動開始前 30 分鐘將再次提醒您。
[ 查看預約詳情 ]
```

### 線下付款卡片差異

```
💰 金額  NT$1,600（現場付款）
[出示此 QR 給工作人員]
[ 大 QR Code ]
```

### 線上付款卡片差異

```
💰 金額  NT$1,600
[ 立即線上付款 ]   ← 連到 checkout
（付款完成後自動確認）
```

---

## 收費 / 換券 / 核銷整合矩陣

### 收費場景盤點（全部走 POS）

| 場景 | 觸發 | 收款員 | 紀錄表 | UI |
|------|------|-------|--------|-----|
| 預約收款（線下） | 玩家現場到達 | pos_operator | pos_transactions + bookings.paidAt | /pos/scan 或 /pos/bookings/today |
| 預約收款（線上） | 玩家預約後付款 | 系統 webhook | pos_transactions（method=online_*） | 自動 |
| 散客現場購買 | 路人臨時要買 | pos_operator | pos_transactions（bookingId=null） | /pos/checkout |
| 商品銷售 | 周邊商品 | pos_operator | pos_transactions（activityId=商品） | /pos/checkout |
| 體驗加購 | 玩到一半加錢 | pos_operator | pos_transactions | /pos/checkout |

### 兌換 / 發券場景

| 場景 | 觸發 | 結果 | 紀錄表 |
|------|------|------|--------|
| 遊戲完成發券 | rewardConversionRules 觸發 | LINE 推券（含 QR） | platformCoupons |
| 兌換碼直接 redeem | 玩家輸碼 | 解鎖遊戲 / 拿券 | purchases + redeemCodeUses |
| 場域人員發碼 | admin 手動發 | 印 / 寄給玩家 | redeemCodes |

### 核銷場景

| 場景 | 觸發 | UI | 結果 |
|------|------|-----|-----|
| 預約報到 | POS 掃 booking QR | /pos/scan | bookings.checked_in_at |
| 券折抵 | POS 掃 coupon QR | /pos/scan 或 /pos/checkout | platformCoupons.status=used + pos_transactions.voucher_id |
| 兌換碼線下 | 玩家給碼 | /pos/voucher 手輸 | redeemCodes.usedCount++ |

### 統一掃描入口 `/pos/scan`

掃到 QR 後自動判別 prefix：
- `BK_xxx` → 預約報到流程
- `CP_xxx` → 券核銷流程
- `RD_xxx` → 兌換碼流程
- `SQ_xxx` → 隊伍獎勵核銷

→ 對應 endpoint：`POST /api/pos/checkin`，回應自帶 type 欄位、前端依 type 顯示對應 UI。

---

## 實作順序與里程碑

### 里程碑 M1（第 1 週）：多活動骨架

- ✅ Task #41：activities + activity_schedules schema
- ✅ Task #41：admin 活動管理頁
- ✅ Task #42：玩家活動列表 + 預約頁
- ✅ Task #42：BookDone + LINE Flex 用活動封面

**驗收**：業主可在 admin 建 3 個活動、玩家在 LIFF 看到 3 張卡片、各自能預約、LINE 收到對應封面卡片

### 里程碑 M2（第 2 週）：POS 骨架

- ✅ Task #43：金流欄位預留（onsite 模式可用、online stub）
- ✅ Task #51：pos_operator 角色
- ✅ Task #44：POS Dashboard
- ✅ Task #45：QR 掃描 + 自動核銷
- ✅ Task #46：今日預約清單

**驗收**：業主建 pos_operator 帳號、用手機開 /pos、掃 LINE 卡片的 QR、自動報到 + 顯示玩家資訊

### 里程碑 M3（第 3 週）：POS 完整

- ✅ Task #47：現金收款 + pos_transactions
- ✅ Task #48：券核銷
- ✅ Task #49：今日小結 + 班次結算

**驗收**：現場可完整完成「掃→報到→收款→核銷券→結算」流程

### 里程碑 M4（第 4 週）：消費閉環

- ✅ Task #50：券消費整合（遊戲發券→現場折抵）
- ✅ Task #52：營收儀表整合

**驗收**：玩家玩完遊戲收到券、現場 POS 掃券、折抵成功、營收儀表看到收入 + 折抵成本

### 里程碑 M5（第 5-6 週）：打磨

- ✅ Task #53：UI polish、edge case、e2e test、無障礙

**驗收**：業主跑一天現場、回饋的問題都修完

### 後續（金流啟動時）

- Phase 3 升級：Recur.tw / Stripe / LinePay 實際 API 串接（業主開店、有商戶帳號後做）
- Phase 4-A 退款管理（既有 task #34 接續）

---

## 風險與緩解

| 風險 | 影響 | 緩解 |
|------|------|------|
| Schema 影響既有預約 | HIGH | activityId nullable、booking_configs fallback、灰度切換 |
| QR 掃描 iOS Safari 相容 | MEDIUM | BarcodeDetector + qr-scanner JS fallback；最低 iOS 14.3 |
| 現場網路不穩 | MEDIUM | offline queue（IndexedDB）；操作先 local、reconnect 後 sync |
| 場域既有資料遷移 | LOW | 既有 booking 自動 activityId=null、不需 migration script |
| 業主 admin 端混淆 | LOW | 角色明確 redirect、Sidebar 加分組標籤、首次 onboarding tips |
| 券防偽 | MEDIUM | qr_token 用 64 字元隨機 + DB 校驗，不只是 code |
| pos_operator 帳號權限濫用 | MEDIUM | audit_logs 全紀錄、班次結算後鎖定操作、超過 24h 強制重新登入 |

---

## 與既有計畫的關係

- **Phase 4-A 退款管理（既有 #34）**：延後到金流實際串接後做
- **Phase 4-B 金流設定（既有 #35）**：被本計畫 Phase 3 取代（先預留、不串）
- **Phase 4-C 統一商品資料模型（既有 #36）**：被本計畫 Phase 1 取代（activities 表就是統一商品模型）

→ 本計畫**完全取代**既有 Phase 4-A/B/C，更貼近業主真實需求。

---

## 相關文件

- [docs/changes/2026-05-17-line-login.md](2026-05-17-line-login.md) — LINE Login 基礎
- [docs/changes/2026-05-17-line-per-field.md](2026-05-17-line-per-field.md) — LINE per-field
- ADR：待寫（多活動 vs 商品 vs 課程 — 為什麼選 activities 命名）

---

## 業主 5/18 確認

> 「全部推展，金流可以預留，之後再一起來處理，其他功能都可以推進，並且持續打磨一段時間」

→ Phase 1-2-3-4-5-6-7-8 全做、金流 Phase 3 只預留欄位 + onsite 流程、其他完整實作、持續打磨。
