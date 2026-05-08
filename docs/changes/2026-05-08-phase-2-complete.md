# Phase 2 完成 — 合併 ChatPanel + useHostScreenSync + useTeamShootingSync — 2026-05-08

> 對應規劃：[2026-05-08-multi-stability-refactor-plan.md §5](2026-05-08-multi-stability-refactor-plan.md)
> 狀態：✅ 完成、tsc 0 / smoke 51/51、feature flag 預設 OFF（不影響既有行為）

---

## 1. 範圍

**自寫 WS + 全域單例第 2/3 階段**：把另外 3 條獨立 WS hook 全部接到 Provider。

**完成後達成「1 user = 1 條 ws」**（Phase 1 + Phase 2 全完）

---

## 2. 完成清單

### Provider 擴展（`client/src/contexts/WebSocketContext.tsx`）

新增 2 個公開 API：

**`ensureConnected()`**
- ref counting 確保 ws 已連線
- 多個 hook 呼叫只開 1 條 ws
- release fn = 計數 -= 1（不主動關 ws、Provider 全期間保留）

**`registerOnConnect(key, handler)`**
- 註冊 ws 連到 OPEN 時要發的 join 訊息
- key dedupe（同 hook 重複註冊只保留最新）
- 重要：**reconnect 後也會自動重發**（解原 ChatPanel / useHostScreenSync 缺 reconnect 邏輯的問題）
- 若 ws 已 OPEN 立即執行一次（補 hook mount-after-connect 場景）

### ChatPanel 改造（`client/src/components/shared/ChatPanel.tsx`）

- 加 feature flag 分流：`USE_GLOBAL_WS_PROVIDER`
- Provider 版：`ensureConnected()` + `registerOnConnect()` + `subscribe()`
  - 自動繼承 Provider 的 reconnect / keepalive / visibilitychange
  - 元件 unmount 不關 ws（Provider 保留）
- Legacy 版：完全保留原 `new WebSocket()` 實作（feature flag = false 時用）
- 既有功能 100% 保留：文字 / 圖片 / 貼圖 / 連線狀態 UI
- isWsConnected 訊號：Provider 版用 `wsProvider.isConnected`、Legacy 版用本地 state

### useHostScreenSync 改造（`client/src/components/game/shared/hooks/useHostScreenSync.ts`）

- 兩個 hook 都拆 Legacy + Provider 版：
  - `useHostScreenSync` (基本版)
  - `useHostScreenSyncWithPulse` (進階版、TriviaShowdown 猜謎用)
- Provider 版：
  - `ensureConnected()` + `registerOnConnect()` 發 `host_screen_register`
  - `subscribe()` 收 `host_screen_state` / `host_screen_error` / `host_screen_pulse`
  - 大螢幕端 `onPulse` 計算新 state → `wsApi.send()` 廣播
- 順便補修：原 hook 缺 reconnect、現在 Provider 自動處理

### useTeamShootingSync 改造（`client/src/components/game/shared/hooks/useTeamShootingSync.ts`）

- 加 Provider 分支：`ensureConnected()` + `registerOnConnect()` + `subscribe()`
- Provider 版收 `shooting_hit` 事件、丟進 `wsHitsRef` + `setTeamHits`
- 同步 `isConnected` 從 Provider state
- Legacy 版完全保留（含 reconnect 邏輯、MAX_RECONNECT_ATTEMPTS）

---

## 3. 「1 user = 1 條 ws」達成驗證

### Phase 1 + Phase 2 完成後（feature flag = true）

```
玩家 Hung 在賈村猜謎遊戲頁（同時開 chat panel）
   │
   📱 瀏覽器只開 1 條 ws：
   │
   └─ WebSocketProvider（App 層）
        ├─ useTeamWebSocket    ──┐
        ├─ useHostScreenSync   ──┤
        ├─ useTeamShootingSync ──┼─ 全部 ensureConnected() 同一條
        └─ ChatPanel           ──┘
        
🖥️ Server 看：Hung 只有 1 條 ws
   join messages 自動 register、reconnect 後重發
```

### Phase 1 之前（feature flag = false 或未啟用）

```
玩家 Hung → 4 條獨立 ws（行為完全不變、所以 51/51 e2e 通過）
```

→ feature flag 控、可立即灰度切換或 revert。

---

## 4. 功能對照表（重要 — 確認功能不減少）

### ChatPanel
| 功能 | Legacy | Provider | 等價 |
|------|--------|----------|------|
| WS join 訊息（type=join, sessionId, userId, userName）| ✅ | ✅（registerOnConnect）| ✅ |
| 收 type=chat 廣播 → invalidate query | ✅ | ✅ | ✅ |
| isWsConnected 狀態 | ✅（本地 state）| ✅（Provider state）| ✅ |
| reconnect | ❌ 無 | ✅ Provider 提供 | **改善** |

### useHostScreenSync (基本版)
| 功能 | Legacy | Provider | 等價 |
|------|--------|----------|------|
| host_screen_register 訊息 | ✅ | ✅ | ✅ |
| hostToken 帶入 | ✅ | ✅ | ✅ |
| host_screen_state 訂閱 | ✅ | ✅ | ✅ |
| host_screen_error 處理 | ✅ | ✅ | ✅ |
| sendPulse | ✅ | ✅ | ✅ |
| broadcastState | ✅ | ✅ | ✅ |
| reconnect | ❌ 無 | ✅ Provider 提供 | **改善** |

### useHostScreenSyncWithPulse (進階版)
| 功能 | Legacy | Provider | 等價 |
|------|--------|----------|------|
| 同基本版 | ✅ | ✅ | ✅ |
| 大螢幕端 onPulse 處理玩家 pulse | ✅ | ✅ | ✅ |
| 自動 broadcast 新 state | ✅ | ✅ | ✅ |
| onPulseRef 避免重連 | ✅ | ✅ | ✅ |
| reconnect | ❌ 無 | ✅ Provider 提供 | **改善** |

### useTeamShootingSync
| 功能 | Legacy | Provider | 等價 |
|------|--------|----------|------|
| WS join 訊息 | ✅ | ✅ | ✅ |
| shooting_hit 訂閱 + parse | ✅ | ✅ | ✅ |
| timestamp 去重 | ✅ | ✅ | ✅ |
| DB polling fallback（10s）| ✅（不變）| ✅（不變）| ✅ |
| isConnected | ✅ | ✅（Provider state）| ✅ |
| reconnect 機制 | ✅（自寫 exp backoff、max 5）| ✅ Provider 提供（更通用）| ✅ |

→ **所有功能均完整保留 + 額外修補了 ChatPanel / useHostScreenSync 缺的 reconnect**

---

## 5. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠（feature flag 預設 OFF）|
| Provider 版本 manual 測 | ⏸️ 待 dev 環境設 `VITE_USE_GLOBAL_WS=true` 真實測 |
| 既有行為 | ✅ 100% 保留（feature flag = false 時走 Legacy）|

---

## 6. 已知限制（Phase 3 處理）

- 仍有 feature flag 雙路徑（Legacy + Provider）→ Phase 3 移除 flag、清理 Legacy code
- 真實多人 e2e 測試還沒寫 → Phase 3 補
- ADR-0018 規範還沒寫 → Phase 3 補

---

## 7. 啟用測試（dev 環境）

```bash
echo "VITE_USE_GLOBAL_WS=true" >> .env.local
npm run dev
# 開 admin/multi-sessions 看 ws 連線數應從多條變 1 條
# 開 admin/sessions/:id/replay 看 connect/close 事件分布
```

驗證重點（Provider 版開啟後）：
- [ ] 進入多人遊戲頁、ws 連線數 = 1
- [ ] 切到大廳再回來、ws 不應 close
- [ ] ChatPanel 鎖屏 5 秒回來、訊息不漏（Provider 自動重連）
- [ ] 猜謎答題、所有玩家分數一致
- [ ] 射擊命中、即時同步

---

## 8. 下一步

→ Phase 3：移除 feature flag + 清理 Legacy + 寫真實多人 e2e + ADR-0018
   - 預估 0.5 天

---

**END Phase 2 — 2026-05-08**
