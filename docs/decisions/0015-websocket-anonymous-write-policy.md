# ADR-0015: WebSocket 匿名寫入政策 — 設計取捨

> **日期**：2026-05-03
> **狀態**：採用中（保留現狀 + 補強防護）
> **影響**：所有 WebSocket 寫入事件、玩家身份驗證機制

---

## 背景

Codex 第 1 輪資安審查指出：WebSocket 路徑允許匿名連線、token 驗證失敗也只是不設 `authenticatedUserId`、寫入型事件可被匿名送出：

| 事件 | 影響 |
|------|------|
| `team_chat` | 隊伍聊天 |
| `team_location` | 隊員位置上報 |
| `team_vote` | 隊伍投票（影響決策）|
| `team_score` | 隊伍加分（影響戰績）|
| `team_ready` | 玩家準備狀態 |
| `race_answer` | 答題進度（影響其他隊員看到的）|
| `team_lock_coop_sync` | 協作解鎖 |
| `team_relay_sync` | 接力遊戲同步 |
| `territory_capture_sync` | 地盤戰廣播 |
| `host_screen_pulse` | 玩家送 pulse 給大螢幕 |

關鍵點：`join` / `team_join` 沒 token 時完全信任 client 傳的 userId / userName。匿名客戶端可偽造身分進入 session/team room、再發後續事件。

---

## 為什麼目前是這個設計

1. **產品定位允許匿名玩家**：玩家可透過 LIFF 連結進入遊戲、用 LINE displayName 即可、**不需 Firebase 帳號**
2. **多人組隊容錯**：玩家 join team 後可能網路斷重連、強制登入會破壞「重連回到隊伍」體驗
3. **大螢幕 host_screen_pulse**：玩家送 emoji/vote 給大螢幕、強制登入會讓「掃 QR 即玩」流程失效

---

## 選項

### 方案 A：強制登入（最嚴）
所有 WS 寫入事件必須 `ws.authenticatedUserId`：
- 優：每個事件可追溯真實玩家
- 缺：**break LIFF 匿名玩家**、break「掃 QR 即玩」流程
- 不採用

### 方案 B：保留匿名 + 補 server-side ownership 驗證（中間）
對「能影響他人」的事件加 server-side ownership check：
- `team_score`：驗 ws.userId 真的是 team member（DB 查）
- `team_vote`：驗 ws.userId 是該投票場域成員
- `race_answer`：驗 ws.userId 是該 team
- 優：防偽造影響他人
- 缺：每個事件多一次 DB query、性能影響、複雜度上升

### 方案 C：保留匿名 + WS-level rate limit（採用）
不改現有 ownership 檢查、加 WS-level rate limit per connection：
- in-memory token bucket、per ws / per IP 限速
- 防 abuse 高頻濫用（Codex 第 1 輪 #3 點）
- 優：不 break 匿名玩家、防 abuse
- 缺：被偽造的單筆事件仍能成功（但量級被限制）

### 方案 D：分層保護 — 寫入 DB 的事件強制登入、純廣播事件保留匿名
- 寫入 DB（chat 已改 REST、不在 WS）→ 已是強制登入
- 純廣播 WS 事件（vote/score/ready 等）→ 保留匿名
- 優：DB 資料完整性 100%、WS 影響限於記憶體狀態
- 缺：concept 複雜、新增事件時要判斷哪邊

---

## 決定

**採用方案 C + D 混合**：

1. **寫入 DB 的關鍵事件已不在 WS**（chat 已改 REST 走 isAuthenticated + chatLimiter、score 部分改 REST 有 verify member、commit `092eba69`）
2. **純廣播 WS 事件保留匿名**（不 break LIFF 玩家流程）
3. **加 WS-level rate limit per connection**（防 abuse 高頻濫用、待實作）
4. **未來若有資料完整性問題**（如 DB 寫入需嚴格 ownership）→ 走 REST、不走 WS

---

## 影響

### 程式碼對應

**已修（不在風險範圍）**：
- chat 雙寫 + WS auth bypass：commit `ba0872f9`（移除 WS case "chat"、改單一 REST）
- team realtime 房間 + 名稱統一：commit `092eba69`（5 個 REST 事件對齊 broadcastToTeam）
- /api/teams/:teamId/score REST：有 verify member + hotPathLimiter（commit 之前已修）

**待補強（採方案 C）**：
- WS-level rate limit per connection（in-memory token bucket）
  - 預估範圍：~50 行 in `websocket.ts`
  - 限速設計：每 ws 每秒最多 10 個訊息（防腳本 / 螢幕點擊）
  - 超過 → silently drop（不斷連、不報錯）

**保留現狀（依方案 D）**：
- WS 寫入事件不寫 DB、只影響記憶體狀態
- LIFF 匿名玩家可繼續用 line_display_name 玩

### 紅線

- ❌ 禁止在 WS 路徑加 DB write 寫入（已遵守）
- ❌ 禁止在 WS 路徑做 user identity 信任決策（如 admin action）
- ✅ WS 純廣播 + 純記憶體狀態 OK

### 已知限制

1. 攻擊者偽造 userId 影響「他人看到的 race_answered / team_vote_cast」記憶體狀態
   - 影響：UI 顯示混亂、不影響 DB 資料
   - 緩解：rate limit + 後續可加 server-side ownership check
2. host_screen_pulse 可被任意 IP 送 → 大螢幕狀態被影響
   - 影響：演出端體驗
   - 緩解：rate limit + 大螢幕 admin 可手動 reset

---

## 後續可能變動

若上線後有實際 abuse 情境：
1. **加 server-side ownership check**：team_score / team_vote / race_answer 查 DB 驗 ws.userId 是 team member
2. **加 host_screen_pulse 玩家身份綁定**：必須先 register 玩家身份才能送 pulse
3. **改用 schema enforcement**：用 Zod 約束 WS 訊息（防 message tampering）

---

## 相關文件

- [ADR-0014 Realtime 協定清理](0014-realtime-protocol-cleanup.md)
- [docs/changes/2026-05-03-codex-realtime-cleanup.md] — 5 個 team realtime 修法
- [docs/changes/2026-05-03-security-and-ux-fixes.md] — Chat 雙寫 + WS auth bypass 修法
- Codex 第 1 輪資安審查紀錄（codex-claude/logs/2026-05-03.md）
