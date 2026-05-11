# 元件健康度紀錄（Phase 1 of 5）— 2026-05-12

> 範圍：自我紀錄機制、每個元件 mount → 完成 / 失敗全紀錄
> 狀態：✅ 完成、tsc 0 / smoke 51/51 / ADR-0018 通過、待業主部署
> 對應規劃：本日 /plan「元件穩定性 + 自我紀錄 + 自我修復」、5 Phase 計畫之 Phase 1

---

## 1. 業主需求

> 「遊戲單人、多人還有元件、需要更穩定順暢、讓使用者使用體感、介面、元件監測自我紀錄方便修復甚至是可以自我修復」

5 Phase 計畫：
- **Phase 1**：元件健康度紀錄（本次）
- Phase 2：元件級 ErrorBoundary + 自癒
- Phase 3：體感升級（Skeleton / Toast / 友善 error）
- Phase 4：Feature flags + 自動降級
- Phase 5：合成監測（Playwright cron）

---

## 2. 完成清單

### 2.1 Schema（`shared/schema/observability.ts` + migration）

```ts
component_runs: {
  id, sessionId, userId, teamId, pageId, componentType,
  mountedAt, firstInteractionAt, completedAt,
  finalState,  // completed / abandoned / errored / timeout / skipped
  durationMs, interactionLatencyMs,
  retryCount, errorCount, networkErrorCount,
  lastError,
}
```

5 個 index（含 90 天 retention cleanup 用）。dev DB 已套用。

### 2.2 Server endpoints（`server/routes/component-telemetry.ts`）

| Endpoint | 用途 |
|----------|------|
| `POST /api/component-runs/start` | mount 時呼叫、回 runId |
| `PATCH /api/component-runs/:id` | 更新 interaction / complete / 計數 / lastError |
| `GET /api/admin/component-health?days=7` | 聚合統計 + 跟前 N 天對比基準 |

POST/PATCH **無 auth**（玩家寫自己紀錄）、admin endpoint 才需 auth。失敗 fire-and-forget、不影響玩家邏輯。

### 2.3 Client hook（`client/src/hooks/useComponentTelemetry.ts`）

```ts
const tele = useComponentTelemetry({
  componentType: "trivia_showdown",
  sessionId, userId, teamId, pageId,
});

// 元件邏輯內呼叫：
tele.reportInteraction();           // 首次互動
tele.reportComplete("completed");   // 完成
tele.reportComplete("skipped");     // 跳過
tele.reportError(err, isNetwork);   // 錯誤（+ 計數）
tele.reportRetry();                 // 重試
```

特性：
- mount 自動 POST、unmount 自動 PATCH abandoned（用 fetch keepalive、page hide 仍送）
- 重複呼叫 reportComplete 只記第一次（idempotent）
- 失敗全 catch、不影響元件渲染

### 2.4 6 個關鍵元件接 telemetry

| 元件 | componentType |
|------|---------------|
| TriviaShowdownPage | `trivia_showdown` |
| LockCoopPage | `lock_coop` |
| PhotoTeamGather | `photo_team_gather` |
| VoteTeamPage | `vote_team` |
| GpsMissionPage | `gps_mission` |
| ChoiceVerifyRacePage | `choice_verify_race` |

改動量：每個元件 +5~8 行（1 個 hook + 1-2 個 wrap onComplete / interaction）。

### 2.5 admin UI（`/admin/component-health`）

| 欄位 | 顯示 |
|------|------|
| 元件名 | componentType（mono font） |
| 執行次數 | 過去 N 天 mount 次數 |
| 完成率 | completed / total（%）|
| vs 基準 | 對比前 N 天（↑↓→ 箭頭）|
| 錯誤 / 放棄 | errored / abandoned 個數 |
| 平均耗時 | mount → completed |
| 互動延遲 | mount → 首次點擊 |
| 健康度 | 🟢 ≥90% / 🟡 ≥70% / 🟠 ≥50% / 🔴 <50%（樣本 ≥ 5 才評）|

5 個按鈕切換時段（1/3/7/14/30 天）、60 秒自動 refresh。

---

## 3. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠 |
| `bash scripts/check-ws-singleton.sh` | ✅ ADR-0018 通過 |
| dev DB migration | ✅ component_runs 表已套用 |
| 既有元件相容 | ✅ 元件邏輯未變、只多 fire-and-forget hook |

---

## 4. 業主能用什麼

### 立即可用（部署後）

進 `/admin/component-health`：
- 看「水彈元件最近 7 天表現」一眼搞定
- 哪些元件「完成率 < 50%」自動標 🔴 警告
- 跟前 7 天對比看趨勢（變好還變差）

### 量化問題（之前答不出來）

| 業主問 | 之前 | 現在 |
|--------|------|------|
| 「水彈這週表現？」 | 不知道 | 5 秒看 dashboard |
| 「哪個元件最容易卡關？」 | 用感覺 | abandoned 欄位排序 |
| 「玩家平均花多久完成 trivia？」 | 不知道 | 平均耗時欄位 |
| 「修了 GPS 後完成率有沒有改善？」 | 不知道 | vs 基準 ↑↓ 箭頭 |

---

## 5. 部署提示

### 必要動作

```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc

# 套用 migration
docker exec -i gamehomicc-db-1 psql -U postgres -d gameplatform \
  < migrations/manual/2026-05-12-component-runs.sql

# 部署（帶 GIT_SHA、確保 PWA 自動更新）
git pull origin main
export GIT_SHA=$(git rev-parse HEAD)
export BUILD_TIME=$(date -u +%FT%TZ)
docker compose -f docker-compose.prod.yml up -d --build app
```

### 部署後驗證

1. 進 `/admin/component-health` 看 UI 載入
2. 業主測試一輪元件：進 game → 玩 1 個 trivia → 完成
3. 5 秒後重新整理、應看到一筆 trivia_showdown 紀錄
4. 完成率 100%、耗時 / 互動延遲都有數字

---

## 6. 已知限制（Phase 2 後續處理）

- **無自癒機制**：失敗只是「紀錄」、不會自動 retry / 復原 → Phase 2 加
- **無 page-level ErrorBoundary**：元件 throw → 整頁壞掉 → Phase 2 加
- **無自動降級**：失敗率高仍會繼續用 → Phase 4 加
- **無合成監測**：沒人玩時看不到問題 → Phase 5 加
- **6 個元件先接、其他 54 個 multi 元件未接**：Phase 1 後可逐步擴充

---

## 7. 相關文件

- [本日 /plan 規劃](2026-05-12-stability-suite-plan.md) — 5 Phase 整體計畫（待寫）
- [Phase 0-4 既有觀測](../decisions/0018-realtime-architecture.md)
- [activity 結束報告（Phase 5 of 5/10）](2026-05-10-observability-suite.md)

---

**END Component Telemetry — 2026-05-12**
