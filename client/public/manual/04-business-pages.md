# 🛠️ 業務工具頁 — 11 個（簡報、找情境、後台、API）

> 平台對外的所有公開頁、業務 / 客戶 / 開發者各有專屬入口
> 全部已上線：https://game.homi.cc

---

## 🎯 11 個工具頁速查

| 頁面 | 路徑 | 對象 | 用途 | 行數 |
|------|------|------|------|------|
| PitchDeck | `/pitch` | 業務、客戶 | 7 區段銷售簡報 | 406 |
| FindScenarioWizard | `/find-scenario` | 客戶、活動承辦 | 3 問找情境 | 386 |
| TemplateMarket | `/template-market` | 客戶 | 情境模板市集（12 情境）| 208 |
| TemplateMarketDetail | `/template-market/:id` | 客戶 | 單一模板詳細 + 一鍵建場 | — |
| ShowcaseHub | `/showcase` | 客戶、設計師 | 元件 demo 集中展示 | 971 |
| Pricing | `/pricing` | 客戶 | 收費方案三軌 | 311 |
| ApiDocs | `/api-docs` | 開發者、代理商 | OpenAPI 3.1 文件 | 340 |
| Faq | `/faq` | 客戶 | 常見問題 | — |
| RoiCalculator | `/roi` | 客戶、業務 | ROI 計算機 | — |
| AdminDashboard | `/admin/dashboard` | admin | 後台總覽 | — |
| ScenarioQrPrint | `/admin/scenario-qr-print` | admin | A4 QR 列印 | — |

---

## 📊 §1. PitchDeck — 業務簡報頁（/pitch）

> 業務拜訪客戶時打開的頁面、7 區段一條龍

### 內容結構

```
1. Hero 區 — 平台一句話價值
   「公部門 / 企業 / 活動 / 空間 / 交誼五大市場通用」
   
2. 5 大市場輪播 — 每個市場 1 張卡片
   含：使用情境 + 主打元件 + 客戶案例
   
3. 28 元件總覽 — 按 host / multi 分類視覺化
   
4. 12 情境模板 — 點圖進 /template-market/:id
   
5. 收費三方案對比 — 一次性 / 訂閱 / 委辦
   含：適用客戶、平均單價、續約率
   
6. 競品差異 — 對比表
   - vs Kahoot：場域 + 多元件
   - vs Mentimeter：5 大市場通用
   - vs DIY：30 分鐘上線 vs 2 個月
   
7. CTA — 「立即聯絡業務」/ 「進 Find Scenario 找情境」
```

### 業務怎麼用

```
拜訪客戶前：
  傳 https://game.homi.cc/pitch 給客戶先看

現場：
  打開頁面 + 投影
  從 Hero 區一路滑到收費方案
  最後點 /find-scenario 帶客戶找適合情境

後續追蹤：
  Email 同樣連結 + 客製化重點 region
```

### 設計重點

- **Mobile-first**：客戶手機可看、不需大螢幕
- **快速滑動**：一頁讀完不超過 3 分鐘
- **CTA 明確**：每個區段底部都有下一步按鈕

---

## 🧙 §2. FindScenarioWizard — 找情境精靈（/find-scenario）

> 客戶 3 個問題、自動推薦最適合情境包

### 流程

```
Q1. 你的活動類別是？
  □ 婚禮 / 生日 / 聚會（💝 social）
  □ 園遊會 / 頒獎 / 破冰（🎉 event）
  □ 公部門 / 街區活化（🏛 public）
  □ 企業內訓 / 員工旅遊（💼 corporate）
  □ 民宿 / 咖啡廳 / 博物館（🏠 venue）
       ↓
Q2. 預估參加人數？
  □ 5-30 人  
  □ 30-80 人
  □ 80-200 人
  □ 200+ 人
       ↓
Q3. 主要訴求是？（多選）
  □ ❤️ 拍照分享、紀念
  □ 🎯 競賽、得分
  □ 📝 留言、簽名
  □ 🗺️ 走訪、探索
  □ 🎭 角色扮演、模擬
  □ 🎉 互動、應援
       ↓
推薦 Top 3 情境（score-based 排名）
  → 點進 /template-market/:id 看詳細
```

### 推薦演算法

```
score = (category_match × 50)
      + (size_match × 30)
      + (focus_overlap × 20)

Top 3 推薦顯示：
  - 匹配度 %
  - 預估收費
  - 含哪些元件
  - 「立即建場」CTA
```

### 業務 / 客戶怎麼用

```
業務帶客戶：
  打開 /find-scenario
  跟客戶聊 3 題
  推薦結果一起評估

客戶自助：
  /pitch → /find-scenario → /template-market/:id → 諮詢
```

---

## 🏪 §3. TemplateMarket — 情境模板市集（/template-market）

> 12 個情境模板的市集首頁、卡片式瀏覽

### 內容

```
頂部：5 大市場 tab 篩選
  ALL / 💝 / 🎉 / 🏛 / 💼 / 🏠
       ↓
Grid 3 列：12 個情境卡片
  每張卡片：
  - 漸層背景（依類別）
  - 圖示 + 名稱
  - Tagline
  - 預估人數 + 時長
  - 收費區間
  - 狀態標（live / preview）
       ↓
點卡片 → /template-market/:scenarioId
```

### 客戶體驗

```
1. 進場景市集
2. 篩選自己類別（如「💝 交誼」）
3. 看到 4 個情境包
4. 點擊感興趣的（如「婚禮派對」）
5. 看詳細 + 點「一鍵建場」
6. 系統建立活動 + 給 QR
```

---

## 🛒 §4. TemplateMarketDetail — 情境模板詳細（/template-market/:id）

> 點擊卡片後的詳細頁、含「一鍵建場」按鈕

### 內容結構

```
1. Hero — 模板名稱 + Tagline + 漸層大圖
   
2. 適用情境 — 4-5 個具體案例
   「金門後浦老街、台南神農街、迪化街文創導覽...」
   
3. 含哪些元件 — 視覺化 3-4 個元件
   每個元件附 demo 連結（→ /showcase?demo=trivia-host）
   
4. 商業價值 — 為什麼選這個模板
   
5. 預估規模 — 人數 / 時長 / 收費
   
6. 一鍵建場 CTA — 大按鈕
   「免費試玩」（test mode）
   「立即建場」（admin 登入後可用）
   
7. 相關資源 — 範例活動 / 客戶案例 / 教學影片
```

### admin 一鍵建場

點擊「立即建場」後：
```
admin 登入確認
  ↓
選擇 fieldId（場域）
  ↓
系統自動：
  1. 從 SCENARIO_TEMPLATES[id] 讀模板
  2. 建立 game session + assign hostToken
  3. 套用預設 admin 設定（題目、文案、樣式）
  4. 產生 /host/:sessionId 大螢幕網址
  5. 產生 /play/:sessionId QR code
  6. 跳轉 /admin/scenario-qr-print 列印 A4
  ↓
admin 拿 A4 QR 到現場貼桌卡 / 投影
```

---

## 🎨 §5. ShowcaseHub — 元件 demo 集中頁（/showcase）

> 28 個元件的可互動 demo、設計師 / 客戶 / 業務看完整能力

### 內容

```
頂部：軸線 tab
  HOST / MULTI / 全部
       ↓
卡片網格：28 個元件
  每張卡片：
  - 元件名稱（中英）
  - 一句話特色
  - 動態預覽（小視窗）
  - 「點此互動 demo」按鈕
       ↓
點卡片 → demoMode 全螢幕 demo
  例如：trivia-host = TriviaShowdown 大螢幕版
       jigsaw = JigsawPuzzle 多人版
```

### 列出的 demo 模式

```
host-demos:
  poll-host, emoji-host, wave-host, trivia-host,
  leaderboard-host, crowd-host, scoreboard-host,
  knowledgemap-host, polaroid-host, guestbook-host,
  wordcloud-host, lottery-host, progressquest-host,
  battlescore-host

multi-demos:
  treasure, jigsaw, gps-cascade, role-assign
  （其他 multi 元件 demo 待補）
```

### 業務怎麼用

```
拜訪客戶展示：
  打開 /showcase
  跟客戶說「我們有這 28 個元件」
  點 demo 讓客戶看實際效果
  
設計師參考：
  看其他元件視覺風格做新元件設計

技術評估：
  客戶感興趣 → 帶他逐個 demo 點進去
```

---

## 💰 §6. Pricing — 收費方案頁（/pricing）

> 收費三軌完整介紹、含 Recur.tw 訂閱整合

### 內容

```
頂部：三軌切換
  一次性活動 / 訂閱（月費）/ 公部門委辦
       ↓
每軌詳細：
  目標客戶 / 適用場景 / 收費結構 / 包含什麼
       ↓
12 情境對應收費：
  情境 → 推薦軌 → 估價區間
  例：婚禮 → 一次性 → NT$ 8K-15K
       企業內訓 → 訂閱 → NT$ 1.5K-5K/月
       街區活化 → 委辦 → NT$ 80K-200K/季
       ↓
付費機制：
  - 一次性：Recur.tw checkout（主）/ Stripe（國際）
  - 訂閱：Recur.tw subscription
  - 委辦：合約簽核（無線上付費）
       ↓
CTA：聯絡業務 / 立即訂閱（訂閱型）
```

### 設計依據

[ADR-0006 付費機制](../decisions/0006-payment-mechanism.md)（雙軌：Recur.tw 主 + Stripe fallback）

---

## 📡 §7. ApiDocs — API 文件頁（/api-docs）

> 公開 OpenAPI 3.1 規格、給代理商 / 開發者接入

### 內容

```
頂部：ReDoc 渲染 OpenAPI 3.1 規格
  資料來源：/api/v1/openapi.json
       ↓
5 個 v1 endpoints：
  GET  /api/v1/health         — 健康檢查
  GET  /api/v1/openapi        — 取規格
  GET  /api/v1/scenarios      — 列出 12 情境
  GET  /api/v1/scenarios/:id  — 單一情境細節
  POST /api/v1/instances      — 建立活動實例
       ↓
認證：API Key（Bearer Token）
速率：60 req/min per key
冪等：Idempotency-Key（24h）
```

### 代理商接入流程

```
1. 聯絡業務拿 API_KEY
2. 看 /api-docs 了解規格
3. POST /api/v1/instances 建活動
4. 取得 hostToken + QR url
5. 整合到自己平台
```

詳細 → [`docs/runbooks/agency-onboarding.md`](../runbooks/agency-onboarding.md)

---

## ❓ §8. Faq — 常見問題（/faq）

> 客戶常問的 20+ 問題、技術 + 商務都包

### 主題分類

```
- 平台介紹（5 題）
  「我們是誰？跟 Kahoot 差在哪？」
  
- 情境使用（5 題）
  「30 人小型同學會適合什麼？」
  
- 收費方案（5 題）
  「沒看到適合方案怎麼辦？」
  
- 技術細節（3 題）
  「需要下載 App 嗎？」「玩家需要登入嗎？」
  
- 客製化（2 題）
  「可以客製情境嗎？」「可以串自己系統嗎？」
```

### 業務怎麼用

```
客戶問：「我有個 X 問題」
業務：「請看 /faq 第 N 題、有完整答覆」
（省時、且答覆一致）
```

---

## 📊 §9. RoiCalculator — ROI 計算機（/roi）

> 客戶輸入活動規模、自動計算採用我們 vs 自己做的 ROI

### 輸入

```
- 活動類別（婚禮 / 企業 / 公部門...）
- 預估人數
- 預估時長
- 自己做的成本估算（人力、時間）
```

### 輸出

```
- 採用我們：NT$ X
- 自己做：NT$ Y（人力 N 小時 × NT$/小時 + 設備）
- 節省：NT$ Y - X = NT$ Z（節省 Z%）
- 回本週期（訂閱型）：N 場後回本
- CTA：立即諮詢業務
```

---

## 🎛️ §10. AdminDashboard — 後台總覽

> admin 登入後的主控台

### 區塊

```
1. Hero — 歡迎 + 場域名稱 + 快速建場按鈕
   
2. 工具入口（Phase 2 W8 加）
   - 一鍵建場（→ /template-market）
   - 看活動清單
   - QR 列印
   - 收費紀錄
   - 用戶管理
   
3. 場域數據卡
   - 本月活動數
   - 玩家總數
   - 收入估算
   - 活動完成率
   
4. AI 內容生成入口（Phase 3 W9）
   - 點情境 → AI 預覽 → 自訂題目
   
5. 用量配額卡（Phase 3 W10）
   - 本月已用 X / Y 場
   - 剩餘可用
```

---

## 🖨️ §11. ScenarioQrPrint — A4 QR 列印（/admin/scenario-qr-print）

> admin 建場後跳轉、A4 版 QR 印出貼現場

### 內容

```
A4 直式版面：
  - 頂部：活動名稱 + 場域名稱
  - 中央：大 QR code（≥ 500px）
  - 下方：玩家網址（可手打）
  - 底部：簡短玩法說明 + 時間 / 地點
       ↓
列印模式：
  Cmd + P → 選 A4 → 列印
       ↓
現場使用：
  - 桌卡：A6 切割版
  - 牆面：A4 完整版
  - 投影：點 /play/:sessionId 全螢幕
```

---

## 🔗 業務動線完整圖

```
業務拜訪
  ↓
傳 /pitch 給客戶看
  ↓
客戶有興趣 → /find-scenario 找情境
  ↓
推薦 Top 3 → /template-market/:id 看詳細
  ↓
業務報價 / 客戶決定 → admin 一鍵建場
  ↓
A4 QR 列印 → 現場貼 / 投影
  ↓
玩家掃 QR → 即時互動
  ↓
活動結束 → 統計報表 → 後續訂閱
```

---

## 🔗 下一步

- 看完整運作流程 → [05-platform-flow.md](05-platform-flow.md)
- 客戶 onboarding → [`docs/runbooks/customer-onboarding.md`](../runbooks/customer-onboarding.md)
- 代理商接入 → [`docs/runbooks/agency-onboarding.md`](../runbooks/agency-onboarding.md)
