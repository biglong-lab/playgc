# 多人遊戲元件規劃（GAME_COMPONENT_MULTIPLAYER_PLAN）

> **文件版本**: v1.5
> **建立日期**: 2026-05-01
> **最後更新**: 2026-05-02
> **作者**: Hung（大哉實業有限公司）+ Claude Code 規劃協作
> **狀態**: Phase 1 ✅ + Phase 2 ✅ + Phase 2.5 ✅（穩定性軸）+ Phase 2.6 ⏳ 進行中
> **預計工期**: 5-6 週（分 4 階段 + 穩定性穿插軸）

---

## 📌 文件用途

這份文件是**長期接力紀錄**，目的：
1. 讓未來任何人（包括未來的自己、其他協作者、AI 助手）能快速理解多人遊戲架構決策
2. 避免重複已完成工作（Squads / Walkie / Match / BattleClan 都已上線）
3. 作為實作期的單一真實來源（Single Source of Truth）

**閱讀順序建議**：
- 第一次接觸 → 讀 §1 §2 §3 §10（背景、原則、邊界）
- 開工前 → 讀 §5 §6 §11（設計、現狀、施工順序）
- 實作中 → 對照 §6 個別元件設計
- 完工驗收 → 對照 §12 驗收標準

### 📊 雙軸架構（v1.5 加入）

本規劃實作時分**兩條獨立並行的軸**：

| 軸 | 範圍 | 章節 |
|---|------|------|
| **元件軸**：Phase 1-4 | 元件層多人化（PhotoTeam / VoteTeam / LockCoop ...） | §3 §6 §11 |
| **穩定性軸**：Phase 2.5 | 多人遊戲執行時的穩定性（重連 / 寬限期 / 進度同步 / 通知） | §11 Phase 2.5 |

兩軸**同等必要不可缺**。元件軸建造多人玩法，穩定性軸保證玩法在現場活動的網路波動下不破裂。Phase 2.5 是 Phase 2 完成後實機驗證才補上的軸，後續若發現新的穩定性需求應加進 Phase 2.5（命名 2.5.X）而非塞進元件 Phase。

---

## 1. 背景與動機

### 1.1 現狀觀察（基於 2026-05-01 盤點）

CHITO 平台底層多人基礎建設**完成度高**：

| 層 | 完成度 | 已上線 |
|---|--------|-------|
| Squads 系統（公會） | 65% | Phase 12.1-12.6 已部署 |
| BattleClan（水彈戰隊） | 100% | 線上、223 測試通過 |
| Match 對戰 / Relay 接力 | 100% | Phase 1-2+5-8 完成 |
| WebSocket（Team/Match/Session/BattleSlot） | 100% | 17+21 測試 |
| Walkie 對講機（LiveKit） | 100% | 線上（PTT/QR/隊友模式） |
| 賽季 ELO 排行榜（6 個） | 100% | 已部署 |
| Admin 後台 E2E | 100% | smoke 196/196 通過 |

**但是 — 遊戲元件層幾乎全是單人**：

| 統計 | 數量 |
|------|------|
| 純單人元件 | 13 個 |
| 部分多人（後端有/前端缺） | 2 個（Vote, Shooting） |
| 完整多人 | 1 個（PhotoTeam） |

### 1.2 核心問題

**底層投資 80% 完成，上層消費 20% 完成** — 玩家進場後，96% 的遊戲體驗仍然是單人玩法，組隊的價值無法在遊戲過程中體現。

### 1.3 本規劃要解決的問題（**範圍精準**）

| 範圍 | 在範圍內 | 在範圍外 |
|------|---------|---------|
| 元件層多人化 | ✅ | ❌ |
| 統一分類框架 | ✅ | ❌ |
| 多人元件新建 | ✅ | ❌ |
| Squads Phase 14-15 | ❌ | ✅（走 [SQUAD_SYSTEM_DESIGN.md](SQUAD_SYSTEM_DESIGN.md) 路線） |
| Walkie 增強 | ❌ | ✅（已上線，依 [WALKIE_TALKIE_PLAN.md](WALKIE_TALKIE_PLAN.md)） |
| Match / BattleClan | ❌ | ✅（已上線） |
| 場域隔離 | ❌ | ✅（依 [MULTI_FIELD_FULL_AUDIT.md](MULTI_FIELD_FULL_AUDIT.md)） |
| 金流 / E2E / Lint | ❌ | ✅（依 Phase 27） |

---

## 2. 設計原則（**核心原則，所有實作必須遵守**）

### 2.1 原則一：元件單一職責 — 單/多人不混

**禁止**：一個元件用 prop 切換單/多人模式
```tsx
// ❌ 錯誤
<Lock multiplayer={true} teamId={...} />
```

**正確**：拆分為兩個獨立元件
```tsx
// ✅ 正確
<Lock />          // 個人版
<LockCoop />      // 多人協作版
```

**理由**：
- 軟體工程：單一職責原則（SRP）、Bug 隔離、測試矩陣縮小
- Admin 體驗：選元件就決定模式，不必懂技術設定
- 玩家體驗：模式不會中途切換，互動設計可獨立優化

### 2.2 原則二：三分法元件分類

```
通用元件（shared）  → 兩種模式都能用，純展示無互動
個人專用（solo）    → 只給個人遊戲用
多人專用（multi）   → 只給多人遊戲用
```

**判斷標準**：
- 元件**完全不涉及玩家輸入或團隊協作** → 通用
- 元件**只關心當前玩家** → 個人專用
- 元件**需要隊友狀態、協作、共享進度** → 多人專用

### 2.3 原則三：命名規則

| 後綴 | 意義 | 範例 |
|------|------|------|
| 無後綴 | 個人版（預設） | `Lock`, `Vote`, `Shooting` |
| `Team` | 隊伍協作（共享進度） | `VoteTeam`, `ShootingTeam`, `PhotoTeam` |
| `Coop` | 協作型（不對稱資訊） | `LockCoop`（每人不同線索） |
| `Race` | 隊伍對戰（搶答/競速） | `ChoiceVerifyRace` |
| `Relay` | 接力（前一個完成才解鎖下一個） | `RelayMission` |

**規則**：
- 無後綴的元件預設為個人版，**永遠不加 `Solo` 後綴**
- 多人元件後綴必須能反映玩法（`Team` ≠ `Coop` ≠ `Race`）
- 命名必須出現在 `multi/` 或 `solo/` 對應目錄（雙重保證）

### 2.4 原則四：playerMode 強約束（**從現有 gameMode 推導，不新增欄位**）

**設計決策（v1.1 修訂）**：原本規劃新增 `games.playerMode` 欄位，盤點後發現 [shared/schema/games.ts:22](../shared/schema/games.ts) 既有的 `gameMode` enum（`individual / team / competitive / relay`）已能完全推導，依 DRY 原則改用 helper 推導，**不變更 schema**。

**推導邏輯**（[shared/multiplayer-component-types.ts](../shared/multiplayer-component-types.ts) `derivePlayerModeFromGameMode`）：

```
gameMode === "individual"  → playerMode = "solo"
gameMode === "team"        → playerMode = "multi"
gameMode === "competitive" → playerMode = "multi"
gameMode === "relay"       → playerMode = "multi"
```

**約束**（**v1.2 修訂為不對稱**）：

| 遊戲模式 | 允許的元件 | 不允許 |
|---------|-----------|--------|
| `playerMode='solo'`（gameMode=individual） | 通用 + 個人專用 | 多人專用 |
| `playerMode='multi'`（gameMode=team/competitive/relay） | 通用 + 個人專用 + **多人專用** | — |

**為什麼不對稱**：盤點線上 28 個 team 遊戲時發現，全部都是「個人元件 + 隊伍基礎建設（Walkie/WebSocket/TeamLobby）」的混合模式。多人遊戲穿插個人挑戰是業界常態（LoL、密室逃脫、大富翁皆如此），原本對稱約束會擋下所有現有 team 遊戲。

**規則**：
- 多人專用元件（如 photo_team、vote_team）必須在多人遊戲才有意義 — 嚴格禁止個人遊戲使用
- 個人專用元件（如 lock、shooting_mission）兩種模式都可用 — 多人遊戲可穿插個人挑戰
- 通用元件（如 text_card、video）兩種模式都可用 — 純展示無互動

**違反 → server 拒絕儲存 + admin UI 灰掉不允許選**

**好處**：
- 零 schema 變更 = 零風險
- 既有資料無需遷移
- 線上既有 team 遊戲不被破壞
- admin UI 一個欄位就夠

### 2.5 原則五：使用者語言一致

**玩家介面**永遠只看到三個概念：
- **隊伍**（Team）= 一場遊戲的成員
- **戰隊**（Squad）= 跨場域長期身份
- **對講機**（Walkie）= 語音通話

不允許在使用者介面出現英文技術詞（Squad / Team / Clan / Group / Multi / Solo），全部中文化。

### 2.6 原則六：共用邏輯抽 hook，不複製貼上

兩個（或以上）多人元件需要的邏輯 → 抽到 `shared/hooks/`。
個別元件專用邏輯 → 留在元件內。
**禁止跨元件複製貼上超過 10 行**。

---

## 3. 元件分類規範

### 3.1 通用元件（shared）— 預計 4-5 個

兩種模式都能用，純展示或純流程控制：

| 元件 | 用途 | 為何通用 |
|------|------|---------|
| `TextCard` | 顯示文字卡 | 無玩家輸入 |
| `Dialogue` | 對話劇情 | 無玩家輸入（選分支可保持單人語意） |
| `Video` | 播放影片 | 無玩家輸入 |
| `FlowRouter` | 流程路由 | 無玩家輸入，純邏輯分支 |
| `Button`（待評估） | 選擇按鈕 | 個人選擇 → 個人專用；隊伍投票 → 應拆 `ButtonVoteTeam` |

### 3.2 個人專用元件（solo）— 13+ 個

只給 `playerMode='solo'` 的遊戲使用：

| 元件 | 玩法 |
|------|------|
| `TextVerify` | 文字答題 |
| `ChoiceVerify` | 選擇題（quiz 模式） |
| `ConditionalVerify` | 條件驗證（庫存/分數/位置） |
| `Vote` | 個人投票（單機） |
| `Lock` | 個人解鎖密碼 |
| `QrScan` | 掃描 QR |
| `MotionChallenge` | 搖手機計數 |
| `TimeBomb` | 拆彈 |
| `Shooting` | 個人射擊 |
| `GpsMission` | 個人 GPS 任務 |
| `PhotoMission` | 個人拍照任務 |
| `PhotoSpot` | 個人景點拍照 |
| `PhotoCompare` | 個人前後對比 |
| `PhotoBeforeAfter` | 個人前後拍照 |
| `PhotoBurst` | 個人連拍 |
| `PhotoAr` | 個人 AR 貼圖 |
| `PhotoOcr` | 個人文字辨識 |

### 3.3 多人專用元件（multi）— 規劃 8 個

只給 `playerMode='multi'` 的遊戲使用：

| 元件 | 玩法 | 協作模式 | 狀態 |
|------|------|---------|------|
| `PhotoTeam` | 團體合影 | 協作 | ✅ 已存在 |
| `VoteTeam` | 隊伍投票 | 協作 | 🟡 後端 ✅，前端待建 |
| `ShootingTeam` | 隊伍射擊累計 | 協作 | 🟡 部分 |
| `GpsTeamMission` | 隊伍 GPS 尋寶 | 協作 | 🟡 hook 已預留 |
| `LockCoop` | 協作解鎖（不對稱資訊） | 協作 | ❌ 新建 |
| `ChoiceVerifyRace` | 隊伍搶答 | 對戰 | ❌ 新建 |
| `RelayMission` | 接力任務（一人完成解鎖下一人） | 接力 | ❌ 新建 |
| `TerritoryCapture` | 地盤戰（多隊爭奪 GPS 點） | 對戰 | ❌ 新建 |

### 3.4 目錄結構

```
client/src/components/game/
├── shared/                    # 通用元件 + 共用 hooks/UI
│   ├── components/
│   │   ├── TextCard.tsx
│   │   ├── Dialogue.tsx
│   │   ├── Video.tsx
│   │   └── FlowRouter.tsx
│   ├── hooks/
│   │   ├── useGameTimer.ts        # 計時邏輯
│   │   ├── useGameProgress.ts     # 進度回報
│   │   ├── useScoreSubmit.ts      # 分數提交
│   │   ├── useTeamSync.ts         # 多人專用：team WebSocket 包裝
│   │   └── useTeamMembersState.ts # 多人專用：隊友狀態廣播
│   └── ui/
│       ├── CountdownDisplay.tsx
│       ├── ScoreCard.tsx
│       ├── ProgressBar.tsx
│       ├── TeammatePanel.tsx      # 多人專用：隊友列表
│       └── WaitingForTeam.tsx     # 多人專用：等待隊友 UI
│
├── solo/                      # 個人專用元件
│   ├── verifications/
│   │   ├── TextVerify.tsx
│   │   ├── ChoiceVerify.tsx
│   │   └── ConditionalVerify.tsx
│   ├── interactions/
│   │   ├── Vote.tsx
│   │   ├── Lock.tsx
│   │   ├── QrScan.tsx
│   │   ├── MotionChallenge.tsx
│   │   ├── TimeBomb.tsx
│   │   └── Shooting.tsx
│   ├── gps/
│   │   └── GpsMission.tsx
│   └── photo/
│       ├── PhotoMission.tsx
│       ├── PhotoSpot.tsx
│       ├── PhotoCompare.tsx
│       ├── PhotoBeforeAfter.tsx
│       ├── PhotoBurst.tsx
│       ├── PhotoAr.tsx
│       └── PhotoOcr.tsx
│
└── multi/                     # 多人專用元件
    ├── PhotoTeam.tsx
    ├── VoteTeam.tsx
    ├── ShootingTeam.tsx
    ├── GpsTeamMission.tsx
    ├── LockCoop.tsx
    ├── ChoiceVerifyRace.tsx
    ├── RelayMission.tsx
    └── TerritoryCapture.tsx
```

**依賴關係**：
- `solo/*` 不可依賴 `multi/*`
- `multi/*` 不可依賴 `solo/*`
- `shared/*` 不可依賴 `solo/*` 或 `multi/*`
- `solo/*` 和 `multi/*` 都可依賴 `shared/*`

---

## 4. 既有功能盤點（避免重複工作）

### 4.1 Squads 系統（**不在本規劃範圍**）

**已上線**（Phase 12.1-12.6，2026-04-25 部署）：
- 推廣連結追蹤 + 6 API
- 6 個排行榜（場次榜/名人堂/新人榜/上升星/常客榜/段位榜）
- 歡迎隊伍 Dialog（30 天記憶）
- 自動成就 cron（16 個成就）
- 隊名改名冷卻（30 天）+ 解散鎖名（180 天）
- Admin 行銷設定（5 tab）

**待 Phase 14-15 實作**（依 [SQUAD_SYSTEM_DESIGN.md](SQUAD_SYSTEM_DESIGN.md)）：
- `squads` 主表 + `squad_members` 遷移
- 隊伍生命週期自動轉換（active → veteran → legend）
- 超級隊長段位自動寫入
- Mode B 玩家自評水彈對戰
- 招募獎勵實寫
- 每日上限防 farm

→ **本規劃不碰**，Phase 14-15 走自己的路線。

### 4.2 對講機 Walkie（**不在本規劃範圍**）

**已 100% 上線**：
- LiveKit PTT 對講機
- 跟隊友模式（teamId 自動連線）
- 6 碼邀請碼跨遊戲對講群
- WalkieFloatingButton 已掛在 [App.tsx:438](../client/src/App.tsx#L438)
- 作弊監控頁、QR 掃描、單一功能動線

→ **本規劃不碰**，但**多人遊戲流程中要利用**（見 §7）。

### 4.3 WebSocket 即時同步（**部分依賴**）

**已 100% 上線**（[server/routes/websocket.ts](../server/routes/websocket.ts)）：
- 4 房間隔離（session/team/match/battleSlot）
- 12+ 種事件類型（team_chat / team_location / team_vote_cast / team_score_update / team_ready / team_member_joined/left / match_ranking / relay_handoff / shooting_hit）
- useTeamWebSocket（17 測試）+ useMatchWebSocket（21 測試）

**本規劃會擴充**（屬基礎建設層）：
- 新增事件：`page_state_request` / `page_state_snapshot` / `team_progress_update` / `team_question_answered`
- Reconnect 後狀態恢復機制

### 4.4 BattleClan / Match / Relay（**不在本規劃範圍**）

**已 100% 上線**：
- 水彈戰隊完整 UI 指南（[BATTLE_USER_GUIDE.md](BATTLE_USER_GUIDE.md)）
- 對戰配對 + ELO 計分
- 接力對戰（[matches.ts:relayConfig](../server/routes/matches.ts)）
- 即時排名 + 倒數同步

→ **本規劃不碰**，但 RelayMission 元件**會借用**接力概念。

---

## 5. 資料模型變更（**v1.1 修訂：零 schema 變更**）

### 5.1 不新增欄位 — 從 `gameMode` 推導 `playerMode`

**設計決策**：盤點現有 [shared/schema/games.ts:22](../shared/schema/games.ts) 發現 `gameMode` enum（`individual / team / competitive / relay`）已能完全推導 `playerMode`，依 DRY 原則改用 helper 推導，**不變更 schema**。

**Helper 函式**（[shared/multiplayer-component-types.ts](../shared/multiplayer-component-types.ts)）：

```typescript
export function derivePlayerModeFromGameMode(gameMode: string): PlayerMode {
  return gameMode === "individual" ? "solo" : "multi";
}
```

**好處**：
- 零 schema 變更 = 零部署風險、無 migration
- 既有資料無需遷移
- 不會出現「兩個欄位不同步」的資料一致性問題
- 簡化 admin UI（一個 gameMode 欄位即可）

### 5.2 Server 層約束（用 helper 驗證）

**儲存 page 時驗證**（[server/routes/pages.ts](../server/routes/pages.ts) 改動）：

```typescript
import { isComponentAllowedForGameMode } from "@shared/multiplayer-component-types";

// pseudo
if (!isComponentAllowedForGameMode(page.pageType, game.gameMode)) {
  throw 400; // "本遊戲模式不允許此元件類型"
}
```

**元件分類常數**（[shared/multiplayer-component-types.ts](../shared/multiplayer-component-types.ts)）：

```typescript
export const SHARED_COMPONENTS = ['text_card', 'dialogue', 'video', 'flow_router'] as const;
export const SOLO_ONLY_COMPONENTS = ['lock', 'vote', 'shooting_mission', /*...*/] as const;
export const MULTI_ONLY_COMPONENTS = ['photo_team', 'vote_team', 'shooting_team', /*...*/] as const;
```

提供 8 個純函式 helpers：
- `isSharedComponent(pageType)` / `isSoloOnlyComponent` / `isMultiOnlyComponent`
- `derivePlayerModeFromGameMode(gameMode)` — 推導
- `isComponentAllowedForPlayerMode(pageType, playerMode)` — 用 playerMode 驗證
- `isComponentAllowedForGameMode(pageType, gameMode)` — **server 端建議用這個**（一步到位）
- `getAllowedComponentsForPlayerMode(playerMode)` — admin UI 過濾用
- `getComponentCategory(pageType)` — UI 顯示用

### 5.3 不變更的部分

- `games.gameMode` 維持現有 4 種 enum（individual / team / competitive / relay）
- `teams` 表結構不變（已有 minPlayers / maxPlayers / accessCode）
- `team_sessions` / `team_scores` / `team_votes` 不變
- `squads` 系統獨立演進，不耦合
- **本規劃 v1.1 起不再要求 schema 變更**

---

## 6. 多人元件詳細設計（**核心章節**）

### 6.1 PhotoTeam（已存在，狀態紀錄）

**檔案**：[client/src/components/game/PhotoTeamFlow.tsx](../client/src/components/game/PhotoTeamFlow.tsx)
**設計參考**：[PHOTO_AI_COMPONENTS_PLAN.md:359-389](PHOTO_AI_COMPONENTS_PLAN.md)
**玩法**：隊長選實際人數 → 逐一拍每位隊員自拍 → 自動九宮格合成 + 名字 overlay
**協作模式**：協作（隊長主控單裝置，無 WebSocket 同步）
**狀態**：✅ 已實作

**搬遷動作**：搬到 `multi/PhotoTeam.tsx`（純改路徑）

---

### 6.2 VoteTeam（後端已備齊，前端待建）

**設計依據**：[VOTE_SYNC_PLAN.md](VOTE_SYNC_PLAN.md)
**檔案**（新建）：`client/src/components/game/multi/VoteTeam.tsx`
**估時**：8-12h

**玩法**：
- 隊伍每位成員投一票
- 三種模式（admin 設定）：
  - `majority`（過半即通過）
  - `unanimous`（全員同意）
  - `display`（純展示計票，不影響進度）
- 即時看到「3/5 已投票」「同意 / 反對 比數」
- 達標後自動前進，未達標 → 顯示等待 UI 或逾時策略

**後端依賴**（**已實作**）：
- `POST /api/teams/:teamId/votes` ✅
- `GET /api/teams/:teamId/votes` ✅
- `POST /api/votes/:voteId/cast` ✅
- WebSocket 事件：`vote_created` / `vote_cast` ✅

**前端要做**：
1. 偵測 `playerMode === 'multi'` + 元件為 VoteTeam → 呼叫 API
2. 第一位玩家進來自動建立投票（idempotent）
3. 其他玩家加入即時看票數
4. 訂閱 `team_vote_cast` 事件 → 更新 UI
5. 達標 → 觸發 `onComplete`

**用到的共用 hook**：
- `useTeamSync`（WebSocket 訂閱）
- `useGameTimer`（投票時限）

**UI 元素**：
- 題目卡（admin 設定的題目）
- 選項按鈕
- 投票進度（隊友頭像 + ✓/⏳ 狀態）
- 結果動畫（達標時揭曉）

**邊界情況**：
- 隊員中途斷線 → 不算票，但若達標可繼續
- 全員未達標逾時 → 依 admin 設定的 `teamTimeoutAction`
- 同一玩家不能重複投

---

### 6.3 ShootingTeam（補完 + 防作弊）

**檔案**（新建）：`client/src/components/game/multi/ShootingTeam.tsx`
**估時**：3-4 天

**玩法**：
- 隊伍輪流射擊靶機（或同時，依場域硬體）
- 每次命中累計到「隊伍總分」
- 達標分數 → 通關
- 排行榜可看到隊內貢獻度（個人分數）

**現有基礎**（**已實作**）：
- MQTT 從 Arduino 靶機接命中訊號
- WebSocket `shooting_hit` 事件廣播
- 個人版 Shooting 元件
- 自動重連 + 命中標記顯示

**要新增**：
1. **隊伍累計邏輯**：
   - hit record 加 `team_id` 欄位
   - 隊伍總分 = SUM(隊內所有 player 命中分)
   - 即時廣播給所有隊員
2. **防作弊**（[GAME_COMPONENTS_STATUS_V2.md:222-229](GAME_COMPONENTS_STATUS_V2.md) P0 缺陷）：
   - 前端 `simulateHit` 必須帶 HMAC 簽章（用 sessionId + timestamp + secret）
   - server 驗證簽章才接受
   - 限制每秒最多 1 次 hit（防快速灌分）
3. **個人貢獻顯示**：
   - 隊內排行（即時）
   - 我的命中數 / 隊伍總命中數

**用到的共用 hook**：
- `useTeamSync`
- `useScoreSubmit`

**邊界情況**：
- 玩家斷線 → 已累計分數保留
- 靶機故障 → admin 可手動加減分（已有 admin API）

---

### 6.4 GpsTeamMission（hook 已預留，接到生產）

**檔案**（新建）：`client/src/components/game/multi/GpsTeamMission.tsx`
**估時**：3-4 天

**玩法**（隊伍尋寶）：
- 隊伍要一起到達多個 GPS 任務點
- 兩種觸發模式（admin 設定）：
  - `any`（任一隊員到達即觸發）
  - `all`（全員到達才觸發）
- 地圖顯示所有隊友位置（即時）
- 完成的點 ✓ 標記

**現有基礎**：
- 個人 GpsMission 元件
- `useTeamGpsFusion` hook（已預留，無生產用例）
- WebSocket `team_location` 事件 ✅
- 地圖顯示隊友位置（已有 [TeammateMarkers.tsx](../client/src/components/gameplay/TeammateMarkers.tsx)）

**要新增**：
1. 接 `useTeamGpsFusion` 到實際元件
2. 後端打卡邏輯改為「依 admin 設定 any/all」
3. 玩家進度 UI：「3/5 個點已到達 / 5/7 個隊友到達當前點」
4. 預設 GPS fusion 策略：精度高的隊員位置權重大

**用到的共用 hook**：
- `useTeamGpsFusion`（已存在）
- `useTeamSync`

**邊界情況**：
- 隊員 GPS 不準 → fusion 自動過濾
- 全員都到不了 → 逾時 fallback（admin 設定）

---

### 6.5 LockCoop（**新類型**，協作解鎖）

**檔案**（新建）：`client/src/components/game/multi/LockCoop.tsx`
**估時**：1 週
**靈感**：類似密室逃脫的「分頭收集線索」玩法

**玩法**：
- 一把鎖需要輸入 N 位密碼（admin 設定）
- 每位隊員拿到「不同的線索」（admin 預先設定多組線索組）
- 玩家必須**口頭/Walkie 溝通**才能拼出完整密碼
- 任一隊員輸入正確密碼即解鎖

**範例**：
- 鎖：6 位密碼
- 玩家 A 看到：「奇數位是 1, 3, 5」
- 玩家 B 看到：「偶數位是 2, 4, 6」
- 玩家 C 看到：「正確答案是奇偶交錯」
- 三人對話 → 答案 123456

**後端要做**：
- `pages.config.lockCoopClues`：JSON 陣列，每個玩家分到一組
- 客戶端用 hash(sessionId + playerId) 決定拿哪組（避免每次重整變）

**前端要做**：
1. 進入元件 → 顯示「你看到的線索」（只給該玩家）
2. 共享輸入區（任一隊員輸入即同步給所有人）
3. 嘗試解鎖按鈕（任一人按）
4. 成功 → 全員過關

**用到的共用 hook**：
- `useTeamSync`（同步輸入區）

**自動建議 Walkie**：
- 進入 LockCoop → 跳出 toast「建議開啟對講機協作 [連線]」
- 點按鈕直接呼叫 [WalkieFloatingButton](../client/src/components/walkie/WalkieFloatingButton.tsx) 的「跟隊友」模式

**邊界情況**：
- 線索組數 < 隊員數 → 重複分配（同樣線索給多人）
- 隊員斷線 → 線索保留，重連顯示
- 達不到完整線索 → admin 可設定「逾時顯示提示」

---

### 6.6 ChoiceVerifyRace（**新類型**，隊伍搶答）

**檔案**（新建）：`client/src/components/game/multi/ChoiceVerifyRace.tsx`
**估時**：3-4 天

**玩法**：
- 一系列選擇題
- 隊伍計時搶答（誰先答對誰得分）
- 同隊內互助：答對的玩家可以「提示」其他玩家（admin 可開關）
- 隊伍總分 = SUM(隊員個人分)

**前端要做**：
1. 計時搶答 UI（server 權威時間，client 純顯示）
2. 答對動畫 + 隊內排行
3. 提示功能（可選）：玩家答對後可發送提示文字給隊友
4. 跨題目連貫的 streak（連對 X 題加分）

**用到的共用 hook**：
- `useTeamSync`
- `useGameTimer`（server-side authoritative）

**新建後端事件**：
- `team_question_answered`：誰答了第幾題、答對與否、用了多少時間
- `team_hint_sent`：誰給誰提示（admin 開關才開）

**邊界情況**：
- 兩人同時答 → 用 server 收到的時間戳判斷（避免 client clock skew）
- 隊員全錯 → 顯示正確答案再前進

---

### 6.7 RelayMission（**新類型**，接力任務）

**檔案**（新建）：`client/src/components/game/multi/RelayMission.tsx`
**估時**：1 週
**靈感**：[matches.ts:relayConfig](../server/routes/matches.ts) 的接力對戰，但用在單一隊伍內部

**玩法**：
- 一個任務分為 N 段（admin 設定）
- 玩家 A 完成第 1 段 → 玩家 B 解鎖第 2 段 → 玩家 C 解鎖第 3 段
- 每段可以是不同子玩法（拍照、解謎、跑點）
- 全部完成 → 通關

**範例**：
- 第 1 段：玩家 A 找到 GPS 點 X，掃 QR
- 第 2 段：玩家 B 解開玩家 A 找到的密碼
- 第 3 段：玩家 C 拍照證明任務完成

**後端要做**：
- `pages.config.relaySegments`：JSON 陣列定義每段
- 後端追蹤目前進度到第幾段、由誰完成
- 廣播 `relay_segment_complete` 事件

**前端要做**：
1. 進度條顯示「3 段中第 2 段進行中（玩家 B 操作中）」
2. 非當前段的玩家看到「等待玩家 B 完成第 2 段」
3. 當前段的玩家看到該段子玩法 UI
4. 全段完成 → 慶祝動畫

**用到的共用 hook**：
- `useTeamSync`
- `useTeamMembersState`（顯示誰在哪段）

**邊界情況**：
- 當前玩家斷線 → 隊員可投票決定「換人接手」
- 段內順序：admin 可設「指定順序」或「任意順序」

---

### 6.8 TerritoryCapture（**新類型**，地盤戰）

**檔案**（新建）：`client/src/components/game/multi/TerritoryCapture.tsx`
**估時**：1 週
**靈感**：類似 Pokemon Go 的地盤站、Splatoon 的地盤戰

**玩法**：
- 場域內有多個 GPS 任務點
- 多隊**同時**爭奪這些點（多隊共用一場 session）
- 玩家到達任務點 → 「佔領」該點（標記為自己隊伍顏色）
- 對手隊員到達已佔領的點 → 可以「奪回」（會有冷卻期）
- 時限到時，佔領最多點的隊伍獲勝

**前端要做**：
1. 地圖顯示所有任務點 + 顏色標記（哪隊佔領）
2. 即時更新（敵隊佔領 → 動畫變色）
3. 倒數計時（server 權威）
4. 排行榜（每隊佔領數）

**後端要做**：
- 新增 `territory_captures` 表：locationId + currentTeamId + capturedAt
- 廣播 `territory_captured` / `territory_lost` 事件
- 計分：佔領 5 分、奪回 10 分

**用到的共用 hook**：
- `useTeamSync`
- `useTeamGpsFusion`

**注意事項**：
- 需要場域有多個 GPS 任務點（admin 預先設定）
- 不能單獨組一隊玩（至少 2 隊）
- 適合戶外場域（公園、校園）

---

## 7. 共用基礎建設

### 7.1 shared/hooks 規劃

| Hook | 用途 | 優先級 |
|------|------|--------|
| `useGameTimer` | 計時邏輯（個人/多人都用） | P0 |
| `useGameProgress` | 進度回報 | P0 |
| `useScoreSubmit` | 分數提交（已部分存在於 [hooks/use-score.ts](../client/src/hooks/use-score.ts)） | P0 |
| `useTeamSync` | 包裝現有 useTeamWebSocket 提供更高階 API | P0 |
| `useTeamMembersState` | 隊友當前狀態廣播 | P0 |
| `useTeamGpsFusion` | 隊伍 GPS 融合（已預留，待接） | P1 |
| `usePageReconnect` | reconnect 後拿狀態 snapshot | P1 |
| `useServerTimer` | server 權威倒數 | P2 |

### 7.2 shared/ui 規劃

| 元件 | 用途 |
|------|------|
| `CountdownDisplay` | 倒數顯示（套用既有 tabular-nums 樣式） |
| `ScoreCard` | 分數卡 |
| `ProgressBar` | 進度條 |
| `TeammatePanel` | 隊友列表（多人專用） |
| `WaitingForTeam` | 等待隊友 UI（多人專用） |
| `WalkieSuggestionToast` | 多人元件入場時建議開對講機 |

### 7.3 WebSocket 事件擴充

新增以下事件到 [server/routes/websocket.ts](../server/routes/websocket.ts)：

| 事件 | 方向 | 用途 |
|------|------|------|
| `page_state_request` | C→S | reconnect 後請求當前 page 完整狀態 |
| `page_state_snapshot` | S→C | 推送完整狀態（progress / answers / teammates） |
| `team_progress_update` | bidirectional | 同步「我答到第幾題、進度 X%」 |
| `team_question_answered` | bidirectional | 隊員答題即時推送 |
| `team_wait_check` | S→C | 「等待 N/M 隊員完成」 |
| `team_force_advance` | S→C | 隊長/逾時強制前進 |
| `relay_segment_complete` | bidirectional | 接力段完成（用於 RelayMission） |
| `territory_captured` | bidirectional | 地盤被佔領（用於 TerritoryCapture） |
| `territory_lost` | bidirectional | 地盤被奪走（用於 TerritoryCapture） |

### 7.4 Reconnect 狀態恢復

新建 [server/lib/team-state-snapshot.ts](../server/lib/team-state-snapshot.ts)：

**邏輯**：
1. 玩家重連 WebSocket → 立即送 `page_state_request`
2. 後端從 `team_sessions.teamVariables` 拼出完整快照
3. 回傳 `page_state_snapshot`：當前 page 編號、答案、隊友狀態、剩餘時間
4. 前端套用快照 → 無縫接續

---

## 8. Admin UI 設計

### 8.1 兩段式選擇器（建立遊戲流程）

**位置**：[client/src/components/admin-games/GameFormDialog.tsx](../client/src/components/admin-games/GameFormDialog.tsx)

**新流程**：

```
[新增遊戲]
   ↓
[第一步：選擇遊戲類型]
   ┌─────────────────┬─────────────────┐
   │ 🧍 個人遊戲      │ 👥 多人遊戲      │
   │ (玩家獨立完成)    │ (需組隊參與)     │
   └─────────────────┴─────────────────┘
        ↓                     ↓
   playerMode='solo'    playerMode='multi'
        ↓                     ↓
   ┌─ 元件選單只顯示 ─┐   ┌─ 元件選單只顯示 ─┐
   │ • TextCard       │   │ • TextCard       │
   │ • Dialogue       │   │ • Dialogue       │
   │ • Video          │   │ • Video          │
   │ • FlowRouter     │   │ • FlowRouter     │
   │ ─── 個人專用 ─── │   │ ─── 多人專用 ─── │
   │ • Lock           │   │ • PhotoTeam      │
   │ • Vote           │   │ • VoteTeam       │
   │ • Shooting       │   │ • ShootingTeam   │
   │ • ... 13 項      │   │ • ... 8 項        │
   └──────────────────┘   └──────────────────┘
```

**好處**：
- Admin 不會誤把多人元件放單人遊戲
- 元件清單變短（admin 看到的選項減半）
- playerMode 自動設定，不用手動勾

### 8.2 多人遊戲進階設定（折疊區塊）

當 `playerMode='multi'` 時顯示：

```
[進階多人設定] ▼
├─ 最少組隊人數: [2]    最多組隊人數: [6]
├─ 計分模式:    ○ 共享分  ○ 個人分  ○ 混合
├─ 等待逾時:    [____] 分鐘  （留空 = 永不逾時）
├─ 逾時行為:    ○ 強制前進  ○ 失敗  ○ 退回個人模式
├─ ☐ 啟用對講機自動建議（進入多人元件時跳 toast）
├─ ☐ 啟用隊伍聊天
├─ ☐ 隊長加成 [_0_] %  （0~50）
└─ ☐ 隊長必要動作:  ☐ 開始遊戲  ☐ 前進頁面  ☐ 提交分數
```

**對應 schema 欄位**（[shared/schema/games.ts](../shared/schema/games.ts) 新增）：
```sql
games.minTeamPlayers      int     default 2
games.maxTeamPlayers      int     default 6
games.teamScoreMode       enum    ('shared' | 'individual' | 'hybrid')
games.teamTimeoutMinutes  int     default null
games.teamTimeoutAction   enum    ('force_advance' | 'fail_team' | 'fallback_solo')
games.suggestWalkie       boolean default true
games.teamChatEnabled     boolean default false
games.leaderBonusPct      int     default 0  -- 0~50
games.leaderRequiredFor   text[]  default '{}'  -- ['start', 'advance', 'submit_score']
```

---

## 9. 與既有設計文件的關係

| 文件 | 關係 | 本規劃要做的事 |
|------|------|---------------|
| [SQUAD_SYSTEM_DESIGN.md](SQUAD_SYSTEM_DESIGN.md) | 公會系統獨立發展 | 不重疊，但 multi 元件結束會回寫 squad 戰績 |
| [WALKIE_TALKIE_PLAN.md](WALKIE_TALKIE_PLAN.md) | 對講機已上線 | 多人元件入場時自動建議 walkie |
| [VOTE_SYNC_PLAN.md](VOTE_SYNC_PLAN.md) | 投票同步規劃 | VoteTeam 元件即實作此規劃前端 |
| [PHOTO_AI_COMPONENTS_PLAN.md](PHOTO_AI_COMPONENTS_PLAN.md) | Photo 元件規劃 | PhotoTeam 已實作，本規劃不擴增 Photo 多人版 |
| [GAME_COMPONENT_UPGRADE_PLAN.md](GAME_COMPONENT_UPGRADE_PLAN.md) | 元件升級 | 本規劃補充多人化部分 |
| [GAME_COMPONENTS_STATUS_V2.md](GAME_COMPONENTS_STATUS_V2.md) | 元件現狀 | 完工後更新此文件 |
| [MULTI_FIELD_FULL_AUDIT.md](MULTI_FIELD_FULL_AUDIT.md) | 多場域 | 多人元件天然遵守場域隔離（透過 game.fieldId） |

---

## 10. 邊界與不在範圍內

### 10.1 明確不做的事

- ❌ 不重做 Squads 系統（依 [SQUAD_SYSTEM_DESIGN.md](SQUAD_SYSTEM_DESIGN.md) Phase 14-15）
- ❌ 不擴充 Walkie 功能（已上線，僅做整合建議）
- ❌ 不新增 BattleClan / Match / Relay 對戰邏輯（已上線）
- ❌ 不做場域路由 `/f/:fieldCode`（依 [MULTI_FIELD_ISOLATION_PLAN.md](MULTI_FIELD_ISOLATION_PLAN.md)）
- ❌ 不做金流 / E2E / Lint 升級（屬 Phase 27）
- ❌ 不主動改造 13 個個人元件（除非有遊戲需求才動）
- ❌ 不做 Photo 系列 8 個元件的多人版（PhotoTeam 已是範本，其他依需求才做）

### 10.2 條件性做的事

- ⚠️ Voice Chat 進階功能（多人對講群、語音轉文字）→ 等 Walkie 有業務需求再說
- ⚠️ 新增 B 級元件多人版（TextVerify / QrScan / TimeBomb）→ 等使用者回饋有需求

### 10.3 跨規劃同步

- 與 SQUAD_SYSTEM_DESIGN Phase 14-15 同步：本規劃完成後，多人元件結束時要呼叫 [server/services/squad-records.ts](../server/services/squad-records.ts) 寫戰績
- 與 MULTI_FIELD_ISOLATION_PLAN 同步：多人遊戲必須透過 game.fieldId 自動隔離

---

## 11. 施工順序（**4 個 Phase**）

### Phase 1：地基建立（1 週）

**目標**：底層分類框架就位，不影響線上功能

**Task**：
- [x] **Phase 1.1**：[shared/multiplayer-component-types.ts](../shared/multiplayer-component-types.ts) 元件分類常數 + 8 個 helpers ✅ commit `5db5565e`
- [x] **Phase 1.2**：建立目錄結構 `solo/` / `multi/` / `shared/`（含 .gitkeep）✅ commit `68288f1c`
- [x] **Phase 1.3**：~~schema 新增 `games.playerMode`~~ → **改為從 `gameMode` 推導**（v1.1 修訂，無 schema 變更）✅ commit `77e3602e`
- [x] **Phase 1.4**：後端 page 儲存約束（用 `isComponentAllowedForGameMode` 驗證）+ 不對稱規則修訂（v1.2）✅ commit `ca19ad98`
- [x] **Phase 1.5**：useGameTimer hook + 10 個測試（範圍縮減：useTeamSync 等暫緩到 Phase 2 實際需求出現時）✅ commit `c43208a4`
- [x] **Phase 1.6 part 1**：4 通用元件 → shared/components/ + 1 多人元件 → multi/ ✅ commit `9f4e3661`
- [x] **Phase 1.6 part 2**：18 個個人元件 → solo/（含內部 import 修正）✅ 本 commit
- [x] 三層驗證：tsc 零錯誤 + GamePageRenderer 17/17 測試 + production build 成功

**驗收**：
- ✅ 目錄結構就位
- ✅ 全部既有遊戲正常運作（無 UI 變化）
- ✅ TypeScript 零錯誤
- ✅ 全部測試通過
- ✅ helper `isComponentAllowedForGameMode` 可正確驗證所有 23 個 pageType

---

### Phase 2：核心 3 個多人元件（**已完成 — 2026-05-02**）

**目標**：讓玩家立刻能玩到多人玩法

**Task**：

- [x] **2.1** GameFormDialog 加 gameMode 欄位（個人/隊伍/競技/接力）✅ commit `3ace636d`
- [x] **2.2** TeammatePanel 共用元件（compact / full 兩版型）+ 12 測試 ✅ commit `420ba76f`
- [x] **2.3** VoteTeam 全鏈路（majority/unanimous/display）✅ 3 commits（`3690933a` + `a3beb1ed` + `b22a6ebb`）
  - VoteTeam 元件 + 23 測試
  - useTeamVoteSync hook（API + WebSocket 訊息處理）+ 16 測試
  - VoteTeamPage 容器 + GamePageRenderer 註冊
- [x] **2.4** ShootingTeam 全鏈路（隊伍累計分 + 排行榜）✅ 2 commits（`7ae5293f` + `3d358354`）
  - ShootingTeam 元件 + 25 測試
  - useTeamShootingSync hook（WebSocket 訂閱）+ 12 測試
  - ShootingTeamPage 容器 + GamePageRenderer 註冊
- [x] **2.5** GpsTeamMission 全鏈路（any / all 觸發模式）✅ 2 commits（`d1037f6b` + `6a057e28`）
  - GpsTeamMission 元件 + 27 測試
  - GpsTeamMissionPage 容器（接 useStableGeolocation + useTeamWebSocket）+ 註冊

**驗收**：
- ✅ 3 個多人元件 GamePageRenderer 已註冊（vote_team / shooting_team / gps_team_mission）
- ✅ Admin 可在 GameFormDialog 選遊戲類型
- ✅ 三層驗證：tsc 零錯誤 + 全 client 測試 ≥ 870/870 通過 + GamePageRenderer 20/20

**Phase 2 待後續處理（歸入 Phase 2.6 或挪後）**：
- ⏳ **WalkieSuggestionToast** 共用元件（多人元件入場時提示開對講機）
- ⏳ **Admin page editor** 加 multi pageType 選項（admin 才能建立多人 page，**目前阻塞項**）
- ⏳ **VoteTeamPage 的 handleWsMessage** 接到 useTeamWebSocket（隊友投票即時看到）
- ⏳ **shooting_hit** 訊息 server side 附 userId（無法區分誰打的）
- ⏳ **HMAC 防作弊**（前端 simulateHit 帶簽章 + server 驗證）
- ⏳ **TeammatePanel 整合進三個元件**（目前各自有自己的隊友顯示）

---

### Phase 2.5：多人遊戲穩定性軸（**已完成 — 2026-05-02**）

**背景**：實機驗證 Phase 1 / Phase 2 期間，盤點出多人遊戲執行時有大量穩定性 bug — 重連體驗破裂、找不到「離開遊戲」按鈕、隊友狀態看不見、進度不同步。這些原本預設「會自動就位」的穩定性層其實沒人做，所以 Phase 2.6 之前先把這層補上。

**這條軸與 Phase 1-4 並列，不取代任何 Phase**：
- Phase 1-4 是「**元件層多人化**」（PhotoTeam / VoteTeam / LockCoop / TerritoryCapture）
- Phase 2.5 是「**多人遊戲穩定性**」（重連 / 寬限期 / 進度同步 / 通知）
- 兩條軸都是必要的，缺一不可

**完成項目（7 commits）**：

| Commit | 範圍 | 摘要 |
|--------|------|------|
| `f28edd45` | field routing fix | 點賈村卻顯示後浦遊戲 — useCurrentField 用 localStorage / Provider 用 URL，cache key 不對齊。修法：用 React Context 共享 themePayload |
| `37bd7a6b` | Phase 2.5.1 重連 flash + 自願退出 | 重連 3 秒倒數改 1 秒「歡迎回來」flash；遊戲中「離開」確認時呼叫 `/api/teams/:teamId/leave` 設 leftAt → 永不被自動拉回 |
| `005c6429` | Phase 2.5.2 存在感通知 | 訊息語意拆三類：`team_member_disconnected`（暫時離線）/ `team_member_reconnected`（回來）/ `team_member_left`（明確自願退出）；server 加 teamMemberHistory 追蹤 |
| `9941ae67` | Phase 2.5.3 ghost lobby fix | `team.status='playing'` 但找不到 active session → 視為已結束，回 null（避免玩家被困在 ghost lobby） |
| `eb69d0f1` | Phase 2.5.4 進度同步（最快進度） | `team_sessions.maxPageIndex` 欄位 + `POST /api/teams/:teamId/advance-progress` API + `team_progress_advance` WS 廣播 + GamePlay 訂閱跟上隊伍最快進度 |
| `1e7b6101` | Phase 2.5.5 寬限期計時 | server 純 in-memory 計時器：30 秒 grace timer + 120 秒 auto-leave timer；超時自動標 leftAt + 廣播 left（reason: auto_leave_after_grace） |
| `fec26059` | Phase 2.5.6 TTS 語音通知 | 瀏覽器 SpeechSynthesis API 中文語音；volume 0.4 不打斷遊戲音樂；同 user 同事件 60 秒 throttle |

**完整斷線重連流程**：

```
玩家 A 斷線
  ├─[0s]─    broadcast disconnected
  │          🔔 toast「⚠️ A 暫時離線」 + 🔊 語音
  │
  ├─[0~30s]─ 重連 ✅ → cancelTimer + reconnected
  │           🔔 toast「✅ A 回來了」 + 🔊
  │           進遊戲時自動跳到隊伍 maxPageIndex
  │
  ├─[30s]─   grace_expired
  │          🔔 toast「⏳ 寬限期已過 120s」 + 🔊 destructive
  │
  ├─[30~150s]─ 仍可重連
  │
  └─[150s]─  auto-leave timer fire
             DB 設 leftAt + broadcast team_member_left
             下次開遊戲 → my-team 回 null → 不被自動拉回
```

**設計決策**：

| 決策 | 選擇 | 理由 |
|------|------|------|
| 進度同步策略 | **B 跟最快進度（簡化版）** | 進度只往前不倒退，慢的玩家不被拋下；個人分數各自累計，不嘗試補分；接受斷線玩家少賺 |
| 暫停策略 | **全自動 hybrid（無隊長 dialog）** | 30s grace + 120s auto-leave；隊長 dialog 留給後續加強版 |
| 寬限期實作 | **純 in-memory（不動 schema）** | server 重啟會 reset，可接受；schema 變更等真有需要再加 |
| TTS 語音 | **瀏覽器內建 SpeechSynthesis** | 免費、零依賴、零成本；中文 zh-TW 優先，volume 0.4，60s throttle |

**驗收**：
- ✅ TypeScript 零錯誤
- ✅ 50 個 team/websocket 測試 + 9 個 voice-notification 測試全過
- ✅ DB schema 變更（`team_sessions.max_page_index`）— 部署前必須跑 `npm run db:push`

**剩餘加強項（**非阻塞**）**：
- ⏳ Phase 2.5+ 隊長 dialog（leader-decide UI）— 寬限期過時讓隊長選「等待 / 先繼續」（C2 if-needed）
- ⏳ 後台寬限期可調整 UI — field settings 加 `disconnectGracePeriod` / `pauseStrategy` 欄位（A3 if-needed）
- ⏳ 語音開關 UI — 設定頁讓玩家可關閉（目前已有 localStorage flag，缺 toggle UI）

---

### Phase 3：新類型多人元件（2 週）

**目標**：增加多人專屬玩法的多樣性

**第 1 週**：
- [ ] `LockCoop.tsx`（協作解鎖）
  - 線索分配邏輯
  - 共享輸入區
  - 自動建議 Walkie
- [ ] `ChoiceVerifyRace.tsx`（隊伍搶答）
  - server 權威時間
  - 提示功能（可選）

**第 2 週**：
- [ ] `RelayMission.tsx`（接力任務）
  - relaySegments 後端設定
  - 段間切換 UI
  - 換人接手投票
- [ ] WebSocket 新事件：`page_state_request` / `page_state_snapshot` / Reconnect 狀態恢復

**驗收**：
- ✅ 3 個新類型多人元件可玩
- ✅ Reconnect 後狀態正常恢復
- ✅ Demo：3 人玩 LockCoop（每人不同線索） + 自動連 walkie

---

### Phase 4：補完與選擇性（1-2 週，依需求）

**目標**：依實際使用回饋補完

**可能 Task**：
- [ ] `TerritoryCapture.tsx`（地盤戰）— 適合節慶活動
- [ ] B 級元件多人化（依需求）：TextVerifyTeam / QrScanRelay / TimeBombCoop
- [ ] Photo 系列多人化（依需求）
- [ ] `usePageReconnect` 進階場景
- [ ] Server 權威倒數（`useServerTimer`）

**驗收**：依個別 task 驗收

---

## 12. 驗收標準

### 12.1 程式碼層

- [ ] 目錄結構符合 §3.4
- [ ] `solo/*` 不依賴 `multi/*`，反之亦然
- [ ] 元件命名遵守 §2.3 規則
- [ ] TypeScript 零錯誤
- [ ] ESLint 無新增 warning
- [ ] 測試覆蓋率 > 80%（依 CLAUDE.md 強制要求）
- [ ] 每個多人元件至少 5 個單元測試 + 1 個 E2E 流程測試

### 12.2 行為層

- [ ] `playerMode='solo'` 的遊戲不能用 multi 元件（admin UI 灰掉 + server 拒絕）
- [ ] `playerMode='multi'` 的遊戲不能用 solo 元件
- [ ] 通用元件兩種模式都能用
- [ ] reconnect 後狀態完整恢復（不黑屏）

### 12.3 體驗層

- [ ] Admin 建立多人遊戲只需「點兩下」（選類型 → 選元件）
- [ ] 玩家進入多人元件 → 自動建議 Walkie（admin 開關）
- [ ] 多人元件玩到一半斷線重連 → 看到目前進度
- [ ] 隊友斷線 → 看到「玩家 X 已斷線」狀態
- [ ] 全部介面繁體中文，無英文技術詞露出（Squad / Team / Multi / Solo 等）

### 12.4 文件層

- [ ] 每個新元件有 JSDoc 註解
- [ ] 本文件持續更新（標 ✅ 已完成的 task）
- [ ] [GAME_COMPONENTS_STATUS_V2.md](GAME_COMPONENTS_STATUS_V2.md) 更新元件狀態
- [ ] PROGRESS.md 每個 Phase 完成後寫紀錄

---

## 13. 風險評估

| 風險 | 等級 | 緩解策略 |
|------|------|---------|
| 既有遊戲在 Phase 1 搬遷時被改壞 | 🔴 高 | 純改路徑不改邏輯 + 完整測試 + 灰度上線 |
| WebSocket 高負載（多場次 × 多人） | 🟡 中 | Phase 2 結束做壓測，必要時導 Redis pub/sub |
| 多人作弊（一人開多帳號） | 🟡 中 | HMAC 簽章 + 裝置指紋 + 速率限制 |
| 全隊一人斷線卡死 | 🟡 中 | 逾時 fallback + 隊長強制前進 |
| 線索分配在玩家重整後改變（LockCoop） | 🟡 中 | 用 hash(sessionId+playerId) 確保穩定 |
| 元件分類爭議（Vote 是個人還是多人？） | 🟢 低 | 本規劃明確：Vote = 個人，VoteTeam = 多人，**禁混** |
| Phase 14 Squads 同步 race condition | 🟡 中 | Phase 4 補完時對齊 Phase 14 進度 |
| 跨場域多人（玩家 A 在 JIACHUN、B 在 HPSPACE） | 🟢 低 | 設計上不允許（一個 game session 綁一個 fieldId） |

---

## 14. 開發節奏與里程碑

### 預估時間軸

```
Week 1     Phase 1：地基建立                ✅ 玩家無感知
Week 2-3   Phase 2：核心 3 個多人元件        🟢 玩家感受到「多人」
Week 4-5   Phase 3：新類型多人元件           🟢 玩家有更多選擇
Week 6+    Phase 4：補完與選擇性             🟡 依需求
```

### 關鍵里程碑

| 里程碑 | 時間 | 驗收 |
|--------|------|------|
| M1 — 地基就位 | Week 1 結束 | tsc 零錯誤 + 既有功能無回歸 |
| M2 — 第一個多人遊戲可玩 | Week 2 結束 | VoteTeam demo 通過 |
| M3 — 多人元件 6 個齊全 | Week 5 結束 | 全部 multi/* 元件 production-ready |
| M4 — 全部完工 | Week 6+ | Phase 4 補完 + 文件更新完成 |

---

## 15. 附錄

### 15.1 關鍵 file path 對照表

| 概念 | 主要檔案 |
|------|---------|
| 元件分類常數 | [shared/multiplayer-component-types.ts](../shared/multiplayer-component-types.ts)（待建） |
| games.playerMode schema | [shared/schema/games.ts](../shared/schema/games.ts) |
| Page 儲存約束 | [server/routes/pages.ts](../server/routes/pages.ts) |
| Admin GameFormDialog | [client/src/components/admin-games/GameFormDialog.tsx](../client/src/components/admin-games/GameFormDialog.tsx) |
| WebSocket 主檔 | [server/routes/websocket.ts](../server/routes/websocket.ts) |
| useTeamWebSocket | [client/src/hooks/useTeamWebSocket.ts](../client/src/hooks/useTeamWebSocket.ts) |
| TeamLobby | [client/src/pages/team-lobby/](../client/src/pages/team-lobby/) |
| Walkie 入口 | [client/src/components/walkie/WalkieFloatingButton.tsx](../client/src/components/walkie/WalkieFloatingButton.tsx) |

### 15.2 名詞對照（中英）

| 中文 | 英文 | 對應實體 |
|------|------|---------|
| 隊伍 | Team | teams 表 |
| 戰隊 / 公會 | Squad | squads 表 |
| 對講機 | Walkie | walkie_groups + LiveKit |
| 對戰 | Match / Battle | gameMatches 表 |
| 接力 | Relay | gameMatches.matchMode='relay' |
| 場次 | Session | sessions 表 |
| 場域 | Field | fields 表 |
| 個人遊戲 | Solo Game | playerMode='solo' |
| 多人遊戲 | Multi Game | playerMode='multi' |
| 通用元件 | Shared Component | shared/components/* |
| 個人專用元件 | Solo Component | solo/* |
| 多人專用元件 | Multi Component | multi/* |

### 15.3 變更紀錄

| 日期 | 版本 | 變更 | 作者 |
|------|------|------|------|
| 2026-05-01 | v1.0 | 初版建立 | Hung + Claude Code |
| 2026-05-01 | v1.1 | Phase 1.3 修訂：取消 `games.playerMode` 欄位新增，改用 `derivePlayerModeFromGameMode(gameMode)` helper 推導。理由：DRY 原則 + 零 schema 變更 + 既有資料無需遷移。影響 §2.4、§5、§11.1 | Claude Code（Loop Phase 1.3） |
| 2026-05-01 | v1.2 | Phase 1.4 重大修訂：約束改為**不對稱**（multi 元件只能在 multi 遊戲；solo 元件兩種都可）。觸發原因：盤點線上 28 個 team 遊戲全部用 solo 元件，原對稱約束會破壞所有現有遊戲。影響 §2.4、`isComponentAllowedForPlayerMode`、`getAllowedComponentsForPlayerMode` | Claude Code（Loop Phase 1.4） |
| 2026-05-01 | v1.3 | **Phase 1 完成**。23 個元件全部分類就位：shared/components/ (4) + multi/ (1) + solo/ (18)。子目錄（photo-mission/、gps-mission/、qr-scan/）保留在 game/ 根目錄作為共用工具。git rename 完整保留 history。三層驗證通過。 | Claude Code（Loop Phase 1.6） |
| 2026-05-02 | v1.4 | **Phase 2 完成**。多人元件全鏈路就位（VoteTeam / ShootingTeam / GpsTeamMission），共 9 個 commits / 115 新測試。三個元件都包含：純 UI 元件 + 容器（自取 myTeam）+ GamePageRenderer 註冊。Admin GameFormDialog 加 gameMode 選擇器。TeammatePanel 共用 UI 完成。多人元件總數從 1 增至 4。剩餘整合工作（admin page editor、server WebSocket 接合）歸入 Phase 2.6 或視試玩結果決定。 | Claude Code（Loop Phase 2） |
| 2026-05-02 | v1.5 | **Phase 2.5 完成（穩定性軸）**。實機驗證 Phase 2 期間發現多人遊戲執行時 7 個關鍵 bug，這個軸與元件層 Phase 1-4 並列補完穩定性層：field routing fix + 重連 flash + 自願退出 + 存在感通知 + ghost lobby fix + 進度同步（maxPageIndex） + 寬限期計時 + TTS 語音通知。共 7 commits，schema 加 `team_sessions.max_page_index` 欄位（部署前須跑 db:push）。完整斷線重連流程：disconnect 30s grace → grace_expired → 120s auto-leave。所有測試通過。 | Claude Code（Loop Phase 2.5） |

---

## 📝 後記

### 為什麼有這份文件

2026-05-01 開發中發現：
- 平台底層多人基礎建設投入很多（Squads / Walkie / WebSocket / Match），完成度高
- 但**遊戲元件層**幾乎都是單人，導致玩家進場後感受不到多人價值
- 之前的規劃（Wrapper 模式）走錯方向，會讓元件變複雜、admin 學習曲線高
- 採用「拆分模式」是更乾淨的解：solo / multi / shared 三分法

### 給接力者的話

如果你是未來接手這份規劃的人：
1. **先讀 §2 設計原則** — 這是不可妥協的核心
2. **再讀 §6 元件設計** — 找你要做的元件章節
3. **動手前對照 §3.4 目錄結構** — 確保檔案放對地方
4. **完工後更新 §11 Phase 進度** — 讓下一個人知道進度

如果有任何設計衝突，**回來改這份文件**，不要在程式碼裡留 TODO 期待後人發現。

如果發現本規劃有錯，**直接改**並寫進 §15.3 變更紀錄。

---

**文件結束**
