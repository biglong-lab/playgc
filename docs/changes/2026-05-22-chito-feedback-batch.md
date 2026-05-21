# CHITO 5/20 docx 第一批問題修正 — 2026-05-22

> 範圍：業主第二輪驗收回報 10 個問題、第一批 7 項已修
> 狀態：🟢 部署上線（commit bbabbf1d + 2f7c9c3f + fb7a4791）
> 觸發：業主 5/20 提供 `250520CHITO問題紀錄及建議.docx`

---

## 業主原始 10 大問題

來自 `/Users/hung-macmini/Downloads/250520CHITO問題紀錄及建議.docx`：

| # | 業主原述 | 我方分類 |
|:-:|----------|---------|
| 1 | 多人協作模式-容易卡在同步隊伍進度中 | 多人 P0 |
| 2 | 多人模式-部分設備的長按說話對講功能按鍵會消失 | 多人 P1 |
| 3 | 字體大小切換無效、三個選擇切換後字體大小都沒有變化 | 全域 **P0** |
| 4 | 部分設備畫面被裁切、實測小於 380X 就會被裁 | RWD **P0** |
| 9 | 部分元件（例如按鈕選擇元件）在部分大小設備內容太長會超出顯示區域 | RWD P1 |
| 11 | **退出遊戲時可選保留進度、但退出後無繼續遊玩的選項。如果出現返回遊戲的選項、也只會直接跳到任務完成** | 進度系統 **P0 critical** |
| 12 | 獎勵點數通知、藍色橫幅遮擋太大、僅需要上欄小動畫 | UI P1 |
| 13 | 「遊戲開始祝你好運」黑色橫幅太遮擋、顯示時長太久 | UI P1 |
| 14 | runtime 中不該再顯示「偵測到上次進度」、應限「遊戲入口頁」 | 進度系統 **P0** |
| 15 | 進入遊戲後、通過頁面 1 後還會再次跳回頁面 1 重新開始的 BUG | 進度系統 P0 |

業主明確規則（#11）：
- 沒玩過 / 沒按保留進度 → 僅【開始遊戲】
- 有玩過且按保留進度 → 【返回遊戲】 +【重新開始】
- 遊戲任務完成過 → 僅【再玩一次】

---

## 第一批修正（已部署）

### 1. #11 進度系統三態（重大重做）

#### 問題
之前修過的「繼續上次進度」按鈕、業主測試結果：
- 即使有進度、按鈕一按就跳到完成頁
- 完成過的遊戲也錯顯「繼續上次進度」
- 沒玩過的遊戲也有時誤判

#### 根因
- 後端 `getActiveSessionByUserAndGame` 優先回 completed session（為避免重複通關 dialog）
- 前端 `hasActiveProgress = !!(session && currentPageId)` 不分 status
- completed 也算「有 progress」、按鈕誤顯示
- 點按鈕進去 GamePlay、useSessionManager 接到 completed session 直接跳通關

#### 修法
**`client/src/pages/GameBySlug.tsx`**：
```ts
// 舊：單一 hasActiveProgress flag
// 新：依 session.status 三態判斷
const sessionStatus = activeSession?.session?.status ?? null;
const hasResumablePlaying = sessionStatus === "playing" && !!activeSession?.progress?.currentPageId;
const hasCompleted = sessionStatus === "completed";
```

按鈕三態分支：
- `hasResumablePlaying` → 「▶️ 返回遊戲」綠色主按鈕 + 「重新開始（清除進度）」outline 按鈕（帶 `?restart=1`）
- `hasCompleted` → 「🔁 再玩一次」單按鈕（帶 `?restart=1`）
- 否則（never）→ 原本的「開始遊戲」單按鈕

**`client/src/pages/GamePlay.tsx`**：
```ts
const isReplayMode = useMemo(() => {
  const params = new URLSearchParams(searchString);
  return params.get("replay") === "true" || params.get("restart") === "1";
}, [searchString]);
```
`restart=1` 走 replay 路徑 → 強制建新 session、不彈 ResumeDialog。

### 2. #14 runtime 不再彈進度提示

#### 問題
玩家在遊戲中、有時又彈「偵測到上次進度」對話框、打斷流程。

#### 根因（兩個）
1. `GamePlay.tsx` 有**兩處** `<ResumeDialog>`：
   - line 583 早期 return（pendingDecision 時整頁覆蓋）✓
   - line 789 主畫面內冗餘渲染 ✗（不該存在）
2. `useSessionManager`：query refetch 拿回 existingSession 後、可能再次 setPendingDecision(true)

#### 修法
**`client/src/pages/GamePlay.tsx`** 移除 line 789 冗餘 `<ResumeDialog>`。

**`client/src/pages/hooks/useSessionManager.ts`**：
```ts
// setPendingDecision 條件加 !state.sessionId 防衛
if (
  existingSession?.session &&
  !hasRestoredProgress &&
  !userDecided &&
  !pendingDecision &&
  !state.sessionId &&    // 🆕 已建 session 後永不再彈
  activePages.length > 0
) {
  // ...
  setPendingDecision(true);
}
```

### 3. #13 移除遊戲開始 toast

#### 問題
「遊戲開始祝你好運」黑色橫幅遮擋遊戲畫面 + 顯示太久。

#### 修法
`client/src/pages/hooks/useSessionManager.ts` line 161：直接移除 toast 呼叫。
玩家自己按了「開始遊戲」、本來就知道、不需要通知。

### 4. #3 字體大小切換無效（**根因發現**）

#### 問題
業主切換 A / 大 / 特大、字體完全沒變化。

#### 根因
之前修過用 `--reader-scale` CSS 變數 + `.game-prose` class。
**但 `.game-prose` class 在實際遊戲元件 0 個使用** → CSS 變數有切、沒元素響應。

#### 修法
**`client/src/pages/GamePlay.tsx`** `<main>` 加 `game-prose` class：
```tsx
<main className="flex-1 relative overflow-hidden game-prose">
```

**`client/src/index.css`** 擴大繼承範圍：
```css
.game-prose p, .game-prose li, .game-prose span,
.game-prose div, .game-prose h1, .game-prose h2,
.game-prose h3, .game-prose h4, .game-prose label,
.game-prose button {
  font-size: inherit;
}
/* 系統 UI 在 .game-prose 內也強制 16px */
.game-prose .app-header,
.game-prose .player-bottom-nav,
.game-prose .icon-button,
.game-prose .floating-tool {
  font-size: 16px;
}
```

### 5. #4 <380px 上欄裁切

#### 問題
舊 Android 等窄螢幕、上欄按鈕被裁、右側看不到完整按鈕。

#### 修法
**`client/src/components/shared/GameHeader.tsx`**：
```tsx
<header className="... max-w-full overflow-hidden">
  <div className="px-2 sm:px-4 py-2 sm:py-3 flex items-center
                  justify-between gap-1 sm:gap-2 max-w-full">
    <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
      {/* 左：返回按鈕 + title（可縮）*/}
      <Button ... className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
      <h1 className="font-display font-bold text-sm truncate">{title}</h1>
    </div>
    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
      {/* 右：icon 群、不縮 */}
      <Button ... className="h-9 w-9 sm:h-10 sm:w-10">...</Button>
    </div>
  </div>
</header>
```

關鍵：
- 外層 `max-w-full overflow-hidden`
- 內層 `px-2 sm:px-4` 窄裝置縮小 padding
- icon button `h-9 w-9 sm:h-10 sm:w-10`（窄裝置縮小 4px）
- gap 也加 sm: breakpoint

### 6. #9 按鈕長文字超出

#### 問題
按鈕選擇元件、業主寫長中文選項（如「我想再考慮一下要不要進行此任務的選擇」）、超出按鈕邊界被裁切。

#### 修法
**`client/src/components/game/solo/ButtonPage.tsx`** line 175：
```tsx
<div className="flex items-start gap-3 flex-1 min-w-0">
  <span className="flex-shrink-0">{getIcon(button.icon)}</span>
  <span className="flex-1 text-left break-words whitespace-normal min-w-0">
    {button.text}
  </span>
</div>
```

關鍵：
- `items-start`（多行時 icon 對齊頂部）
- text span `break-words whitespace-normal min-w-0`（允許換行）
- icon `flex-shrink-0`

---

## Build 修正

部署過程 build 失敗：
```
[postcss] Unexpected '/'. Escaping special characters with \ may help.
```

根因：CSS 註解 `/* ... h*/button label 等 */`、其中 `*/` 提前關閉 comment、`button label 等 */` 變不合法。

修：`fb7a4791` 改成「`h1-h4 / button / label`」

---

## 影響範圍

| 檔案 | 變動 |
|------|------|
| `client/src/pages/GameBySlug.tsx` | 三態按鈕（+68 / -25 行）|
| `client/src/pages/GamePlay.tsx` | isReplayMode 識別 restart=1 / 移除冗餘 ResumeDialog / main 加 game-prose（+4 / -17 行）|
| `client/src/pages/hooks/useSessionManager.ts` | setPendingDecision 防衛 / 移除開始 toast（+3 / -2 行）|
| `client/src/components/shared/GameHeader.tsx` | RWD 強化（+21 / -7 行）|
| `client/src/components/game/solo/ButtonPage.tsx` | 長文字 break-words（+10 / -3 行）|
| `client/src/index.css` | `.game-prose` 擴大繼承（+18 / -1 行）|

---

## 未處理項目（等業主提供 repro）

### #1 多人協作模式卡「同步隊伍進度中」
需業主回報：
- 哪個遊戲（gameId / 名稱）？
- 幾人組隊？哪個玩家觸發？
- 卡多久？永久卡 還是 N 秒後恢復？
- 畫面有顯示「WS 連線中斷」訊息嗎？
- 重整瀏覽器後能恢復嗎？

### #2 對講按鍵窄裝置消失
需業主回報：
- 哪個遊戲場域？多人 / 多人團隊 / 多人對戰？
- 裝置型號 + 螢幕寬度（業主 docx 提到「應該與設備顯示大小有關係」、但沒指明寬度）
- 是進入遊戲就沒看到、還是某操作後消失？

### #12 點數通知藍色橫幅
搜尋 codebase 沒找到「藍色橫幅」字串。需業主截圖告知：
- 是什麼操作觸發（按鈕選對 / 通關 / 拿道具 / 累積到 milestone）
- 截圖看實際 UI 元素

### #15 通過頁 1 又跳回頁 1
需業主回報：
- 哪個遊戲？頁 1 是什麼類型元件（按鈕 / 拍照 / 文字 / 條件驗證）？
- 跳回的時機（自動 / 點下一頁後 / 重整後）？
- 是「currentPageIndex」回到 0、還是 currentPageId 變回去？

---

## 業主測試指引

業主上線後立即可測這 7 項：

| 項目 | 測試步驟 | 預期 |
|------|---------|------|
| #11 | 玩遊戲玩到一半、按返回（不關閉）→ 回首頁 → 重新點該遊戲 | 看到「返回遊戲」（綠）+「重新開始（清除進度）」（outline） |
| #11 | 完成過的遊戲再點 | 看到「再玩一次」單按鈕 |
| #11 | 點「返回遊戲」進入 | 直接進保存的 currentPageId、**不再彈「偵測到上次進度」對話框** |
| #11 | 點「重新開始」進入 | URL 帶 `?restart=1`、進到第一頁、清掉舊進度 |
| #13 | 任何方式進入遊戲 | **不再看到「遊戲開始祝你好運」黑色橫幅** |
| #14 | 玩遊戲過程中（不管做什麼） | **不再彈「偵測到上次進度」對話框** |
| #3 | 遊戲中點上欄 ⋯ 偏好設定 → 切換 A / 大 / 特大 | 正文有感放大、nav / header / icon 不變 |
| #4 | iPhone SE / 舊 Android 等窄螢幕（< 380px） | 上欄按鈕全顯示、不被裁 |
| #9 | 用長中文選項的按鈕元件 | 文字自動換行、按鈕高度增加、不超出邊框 |

---

## 相關文件
- 業主原始 docx：`/Users/hung-macmini/Downloads/250520CHITO問題紀錄及建議.docx`
- 協作日誌：[codex-claude/logs/2026-05-22.md](../../codex-claude/logs/2026-05-22.md)
- 上次驗收清單：[docs/runbooks/owner-acceptance-checklist.md](../runbooks/owner-acceptance-checklist.md)
