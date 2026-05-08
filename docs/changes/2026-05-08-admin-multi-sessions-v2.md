# AdminMultiSessions v2 完整打磨 — 2026-05-08

> 狀態：✅ 16 項全完成、tsc 0 / smoke 51/51 / 待部署生產
> 觸發：user 反映「排版比照 /admin/sessions、資料是否真實、解決問題、不要浪費」
> 對應 task：#12-#27（共 16 項）

---

## 1. 範圍

針對 `/admin/multi-sessions` 即時連線監控做完整打磨，鎖定「**有效好用**」原則：
- ✅ 排版比照 `/admin/sessions`（三列、MetricCard、篩選）
- ✅ 資料真實（用 ws_event_log 取代 5 分鐘 polling 假 online）
- ✅ 完整紀錄（健康指標 + 連線統計 + cross-session 歷史）
- ✅ 解決問題（異常排序到頂 + 玩家詳情 + Telegram 告警）
- ✅ 不浪費（拒絕大型趨勢圖 / emoji 動畫等花俏設計）

---

## 2. 完成 16 項

### 🔴 P0 — 核心改造（5 項）

| # | 項目 | 改動 |
|---|------|------|
| 1 | 三列卡片佈局 | grid-cols-1 md:2 lg:3 |
| 2 | 頂部 4 MetricCard | 進行中 / 在線玩家 / 異常 / 平均連線時長（共用 MetricCard、可點 filter）|
| 3 | **真實 online 取代假 polling** | server 改用 ws_event_log connect/close 判斷 + recent (30s) / away (5min) / offline 三態 |
| 4 | ws 健康指標 | grace / auto_leave / kick / error count（過去 5 分鐘聚合）|
| 5 | 異常排序到頂 | server 端 anomalyScore = grace×5 + autoLeave×10 + error×8 + kick×3 + offlineRatio×5 |

### 🟠 P1 — 工具增強（4 項）

| # | 項目 | 改動 |
|---|------|------|
| 6 | 篩選列 | 搜尋 sessionId/gameTitle/fieldId + 場域 dropdown + 健康度 dropdown |
| 7 | 玩家詳情真實狀態 | firstConnectAt / lastEventAt / connectCount / reconnectCount / IP / UA / lastReason |
| 8 | 迷你連線時間軸 | 30 格時間軸（10s/格）、紅橘綠標 connect/close/grace/error 事件分布 |
| 9 | CSV 匯出 | 16 欄完整匯出（health / anomaly / dataSource）|

### 🟡 P2 — UX 加分（3 項）

| # | 項目 | 改動 |
|---|------|------|
| 10 | game 進度指標 | 隊伍平均進度 % + Progress bar + 總頁數 |
| 11 | sessionId 點擊複製 | 點擊 code 自動 copy clipboard + toast |
| 12 | refresh 倒數顯示 | 「N 秒後自動更新」 |

### 🟢 P3 — 進階（4 項）

| # | 項目 | 改動 |
|---|------|------|
| 13 | **Telegram 異常告警 cron** | 每 5 分鐘掃、anomalyScore >= 20 → notifySystemError + Replay 連結 + 30 分鐘 cooldown |
| 14 | **玩家 cross-session 歷史** | 點玩家 → dialog 看 1/7/30/90 天連線統計 + 場次清單 + 多 IP 偵測 |
| 15 | 廣播統計 | broadcast/min 顯示在 detail（漏接偵測待 client ack 機制、本期不做）|
| 16 | 鍵盤導航 | `/` 鍵聚焦搜尋 |

---

## 3. 資料真實性對比

### 改前
```ts
// 用 player_progress 5 分內 update 推 online
const online = prog.updatedAt > new Date(Date.now() - 5 * 60 * 1000);
```
**問題**：玩家 ws 已斷 4 分鐘、但 5 分鐘前剛更新 progress → 仍顯示 online（**假象**）

### 改後
```ts
// 用 ws_event_log 算真實連線狀態
- last event != "close" && last_event_at 在 30s 內 → online (綠 Wifi)
- last event != "close" && last_event_at 30s~5min → away (橘 Zap)
- last event = "close" 或 5min+ 無事件 → offline (紅 WifiOff)
```

**Fallback**：若 ws_event_log 完全沒事件（剛部署 / 觀測未啟用）→ 回退舊邏輯 + 標 `usingRealtimeData: false`

---

## 4. 異常分數設計（anomalyScore）

```
anomalyScore = grace×5 + auto_leave×10 + error×8 + kick×3 + offlineRatio×5

健康度分級：
- score >= 20 → critical（紅邊框、destructive badge、Telegram 告警）
- score >= 5  → warning（橘邊框、橘 badge）
- score < 5  → healthy（無特殊標記）
```

預設按 anomalyScore 降序、業主第一眼看到問題場。

---

## 5. server 端新增/改造

### 新增 endpoint
- `GET /api/admin/players/:userId/connection-history?days=N`
  - 過去 N 天該 userId 的所有 session 連線統計
  - 場域權限過濾
  - 回傳 totals + per session breakdown + uniqueIps（多 IP 警示）

### 改造 endpoint
- `GET /api/admin/multi-sessions`：
  - 加 ws_event_log 真實 online + 健康指標 + anomaly 排序
  - 回欄位：`recentMembers` / `awayMembers` / `health` / `anomalyScore` / `usingRealtimeData`
- `GET /api/admin/multi-sessions/:gameId/state`：
  - 玩家層加 `connectionStatus` (online/away/offline) + `wsConn` (連線時間/IP/UA/重連次數/lastReason)
  - session 層加 `timelineEvents` + `health` + `avgProgressPercent`

### 新增 cron
- `server/lib/multi-sessions-alert-cron.ts`
  - 每 5 分鐘掃 active sessions
  - critical → Telegram + 30 分鐘 cooldown
  - server/index.ts boot 自動啟動

---

## 6. 拒絕的功能（避免浪費）

❌ 大型趨勢圖（→ 屬於另一個 ws_event_log Dashboard 頁面）  
❌ emoji 動畫 / 過度視覺特效  
❌ server CPU / memory metrics（即時監控不是這角色）  
❌ 側選單 notification badge  
❌ 漏接偵測（需 client ack 機制、超出範圍）

---

## 7. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠 |
| 既有功能 | ✅ 100% 保留 |
| 部署可逆性 | 100%（純應用層改、無 schema 變動）|

---

## 8. 部署提示

不需 migration、純 server 改造 + client 重 build：
```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build app
```

部署後驗證：
1. 進 `/admin/multi-sessions` 看新排版
2. 確認頂部 4 MetricCard 顯示
3. 點 health 篩選 dropdown 測試
4. 等下一個 active session 進來後、看：
   - 真實 online 狀態（不再 5 分鐘失準）
   - 健康指標 grace/auto-leave/kick/error 顯示
   - 迷你時間軸有事件條
   - 點玩家可開歷史 dialog
5. 部署後 5 分鐘看 server log 確認 `[multi-sessions-alert-cron] cron started` 訊息

---

**END AdminMultiSessions v2 — 2026-05-08**
