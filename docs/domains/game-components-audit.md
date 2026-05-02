# 🎮 遊戲元件全面盤點報告

> **盤點時間**：2026-04-18
> **盤點範圍**：`client/src/components/game/` 下 16 個 pageType 元件 + FlowRouter lib + GamePageRenderer 整合層
> **盤點方法**：4 個獨立 agent 平行掃描，逐檔對照 schema、驗證分支路徑、檢查邊界條件
> **整體結論**：**16 個元件多數可運作但都有顯著缺口**。**根因**是核心元件的 `onComplete` 簽名缺 `nextPageId`，以及多個元件的 schema 欄位「寫了沒實作」—— 使用者所謂「遊戲跑不完」主要源自這些黑箱。

---

## 🔴 P0 — 立即修（影響遊戲能否通關的根因）

### 🚨 最高優先：通用 `onComplete` 簽名 bug

**影響元件**：`TextCardPage` / `DialoguePage` / `VideoPage`

三個元件的 `onComplete` 型別簽名**缺少第二個參數 `nextPageId`**，導致從這三類頁面的**分支路由全部失效**，即使 DB 裡存了 `nextPageId`，玩家永遠只能線性前進。

```tsx
// 錯誤（TextCard/Dialogue/Video）
onComplete: (reward?: { points?: number; items?: string[] }) => void;

// 正確（ButtonPage 已經是這樣）
onComplete: (reward?, nextPageId?: string) => void;
```

**影響路徑**：`GamePageRenderer.tsx:57` 用 `as any` 掩蓋型別錯誤 → DB 正確存了 `nextPageId` 但三種頁面都丟掉。

**修復**：
- `TextCardPage.tsx:15`、`DialoguePage.tsx:9`、`VideoPage.tsx:9` 簽名補第二參數
- `handleContinue` / skip / autoAdvance 統一傳 `onComplete(reward, config.nextPageId)`
- `shared/schema/games.ts` 的 `TextCardConfig` / `DialogueConfig` / `VideoConfig` 加 `nextPageId?: string`

---

### 🔴 ConditionalVerifyPage（重災區）

**檔案**：`client/src/components/game/ConditionalVerifyPage.tsx`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| C1 | Local `Condition` interface 跟 schema 不一致（`"score_above"` vs schema 的 `"has_points"`） | L19-25 | **管理員建的 has_points 條件 100% 失效**（走 default=false） |
| C2 | `visitedLocations` prop 沒從 `GamePageRenderer` 傳入 | `GamePageRenderer.tsx:83-90` | **「去過 X 地」條件永遠 false** |
| C3 | `!fragment.sourceItemId` 預設「已收集」 | L260 | **管理員忘填 sourceItemId 的碎片看起來已收集，可裸破關** |
| C4 | `useEffect` deps `[]`，inventory/score 變動不重檢 | L219-223 | 玩家獲得道具後條件不更新 |
| C5 | `maxLength` 公式錯 | L299 | 多位數碎片永遠輸不滿 |

---

### 🔴 ShootingMissionPage（硬體計分失靈）

**檔案**：`client/src/components/game/ShootingMissionPage.tsx`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| S1 | 前端讀 `record.hitZone` / `hitPosition.x/y` / `points`，但 DB 欄位是 `targetZone` / 字串 `hitPosition` / `hitScore` | L85-98 | **命中計分全跑 fallback = 25 分，彈痕位置每次都隨機**，真實射擊數據完全丟失 |
| S2 | `POST /api/shooting-records` 沒 device 簽章驗證 | `devices.ts:217-255` | 任何人可偽造 WS 訊息刷分 |
| S3 | `simulateHit` 是死程式碼（46 行沒人呼叫） | L167-213 | 無硬體場地完全無法通關 |
| S4 | 倒數結束閉包讀到舊 state | L154-161 | 分數 / 命中數可能算錯 |

---

### 🔴 GpsMissionPage（裝飾品 bug）

**檔案**：`client/src/components/game/GpsMissionPage.tsx`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| G1 | **`fallbackQrCode` 按鈕完全沒實作**，點了只彈 toast | L378-393 | 玩家 GPS 訊號差時無救援，只能卡死 |
| G2 | `config.proximitySound` vs `soundEnabled` state 邏輯錯亂 | L73,132 | 靜音按鈕失效 |
| G3 | `showMap` schema 存在但未實作 | 整檔 | admin 開此開關無效 |
| G4 | 沒用 `position.coords.accuracy` 做加權 | L109-154 | 訊號差時可能誤判到達或無法到達 |

---

### 🔴 MotionChallengePage（iOS 必定失敗）

**檔案**：`client/src/components/game/MotionChallengePage.tsx`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| M1 | `DeviceMotionEvent.requestPermission()` 放在 `useEffect` 裡（非 user gesture 堆疊） | L139-152 | **iOS 14+ Safari 權限請求必定被拒**，iPhone 玩家 100% 失敗 |
| M2 | `DeviceOrientationEvent.requestPermission` 完全沒呼叫 | 全檔 | tilt/rotate 在 iOS 必失敗 |
| M3 | `challengeType: "jump"` 完全沒實作 | switch | 選到此類型必定失敗 |
| M4 | shake 第一次事件 delta 含重力 ≈ 30 必大於閾值 15 | L107 | `shakeCount` 永遠從 1 開始，`targetValue=1` 瞬間通關 |
| M5 | rotate 與 tilt 走相同 alpha | L122 | rotate 實作等同 tilt |

---

### 🔴 LockPage（可暴力破解）

**檔案**：`client/src/components/game/LockPage.tsx`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| L1 | 比對前沒 `trim()` | L97 | combination 有前後空白永遠失敗 |
| L2 | 無 rate limit + 失敗後無延遲 | L86-127 | 1 秒可暴力按完 5 次 |
| L3 | 數字鍵盤無 Backspace 鍵 | L130-145 | 輸錯只能全部清除重來 |
| L4 | Dial 模式 parseInt(undefined) = NaN → `"NaN"` 寫回 code[] | L57-60 | 比對永錯 |

---

### 🔴 TimeBombPage（swipe 未實作）

**檔案**：`client/src/components/game/TimeBombPage.tsx`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| T1 | Schema 的 `"swipe"` 類型完全沒實作 | L122-184 switch | 資料庫存了 swipe 任務會卡死到倒數爆炸 |
| T2 | 答錯 input/choice 無懲罰（不扣時間） | L88-110 | 玩家可無限嘗試 |
| T3 | setInterval 背景分頁 throttle 失準 | L35-52 | 切回時時間顯示錯位 |

---

### 🔴 VotePage（已修但記錄在此）

**狀態**：✅ **已修復並部署**（commit `6de0601`）

| # | 問題 | 狀態 |
|---|------|------|
| V1 | `minVotes` 預設 1 但若 admin 設 2 以上，單機玩家永遠卡死 | ✅ 已改 `??` 分辨 0 vs undefined |
| V2 | `handleContinue` 永遠走 self 的 nextPageId，忽略 schema 的 `nextPageStrategy` | ✅ 已實作 winner 模式並設為預設 |
| V3 | 倒數 effect 依賴 `selectedOption`，改選會重置倒數 | 🟡 **未修**，待下輪 |
| V4 | `autoAdvanceSeconds` schema 寫了沒實作 | ✅ 已實作 5 秒自動前進 |

---

### 🔴 Photo 後端 + iOS race

**檔案**：`client/src/components/game/photo-mission/*` + `server/routes/media.ts`

| # | 問題 | 位置 | 影響 |
|---|------|------|------|
| P1 | 後端 `playerPhotoSchema` **無大小上限** | `media.ts:132-141` | 大圖直接 OOM / 502 |
| P2 | 相機 `toDataURL(0.85)` 沒壓縮 | `usePhotoCamera.ts:181` | iPhone 4K 照片 2-5MB，上傳慢 |
| P3 | iOS `onloadedmetadata` + `attemptPlay` 有 double-play race | `usePhotoCamera.ts:96-141` | `play()` AbortError |

---

## 🟡 P1 — 本週應修（UX 嚴重）

### ButtonPage
- **B-1 `showStatistics` 是假資料** — `Math.random()` 生成，欺騙玩家（`ButtonPage.tsx:29-35`）
- **B-2 `randomizeOrder` + `defaultChoice` bug** — 洗牌後 `buttons[defaultIdx]` 對不上原意，時間到選錯按鈕（`ButtonPage.tsx:40-56`）
- **B-3 空 `buttons` 陣列完全卡死** — 無 fallback UI
- **B-4 `handleButtonClick` stale closure 可能雙重觸發** — timer 閉包問題

### VideoPage
- **V-1 `videoUrl` 空/壞掉無救援** — 沒 `onError`，`skipEnabled: false` 時 100% 卡死
- **V-2 影片自然結束不 auto-complete** — 玩家得找按鈕
- **V-3 `video.duration` 為 NaN 導致 progress = NaN**
- **V-4 schema 過於貧瘠** — 缺 `title` / `description` / `poster` / `rewardPoints`

### TextCardPage
- **T-1 `highlightKeywords` 正則未 escape** — keyword 含正則元字符會炸（`TextCardPage.tsx:96-99`）
- **T-2 typewriter + timeLimit 雙計時衝突** — 打字機沒跑完就被強制跳
- **T-3 `animation: "fade_in"` 未處理** — 走 default 落到 scaleIn

### DialoguePage
- **D-1 autoAdvance setTimeout 無 cleanup，玩家手動按「下一句」會跳過訊息** (L101-105)
- **D-2 autoAdvance 到最後一則不 onComplete** — 停住但無提示
- **D-3 skip 按鈕無確認** — 誤觸直接跳過劇情無 reward

### ChoiceVerifyPage
- **CV-1 Quiz 模式完全忽略 `nextPageId`**
- **CV-2 Schema 的 `randomizeOptions / timeLimit / multiple / partialCredit / showExplanation` 全未實作**

### TextVerifyPage
- **TV-1 只讀 `hints`（複數）不讀 `hint`（單數）** — 管理員設單 hint 按鈕不顯示
- **TV-2 點數寫死 10，不讀 `rewardPoints`**
- **TV-3 AI API 錯誤吞沒，玩家誤以為答錯還扣次數**

### FlowRouter
- **FR-1 `variable_equals` 用 `===` 沒做型別 coercion** — `"5"` vs `5` 永遠 false，管理員最隱蔽的 debug 痛點
- **FR-2 無 dev mode 決策 trace** — 管理員無法 debug

### Motion / TimeBomb 補齊
- **MC-補完** `jump` / rotate(alpha) 實作
- **TB-補完** `swipe` 手勢偵測

---

## 🟢 P2 — 下週以後（改善 / 重構）

### 通用基礎設施
1. 抽 `normalizeAnswer(s, caseSensitive)` helper（`client/src/lib/gameVerification.ts`）統一繁簡/全半形/大小寫，4 個驗證元件 + QR 都走
2. 把 `extractScanCode` 改名 `extractAnswerText` 移到上述 helper，供 NFC / 其他掃描介質重用
3. 抽 `useCountdown(endTimestamp)` hook，用 absolute time + `visibilitychange` 解決 setInterval 背景分頁 throttle 問題（影響 TimeBomb / Motion / Vote 倒數）
4. 新增 `<DevDebugPanel>` 元件，FlowRouter / Vote 在 DEV mode 顯示決策 trace

### 單元測試補齊
- 4 個驗證元件（TextVerify / ChoiceVerify / ConditionalVerify / Lock）**目前 0 測試**
- 4 個互動元件（TimeBomb / Motion / Vote / FlowRouter）**目前 0 測試**
- 應至少覆蓋：成功/失敗分支、配置邊界值、fallback 路徑

### Schema drift 防護
- 規則：**元件禁止重複定義已在 `@shared/schema` 存在的型別**（ConditionalVerifyPage 是本次發現的犯規者）
- CI 檢查：component 的 Config 介面不能 import 以外自行宣告

### 其他
- 遊戲狀態持久化：任務進行到一半關閉 → 再開要重玩，建議把 `hits` / `capturedImage` 等寫回 session variables
- Shooting `simulateHit` 恢復為可配置的「無硬體模式」
- GpsMission `showMap` 用 Leaflet 實作（注意 MEMORY 提到的「不能讓 React 管 Leaflet children」）
- 所有 Input 加 `autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}`

---

## 📊 嚴重度總覽表

| 元件 | P0 | P1 | P2 | 主要 bug |
|------|----|----|----|----------|
| TextCardPage | 1 (onComplete) | 3 | 3 | regex escape、typewriter+timer 衝突 |
| DialoguePage | 1 (onComplete) | 3 | 3 | autoAdvance 競爭、skip 無確認 |
| VideoPage | 1 (onComplete) | 4 | 2 | videoUrl 壞無救援、schema 貧瘠 |
| ButtonPage | 4 | 2 | 2 | 假統計、randomize+default、空 buttons |
| TextVerifyPage | 2 (hint/reward) | 3 | 3 | AI 錯誤吞沒 |
| ChoiceVerifyPage | 1 (quiz nextPage) | 5 (schema 未實作) | 2 | 5 個欄位未實作 |
| ConditionalVerifyPage | **5** | 3 | 3 | 整組 schema drift、visitedLocations 沒傳 |
| LockPage | 2 (trim/rate) | 3 | 3 | 無 backspace、dial NaN |
| ShootingMissionPage | **3** (欄位/簽章/無硬體) | 4 | 2 | 前後端欄位不一致 |
| PhotoMissionPage | 1 (後端大小) | 3 | 3 | iOS race、無壓縮 |
| GpsMissionPage | **4** (fallback/sound/map/accuracy) | 3 | 3 | fallback 是裝飾品 |
| QrScanPage | 0 (剛修) | 0 | 2 | isProcessing race |
| TimeBombPage | 1 (swipe) | 3 | 2 | setInterval throttle |
| MotionChallengePage | **3** (iOS/jump/shake 閾) | 4 | 2 | iOS 必失敗 |
| VotePage | ✅ 已修 | 1 (改選重置倒數) | 3 | 已部署 |
| FlowRouterPage | 1 (型別 coercion) | 3 | 2 | debug 困難 |
| **合計** | **30** | **45** | **40** | — |

---

## 🛠 推薦修補 PR 拆解

### PR1：`fix(onComplete)` — 通用簽名修復（高影響，低風險）
- TextCard / Dialogue / Video 的 `onComplete` 簽名補 `nextPageId`
- Schema 三個 Config 加 `nextPageId?: string`
- **預期效果**：立刻解鎖三類頁面的分支路由，使用者的「遊戲跑不完」最大根因
- **影響檔案數**：6

### PR2：`fix(ConditionalVerify)` — Schema drift 清理
- 刪 local interface，統一 import `@shared/schema`
- `has_points` / `visited_location` / `has_item` 全部重新對齊
- `GamePageRenderer` 補傳 `visitedLocations` prop
- `sourceItemId` 未設時預設「未收集」
- 修 `useEffect` deps
- **影響檔案數**：3

### PR3：`fix(mission)` — 硬體任務可用性
- Shooting：WS 欄位映射（hitZone/hitPosition/points）+ simulateHit 恢復為 `allowSimulation` 模式
- Gps：fallbackQrCode 實作 + 靜音按鈕修好 + accuracy 加權
- Motion：iOS 權限請求移到 startChallenge 同步呼叫 + jump 實作
- TimeBomb：swipe 實作 + 答錯扣時間
- **影響檔案數**：4 + 後端 1

### PR4：`fix(verify)` — 驗證類收尾
- LockPage：rate limit + trim + Backspace + dial NaN guard
- TextVerify：hint 單數相容 + rewardPoints 讀取 + AI 錯誤不扣次數
- ChoiceVerify：Quiz 補 nextPageId + randomize/timeLimit/multiple/showExplanation 實作
- 所有 Input 加 iOS autocomplete 關閉屬性
- **影響檔案數**：3 + schema 1

### PR5：`fix(static)` — 靜態頁體驗
- TextCard：regex escape + fade_in 動畫 + typewriter+timer race
- Dialogue：autoAdvance 清 timeout + skip 確認
- Video：onError + auto-complete + schema 擴充（title/description/poster/rewardPoints）
- Button：移除假統計 + randomize+default 修復 + 空 buttons fallback
- **影響檔案數**：4 + schema 1

### PR6：`fix(photo-backend)` — 後端安全
- `media.ts` base64 schema 加大小上限
- `usePhotoCamera` 拍照壓縮到 1920px 最大邊
- iOS race condition 修復
- **影響檔案數**：2 + 後端 1

### PR7：`feat(dev-tools)` — DEV 模式 debug
- `<DevDebugPanel>` 元件
- FlowRouter 決策 trace 顯示
- `variable_equals` 型別 coercion
- **影響檔案數**：2

### PR8：`test(game-components)` — 補齊單元測試
- 8 個元件各補 1 個 test 檔
- 覆蓋主成功路徑 + 失敗分支 + 邊界
- **影響檔案數**：8

---

## 📁 詳細報告（agent 原始產出）

本彙整基於 4 個獨立 agent 的詳細調查。每個 agent 報告皆含 code snippet、行號、嚴重度分級、具體修復建議範例：

1. **靜態類**（TextCard/Dialogue/Video/Button）：共 14 個 P0+P1 / 10 個 P2
2. **驗證類**（TextVerify/ChoiceVerify/ConditionalVerify/Lock）：共 9 個 P0 / 7 個 P1 / 7 個 P2
3. **任務類**（Shooting/Photo/Gps/QR）：共 7 個 P0 / 8 個 P1 / 多數 P2
4. **互動類**（TimeBomb/Motion/Vote/FlowRouter）：共 5 個 P0 / 多個 P1+P2

原始 agent 報告完整內容已在本文件依嚴重度與元件交叉彙整。

---

**總結**：建議依 PR1 → PR2 → PR3 → PR4 順序依次實作，每個 PR 後均需部署驗證，確保不引入回歸。PR1 單獨即可解決使用者「遊戲跑不完」的主要抱怨。
