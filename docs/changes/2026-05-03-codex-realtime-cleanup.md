# Codex 7 輪審查 — Realtime 協定 + Hooks 全面修法 — 2026-05-03

> **範圍**：Codex CLI 7 輪持續審查、累計 ~25 commits、6 個系統性 bug 修法
> **狀態**：已部署
> **部署 commit**：`44cc1c81 .. 4a59d145`

---

## 背景

雙 AI 協作機制（Claude + Codex）建立後、Codex 連續 7 輪挖掘 main branch 高訊號問題。每輪 Codex 給點狀分析、Claude 動手修。

使用者明確要求：「使用者願景 / 全面啟動 / 接力持續完成 / 每階段 e2e 測試 / 完整紀錄」。

---

## 影響範圍

### Server routes
- `server/routes/websocket.ts`：移除 case "chat"（防雙寫 + auth bypass）
- `server/routes/teams.ts`：member_joined → team_member_joined + broadcastToTeam
- `server/routes/team-lifecycle.ts`：ready_status_changed → broadcastToTeam
- `server/routes/team-scores.ts`：score_update → team_score_update + 補欄位
- `server/routes/team-votes.ts`：vote_created / vote_cast → broadcastToTeam（2 處）
- `server/routes/player-sessions.ts`：chat REST 寫 DB 後 broadcast + ctx 注入
- `server/routes/player-games.ts`：傳 ctx 進子 routes
- `server/routes/index.ts`：傳 ctx 給 player-games
- `server/routes/locations.ts`：座標 0 全鏈 (`||` → `??`)
- `server/lib/admin-copilot.ts`：lat/lng=0 改用 `== null`

### Client hooks / pages
- `client/src/components/game/shared/hooks/useHostScreenSync.ts`：useRef 存 onPulse、不依 opts dep
- `client/src/hooks/use-team-websocket.ts`：加 ready_status_changed case + onReadyStatusChanged callback
- `client/src/components/game/shared/hooks/useTeamShootingSync.ts`：session_join → join + 補 userId/userName
- `client/src/components/shared/ChatPanel.tsx`：移除 WS 送 chat、isWsConnected useState、頭像顯示修正
- `client/src/pages/HostPlay.tsx`：砍頁面層 WS、indicator 改 query 載入狀態
- `client/src/pages/HostScreen.tsx`：同上 + 清理 dead useLocation
- `client/src/components/UnifiedAdminLayout.tsx`：useMemo 移到 hooks 區塊
- `client/src/components/battle/ClanManagePanel.tsx`：4 個 useMutation 移到 early return 前
- 11 個 host pages：config 統一 useMemo
- `client/src/components/shared/LocationImporter.tsx`：座標 0 全鏈

### New components
- `client/src/components/game/host/TeamBattleScore.tsx`（271 行、第 14 個 host 元件）
- `client/src/components/game/host/TeamBattleScorePage.tsx`
- `__tests__/TeamBattleScore.test.tsx`（17 tests）

### Documentation
- `docs/decisions/0014-realtime-protocol-cleanup.md`（本變動 ADR）
- `docs/domains/host-screen-components.md`（13→14 元件對照表）

---

## 解決方案

按 Codex 7 輪審查順序：

### 第 1 輪：座標 + Hook deps
- A: 補修先前漏掉的 3 處座標位置（locations.ts / LocationImporter / admin-copilot）
- B: 3 個 host pages 用 useMemo 穩定 config identity

### 第 2 輪：useHostScreenSync hook opts dep
- 真 P0：effect 依賴 opts → 每次 render reconnect WebSocket
- 修法 C：useRef 存 onPulse、effect 不依 opts

### 第 3 輪：Chat 雙寫 + 安全洞 + session_join + UI
- ChatPanel WS + REST 雙寫 DB → 改單一 REST 資料流
- WS chat 繞過 auth + limit → 移除 case "chat"
- useTeamShootingSync session_join → join 對齊 server case
- ChatPanel polling / 頭像 fallback 修正

### 第 4 輪：HostPlay/HostScreen 重複 WS
- 頁面層 + 元件層各開一條 → 同畫面雙 WS
- 修法：砍頁面層 WS、indicator 用 query 載入狀態

### 第 5 輪：Team realtime 房間 + 名稱雙重不一致
- 5 處 server REST 用 `broadcastToSession("team_${id}")` 但 client 不在那房間
- 統一改 `ctx.broadcastToTeam(teamId, ...)` + 對齊事件名
- client 加 `ready_status_changed` case + onReadyStatusChanged callback

### 第 6 輪：Realtime 對照表盤點
- 11 個 realtime 功能對照表確認
- grep 確認無漏網 broadcastToSession 誤用

### 第 7 輪：Dead broadcasts 識別
- 5 個 server 有發但 client 無 handler 的事件
- 結論：非 user-facing bug、保留給未來（見 ADR-0014）

---

## 實作步驟

時序列出主要 commits（從 `ad22129e` base）：

| commit | 內容 |
|--------|------|
| `44cc1c81` | 第 1 輪 A+B：座標 + Hook deps |
| `8d294c82` | 紀錄 |
| `009c4262` | 8 個 host pages useMemo |
| `bb40fed4` | 紀錄 |
| `07333431` | 最後 2 host pages 收尾（11 檔全套）|
| `dfce5348` | 紀錄 |
| `00454fd4` | host-screen-components.md 對照文件 |
| `7f7119dd` | 紀錄 + build 驗證 |
| `a98781b4` | TeamBattleScore 純元件 + 17 tests |
| `6aee8f3e` | TeamBattleScore Page wiring |
| `2c276308` | 文件 13→14 |
| `b2f655de` | 紀錄 |
| `60a628b3` | 第 2 輪：hook opts dep 真 bug |
| `2d28b8ec` | 紀錄 |
| `ba0872f9` | 第 3 輪 P0-A：Chat 雙寫 + WS auth bypass |
| `8b015cc2` | 第 3 輪 P0-B：useTeamShootingSync 協定 |
| `b098eadb` | 第 3 輪 P1：ChatPanel UI |
| `b6b696db` | 紀錄 |
| `1392305f` | 第 4 輪 P0：HostPlay/HostScreen 重複 WS |
| `f7a65b4f` | 紀錄 |
| `092eba69` | 第 5 輪 P0：team realtime 系統性 |
| `f39cb798` | 紀錄 |
| `4a59d145` | 第 6 輪：完整 test:run 155/2179 + 紀錄 |

---

## 驗證

每輪修法都通過：
- `npx tsc --noEmit` 0 錯誤
- `node scripts/smoke-test-scenarios.mjs` 51/51
- 對應路徑單元測試（hook tests / playerSessions / teams / team-* / websocket）
- **最終完整 test:run：155 檔 / 2179 tests 全綠**（vs 之前 154/2163）

---

## 已知限制 / 後續優化

1. **5 個 dead broadcasts**：保留給未來 toast / lobby UI 擴充（見 ADR-0014）
2. **ShootingMissionPage hardcode user**：`userId: "shooting-player" / userName: "玩家"` 待後續從 props 取真實玩家身份
3. **ChatMessage schema 無 userName**：頭像顯示其他人用 `userId.slice(-4)` 暫代、未來補 server JOIN users 取真實 displayName
4. **chart.tsx dangerouslySetInnerHTML**：CSS 變數注入、目前無 client 端 import、零攻擊面、為未來預警

---

## 相關文件

- [ADR-0014 Realtime 協定清理](../decisions/0014-realtime-protocol-cleanup.md)
- [ADR-0004 Host Screen 軸線](../decisions/0004-host-screen-axis.md)
- [ADR-0013 W18 元件擴充](../decisions/0013-w18-component-expansion.md)
- [host-screen-components.md](../domains/host-screen-components.md)
- [codex-claude/logs/2026-05-03.md](../../codex-claude/logs/2026-05-03.md) — 雙 AI 協作詳細紀錄
