# Showcase 互動試玩全覆蓋 — 2026-06-19

> 範圍：`/showcase` 元件展示館
> 狀態：🟢 部署上線（commit `0bb88bce`）
> 部署 commit 範圍：`ecaf2d09`（WS 修復前置）→ `fbe65cd6` → `acb0f22f` → `0bb88bce`

## 背景

使用者回饋：12 款互動體驗（大螢幕↔手機）「測試不會真的有互動效果，後台建立後沒反應，DEMO 頁也沒反應」，且要求「要可以一次開兩邊，才感受得到互動的過程與體感，並可以實際玩看看」。

原 `/showcase` 的 demo 都是**寫死的靜態畫面**（hardcoded state，玩家端無 onPulse）→ 點了沒反應。

> 註：大螢幕↔手機在「真實 session」沒反應是另一個 WS bug（host-screen 模式 `ensureConnected` 永遠連不上），已於 [2026-06-16-host-screen-ws-fix](2026-06-16-host-screen-ws-fix.md) 修復。本檔處理的是 **showcase demo 的可玩性**。

## 影響範圍

- `client/src/components/showcase/InteractiveDemo.tsx`（新增）— host 軸雙邊同開 harness
- `client/src/components/showcase/CoopDemo.tsx`（新增）— multi 軸雙人協作 harness
- `client/src/components/showcase/W22DemoSection.tsx` — bingo/blessing 加互動按鈕
- `client/src/pages/ShowcaseHub.tsx` — demo 卡加「🎮 互動試玩 / 🤝 雙人協作試玩」按鈕 + Dialog 分支

## 解決方案

**純前端本地模擬**（零生產風險、不碰建場、不碰 WS、不碰生產資料）：

1. **host 軸（大螢幕+手機）** — `InteractiveDemo`：左右並排 host + player，共用本地 state。
   - player 操作 → `onPulse(type, payload)` → 聚合器（複製各 `*Page.tsx` 的 handlePulse 邏輯）→ `setState` → host 重繪
   - host 需控制流程的（trivia/scoreboard）→ 元件自帶控制鈕，透過 `onBroadcastState=setState` 驅動狀態機
2. **multi 軸（雙人協作）** — `CoopDemo`：並排兩個玩家(A/B)共享同一份本地 state。
   - 玩家 A 操作（callback：onFillSlot/onUnlockClue/onReachPoint/onContribute/onAssign）→ 共享 state 更新 → 玩家 B 立即看到（state 更新邏輯對齊 `*Page.tsx` 的 updateState）

## 覆蓋清單（16 個元件）

**📺 大螢幕+手機雙邊同開（11）**：即時民調、情緒池、人浪應援、聚眾達標、拍立得牆、簽名簿、知識地圖、跑馬燈宣告、搶答秀、Bingo 集章、祝福瀑布牆

**🤝 雙人協作（5）**：拼圖協作、藏寶解謎、連鎖探索、合作衝分、角色分派

**跳過（1）**：即時排行榜（玩家端本就純唯讀顯示，硬做互動屬過度開發）→ 保留原靜態預覽

## 驗證

全程 Playwright 真瀏覽器 e2e（非單元測試），逐元件確認「操作→畫面真的變」：
- emoji：點 👍 → 大螢幕總互動數/計數遞增、飛出 👍
- trivia：大螢幕開始→手機搶答→揭曉→出現下一題鈕
- collective：A/B 加分 → 總分共享累積
- knowledgemap/bingo/blessing/crowd/scoreboard/role-assign/gps 等逐一通過
- tsc 0 錯、零 runtime error
- 生產實機（game.homi.cc）抽驗 trivia + collective 通過

## 已知限制 / 後續

- multi 5 元件是「本地單機共享 state」模擬協作體感；真實多人仍走 server WS（穩定 hash 分派、去重需 server truth）
- 即時排行榜未做互動 demo（顯示型元件）

## 相關文件

- WS 修復：[2026-06-16-host-screen-ws-fix](2026-06-16-host-screen-ws-fix.md)
- 多人觀測：[2026-06-15-multiplayer-observability](2026-06-15-multiplayer-observability.md)
