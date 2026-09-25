# 經銷體系：區域歸屬、月租分帳、經銷後台閉環 — 2026-09-25

> 範圍：P3 經銷 MVP + P6 經銷後台與分潤（合併重排）／狀態：**規劃中、待業主確認**／部署：無
> 上游：[2026-09-23 平台總體規劃](2026-09-23-platform-overhaul-plan.md) §經銷合作模型、§業主決定
> 對應 ADR（確認後撰寫）：ADR-0026 經銷夥伴模型

## 背景

業主 2026-09-25 補充需求（原話重點）：

- 讓經銷商可以**管理、銷售**我們的平台功能，建構完整的**引導、步驟、閉環**，讓更多人來幫忙推
- **沒有經銷的區域就都由我們來管理；有經銷對象，該區域的服務就交給經銷處理**
- 月租費用與經銷**分帳**；**所有收費方式一致**；每個經銷帳號**預設五五分**，可依專案價格實際調整
- 降低耦合、積木化獨立模組

盤點現況（2026-09-25，程式碼實查）：

| 已經有 | 還沒有 |
|---|---|
| 4 方案（free 0 / pro 1999 / enterprise 9999 / revshare 0，各帶交易抽成 %）`shared/schema/platform-plans.ts` | partners 任何表、任何路由、任何頁面 |
| `field_subscriptions`（每場域一筆、可覆寫 `customFeePercent`） | 「區域」概念（`fields` 只有 `address` 文字欄） |
| `platform_transactions`（平台向場域收的錢：subscription / transaction_fee / …，有 paid 狀態） | 分潤表、分潤月結 |
| 申請審核 → `provisionField()` 一條路開通（P2 已做） | `/apply` 帶 ref、`field_applications.partner_code` |
| `field.provisioned` 事件（含 `partnerCode`） | 事件訂閱者（現在 0 個） |
| 平台後台 27 頁、`requirePlatformAdmin` | `/partner` 經銷後台、平台「經銷夥伴」頁 |
| 代理商 Public API（key 在環境變數） | 平台層權限目錄（`platform_admins` 從未寫入） |

## 設計原則（本批固定）

1. **客戶永遠付平台定價**（4 方案為準）。經銷不定價、不收款；經銷的收入 = 平台「已收到的錢」× 分帳比例。這就是「收費方式一致」。
2. **平台沒收到錢，不產生分潤**（沿用 09-23 決定）。分潤只從 `platform_transactions.status = paid` 產生。
3. **歸屬三來源、一個優先序**：明確推薦（ref）＞ 區域（客戶所在縣市有專屬經銷）＞ 平台自管。歸屬一經寫入就固定（換區、換經銷不回溯既有客戶）。
4. **分帳三層預設**：平台預設 50% → 每家經銷可設自己的預設 → 每個客戶場域（專案）可再覆寫。
5. **經銷在客戶場域是「帳號 + 角色」，不是新的 systemRole**（沿用 09-23）：預設「經銷報表」角色（`report:view` + `revenue:view`），客戶可調高為「經銷協助」「代管」。
6. **積木**：`partners` 是一塊獨立積木（hung-blocks L1 四件套），只透過入口函式與事件跟 fields / billing / applications 對話；守護測試鎖住跨模組 import = 0。

## 資料模型（全部只加不刪）

```
regions                 縣市層級（種子 22 筆；code 如 TW-KMN 金門、TW-TPE 台北）
  code PK, name, parent_code NULL, sort_order

partners                經銷主檔
  id, code UNIQUE（推廣碼 / 落地頁 slug）, name, status(active|suspended),
  default_share_percent INT DEFAULT 50（0–100）,
  share_transaction_fee BOOL DEFAULT false（交易抽成是否也分，預設只分月租）,
  can_create_fields BOOL, max_fields INT,
  brand{logoUrl,color,tagline} jsonb, contact{name,email,phone,line} jsonb,
  payout{bankName,bankCode,account,holder} jsonb（加密儲存、顯示遮罩）,
  onboarding jsonb（完成度清單狀態）, created_at, updated_at

partner_members         誰能登入 /partner
  partner_id, admin_account_id（沿用現有帳號、Firebase 登入）, role(owner|staff), created_at

partner_territories     區域專屬
  partner_id, region_code, effective_from, effective_to NULL
  ── 唯一：同一 region 同時間只能有一個生效中的經銷（partial unique index）

partner_fields          經銷 ↔ 客戶場域授權
  partner_id, field_id, attribution(referral|territory|manual|self_created),
  share_percent INT NULL（NULL = 用 partners.default_share_percent）,
  access_level(report|assist|manage), attached_at, detached_at NULL
  ── 一個場域同時只能有一個生效中的經銷

partner_leads           名單（經銷帶進來但還沒開通的）
  partner_id, name, contact, region_code, source(landing|manual|api),
  status(new|contacted|applied|won|lost), field_application_id NULL, created_at

partner_commissions     分潤明細（冪等）
  partner_id, field_id, platform_transaction_id UNIQUE,
  base_amount（平台實收）, share_percent（當時生效值，快照）, amount,
  period(YYYY-MM), status(pending|approved|paid|voided), approved_at, paid_at, note

partner_payouts         月結匯款批次
  partner_id, period, total_amount, status(draft|approved|paid), paid_at, reference

fields.region_code      NULL 可空（新增；既有場域回填為 NULL = 平台自管）
field_applications.partner_code NULL、region_code NULL（新增）
```

## 歸屬判定（開通時執行一次，寫進 partner_fields）

```
申請進來（/apply 或經銷後台代建）
  ├─ 帶 ref=CODE 且 partner active           → attribution = referral,  partner = CODE
  ├─ 經銷登入後自己建（額度內）               → attribution = self_created, partner = 自己
  ├─ 申請填的 region 有生效中的專屬經銷        → attribution = territory, partner = 該區經銷
  └─ 以上都沒有                              → 不寫 partner_fields = 平台自管
```

- 觸發點：訂閱 `field.provisioned` 事件（partners 積木是第一個訂閱者）
- 平台可事後手動指定 / 解除（`manual`；解除寫 `detached_at`，不刪列，分潤計到解除日為止）

## 分帳計算（月結、冪等）

```
每月 1 日（或平台手動跑）針對上月：
  取 platform_transactions WHERE status=paid AND paid_at 在期間內
    AND type IN ('subscription','setup_fee')            ← 月租類
    AND（partners.share_transaction_fee 時再加 'transaction_fee'）
  對每筆：找該 field 在 paid_at 當下生效的 partner_fields
    share = partner_fields.share_percent ?? partners.default_share_percent
    INSERT partner_commissions(platform_transaction_id UNIQUE …) ON CONFLICT DO NOTHING
  彙總成 partner_payouts(partner, period, total, draft)
平台核准 → approved；人工匯款後標 paid（填匯款參考號）
退款（platform_transactions type=refund）→ 產負向 commission 抵銷
```

- 重跑不重複（`platform_transaction_id` 唯一）
- 比例用快照，事後調整比例只影響之後的交易
- 金額為新台幣整數，四捨五入到元；差額歸平台

## 經銷後台 `/partner`（一頁一功能）

| 頁 | 主要動作 | 內容 |
|---|---|---|
| 總覽 | — | 本月預估分潤、客戶場域數、待處理名單、完成度清單（≤ 5 步） |
| 客戶場域 | 進入該場域報表 | 場域、方案、狀態、歸屬來源、我的分帳比例（唯讀）、最近付款 |
| 開通新客戶 | 建立 | 兩條路：A 額度內直接建場（走 `provisionField`）／B 送申請由平台審 |
| 名單 | 新增名單 | 落地頁表單自動進來 + 手動登記；狀態流轉 |
| 推廣工具 | 複製 | 專屬連結 `/p/:code`、QR、落地頁預覽、可貼文案；品牌 logo / 標語設定 |
| 分潤對帳 | 匯出 CSV | 各月明細（場域、交易、實收、比例、分潤）、批次狀態、匯款紀錄 |
| 我的區域 | — | 專屬縣市清單、生效期間（唯讀；申請調整走聯絡平台） |
| 設定 | 儲存 | 聯絡資料、收款帳戶（遮罩）、成員 |

完成度清單（存伺服器 `partners.onboarding`）：填聯絡與收款 → 看推廣連結 → 建第一筆名單 → 開通第一個客戶 → 看第一份對帳單。每步直接連到該頁。

## 平台端 `/platform/partners`

| 頁 | 主要動作 |
|---|---|
| 經銷夥伴列表 | 新增經銷（名稱、代碼、預設比例、可建場上限、區域） |
| 經銷詳情 | 改比例／額度／區域、暫停、看客戶場域與分潤、手動指定或解除場域歸屬 |
| 分潤月結 | 跑月結（冪等）、核准批次、標已匯款、匯出 |
| 區域總覽 | 22 縣市 × 現任經銷；空白 = 平台自管；一鍵看各區客戶數與 MRR |

## 積木邊界（hung-blocks L1）

```
server/modules/partners/
├── index.ts        白名單導出：getPartnerForField(fieldId)、resolveAttribution(input)、
│                   listPartnerFields(partnerId)、requirePartnerMember(中介層)、runMonthlyCommissions(period)
├── server/         routes（/api/partner/*、/api/platform/partners/*）、attribution、commissions、subscribers
└── shared/         schema（上面 7 張表）、純函式（分帳計算、歸屬優先序）
client/src/pages/partner/  經銷後台頁
client/src/pages/platform/Partners*.tsx
```

- 讀 fields / subscriptions / platform_transactions：**透過對方入口函式**（billing 新增 `listPaidTransactions(period)`、fields 新增 `getFieldRegion(fieldId)`），不直查表
- 通知：訂閱 `field.provisioned`（寫授權、lead 標 won）；新增事件 `platform_transaction.paid`（billing 發、partners 只記錄不即時算，月結才算）
- 守護測試：跨模組 import = 0、share_percent 0–100、一區一經銷、月結重跑 0 重複、平台未收款 0 分潤

## 權限與登入

- 經銷成員 = 現有 `admin_accounts`（Firebase 登入）+ `partner_members` 一筆；`requirePartnerMember` 中介層
- 進客戶場域：授權時在該場域建 admin_account + 套角色（report / assist / manage）；`switch-field` 放寬為「同一 firebaseUserId 在目標場域有 active 帳號即可切」
- 平台端新增權限鍵（進目錄）：`platform:partners_manage`、`platform:commissions_approve`、`platform:commissions_pay`；先仍以 `requirePlatformAdmin` 守，鍵先進目錄供之後細分

## 分階段（每段可獨立部署、部署等口令）

| 段 | 內容 | 驗收（真瀏覽器 / API） | 天 |
|---|---|---|---|
| P3-A 底座 | 7 張表 + fields.region_code + applications 兩欄；regions 種子；partners 積木骨架 + 守護；`field.provisioned` 訂閱者；`/apply` 收 ref + region；平台 partners CRUD + 區域 + 比例 | 平台建經銷 A（金門專屬、55 分）→ 客戶從 `/p/A` 申請 → 審核 → partner_fields 出現 referral；另一客戶填金門、沒帶 ref → territory；台北沒經銷 → 平台自管 | 4–5 |
| P3-B 經銷後台 | `/partner` 8 頁 + 完成度清單；額度內自建場；名單；推廣工具；經銷報表角色 + switch-field 放寬 | 經銷登入只看到自己的場域；照清單 5 步走完；進客戶場域只看得到報表 | 5–6 |
| P3-C 分帳閉環 | 月結 job（手動觸發 + 排程）、`partner_commissions` / `partner_payouts`、平台核准 / 標付、經銷對帳頁 + CSV、退款抵銷 | 兩筆 paid 訂閱（1999 × 2）→ 月結 → 經銷看到 1999（50%）+ 覆寫 40% 那家 800；重跑 0 新增；退款出現負項 | 3–4 |

總計 12–15 工作天。P3-A 完成即可對外簽第一家經銷（歸屬與比例都已固定），P3-C 完成前分潤先人工對帳。

## 與 PhotoGo partner 積木對齊（同一家經銷賣兩個產品）

PhotoGo（`/projects/互動`）2026-09-25 已上線 partner 積木（其 ADR-0011），業主原話同源：「有區域經理團隊，就把這區域的機器交給他去管理，收入拆帳」。兩邊照同一套形狀做，經銷才能用一個代碼賣兩邊、看同格式對帳單：

| 對齊項 | PhotoGo 已定 | CHITO 本批採用 |
|---|---|---|
| 成員角色 | manager（負責人）/ sales（業務） | 同（取代上文 owner / staff） |
| 成員登記 | 用信箱登記、第一次登入才綁 userId、**信箱未驗證不算成員**、一人一家 | 同；沿用 `admin_accounts` 的 Firebase 登入 |
| 能做 / 不能做 | 開客戶（3 步）、看名下客戶健康；不能改客戶方案、不能進客戶後台（除非客戶邀請） | 同；CHITO 額外允許「客戶同意後套經銷報表角色」（09-23 決定） |
| 安全規則 | 試用 1–30 天不能 0、方案只能選公開方案、開客戶配額 + 每小時 10 個、客戶已有擁有者不能再邀、至少留一位負責人、代稱撞名自動換尾碼；每條有錯誤碼與反例測試 | **全部照抄**（錯誤碼同名） |
| 積木邊界 | `/api/partner/*`（成員）、`/api/platform/partner/*`（平台）；除 `/me` 外每支都在 `requirePartner` 之後（守護測試查路由順序）；別家客戶一律 404 | 同 |
| 分潤預設 | 訂閱 20% / 營運 30% | 業主 09-25 指示月租 50% → **需統一**（見下表） |
| 區域專屬 | 沒有（`tenants.partner_id` null = 直營） | 本批新增 `regions` + `partner_territories`；建議之後回饋給 PhotoGo 同樣做 |
| 分潤單 | 第 3 批待做（月結、只算不撥） | P3-C；格式與 PhotoGo 對齊（場域 / 交易 / 實收 / 比例 / 分潤 / 期間） |

## 需業主決定（本批新增）

| 事項 | 選項 | 建議 |
|---|---|---|
| 兩產品分帳預設是否統一 | 都 50%／各自（CHITO 50、PhotoGo 20/30）／另定 | **統一一套**（「收費方式一致」），數字由業主定；CHITO 依指示先做 50 |
| 交易抽成要不要分 | 只分月租／月租 + 抽成一起分／各家自選 | **各家自選、預設只分月租**（`share_transaction_fee`） |
| 區域粒度 | 縣市／鄉鎮／自訂 | **縣市**（22 筆種子），鄉鎮先不做 |
| 區域專屬 vs 推薦衝突 | 推薦優先／區域優先 | **推薦優先**（誰帶來的歸誰），區域只接沒人帶的 |
| 換經銷後既有客戶 | 跟著區域走／留給原經銷 | **留給原經銷**（歸屬固定，避免帳務爭議） |
| 分潤何時可領 | 月結後即可／客戶付款滿 N 天（防退款） | **paid 後 14 天**才進可核准批次 |
| 經銷自建場的方案 | 只能 free 試用／可選任一方案 | **可選任一**，但付款仍由客戶對平台 |

## 相關文件

- [2026-09-23 平台總體規劃](2026-09-23-platform-overhaul-plan.md)
- [domains/business-model.md](../domains/business-model.md)（4 方案、通路策略）
- [runbooks/agency-onboarding.md](../runbooks/agency-onboarding.md)（既有代理商 API 通路，與本批「經銷」是兩種角色：代理商=技術整合、經銷=業務通路）
- ADR-0026（待寫）
