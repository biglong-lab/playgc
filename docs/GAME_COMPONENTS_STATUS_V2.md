# 🎮 遊戲元件現況盤點與優化規劃 v2

> **盤點時間**：2026-04-19
> **前版**：`docs/GAME_COMPONENTS_AUDIT.md`（2026-04-18，8 PR 優化前）
> **本版目的**：記錄所有元件目前最新狀態、本週（4 PR + /loop 多輪）優化內容、並列出剩餘優化項目與優先序

---

## 📊 總覽

| 類別 | 元件 | 行數 | 狀態 | P0/P1/P2 待辦 |
|------|------|------|------|--------------|
| 📖 劇情 | TextCardPage | 428 | 🟢 穩定 | P2×1 |
| 📖 劇情 | DialoguePage | 294 | 🟢 穩定 | P2×1 |
| 📖 劇情 | VideoPage | 243 | 🟢 穩定 | P2×1 |
| 🎯 引導 | ButtonPage | 193 | 🟢 穩定 | – |
| 🎯 引導 | FlowRouterPage | 43 | 🟢 穩定 | – |
| 🔐 驗證 | TextVerifyPage | 398 | 🟢 穩定 | P2×1 |
| 🔐 驗證 | ChoiceVerifyPage | 276 | 🟡 普通 | P1×1, P2×1 |
| 🔐 驗證 | ConditionalVerifyPage | 508 | 🟡 複雜 | P1×2 |
| 🔐 驗證 | QrScanPage | 40 (+views/hook) | 🟢 穩定 | – |
| 🔐 驗證 | LockPage | 369 | 🟢 穩定 | P2×1 |
| 🏃 任務 | PhotoMissionPage | 217 | 🟢 穩定 | P1×1 |
| 🏃 任務 | GpsMissionPage | 455 | 🟢 穩定 | P2×2 |
| 🏃 任務 | MotionChallengePage | 399 | 🟢 穩定 | P2×1 |
| 🏃 任務 | ShootingMissionPage | 493 | 🟡 硬體相依 | **P0×1**, P1×1 |
| 💣 計時 | TimeBombPage | 357 | 🟢 穩定 | P2×1 |
| 🗳 協作 | VotePage | 485 | 🟢 穩定 | **P0×1** |

**狀態說明**：🟢 穩定且已優化 / 🟡 可運作但有進階需求 / 🔴 卡關或高風險

---

## 🟢 P0 → 已全數修復（4/18 後 8 PR + /loop 迭代）

| 原問題 | 狀態 | 修復 commit / PR |
|-------|------|------------------|
| TextCard/Dialogue/Video `onComplete` 少 `nextPageId` | ✅ 已修 | PR1 |
| ConditionalVerify schema 不一致（score_above vs has_points）| ✅ 已修 | PR2 |
| ConditionalVerify `!sourceItemId` 誤判已收集 | ✅ 已修 | PR2 + demoMode |
| ConditionalVerify useEffect deps 空 `[]` | ✅ 已修 | PR2 |
| ConditionalVerify `maxLength` 公式錯 | ✅ 已修 | PR2 |
| ShootingMission `hitZone` ↔ `targetZone` 欄位相容 | ✅ 已修 | PR3 |
| Photo iOS 相簿無法選 | ✅ 已修 | PR6（移除 capture=environment）|
| Photo 權限失敗無引導 | ✅ 已修 | PR6 |
| Button 空 buttons 崩潰 | ✅ 已修 | PR5 |
| FlowRouter 規則評估失效 | ✅ 已修 | PR7 |
| QR 掃描 NotFoundError（Leaflet 式 React 接管 DOM）| ✅ 已修 | `7b2cdae` 2026-04-18 |
| Vote「繼續下一關沒反應」 | ✅ 已修 | `canContinue = hasVoted` |
| 遊戲編輯器 super_admin 未經授權 | ✅ 已修 | `97e17a7` |
| 封面破圖（前後端雙重 transformation） | ✅ 已修 | `image-utils` hasExistingTransform 守門 |
| MapView `at Te` 崩潰 | ✅ 已修 | 改用 npm leaflet 取代 CDN |
| PWA 舊 bundle 黏性 | ✅ 已修 | `main.tsx` controllerchange auto-reload |

---

## 🟢 本週 /loop 迭代已完成（2026-04-19）

### UX / 視覺優化（第 1 波 6 項）

| # | 元件 | 優化內容 | Commit |
|---|------|---------|--------|
| 1 | GpsMission | 玩家端地圖顯示（react-leaflet + showMap）| `b5007c1` |
| 2 | MotionChallenge | 震動命中即時視覺回饋（脈動 +1 浮動 + 觸覺）| `c47e312` |
| 3 | ShootingMission | 命中標記顯全部+依區域上色+序號+漣漪 | `0dd73e9` |
| 4 | TimeBomb | 空 tasks fallback + 最後 10s 心跳震動 + Tap 即時回饋 | `036b64b` |
| 5 | Vote | Enter 鍵送出 + 觸覺 + 投票後焦點移到繼續鈕 | `7de728b` |
| 6 | TextVerify | 答錯立即可重試 + 卡片 shake + normalizeAnswer 一致化 | `77d295d` |
| 7 | ChoiceVerify | 重考只重做答錯題（P1.6）+ retry 徽章 | `8caef5a` |
| 8 | ShootingMission | WS 自動重連上限 5 次 + 手動重連按鈕 | `4ec9cf2` |

### 🧪 單元測試新增（第 2 波 5 檔案）

| 元件 | 測試數 | 重點 |
|------|--------|------|
| ChoiceVerifyPage | 6 | 重考只做答錯題、quiz/legacy 雙模式 |
| LockPage | 6 | 解鎖/失敗/rate-limit/字母大小寫 |
| TextVerifyPage | 6 | 精確匹配/AI fallback/立即重試/maxAttempts |
| VotePage | 7 | winner/self 策略/autoAdvance/isAdvancing 防重複 |
| TimeBombPage | 7 | 空 tasks fallback/4 種任務類型/爆炸出場 |
| **小計** | **32 測試** | 10 檔案 / 66 測試全部通過 ✅ |

### 🐛 真 bug 修復（第 3 波 12 個 production bug）

`/loop` 迭代過程中透過反向分析 useEffect cleanup 競態 / setState 非同步 / closure stale
抓到的 **生產環境邏輯 bug**（非新功能需求，是現有邏輯有問題）：

| # | 元件 | Bug 類型 | 影響 | Commit |
|---|------|---------|------|--------|
| 1 | TimeBomb | useEffect cleanup 清掉 onComplete timer | 空 tasks 永遠卡死 | `007c0cd` |
| 2 | TextCard | isTyping deps 觸發 cleanup 清 timer | typewriter + timeLimit 卡死 | `2c2f82c` |
| 3 | Shooting | WebSocket stale closure（handleStart 時 isStarted 尚未生效）| 靶機斷線永不重連 + 命中不記分 | `1d45682` |
| 4 | GPS | watchPosition stale closure + 到達無鎖 | watchPosition 永不停止 + 到達多次 onComplete | `d76e6d6` |
| 5 | Motion | handleComplete/handleFail 無防重複 | 達標繼續搖 → 多次 onComplete | `b74e5e6` |
| 6 | Button | isSubmitting stale closure + timer 競態 | 連點同按鈕或 timer 雙觸發 | `64cda56` |
| 7 | Video | finish 無鎖 | skip rage-click 或 ended+skip 雙觸發 | `22fdf10` |
| 8 | Dialogue | finishDialogue 無鎖 | 「結束對話」rage-click 雙觸發 | `22fdf10` |
| 9 | Lock | submit 連點無鎖 | 解鎖成功連點 → 雙 onComplete | `22fdf10` |
| 10 | ConditionalVerify | handleContinue 無鎖 | 「繼續」連點雙觸發 | `47a20ca` |
| 11 | ChoiceVerify | quiz + legacy submit 無鎖 | submit 連點雙觸發 | `47a20ca` |
| 12 | TextVerify | handleCorrect/Incorrect 無鎖 | AI race 或 mash Enter 雙觸發 | `b537c49` |

**共通修法模板**：
```tsx
const finishedRef = useRef(false);
const handleDone = () => {
  if (finishedRef.current) return;
  finishedRef.current = true;
  onComplete(...);
};
```

**根因模式**（給未來 review 者當 checklist）：
1. `setState(newValue)` 後立刻用舊 closure 中的變數 → **用 ref**
2. `useEffect(...)` 的 cleanup 含 `clearTimeout/clearInterval`，若 deps 頻繁變動會取消合法 timer → **把 deps 收窄或搬 timer 到 ref**
3. WebSocket / 感測器 / geolocation callback 的 closure 只綁一次，後續 state 變化讀不到 → **用 ref**
4. 任何會呼叫 `onComplete` 的終局路徑都要有 **一次性鎖**（`finishedRef` / `isResolvedRef`）

---

## 📋 各元件詳細現況與建議

### 📖 劇情類

#### 1. TextCardPage（428 行）🟢
**功能**：文字卡片展示 + 打字機效果 + timeLimit 自動前進 + 背景音樂。
**已實作**：typing speed / animation / highlightKeywords / timeLimit / autoAdvance / tryAutoPlayAudio（第一次點擊觸發）
**剩餘**：
- 🟡 P2：多段文字（目前單一 text）可考慮支援 `messages[]` 陣列

#### 2. DialoguePage（294 行）🟢
**功能**：多角色對話 + emotion + typing speed + 「結束對話」明示。
**已實作**：`messages[]` + 「結束對話」按鈕閃爍 + handleSkip 3s 確認機制 + animate-pulse
**剩餘**：
- 🟡 P2：支援角色頭像 avatar URL（schema 已有 `speaker.avatar`，元件尚未渲染）

#### 3. VideoPage（243 行）🟢
**功能**：影片播放 + forceWatch + autoCompleteOnEnd + poster + description。
**已實作**：onComplete nextPageId / skipEnabled / mute toggle / ended handler / error fallback
**剩餘**：
- 🟡 P2：自動字幕（WebVTT `<track>` 尚未支援）

---

### 🎯 引導類

#### 4. ButtonPage（193 行）🟢
**功能**：多選按鈕分支 + randomizeOrder + defaultChoice + timeLimit + items 獎勵。
**已實作**：空 buttons fallback / `_originalIndex` 保留 defaultChoice 指向 / 測試覆蓋 4 case。
**剩餘**：無。

#### 5. FlowRouterPage（43 行）🟢
**功能**：純路由元件（實作 fallback UI），邏輯在 `lib/flow-router.ts` 的 `evaluateFlowRouter`。
**已實作**：GamePlay 預先解析 + fallback 安全網（玩家直接落頁會自動跳轉）。
**剩餘**：無。

---

### 🔐 驗證類

#### 6. TextVerifyPage（398 行）🟢
**功能**：文字答案驗證 + AI 語意評分 + 漸進式提示 + 嘗試次數記錄。
**已實作**：normalizeAnswer / AI fallback 不扣次數 / shake 動畫 / 立即重試 / IME 安全 Enter / 觸覺回饋。
**剩餘**：
- 🟡 P2：打錯 3 次以上自動顯示第一個提示（目前需手動點擊提示鈕）

#### 7. ChoiceVerifyPage（276 行）🟡
**功能**：單選題 + quiz 模式（多題）+ rewardPerQuestion + passingScore。
**已實作**：quiz / legacy options 雙模式 / 重考流程。
**剩餘**：
- 🟠 **P1**：quiz 答錯後重考會 reset 全部答案（UX 不佳，應該只重做答錯題）
- 🟡 P2：題目間缺切換動畫，建議加 slide 轉場

#### 8. ConditionalVerifyPage（508 行）🟡（最複雜元件）
**功能**：依條件驗證（has_item/has_points/visited_location）+ 碎片組合模式 + demoMode（無 sourceItemId 時自動過關）。
**已實作**：FragmentConfig 物件化 / inventorySet String 轉換相容 / visitedLocations / demoMode 開關。
**剩餘**：
- 🟠 **P1**：元件 508 行超過規範 500 行上限，建議拆分為
  - `ConditionalVerifyPage.tsx`（主容器）
  - `useConditionalValidation.ts`（條件評估 hook）
  - `FragmentCollection.tsx`（碎片 UI）
- 🟠 **P1**：缺單元測試（其他驗證類都已有）
- 🟡 P2：`visitedLocations` 狀態更新時機不明顯，建議加 toast「已到過某地」

#### 9. QrScanPage（40 行 + views/hook）🟢
**功能**：QR 掃描 + 手動輸入 fallback + 成功/失敗狀態機。
**架構**：已拆成 `useQrScanner` hook + `QrScanViews` 5 個子 view。
**已實作**：html5-qrcode DOM 隔離 / 前後鏡頭 fallback / 詳細錯誤訊息 / 手動輸入 fallback。
**剩餘**：無。

#### 10. LockPage（369 行）🟢
**功能**：密碼鎖（數字/字母）+ attempts + 44px 按鈕。
**已實作**：Apple HIG 觸控目標 / 字母鍵盤 / 數字鍵盤 / hint 支援。
**剩餘**：
- 🟡 P2：密碼鎖輸入時缺倒數計時壓力模式（schema 有 `timeLimit` 欄位）

---

### 🏃 任務類

#### 11. PhotoMissionPage（217 行）🟢
**功能**：拍照任務 + AI 驗證 + 相簿選擇 + 重試/跳過。
**已拆**：`PhotoViews.tsx`（InstructionView / CameraView / PhotoPreview / UploadingView / VerifyingView / AiFailView）。
**已實作**：iOS 相簿選單 / 相機錯誤 banner / retry 次數限制。
**剩餘**：
- 🟠 **P1**：缺單元測試 + AI 驗證失敗率 > 20% 時建議自動降級為「手動審核」mode

#### 12. GpsMissionPage（455 行）🟢
**功能**：GPS 定位 + 距離計算 + 地圖顯示 + 熱區語音 + QR fallback。
**已實作**：本週加入 `GpsMissionMap`（react-leaflet）/ proximity beep / hotZoneHints。
**剩餘**：
- 🟡 P2：長時間 watchPosition 耗電，建議加「已到達」後自動停止 watch
- 🟡 P2：距離顯示目前是直線距離，室內會誤導，建議加「請依建築內指引前往」提示

#### 13. MotionChallengePage（399 行）🟢
**功能**：震動/跳躍/傾斜/旋轉挑戰 + iOS 權限請求 + timer。
**已實作**：本週加入即時視覺回饋（脈動 +1 + hit counter + 觸覺）/ 4 種 challengeType 都觸發。
**剩餘**：
- 🟡 P2：缺單元測試（感測器 API 需 mock）

#### 14. ShootingMissionPage（493 行）🟡
**功能**：WebSocket 接收靶機訊號 + 模擬模式 + 區域計分 + 命中視覺。
**已實作**：本週加入命中依區域上色 + 序號 + 漣漪動畫；欄位相容 hitZone/targetZone。
**剩餘**：
- 🔴 **P0**：**作弊防護** — 前端模擬模式可直接呼叫 `simulateHit`，生產場域若未關閉 `allowSimulation` 可能被玩家利用。建議：
  1. 後端 API 要求 HMAC 簽章（`deviceId + sessionId + timestamp`）
  2. 編輯器 UI 明顯警示「開啟模擬會允許玩家自己加分」
  3. 生產遊戲強制 `allowSimulation=false`
- 🟠 **P1**：WebSocket 斷線後無手動重連按鈕（目前 3s 自動重連無上限），玩家若等太久沒反應會以為當掉

---

### 💣 計時類

#### 15. TimeBombPage（357 行）🟢
**功能**：多任務拆彈（tap/input/choice/swipe）+ 時間懲罰 + 空任務 fallback。
**已實作**：本週加入空 tasks fallback + 最後 10s 心跳震動 + Tap +1 浮動。
**剩餘**：
- 🟡 P2：缺 3-2-1 戲劇化開場倒數（遊戲體感可提升）

---

### 🗳 協作類

#### 16. VotePage（485 行）🟢
**功能**：選項投票 + 自動前進倒數 + showResults + winner strategy。
**已實作**：單機 per-player 模式 / handleContinueRef 避免 stale closure / Enter 鍵送出 / 觸覺 / 焦點自動跳繼續鈕。
**剩餘**：
- 🔴 **P0**：**團隊同步投票** — 目前 `variables` 只存單機，多人真實投票需後端 API
  1. 新增 `POST /api/sessions/:id/vote` + WebSocket broadcast
  2. `minVotes` 欄位才能真正生效
  3. 加入「已 X/Y 人投票」即時顯示
  > 註：本項需求來源於使用者先前提的「團隊投票後端同步」待辦。
- 🟡 P2：votingTimeLimit > 0 時建議加「最後 5 秒紅色全螢幕脈動」警示

---

## 🛠 編輯器端現況

| 編輯器 | 狀態 | 備註 |
|--------|------|------|
| CommonNavigationEditor | 🟢 | 通用 nextPageId + rewardPoints（排除路由類）|
| PageConfigEditor | 🟢 | Inline editors 分散到 `page-config-inline-editors.tsx` |
| ButtonConfigEditor | 🟢 | randomize / defaultChoice / items / icon |
| VoteEditor | 🟡 | 需加 **團隊模式 toggle**（P0 後端實作時搭配）|
| TimeBombEditor | 🟢 | 4 種任務類型 |
| LockEditor | 🟢 | 密碼 + attempts + hint |
| ConditionalVerifyEditor | 🟢 | sourceItemId dropdown + conditions editor + demoMode toggle |
| FlowRouterEditor | 🟢 | valueType 已補 |
| MotionChallengeEditor | 🟢 | challengeType + targetValue + timeLimit |
| ChapterConfigEditor | 🟢 | unlockConfig 動態 UI（本次新增）|
| EventsEditor | 🟢 | 事件系統 |
| OnCompleteActionsEditor | 🟢 | add_item / add_points / set_variable / grant_item |

**共同剩餘**：
- 🟡 P2：**預覽抽屜** — 編輯中即時預覽效果（避免反覆存 → 切到玩家端看）
- 🟡 P2：**批次複製頁面** — 目前只能一頁一頁新增，若要批次建 10 題測驗很繁瑣

---

## 🎯 優先序總結（按工作量）

### 🔴 P0（1-2 天內應處理）
1. **ShootingMission 作弊防護** — 後端 HMAC 簽章 + 編輯器警示（半天）
2. **Vote 團隊同步投票** — 新增 API + WebSocket 廣播（1 天）

### 🟠 P1（本月內）
3. **ConditionalVerifyPage 拆分** — 508 行超過規範，拆成 3 個檔案（半天）
4. **ConditionalVerify / Photo / Motion 單元測試** — 補齊 3 個元件（1 天）
5. **ShootingMission WS 手動重連按鈕** — 斷線時顯示「點此重連」（1 小時）
6. **ChoiceVerify 重考只重做答錯題**（2 小時）

### 🟡 P2（有空再做）
7. 各元件的小 UX 提升（avatar / 字幕 / 3-2-1 倒數 / 壓力模式等）
8. GpsMission 到達後自動停 watchPosition
9. 編輯器預覽抽屜
10. 編輯器批次複製頁面

---

## 📐 通用架構注意事項

1. **500 行上限原則**：目前違規者僅 ConditionalVerify（508）。TextCard 428、ShootingMission 493、GpsMission 455、Vote 485 都在邊緣，新增功能時要警覺。
2. **onComplete 簽名統一**：`(reward?, nextPageId?) => void` — 16 個元件皆一致 ✅
3. **觸覺回饋推廣**：本週已在 Motion/TimeBomb/Vote/TextVerify 加入，可考慮擴到 Lock/Choice/QR。
4. **PWA 更新黏性**：`main.tsx` 的 controllerchange auto-reload 已生效，新 feature 上線後使用者無需手動更新 app。
5. **第三方 DOM library 陷阱**：html5-qrcode 與 Leaflet 已用 hook/react-wrapper 隔離，未來若引入 Chart / Video player 等類似 library 須遵循相同原則。

---

## 📝 下一步建議

依現有 `/loop 請針對元件再做確認，細部確認與優化` 的節奏，建議接下來三輪聚焦：

1. **下一輪**：ChoiceVerify 重考只做答錯題（P1.6）
2. **下下輪**：ShootingMission WS 手動重連（P1.5）
3. **下下下輪**：ConditionalVerify 元件拆分準備（P1.3 先做目錄規劃）

需求較大的 P0（Vote 後端同步、Shooting HMAC）建議單獨排一個子任務處理，避免 /loop 逐輪間 context 中斷影響品質。
