# 多人遊戲穩定性盤點 v2 — 2026-05-08

> 範圍：60 個 multi 元件 + WebSocket + 樂觀鎖 + 持久化 + 觀測
> 對比基準：[v1 audit](2026-05-07-multi-stability-audit.md)（一週前）
> 目的：盤點現況 + 找出殘留風險 + 規劃下一輪優化

---

## 1. 一句話總覽

**Phase A 5 項全部上生產**（A1-A5、佔總風險 70%）→ 主要紅線已解決。
殘留 8 個中低風險（Phase B 範圍 + 新發現）、其中 **R9 heartbeat 過長最影響使用者體驗**。

---

## 2. Phase A 全項驗證（已完成）

| # | 項目 | 解決 | 生產驗證 |
|---|------|------|----------|
| A1 | `team_lock_states.version` 欄位 + 樂觀鎖 | R1 ✅ | dev + prod DB 都有 version 欄 |
| A2 | useTeamGameState 衝突 409 + retry 1 次 | R2/R6/R12 ✅ | 程式碼 grep 確認 |
| A3 | GpsTeamMission 加 `useTeamPagePersistence` | R4 ✅ | 元件 import 確認 |
| A4 | WS leftAt kick 廣播 | R7 ✅ | websocket.ts 3 處 |
| A5 | `/api/admin/multi-sessions` 觀測 endpoint | R11 部分 | endpoint 存在、UI 未接 |

**結論**：紅線 R1/R2/R4 完全解決、R7/R11 部分解。

---

## 3. 元件覆蓋面（樂觀鎖 retry 已自動套用）

```
60 個 multi 元件
│
├── 81 處用 useTeamPagePersistence
│   └→ 內部呼叫 useTeamGameState（A2 retry 自動生效）
│   元件包含: CollectiveScore / RoleAssign / QuestChain / JigsawPuzzle /
│            TreasureHunt / GpsCascade / IdeaWall / RankChoice / 等
│
├── 8 個自寫 sync hook
│   ├ LockCoop → useTeamLockCoopSync (A1 已加 version、走 team_lock_states)
│   ├ RelayMission → useTeamRelaySync (走 team_game_states、A2 受惠)
│   ├ TerritoryCapture → useTeamTerritorySync (per-team snapshot、🔴 R3 仍存在)
│   ├ VoteTeam → useTeamVoteSync (DB 端鎖、🟢 OK)
│   ├ ShootingTeam → useTeamShootingSync (DB UNIQUE 約束、🟢 OK)
│   ├ GpsTeamMission → useTeamPagePersistence (A3 後加上)
│   ├ ChoiceVerifyRace → server-driven、conditional UPDATE (🟢 設計最完整)
│   └ CollectiveScore (其實已遷 useTeamPagePersistence)
│
└── ~50 個無 sync 元件（純展示、不需同步）
    AbilityBadge / AwardCeremony / BirthdayCandle / BrainDump /
    CheckIn / ClosingThought / DinnerTable / DiscoveryCard / 等
```

→ **覆蓋率 100%**（所有需要同步的元件都有 hook 接 DB）

---

## 4. 殘留風險清單（按優先級）

### 🟠 P0 — 影響 UX、應立刻處理

#### R9: WebSocket Heartbeat / Grace / Auto-leave 過長

```
HEARTBEAT_TIMEOUT     = 90s（玩家離線 90 秒才偵測）
GRACE_PERIOD_MS       = 30s（離線後再給 30 秒救回）
AUTO_LEAVE_AFTER_GRACE = 120s（總共 3.5 分鐘才標 left）
```

**問題**：
- 玩家短按 home 鍵切到 LINE → SW 暫停 → 90s 後才偵測 → 玩家以為「卡住了」
- 真正離線 → 隊友看到「還在線」假象 3.5 分鐘
- 多人活動短時段（30 分）被無效占用 capacity

**建議**：
```
HEARTBEAT_TIMEOUT     = 30s
GRACE_PERIOD_MS       = 10s
AUTO_LEAVE_AFTER_GRACE = 30s
```

→ 短斷線重連在 1 分內、活動體驗大改善
→ 透過 .env 即可調整、無需改 code（已有 parseEnvMs）

#### R11→ A5 endpoint 有了但無 UI

`/api/admin/multi-sessions` 已 ready、但**沒 admin dashboard 接**：
- 業主看不到目前 N 個 session 中、每場有多少人在線、誰最近 leftAt
- 出事只能爬 log、無 visual

**建議**：admin/multi-sessions UI（半天工）

### 🟡 P1 — 中風險、待修

#### R3: TerritoryCapture per-team snapshot 設計問題

每個 team 各存一份 snapshot、隊伍合併時無法 merge → 改設計成單一 master state。
**重做需 1-2 天**（schema migration + 元件改寫 + e2e）。

#### R5: LockCoop 雙寫（WS + REST）silent fail

WebSocket 廣播跟 REST POST 雙路徑寫入、若 WS 漏接、玩家看到「成功」實際沒寫。
A1 加 version 後 silent 機率降低、但仍存在。
**建議**：B1 改成 server WS broadcast 後才回 ack 給玩家。

#### R10: 短斷線 race condition

斷線 5 秒後重連 → state 可能因 GRACE_PERIOD 而被回滾。
R9 縮短時長可緩解。

#### B3: WS 訊息缺 zod runtime 驗證

server 收到惡意 / 變形 WS 訊息 → 可能 throw → 連線中斷或進程崩潰。
**建議**：WS handler 入口加 zod safeParse、所有 broadcast 也驗證。
**工**：4-6 小時。

### 🟢 P2 — 低風險、長期優化

#### R8: WS auth 寬鬆（無 token 也接受）

向後兼容老客戶、潛在 DoS / 偽造身份風險。
**建議**：強制 token 但加 grace period（30 天 deprecation）。

#### R12: Silent fail observability

POST 失敗、WS 廣播失敗 — 大多 swallow exception、無 metrics。
**建議**：Prometheus / 自訂 metric endpoint + Telegram 告警。

#### R13-R15: 隊長機制 / hook polling 競爭 / migration 流程

長期重構話題。

---

## 5. 新發現潛在問題（v1 audit 後）

### N1: Squad 跟 multi team 整合驗證不足

```
teams.squadId   - 一場遊戲執行容器
squads          - 永久身份
team_game_states 走 team_id 串
```

**未驗證**：squad 解散 → 該 squad 在進行中的 team 怎麼處理？
**建議**：寫 e2e 測 squad 解散當下 multi state 行為。

### N2: Booking + Battle + Multi 可能共用 WS

WS path 是 `/ws`、所有訊息走同 channel。
若 booking confirmation 大量推 WS 訊息、多人遊戲廣播可能延遲。
**未驗證**：實際負載下 WS 訊息延遲分佈。
**建議**：分 namespace（`/ws/multi` vs `/ws/booking`）或加優先級。

### N3: TZ=Asia/Taipei 加進 prod 後對 WS 有無影響

剛加的 TZ 環境變數、檢查 multi 元件中所有 timestamp 使用是否一致。
**建議**：grep `new Date()` 看有無時區誤判。

---

## 6. e2e 覆蓋度

| 測試 spec | 行數 | 覆蓋 |
|----------|------|------|
| `multi-race-stability.spec.ts` | 450 | A1 6 + A2 3 + A3 2 + A4 1 |
| `multi-player-components.spec.ts` | ? | 一般 multi 元件 |
| `golden-path-b-multiplayer.spec.ts` | ? | 黃金路徑 |
| `team-game.spec.ts` | ? | team 流程 |
| `a2-multi-l3-smoke.spec.ts` | ? | A2 smoke |

**未覆蓋**：
- 網路斷線中途（throttle network in playwright）
- 3+ 人同時操作（目前測試最多 2 人）
- Server 重啟連線重建
- WS 訊息流量壓測

---

## 7. 風險矩陣

```
影響大 │ R9     │      │ R3
       │        │      │
       │ R5 R7  │ B3   │
       │ R10    │      │
       │        │ R12  │ R8
影響小 │ N3     │ N1   │ N2 R13
       └─────────────────────
        頻繁     偶發    罕見
```

→ 左上角（影響大 + 頻繁）：**R9 heartbeat 為首要**

---

## 8. 建議優化路徑（按 ROI）

### Sprint 1（半天 — 高 ROI 立即見效）
- ⚡ **R9 縮短 WS timing**（改 .env、無需 code）
  - HEARTBEAT_TIMEOUT 30s / GRACE 10s / AUTO_LEAVE 30s
  - 容器 recreate、立即生效
- ⚡ **A5 admin/multi-sessions UI**（接通既有 endpoint）
  - 顯示 active sessions / 在線玩家 / leftAt 紀錄
  - 業主看得見問題

### Sprint 2（2-3 天 — 穩定加固）
- 🛡️ **B3 WS zod runtime 驗證**（防 server crash）
  - 所有 inbound / outbound 訊息加 schema
- 🛡️ **R5 LockCoop 改 ack-after-broadcast**
- 🛡️ **WS 5xx 自動 Telegram 告警**（接 internal-notifier）

### Sprint 3（1-2 週 — 架構優化）
- 🔧 R3 TerritoryCapture 重設計
- 🔧 N1 Squad 解散 / multi 互動 e2e
- 🔧 N2 WS namespace 分流

### 長期（季度）
- R8 WS auth 強制 token + deprecation
- R12 Prometheus / metrics
- 玩家換裝置斷線重連 UX

---

## 9. 立即可做的最小行動（30 分鐘）

直接調 prod .env：

```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
cat >> .env <<EOF

# === WebSocket timing 優化（R9）2026-05-08 ===
DISCONNECT_GRACE_MS=10000
AUTO_LEAVE_AFTER_GRACE_MS=30000
EOF
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```

→ 立刻生效、不用改 code、玩家體驗大改善。

⚠️ 但 HEARTBEAT_TIMEOUT 在 server code 裡 hardcoded 90s、需要先把它做成可調 env。

---

## 10. 給使用者的決定點

| 優先 | 行動 | 預估 |
|------|------|------|
| ⚡ A | Sprint 1（R9 + A5 UI）| 4-6 小時 |
| 🛡️ B | Sprint 2（B3 zod + R5 ack）| 2-3 天 |
| 🔧 C | Sprint 3（R3 重設計 + N1 e2e）| 1-2 週 |
| ⏸️ D | 不動、等真實事件再修 | 0 |

**建議起手 A**：低工作量、立即改善 UX、業主能用。

---

## 11. 相關文件

- [v1 audit](2026-05-07-multi-stability-audit.md) — 風險定義
- [Phase 1 complete](2026-05-07-phase-1-complete.md) — A1-A5 實作紀錄
- [websocket.ts](../../server/routes/websocket.ts) — WS 主檔
- [useTeamGameState.ts](../../client/src/components/game/shared/hooks/useTeamGameState.ts) — 樂觀鎖 client

---

## 12. 補充討論：R9 timing 詳細評估（2026-05-08 增）

> 本節記錄 R9（WebSocket timing 過長）詳細討論結果，**為下次接續的執行依據**。
> 狀態：🟠 **討論完成、未執行**（user 要求先紀錄不動作）

### 12.1 真實現況釐清（grep 後修正）

之前盤點寫「HEARTBEAT_TIMEOUT 90s」其實**不是 hardcoded**、而是邏輯結果：

```
[client 主動]  keepalive 25s  → 任何訊息都重置 missedPings
[server ping]  每 30s 主動 ping
[server 容忍]  MISSED_PING_THRESHOLD = 2（連續 2 次沒回應才 terminate）
─────────────────────────────────────────
真正 timeout = 30s × 3 = 90s（已有 3 道緩衝）

之後：
GRACE_PERIOD_MS         30s（離線後給時間復原）
AUTO_LEAVE_AFTER_GRACE  120s（才釋放 capacity）
```

→ 偵測離線**已有 3 道緩衝**設計合理、過長的是「偵測之後」的 grace + auto-leave（150s）

### 12.2 動哪個 knob 會踩雷

| 改動 | 風險場景 | 建議 |
|------|---------|------|
| ❌ 縮 ping interval 30s → 15s | client 電池消耗增加 | **不動** |
| ❌ 縮 MISSED_PING_THRESHOLD 2 → 1 | 玩家切 LINE 30 秒就被誤殺、誤判率 ↑ | **不動** |
| ✅ 縮 GRACE_PERIOD 30s → 15s | 容量釋放更快、誤判離線者仍有 15 秒救 | 安全 |
| ✅ 縮 AUTO_LEAVE 120s → 60s | 殭屍 slot 釋放快 | 安全 |

### 12.3 真實情境對比（玩家切 LINE 30 秒）

| 階段 | 現況（240s 總時長） | 超保守版（165s）| 之前激進版（100s）|
|------|----------------------|------------------|------------------|
| 0-25s | keepalive 還在發 ✅ | 同 | 同 |
| 30s | server ping 1（漏） | 同 | **terminate**（誤殺）|
| 60s | server ping 2（漏） | 同 | — |
| 90s | terminate（偵測離線）| 同 | — |
| 90-120s | grace 中 ✅ | grace 已過期 ⚠️ | — |
| 120s | 標 left（仍在 auto-leave 計時中）| 標 left | — |
| 240s | 釋放 capacity | 已於 165s 釋放 | 已於 100s 釋放 |

→ 結論：**只動 grace + auto-leave 不誤殺、改善 31% 容量精準度**。

### 12.4 推薦的「超保守版」設定

```env
# 加進 prod .env
DISCONNECT_GRACE_MS=15000          # 30s → 15s
AUTO_LEAVE_AFTER_GRACE_MS=60000    # 120s → 60s
```

| 項目 | 現況 | 超保守版 | 之前激進版 |
|------|------|---------|------------|
| 偵測離線 | 90s | **90s（不變）** | 60s |
| Grace 容忍 | 30s | 15s | 10s |
| 釋放容量 | 120s | 60s | 30s |
| **總時長** | 240s | **165s** | 100s |
| **誤殺風險** | 低 | **低（不增加）** | 中 |
| 容量精確度 | 差 | 好 | 最好 |

### 12.5 安全網：Client auto-rejoin（建議搭配）

防止萬一誤殺、加 client 端自動重連：

```ts
// client：被 server kicked → 自動重連 1 次
ws.onclose = (e) => {
  if (e.code === 1006 /* abnormal */) {
    setTimeout(() => reconnect(), 1000);
  }
};
```

→ 約 30 分鐘工作量、即使誤殺玩家也看不出差別

### 12.6 漸進式調整建議（最安全、可回滾）

不一次改到位、分週驗證：

| 週 | DISCONNECT_GRACE_MS | AUTO_LEAVE_AFTER_GRACE_MS | 驗證指標 |
|----|---------------------|----------------------------|----------|
| 第 1 週 | 20000（小改）| 90000 | admin UI 看「auto-leave 觸發次數」|
| 第 2 週 | 15000 | 60000 | 同上 + 「誤殺自動重連次數」|
| 維持 | 不再降 | 不再降 | — |

異常飆高 → 反向調回 30s/120s。

### 12.7 推薦 Sprint 1 行動順序（更新版）

| 動作 | 工作量 | 風險 | 條件 |
|------|--------|------|------|
| **A. A5 admin/multi-sessions UI** | 3-4 小時 | 無 | 必先做（沒這個無法驗證 timing 改動）|
| **B. Client auto-rejoin** | 30 分鐘 | 無 | 第二做（安全網）|
| **C. .env 改 grace 20s / auto-leave 90s** | 5 分鐘 | 低 | 看 A 的數據後再調 |
| **D. 1 週後若無誤殺、再降到 15s/60s** | 5 分鐘 | 低 | 視 A 數據而定 |

→ **順序很重要**：先有觀測能力（A）、再加安全網（B）、最後動 timing（C/D）。

### 12.8 完全不動 timing 的選項

如果擔心、**只做 A（admin UI）+ B（auto-rejoin）也合理**：
- 觀測能力 ↑（業主看得見問題）
- 容錯能力 ↑（被踢能自動重連）
- 不影響現有 timing
- 之後依數據決定要不要動 C/D

→ 這是**零風險**選項。

### 12.9 待 user 決定的選項

| 選項 | 內容 | 風險 |
|------|------|------|
| ⚡ 全套 | A → B → C 漸進 → D | 低 |
| 🛡️ 安全 | 只做 A + B、不動 timing | **零** |
| ⏸️ 保留 | 不動、等真實事件再決定 | — |

---

## 13. 變動紀錄

| 版本 | 日期 | 變動 |
|------|------|------|
| v2 草案 | 2026-05-08 | Phase A 全綠盤點、列 R9-R15 殘留風險 |
| v2.1 | 2026-05-08 | 加 §12 R9 詳細討論：澄清 90s 不是 hardcoded、保守版方案、auto-rejoin 安全網、漸進式調整 |

---

**END v2 audit — 2026-05-08**
