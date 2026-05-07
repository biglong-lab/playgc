# 體驗優化 11 項 backlog — 2026-05-07

> 來源：使用者一次提的 11 項建議
> 目的：列 backlog、估時、依賴關係、優先順序建議
> 性質：規劃文件（不寫 code、待 user 排優先順序）

---

## 11 項建議分類

| # | 建議 | 範疇 | 估時 | 風險 | 優先建議 |
|---|------|------|------|------|---------|
| 1 | 畫面比例根據設備優化、不出現裁切/縮放 | 全站 RWD | 3-5 天 | 中 | 🔴 P0 |
| 2 | 分數/道具獎勵橫幅不遮擋畫面 | UI 元件 | 1 天 | 低 | 🟡 P1 |
| 3 | 文字大小可選更大 | 無障礙 | 1-2 天 | 低 | 🟢 P2 |
| 4 | 進入遊戲可選重新開始（二次確認）/ 返回上次進度 | session 流程 | 1.5 天 | 中 | 🟡 P1 |
| 5 | 鏡頭元件加閃光燈/手電筒 | 拍照基本功能 | 0.5 天 | 中（iOS 不支援）| 🔴 P0 |
| 6 | 背景音樂貫徹遊戲流程、播音時 BGM 減弱 | 音效系統 | 2-3 天 | 中 | 🟢 P2 |
| 7 | 每個元件可個別設定音檔 | admin editor + audio | 1.5 天 | 低 | 🟢 P2 |
| 8 | 打字機效果加音效（多種選擇）| narrative 元件 | 1 天 | 低 | 🟢 P2 |
| 9 | 對話訊息加對話音檔 | dialogue 元件 | 1 天 | 低 | 🟢 P2 |
| 10 | 開關手電筒元件（獨立、非鏡頭附屬）| 新元件 | 0.5 天 | 中 | 🟡 P1 |
| 11 | 適合地方加震動（navigator.vibrate）| 全站 | 1 天 | 低 | 🟡 P1 |

---

## 🔴 P0 優先（真實活動上線前必做）— 5-6 天

### 1️⃣ 畫面比例根據設備優化（3-5 天）
**問題**：圖片比例容易被裁切、玩家需縮放網頁

**改造**：
- 全站 viewport meta 已 OK（`<meta name="viewport">`）
- 圖片用 `<img class="w-full h-auto">` 而非 `object-cover`（避免裁切）
- 卡片用 `aspect-ratio` 維持比例（而非寫死高度）
- 容器 max-w 配合各 breakpoint（sm / md / lg）
- 拍照預覽固定 4:3 或 16:9 比例（不依設備）

**檢查清單**：
- [ ] 拍照預覽（8 個 photo 元件）
- [ ] PhotoSuccessView 紀念照
- [ ] gps_mission 地圖卡片
- [ ] dialogue 對話卡
- [ ] choice_verify 選項按鈕
- [ ] 全站 admin editor 預覽

**估時**：3-5 天（要逐一測 iPhone 14 / Pixel 7 / iPad）

### 5️⃣ 鏡頭元件加閃光燈（0.5 天）
**已在 camera-audit.md 規劃**：
- Android Chrome：`MediaStreamTrack.applyConstraints({ torch: true })`
- iOS Safari：**不支援**、灰色按鈕 + 提示
- 拍照後關閉、避免持續耗電

**檔案**：`client/src/components/game/photo-mission/usePhotoCamera.ts` + 抽 `useTorch` hook

---

## 🟡 P1（影響體驗、近期做）— 4-5 天

### 2️⃣ 獎勵橫幅不遮擋畫面（1 天）
**現況**：可能 fixed top / bottom、滿版顯示蓋到內容

**改造**：
- 加 `pointer-events: none` 不擋互動
- 滑入動畫從底部、3 秒後自動上去
- 縮窄寬度（max-w-md）+ 半透明（bg/90）+ 圓角
- 玩家可手動點 X 提早關

**檔案**：`client/src/components/game/RewardBanner.tsx`（如有）或抽出來統一

### 4️⃣ 重新開始 / 返回進度（1.5 天）
**現況**：玩家進 game 直接從第一頁、沒有「繼續」選項

**改造**：
- 玩家進 `/play/:sessionId` → server 查既有進度
- 有進度 → 顯示彈窗：「上次玩到第 X 頁、要繼續還是重新開始？」
- 重新開始 → 二次確認「會清除所有進度、確定？」
- 返回進度 → 直接跳到 player_progress.currentPageId

**API**：`GET /api/games/:id/my-progress`（已有？查）
**前端**：`client/src/pages/GamePlay.tsx` 加 ProgressDialog

### 🔟 開關手電筒（獨立元件）（0.5 天）
**用途**：場域故事可能要玩家「開手電筒看暗門」

**新元件**：`pageType=flashlight_toggle`
- 使用同 `useTorch` hook
- 觸發後 setTimeout 自動關（避免電池）
- 完成後 → onComplete

### 1️⃣1️⃣ 震動回饋（1 天）
**用途**：拍照成功 / 答對 / 通關 / 警告 等關鍵時刻

**改造**：
- 加 `useHaptic` hook：`navigator.vibrate(pattern)` + iOS Haptic API（透過 Web）
- iOS 限制：必須 user gesture 觸發、無 Web Haptic API → 用 vibrate(1) fallback
- Pattern：success [50] / error [50,30,50] / progress [10,20,10]

**接入點**：
- 拍照成功
- choice_verify / text_verify 答對
- 通關 reward
- AR 貼圖完成

---

## 🟢 P2（增強體驗、視時間做）— 6-7 天

### 6️⃣ 背景音樂貫徹遊戲（2-3 天）
**架構**：
```
GamePlay 層：BgmPlayer（單例）
  - currentBgm（從 game.config 讀）
  - duck（減弱）on / off
  - 貫穿換 page 不中斷

各元件：
  - 進入時若有自己的音檔 → BgmPlayer.duck() + 自己播
  - 離開時 → BgmPlayer.unduck()
```

**檔案**：
- `client/src/lib/bgm-player.ts`（新）
- `shared/schema/games.ts` 加 `bgmUrl` 欄位
- 各 photo / video / dialogue 元件接 duck() unduck()

### 7️⃣ 每元件個別音檔（1.5 天、依賴 6）
- pages.config 加 `bgmUrl: string?`
- admin editor PageConfigEditor 加音檔 upload（cloudinary）

### 8️⃣ 打字機音效（1 天、依賴 6）
- TextCard / Dialogue 元件加 `onCharType` callback
- 觸發 short audio click（admin 從預設庫選）
- 預設音效庫：3-5 種（mechanical / soft / typewriter / digital / bell）

### 9️⃣ 對話音檔（1 天、依賴 6 7）
- DialogueMessage 加 `audioUrl` 欄位
- 訊息出現時自動播
- 與 typewriter 配合（每段話對應一段聲）

### 3️⃣ 文字大小可選更大（1-2 天）
- 玩家 settings：`fontSize: 'normal' | 'large' | 'xl'`
- 存 localStorage
- 全站 root font-size 改 CSS variable
- admin 後台另一獨立 setting

---

## 🗺️ 階段 plan（建議）

### 階段 D（這一波、~6 天）
真實客戶活動體驗痛點：
- D.1 紀念照 bug ✅ 已做
- D.2 鏡頭基本功能（前後鏡頭 + 閃光燈 + 相簿）4 天 → 接 camera-audit 階段 1
- D.3 獎勵橫幅不擋畫面 1 天
- D.4 重新開始/繼續進度 1.5 天

### 階段 E（之後、~5 天）
- E.1 震動回饋 1 天
- E.2 RWD 全面盤點 + 修最嚴重 5 處 3 天
- E.3 手電筒元件（獨立 page）0.5 天
- E.4 文字大小選擇 1-2 天

### 階段 F（音效系統、~6-7 天）
- F.1 BgmPlayer 架構 2-3 天
- F.2 每元件個別音檔 1.5 天
- F.3 打字機音效 + 對話音檔 2 天

---

## ⚠ 階段 D 衝突檢查

### vs 多人穩定性 Phase A
fork 報告（`2026-05-07-multi-stability-audit.md`）有 5 個 P0：
- A1 LockCoop version
- A2 useTeamGameState 衝突回應
- A3 GpsTeamMission 持久化
- A4 WS leftAt kick
- A5 觀測 endpoint

**衝突**：階段 D 跟 Phase A 都是「真實客戶活動上線前必做」。

**建議順序**：
1. 多人穩定性 A1 + A2 + A3（3-3.5 天）— 防活動炸
2. 拍照階段 D.2 + D.3 + D.4（6 天）— 提升體驗
3. 階段 E + F 看時機

或交叉做：D.2 + A1 並行（不同檔案、不衝突）。

---

## 相關文件

- [拍照元件盤點](2026-05-07-camera-audit.md)
- [多人穩定性分析](2026-05-07-multi-stability-audit.md)
- [next-action-guide](2026-05-07-next-action-guide.md)
