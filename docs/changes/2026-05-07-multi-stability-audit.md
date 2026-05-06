# 多人遊戲穩定度深度分析 — 2026-05-07

> 範圍：13 個 multi 元件 + L3 持久化機制 + WebSocket 廣播契約 + e2e 覆蓋率
> 狀態：研究報告（純分析、不寫 code）
> 來源檔案：fork audit 結果

---

## TL;DR — 三大風險

1. 🔴 **`team_lock_states` 沒有 version 欄位、樂觀鎖缺失** → LockCoop 多人同時輸入會互相覆寫
2. 🔴 **`useTeamGameState` 樂觀鎖在 client 端遞增 version** → 兩玩家同時送同 version、後到者 server 靜默拒絕，client UI 顯示已成功實際沒寫入
3. 🔴 **`GpsTeamMission` 完全沒有持久化** → 重整後本地進度歸零（甚至有玩家活動到一半看到「重來了」）

---

## 元件 → Hook 對應表

| 元件 | 持久化 hook | 後端表 | 樂觀鎖 | 風險 |
|------|------------|-------|--------|------|
| LockCoop | useTeamLockCoopSync | team_lock_states（自表）| ❌ 無 version | 🔴 R1 R5 |
| RelayMission | useTeamRelaySync → useTeamGameState | team_game_states | ⚠️ client++ | 🟡 R6 |
| TerritoryCapture | useTeamTerritorySync | team_game_states（per-team snapshot）| ⚠️ client++ | 🔴 R3 |
| VoteTeam | useTeamVoteSync | team-votes（自表）| ✅ DB 端 | 🟢 |
| ShootingTeam | useTeamShootingSync | team_shooting_hits | ✅ DB UNIQUE | 🟢 |
| GpsTeamMission | （無持久化）| — | — | 🔴 R4 |
| ChoiceVerifyRace | （無 client hook、自寫 server-driven）| team_race_states + answers | ✅ conditional UPDATE | 🟢 設計最完整 |
| CollectiveScore | useTeamPagePersistence → useTeamGameState | team_game_states | ⚠️ client++ | 🟡 R6 |
| RoleAssign | useTeamPagePersistence | team_game_states | ⚠️ client++ | 🟡 R6 |
| QuestChain | useTeamPagePersistence | team_game_states | ⚠️ client++ | 🟡 R6 |
| JigsawPuzzle | useTeamPagePersistence | team_game_states | ⚠️ client++ | 🟡 R6 |
| TreasureHunt | useTeamPagePersistence | team_game_states | ⚠️ client++ | 🟡 R6 |
| GpsCascade | useTeamPagePersistence | team_game_states | ⚠️ client++ | 🟡 R6 |

---

## 詳細風險清單

### 🔴 高風險 — 客戶活動會炸

#### R1: `team_lock_states` 沒有 version 欄位（LockCoop）
**檔案**：`server/routes/team-lock-coop.ts:17-35`、`shared/hooks/useTeamLockCoopSync.ts`

**現況**：
```sql
CREATE TABLE team_lock_states (
  team_id, session_id, page_id,
  shared_code, attempts, is_unlocked, is_failed,
  updated_at  -- ❌ 缺 version 欄位
)
```
POST `/api/team-lock-coop/update` action="code" 直接 `UPDATE team_lock_states SET shared_code=...`、無樂觀鎖。

**風險場景**：
- 玩家 A 輸入「12」、玩家 B 同時輸入「34」
- A 的 POST 先到、shared_code='12'
- B 的 POST 後到、shared_code='34'（覆寫）
- A 看 WS 廣播 lock_coop_updated → 突然變「34」、體驗差
- 嚴重時隊員以為 bug、全隊放棄

**怎麼測**：模擬兩 client 1 秒內同送 code → server log 看哪個被覆寫 → 真實活動會出現「我輸入的字突然變了」

---

#### R2: `useTeamGameState` 樂觀鎖 client 端遞增
**檔案**：`shared/hooks/useTeamGameState.ts:99-123`

**現況**：
```ts
const updateState = async (newState) => {
  const nextVersion = versionRef.current + 1;  // client 自己 +1
  await POST /api/team-state { ..., version: nextVersion };
}
```
Server WHERE `version < EXCLUDED.version` 接受。但 **server 拒絕時 client 沒有任何錯誤回應、UI 已先樂觀更新**。

**風險場景**：
- 玩家 A 跟 B 都剛拉 state version=5
- A 送 version=6（成功寫入）
- B 也送 version=6（被 server 靜默拒絕、`WHERE 5 < 6` 真但 EXCLUDED.version 已是 6 不再 < 自己）
- B 的 client UI 已 `setState(newState)` → 看起來成功
- 但 DB 是 A 的版本
- B 重整 → 看到 A 的版本、自己的更新消失

**影響元件**：6 個（CollectiveScore / RoleAssign / QuestChain / JigsawPuzzle / TreasureHunt / GpsCascade）+ RelayMission

**怎麼測**：兩 client 同時 onSubmitAnswer → 看哪個被吃掉 → reload 比對

---

#### R3: `useTeamTerritorySync` per-team snapshot 設計問題
**檔案**：`shared/hooks/useTeamTerritorySync.ts:67-81`

**現況**：
TerritoryCapture 是 session 範圍多隊共享。`useTeamTerritorySync` 把「所有隊的 captures」存進 **「我隊的 snapshot」**（type="territory_capture"、team+session+page+type 為 unique key）。

**風險場景**：
- A 隊佔點 P1 → broadcast → B 隊收到 → B 的 client 把 P1 寫入 B 隊的 snapshot
- B 隊重整：拉 B 隊 snapshot（含 P1 by A 隊）
- 但若 WS 廣播在 B 重整前漏掉、B 隊 snapshot 未更新 → B 看不到 A 隊的佔領
- 兩隊 snapshot 永久不一致

加上 client `versionRef.current++` 跨 client 沒同步、**第二個 capture 寫入會被 server `WHERE version < EXCLUDED` 擋下、本地 captures 已更新但 DB 沒寫入**。

**怎麼測**：
1. 兩瀏覽器分屬不同隊
2. A 佔 P1 → B 看到
3. 立刻 B 佔 P2（< 1 秒）
4. 重整 A → 看 P2 是否還在
5. 重整 B → 看 P1 是否還在

---

#### R4: GpsTeamMission 完全沒持久化
**檔案**：`client/src/components/game/multi/GpsTeamMissionPage.tsx`

**現況**：
- 只用 `useTeamWebSocket` 廣播位置（純 in-memory）
- `reachedUserIds` 由 client 從 memberLocations 即時計算
- **沒有 `/api/team-state` POST**

**風險場景**：
- 玩家 A 走到目標點 → 顯示「已抵達」
- A 重整頁面 → memberLocations 全空 → reachedUserIds 重來
- A 重新送位置才能恢復、但其他人重整會看到「A 還沒到」

**對活動影響**：戶外活動最常見就是手機重整（電量、連線、滑掉 app）。每次重整體驗 reset 不可接受。

**怎麼測**：建 GPS 任務、走到點、確認顯示「已抵達」、重整、看是否消失。

---

### 🟡 中風險 — 偶發、影響體驗

#### R5: LockCoop 雙寫（WS + REST）silent fail
**檔案**：`useTeamLockCoopSync.ts:154-164`
```ts
const onCodeChange = (code) => {
  setSharedCode(normalized);
  sendLockCoopSync("code", { code });    // WS 不等
  void persistAction("code", { code });  // DB 不等、失敗只 console.error
}
```
DB 寫入失敗：本機 UI + 隊友 WS 都已更新，但下次 reload 拉 server 狀態 → 看到舊 code。

#### R6: 樂觀鎖客戶端遞增（同 R2、列為元件層級風險）
影響：所有用 useTeamGameState 的 7 個元件。

#### R7: 玩家 leftAt 後仍能收 WS 廣播
**檔案**：`server/routes/websocket.ts:766-811`

`isTeamMember` 在 REST API 端有檢查 leftAt。但 ws 連線**不會主動 disconnect**：
- admin 把玩家從 team 移除（teamMembers.leftAt 設值）
- ws 仍在 teamClients[teamId] 裡
- 廣播照舊發給該玩家

**修法**：admin leave/remove 時要 server-side ws kick。

#### R8: WS auth 寬鬆（向後兼容沒帶 token 也接）
**檔案**：`server/routes/websocket.ts:198-209`
- 攻擊者送 message.userId 偽造身份送 ws 廣播（如 team_lock_coop_sync）
- 廣播只影響 UI 顯示、寫入路徑（REST）有 isAuthenticated 擋
- 但「攻擊者偽裝隊員傳假 LockCoop code」可能造成體驗破壞

#### R9: Heartbeat 超時 90s + grace 30s + auto-leave 120s 太長
**檔案**：`websocket.ts:855-874`
- 玩家換頁、瀏覽器背景 throttle、IOS 切回 → 90s 才被 terminate
- 加上 grace 30s + auto-leave 120s = **總計約 4 分鐘 stale ws**
- 隊員看的「在線狀態」常常不準

#### R10: 短斷線 race condition
- 玩家網路抖 1s → ws.close → 5s 延遲 broadcast 啟動
- 玩家在 0.5s 內 reconnect → cancelPendingDisconnectBroadcast OK
- 但若 reconnect 在 5.1s（剛好剛好錯過）→ disconnected 廣播完成、但玩家其實已回 → 「上線/下線」狀態抖動

---

### 🟢 低風險 — 可改善但不急

#### R11: 觀測性差
- 純 console.error / console.warn
- 沒有「當前所有 active multi sessions」的 admin 觀測頁
- 一場活動跑壞、admin 只能 SSH 進 server 看 log

#### R12: silent fail
所有 hook 失敗都 `console.error` 吞掉、user 看不到任何錯誤提示。

#### R13: 沒有 leader / 隊長機制
- LockCoop 解鎖按鈕、RelayMission 答題：誰按誰寫、純 race
- 沒 spec 保證「只有隊長能按」這類關鍵動作

#### R14: useTeamPagePersistence 多 hook polling 競爭
- 6 個元件都 polling 10s
- 一場 game 同時開 3 個此類 page → 18 次/分鐘/玩家 polling
- 30 玩家活動 → 540 次/分鐘 polling

#### R15: schema migration 靠 raw SQL `CREATE IF NOT EXISTS`
- 不用 drizzle-kit migration、沒版本控制
- dev DB / 生產 DB schema drift 已踩過坑（host_mode 欄位之前缺）
- 加新欄位（如 R1 加 version）要在 .ts 改 SQL + ALTER TABLE

---

## 整體 e2e 覆蓋率

| 層級 | 數量 | 內容 |
|------|------|------|
| 載入級 smoke | 18（A2）+ 34（host） | page load 不崩潰 + DB schema |
| 互動級 | 0 | **完全沒有兩 client 互動的 e2e** |
| 重整恢復 | 0 | 沒有「狀態 → 重整 → 還原」的自動驗證 |
| 隊員變動 | 0 | 沒測 leftAt、kick、join mid-game |
| Race condition | 0 | 沒測樂觀鎖搶寫 |

**現況：72/72 e2e 全綠 ≠ 多人遊戲穩定**。實機驗證 checklist 是補充（`docs/runbooks/a2-l3-manual-verification.md`），但客戶實際跑活動還沒驗過。

---

## Phase A — 1 週、立即上線可做（5 項）

### A1: team_lock_states 加 version 欄位 + 樂觀鎖（解 R1）

**改什麼**：
- `server/routes/team-lock-coop.ts:18-30`：CREATE TABLE 加 `version INTEGER NOT NULL DEFAULT 1`
- `team-lock-coop.ts:120-140`：每個 UPDATE 改 `WHERE version=current_version` + `SET version=version+1`
- 部署前先 `ALTER TABLE team_lock_states ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`
- `useTeamLockCoopSync.ts`：fetchState 帶回 version、persistAction 送 version
- 衝突回應：server 回 409 Conflict、client 觸發 fetchState 重拉

**為什麼**：客戶協作解鎖場景一定踩到（兩人同時輸入）。

**怎麼測**：
- 自動：e2e 開 2 browser context、同時 POST → 一個 200 一個 409
- 實機：婚禮現場兩玩家同時打 6 位密碼

**估時**：1 天
**風險**：低（只改一個 hook + 一個 endpoint、向後相容）

---

### A2: useTeamGameState 衝突回應 + retry（解 R2 R6 R12）

**改什麼**：
- `server/routes/team-game-state.ts:130-150`：UPDATE 影響 0 row 時回 `{ status: 409, currentVersion }`
- `shared/hooks/useTeamGameState.ts:99-123`：updateState 收到 409 → 拉新 state → toast 提示「狀態已被隊友更新」→ user 可選重新送
- 加 retry 1 次 with exponential backoff
- mutate 失敗有明確 toast（不再 silent）

**為什麼**：影響 7 個 multi 元件、最廣泛

**估時**：1 天

---

### A3: GpsTeamMission 加最小持久化（解 R4）

**改什麼**：
- `client/src/components/game/multi/GpsTeamMissionPage.tsx`：用 useTeamPagePersistence 存 `reachedUserIds`
- 玩家抵達點 → POST team-state（type="gps_team_mission"、state={reachedUserIds, latestPositions}）
- 重整時拉回 reachedUserIds、不需等 WS 重廣播

**為什麼**：戶外活動手機重整是常態、重來體驗不可接受

**估時**：0.5 天

---

### A4: WS leftAt kick（解 R7）

**改什麼**：
- `server/routes/team-lifecycle.ts`：leave/remove 後 ctx.broadcastToTeam 加 type="team_member_kicked"
- `client/src/hooks/use-team-websocket.ts`：收到 kicked + userId === self → 主動 ws.close、redirect 到「您已離開隊伍」頁

**為什麼**：被踢出隊伍仍能收訊息是 leak

**估時**：0.5 天

---

### A5: 觀測 endpoint /api/admin/multi-sessions（解 R11）

**改什麼**：
- 新 endpoint 列：當前所有 active team session、每 team 的 ws 連線數、最後 state version、updated_at
- 加 `/admin/multi-sessions` 簡易頁面（admin 真實活動進行時可看）
- 不修任何邏輯、純讀

**為什麼**：debug 真實客戶活動的問題（現在只能 SSH log）

**估時**：1 天

---

**Phase A 總時數**：4 天（1 週可完成 + buffer）

---

## Phase B — 2-3 週、穩定性加強

### B1: 統一所有元件走 useTeamGameState
- LockCoop 從 team_lock_states 遷移到 team_game_states（取消 R1 後）
- 移除特殊 schema、單一持久化路徑
- 估時：3 天（含資料遷移）

### B2: 加互動級 e2e
- e2e 開 2 browser context、各扮一個玩家
- 用 Firebase emulator + helper login token 解 auth 阻礙
- 至少測：LockCoop 兩人同寫、TerritoryCapture 兩隊搶點、RelayMission 重整還原
- 估時：5 天

### B3: WS 訊息 zod runtime 驗證
- websocket.ts 各 case 用 zod schema parse
- parse fail → 回 error、不 crash server
- 估時：2 天

### B4: 隊長 leader election
- teams 表已有 leader 欄位嗎？（先確認、應已有 captain 概念）
- 關鍵動作（解鎖、答題推進）只由 leader 觸發
- 隊長離線自動轉移
- 估時：4 天

### B5: WS reconnect snapshot 改 server-side
- teamStateCache 跑 server 重啟會清
- 改成 reconnect 時直接 fetch DB（GET /api/team-state）→ 不依賴 server 記憶
- 估時：2 天

### B6: Heartbeat 調整
- 前景 30s、背景 stretching（visibilitychange 切到 60s）
- grace + auto-leave 縮短（30s + 60s）配合
- 估時：2 天

**Phase B 總時數**：~3 週

---

## Phase C — 1 個月+、架構重構（如有必要）

### C1: WS pub/sub 用 Redis（多 instance 部署準備）
- 目前 in-memory Map → 部署多 instance 廣播會分裂
- Redis pub/sub adapter
- 估時：1.5 週
- **觸發條件**：客戶量上去、單機跑不動才做（現在不急）

### C2: schema migration 改 drizzle-kit migration files
- 移除所有 `ensureXxxSchema` raw SQL
- 加 migrations/ 目錄、版本控制
- 部署 pipeline 自動跑 migration
- 估時：1 週

### C3: state machine 統一表達多人同步
- 各 multi 元件其實是 finite state machine
- 用 xstate 統一表達 transitions
- server 端統一驗證
- 估時：3-4 週
- **觸發條件**：發現太多 ad-hoc state bug 才做

---

## 結論與優先建議

**真實「客戶活動會炸」的等級**：
- LockCoop 兩人搶寫（R1）— **下次協作活動 50% 會踩**
- useTeamGameState 同時答題（R2 R6）— RelayMission/QuestChain 會踩
- TerritoryCapture 跨隊不一致（R3）— 多隊搶點活動會踩
- GpsTeamMission 重整丟進度（R4）— 戶外活動每場都踩

**Phase A 5 項做完**約 4 天工程、可解掉 4/5 大風險（剩 R3 territory 設計問題在 Phase B B1 統一架構解）。

**真實客戶活動上線前必做**：A1 + A2 + A3。其他可後排。

**現況 72/72 e2e 全綠不代表穩**：互動級 / race condition / 重整恢復都沒測。Phase B B2 補完才有信心說「自動驗證能擋下迴歸」。

---

## 相關文件
- [A2 L3 持久化驗證](2026-05-07-a2-l3-validation.md)
- [host 元件接 admin editor](2026-05-07-host-component-admin-integration.md)
- [軟分流階段 1](2026-05-07-admin-editor-split.md)
- [實機驗證 checklist](../runbooks/a2-l3-manual-verification.md)
- [三條路線架構](../architecture/three-paths.md)
