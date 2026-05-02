# 多人遊戲元件平台 — 12 週路徑（2026-05-02 啟動）

> 範圍：38 個新元件 + 4 大平台基建 + 12 個情境模板
> 狀態：🟡 進行中（Phase 1 Week 1 D1 啟動）
> 預計完成：2026-08（12 週）

---

## 背景

使用者明確策略指引（2026-05-02）：

> 「我們不是回應需求，是製造想像」
> 「打造完整元件武器庫，展示組合就能變成各種玩法」
> 「重點在有用、好玩、有效，不必複雜難破關」
> 「平台穩定好用、打造大量情境讓使用者有想像」

5 大目標市場：
- **公部門**：街區商圈、景點串聯、空間活化
- **私部門**：企業內訓、員工旅遊、團隊互動
- **活動**：破冰、熱場、群體投票答題（搭配螢幕顯示）、園遊會
- **空間**：遊戲腳本、創意發想
- **交誼**：婚禮、生日、聚會

雙商業模式：
- 場域訂閱（長期空間活化）
- 情境套件（一次性活動套用）

---

## 影響範圍

### 程式碼
- `client/src/components/game/host/`（**新建第三軸線目錄**）
- `client/src/components/game/multi/`（補 5 個元件：JigsawPuzzle / TreasureHunt / GpsCascade / CollectiveScore / RoleAssign 等）
- `shared/schema/sessions.ts`（加 `host_mode`, `host_token`, `host_token_expires_at` 3 欄）
- `shared/multiplayer-component-types.ts`（加 `'host'` 分類）
- `client/src/App.tsx`（加 `/host/:sessionId`、`/play/:sessionId` 路徑）
- `server/ws/`（新增 host_screen_* WebSocket 事件）
- `server/routes/host-sessions.ts`（**新檔**：host token 簽發、session lifecycle）

### 平台基建（4 大）
- **B1. ShowcaseHub**：`/showcase` 元件展示館（公開頁）
- **B2. TemplateMarket**：`/admin/templates` 情境模板市集
- **B3. GameWizard**：5 分鐘建遊戲問答嚮導
- **B4. ClientPortal 強化**：客戶後台（weekly report、API token）

### 文件結構
- 1 個 ADR：`decisions/0004-host-screen-axis.md` ✅ 已建
- 多個 ADR 持續加：每個 phase 末加 1-2 個重要決策
- 12 週每週末更新本檔的「實作步驟」段落

---

## 解決方案

### 三波路徑摘要

| Phase | 週數 | 元件 | 焦點 | 商業意義 |
|-------|------|------|------|---------|
| **Phase 1** | W1-4 | 13 | HostScreen 軸線首發 + 公私部門補強 | 啟動商業驗證 |
| **Phase 2** | W5-8 | 12 | 紀念類 / 接力類 + 情境模板市集 | 首批客戶變現 |
| **Phase 3** | W9-12 | 13 | 角色扮演 / 氛圍類 + GameWizard | SaaS 訂閱啟動 |

### 元件複雜度三級制（**硬規則**）

| 級別 | 估時 | 規則 |
|------|------|------|
| **S** | 6h | 簡單 UI + 1 個事件 |
| **M** | 11h | 標準四件套 |
| **L** | 18-24h | 複雜邏輯（拍照流、AI 整合、多階段狀態） |

**同週不可有 2 個 L 級元件**。L 級允許跨週分段（如 JigsawPuzzle Part 1 + Part 2）。

### 紀錄節奏

- **每完成 1 元件**：本檔「實作步驟」段加 1 行（commit hash + 元件名）
- **每完成 1 phase**：在 CHANGELOG.md 開新版本區段
- **每週五**：本檔末加「本週進度」一段
- **每階段末 E2E 測試**：本檔加「驗證紀錄」段落

---

## 實作步驟

### Week 1：純骨架週（D1-D5）

**目標**：lock 技術契約 + 建立基礎建設，**不寫業務元件**

| Day | 內容 | Commit |
|-----|------|--------|
| D1 | 寫 ADR `0004-host-screen-axis.md` + 建立本檔 | （此 commit） |
| D2 | 加 `host_mode` schema + multiplayer-component-types 加 'host' 分類 | TBD |
| D2 | WS 事件擴充：`host_screen_register` / `host_screen_pulse` / `host_screen_state` | TBD |
| D3 | 建 `/host/:sessionId` + `/play/:sessionId` 路徑骨架 | TBD |
| D3 | host_token 簽發 endpoint：`POST /api/admin/host-sessions` | TBD |
| D4 | 元件腳手架腳本：`npm run scaffold:component <name>` | TBD |
| D5 | ShowcaseHub MVP（路徑 + 5 元件 demo 卡片）+ E2E 驗證 | TBD |

**Week 1 驗收**：
- [ ] ADR 0004 lock
- [ ] host/ 目錄就位（含 .gitkeep）
- [ ] WS 新事件可從 admin 端送出、玩家端收到
- [ ] `/host/:sessionId` 路徑可訪問（顯示「等待元件啟動」placeholder）
- [ ] 腳手架腳本可生成完整四件套（測過 1 個 dummy 元件）
- [ ] ShowcaseHub 公開可見

### Week 2：PollLive 首發

| Day | 內容 |
|-----|------|
| D1 | PollLive 元件本體 + 大螢幕版型 |
| D2 | PollLivePage 容器 + WS 訂閱邏輯 |
| D3 | 玩家手機端投票 UI |
| D4 | 壓測：50 / 100 / 500 玩家 |
| D5 | ShowcaseHub 加 PollLive demo + E2E |

### Week 3：HostScreen 連發（4 個 S/M）

EmojiReact (S) + WaveResponse (S) + CrowdGather (S) + LiveLeaderboard (M)

### Week 4：Phase 1 收尾 + 商業驗證

GpsCascade (M) + CollectiveScore (S) + JigsawPuzzle (L 拆兩天) + RoleAssign (M) + TreasureHunt (M)
+ **首場付費活動跑完**

### Phase 2 / Phase 3 詳細展開

留待 Phase 1 結束時 review 並更新本檔。原則上：
- Phase 2 W5-8：紀念類（PolaroidCollage, MemoryAlbum, Storybook）+ 接力類（StoryRelay, PhotoRelay）+ 12 個情境模板
- Phase 3 W9-12：角色扮演（SecretMission, WerewolfLite）+ 氛圍類（CompanyReport, TeacherConsole）+ GameWizard

---

## 驗證

### 每元件四件套標準（強制）

| 件 | 要求 |
|----|------|
| 元件本體 | TypeScript、Tailwind、繁中介面 |
| 容器頁 | GamePageRenderer 註冊、page.config 解析 |
| sync hook | WebSocket 訂閱（若多人）|
| 單元測試 | ≥ 5 測試、覆蓋核心邏輯 |
| E2E smoke | 至少 1 個流程跑通 |

### 階段 E2E 測試（每 Phase 結束）

| 階段 | E2E 測試項 |
|------|-----------|
| Phase 1 結束 | host_token 簽發 → 大螢幕進入 → 玩家投票 → state 更新 → 大螢幕廣播 |
| Phase 2 結束 | admin 複製模板 → 改文字 → 玩家進入 → 完整玩完 → 紀念物產出 |
| Phase 3 結束 | Wizard 5 分鐘生成遊戲 → 上線 → 玩家可玩 |

### 部署驗證

每 phase 末必須：
- `docker ps` 顯示 healthy
- `https://game.homi.cc/api/version` 回應正常
- 至少 1 場真實活動跑通

---

## 已知限制 / 風險

### R1：元件複雜度爆炸（已緩解）
腳手架腳本 + S/M/L 三級制 + 同週不寫兩個 L

### R2：HostScreen 技術契約做錯（Week 1 緩解）
Week 1 純骨架週 + ADR 0004 lock 契約

### R3：文件失控（已緩解）
強制使用 6 子目錄 + by-component / by-market 索引（Phase 2 末加）

### R4：商業變現延遲（Week 4 緩解）
Week 4 強制跑首場付費活動

### R5：單人燒乾（節奏控制）
12 元件/月硬上限 + 每週五不寫程式日 + Phase 間休 3 天

---

## 本週進度

### 2026-05-02（Week 1 D1-D4）

| Day | 完成 | Commit |
|-----|------|--------|
| D1 | ADR-0004 host-screen-axis 技術契約 lock | `0c52ad49` |
| D1 | 12 週路徑文件、CHANGELOG / changes/README 索引 | `0c52ad49` |
| D2 | sessions schema 加 host_mode/host_token/host_token_expires_at | `0c52ad49` |
| D2 | multiplayer-component-types 加 HOST_ONLY_COMPONENTS（8 個）+ 'host' 分類 | `0c52ad49` |
| D2 | DEMO_GAME json import 路徑修復 | `0c52ad49` |
| D3 | WS 事件 host_screen_register/pulse/state（含 hostToken 驗證、state cache） | `6803b373` |
| D3 | broadcastToHostSession 函式 + close handler 清理 + types 補欄位 | `6803b373` |
| D3 | server/routes/host-sessions.ts（4 個 admin/public endpoint） | `6803b373` |
| D3 | pages/HostScreen.tsx + pages/HostPlay.tsx 骨架頁 + App.tsx 路由 | `6803b373` |
| D4 | scripts/scaffold-host-component.mjs 腳手架腳本（解 R1）| 本 commit |
| D4 | npm run scaffold:host 註冊到 package.json | 本 commit |
| D4 | client/src/components/game/host/README.md 元件目錄文件 | 本 commit |

- ⏭ 下一步：D5 ShowcaseHub MVP + E2E 驗證 + 生產 SQL 加欄 + 部署

---

## 相關文件

- ADR：[decisions/0004-host-screen-axis.md](../decisions/0004-host-screen-axis.md)
- 多人元件規劃（既有）：[domains/multiplayer-game-components.md](../domains/multiplayer-game-components.md)
- HostScreen 技術領域文件：[domains/host-screen-protocol.md](../domains/host-screen-protocol.md)（Week 1 D2 建）
- Squad 系統（前置依賴）：[domains/squad-system.md](../domains/squad-system.md)
