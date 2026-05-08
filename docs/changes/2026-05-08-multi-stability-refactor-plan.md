# 多人遊戲穩定性完整重建計劃 — 2026-05-08

> **狀態**：📋 規劃中（待 user 確認後啟動 loop 執行）
> **目標**：自寫 WS + 全域單例 + 完整監測 + 規範訂定，徹底解決多人遊戲斷線/不同步問題
> **總工**：9-10 天（Phase 0 監測 5 天 + Phase 1-4 重構 4-5 天）
> **不變項**：60 個 multi 元件功能不減少、不簡略
> **基於**：[2026-05-08 v2 audit](2026-05-08-multi-stability-audit-v2.md) + 實機測試發現

---

## 1. 背景

### 1.1 真實事件

2026-05-08 user 實機測試 multi 遊戲、回報三個現象：

1. 多人遊戲容易斷線 — 「組隊成功但一進入開始遊戲就會分別斷線」
2. 對講機（ChatPanel）容易斷 — 「對講機也是容易進入遊戲隊友就離線」
3. 多人猜謎（TriviaShowdown）不同步 — 「多人遊戲猜謎需要同步不然不公平」

### 1.2 根因（架構性、非個別 bug）

Client 端**有 4 條獨立 WebSocket 連線**（同玩家同時開）：

| Hook | 各自 `new WebSocket()` | reconnect | 計分 source-of-truth |
|------|---------------------|-----------|---------------------|
| `useTeamWebSocket` | ✅ | ✅ exp backoff | DB |
| `useHostScreenSync`（猜謎用）| ✅ | ❌ 沒有 | **client 端算** |
| `useTeamShootingSync` | ✅ | 條件式 | DB |
| `ChatPanel`（對講機）| ✅ | ❌ 沒有 | — |

**演進軌跡**（git log 拉出來）：
- 2026-02-06：初始提交（useTeamWebSocket + ChatPanel）
- 2026-05-02 一週：Phase 2 多人元件爆發、密集加 useHostScreenSync + useTeamShootingSync
- 結果：每個 hook 各自 `new WebSocket()`、共 4 條獨立連線

→ 這是典型 SaaS growing pains（Slack / Discord / Figma 都有同樣歷程）。

### 1.3 為什麼治本路徑 = 自寫 WS + 全域單例

| 替代方案 | 為什麼不選 |
|---------|-----------|
| Supabase Realtime | 要遷部分 DB、雙頭管理、月費 $25+ |
| Liveblocks | vendor lock-in、收費按 MAU、量起來貴 |
| Pusher / Ably | 同樣月費 + 自管 server 仍要、雙重成本 |
| **自寫 + 單例** | ✅ 完全掌控、零月費、爭議仲裁可拿 raw log |

---

## 2. 不變項（功能完整性保證）

### 2.1 紅線 — 重構過程絕對不可變動

1. ❌ **不減少功能** — 60 個 multi 元件每一個的玩家可見行為都要保留
2. ❌ **不簡略訊息類型** — 現有 ws 訊息類型全保留（team_member_joined / team_score_update / host_screen_pulse 等）
3. ❌ **不改業務邏輯** — VoteTeam 投票、ChoiceVerifyRace 競賽、TriviaShowdown 計分等機制不動
4. ❌ **不改 server 廣播 API** — broadcastToTeam / broadcastToSession / broadcastToMatch 等對外介面保持
5. ❌ **不破壞既有 e2e** — 現有 51/51 smoke test 必須繼續通過
6. ❌ **不擅自簡化既有保護機制** — 5 秒 debounce / 30s grace / 120s auto-leave 暫時保留（後續再評估調整）

### 2.2 功能完整性 checklist（Phase 0 前完成、作為驗收依據）

新增 `docs/changes/2026-05-08-feature-checklist.md`，列出：

```markdown
## 60 個 multi 元件功能盤點

### 投票類（VoteTeam）
- [ ] 玩家可投票（majority / unanimous / display 三模式）
- [ ] 玩家投票後 < 1 秒、隊友看到「N/M 已投」
- [ ] 達標後 onComplete 觸發
- [ ] 重連後狀態恢復（票數）
- [ ] team_vote_cast 訊息類型仍存在

### 競速類（ChoiceVerifyRace）
- [ ] 隊伍計分 / 排行榜
- [ ] 答題後 < 1 秒、隊友看到名次更新
- [ ] 重連後分數不歸零
- [ ] team_progress_advance 仍存在

### 對講機（ChatPanel）
- [ ] 文字訊息 < 1 秒同步
- [ ] 圖片 / 貼圖訊息
- [ ] 訊息歷史（reload 後可見）
- [ ] 已讀狀態

... （60 個元件全部列出）

### 4 條 ws hook 功能盤點

#### useTeamWebSocket（覆蓋 81 處）
- [ ] team_join / team_kicked / team_member_disconnected/reconnected/grace_expired
- [ ] team_member_joined / team_member_left
- [ ] team_location / team_vote_cast / team_score_update / team_ready_update
- [ ] game_started / team_progress_advance / team_leader_decide
- [ ] ready_status_changed / 自身被踢 onSelfKicked
- [ ] alsoJoinSessionId（同 ws 加入 session room）
- [ ] visibilitychange 即時重連
- [ ] 25 秒 client keepalive
- [ ] exp backoff 1s→2s→4s→8s→16s→max 30s
- [ ] reconnect 統計（disconnect/success/fail count）
- [ ] reportClientEvent 上報

#### useHostScreenSync（猜謎、主持人模式）
- [ ] host_screen_register（host vs player role）
- [ ] hostToken 驗證
- [ ] host_screen_state 廣播狀態
- [ ] host_screen_pulse 互動訊息
- [ ] state 同步機制

#### useTeamShootingSync（射擊用）
- [ ] hits 累計
- [ ] 隊伍排行
- [ ] DB UNIQUE 約束（同次擊發不重複計分）

#### ChatPanel（對講機）
- [ ] WS 通知 + REST 雙路徑
- [ ] 連線狀態 UI
```

---

## 3. Phase 0：完整監測體系（5 天、必做、零風險）

### 3.1 三層監測架構

```
🔴 Layer 1：即時觀測（admin/multi-sessions UI）
  └─ 業主即時看：N 場 session、每場誰在線、誰最近斷
     用途：活動進行中、發現異常立即介入

🟠 Layer 2：完整事件 log（ws_event_log + db_write_log）
  └─ 每個 ws message + DB 寫入 + 玩家動作 全記
     用途：scrub 任何時間點的真實狀況、爭議仲裁依據

🟢 Layer 3：Session Replay（時間軸重播 UI）
  └─ admin 點 session → 完整時間軸 + 篩選
     用途：媽媽問「為什麼我兒子那組沒拿獎」→ 給她看時間戳
```

### 3.2 Phase 0.1 admin/multi-sessions UI（1 天）

**前置**：v2 audit A5 endpoint `/api/admin/multi-sessions` 已存在、缺 UI。

**檔案**：
- `client/src/pages/admin/AdminMultiSessions.tsx` — 主頁（500 行內）
- `client/src/components/admin/multi-sessions/SessionCard.tsx` — 單場卡片
- `client/src/components/admin/multi-sessions/PlayerList.tsx` — 玩家在線列表
- `client/src/config/admin-menu.ts` — 加「📡 即時連線監控」項
- `client/src/App.tsx` — 加 `/admin/multi-sessions` route + lazy import

**UI 內容**：
| 欄位 | 顯示 |
|------|------|
| Session ID | hash + 場域 + 開始時間 |
| Active Members | N 人在線 / M 總人數 |
| 連線狀態 | 在線 / 暫離（grace 中）/ 已 left |
| 最近斷線 | 最近 5 分鐘 disconnect 次數 |
| 平均延遲 | ws ping/pong 平均往返 |
| Reconnect rate | 過去 1 小時重連次數 |

**驗收**：
- [ ] admin 進 `/admin/multi-sessions` 可看 active sessions 列表
- [ ] 點任何 session 可看玩家在線狀態 + reconnect 統計
- [ ] 5 秒自動 refresh
- [ ] tsc 0 errors
- [ ] 不影響既有 admin 頁面

### 3.3 Phase 0.2 ws_event_log + db_write_log（2 天）

**新表 schema**（`shared/schema/observability.ts`）：

```ts
export const wsEventLog = pgTable("ws_event_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  sessionId: text("session_id"),         // 可能 null（session 前事件）
  teamId: text("team_id"),
  userId: text("user_id"),
  eventType: text("event_type").notNull(), // join/close/message/broadcast/error/grace/auto_leave
  direction: text("direction"),           // inbound（client→server）/ outbound（server→client）
  messageType: text("message_type"),      // team_join/team_score_update/...
  payload: jsonb("payload"),              // 完整訊息內容（敏感欄位 redact）
  clientIp: text("client_ip"),
  userAgent: text("user_agent"),
  reason: text("reason"),                 // close 原因 / error 內容
  latencyMs: integer("latency_ms"),       // ping/pong 往返
}, (t) => ({
  sessionIdx: index("ws_event_session_idx").on(t.sessionId, t.timestamp),
  userIdx: index("ws_event_user_idx").on(t.userId, t.timestamp),
  cleanupIdx: index("ws_event_cleanup_idx").on(t.timestamp), // 7 天 retention
}));

export const dbWriteLog = pgTable("db_write_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  tableName: text("table_name").notNull(),
  operation: text("operation").notNull(), // insert/update/delete
  primaryKey: text("primary_key"),
  userId: text("user_id"),
  sessionId: text("session_id"),
  teamId: text("team_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  conflictType: text("conflict_type"),    // optimistic_lock_409 等
}, (t) => ({
  sessionIdx: index("db_write_session_idx").on(t.sessionId, t.timestamp),
  cleanupIdx: index("db_write_cleanup_idx").on(t.timestamp),
}));
```

**Server hook 點**：
1. `server/routes/websocket.ts`：
   - `wss.on("connection")` → log `event_type=connect`
   - `ws.on("message")` → log `event_type=message inbound`
   - `ws.on("close")` → log `event_type=close + reason`
   - `broadcastToXxx()` 每呼叫 → log `event_type=broadcast outbound`
   - `startGraceTimer` → log `event_type=grace_started`
   - 寬限期到 → log `event_type=grace_expired`
2. `team_game_states / team_lock_states` 樂觀鎖衝突 → `db_write_log` + `conflictType="optimistic_lock_409"`

**Retention cron**（user 決定 90 天長期仲裁）：
- 每天 03:00 跑 cleanup、刪 90 天前資料
- **表分區策略**：用 PostgreSQL declarative partitioning by day（避免單表過大）
  - 刪舊資料 = `DROP PARTITION` 秒級完成（不是 DELETE）
  - 每日新建明日 partition
- 表大小監控：> 50GB 警示 Telegram（評估是否轉冷儲存）
- 預估量：100 人/天 × 1000 events/人 = 100 萬 events/天 ≈ 1GB/天 × 90 天 ≈ 90GB

**敏感資料處理**（user 決定預設不記錄對講機）：
- `payload.message` 對講機文字 → **預設不存**（只存 `payload.length` + 時間 + 作者）
- admin opt-in 開關「啟用對講機完整紀錄」（爭議仲裁需要時可開）
- 敏感欄位 redact（password / token / firebase token / 信用卡）

**驗收**：
- [ ] 玩家 join → ws_event_log 看得到 connect 事件
- [ ] 玩家答題 → 完整訊息流（inbound + broadcast outbound × N）
- [ ] DB 寫入 → db_write_log 看得到 before/after
- [ ] 樂觀鎖衝突 → 記錄到 conflictType
- [ ] Retention cron 跑、7 天前資料被清
- [ ] 表大小 < 1GB（負載測試）

### 3.4 Phase 0.3 Session Replay UI（2 天）

**檔案**：
- `client/src/pages/admin/AdminSessionReplay.tsx` — 主頁
- `client/src/components/admin/replay/Timeline.tsx` — 時間軸視覺化
- `client/src/components/admin/replay/PlayerFilter.tsx` — 玩家篩選
- `client/src/components/admin/replay/EventDetail.tsx` — 事件展開

**Server endpoint**：
- `GET /api/admin/sessions/:sessionId/replay?from=&to=&userId=&eventType=`
- `GET /api/admin/sessions/:sessionId/export.csv` — 匯出 CSV 給業主存檔

**UI 功能**：
- 時間軸（縱軸 = 時間、橫軸 = 玩家）
- 顏色標記事件類型（綠 = 正常、橘 = grace、紅 = error/disconnect）
- 點任何事件 → 展開完整 payload
- 篩選：時間範圍 / 玩家 / 訊息類型 / 只看異常
- 匯出 CSV / JSON

**爭議仲裁案例**：
> 媽媽：「我兒子那場明明答對了 q3、為什麼沒分數？」
>
> Admin 流程：
> 1. 進 `/admin/multi-sessions/{sessionId}/replay`
> 2. 篩選：玩家 = 兒子
> 3. 看 q3 時間軸：14:25:30.123 收到 answer 訊息、14:25:30.124 server validate fail（reason: invalid_choice_index）
> 4. 結論：兒子點到非 4 個選項之外的座標、計分系統正確拒絕
> 5. 給媽媽看截圖、有依據

**驗收**：
- [ ] admin 可進任何 session 的 replay 頁
- [ ] 時間軸視覺化清楚
- [ ] 篩選功能完整
- [ ] CSV 匯出有用（業主可存檔）
- [ ] 大 session（1000+ 事件）載入 < 3 秒（pagination 或 virtual scroll）

### 3.5 Phase 0 完整驗收

- [ ] 真實 5 人多人 e2e 測試一場、log 完整存進 DB
- [ ] 故意斷線（手機飛航模式 5 秒）→ ws_event_log 看得到完整 disconnect/reconnect 鏈
- [ ] 故意製造爭議（同時搶答）→ replay 可清楚看誰先
- [ ] CHANGELOG 加版本紀錄
- [ ] 部署生產 + 跑一場真實活動 + 檢查 log

---

## 4. Phase 1：建 WebSocketProvider + useTeamWebSocket 改用（1.5 天）

### 4.1 設計

```ts
// client/src/contexts/WebSocketContext.tsx (新檔)
interface WSContextValue {
  ws: WebSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  // subscribe/unsubscribe — 多個 hook 共用同一 connection
  subscribe: (handler: (msg: TeamMessage) => void) => () => void;
  send: (msg: object) => boolean;
  // 統一 reconnect 統計
  stats: { connectAt: number; disconnectCount: number; ... };
}

export function WebSocketProvider({ children }: PropsWithChildren) {
  // App 層唯一 ws 連線
  // 包含原 useTeamWebSocket 的 reconnect / keepalive / visibilitychange 邏輯
  // 多個 subscriber 透過 callbackSet 廣播
}

export function useWebSocket() {
  return useContext(WSContext);
}
```

### 4.2 Feature flag 機制

```ts
// shared/feature-flags.ts
export const FEATURE_FLAGS = {
  USE_GLOBAL_WS_PROVIDER: process.env.NEXT_PUBLIC_USE_GLOBAL_WS === "true",
};

// useTeamWebSocket 內部
if (FEATURE_FLAGS.USE_GLOBAL_WS_PROVIDER) {
  return useTeamWebSocketViaProvider(opts); // 新行為
}
return useTeamWebSocketLegacy(opts); // 舊行為
```

→ 出問題立即 `NEXT_PUBLIC_USE_GLOBAL_WS=false` revert。

### 4.3 改造範圍

- **新增**：`WebSocketProvider`、`useWebSocketViaProvider` 內部實作
- **修改**：`useTeamWebSocket` 加 feature flag 分支
- **不改**：59 個 multi 元件的呼叫方式（保持 useTeamWebSocket signature）

### 4.4 驗收

- [ ] feature flag = false：完全等同舊行為（51/51 e2e 通過）
- [ ] feature flag = true：5 人 e2e 通過 + Phase 0 觀測看 ws 連線數從每用戶多條→1 條
- [ ] Phase 0 reconnect 統計：誤判離線次數從 X → 0
- [ ] tsc 0 errors

---

## 5. Phase 2：合併其他 3 條 WS hook（1.5 天）

### 5.1 改造對象

| Hook | 改造方向 |
|------|---------|
| `useHostScreenSync` | 改用 Provider connection、加 reconnect 邏輯 |
| `useTeamShootingSync` | 改用 Provider connection |
| `ChatPanel` | 改用 Provider connection、加 reconnect |

### 5.2 對講機 ChatPanel 重點

- ChatPanel 既有功能完整保留：文字 / 圖片 / 貼圖 / 已讀
- ChatPanel 內部 `new WebSocket()` 移除、改 `useWebSocket()`
- 訊息類型 `chat` 訂閱透過 Provider subscribe

### 5.3 猜謎 useHostScreenSync 重點

- `host_screen_register / host_screen_state / host_screen_pulse` 全部訊息類型保留
- hostToken 驗證流程不動
- 加上 reconnect（從 Provider 自動繼承）

### 5.4 驗收

- [ ] 對講機可正常傳訊息（文字 + 圖片 + 貼圖）
- [ ] 對講機鎖屏 5 秒回來、訊息不漏
- [ ] 猜謎 5 人 e2e 通過、計分一致
- [ ] Phase 0 觀測：1 user = 1 ws connection
- [ ] 51/51 既有 e2e 通過

---

## 6. Phase 3：清理 + 真實多人 e2e（0.5 天）

### 6.1 清理

- 移除 `FEATURE_FLAGS.USE_GLOBAL_WS_PROVIDER`（兩條分支合一）
- 刪除 `useTeamWebSocketLegacy`
- 刪除 ChatPanel / useHostScreenSync / useTeamShootingSync 內部 `new WebSocket()`
- grep 確認 client 端只剩 1 處 `new WebSocket()`

### 6.2 新增 e2e 測試

`tests/e2e/global-ws-provider.spec.ts`：
- 玩家從 lobby 進 game page → ws 不應 close
- 玩家從 game page A 切到 game page B → ws 不應 close
- 玩家手機鎖屏 30 秒 → ws 重連 + Phase 0 觀測看到 1 條 reconnect
- 玩家被網路斷 5 分鐘 → grace 機制觸發、其他人看到狀態
- 5 人同時進入猜謎、答題、結算分數一致

### 6.3 驗收

- [ ] grep `new WebSocket(` in client/src — 結果只 1 處（Provider 內）
- [ ] 新 e2e 全綠
- [ ] 51/51 既有 e2e 通過
- [ ] Phase 0 觀測：所有 production 玩家連線數 = 1

---

## 7. Phase 4：TriviaShowdown server-side scoring（0.5 天）

### 7.1 問題

目前計分在 client 端算（`TriviaShowdownPage` line 95-101）：
- `host_screen_pulse` 廣播 `answer` 訊息
- 每個 client 各自計算「我是第 N 個答對」
- ws 廣播漏 1 個 = 排名不一致

### 7.2 方案

**新表**：

```ts
export const triviaAnswers = pgTable("trivia_answers", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  questionId: text("question_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  choice: integer("choice").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  scoreAwarded: integer("score_awarded").notNull(),
  rankAtCorrect: integer("rank_at_correct"),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
}, (t) => ({
  unique: uniqueIndex("trivia_session_q_user").on(t.sessionId, t.questionId, t.userId),
  // 同 user 同 question 只能答 1 次
}));
```

**新 endpoint**：
- `POST /api/trivia/:sessionId/answer` — 寫 DB + 計分 + 廣播結果
- `GET /api/trivia/:sessionId/scores` — 取目前分數（reconnect / replay 用）

**改造**：
- `TriviaShowdownPage` 不再 client 算分
- 改：發 POST 給 server、server 寫 DB、server 廣播 `trivia_answered`（含 rank + score）
- 所有 client 收到 broadcast → 從 server 結果同步 UI

### 7.3 驗收

- [ ] 5 人 e2e 同時搶答、所有 client 看到一致結果
- [ ] 故意 ws 漏一個 broadcast、後續 client query GET /scores 仍能補回
- [ ] DB 內 trivia_answers 紀錄完整（爭議仲裁可查）

---

## 8. 規範文件（讓未來不重蹈覆轍）

### 8.1 ADR-0018：即時通訊架構規範（new）

`docs/decisions/0018-realtime-architecture.md` 規定：

```markdown
## 規範

1. 整個 app 全域只能有 **1 條 WebSocket connection**（透過 WebSocketProvider）
2. 任何新元件需要 ws 通訊 → **必須**透過 useWebSocket() / useTeamWebSocket()
3. **禁止**直接 `new WebSocket()` — CI 會檢查
4. 計分 / 排名 / 結算結果 → server-side source-of-truth、ws 只負責通知
5. ws 訊息類型加新的 → 必須 zod schema 驗證 + ADR-0014 對齊
6. 所有 ws 事件自動進 ws_event_log（可作爭議仲裁依據）
```

### 8.2 CI 檢查（防回頭）

`scripts/check-ws-singleton.sh`：
```bash
# 防止有人寫新的 new WebSocket()
COUNT=$(grep -r "new WebSocket(" client/src --include="*.ts" --include="*.tsx" | grep -v "WebSocketProvider" | wc -l)
if [ $COUNT -gt 0 ]; then
  echo "❌ 偵測到 $COUNT 處非 Provider 的 new WebSocket()、違反 ADR-0018"
  exit 1
fi
```

加進 `.github/workflows/ci.yml`。

### 8.3 CLAUDE.md 紅線增訂

第 13 條（新增）：
> ❌ **禁止建立新的獨立 WebSocket 連線** — 所有即時通訊必須透過 `useWebSocket()` Provider。違反者 CI 阻擋（依 ADR-0018）。

### 8.4 docs/runbooks/incident-response.md 補充

加「多人遊戲斷線排查」章節：
1. 進 admin/multi-sessions 看是否有異常斷線
2. 問題 session → 進 replay 頁
3. 篩選異常事件（disconnect/error）
4. 比對 ws_event_log + db_write_log 找根因
5. 業主溝通範本（給家屬 / 客戶看時間戳）

---

## 9. 接地驗證機制（基於 ADR-0017）

### 9.1 Loop 護欄（重構場景客製化）

ADR-0017 原規則：每 5 輪打開 admin editor 確認新元件可被選用。  
重構場景**改寫為**：

> **每完成 1 個 Phase 必須做接地驗證**：
> 1. 跑 `npx tsc --noEmit` 確認 0 errors
> 2. 跑既有 51/51 smoke test
> 3. 跑真實多人 e2e（最少 3 個元件：VoteTeam + ChoiceVerifyRace + ChatPanel）
> 4. 用 Phase 0 觀測看 ws 連線數變化、確認符合預期
> 5. 對照「功能完整性 checklist」確認沒漏失功能
> 6. 寫進 `docs/changes/{date}-{phase}-complete.md`
>
> **失敗條件**（任一觸發就停 loop 等 user）：
> - tsc 報錯
> - 既有 e2e 變紅
> - 多人 e2e 失敗
> - 觀測數據與預期不符（如 ws 連線數沒變）
> - checklist 有功能漏失

### 9.2 每階段強制 commit

每個 Phase 結束前：
```bash
git add -A
git commit -m "feat(realtime): Phase X — {動作} 完成

紀錄：docs/changes/2026-05-08-multi-stability-refactor-plan.md
驗收：tsc 0 / e2e 51/51 + 新 ws / 觀測數據 ...
```

### 9.3 每階段獨立可 revert

- Phase 0：純加新表 + 新頁、零風險、出事可 drop table + 拔頁
- Phase 1：feature flag 控、出事 env var 切回 false
- Phase 2：同 Phase 1
- Phase 3：清理階段、出事可 git revert
- Phase 4：純加新 endpoint + 新表、舊路徑保留 fallback

---

## 10. 風險矩陣

| 風險 | 機率 | 影響 | 緩解 |
|------|------|------|------|
| 改完仍有偶發斷線 | 中 | 中 | Phase 0 觀測能持續 debug |
| 影響 60 個 multi 元件中某些 edge case | 低 | 大 | 功能 checklist + e2e + feature flag |
| Phase 0 log 表爆量 | 低 | 中 | 7 天 retention + cron + size monitor |
| 真實活動進行中改架構 | — | — | **明確排空窗期、非活動期間執行** |
| Server CPU 因為 log 寫入飆升 | 低 | 中 | 非同步寫、buffer 後 flush、可開關 |

---

## 11. 部署策略

### 11.1 不能在活動進行時改

- 改前先看下週活動排程（從 booking 表查）
- 排空檔（如週二清晨）部署
- 部署前 Telegram 通知

### 11.2 灰度發布

Phase 1-2 用 feature flag 控：
- 第 1 天：開 1 個小場域（如測試用 field）
- 第 2 天：開 jiacun（賈村）
- 第 3 天：開全場域
- 出事任何階段：env var 切回 false

### 11.3 回退預案

- Phase 0：drop new tables、移除 admin 頁、無影響
- Phase 1-3：env var revert、立即生效
- Phase 4：endpoint 保留舊 client 計分為 fallback、出事 client 自動降級

---

## 12. 成功指標（量化）

部署後 1 週對比：

| 指標 | 改前基準（從 Phase 0 收集）| 目標 |
|------|--------------------------|------|
| 同玩家同時 ws 連線數 | 4 | 1 |
| 進入遊戲後 5 秒內被廣播「離線」次數 | TBD（從觀測拿）| 0 |
| 對講機鎖屏後不重連次數 | TBD | 0 |
| 猜謎結算分數不一致投訴 | ≥ 1（user 已遇）| 0 |
| 平均 ws 連線時長 | TBD | ↑ 5 倍以上 |
| Server CPU 平均 | TBD | ↓ 20%+ |

---

## 13. 時程估計

| Phase | 工作量 | 完成日（樂觀） | 完成日（保守）|
|-------|--------|---------------|--------------|
| 規劃確認 | 1 日 | 2026-05-08 | 2026-05-08 |
| Phase 0.1 admin UI | 1 日 | 2026-05-09 | 2026-05-10 |
| Phase 0.2 ws_event_log | 2 日 | 2026-05-11 | 2026-05-13 |
| Phase 0.3 Replay UI | 2 日 | 2026-05-13 | 2026-05-15 |
| **Phase 0 部署 + 驗證** | 1 日 | **2026-05-14** | **2026-05-16** |
| ↑ user 看數據後決定 Phase 1+ | — | — | — |
| Phase 1 Provider | 1.5 日 | 2026-05-16 | 2026-05-18 |
| Phase 2 合併 3 hook | 1.5 日 | 2026-05-18 | 2026-05-20 |
| Phase 3 清理 + e2e | 0.5 日 | 2026-05-19 | 2026-05-21 |
| Phase 4 Trivia server scoring | 0.5 日 | 2026-05-19 | 2026-05-21 |
| **全套完成** | 9-10 日 | **2026-05-19** | **2026-05-21** |

---

## 14. Loop 推進規則（給接續執行者）

當 user 用 `/loop` 啟動執行：

### 規則 A：嚴格按順序
- Phase 0.1 → 0.2 → 0.3 → user 確認 → Phase 1 → 2 → 3 → 4
- **不可跳階段**

### 規則 B：每階段必須完成下列才能進下一階段
1. tsc 0 errors
2. 既有 51/51 e2e 通過
3. 該階段新功能 e2e 通過
4. 功能 checklist 該階段項目打勾
5. Phase 0 觀測對照前後數據（從 Phase 0.2 開始適用）
6. commit + 寫 `docs/changes/{date}-{phase}-complete.md`

### 規則 C：失敗就停 loop
任一驗收條件失敗 → 立即停下、回報 user、不要硬推。

### 規則 D：Phase 0 完成後必須等 user
Phase 0 完成、給 user 看實際數據、user 決定要不要繼續 Phase 1+。

### 規則 E：保留 user 中斷權
user 隨時可以中斷 loop（如有真實活動進行）。

---

## 15. 待 user 確認後執行

### 確認清單
- [ ] 規劃內容是否完整？有沒有遺漏的功能要保留？
- [ ] Phase 順序是否合理？
- [ ] 監測層三層設計是否符合「爭議仲裁」需求？
- [ ] 7 天 retention 是否足夠？要不要延長到 30 天 / 90 天？
- [ ] 對講機完整紀錄要不要預設開？（隱私 vs 仲裁）
- [ ] 部署排空檔有沒有特定日期偏好？
- [ ] 失敗回退機制夠不夠？

### 確認後動作
1. user 說「開始」→ 進 Phase 0.1
2. user 說「先改 X」→ 我調整規劃
3. user 說「等等」→ 我停在這個規劃文件、等下次

---

## 16. 相關文件

- [v2 audit](2026-05-08-multi-stability-audit-v2.md) — 風險定義
- [Phase 1 complete](2026-05-07-phase-1-complete.md) — A1-A5 實作（已完成）
- [ADR-0014](../decisions/0014-realtime-protocol-cleanup.md) — Realtime 協定規範
- [ADR-0015](../decisions/0015-websocket-anonymous-write-policy.md) — WS 匿名寫入政策
- [ADR-0017](../decisions/0017-loop-mode-safeguards.md) — Loop 模式安全護欄
- [ADR-0018（待建）](../decisions/0018-realtime-architecture.md) — 即時通訊架構規範
- [websocket.ts](../../server/routes/websocket.ts) — WS 主檔
- [use-team-websocket.ts](../../client/src/hooks/use-team-websocket.ts) — 主 ws hook

---

**END Refactor Plan v1 — 2026-05-08**
