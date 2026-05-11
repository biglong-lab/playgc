# 下次接手指南 — 2026-05-09 ~ 2026-05-12 全套整理

> **產生時間**：2026-05-12
> **生產 commit**：`d1ce1e67`（已 push + 部署 + 套 migration）
> **狀態**：✅ 全部已上線、業主有空跑活動驗證
>
> **使用方式**：
> - 「繼續」→ 我讀本檔、回報狀態、列下一步工作
> - 「繼續 Phase X」→ 直接執行該 phase（5 Phase 穩定性計畫）
> - 「跑活動發現 Y」→ 直接描述問題、跳過本檔

---

## 📊 本次 session（5/9~5/12）完成項目

### Day 1（2026-05-09 ~ 5/10）— 多人斷線根因修 + 隊長鎖

**找到根因**（撈生產 ws_event_log 7 天統計）：
- `close.reason='config_change'` 佔 **67%** — Provider 自己關 ws、不是真斷線
- 78% 連線進 grace、73% expired、45% auto_leave
- 玩家 lobby → game page 切換時 `alsoJoinSessionId` 變動 → ws 被關 → server 進 grace → 玩家被誤踢 team

**修 4 個檔案**（commit `b409d5c1..ff80b1ab`、5/9 晚上部署）：
1. `WebSocketContext.tsx` — `alsoJoinSessionId` 變動保留 ws、補發 join（不再 close）
2. `WebSocketContext.tsx` — 首次 reconnect 加速 200ms（原 800-1200ms）
3. `PhotoTeamGather.tsx` — 加 `isLeader` 隊長鎖、非隊長等待頁
4. `PhotoTeamFlow.tsx` — `captureMode='collage'` 強制走 gather
5. `TriviaShowdownPage.tsx` — reconnect 補拉 `/api/trivia/:id/state`

紀錄：[2026-05-10-multi-leader-stability.md](2026-05-10-multi-leader-stability.md)

### Day 2（2026-05-10 晚）— 觀測完整化（自動報告 + Sentry + CF）

**新增能力**：
1. **session_reports 表** + `generateSessionReport` util + `/api/admin/reports`
2. **每 15 分鐘 cron**：`POST /api/cron/generate-session-reports`
3. **Telegram 推送**：`notifySessionReport`（健康靜音 / 異常出聲）
4. **Web Vitals**：LCP/INP/CLS/FCP/TTFB 自動上報
5. **Sentry React + Node**：前端 + 後端錯誤監控（環境變數啟用）
6. **CF Web Analytics**：condition 載入 beacon
7. **`/admin/reports` UI**：列表 + 異常分數醒目

紀錄：[2026-05-10-observability-suite.md](2026-05-10-observability-suite.md)

### Day 3（2026-05-12）— GPS 即時 + PWA 修 + Phase 1 元件健康度

**問題 1**：GPS 「距離 1m, 1m 慢慢減、不即時」
- 修：`sampleSize=3` / `smoothingFactor=0` / `minSampleIntervalMs=500`（原 5/0.3/1000）
- 涵蓋 `GpsMissionPage` (solo) + `GpsTeamMissionPage` (multi)

**問題 2**：「使用者報還是不精準、又有出現更新版本」
- 找到：`/api/version` 回 `commit:"unknown"` → PWA 版本比對失效
- 修：`docker-compose.prod.yml` `environment` 加 `GIT_SHA: ${GIT_SHA:-unknown}`
- 部署需 `export GIT_SHA=$(git rev-parse HEAD)`

**Phase 1 元件健康度紀錄**（commit `d1ce1e67`、最新部署）：
- `component_runs` 表（自我紀錄機制）
- `useComponentTelemetry` hook（fire-and-forget）
- 6 個元件接通
- `/admin/component-health` dashboard

紀錄：[2026-05-12-component-telemetry.md](2026-05-12-component-telemetry.md)

---

## ✅ 部署 / Push 狀態

```
本地 commits → ✅ 全部 push 到 origin/main
origin/main → ✅ 生產主機 git pull 同步
生產主機 → ✅ docker rebuild + container started
生產 commit → d1ce1e67c68af76a3ddc3fe9a98374b7b4afd59c
PWA 版本機制 → ✅ /api/version 回真實 commit、舊版瀏覽器會自動清快取
```

驗證指令（任何時候可重跑）：
```bash
curl -s https://game.homi.cc/api/version  # commit 應為 d1ce1e67...
curl -sI https://game.homi.cc             # 200
curl -s https://game.homi.cc/api/v1/health  # status:ok
```

---

## 🔧 業主立即可做的設定（待操作）

### 1. crontab 啟用自動報告（最關鍵、5 分鐘）

```bash
ssh root@172.233.89.147

# 取出 CRON_SECRET（已在 .env）
grep ^CRON_SECRET /www/wwwroot/game.homi.cc/.env

# 編輯 crontab
crontab -e

# 加這行（用上面拿到的 secret 取代 YOUR_SECRET）：
*/15 * * * * curl -s -X POST https://game.homi.cc/api/cron/generate-session-reports -H "Authorization: Bearer YOUR_SECRET" > /dev/null 2>&1
```

設了之後：每場活動結束 < 15 分鐘自動推 Telegram 報告。

### 2. 已生效（不用業主做）

- ✅ Sentry React（VITE_SENTRY_DSN）+ Node（SENTRY_DSN）已注入 .env
- ✅ Cloudflare Web Analytics（VITE_CF_BEACON_TOKEN）已注入
- ✅ Telegram bot（TELEGRAM_BOT_TOKEN 等三個）已啟用 + 測試訊息已發送
- ✅ GIT_SHA 部署時注入、PWA 版本機制正常運作

---

## 🎯 下次可接續工作（5 Phase 穩定性計畫）

### Phase 1 ✅ 已完成
元件健康度紀錄 + admin dashboard。需要玩家流量累積數據。

### Phase 2 — 元件級 ErrorBoundary + 自癒（1.5 天、推薦下次）
- 每個元件包獨立 `<ComponentErrorBoundary>` — 單元件死、其他繼續
- 統一 retry-with-backoff middleware（API 5xx 自動重試 3 次）
- `useStuckDetection` hook（60 秒無互動 → 主動詢問「卡住了？」+ 自動產 debug log）
- 樂觀鎖 retry 從 1 次擴到 3 次 + jitter

**指令**：`繼續 Phase 2` 或 `繼續自癒機制`

### Phase 3 — 體感升級（2 天）
- 全面 Skeleton loading（取代 spinner、減少跳動感）
- 統一 Toast design system（dedup）
- 友善 Error UI（含「跳過」「重試」「回報」按鈕）
- 元件切換 fade transition

**指令**：`繼續 Phase 3` 或 `繼續體感升級`

### Phase 4 — Feature flags + 自動降級（1.5 天）
- `field_module_flags` 表（admin 遠端開關元件）
- 高失敗率元件自動降級（如 photo_team fail > 50% 自動切 photo_mission）
- admin UI 看每個 field 的 module 狀態

**指令**：`繼續 Phase 4` 或 `繼續 Feature flags`

### Phase 5 — 合成監測（1 天）
- Playwright cron 每小時跑「黃金路徑 e2e」
- 失敗自動 Telegram「系統健康異常」
- `synthetic_runs` 表 + admin/synthetic dashboard

**指令**：`繼續 Phase 5` 或 `繼續合成監測`

---

## 🚨 已知限制 / 待後續

| 項目 | 狀態 | 處理 |
|------|------|------|
| Sentry warning「express not instrumented」 | 已知、不影響 capture | 影響 perf trace 完整度、可後續優化 |
| `completed_at` 多數 session 為 NULL | 既有業務邏輯 | cron query 已用「30 分鐘無 ws 事件」推導實質結束 |
| 50 條歷史 session_reports anomaly=0 | 樣本太小 | 保留作 baseline、之後新報告會跟它比較 |
| `GpsTeamMissionPage` (multi) telemetry 未接 | 範圍外 | Phase 1 後可逐步擴充其他 54 個元件 |
| Phase 5 兩個 ws 例外 | ADR-0018 白名單 | `ShootingMissionPage` + `use-match-websocket`、長期可整合 |

---

## 📋 業主這幾天可以做的事

### 立即（5 分鐘）
- 設 crontab（讓自動報告生效）
- 進 Sentry dashboard 確認沒有 issue 累積
- 進 CF Web Analytics 看 PV / 裝置

### 跑活動驗證（最關鍵）
- 自己 + 4 個朋友/同事跑一場 5 人多人活動
- 跑完 15 分鐘內看 Telegram 摘要
- 進 `/admin/component-health` 看「6 個元件 7 天表現」
- 進 `/admin/reports` 看完整 session 報告
- 如果有 GPS 任務、走 10 公尺驗證距離即時減少

### 反饋
- 任何元件壞掉 / 卡住 / 數字怪 → 直接打字描述
- 「繼續 Phase 2-5」→ 我接續做

---

## 🔍 關鍵文件導航

| 找什麼 | 去哪 |
|--------|------|
| 5/9-10 多人斷線根因 | [2026-05-10-multi-leader-stability.md](2026-05-10-multi-leader-stability.md) |
| 5/10 觀測 stack | [2026-05-10-observability-suite.md](2026-05-10-observability-suite.md) |
| 5/12 元件健康度 | [2026-05-12-component-telemetry.md](2026-05-12-component-telemetry.md) |
| Phase 0-4 既有架構 | [2026-05-08-phase-4-complete.md](2026-05-08-phase-4-complete.md) |
| ADR-0018 全域 ws | [decisions/0018-realtime-architecture.md](../decisions/0018-realtime-architecture.md) |
| 上次接手指南 | [2026-05-09-next-action-guide.md](2026-05-09-next-action-guide.md) |

---

## 💡 接續指令快速對照表

| 您說 | 我會做 |
|------|--------|
| 「繼續」 | 讀本檔、報狀態、列下一步 |
| 「繼續 Phase 2」（或 3/4/5）| 直接執行該階段 |
| 「跑了活動有 X 問題」 | 進 admin/reports + ws_event_log 找根因 |
| 「Telegram 告警 sessionId XXX」 | 進 replay 看時間軸找原因 |
| 「元件 X 不順」 | 進 admin/component-health 看數據 + 修 |
| 「部署」 | 我 git push + SSH + docker rebuild（含 export GIT_SHA）|
| 「生產出事、回滾」 | git revert 對應 commit + push + rebuild（**會先確認**）|

---

## 📦 環境變數清單（生產 .env）

| 變數 | 用途 | 已設定 |
|------|------|--------|
| `DATABASE_URL` | Postgres 連線 | ✅ |
| `TELEGRAM_BOT_TOKEN/USERNAME/NOTIFY_CHAT_IDS` | Telegram 通知 | ✅ |
| `CRON_SECRET` | cron endpoint 驗證 | ✅（業主待設 crontab）|
| `VITE_SENTRY_DSN` + `SENTRY_DSN` | Sentry | ✅ |
| `SENTRY_ENVIRONMENT` + `SENTRY_TRACES_SAMPLE_RATE` | Sentry config | ✅ |
| `VITE_CF_BEACON_TOKEN` | CF Web Analytics | ✅ |
| `GIT_SHA` + `BUILD_TIME` | PWA 版本機制（部署時 export）| ✅（自動）|
| `TZ=Asia/Taipei` | 時區 | ✅ |
| `LIVEKIT_*` / `CLOUDINARY_*` / `FIREBASE_*` 等 | 既有服務 | ✅ |

---

## 🚦 系統健康度即時檢查（任何時候可查）

```bash
# 1. HTTP 健康
curl -sI https://game.homi.cc | head -2

# 2. /api/v1/health
curl -s https://game.homi.cc/api/v1/health

# 3. /api/cron/health
curl -s https://game.homi.cc/api/cron/health

# 4. 看最新 ws_event_log（需 SSH）
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -c \"SELECT MAX(timestamp), COUNT(*) FROM ws_event_log WHERE timestamp > NOW() - INTERVAL '1 day'\""

# 5. 看 session_reports 累積
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -c \"SELECT COUNT(*) FROM session_reports\""

# 6. 看 component_runs 累積（新表、需玩家流量才會有資料）
ssh root@172.233.89.147 "docker exec gamehomicc-db-1 psql -U postgres -d gameplatform -c \"SELECT component_type, COUNT(*) FROM component_runs GROUP BY component_type\""
```

---

**END Session Handoff — 2026-05-12**
**生產 commit：d1ce1e67c68af76a3ddc3fe9a98374b7b4afd59c**
**下次接手者：直接打開本檔、依需求查對應紀錄**
