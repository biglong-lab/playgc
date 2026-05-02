# Customer Pilot Runbook — 真實客戶 pilot 跑團 SOP

> 用於 Phase 5 W17 真實客戶招募 + 第一場付費活動
> 業務 + admin 雙方都讀此文件

---

## 🎯 目標

W17 一週內完成：
- 找到 1-3 個真實客戶（公部門 / 私部門 / 活動 / 空間 / 交誼 任一市場）
- 跑完整流程：詢問 → 提案 → 建場 → 活動 → 反饋 → 收費
- 收集 5 個關鍵驗證錨點數據（見 ADR-0012）

---

## 📋 跑團流程（10 步驟、每步 ≤ 30 分鐘）

### Step 1：客戶確認（10 分鐘）

業務確認：
- [ ] 客戶活動名稱
- [ ] 活動日期 + 場地
- [ ] 預估參與人數
- [ ] 主要目的（破冰 / 慶生 / 行銷 / 教學 ...）
- [ ] 預算範圍

→ 用 PitchDeck 公開頁簡報 [pitch](https://game.homi.cc/pitch) 介紹三方案

### Step 2：情境配對（10 分鐘）

引導客戶用 [find-scenario](https://game.homi.cc/find-scenario) 三問配對：
- 私下 / 公開？
- 室內 / 室外？
- 競賽 / 創作 / 互動？

→ 系統推薦 1-3 個情境模板、客戶選定

### Step 3：套餐選定（5 分鐘）

依預算 + 規模選方案：

| 方案 | 適用 | 價格 | 包含 |
|------|------|------|------|
| 一次性 | 單次活動 | NT$3K-30K | 完整情境 + 12h hostToken |
| 訂閱 | 月活動 ≥ 3 場 | NT$1.5K-5K/月 | 無限建場 + 客服 |
| 委辦 | 大型 / 客製化 | NT$80K-200K | 業務全包 + 設計 + 拍攝 |

### Step 4：admin 預建場（5 分鐘）

admin 從電腦或手機（任一）建場：

**A. 電腦建場**：
1. 登入 [admin 後台](https://game.homi.cc/admin)
2. 選定情境模板 → 一鍵建場
3. 印 [QR 列印頁](https://game.homi.cc/admin/scenario-qr-print)（A4 自動分頁）

**B. LINE 建場**（W15 D5 後）：
1. admin 在 LINE Bot 對話框打：`@chito 婚禮 客戶名 日期`
2. Bot 30 秒內回 hostUrl + playUrl
3. admin 把 playUrl 轉給活動主辦方掃 QR 給來賓

### Step 5：活動前 1 天確認（10 分鐘）

業務寄信 + LINE 給客戶：
- [ ] 大螢幕網址（請投影確認）
- [ ] QR Code A4（請列印貼活動現場）
- [ ] 預演時間（建議活動前 30 分鐘）
- [ ] 客服聯絡方式

→ admin 用 LINE 看：`@chito 我的活動` 確認 active

### Step 6：活動當天（依時長）

admin / 業務現場（或遠端）支援：
- [ ] 活動前 30 分鐘 admin 確認 hostUrl 投影正常
- [ ] 玩家 QR 掃描體驗測試 1-2 個
- [ ] 活動進行中監控（admin 後台或 LINE）
- [ ] 突發狀況：admin LINE 結束某場 `@chito 結束 <id>`

### Step 7：活動結束（5 分鐘）

admin 動作：
- [ ] LINE 收到「活動即將過期」reminder
- [ ] 或活動結束時 admin 主動結束（W16 D3）
- [ ] 系統自動派 webhook（如客戶有 API 整合）

### Step 8：反饋收集（30 分鐘）

業務發送反饋表單給客戶：
- 整體滿意度（1-5）
- 哪個元件最受歡迎
- 哪個元件覺得多餘
- 是否會推薦給其他活動主辦
- 願意付多少錢

→ 紀錄到 `docs/changes/2026-XX-XX-pilot-feedback-<客戶>.md`

### Step 9：收費（10 分鐘）

業務開立發票：
- 一次性：客戶付完款後業務開發票
- 訂閱：自動扣款（recur.tw）+ 月寄收據
- 委辦：分期付款依合約

### Step 10：覆盤（30 分鐘）

業務 + 工程內部會議：
- 流程哪裡卡住？
- 客戶反覆問哪個問題？（→ FAQ 補）
- 下次客戶能不能用 self-service（不需業務）？

→ 重大決策進 [decisions/](../decisions/)、流程改進進 [runbooks/](.)

---

## 🔥 常見問題 FAQ

### Q1：客戶問「最低活動人數是？」
答：建議 ≥ 10 人才有趣（host_polaroid_collage / host_emoji_react 都需要群眾感）。10 人以下建議用 single 軸線元件（如 trivia_showdown 個人答題）。

### Q2：客戶問「玩家要安裝 App 嗎？」
答：不用。掃 QR 在瀏覽器即玩。LINE 用戶可選擇 LIFF 模式（自動帶入 LINE 名字、體驗更順）。

### Q3：客戶問「資料會保留多久？」
答：12 小時 hostToken 過期、但活動內容（玩家照片 / 留言 / 簽名）可選擇「活動結束後寄打包檔」（一次性方案）或「永久雲端保存」（訂閱方案）。

### Q4：活動中突然有玩家連不上怎辦？
答：
1. 確認 wifi / 4G 訊號（多數情況是訊號問題）
2. 玩家手機重新掃 QR（hostToken 12h 都有效）
3. admin 用 LINE `@chito 我的活動` 確認 session 還 active
4. 仍無法 → 業務 / 工程立即遠端 join 排查

### Q5：客戶要客製化 UI（換 logo / 顏色）？
答：
- 一次性方案：不含、走 default 設計
- 訂閱方案：含基本客製（logo + 主色）
- 委辦方案：完整客製（含設計師參與）

---

## 📊 W17 業務 KPI

W17 結束時：
- [ ] 接觸潛在客戶 ≥ 5 人
- [ ] 真實成交客戶 ≥ 1 人
- [ ] 完成完整流程跑團 ≥ 1 場
- [ ] 收到客戶反饋 ≥ 1 份

W17-W21 累計：
- [ ] 真實成交 ≥ 3 場活動
- [ ] 跨 ≥ 2 個市場（公 / 私 / 活動 / 空間 / 交誼）
- [ ] 元件熱度數據（W21 retro）

---

## 🛠 業務工具速查

| 工具 | 連結 | 用途 |
|------|------|------|
| Pitch Deck | [/pitch](https://game.homi.cc/pitch) | 客戶簡報 |
| 找情境 | [/find-scenario](https://game.homi.cc/find-scenario) | 客戶配對情境 |
| 模板市集 | [/template-market](https://game.homi.cc/template-market) | 12 情境瀏覽 |
| QR 列印 | /admin/scenario-qr-print | A4 自動分頁 |
| Pricing | [/pricing](https://game.homi.cc/pricing) | 三方案 |
| API 文件 | [/api-docs](https://game.homi.cc/api-docs) | 代理商整合 |

---

## 🔗 相關文件

- [ADR-0012 Phase 5 方向](../decisions/0012-phase5-direction.md)
- [Phase 4 完整收尾](../changes/2026-05-03-phase4-complete.md)
- [Customer Onboarding](customer-onboarding.md)
- [Agency Onboarding](agency-onboarding.md)
