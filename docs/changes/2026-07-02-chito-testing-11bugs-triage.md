# CHITO 實境遊戲平台 — 測試回報 11 隻問題分流與處理 — 2026-07-02

> 範圍：game.homi.cc 玩家端 / admin 端測試回報
> 來源：ProPlan Debug workspace `37c5c6e0-8a06-4bf3-a27b-5899c0ae7cb3`
> （<https://plan.aihomi.cc/daily-ops/debug/37c5c6e0-8a06-4bf3-a27b-5899c0ae7cb3>）
> 狀態：本次修復 1 隻（計分寫死 +10），其餘 10 隻已分流、待逐項處理
> 測試場域：HPSPACE ｜測試遊戲 gameId `555e252d-7240-47f6-975c-907116ee2304`

---

## 背景

測試員在 ProPlan「CHITO 實境遊戲平台」Debug 主題回報 11 筆問題（2 個問題包）。
本文件把 11 筆全數登錄、分流、並記錄「哪一隻已修、何時修、如何複測」，
供測試人員做**時機確認**（對照修復/部署時間點回頭重測）。

---

## 11 筆問題總表

| # | 包 | 類別 | 嚴重度 | 標題 | 本次狀態 | 根因/處置方向 |
|---|----|------|--------|------|---------|--------------|
| 1 | 1 | 計分 | 中 | 道具設定無效果卻自動 +10 分 | ⚠️ 部分（見下）| 與 #11 同源；道具是否誤綁分數需正式流程複測 |
| 2 | 1 | 計分 | 中 | 上一頁重複通關可重複刷分 | ✅ 已修 | completedPageIds 已記錄卻沒拿來擋重複給分 |
| 3 | 1 | 顯示/多人 | 中 | 訪客暱稱在多人模式顯示 user-xxx | ✅ 已修 | 建/加入隊伍時把暱稱寫進 users.firstName |
| 4 | 1 | RWD | 中 | <380px 右側/底部按鈕被裁切 | ✅ 已修 | 底部導覽固定 padding/gap + 文字撐爆窄螢幕 |
| 5 | 1 | 進度狀態 | 中 | 已通關返回直接跳完成、再玩跳回第1頁、保留進度異常 | ⏳ 待處理 | 通關/進度狀態機；與 #10 相關 |
| 6 | 1 | 多人同步 | 中（實際高）| 多人隊伍同步異常（離線誤判/投票不同步）| ⏳ 待處理 | WebSocket 隊伍同步；影響大、需獨立處理 |
| 7 | 1 | GPS | 中 | GPS 指向標方向與手機轉向相反 | ✅ 已修 | 箭頭沒納入手機羅盤朝向，改相對修正 |
| 8 | 1 | 功能需求 | 中 | AR 貼圖：短按拍照/長按錄影 | 🆕 功能 | 非 bug，是新功能需求 |
| 9 | 1 | 功能需求 | 中 | AR 貼圖：拖曳移動/雙指縮放 | 🆕 功能 | 非 bug，是新功能需求 |
| 10 | 2 | 進度狀態 | 中 | 遊戲進第2頁異常跳回第1頁 | ⏳ 待處理 | 與 #5 高度重疊，可能同根因 |
| 11 | 2 | 計分 | 中 | 選擇驗證元件設 0 分仍自動 +10 分 | ✅ 已修 | legacy 單選路徑寫死 points:10 |

分流小結：
- **計分類（#1 #2 #11）**：#11 已修；#1 部分涵蓋（同機制），道具耦合分數需複測；#2 需另做去重。
- **進度狀態（#5 #10）**：疑似同一狀態機根因，建議合併一起查。
- **多人（#3 #6）**：#6 影響最大（同步崩壞），應獨立排期；#3 較單純。
- **其他（#4 #7）**：各自單點；#7 可能一行修。
- **功能需求（#8 #9）**：非 bug，走需求排期，不列入本次修復。

---

## ✅ 本次已修：#11 / #1 — 選擇驗證元件自動 +10 分

### 根因
`client/src/components/game/solo/ChoiceVerifyPage.tsx` 有兩條完成路徑：

- **多題 quiz 路徑**（`handleSubmit`）：正確依 `rewardPoints ?? onSuccess.points ?? 題數×rewardPerQuestion` 計分。
- **legacy 單選路徑**（`handleLegacySubmit` / `handleLegacyContinue`）：**寫死 `onComplete({ points: 10 })`**，
  完全忽略後台「完成獎勵分數」。管理員把分數設 0，玩家實測仍 +10。

### 修法
legacy 路徑改用與多題路徑相同的取值優先序（顯式 0 也尊重）：

```
rewardPoints（含 0） > onSuccess.points > rewardPerQuestion > 預設 10
```

- 新增 `legacyRewardPoints`，取代兩處寫死的 `points: 10`。
- 設 0 → 給 0；設 50 → 給 50；完全未設定 → 維持預設 10（不破壞既有遊戲）。

端到端驗證：`GamePageRenderer.tsx` 補分 wrapper 只在 `cfgPoints > 0` 才補，
設 0 會走 failure-fallthrough 記 0 分，不會被後端再塞回 10。整條鏈一致。

### 影響檔案
- `client/src/components/game/solo/ChoiceVerifyPage.tsx`（修邏輯）
- `client/src/components/game/__tests__/ChoiceVerifyPage.test.tsx`（+2 測試）

### 驗證
- `npx tsc --noEmit` ✅
- `ChoiceVerifyPage.test.tsx` 8/8 通過（含新增：設 0 給 0、設 50 給 50）

### #1 說明（道具 +10）
#1 與 #11 同屬「選擇驗證/完成元件自動加分」機制，本次修法已讓「分數」尊重後台設定。
但 #1 另有「道具是否被錯誤綁定分數」的疑慮（reporter 原文為「建議以正式流程確認」）。
→ **需測試員用正式玩家流程複測**：發放道具時是否仍同時 +分。若仍有，屬另一耦合點需再查。

---

## ✅ 本次已修：#7 — GPS 指向標方向與手機轉向相反

### 根因
`client/src/components/game/solo/GpsMissionPage.tsx` 的 `getDirectionArrow()` 只用
GPS 經緯度算地理方位角（`atan2(dLng, dLat)`），**完全沒納入手機朝向（device heading）**。
箭頭固定在螢幕某角度、不隨手機轉動修正 → 玩家轉手機時箭頭相對真實世界反向偏移。

### 修法
沿用同專案已驗證的 `GpsMissionMap` 模式（同一 `useCompassHeading` hook + `bearingDegrees`）：
- 螢幕角度 = `(地理方位角 − 羅盤朝向 + 360) % 360`，玩家轉手機時箭頭同步跟著轉、正確指向真實目標。
- 地理方位角改用含緯度修正的 `bearingDegrees`（比原本粗略 `atan2` 準）。
- 加 iOS user-gesture 觸發 `compass.request()`（權限）。
- 無羅盤（桌機/未授權）→ fallback 絕對方位角，維持原可用性。

### 影響檔案
- `client/src/components/game/solo/GpsMissionPage.tsx`

### 驗證
- `npx tsc --noEmit` ✅
- 邏輯與已上線的 `GpsMissionMap` 完全一致（相對 heading 修正）
- ⚠️ 羅盤行為無法單元測試 → **最終需真機複測**（見時機表）

---

## ✅ 本次已修：#2 — 上一頁重複通關刷分

### 根因
`client/src/pages/GamePlay.tsx` 的 `handlePageComplete` 無條件 `newScore += reward.points`、
且照跑 `onCompleteActions`（含 add_score/add_item）。玩家點「上一頁」回頭重做已完成的頁時，
分數/道具重複累加。`completedPageIds` 明明已記錄哪些頁完成過，卻沒拿來擋重複給分。

### 修法
- 把計分/發道具/變數邏輯抽成純函式 `client/src/lib/completion-reward.ts` 的
  `computeCompletionReward()`（可單元測試、不可變）。
- 防護：同一 session 內、此頁已在 `completedPageIds`（先前已給過分）→ 回頭重做**不再給分/發道具**，仍允許正常導航。
- replay / 再玩一次 是**新 session**（completedPageIds 為空）→ 正常給分，不受影響。
- 分數是 client 累計後的**絕對值** PATCH 給 server，擋住 client 端即同時擋住持久化。

### 影響檔案
- `client/src/lib/completion-reward.ts`（新增純函式）
- `client/src/lib/__tests__/completion-reward.test.ts`（新增 6 測試）
- `client/src/pages/GamePlay.tsx`（改呼叫純函式、清掉不再用的 import）

### 驗證
- `npx tsc --noEmit` ✅
- `completion-reward.test.ts` 6/6 通過（首次給分、重複不給、道具不重發、add_score 重複略過、不可變）
- 註：`GamePlay.test.tsx` 為 pre-existing 失敗（缺 WebSocketProvider mock、與本次無關；編輯前版本同樣失敗）

---

## ✅ 本次已修：#4 — <380px 底部/右側按鈕被裁切

### 根因
`GamePlay.tsx` 底部導覽 `<nav>` 用固定 `px-4` + `gap-4` + 兩側「上一頁/下一頁」文字按鈕
+ 中間 3 顆圖示。在 <380px（尤其字級放大時）總寬超出 viewport → 右側「下一頁」被裁切、
並撐出橫向捲動連帶把右側畫面切掉。

### 修法（純 CSS / RWD）
- `<nav>`：`px-4→px-2 sm:px-4`、`gap-4→gap-1 sm:gap-4`。
- 兩側按鈕：加 `shrink-0 px-2 sm:px-3`；「上一頁/下一頁」文字用 `max-[379px]:hidden`
  在 <380px 隱藏（保留圖示 + aria-label，無障礙不受影響）。
- 中間圖示群加 `shrink-0`。
- 遊戲根容器加 `overflow-x-hidden` 作防線，任何子元素溢出都不再裁切右側。

### 影響檔案
- `client/src/pages/GamePlay.tsx`

### 驗證
- `npx tsc --noEmit` ✅（Tailwind 3.4.17 支援 `max-[379px]:` 任意變體）
- 純 CSS → **需視覺複測**：DevTools 或真機設 360/375px（見時機表）

---

## ✅ 本次已修：#3 — 訪客暱稱在多人模式顯示 user-xxx

### 根因
訪客在大廳輸入的暱稱只存 `localStorage["anonymous_player_name"]`，建 solo session 時帶到
`gameSessions.playerName`，**從沒寫進 users 表**。匿名 firebase user 的 `firstName` 為 null、
email 為 `user-xxx@firebase.local`，而隊伍成員列表用 `deriveDisplayName`（讀 users.firstName
→ email → id）顯示 → 落到 `user-xxx`。

### 修法（跨層、僅覆寫匿名帳號）
- Server `teams.ts`：create + join 兩個 endpoint 接受 optional `displayName`，
  新增 `persistGuestDisplayName()` 把暱稱寫進 `users.firstName`。
  **只針對匿名訪客（email `*@firebase.local`）覆寫**，保護 Google 真帳號名字。
- Client `useTeamLobby.ts`：create/join mutation 帶上 localStorage 的暱稱。
- 效果：`deriveDisplayName` 讀到 firstName → 成員列表、加入 toast、排行榜全站顯示正確暱稱。

### 影響檔案
- `server/routes/teams.ts`、`client/src/pages/team-lobby/useTeamLobby.ts`

### 驗證
- `npx tsc --noEmit` ✅
- ⚠️ 多人情境 → **需真機 e2e 複測**（訪客加入隊伍看成員列表；見時機表）

---

## 🔬 剩 4 項：不宜從程式碼盲改、已寫分析入 ProPlan

> 全部影響 live 生產遊戲，盲改會傷到正在遊玩的真實玩家。已在 ProPlan 各卡寫入工程分析 + 明確下一步。

| # | 分類 | 為何不盲改 | 下一步 |
|---|------|-----------|--------|
| #6 多人同步 | bug（狀態機 in-progress）| WebSocket 分散式狀態一致性，需多台裝置 + 弱網/切背景才浮現 | 3 台真機 e2e 錄時序 → 定位 |
| #5+#10 進度狀態 | bug（狀態機 in-progress）| `useSessionManager` 三態 + refetch race，已修 5+ 次，盲改易修 A 壞 B | 真機照步驟重現 + 抓 Network → 精準修 |
| #8 AR 拖曳/縮放 | 功能需求（open）| 非既有邏輯壞，是新功能；手勢+合成須真機相機測 | 功能 sprint、分支開發、真機驗證 |
| #9 AR 快門拍照/錄影 | 功能需求（open）| 需 canvas captureStream + MediaRecorder + 進度環，工程量中大 | 功能 sprint、分支開發、真機驗證 |

> 註：本文件 # 對應原賈村編號；ProPlan 匯出把 AR 兩項編為 #1/#2、多人為 #4、進度為 #5。

---

## 🕐 時機確認（給測試人員）

| 事件 | 時間點 | 說明 |
|------|--------|------|
| #11/#1 計分修復 commit | `5f4ab843`（playgc/main）| 修復進版本控制 |
| 部署生產 | 2026-07-02 00:12（台北）| game.homi.cc 已 rebuild、HTTP 200 healthy |
| 寫回 ProPlan 系統 | 2026-07-02 00:12 | #11→`testing`（待複測）、#1→`in-progress`（部分處理），各附處理紀錄 attempt |
| 複測開放 | 即刻起 | 測試員可回頭重測 #11、並用正式流程複測 #1 道具耦合 |

> ProPlan 面板：<https://plan.aihomi.cc/daily-ops/debug/37c5c6e0-8a06-4bf3-a27b-5899c0ae7cb3>
> #11 已在「處理中」分頁、含完整修復說明與複測步驟；#1 同分頁、含部分處理說明。

**複測 #11 步驟**：
1. admin 進 `游戲 555e252d.../items` 或選擇驗證元件設定，把「完成獎勵分數」設 0。
2. 玩家端 `f/HPSPACE/game/555e252d...` 完成該選擇驗證頁。
3. 觀察頁首分數：應**不增加**（0 分），toast 不再顯示 +10。
4. 再把分數設 50 複測 → 應 +50。

---

## 相關文件
- 計分/元件機制 → `docs/domains/`（如有 game-elements 文件）
- 部署流程 → `docs/runbooks/deploy.md`
- 版本紀錄 → `docs/CHANGELOG.md`
