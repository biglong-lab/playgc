# CHITO 複測第 2 輪 — critical 觸控 + AR/GPS/進度修復 — 2026-07-03

> 範圍：玩家端觸控/捲動、AR 貼圖、GPS 指向標、session 進度狀態機
> 來源：ProPlan Debug workspace `37c5c6e0`（7/3 13:54-14:28 測試員複測回饋）
> 狀態：程式完成、tsc/build/測試過

## 背景
7/3 測試員複測：4 隻通過結案（刷分/訪客暱稱/380px/選擇驗證+10），但回報 1 隻新 critical + 1 隻新 AR 問題，且 GPS / 已通關進度 / AR 拖曳 複測 fail。複測時間皆在 7/2 23:13 正確部署之後 → fail 為真實。

## 本輪修復（5 項）

### 1. 🔴 critical：單指無法滑動、雙指縮放網站
- **根因A（單指）**：GamePlay `<main>` 是 `overflow-hidden`——內容超過視窗直接被裁掉、頁面沒有可捲區 → 單指滑不動；玩家只好雙指縮放後平移（完全吻合回報）
- **根因B（雙指縮放）**：viewport 允許縮放 + body `touch-action: manipulation`（允許 pinch）
- 修：`<main>` → `overflow-y-auto overflow-x-hidden`；viewport 加 `maximum-scale=1, user-scalable=no`；body `touch-action: pan-x pan-y`（iOS 忽略 meta 時的第二道防線）
- 檔：`client/index.html`、`client/src/index.css`（兩處 body）、`client/src/pages/GamePlay.tsx`

### 2. AR 單指拖不動貼圖（複測 fail）
- **根因**：`previewShort` 量測 effect 只依賴 `stage`——stage=camera 初期相機還在 initializing、previewRef 未掛載 → 量測 early-return 後不再重跑 → previewShort 永遠 0 → **拖曳位移 ×0、視覺完全不動**
- 修：effect 加 `camera.cameraReady` 依賴 + 視窗尺寸 fallback
- 檔：`client/src/components/game/solo/PhotoArStickerFlow.tsx`

### 3. AR 成品照片/影片沒貼圖（新回報）
- **根因**：SVG 貼圖（如 `/demo-stickers/jiachun-mask.svg`）無 intrinsic size → Safari `naturalWidth=0` → `ratio=NaN` → canvas `drawImage` 尺寸 NaN **靜默不畫**；預覽 `<img>` 用 CSS 定寬所以看得到 → 「預覽有、成品沒有」
- 修：`drawArFrame` + `FaceStickersOverlay` 比例防護（無效 → 1）
- 檔：`ar-sticker/drawArFrame.ts`、`ar-sticker/arStickerParts.tsx`

### 4. GPS 指向標（複測 fail）
- **具體修正**：原用 lucide `Navigation` 圖示——**圖形本體指向東北（45° 偏移）**，已驗證的 GpsMissionMap 用的是正上方箭頭。45° 常數偏移讓玩家怎麼轉都對不準、體感「方向相反」。換 `Navigation2`（正上方）
- **診斷工具**：加 `?gpsdebug=1` 面板顯示 朝向/目標方位/箭頭角 原始數據——若換圖示後仍反，測試員回報三個數字即可精準定位（授權失敗/Android alpha 相對值等）
- 檔：`client/src/components/game/solo/GpsMissionPage.tsx`
- 註：`(bearing − heading)` 公式物理正確（人右轉、箭頭相對螢幕左轉=持續指向目標）

### 5. 已通關返回跳完成 / 再玩一次跳回第1頁 / 保留進度失效（複測 fail、兩輪）
- **根因（server）**：`getActiveSessionByUserAndGame` 是「completed **無條件優先**」（2026-05-09 D2-c+）→ 玩家 replay 建了新 playing session 後，任何 refetch/重掛都撈回**舊 completed** → 跳「任務完成」、replay 進度像被吃掉
- 修：改「取最新一筆」（completed/playing 一起比 `startedAt`）——通關後未重玩 → 最新=completed 照舊顯示通關（保留 D2-c+ 意圖）；點過再玩一次 → 最新=playing 正確接續
- **根因（client 配套）**：useSessionManager replay 分支寫死跳 `/game/:id`，把場域路徑（`/f/HPSPACE/game/...`）玩家踢出 → 路由改變 → GamePlay 重掛 → 進度被 refetch 蓋掉。改保留當前 pathname 只去 query
- 檔：`server/storage/session-storage.ts`、`client/src/pages/hooks/useSessionManager.ts`

## 本輪追加（第 3 批）

### 6. 🔴 多人隊伍同步異常（開始不同步/投票不同步/在線誤判/卡同步中）
- **根因（code-level 確認）**：隊伍開賽後 lobby 導向 `/game/:id?session=<共用id>`，
  **但 GamePlay 從未讀取 `?session=` 參數** → 每個隊員在 useSessionManager 各自建了
  「個人 session」。而投票狀態 key 是 `(teamId, sessionId, pageId)`、WS 房間/進度也綁
  sessionId → **全隊腦裂**：投票各記各的、進度各走各的、在線名單各看各的——
  完全吻合回報的所有症狀（3 台開始不同步、投票人數不同步、卡「同步隊伍進度中」）。
- 修：GamePlay 解析 `?session=` → useSessionManager 新增 `sharedSessionId` 採用分支——
  首次進入直接採用共用 session（progress row 由首次 PATCH 自動 upsert）；
  重整/斷線回來時若玩家在共用 session 已有進度 → 正常 restore 接續。
- 檔：`client/src/pages/GamePlay.tsx`、`client/src/pages/hooks/useSessionManager.ts`
- 驗證：session/teams 相關 58 測試全過
- ⚠️ 需 3 台真機複測（建隊→開賽→同頁→投票→切背景 30 秒回來）

### 7. 道具+10（查證完成）
- 生產 DB 查證：發「草綠服」的是「阿榮好想退伍 1.0」第 6 頁 choice_verify、
  `rewardPoints` **完全未設定**、道具走 `add_item` action → +10 來自元件「未設定時預設 10」。
- 處置：**admin 在編輯器把該頁「完成獎勵分數」設 0 即可**（第 1 輪修復已讓顯式 0 生效）。
  內容變更屬 admin 權限、不由工程直改生產 DB。

## 判定說明（寫回 ProPlan）
- **錄影貼圖不動**：測試遊戲 AR 頁多為固定位置模式——固定貼圖在影片中不動**與預覽一致、屬設計行為**；臉部錨定模式的貼圖會隨臉移動（且經 #3 SVG 修復後才會正確錄進影片）。「貼圖錨定真實世界（world tracking）」是另一個功能需求、非本輪 bug。

## 驗證
- `npx tsc --noEmit` ✅、`npm run build` ✅
- `playerSessions.test.ts` 17/17、AR 幾何 4/4、completion-reward 6/6（27 過）
- ⚠️ 觸控/AR/GPS 需真機複測（見各 ProPlan 卡複測步驟）

## 已知限制
- GPS 若換圖示後仍反 → 用 gpsdebug 數據做下一輪精準修
- 錄影固定貼圖不追蹤真實世界 → 功能需求另排期
