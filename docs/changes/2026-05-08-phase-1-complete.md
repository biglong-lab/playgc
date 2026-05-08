# Phase 1 完成 — WebSocketProvider + useTeamWebSocket via Provider — 2026-05-08

> 對應規劃：[2026-05-08-multi-stability-refactor-plan.md §4](2026-05-08-multi-stability-refactor-plan.md)
> 狀態：✅ 完成、tsc 0 / smoke 51/51、feature flag 預設 OFF（不影響既有行為）

---

## 1. 範圍

**自寫 WS + 全域單例第 1/3 階段**：建 WebSocketProvider 在 App 層、useTeamWebSocket 改用 Provider connection。

**保留 feature flag**：`VITE_USE_GLOBAL_WS=true` 才走新行為、否則 100% 等同 Phase 1 之前。

---

## 2. 完成清單

### 新增 WebSocketProvider（`client/src/contexts/WebSocketContext.tsx`、~330 行）

**設計**：
- 整個 app 全域只有 1 條 ws connection（同一 user）
- Provider 在 App 層 mount、整個 app lifetime 期間保留 ws
- 元件 mount/unmount 不會 close ws

**API**：
- `useWebSocket()` — hook 取得 context
- `acquire(config)` — 確保 ws 連到指定 user（teamId/userId/userName/alsoJoinSessionId）
- `subscribe(handler)` — 訂閱所有 inbound 訊息（多 hook 共用同一條 ws）
- `send(msg)` — 透過 current ws 發送訊息
- `getConnectionStats()` — 連線統計（與 legacy 相容）
- state：`isConnected` / `isReconnecting`

**保留行為**（=原 useTeamWebSocket）：
- exp backoff reconnect（1s → 2s → 4s → 8s → 16s → max 30s + ±20% jitter）
- 25 秒 client keepalive（對抗 browser tab background throttle）
- visibilitychange 即時重連 + 主動 keepalive
- statsRef 追蹤 disconnect / reconnect success/fail count
- 連 3 次失敗 → reportClientEvent 上報

### 改造 useTeamWebSocket（`client/src/hooks/use-team-websocket.ts`）

**入口加 feature flag 分流**：
```ts
export function useTeamWebSocket(opts) {
  if (USE_GLOBAL_WS_PROVIDER) return useTeamWebSocketViaProvider(opts);
  return useTeamWebSocketLegacy(opts);
}
```

**Legacy 版**：完全不動（重命名 `useTeamWebSocketLegacy`、行為 100% 一致）

**Provider 版**（`useTeamWebSocketViaProvider`）：
- 從 Provider 拿 connection（`useWsProvider()`）
- `useEffect` acquire(config)、unmount 時 release（no-op、Provider 保留 ws）
- `subscribe(handler)` 訂閱 message dispatch 到對應 callback
- 所有 16 個 callback 完整保留：
  - onMessage / onMemberJoined / onMemberLeft
  - onMemberDisconnected / onMemberReconnected
  - onLocationUpdate / onVoteCast / onScoreUpdate
  - onReadyUpdate / onGameStarted / onProgressAdvance
  - onGraceExpired / onLeaderDecide / onReadyStatusChanged
  - onSelfKicked
- 所有 8 個 send function 完整保留（透過 Provider's send）：
  - sendChat / sendLocation / sendVote / sendReady
  - sendLockCoopSync / sendRelaySync / sendTerritorySync / sendRaceAnswer
- `memberLocations` Map 邏輯保留
- `getConnectionStats` 透過 Provider 提供

### App.tsx wrap

```tsx
<AuthProvider>
  <WebSocketProvider>           {/* 新增 */}
    <FieldThemeProvider>
      ...
    </FieldThemeProvider>
  </WebSocketProvider>
</AuthProvider>
```

---

## 3. 功能對照表（重要 — 確認功能不減少）

| 功能 | Legacy 行為 | Provider 版行為 | 等價 |
|------|-------------|-----------------|------|
| ws url | `/ws` | `/ws` | ✅ |
| onopen 發送 team_join | ✅ | ✅（Provider 內部） | ✅ |
| alsoJoinSessionId 額外發 join | ✅ | ✅ | ✅ |
| 25s keepalive | ✅ | ✅（Provider 集中管） | ✅ |
| visibilitychange 重連 | ✅ | ✅ | ✅ |
| exp backoff 重連 | ✅ | ✅ | ✅ |
| reconnectAttempts >= 3 上報 | ✅ | ✅ | ✅ |
| disconnectCount 統計 | ✅ | ✅ | ✅ |
| reconnectSuccessCount 統計 | ✅ | ✅ | ✅ |
| reconnectFailCount 統計 | ✅ | ✅ | ✅ |
| 16 個 callbacks dispatch | ✅ | ✅ | ✅ |
| 8 個 send functions | ✅ | ✅ | ✅ |
| memberLocations Map | ✅ | ✅ | ✅ |
| isConnected / isReconnecting | ✅ | ✅ | ✅ |
| getConnectionStats() | ✅ | ✅ | ✅ |

→ **所有功能均完整保留**、行為等價、API 不變。

---

## 4. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠（feature flag = false 預設）|
| useTeamWebSocket signature | ✅ 不變、59 個 multi 元件不需改 |
| 既有 ws 行為 | ✅ 100% 保留（feature flag = false 時走 legacy）|
| Provider 行為 | ✅ 程式碼層面審視 OK、待 dev 環境真實測 feature flag = true |

---

## 5. 啟用 Provider 版本（feature flag）

### Dev / 本地測試
```bash
echo "VITE_USE_GLOBAL_WS=true" >> .env.local
npm run dev
# 開瀏覽器看 admin/multi-sessions 確認 ws 連線數從多條 → 1 條
```

### 生產灰度發布（建議流程）
1. 第 1 天：開 1 個小場域（如 testing field）
   ```
   VITE_USE_GLOBAL_WS=true（build 時注入）
   ```
2. 第 2 天：看 Phase 0 觀測數據（admin/multi-sessions / replay）
   - ws 連線數應從多條變 1 條
   - reconnect / grace 觸發次數應降低
   - 無新異常
3. 第 3 天：開 jiacun
4. 第 4 天：開全場域

### 出事回退
```bash
# 移除 env var 或設 false
unset VITE_USE_GLOBAL_WS
# 重 build + 部署
docker compose -f docker-compose.prod.yml up -d --build app
```

---

## 6. 已知限制（Phase 2 處理）

- ChatPanel 仍用獨立 ws（沒接 Provider）→ Phase 2 會合併
- useHostScreenSync 仍用獨立 ws（猜謎用）→ Phase 2 會合併
- useTeamShootingSync 仍用獨立 ws → Phase 2 會合併

→ **Phase 1 + Phase 2 完成後**才能真正達成「1 user = 1 條 ws」

---

## 7. 風險與緩解

| 風險 | 緩解 |
|------|------|
| Provider 版有 edge case 未發現 | feature flag 預設 OFF、灰度開啟、出事 env var 切回 |
| 不同 user 在同 app 內切換（如 logout/login）| `acquire(config)` 偵測 config 變動會自動重連 |
| Provider 內部記憶體洩漏（handlersRef Set）| `subscribe` 回傳 unsubscribe、useEffect cleanup 自動清 |
| 多個 hook 同時 acquire 不同 user | 不會發生（同 app 同時只有一個 user）、保險起見 acquire 內部判定 sameUser 才 no-op |

---

## 8. 下一步

→ Phase 2：合併另外 3 條 ws（useHostScreenSync / useTeamShootingSync / ChatPanel）
   - 順便補 ChatPanel + useHostScreenSync 缺的 reconnect 邏輯（從 Provider 自動繼承）
   - 預估 1.5 天

---

**END Phase 1 — 2026-05-08**
