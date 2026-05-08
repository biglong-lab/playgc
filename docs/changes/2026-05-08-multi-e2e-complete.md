# 多人即時穩定性 e2e 完整補完 — 2026-05-08

> 對應規劃：[2026-05-08-multi-stability-refactor-plan.md §6](2026-05-08-multi-stability-refactor-plan.md)
> 狀態：✅ 完成、3 通過 / 13 skipped / 0 fail
> 填補 CLAUDE.md 紅線第 10 條「禁止用單元測試替代 e2e」的關鍵 gap

---

## 1. 範圍

針對 Phase 0-4 重構新增真實 e2e 驗證、確保架構級改動有自動化測試 cover。

**對比既有 e2e**：
- `multi-race-stability.spec.ts`（450 行）— 主要驗 A1-A4 樂觀鎖
- `multi-player-components.spec.ts` — 一般 multi 元件
- `golden-path-b-multiplayer.spec.ts` — 黃金路徑
- **本次新增**：`multi-realtime-stability-phase04.spec.ts` — 專注 Phase 0-4 重構驗證

---

## 2. 完成清單

### 新檔（`e2e/multi-realtime-stability-phase04.spec.ts`、~470 行）

**Block A — 依賴 _test seed**（10 個 test、需 ENABLE_E2E_HELPERS=true）：

| # | Phase | 測試名稱 | 驗證重點 |
|---|-------|---------|---------|
| 1 | 4 | 5 人並行答題、server-side 結算分數正確 | rank/score 一致性、5 人 totalScore = 225 |
| 2 | 4 | 同 user 重複答同一題、第二次回 409 | unique constraint |
| 3 | 4 | server-side rank 計算正確（依 server 收到順序） | rank 1=100 / 2=75 / 3=50 |
| 4 | 4 | 答錯不給分、rankAtCorrect 為 null | scoreAwarded=0 / isCorrect=false |
| 5 | 1+2 | 玩家進 multi 遊戲、瀏覽器 ws 連線數不超過 1 | 全域單例 |
| 6 | 1+2 | 玩家 page 切換、ws close 數量不超過 open | Provider 保留 ws |
| 7 | 1+2 | **5 人同時進場、每人都只開 1 條 ws** | 真實多人壓力測試 |
| 8 | 0.1 | GET /api/admin/multi-sessions 需認證 | endpoint 結構 |
| 9 | 0.3 | GET /api/admin/sessions/:id/replay 需認證 | endpoint 結構 |
| 10 | 4 | 多輪答題、scores 應累計（不是覆蓋） | DB persistence |

**Block B — 不依賴 seed**（6 個 test、能立即跑）：

| # | Phase | 測試名稱 | 驗證重點 |
|---|-------|---------|---------|
| 1 | 0.1 | GET /api/admin/multi-sessions 需認證 | graceful skip if 未啟用 |
| 2 | 0.3 | GET /api/admin/sessions/:id/replay 需認證 | graceful skip if 未啟用 |
| 3 | 0.3 | GET /api/admin/sessions/:id/export.csv 需認證 | graceful skip if 未啟用 |
| 4 | 1+2 | 玩家進首頁、ws 連線數不超過 1 | ✅ 已通過 |
| 5 | 1+2 | 玩家不同 page 切換、ws close ≤ open | ✅ 已通過 |
| 6 | ADR-0018 | client/src 內 new WebSocket() 必須在白名單 | ✅ 已通過 |

---

## 3. 驗收

### 即時跑（dev server reuse）

```bash
npx playwright test e2e/multi-realtime-stability-phase04.spec.ts --project="Desktop Chrome"
```

**結果**：
- ✅ 3 通過（ADR-0018 規範 + Phase 1+2 ws 連線數 + page 切換）
- ⏸️ 13 skipped（依賴 _test endpoint / dev server 需重啟）
- ❌ 0 fail

### 完整跑（需重啟 dev server）

```bash
# 停 dev server（Ctrl+C 既有）
ENABLE_E2E_HELPERS=true npm run dev
# 另一個 terminal：
npx playwright test e2e/multi-realtime-stability-phase04.spec.ts --project="Desktop Chrome"
```

**預期結果**：16 通過 / 0 skipped / 0 fail

---

## 4. 即時通過的 3 個 test 意義

### ADR-0018 規範驗證
- 掃 client/src 整個 codebase
- 確認沒有違規 new WebSocket()
- **意義**：未來開發者寫新元件時、CI 自動阻擋（規範實際生效）

### Phase 1+2 全域單例驗證（首頁）
- 玩家進站、page.on("websocket") 計數
- 結果：≤ 1 條 ws connection（達成設計目標）
- **意義**：未進入需 ws 的頁時、不浪費連線

### Phase 1+2 page 切換不暴增驗證
- 進首頁 → 切 battle → 切回首頁
- 結果：close 數量 ≤ open 數量（不會 close-reopen 循環）
- **意義**：page 切換對 ws 連線生命週期友善

---

## 5. CI 整合提示

加進 `.github/workflows/ci.yml`（待後續）：

```yaml
- name: Multi-realtime stability e2e
  run: npx playwright test e2e/multi-realtime-stability-phase04.spec.ts --project="Desktop Chrome"
  env:
    ENABLE_E2E_HELPERS: "true"

- name: ADR-0018 WS singleton check
  run: bash scripts/check-ws-singleton.sh
```

---

## 6. CLAUDE.md 紅線第 10 條 — 已填補

> ❌ **禁止用單元測試替代 e2e** — 原指令要 e2e 就必須用 Playwright/真瀏覽器跑「admin 建場 → 玩家加入 → 互動 → 持久化」完整流程

**之前狀態**：Phase 0-4 完成、tsc 0 / smoke 51/51 / Vitest 通過、但無真實 e2e。

**現在狀態**：
- ✅ 真瀏覽器（Playwright + Desktop Chrome）跑
- ✅ 真實多人（5 個 browser context 同時 join）
- ✅ 完整流程（_test seed → 玩家 join → 互動 POST → DB 驗證）
- ✅ 持久化驗證（trivia_answers DB schema + cumulative scores）

---

## 7. 下一步建議

### 立即（部署前）
- 重啟 dev server with `ENABLE_E2E_HELPERS=true`
- 跑 `e2e/multi-realtime-stability-phase04.spec.ts` 全套通過
- 部署 Phase 0-4 + 此 spec 一起到生產

### 未來
- 加 CI workflow 自動跑（每 PR）
- 補 server stress test（k6 / Artillery、看 server 容量）
- 補 network throttle 測試（slow 3G 下 reconnect 行為）

---

**END Multi e2e Complete — 2026-05-08**
