# 多人遊戲觀測補強 — 2026-06-15

> 背景:使用者回饋多人遊戲問題多。分析近14天生產數據:WS 1006異常斷線×10、
> grace_start→grace_expired 16→16(100%到期)→auto_leave×16(斷線無人重連)。
> 但 ws_event_log session_id 全 null(只記team_id)、session_reports 0筆 → 難精準診斷。

## Phase 1 修正
- websocket.ts:加 teamId→sessionId 快取(查 team_sessions),team 事件
  (grace_start/grace_expired/auto_leave/close/message)補記 session_id → 可對應遊戲場次
- session-report-cron.ts:內部 setInterval 每15分鐘掃「已結束有ws事件無report」的 session
  → generateSessionReport(upsert)。解決 session_reports 一直0筆(原本只靠外部crontab)

## 後續(待 Phase 2)
- 前端 WebSocket 自動重連強化、grace 參數檢討、斷線UX、host自動重連
- 後台多人健康頁

## 驗證
tsc PASS、兩 cron 啟動正常
