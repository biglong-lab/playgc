# ADR-0018: 即時通訊架構規範 — 全域單例 WebSocket Provider

> 日期：2026-05-08
> 狀態：採用中
> 影響：所有 client-side WebSocket 通訊、所有 multi 元件、未來新增的即時通訊功能

---

## 背景

2026-02 至 2026-05-08 期間 codebase 累積了 **4 條獨立 WebSocket 連線**：

| Hook / 元件 | 用途 | 各自 `new WebSocket()` |
|------------|------|---------------------|
| `useTeamWebSocket` | 主隊伍 WS（59 個 multi 元件用） | ✅ 每元件 1 條 |
| `useHostScreenSync` | 主持人模式 WS（猜謎 TriviaShowdown 用） | ✅ 獨立 |
| `useTeamShootingSync` | 射擊遊戲 WS | ✅ 獨立 |
| `ChatPanel` (對講機) | 隊伍聊天 WS | ✅ 獨立 + 無 reconnect |

**真實事件**（2026-05-08）：
- user 實機測試多人遊戲、回報三個現象：
  1. 進入遊戲就斷線
  2. 對講機隊友離線
  3. 多人猜謎不同步

**根因**（架構性、非個別 bug）：
- 同一玩家瀏覽器同時開 4 條 ws → server 看到「同 userId 多條 ws」
- 元件 mount/unmount 各自關閉自己的 ws → server 端 isUserStillConnected 競態誤判離線
- 4 條 ws 互相干擾 → 隊友收到誤警報、訊息漏接

**演進軌跡**：典型 SaaS growing pains（Slack / Discord / Figma 都有同樣歷程）。
- 2026-02 MVP 階段：1 個 use case = 1 個 hook、各自 ws
- 2026-05 Phase 2 多人元件爆發：一週內加 4 種 sync hook、慣性使用同一 pattern
- 沒有真實多人 e2e 壓力測試 → 看不到問題

---

## 選項

### 方案 A：維持自寫 WS + 全域單例（採用）
**優點**：
- 完全掌控、零月費、出事自己 debug
- 既有 60 個 multi 元件不需改 API
- 可分階段重構降風險

**缺點**：
- 需要 4-5 天重構工
- 影響範圍大（多個 hook + Provider）

### 方案 B：Supabase Realtime
**優點**：
- 寫 DB 自動廣播、零手寫 ws
- 內建 reconnect

**缺點**：
- 需要遷部分 DB 到 Supabase（雙頭管理）
- 月費 $25+
- vendor lock-in

### 方案 C：Liveblocks / Pusher / Ably
**優點**：
- 第三方託管、不用自管 server
- 成熟基礎設施

**缺點**：
- 收費按 connection / MAU、量起來貴
- vendor lock-in
- 出事 debug 不到根因

---

## 決定

採用 **方案 A：自寫 WS + 全域單例 WebSocketProvider**。

### 規範

#### 規則 1：整個 app 全域只能有 1 條 WebSocket connection

```tsx
// ❌ 禁止
function MyComponent() {
  useEffect(() => {
    const ws = new WebSocket(...) // ← CI 阻擋
    // ...
  }, [])
}

// ✅ 正確
function MyComponent() {
  const wsApi = useWebSocket();
  useEffect(() => {
    const release = wsApi.ensureConnected();
    const releaseJoin = wsApi.registerOnConnect(`mything:${id}`, (ws) => {
      ws.send(JSON.stringify({ type: "my_join", id }));
    });
    const unsubscribe = wsApi.subscribe((data) => {
      // 處理 inbound 訊息
    });
    return () => {
      releaseJoin();
      unsubscribe();
      release();
    };
  }, [id, wsApi]);
}
```

#### 規則 2：所有即時通訊必須透過 `useWebSocket()` Provider

新元件需要 ws 通訊 → **必須**走 Provider。

提供的 API：
- `acquire(config)` — 給 useTeamWebSocket 專用（含 team config）
- `ensureConnected()` — 通用確保連線（ref counting）
- `registerOnConnect(key, handler)` — 註冊 ws OPEN 時要發的訊息（reconnect 後自動重發）
- `subscribe(handler)` — 訂閱所有 inbound 訊息
- `send(msg)` — 透過 current ws 發送
- `getConnectionStats()` — 連線統計

#### 規則 3：禁止直接 `new WebSocket()`

CI 自動檢查：

```bash
# scripts/check-ws-singleton.sh（待加進 CI）
COUNT=$(grep -r "new WebSocket(" client/src --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__" | grep -v ".test." \
  | grep -v "WebSocketContext" \
  | wc -l)
if [ $COUNT -gt 0 ]; then
  echo "❌ 偵測到 $COUNT 處非 Provider 的 new WebSocket()、違反 ADR-0018"
  exit 1
fi
```

或 e2e 測試 `e2e/global-ws-provider.spec.ts` 內已內建檢查。

**目前已知例外**（Phase 5 處理）：
- `client/src/components/game/solo/ShootingMissionPage.tsx`（個人遊戲）
- `client/src/hooks/use-match-websocket.ts`（對戰系統）

#### 規則 4：計分 / 排名 / 結算結果 → server-side source-of-truth

- ❌ **禁止** 純 client 端計算分數（如原 TriviaShowdown）
- ✅ 所有計分透過 REST POST → server 寫 DB → broadcast 結果
- 理由：ws 訊息漏接時 client 可從 DB query 補回正確狀態

實作範例（Phase 4）：
```ts
// ❌ 舊：client 端算分
const newScores = computeScores(answers);

// ✅ 新：server 端算分
await fetch(`/api/trivia/${sessionId}/answer`, {
  method: "POST",
  body: JSON.stringify({ questionId, choice }),
});
// server 寫 DB + broadcast 結果給所有 client
```

#### 規則 5：ws 訊息類型加新的 → 必須對齊 ADR-0014

- 訊息類型遵守命名規範（`team_*` / `host_screen_*` / `match_*` 等）
- payload 加 zod schema 驗證（即將補完）
- 新增訊息類型 → 同步更新 client `TeamMessage` interface

#### 規則 6：所有 ws 事件自動進 ws_event_log

- Phase 0.2 已建立完整事件 log
- 新增訊息類型不需特別處理、Provider 內部會 broadcast 給 logger
- server 端的 broadcastToTeam / broadcastToSession 等已 hook log

#### 規則 7：對講機等敏感訊息 預設不存內容

- `chat` / `team_chat` 訊息類型 → ws_event_log 預設不存 message 內容
- 只存 metadata（length / sender / timestamp）
- admin opt-in `ENABLE_CHAT_FULL_LOG=true` 才存全文（爭議仲裁需要）

---

## 影響

### 程式碼對應
- `client/src/contexts/WebSocketContext.tsx` — Provider 主檔
- `client/src/hooks/use-team-websocket.ts` — useTeamWebSocket（隊伍訊息、覆蓋 81 處）
- `client/src/components/game/shared/hooks/useHostScreenSync.ts` — 主持人模式
- `client/src/components/game/shared/hooks/useTeamShootingSync.ts` — 射擊遊戲
- `client/src/components/shared/ChatPanel.tsx` — 對講機
- `shared/schema/observability.ts` — ws_event_log + db_write_log
- `e2e/global-ws-provider.spec.ts` — 規範驗證 + ws 連線數驗證

### 紅線
- ❌ 不可新建 `new WebSocket()`（除 Provider 內部 1 處 + 已知例外 2 處）
- ❌ 不可在元件層做計分 / 排名（必須 server-side）
- ❌ 不可繞過 Provider 自寫 reconnect / keepalive 邏輯

### 已知限制
- 1 個玩家瀏覽器仍可能多 tab 各自開 1 條 ws（無法跨 tab 共用、瀏覽器限制）
- 未驗證大量場域並發下 server 端 ws 容量
- Phase 5 後續：solo / match 兩處 ws 待整合

---

## 後續可能變動

### 可能重新評估的情境
1. **效能瓶頸**：若 server 端 ws 連線數超過 N 千條 → 評估上 Pusher / Ably
2. **多區域部署**：若 deploy 到多 region → 評估 ws routing / sticky session
3. **Edge computing**：若 evaluate Cloudflare Workers / PartyKit → 評估邊緣 ws

### 不會重新評估
- 改用 Supabase Realtime（DB 雙頭、複雜度↑）
- 改用 Liveblocks（vendor lock-in、月費）

---

## 相關文件

- [Phase 1 complete](../changes/2026-05-08-phase-1-complete.md) — WebSocketProvider + useTeamWebSocket
- [Phase 2 complete](../changes/2026-05-08-phase-2-complete.md) — 合併 3 條 ws
- [Phase 3 complete](../changes/2026-05-08-phase-3-complete.md) — 移除 feature flag + ADR
- [規劃文件](../changes/2026-05-08-multi-stability-refactor-plan.md)
- [ADR-0014](0014-realtime-protocol-cleanup.md) — Realtime 協定規範
- [ADR-0015](0015-websocket-anonymous-write-policy.md) — WS 匿名寫入政策
- [ADR-0017](0017-loop-mode-safeguards.md) — Loop 模式安全護欄
- [v2 audit](../changes/2026-05-08-multi-stability-audit-v2.md) — 風險定義
