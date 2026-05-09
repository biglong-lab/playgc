# 觀測完整化 — 自動報告 + Web Vitals + 第三方腳手架 — 2026-05-10

> 範圍：Phase 3 自動化活動結束報告 + Phase 4 Web Vitals + Phase 5 admin/reports + Phase 1+2 Sentry/CF 腳手架
> 狀態：✅ 完成、tsc 0 / smoke 51/51 / ADR-0018 通過、本地 commit、待業主授權部署
> 對應規劃：本日對話 — 業主回報「想用數據佐證、自動回報、第三方專業工具？」
> 路徑選擇：C 混合（Sentry + CF + 自己的自動化報告）+ redact 標準敏感欄位

---

## 1. 業主需求

> 「相關紀錄、更完整優化的推展、讓我們用數據來做優化佐證、對於持續的測試才有極大的意義、自動記錄回報、這對實際的優化推展都會有超級有效的幫助、除了自己的紀錄、我們有第三方可以來更專業的收集嗎？還是有更好的方式、讓我們效率不會變差、主機壓力也不會變大、可以幫我們更完整的收集資料讓我們的優化可以更有效率與完整？」

業主已選方案 C 混合：
- ✅ Sentry Free（client errors + perf）— **腳手架**（待 DSN）
- ✅ Cloudflare Web Analytics（PV / 裝置 / 網路）— **腳手架**（待 token）
- ✅ 自動化活動結束報告（既有 ws_event_log + Telegram）— **完成**
- ✅ Web Vitals 上報（LCP/INP/CLS/FCP/TTFB）— **完成**
- ✅ admin/reports 列表頁 — **完成**

---

## 2. 變動清單（11 個檔案 / +800 行 / -10 行）

### 2.1 Phase 3 自動化活動結束報告

| 檔案 | 用途 |
|------|------|
| `shared/schema/observability.ts` | 加 `sessionReports` table + types |
| `migrations/manual/2026-05-10-session-reports.sql` | dev DB 已套用、生產待 deploy |
| `server/lib/generateSessionReport.ts` | 撈 ws + 業務數據 + 跟前 5 場對比 + 算 anomaly + UPSERT |
| `server/routes/admin-reports.ts` | GET 列表/詳情、POST 手動觸發 |
| `server/routes/index.ts` | 註冊 `registerAdminReportsRoutes` |
| `server/lib/internal-notifier.ts` | 加 `notifySessionReport` Telegram 推送 |
| `server/routes/cron-endpoints.ts` | 新增 `POST /api/cron/generate-session-reports` |

### 2.2 Phase 4 Web Vitals

| 檔案 | 用途 |
|------|------|
| `client/src/lib/web-vitals-report.ts` | 收集 LCP/INP/CLS/FCP/TTFB + 透過既有 reportClientEvent 上報 |
| `client/src/main.tsx` | 啟動時呼叫 `initWebVitals()` |

### 2.3 Phase 5 admin/reports UI

| 檔案 | 用途 |
|------|------|
| `client/src/pages/admin/AdminReports.tsx` | 列表 + 異常分數醒目 + 手動觸發 + 30 秒自動 refresh |
| `client/src/App.tsx` | lazy import + Route |
| `client/src/config/admin-menu.ts` | 加「📊 活動結束報告」menu |

### 2.4 Phase 1+2 第三方腳手架

| 檔案 | 用途 |
|------|------|
| `.env.example` | 預留 `VITE_SENTRY_DSN` / `SENTRY_DSN` / `VITE_CF_BEACON_TOKEN` / `CRON_SECRET` |
| `client/src/main.tsx` | CF beacon 條件動態載入（VITE_CF_BEACON_TOKEN 有設才載）|

---

## 3. 自動化活動結束報告 — 設計

### 3.1 觸發機制

```
crontab（業主部署後設定）：
*/15 * * * * curl -X POST https://game.homi.cc/api/cron/generate-session-reports \
              -H "Authorization: Bearer $CRON_SECRET"

→ server 撈過去 24 小時 status='completed' 但 sessionReports 沒紀錄的 session
→ 對每筆呼叫 generateSessionReport()（idempotent UPSERT）
→ 推 Telegram（首次推、不重複）
→ 標記 telegram_sent
```

**zero-touch**：業主跑活動 → 結束 → 15 分鐘內收 Telegram 摘要。

### 3.2 Telegram 摘要範例

```
🟢 活動結束報告 (anomaly=0)
session:abc123def456…

👥 完成 5/5 (100%)
📡 grace 12% · auto_leave 2% · config_change 0%

詳情：https://game.homi.cc/admin/reports/abc123…
```

異常時：
```
🔴 活動結束報告 (anomaly=75)
session:xyz789…

👥 完成 2/5 (40%)
📡 grace 78% · auto_leave 45% · config_change 67%

⚠️ 3 項異常
首要：config_change 比例過高（67%）— Provider 不該主動關

📈 vs 基準（前 5 場平均 90%）：-50%

詳情：https://game.homi.cc/admin/reports/xyz789…
```

### 3.3 警戒閾值

基於 2026-05-10 生產 7 天觀測（修 config_change 前）：

```
graceRate         > 30%  → 異常（之前 78%、修後預期 < 30%）
autoLeaveRate     > 10%  → 異常（之前 45%、修後預期 < 10%）
configChangeRate  > 5%   → 異常（之前 67%、修後預期 < 5%）
abnormalCloseRate > 20%  → 異常
completionRate    < 50%  → 異常
latencyMs         > 500  → 異常
```

severity score：low=5 / medium=15 / high=30、總和為 anomalyScore（0-100）。

### 3.4 跟前 5 場對比

每次產報告會撈前 5 場 sessionReports 算 baseline：
- 平均 graceRate / autoLeaveRate / configChangeRate
- 平均 completionRate
- 平均 avgWsLatencyMs

→ 異常訊息會帶 baseline 對照（如「比基準 -50%」）。

---

## 4. Web Vitals — 設計

### 4.1 上報策略

```
loaded → onLCP / onCLS / onFCP / onTTFB / onINP 註冊
visibilitychange 'hidden' → web-vitals 內部 flush

只上報 needs-improvement / poor（節省流量）：
- LCP > 2500ms / 2倍 5000ms 為 poor
- INP > 200ms / 2倍 400ms 為 poor
- CLS > 0.1 / 2倍 0.2 為 poor
- FCP > 1800ms / 2倍 3600ms 為 poor
- TTFB > 800ms / 2倍 1600ms 為 poor
```

### 4.2 上報內容（無個資）

```ts
{
  event: "web_vital_lcp_poor",
  message: "LCP=3200 (poor)",
  context: {
    metric: "LCP",
    value: 3200,
    rating: "poor",
    route: "/play/abc",
    effectiveType: "4g",       // 網路類型
    deviceMemory: 4,           // 裝置記憶體 GB
    screenWidth: 1920,
    viewport: "1280x720",
  }
}
```

→ 進 ws_event_log（既有 redact + dedup）→ 未來 admin Dashboard 可分析慢頁。

---

## 5. admin/reports UI — 設計

### 5.1 列表頁

```
┌─────────────────────────────────────────────┐
│  📊 活動結束報告                    [刷新]   │
├─────────────────────────────────────────────┤
│  總場 │ 健康 │ 注意 │ 嚴重 │ 平均 grace 率 │
│  42  │  35  │  5   │  2   │     12%      │
├─────────────────────────────────────────────┤
│  最低異常分 [0]  │  輸入 sessionId 產報告   │
├─────────────────────────────────────────────┤
│ 🟢 abc123…  4/4 (100%)  grace 8% 0%  →Replay│
│ 🟡 def456…  3/5 (60%)   grace 35%* 5%       │
│   ⚠️ WS grace 觸發率過高（35%）              │
│ 🔴 ghi789…  2/5 (40%)   config_change 67%*  │
│   ⚠️ Provider 不該主動關（4 項異常）         │
└─────────────────────────────────────────────┘
```

- 30 秒自動 refresh
- 異常分數 0/<30/<60/≥60 對應 🟢🟡🟠🔴
- 點 Replay 跳到既有 `/admin/sessions/:id/replay`

### 5.2 異常單項展開

報告詳情 endpoint：`GET /api/admin/reports/:sessionId`、回傳完整 anomalies 陣列、可在前端展開看每項細節 + baseline 對比。

---

## 6. Phase 1+2 腳手架（待業主憑證）

### 6.1 Sentry 啟用步驟（業主拿到 DSN 後）

```bash
# 1. 業主：sentry.io 註冊（GitHub 登入）→ Create Project (React) → 拿 DSN
# 2. 加 .env (生產)：
#    VITE_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
#    SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
# 3. 我裝套件 + 寫整合 code（< 30 分）
npm install @sentry/react @sentry/node
# 4. redeploy
```

### 6.2 Cloudflare Web Analytics 啟用（已 ready）

```bash
# 1. 業主：CF dashboard → Web Analytics → Add a site `game.homi.cc` → 拿 beacon token
# 2. 加 .env (生產)：
#    VITE_CF_BEACON_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# 3. redeploy
# 4. CF dashboard 看：PV / 裝置 / 網路 / 平均載入時間
```

→ 已內建條件載入（`main.tsx` 第 14-21 行）、token 留空就不載入 script。

---

## 7. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠 |
| `bash scripts/check-ws-singleton.sh` | ✅ ADR-0018 通過 |
| dev DB migration | ✅ session_reports 表已套用 |
| 既有功能 | ✅ 不變動 |

---

## 8. 部署提示

### 必要動作

```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
docker exec -i gamehomicc-db-1 psql -U postgres -d gameplatform \
  < migrations/manual/2026-05-10-session-reports.sql
docker compose -f docker-compose.prod.yml up -d --build app
```

### 部署後設定（業主）

#### 1. CRON_SECRET（必要、否則自動報告不啟動）

```bash
# SSH 生產主機
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env
docker compose restart app

# 設 crontab（每 15 分鐘）
crontab -e
# 加：
# */15 * * * * curl -X POST https://game.homi.cc/api/cron/generate-session-reports -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### 2. Sentry（選用、5 分鐘）
- 申請帳號、拿 DSN、給我接

#### 3. Cloudflare Web Analytics（選用、3 分鐘）
- 申請 beacon、加 .env、redeploy

### 驗證

```bash
# 部署後 15 分鐘 + 業主跑 1 場活動：
curl -s "https://game.homi.cc/admin/reports" -H "Cookie: ..."
# 應看到 1 筆報告

# 看 Telegram 是否收到摘要
```

---

## 9. 預期效益（量化）

| 指標 | 改前 | 改後 |
|------|------|------|
| 業主活動結束 → 看到報告 | 自己撈 SQL（30 分）| Telegram 推 < 15 分鐘 |
| JS error 看不見 | 100% | （等 Sentry）自動 capture |
| 慢頁 LCP / INP 看不見 | 100% | ws_event_log 自動 capture |
| 月成本 | 0 | 0（全部免費 tier）|
| client 額外載入 | 0 | +5-7KB（web-vitals + CF beacon）|
| 主機 CPU / RAM | — | +0%（外送 + 既有 ws_event_log 沒新增寫入）|
| Telegram 推送頻率 | 無 | 每 15 分鐘最多 1 場報告 |

---

## 10. 已知限制

- **Sentry 整合 code 未寫**：腳手架只到 `.env.example` 預留、實際 npm install + init code 等業主拿到 DSN（< 30 分鐘工）
- **admin/reports Dashboard 無折線圖**：精簡版列表優先、未來如需可加 chart lib（recharts）
- **session_reports 90 天清理未做**：與 ws_event_log 同步、可加進 observability-cleanup-cron.ts
- **生產主機需手動設 crontab**：可移植性 vs 一次性麻煩、用業主決定

---

## 11. 相關文件

- [本日上半場：根因修 + 隊長鎖](2026-05-10-multi-leader-stability.md)
- [Phase 4 完成（Phase 0-4 整套）](2026-05-08-phase-4-complete.md)
- [ADR-0018 全域單例 WS](../decisions/0018-realtime-architecture.md)

---

**END Observability Suite — 2026-05-10**
