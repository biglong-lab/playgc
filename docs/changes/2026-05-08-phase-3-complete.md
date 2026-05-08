# Phase 3 完成 — 移除 feature flag + ADR-0018 + e2e — 2026-05-08

> 對應規劃：[2026-05-08-multi-stability-refactor-plan.md §6 + §8](2026-05-08-multi-stability-refactor-plan.md)
> 狀態：✅ 完成、tsc 0 / smoke 51/51 / CI script 通過
> **架構重構全套完成**（Phase 1 + 2 + 3）

---

## 1. 範圍

**自寫 WS + 全域單例第 3/3 階段**：清理 Legacy code + 移除 feature flag + 寫規範 + e2e。

**完成後**：所有 client 端 ws 永遠走 Provider、不再有 fallback。

---

## 2. 完成清單

### Legacy code 移除

| 檔案 | 變化 |
|------|------|
| `client/src/hooks/use-team-websocket.ts` | 935 行 → 394 行（-541 行）。刪 `useTeamWebSocketLegacy` + 入口 flag 分流、入口直接走 Provider 版 |
| `client/src/components/game/shared/hooks/useHostScreenSync.ts` | 簡化重寫、刪 4 個 Legacy 函式（`useHostScreenSyncLegacy` / `WithPulseLegacy`），保留 2 個 export 直接走 Provider |
| `client/src/components/game/shared/hooks/useTeamShootingSync.ts` | 刪 Legacy useEffect + reconnect 自寫邏輯（MAX_RECONNECT_ATTEMPTS / wsRef / reconnectAttemptsRef） |
| `client/src/components/shared/ChatPanel.tsx` | 刪 Legacy useEffect + isWsConnectedLegacy state、改直接走 Provider |
| 共 | -700+ 行 Legacy code |

### 規範文件

**ADR-0018: 即時通訊架構規範** (`docs/decisions/0018-realtime-architecture.md`)

7 條規則：
1. 整個 app 全域只能有 1 條 WebSocket
2. 所有即時通訊必須透過 `useWebSocket()` Provider
3. 禁止直接 `new WebSocket()`（CI 阻擋）
4. 計分 / 排名 / 結算 → server-side source-of-truth（Phase 4 處理）
5. 訊息類型加新的 → 對齊 ADR-0014
6. 所有 ws 事件自動進 ws_event_log（Phase 0.2 已建）
7. 對講機等敏感訊息 預設不存內容

選項評估表 + 已知例外 + 後續變動條件。

### CI 檢查

**`scripts/check-ws-singleton.sh`**：
- 掃 `client/src` 找 `new WebSocket(`
- 比對白名單（Provider 本身 + Phase 5 例外 2 處）
- 違反 → exit 1
- 已驗證：✅ 全 codebase 通過

未來加進 `.github/workflows/ci.yml`：
```yaml
- name: ADR-0018 WS singleton check
  run: bash scripts/check-ws-singleton.sh
```

### E2E 測試

**`e2e/global-ws-provider.spec.ts`**：
- test 1：玩家進站 ws 連線數 ≤ 1
- test 2：page 切換不應 close ws（Provider 保留）
- test 3：admin/multi-sessions UI 可開啟（Phase 0.1 觀測）
- test 4：admin/sessions/:id/replay 可開啟（Phase 0.3 Replay）
- test 5：**ADR-0018 規範驗證**（檔案掃描、可在 CI 跑）

---

## 3. 「1 user = 1 條 ws」最終達成

```
玩家 Hung 在賈村猜謎遊戲頁（同時開 chat panel）
   │
   📱 瀏覽器只開 1 條 ws：
   │
   └─ WebSocketProvider（App 層）
        ├─ useTeamWebSocket    ──┐
        ├─ useHostScreenSync   ──┤
        ├─ useTeamShootingSync ──┼─ 全部 ensureConnected() 同一條
        └─ ChatPanel           ──┘
        
🖥️ Server 看：Hung 只有 1 條 ws
   join messages 自動 register、reconnect 後重發
   不會誤判 isUserStillConnected
```

---

## 4. 驗收

| 項目 | 結果 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `node scripts/smoke-test-scenarios.mjs` | ✅ 51/51 全綠 |
| `bash scripts/check-ws-singleton.sh` | ✅ ADR-0018 通過 |
| 既有功能 | ✅ 100% 保留（規格對照表已驗）|
| Legacy code 移除 | ✅ -700+ 行 |
| ADR-0018 寫完 | ✅ |
| CI 規範 script | ✅ |
| e2e spec | ✅（待 dev server 跑）|

---

## 5. 架構重構總覽（Phase 0 + 1 + 2 + 3）

| Phase | 範圍 | Commit |
|-------|------|--------|
| 0.1 | admin/multi-sessions 即時 UI | `13d1c594` |
| 0.2 | ws_event_log + 90 天 retention | `a8a9d27c` |
| 0.3 | Session Replay UI（爭議仲裁）| `57b89812` |
| 1 | WebSocketProvider + useTeamWebSocket via Provider | `0cb06f09` |
| 2 | 合併 ChatPanel + useHostScreenSync + useTeamShootingSync | `d268f351` |
| **3** | **移除 feature flag + ADR-0018 + e2e** | (即將 commit) |

**檔案影響**：
- 新增：8 個檔案（Provider + 3 個監測 schema/cron + 3 個 admin 頁 + ADR-0018 + e2e + CI script）
- 改造：4 個 hook + 1 個元件
- 刪除：-700+ 行 Legacy code

---

## 6. 業主新增能力（總結）

1. **即時觀測**：`/admin/multi-sessions` 看 N 場 active session 在線狀態
2. **完整事件 log**：90 天 retention（ws + DB 寫入、含樂觀鎖衝突）
3. **Session Replay + CSV 匯出**：爭議仲裁工具
4. **1 user = 1 條 ws**：進入遊戲不斷線、對講機自動重連、猜謎一致
5. **CI 規範**：未來加新元件不會犯同樣錯（自動阻擋）

---

## 7. 已知限制（後續處理）

### Phase 4（下一步）
- TriviaShowdown 計分仍在 client 端（規則 4 違反）
- 需改 server-side scoring + DB persistence（0.5 天）

### Phase 5（後續）
- `client/src/components/game/solo/ShootingMissionPage.tsx` 仍有獨立 ws（個人遊戲）
- `client/src/hooks/use-match-websocket.ts` 仍有獨立 ws（對戰系統）
- 兩者目前在 ADR-0018 白名單內、Phase 5 評估是否合併

### 待生產驗證
- Provider 版本未經 dev server 真實 e2e 測試
- 建議啟用後實機跑 1-2 場活動、看 Phase 0 觀測數據
- **若異常**：可緊急 git revert 到 Phase 2 之前（feature flag = false 行為）

---

## 8. 部署提示（生產）

### 部署前準備
1. 確認 Phase 0.2 migration 已 applied（`migrations/manual/2026-05-08-observability.sql`）
2. 排空檔（非活動進行中時段）

### 部署步驟
```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build app
```

### 部署後驗證（必做）
1. 訪問 https://game.homi.cc 確認載入
2. 進 `/admin/multi-sessions` 看是否有 active session
3. 跑一場真實多人活動（5 人）
4. 進 `/admin/sessions/:id/replay` 看 ws 事件
5. 驗證指標：
   - [ ] 同 user 的 ws connect 事件數 = 1（不是 4）
   - [ ] page 切換無 close 事件
   - [ ] 對講機鎖屏 5 秒重連 OK
   - [ ] 5 人猜謎結算分數一致

### 出事回滾
```bash
git revert HEAD~3..HEAD  # 回到 Phase 2 之前
git push origin main
docker compose -f docker-compose.prod.yml up -d --build app
```

---

## 9. 下一步

→ Phase 4：TriviaShowdown server-side scoring + DB persistence
   - 完成「猜謎不公平」最後一塊拼圖
   - 預估 0.5 天

→ 部署生產 → 跑 1-2 場真實活動 → 看數據驗證

---

**END Phase 3 — 2026-05-08**
**END 重構主軸（Phase 1 + 2 + 3）— 2026-05-08**
