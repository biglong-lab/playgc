# Phase DBAC 元件優化規劃 — 2026-05-07

> 範圍：所有 game 元件（solo / multi / host / 拍照 / GPS / QR）+ admin editor + e2e
> 狀態：📋 規劃中（Phase 1 即將啟動）
> 部署 commit 範圍：待開展

---

## 背景

2026-05-06 完成多人元件大清理（416 → 60，加上 5 bug 修復、寫入 ADR-0017 Loop 護欄）。
盤點完整元件分布後（89 個元件 / 81 個 page_type），發現需要進一步優化結構。

依使用者選擇的 **D → B → A → C** 順序執行四個 Phase。

---

## 商業情境對齊（紅線 #11）

每個 Phase 必須對應五大商業情境之一或多個：

- 🏛 **公部門** — 街區商圈、景點串聯、空間活化
- 💼 **私部門** — 企業內訓、員工旅遊、團隊互動
- 🎉 **活動** — 破冰、熱場、群體投票、園遊會
- 🏠 **空間** — 民宿、咖啡廳、博物館
- 💝 **交誼** — 婚禮、生日、聚會

---

## 整體路徑

```
Phase 1: D 串聯打通       (2-3 週)  ← 最高 ROI、必做
Phase 2: B 結構優化       (2 週)
Phase 3: A 品質深耕       (2 週)
Phase 4: C 補齊缺口       (2-3 週)  ← 最謹慎、可能不全做
```

---

## 🔵 Phase 1：D 串聯打通（當前 Phase）

### 目標
把現有 60 multi + 17 host + 22 單人關卡，**真的串成可賣的產品**。

### 商業情境對應
- 公部門：場域活化 → e2e 跑通讓客戶 demo
- 私部門：企業內訓 → 30 分鐘建場流程
- 活動：破冰/頒獎 → 模板包直接套用

### 子任務

#### Task D4 — 補做 e2e 真實測試（最高優先）
**為什麼**：上次 5 bug 沒抓到、就是因為原本的 e2e 只是 smoke test（驗證頁面載入），**沒有真實的端對端互動測試**。

**內容**：用 Playwright 寫 3 條黃金路徑：
- 🥇 **黃金路徑 A**（單人遊戲）：admin 建場 → 玩家用 QR 加入 → 走 5 頁 text_card/choice_verify → 完成、驗證資料庫紀錄
- 🥇 **黃金路徑 B**（多人關卡）：admin 建多人場 → 兩玩家加入分隊 → vote_team 同步 → 揭曉
- 🥇 **黃金路徑 C**（活動互動）：admin 用 spot_vote → 5 玩家提交 → 隊長揭曉 → 看到結果

**驗收標準**（紅線 #10：禁用單元測試替代 e2e）：
- 3 條 e2e 全綠、跑在真實環境（不是 mock）
- 有截圖/錄影產出
- CI 每次 push 自動跑

**估時**：3-4 工作天

---

#### Task D2 — 30 分鐘建場端對端流程
**內容**：
- 既有：`/find-scenario` Wizard → `/template-market/:id` → admin 一鍵建場 → A4 QR 列印
- 補完：每個情境包打開能直接點「使用此模板」→ 自動填入 admin editor → 送出發布 → 出 QR
- 加首次 admin 看到的 onboarding tour（可關閉）

**驗收標準**：
- 計時：從訪問首頁到拿到 QR ≤ 30 分鐘
- 真實客戶測試（找 1 個非技術人試跑）
- onboarding tour 可關閉、不擾人

**估時**：3 工作天

---

#### Task D1 — host + multi 配對 spec
**內容**：
- 寫 `docs/domains/host-multi-pairing.md`：
  - 每個 host 元件對應 1-N 個 multi page_type
  - 例：`PollLive` ←→ `vote` / `spot_vote`
  - 例：`BlessingWall` ←→ `wedding_vow` / `gratitude_tree`
  - 例：`LiveLeaderboard` ←→ `collective_score` / `vote_team`
- admin editor 在選 page_type 時提示「建議搭配的大螢幕元件」

**驗收標準**：
- 17 個 host 全部有對應 multi
- e2e 跑「投影機 + 玩家手機」雙裝置場景
- 文件可作為 demo 銷售素材

**估時**：2-3 工作天

---

#### Task D3 — 元件三軸貼齊
**內容**：
- 每個 PAGE_TYPES 加 `category` 欄位（social/event/corporate/public/venue）
- 編輯器側邊欄按情境分組顯示
- 搜尋「破冰」自動過濾相關元件

**驗收標準**：
- 81 個 page_type 全部有 category
- 編輯器搜尋功能 work
- 每個情境可篩選出 5-15 個元件

**估時**：2 工作天

---

### Phase 1 總計
- **時間**：10-12 工作天（2-3 週）
- **執行順序**：D4 → D2 → D1 → D3
- **接地驗證 checkpoint**：每個 Task 結束都要實測（不是 Vitest，是 Playwright e2e + 真人測試）
- **回報節奏**：每個 Task 結束跟使用者回報、等確認再進下一個

---

## 🟢 Phase 2-4 概覽（細節待 Phase 1 結束再展開）

### Phase 2 / B — 結構優化（2 週）
- B1: PAGE_TYPES 編輯器分組顯示（敘事/驗證/任務/拍照/挑戰/多人遊戲/情境/工作坊）
- B2: 情境模板組合（5-8 個現成包）
- B3: AI 推薦引擎（依情境推薦元件組合）
- B4: 預覽延伸（沿用本次 toast 機制）

### Phase 3 / A — 品質深耕（2 週）
- A1: 工作坊 30 個再篩選 → 真正常用的 ~15 個
- A2: 多人持久化補完（LockCoop/RelayMission/TerritoryCapture/CollectiveScore/RoleAssign L1→L3）
- A3: 單人關卡無障礙/行動 UX 優化

### Phase 4 / C — 補齊缺口（2-3 週、最謹慎）
- C1: 變數/條件/分支劇情 page_type
- C2: 積分/排名/淘汰/復活機制
- C3: LBS 多點解鎖、場域故事鏈

---

## 防線機制（從 ADR-0017 + 紅線）

| 防線 | 機制 |
|------|------|
| 任務開始前 | 對照五大商業情境（不對應 → 不做） |
| 過程中 | 不用 loop 模式無止境跑、每 5 個 task 接地驗證 |
| 任務結束 | 真實 admin editor + 真實 session 跑通才算完成 |

---

## 紅旗識別（從 ADR-0017 規則 3）

如果以下任何一項出現 → 立即停止、回報使用者：

- 🚩 連續 3 個 task 用相似模板
- 🚩 task 邊際成本 < 30 分鐘（太容易 = 可能空轉）
- 🚩 task 主題開始偏離商業情境

---

## 相關文件

- [ADR-0017 Loop 模式安全護欄](../decisions/0017-loop-mode-safeguards.md)
- [docs/changes/2026-05-06 多人元件大清理](2026-05-06-multi-component-cleanup.md)
- [CLAUDE.md 紅線 #9-#12](../../CLAUDE.md)
