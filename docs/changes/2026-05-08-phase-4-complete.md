# Phase 4 完成 — TriviaShowdown server-side scoring — 2026-05-08

> 對應規劃：[2026-05-08-multi-stability-refactor-plan.md §7](2026-05-08-multi-stability-refactor-plan.md)
> ADR-0018 規則 4：計分 / 排名 / 結算結果 → server-side source-of-truth
> 狀態：✅ 完成、tsc 0 / smoke 51/51 / ADR-0018 通過

---

## 1. 範圍

**架構重構主軸結束後的最後一塊拼圖**：解決「猜謎不公平」原因。

### 問題

Phase 1-3 已完成「1 user = 1 條 ws」、但 TriviaShowdown 的計分仍在 **client 端**：
- 玩家送 `host_screen_pulse` ws 訊息
- 大螢幕 host 端 `onPulse` 自己算「我是第幾個答對」
- 算完透過 broadcastState 送回給所有 client

問題：
- ws 廣播漏 1 個 = 排名不一致
- 不同 client 看到不同分數 = **不公平**
- 即使 1 user = 1 ws、ws 訊息順序仍可能跨設備抖動
- 沒有 source-of-truth、爭議仲裁無依據

### 解決

server-side scoring：
- 玩家答題直接 POST `/api/trivia/:sessionId/answer`
- server 寫 DB + 計算 rank（同 question 之前答對的人數 + 1）+ 算 score
- server `broadcastToHostSession` 送 `host_screen_state` 訊息
- 所有 client 收到同一個 state（從 DB 算的）→ **絕對一致**

---

## 2. 完成清單

### Schema（`shared/schema/trivia-answers.ts`）

```ts
trivia_answers: {
  id, sessionId, questionId, userId, userName,
  choice, isCorrect,
  rankAtCorrect,    // 答對排名（第 1 / 2 / 3...）；答錯為 null
  scoreAwarded,     // 0 或依 scoreByRank
  answeredAt,
}
```

- unique constraint：同 `(sessionId, questionId, userId)` 只能 1 次（防重複作答）
- 3 個 indexes：unique / sessionIdx / sessionQIdx
- Zod request schema 給 API 用

### Migration（`migrations/manual/2026-05-08-trivia-answers.sql`）

- 表 + indexes 建立
- dev DB 已 applied

### Server endpoint（`server/routes/admin-trivia.ts`、~140 行）

**`POST /api/trivia/:sessionId/answer`**：
1. 驗證 zod schema
2. 檢查同 user 同 question unique constraint（已答則 409）
3. 計算 rank（答對時 = 同 question 之前答對的人數 + 1）
4. 計算 score（依 `scoreByRank[rank-1]`、預設 [100, 75, 50, 25]）
5. INSERT trivia_answers
6. 從 DB 重組 SessionTriviaState（answered + scores）
7. `broadcastToHostSession` 送 `host_screen_state` 訊息給該 session 所有 client

**`GET /api/trivia/:sessionId/state`**：
- 回傳整 session 的 answered + scores
- reconnect / replay 用

### Client 改造

**`client/src/components/game/host/TriviaShowdown.tsx`**：
- props 加 `sessionId` + `myUserId`
- `handleAnswer` 改成 async：
  - 主路徑：POST `/api/trivia/:sessionId/answer`
  - Fallback：缺 sessionId/userId 時走原 ws pulse（dev / 測試環境）

**`client/src/components/game/host/TriviaShowdownPage.tsx`**：
- 移除 `handlePulse` 整段 client 端計分邏輯（-50 行）
- 從 `useHostScreenSyncWithPulse` 改用 `useHostScreenSync`（基本版、不需 onPulse）
- 加 `parseSessionIdFromUrl()` 自己 parse（避免改 hook 介面）
- 從 `useAuth()` 拿 myUserId
- 傳 `sessionId` + `myUserId` 給 `TriviaShowdown` 元件

---

## 3. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠 |
| `bash scripts/check-ws-singleton.sh` | ✅ ADR-0018 通過 |
| dev DB migration | ✅ applied |
| 既有 ws 行為 | ✅ 不變（broadcastToHostSession 既有 helper）|
| 部署可逆性 | 100%（移 endpoint + revert client = 完全恢復）|

---

## 4. 爭議仲裁（業務價值）

### 場景：媽媽問「我兒子那場明明答對 q3、為什麼沒分數」

**Admin 操作流程**：

1. 進 `/admin/multi-sessions/:sessionId/replay`（Phase 0.3）
2. 篩選：玩家 = 兒子
3. 看 ws_event_log 中 `host_screen_state` 廣播事件 + DB 直接查 trivia_answers：
   ```sql
   SELECT * FROM trivia_answers
   WHERE session_id = '...' AND user_id = '...';
   ```
4. 看到：
   - 14:25:30.123 user=hung_son questionId=q3 choice=2 isCorrect=false（答錯）
   - 14:25:31.456 user=hung_son questionId=q4 choice=1 isCorrect=true rankAtCorrect=2 scoreAwarded=75
5. 結論：q3 答錯（選 2 但 correctIdx 是 0）、q4 答對拿 75 分（第 2 個答對）

**證據級紀錄**：
- DB 含完整答題歷史（毫秒精度）
- 不可篡改（INSERT 後不修改）
- 業主 / 家屬都能看依據

---

## 5. 部署提示（生產）

### 必要動作
1. 套用 migration：
   ```bash
   ssh root@172.233.89.147
   cd /www/wwwroot/game.homi.cc
   docker exec -i gamehomicc-db-1 psql -U postgres -d gameplatform < migrations/manual/2026-05-08-trivia-answers.sql
   ```
2. 部署：
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build app
   ```

### 部署後驗證（必做）
1. 進 admin 開新 host session（猜謎類型）
2. 玩家進場、按 A/B/C/D 選項答題
3. 大螢幕 host 端應看到分數即時更新
4. 進 `/admin/sessions/:sessionId/replay` 看 host_screen_state 廣播事件
5. 直接 SQL 查 trivia_answers 驗證紀錄

---

## 6. 已知限制

- TriviaShowdown 元件其他狀態（如 currentQuestionIdx / status / questionStartedAt）仍由大螢幕 host 端 `onBroadcastState` 控制（保留既有行為）
- 只有「答題計分」改成 server-side、其他控制流程不變
- 大螢幕端 reconnect 後可呼 `GET /api/trivia/:sessionId/state` 補回 answered + scores
- 玩家端目前沒實作 reconnect 後 GET state（依賴 server broadcast、若漏接需要刷新）

---

## 7. 完整重構里程碑（Phase 0-4）

| Phase | 範圍 | 行數變化 | Commit |
|-------|------|----------|--------|
| 0.1 | admin/multi-sessions 即時 UI | +1122 | `13d1c594` |
| 0.2 | ws_event_log + 90 天 retention | +828 | `a8a9d27c` |
| 0.3 | Session Replay UI（爭議仲裁）| +990 | `57b89812` |
| 1 | WebSocketProvider | +569 | `0cb06f09` |
| 2 | 合併 3 條 ws | +180 | `d268f351` |
| 3 | 清理 + ADR-0018 + e2e | +630 / -700+ | `66be6625` |
| **4** | **TriviaShowdown server-side scoring** | (此次) | (即將) |

**業主能力總結**：
1. 即時觀測 admin/multi-sessions
2. 完整事件 log 90 天 retention
3. Session Replay + CSV 匯出（爭議仲裁）
4. 進入遊戲不斷線、對講機自動重連、猜謎一致
5. CI 規範防回頭
6. **猜謎絕對公平（server-side source-of-truth）** 🎉

---

**END Phase 4 — 2026-05-08**
**END 全套架構重構（Phase 0 + 1 + 2 + 3 + 4）— 2026-05-08**
