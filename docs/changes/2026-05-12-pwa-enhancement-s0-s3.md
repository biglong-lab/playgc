# PWA 體驗強化 S0-S3 — 2026-05-12

> 範圍：清理 / 觸感 / RWD 防護 / PTR 擴用 / Web Share / WS UX
> 狀態：🟢 本地 commit / tsc 0 / smoke 51/51 / 部署待業主授權
> 配套：[/plan PWA 強化規劃] S0-S5（本檔僅 S0-S3）

## 背景

業主原話：「繼續優化 PWA 體驗感受強化與功能提升 + 手機網頁 RWD 優化、增加穩定度與功能強化設計」。

完整規劃分 S0-S5 六個 sprint、本次完成 S0-S3 前 4 個 sprint 的核心項目。

## 變更

### S0 — 清理 dead code

- 刪 `client/src/lib/haptics.ts`（與既有 `hooks/useHaptic.ts` 重複）
- `PlayerBottomNav.tsx` 改用 `useHaptic().tap()`

### S1 — 觸感全套用 + 遊戲頁防護

**A2 觸感套用**：
- `RewardFeedbackOverlay` 觸發時呼叫 `haptic.success()`
- `GameCompletionScreen` mount 時觸發慶祝節奏 `haptic.custom([60,80,60,80,120])`

**C2 全域觸控優化**（`index.css`）：
- `body { touch-action: manipulation; -webkit-tap-highlight-color: transparent }`
- 防雙擊放大、消除 300ms tap delay
- viewport meta 保留 `user-scalable=yes`（無障礙要求）

**C3 遊戲頁沉浸**（`.gameplay-immersive` class）：
- `user-select: none` + `-webkit-touch-callout: none` 禁長按 context menu
- `overscroll-behavior: contain` 防意外往下拉
- 白名單：`input` / `textarea` / `[contenteditable]` / `.selectable` 仍可選文字
- `GamePlay.tsx` 最外層加 `gameplay-immersive` class

### S2 — PullToRefresh 擴大

`PullToRefresh` 套用到 2 個新頁面：

| 頁面 | invalidate queries |
|------|-------------------|
| `Leaderboard.tsx` | `/api/leaderboard` |
| `me/MeCenter.tsx` | `/api/auth/user` + `/api/sessions` + `/api/me` |

**未做**：
- A4 底部 Tab 左右滑切換（風險：與既有 carousel / grid 滑動衝突，留 S5+）
- A6 iOS apple-touch-startup-image（需設計師出 10 種解析度 splash 圖）

### S3 — Web Share + WS UX 升級

**B2 Web Share lib**（`lib/web-share.ts`）：
- `share({ title, text, url, fallbackToClipboard })` → `Promise<ShareResult>`
- 三層 fallback：navigator.share() → clipboard → failed
- 上報 `web_share_invoked` event（telemetry 用）
- 提供 `canShare()` / `canCopy()` helper

**C7 WS 重連 UX**（`GamePlay.tsx`）：
- 從 `useTeamWebSocket` 拉 `isReconnecting`
- 警示條：
  - `isReconnecting === true` → 琥珀色 + 「正在重新連線、稍候即可繼續…」
  - 斷線（非重連中）→ 紅色 + 「隊伍即時同步中斷」
- `WsConnectionBadge` 傳 `isReconnecting` prop

**未做**：
- B1 Web Push（需 VAPID + 後端配合、留 S4）
- B3 Background Sync（需 SW 大改、留 S4）
- B5 智能 install prompt / B6 離線降級頁（需多處整合）

## 影響檔（共 ~10 檔）

| 檔 | 變動 |
|----|------|
| `client/src/lib/haptics.ts` | 刪除（dead code）|
| `client/src/components/PlayerBottomNav.tsx` | 改用 useHaptic |
| `client/src/components/feedback/RewardFeedback.tsx` | 觸感呼叫 |
| `client/src/components/game/GameCompletionScreen.tsx` | 通關慶祝觸感 |
| `client/src/pages/GamePlay.tsx` | gameplay-immersive class + WS reconnect UX |
| `client/src/pages/Leaderboard.tsx` | PullToRefresh |
| `client/src/pages/me/MeCenter.tsx` | PullToRefresh |
| `client/src/index.css` | touch-action + .gameplay-immersive 樣式 |
| `client/src/lib/web-share.ts` | 新增（48 行）|

## 驗證

- ✅ `npx tsc --noEmit` 0 errors
- ✅ `node scripts/smoke-test-scenarios.mjs` 51/51 全綠

## 待業主實測

| 期待 | 怎麼看 |
|------|--------|
| 通關有震動 | 通關畫面（手機 Android Chrome 最明顯）|
| 按底部 tab 有震動 | 切換 /home /battle /me |
| 拍照成功有獎勵震動 | 拍照任務、得分時 |
| 遊戲頁長按不會跳「複製 / 選取」menu | 長按遊戲畫面 |
| 遊戲頁雙擊不會放大 | 快速雙擊任何位置 |
| 排行榜 / 個人頁可下拉刷新 | 上拉到頂、再往下拉 |
| WS 斷線→重連→連回 三狀態清楚 | 切飛航模式測試 |

## 後續 S4 / S5

- **S4**（高工作量）：Web Push 推播 + Background Sync + iOS PWA bug
- **S5**（清理）：RWD 桌機分支清除 + 弱網降級 + 記憶體洩漏 + A4 滑切 + A6 splash
