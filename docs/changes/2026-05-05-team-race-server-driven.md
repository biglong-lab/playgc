# ChoiceVerifyRace server-driven 持久化 + 多人元件全面檢查 — 2026-05-05

> 範圍：核心架構升級 / 狀態：第一階段完成、其他元件待陸續套用
> 部署：commit `<待 push>` 起

## 背景

使用者實測反饋（重大架構議題）：
> 「我只要重新整理，就會重新計算，造成遊戲不同步、答題也可以重新答題、時間請調整成有人答對就倒數五秒、不要每一題都要等三十秒、答題進度要同步、資訊不能因為重新整理就重來、請針對全面性的檢查、不是只是解決我講的這個點、會大亂」

核心議題：**所有多人元件的 state 都在 client useState、重整就丟、跨玩家不同步**。

## 影響範圍

DB：新增 2 張表（team_race_states / team_race_answers）
端點：新增 4 個 REST endpoint（state get/post / answer / advance）
WS：新增 1 個 broadcast 訊息 type（race_state_updated）
Client：ChoiceVerifyRacePage + ChoiceVerifyRace 重寫為 server-driven

## 解決方案

### A. DB 持久化（單一資料來源 SoT）

新增兩個表：
- `team_race_states`：每隊每 page 一筆 — currentQuestionIndex / questionStartedAt / resolvedAt / status / 設定值
- `team_race_answers`：每位玩家每題一筆（UNIQUE 防重答）

啟動時 `ensureTeamRaceSchema()` raw SQL CREATE IF NOT EXISTS（不依賴 drizzle-kit migration）。

### B. REST endpoints

| 端點 | 用途 | idempotency |
|------|------|-------------|
| `GET /api/team-race/state` | 拉當前 state + 全部 answers（mount/refresh） | 純讀 |
| `POST /api/team-race/state` | upsert state（玩家進場初始化） | ON CONFLICT DO NOTHING |
| `POST /api/team-race/answer` | 提交答題（DB UNIQUE 防重答） | UNIQUE 衝突 → idempotent 200 |
| `POST /api/team-race/advance` | 推進下一題（任一 client 5s 後送） | conditional UPDATE 防 race |

關鍵：
- `advance` 用 `WHERE current_question_index = expectedQuestionIndex` 條件更新
- 第一個 client 成功 → 廣播；其他 race 衝突 → returning 0 rows、回 idempotent 當前 state

### C. WS broadcast

`race_state_updated`：state 任何變化（answer / advance / completed）→ 廣播給整隊
- payload: `{ type, state, answers }`
- client 收到 → 直接 `setServerState(...)` + `setServerAnswers(...)`

### D. Client 邏輯

**ChoiceVerifyRacePage**（容器層、處理同步）：
1. mount → POST /state（idempotent upsert + 拉初始）
2. 訂閱 ws → 收到 race_state_updated 自動更新
3. ws reconnect → 重新 GET state（保險）
4. 答題 → POST /answer（mutation onSuccess 也更新 local state、雙保險）
5. resolvedAt 有值 → setTimeout 5s → POST /advance（防重複用 advanceFiredRef Set）
6. resolvedAt 無值 + questionStartedAt + secondsPerQuestion 過時 → 自動 advance（fallback）
7. status='completed' → 計算自己分數 → onComplete

**ChoiceVerifyRace**（純 UI、props-driven）：
- 移除 `useState(currentQIndex)` — 改 `props.currentQuestionIndex`
- 移除 `useGameTimer` — 改用 `Date.now()` interval + `props.questionStartedAt` 計算
- `isResolved = !!props.resolvedAt`（不再用 answerRecords 判斷）
- timer 區分 `playing` / `cooldown` 模式（cooldown 顯示綠色「下一題：Ns」）

## 測試覆蓋

- `client/src/components/game/multi/__tests__/ChoiceVerifyRace.test.tsx` 25 tests 全綠
- 純函式 helpers（getRecordsForQuestion / calcUserScore / 等）保留不動
- 元件 props 介面變更 → 測試 baseProps 補新欄位

## 驗證

- `npx tsc --noEmit` 零錯誤
- `node scripts/smoke-test-scenarios.mjs` 51/51
- `npx vitest run` 主要 suites pass

---

## 全面性檢查 — 其他多人元件狀態

使用者要求「全面性檢查」— 把所有可能受「重整就重來」影響的元件列出來：

| 元件 | 持久化現況 | 是否受影響 | 優先序 |
|------|------------|-----------|--------|
| **ChoiceVerifyRace** | ✅ 已 server-driven（本 PR） | — | ✅ done |
| **PhotoTeamGather**（新合照） | ❌ shots 在 useState | 中 — 重整丟拍過的、但流程簡單可重拍 | 低 |
| **PhotoTeamFlow** (collage) | ❌ members/shots 在 useState | 高 — 重整逐位拍要全重來 | 中（建議 admin 改用 gather） |
| **VoteTeamPage** | ⚠️ 半 server（投票寫 DB、但 UI state 重整丟） | 中 — 已投票的人重整還是看到投票 UI、要再投 | 中 |
| **LockCoopPage** | ✅ ws sync + cache（reconnect 補狀態）| 低 — 有 teamStateCache 機制 | — |
| **RelayMissionPage** | ✅ ws sync + cache | 低 — 同上 | — |
| **TerritoryCapturePage** | ✅ ws sync + cache | 低 — 同上 | — |
| **ShootingTeamPage** | ⚠️ 部分 — 命中寫 DB、但 sessionState 在 client | 中 — 重整射擊紀錄不丟、但回合狀態重置 | 中 |
| **GpsTeamMissionPage** | ⚠️ 簽到寫 DB、但 progress 在 client useMemo | 中 | 低 |
| **CollectiveScore / TreasureHunt / QuestChain / RoleAssign** | ❌ 未檢視 | 待查 | 低 |

**通用模式（建議套用）**：
1. 新增 `team_<feature>_states` + `team_<feature>_records` 表
2. server endpoints：state upsert / record append / advance（如有階段推進）
3. ws broadcast `<feature>_state_updated`
4. client：mount fetch + ws update + optimistic onSuccess 雙保險

**可批次處理的元件**：VoteTeamPage（已半完成、只需把 UI state 改 server-driven）、ShootingTeam（同樣）。

**ChoiceVerifyRace 模式可作為其他元件範本**，採同樣 4 步驟：
- DB schema (states + records)
- REST endpoints (state/record/advance)
- WS broadcast 一個 *_updated 訊息
- Client mount fetch + ws subscribe

## 已知限制 / 後續優化

1. **server-side advance timer 缺失**
   - 目前由 client 5s 後送 advance、若**全隊都離線**則卡住
   - 後續：cron job 每分鐘掃 `WHERE resolvedAt + cooldown < now() AND status='playing'` 自動 advance
   - 或：server 端 setTimeout（重啟丟失、但配 cron 補）

2. **questionTimeLimit fallback 推進**
   - 目前由 client 端監測 questionStartedAt + secondsPerQuestion 自動送 advance
   - 多 client 會同時送、server conditional UPDATE 處理 race
   - 後續：同 #1 cron 補

3. **跨場域同 sessionId 衝突**
   - sessionId 跨場域應該不重複（uuid）但若有 collision 會誤共享 state
   - 風險低、暫不處理

4. **部分 multi 元件仍需套用此模式**（見上表）
   - 優先：VoteTeamPage / ShootingTeamPage（用戶可能踩到）
   - 次優先：PhotoTeamFlow collage 模式（建議 admin 切到 gather）

## 相關文件

- ADR: 待補（若決定用此 pattern 套到所有 multi 元件）
- runbook: db-migration（team_race_states 已加進 ensureSchema 流程）
- 上一輪：2026-05-05-disconnect-banner-photo-gather.md
