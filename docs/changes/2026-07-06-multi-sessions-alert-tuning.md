# multi-sessions 告警調校 — 排除 demo/測試 + 提高門檻 — 2026-07-06

> 範圍：多人 session 異常告警 cron
> 觸發：業主 7/6 收到 3 則「🚨 系統錯誤 (multi-sessions-alert)」問是什麼問題
> 狀態：診斷完成 + 修復部署（commit `4f9c5509`）

## 診斷：不是程式錯誤，是測試噪音
3 則告警都是遊戲「test1」、`score=30`、`error=0`、`kick=0`。

- **`score` 是「異常分數」不是遊戲分數**：`grace×5 + auto_leave×10 + error×8 + kick×3`，≥ 門檻就告警
- ws_event_log 時間軸顯示教科書式生命週期：`close → grace_start（+0s）→ grace_expired（+30s）→ auto_leave（+120s）`，時間差完全符合 `GRACE_PERIOD_MS=30s` + `AUTO_LEAVE_AFTER_GRACE_MS=120s`
- 判定：測試員在測 7/4 修的斷線機制（開 team session → 關分頁走人）→ auto-leave 在玩家真的離開 2.5 分鐘後才正確觸發 → **機制運作正常、非誤判**
- 「系統錯誤」標題誤導：error=0、無當機

## 修復（`server/lib/multi-sessions-alert-cron.ts`）
- **排除 demo + 測試遊戲**：查詢帶出 `games.isDemo`；過濾 `isDemo=true` 或標題含 `test/測試/demo/範例`（`TEST_TITLE_RE`）
- **門檻 20 → 30**：真實活動 2 名玩家早退（20 分）不再誤告警；需 3× auto-leave、或 grace+leave 混合、或有 error 才告警
- 保留：真實遊戲有 error（×8）或大量斷線仍正確告警

## 驗證
- 新增 `server/__tests__/multi-sessions-alert-filter.test.ts`（5 測試：demo 不告警、測試標題不告警、test1 情境被過濾、門檻 30 邊界、error 仍告警）
- tsc + build 過；部署後 cron log 確認 `threshold=30`

## 關聯
- 斷線/寬限/auto-leave 生命週期 → [ADR-0023](../decisions/0023-ws-single-worker-topology.md) + [2026-07-04-multiplayer-stability-analysis.md](2026-07-04-multiplayer-stability-analysis.md)
