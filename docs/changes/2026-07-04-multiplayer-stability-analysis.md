# 多人遊戲穩定性 — 完整根因分析與優化 — 2026-07-04

> 範圍：WS 拓撲 / client 同步韌性 / server 併發
> 來源：業主「多人遊戲一直都不是很穩定」+ 7/3 三台實測回報
> 方法：3 路並行探勘（server WS / client 同步 / 元件盤點+歷史）+ 生產設定查證，全部結論有程式碼行號佐證
> 對應 ADR：[0023-ws-single-worker-topology.md](../decisions/0023-ws-single-worker-topology.md)

---

## 為什麼不穩定 — 5 層根因

### 🔴 第 0 層：部署拓撲（頭號根因）
**生產 `.env` 設 `CLUSTER_WORKERS=4`，但 WS 架構假設單 worker。**
- 房間/狀態/計時器全是 per-worker 記憶體 Map（`websocket.ts:50-124`），無 Redis pub/sub
- `index.ts:66-68` 註解明寫「單 worker 內仍可運作、無需 Redis」——env 卻開了 4 worker
- TCP round-robin → 3 隊員全落同一 worker 機率僅 **1/16**；94% 的隊伍必有人收不到廣播
- REST 廣播（game_started/進度/投票/leader-decide）打到隨機 worker → 部分人收不到
- `cancelDisconnectTimer` 跨 worker = no-op → 已重連仍被判寬限期過、隊長「先繼續」無效

→ 一次解釋 7/3 全部症狀。5/08-5/10 修好單 worker 內的 WS 層後，後開 CLUSTER_WORKERS=4 默默破壞架構前提。

### 第 1 層：身分（7/3 已修）
GamePlay 未讀 `?session=` → 隊員各建個人 session 腦裂（commit `ccfbf063`）。

### 第 2 層：傳輸韌性
- 廣播無 ack/重送；非 OPEN socket 靜默跳過；限流靜默丟
- 重連只 rejoin 房間、不重拉業務狀態；只有 lock_coop/relay 有 snapshot 重放
- iOS 只監聽 visibilitychange；背景 >90s 被 terminate → 斷線→寬限管線
- 匿名 socket 的 vote/ready/chat 靜默丟棄（`websocket.ts:456-510`）

### 第 3 層：狀態同步實作分裂（60 元件 4 種模式）
- A 層 52 元件用 `useTeamGameState`（version 樂觀鎖+10s poll+409 retry）＝最健全範本
- 5 支專屬 hook + 3 個元件內 bespoke 語意各異
- GamePlay 隊伍進度**無輪詢兜底**；投票分母不 refetch + 門檻 client/server 不一致；`team-scores.ts` 非原子累加

### 第 4 層：觀測與測試缺口
- server 路由層併發保護零單元測試；重連上報只在第 3 次觸發一次

---

## 本次修復（Phase 0 + A + B）

| 項 | 修法 | 檔 |
|----|------|-----|
| **Phase 0** 拓撲止血 | 生產 `CLUSTER_WORKERS=4 → 0`（恢復單 worker 架構前提）| 生產 `.env` |
| A1 進度兜底 | activeSession query 加 10s 輪詢；一次性跳頁改持續「只前進」跟隊 | `GamePlay.tsx` |
| A2 投票一致 | my-team 分母 10s refetch；majority 門檻改 `ceil(n/2)` 對齊 server | `VoteTeamPage.tsx`、`VoteTeam.tsx` |
| A3 重連重拉 | vote + team-state（52 元件）ws 重連立即 refetch、不等 poll | `useTeamVoteSync.ts`、`useTeamGameState.ts`、`useTeamPagePersistence.ts`、`VoteTeamPage.tsx` |
| A4 iOS 背景 | WebSocketContext 補 `pageshow` 監聽 | `WebSocketContext.tsx` |
| B5 分數原子化 | `team_score = team_score + delta` DB 端累加（去 read-modify-write）| `team-scores.ts` |
| B6 匿名可觀測 | 需認證訊息被丟時回 `{type:"error", code:"unauthenticated"}` | `websocket.ts` |

**刻意不動**：心跳/寬限參數（多數誤判來自跨 worker no-op，Phase 0 後重新觀測再調、避免多變因）。

## 後續路線（Phase C/D，見 ADR-0023）
- C：新多人元件一律用 useTeamGameState 模式（ADR 規範）；server 併發路徑補單元測試
- D：若單 worker 撐不住 → Redis pub/sub adapter；**開多 worker 前必須先做 D**

## 驗證
- tsc ✅、build ✅、91 測試過（teams/sessions/VoteTeam/voteSync；majority 門檻測試更新為 ceil 語意）
- 部署後：3 台真機（建隊→開賽同步→投票一致→切背景 30s 恢復→隊長先繼續生效）
- 觀測：`ws_event_log` 斷線原因分佈 before/after
