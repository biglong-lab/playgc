# 修復:大螢幕↔手機互動全失效(host-screen WS 永不連線)— 2026-06-16

> 嚴重度:高(所有 12+ host 互動體驗的即時互動都壞)｜狀態:完成待部署

## 症狀
使用者回報:後台建立 host 場次後,大螢幕與手機沒有任何互動效果;demo 頁也沒反應。

## 排查(live 兩頁測試重現)
- 開 /host/:id?token + /play/:id,玩家點 emoji → 大螢幕「總互動數」停在 0
- 捕捉 WS frames:**app WebSocket 完全沒連線**(0 條),按鈕在但無 pulse 送出

## 根因
`WebSocketContext.connect()`:`if (!config) return;`
- team 模式用 `acquire(config)` 設 config → 能連
- host-screen 模式用 `ensureConnected()`(無 config,靠 onConnect 發 host_screen_register)
  → connect() 因 `!config` 立即 return → **ws 從不建立** → 玩家 pulse 無從送出/聚合
- ensureConnected 註解說「用 dummy config 觸發 connect」但程式從沒設 dummy config

## 修復(1 行)
`connect()` 守門改為:`if (!config && connectionRefCountRef.current === 0) return;`
→ 有 ensureConnected 引用者(host-screen)即可連線。team 模式不受影響。
(附帶好處:host-screen 斷線後 reconnect 也能運作了)

## 驗證
live 兩頁測試:修復後 WS 連線數 2、玩家點擊 → 大螢幕總互動數 0→1 ✅

## 注意:demo 頁是另一回事
/showcase?demo=xxx 是「靜態版型預覽」(渲染固定 state、無 WS),本來就不互動。
這是預期行為,與本次 WS bug 無關 — 後續可加說明或做成可互動。
