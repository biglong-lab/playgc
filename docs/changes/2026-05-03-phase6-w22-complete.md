# Phase 6 W22 完整收尾 — 2026-05-03（單日 8 階段、20+ commits）

> **範圍**：平台手冊體系 + 後台手冊頁 + 3 新 host 元件 + 5 新情境模板 + 業務工具補完整
> **狀態**：✅ 全部完成、未部署（須使用者明確說「部署」）
> **commit 範圍**：`66c5ffc1`（階段 1）→ 階段 8 收尾（含本檔）

---

## 背景

依使用者 ARGUMENTS 平台化策略：

> 「核心穩定、元件豐富、情境化套用 — 公部門 / 企業 / 活動 / 空間 / 交誼五大市場通用」
>
> 「我們不賣複雜遊戲、提供穩定核心 + 元件 + 情境 + 業務工具鏈」
>
> 「商業彈性：一次性活動 NT$ 3K-30K / 訂閱 NT$ 1.5K-5K/月 / 委辦案 NT$ 80K-200K/季」

Phase 6 W22 sprint 目標：
1. 整理現有元件 + 情境 + 業務頁成完整手冊（讓業務 / 客戶 / 工程師都能查）
2. 加新元件補強 5 大市場 + 會議類缺口
3. 加新情境模板擴大商業選項
4. 業務工具鏈補完整（後台 + ShowcaseHub）

---

## 完整成果（量化）

| 項目 | 改動前 | 改動後 | Δ |
|------|--------|--------|------|
| Host 元件 | 14 | **17** | +3（BingoBoard / BlessingWall / MicroQa） |
| Multi 元件 | 14 | 14 | — |
| 情境模板 | 12 | **17** | +5（wedding-deluxe / carnival-bingo / escape-room / team-building / lecture-conference） |
| Host 元件 tests | 109 | **149** | +40（3 新元件 × 13-14 tests） |
| 文件總行數 | — | **2640+** | manual/ × 6 + changes / +1 |
| 公開 admin 路由 | — | **+1** `/admin/manual` |
| ShowcaseHub demo | — | **+1** W22 NEW 區塊 |

---

## 8 階段 + 20+ commits 時序

### 階段 1：平台手冊主體（commit `66c5ffc1` `86940f6c`）
- `docs/manual/README.md`（129 行）— 主目錄、5 大市場速查、三大軸線
- `docs/manual/01-host-components.md`（394 行）— 14 個 host 元件
- `docs/manual/02-multi-components.md`（394 行）— 14 個 multi 元件
- `docs/manual/03-scenario-templates.md`（339 行）— 12 情境模板
- `docs/manual/04-business-pages.md`（482 行）— 11 業務工具頁
- `docs/manual/05-platform-flow.md`（485 行）— 整體運作流程

### 階段 1.5：後台手冊頁（commit `a3a436e4`）
- `client/src/pages/admin/ManualPage.tsx`（275 行）— tab 切換 + fetch + 渲染
- `client/src/lib/markdown-mini.ts`（165 行）— 自寫輕量 markdown→HTML（不裝新 deps）
- `AdminDashboard` 加金色「📖 使用說明手冊」入口卡
- `App.tsx` 加 `/admin/manual` 路由
- `client/public/manual/*.md` 6 檔同步（給 fetch 用）

### 階段 2：BingoBoard 第 15 host 元件（commit `316d055a`）
- 5×5 任務板、12 條連線判定（5 橫 + 5 直 + 2 斜）
- 5 大市場通用（園遊會 + 商圈集章 + 員工旅遊 + 婚禮 / 生日 Bingo）
- 14 tests / 雙 renderer 註冊 / 文件三處同步

### 階段 3：BlessingWall 第 16 host 元件 + 修 dialogue 手冊小錯誤（commit `b7819d33`）
- 祝福訊息漂浮 8s + 5 種主題色系（婚禮 / 生日 / 同學會 / 頒獎 / default）
- 互補 GuestbookDigital（靜態 vs 動態）
- 13 tests / 雙 renderer 註冊
- 順便修 `venue-storyline` 手冊誤標「dialogue 待補」（dialogue 實際已存在）

### 階段 4：加 2 新情境（commit `6526a02a`）
- `wedding-deluxe`（💝 婚禮升級版、4 元件 BlessingWall + Polaroid + Bingo + Emoji、NT$ 12K-20K）
- `carnival-bingo`（🎉 園遊會 Bingo 嘉年華、4 元件 Bingo + Leaderboard + Scoreboard + Wave、NT$ 25K-50K）
- 12 → 14 情境

### 階段 5：W22 ShowcaseHub demo（commit `d5235377`）
- `client/src/components/showcase/W22DemoSection.tsx`（205 行、獨立元件）
- 業務拜訪客戶 → /showcase 第一眼看到「✨ W22 NEW」金色區塊
- 4 個試玩按鈕（host 大螢幕版 × 2、玩家手機版 × 2）

### 階段 6：加 2 新情境（commit `1c861fa0`）
- `escape-room`（🏠 venue 密室、4 multi 元件、月 NT$ 1.5K-3.5K + 一次性 NT$ 8K-25K）
- `team-building`（💼 corporate 團建、4 mixed 元件、NT$ 15K-40K）
- 14 → 16 情境
- 5 大市場分布更平衡

### 階段 7：MicroQa 第 17 host 元件（commit `5c307424`）
- 即時 Q&A（觀眾提問 + upvote + 主持人 mark_answered）
- 補講座 / 企業大會 / 學術研討 / 發表會 / 市政說明會缺口
- 防作弊：送問題 5s throttle + upvote 500ms throttle + 字數 140
- 13 tests / 3 種 pulse handler / 雙 renderer

### 階段 8：lecture-conference 情境 + 完整收尾報告（本 commit）
- `lecture-conference`（💼 corporate 講座、4 host 元件 MicroQa + Poll + WordCloud + Emoji、NT$ 8K-25K）
- 16 → 17 情境
- 完整 changes 文件記錄此 sprint

---

## 5 大市場 + 會議類完整覆蓋

| 市場 | 情境數 | 列表 |
|------|--------|------|
| 💝 social（交誼）| 5 | wedding / birthday / reunion / kids-adventure / **wedding-deluxe** |
| 🎉 event（活動）| 4 | carnival-stage / icebreaker / awards-ceremony / **carnival-bingo** |
| 🏛 public（公部門）| 2 | street-walk / district-checkin |
| 💼 corporate（私部門）| 4 | corporate-training / company-trip / **team-building** / **lecture-conference** |
| 🏠 venue（空間）| 2 | venue-storyline / **escape-room** |
| **總計** | **17** | |

✨ = W22 新增

---

## 商業價值（已可立即推廣）

### 客單價區間覆蓋（從低到高）
- **NT$ 800-2.5K/月**：venue-storyline（民宿訂閱）
- **NT$ 1.5K-5K/月**：corporate-training / escape-room（訂閱）
- **NT$ 2K-6K/場**：birthday / reunion（小型私人）
- **NT$ 5K-15K/場**：icebreaker / wedding / kids-adventure（中型）
- **NT$ 8K-30K/場**：carnival-stage / awards / company-trip / lecture-conference（中大型）
- **NT$ 12K-50K/場**：wedding-deluxe / carnival-bingo / team-building（升級版 / 大型）
- **NT$ 30K-200K/季**：district-checkin / street-walk（公部門委辦）

### 業務動線完整（業務 → 客戶 → admin → 玩家）
1. 業務帶 `/pitch` 拜訪客戶
2. 客戶 `/find-scenario` 3 問找情境
3. `/template-market/:id` 看詳細
4. **NEW** `/showcase` 點 W22 NEW 看 demo
5. admin 一鍵建場
6. `/admin/scenario-qr-print` 列印 A4 QR
7. **NEW** admin 不懂時點 `/admin/manual` 查手冊
8. 玩家現場掃 QR 即玩

---

## 紅線

依 `CLAUDE.md`：
- ❌ 禁止自動部署 — 此 sprint 全部未部署、待使用者明確說「部署」
- ❌ Schema 只新增不刪除 — 此 sprint 無 DB schema 變動
- ❌ 程式碼結構：單檔 ≤ 800 行（本 sprint 所有新檔 < 500、最大 BingoBoard 220）
- ❌ console.log / 硬編碼密碼 — 全清乾淨

### 已知限制 / 後續優化
1. **未部署**：須使用者明確說「部署」才能讓 /admin/manual + 3 新元件 + 5 新情境上線
2. **3 新元件 demo 未進 ShowcaseHub 主流程**：W22DemoSection 是獨立區塊、不在原 host element 5 demo grid
3. **新元件未進 game-editor PAGE_TYPES**：admin 後台「建立關卡」選單未含 host_bingo_board / host_blessing_wall / host_micro_qa（需另加進 `client/src/pages/game-editor/constants.ts`）
4. **scenario-templates 測試只有 20 個**：未針對新加 5 情境寫專屬 assertion
5. **W22 元件無 ShowcaseHub demo screenshot**：行銷材料 / 截圖待補

---

## 驗證

### 自動化測試
- ✅ Smoke test 51/51 全綠（持續維持）
- ✅ Host 元件 tests 17 檔 / 149 tests 全綠
- ✅ Scenario tests 20/20 全綠
- ✅ TypeScript 零錯誤

### 文件完整度
- ✅ 6 份 docs/manual/ 全到位（README + 01-05）
- ✅ docs/domains/host-screen-components.md 同步（17 元件）
- ✅ client/public/manual/ 同步（6 檔給後台 fetch）
- ✅ docs/changes/2026-05-03-phase6-w22-complete.md（本檔）

### 後台可用性
- ✅ /admin/manual 6 tab 切換
- ✅ AdminDashboard 入口卡片金色顯眼
- ✅ /showcase W22 NEW 區塊置頂

---

## 後續觀察 / 下一階段

### 24 小時觀察期（部署後）
- /admin/manual 開啟率（admin 是否使用）
- /showcase W22 NEW 點擊率（業務是否帶客戶看）
- 17 個情境的選擇分佈（看哪些情境被優先採用）

### 下一階段建議（未來 sprint）
- **W23 加新元件 demo screenshot**（行銷視覺化）
- **W23 game-editor PAGE_TYPES 加 host_***（admin 建關卡選單完整）
- **W23 補 multi 元件**（StoryDecisionTree / MerchantStamp 等）
- **W24 真實活動驗證**（找 1-2 個情境真實場域跑、收集回饋）
- **W25 多語系**（英文版手冊 + 業務頁）

---

## 相關文件

- 平台手冊：[docs/manual/README.md](../manual/README.md)
- 設計依據：[ADR-0004 host-screen-axis](../decisions/0004-host-screen-axis.md)
- 既有變動：[2026-05-03 session-handoff.md](2026-05-03-session-handoff.md)
- 紅線守則：[CLAUDE.md](../../CLAUDE.md)
