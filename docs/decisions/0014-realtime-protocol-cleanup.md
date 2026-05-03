# ADR-0014: Realtime 協定清理 — Codex 多輪盤點後的對齊規範

> **日期**：2026-05-03
> **狀態**：採用中
> **影響**：所有 team / session / match WebSocket 事件協定

---

## 背景

Codex CLI 在多輪程式碼審查中（第 1-7 輪）指出本 repo realtime 協定存在系統性問題：

1. **房間模型混用**：team 事件部分走 `broadcastToTeam(teamId)`、部分走 `broadcastToSession("team_${id}")`
2. **事件名稱不一致**：`member_joined` vs `team_member_joined`、`score_update` vs `team_score_update`
3. **silent broadcasts**：server 寫了 broadcast 但 client 從未實際接收（功能完全失效）
4. **dead events**：server 廣播但 client 未實作 handler（保留給未來）

---

## 選項

### 方案 A：完全砍掉所有 dead broadcasts
- 優：精簡、無維護負擔
- 缺：未來想加擴充功能（如「玩家加入」toast）需重做

### 方案 B：保留 dead broadcasts + 文件化（採用）
- 優：未來擴充零成本
- 缺：少量網路流量浪費

### 方案 C：補完所有 client handler
- 優：發-收完整對齊
- 缺：擴大範圍、需額外設計 UI 表現

---

## 決定

**採用方案 B**：保留 dead broadcasts + 文件化。

修法分兩階段：
1. **2026-05-03 commit 092eba69**（已完成）：把 silent bugs 全修（5 個 team REST 事件對齊房間 + 名稱）
2. **本 ADR**（文件化）：記錄當前 dead broadcasts 狀態、避免後續誤判

---

## 影響

### 已修（不再是 bug）

| 事件 | 之前狀態 | 現在狀態 |
|------|---------|---------|
| `team_member_joined` | server 發 `member_joined` 到錯房間 | ✅ broadcastToTeam + 名稱對齊 |
| `team_score_update` | server 發 `score_update` 到錯房間 | ✅ broadcastToTeam + 名稱對齊 + 補欄位 |
| `ready_status_changed` | dead event | ✅ broadcastToTeam + client 加 case |
| `vote_created` | 對名但錯房間 | ✅ broadcastToTeam |
| `vote_cast` | 對名但錯房間 | ✅ broadcastToTeam |

### Dead broadcasts（保留給未來）

| 事件 | server 廣播位置 | 設計意圖 | 為何保留 |
|------|----------------|---------|---------|
| `user_joined` | `websocket.ts:225` | 通知 session 內其他人 | 未來可加「玩家進入」toast |
| `user_left` | `websocket.ts:651` | 同上 | 未來可加「玩家離開」toast |
| `match_participant_joined` | `websocket.ts:556` | 通知 match room | 未來 lobby UI 可顯示「等待玩家」進度 |
| `match_participant_left` | `websocket.ts:710` | 同上 | 同上 |
| `battle_slot_joined` | `websocket.ts:602` | 進房 ack | client 從未呼叫 `battle_slot_join`、保留給未來 battle 系統擴充 |

### Realtime 統一規範（W19 起）

新增任何 team realtime 事件、必遵守：

```typescript
// ✅ 正確：用 broadcastToTeam + team_ 前綴事件名
ctx.broadcastToTeam(teamId, {
  type: "team_xxx_event",  // 必加 team_ 前綴
  // ...
});

// ❌ 錯誤：broadcastToSession + 自定 prefix
ctx.broadcastToSession(`team_${teamId}`, { type: "xxx_event" });  // 房間 + 名稱雙錯
```

新增 session realtime 事件：

```typescript
// ✅ 用 broadcastToSession（純 sessionId、無 prefix）
ctx.broadcastToSession(sessionId, { type: "session_xxx" });
```

新增 match realtime 事件：

```typescript
// ✅ 用 broadcastToMatch（必對應 ws.matchId）
broadcastToMatch(matchId, { type: "match_xxx" });
```

---

## 後續可能變動

未來若需加「玩家加入/離開」UI feedback、應該：

1. 在 `use-team-websocket.ts` 或 `use-match-websocket.ts` 加對應 case
2. 不要在 server 端重複廣播事件（已有 broadcast、補 client handler 即可）
3. 補完後更新本 ADR 移除「Dead broadcasts」表

`battle_slot_join` 從未被 client 觸發、若 W21+ 開發水彈 battle 系統時要重新設計 lobby 進房流程。

---

## 相關文件

- [ADR-0004 host-screen-axis](0004-host-screen-axis.md) — host 軸線設計
- [ADR-0013 W18 元件擴充](0013-w18-component-expansion.md) — host 元件批次
- [docs/changes/2026-05-03-codex-realtime-cleanup.md] — 本次 7 輪 Codex 審查的詳細變動紀錄
- [host-screen-components.md](../domains/host-screen-components.md) — 14 個 host 元件對照
