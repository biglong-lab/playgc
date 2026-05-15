# 遊戲元件 Top 10 深度盤點分析 — 2026-05-15

> 範圍：行數最大 + 高風險訊號的 10 個元件、5 維度全面分析（細緻優化 / 介面完善 / 使用體感 / 效能優化 / 功能穩定）
> 狀態：**🟢 盤點分析完成**（純分析、不含修補實作）
> 來源：35 元件盤點後選 Top 10、佔全體程式碼 46%（6,198 / 13,544 行）

---

## 一、Top 10 清單（行數降序）

| # | componentType | 路徑 | 行數 | 埋點 | 情境 |
|---|---------------|------|------|------|------|
| 1 | photo_burst | solo/PhotoBurstFlow.tsx | 873 🚨 | ❌ | ❌ |
| 2 | photo_ar | solo/PhotoArStickerFlow.tsx | 809 🚨 | ❌ | ❌ |
| 3 | shooting_mission | solo/ShootingMissionPage.tsx | 643 | ❌ | ❌ |
| 4 | conditional_verify | solo/ConditionalVerifyPage.tsx | 623 | ❌ | ✅ |
| 5 | choice_verify_race | multi/ChoiceVerifyRacePage.tsx | 573 | ✅ | ❌ |
| 6 | gps_mission | solo/GpsMissionPage.tsx | 569 | ✅ | ✅ |
| 7 | photo_team | multi/PhotoTeamGather.tsx | 537 | ✅ | ❌ |
| 8 | dialogue | shared/components/DialoguePage.tsx | 530 | ❌ | ❌ |
| 9 | photo_spot | solo/PhotoSpotFlow.tsx | 528 | ❌ | ❌ |
| 10 | photo_compare | solo/PhotoCompareFlow.tsx | 513 | ❌ | ❌ |

🚨 = 行數已破 800 紅線

---

## 二、症狀矩陣（量化指標）

| 元件 | 行數 | useState | useEffect | useMemo | useCallback | try | catch | console.* | toast | aria | Loading | Error | transition |
|------|------|---|---|---|---|---|---|---|---|---|---|---|---|
| photo_burst | 873 | 10 | 6 | 0 | 0 | 7 | 10 | **18** ⚠️ | 6 | 1 | 0 | 4 | 4 |
| photo_ar | 809 | 10 | 5 | 0 | 0 | 5 | 6 | 0 | 7 | 0 | 0 | 12 | 3 |
| shooting_mission | 643 | 9 | 6 | 0 | 3 | 1 | 1 | 0 | 15 | 0 | 0 | 1 | 3 |
| conditional_verify | 623 | 8 | 5 | 5 | 0 | **0** | **0** ⚠️ | 0 | 10 | 0 | 0 | 6 | 6 |
| choice_verify_race | 573 | 5 | 8 | 4 | 4 | 0 | 3 | 0 | 3 | 0 | 7 | 12 | 0 |
| gps_mission | 569 | 9 | 4 | 0 | 7 | 1 | 1 | 0 | 8 | 1 | 0 | 17 | 7 |
| photo_team | 537 | 7 | 3 | 0 | 2 | 2 | 3 | 2 | 3 | 1 | 0 | 3 | 1 |
| dialogue | 530 | 6 | 4 | 0 | 0 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 6 |
| photo_spot | 528 | 4 | 2 | 0 | 0 | 2 | 2 | 1 | 9 | 3 | 0 | 12 | 3 |
| photo_compare | 513 | 6 | 2 | 0 | 0 | 3 | 3 | 1 | 8 | 0 | 0 | 7 | 3 |

⚠️ = 嚴重訊號

---

## 三、五維度共通問題（出現 ≥ 5 個元件）

| 共通問題 | 影響元件數 | 維度 |
|---------|----------|------|
| **useMemo 完全缺**（=0） | 8/10 | 效能優化 |
| **useCallback 完全缺**（=0） | 5/10 | 效能優化 |
| **無 framer-motion**（=0） | 10/10 | 使用體感 |
| **無顯式 Loading state 名稱** | 9/10 | 介面完善 |
| **aria-* 不足**（≤ 1） | 8/10 | 介面完善 |
| **try/catch 不足**（< 2） | 6/10 | 功能穩定 |
| **toast 過量**（≥ 8） | 6/10 | 使用體感（通知疲勞） |

---

## 四、逐元件深度分析

### 1. photo_burst（873 行 🚨）

**事實**
- 路徑：`client/src/components/game/solo/PhotoBurstFlow.tsx`
- Stage 機型 7 個：intro / preview / countdown / shooting / uploading / compositing / done
- 含 4 個 useRef（finishedRef / burstImagesRef / burstTagRef / skipGifRef）
- 18 個 console.*（debug 殘留嫌疑）

**細緻優化** (P0: 2 / P1: 2)
- **P0** 行數 873 破 800 紅線、建議拆 3 個子件（BurstCamera / BurstUpload / BurstResult），預估 6-8h
- **P0** 7-state Stage union + useState、應改 useReducer（單一 dispatch、易追蹤狀態流轉）
- **P1** 4 個 useRef 並用、考慮合成單一 stateRef 物件
- **P1** 移除 18 個 console.\*（部分為 debug 殘留、違反 CLAUDE.md「禁 console.log」）

**介面完善** (P0: 2 / P1: 2 / P2: 1)
- **P0** 缺 explicit Loading state UI（uploading / compositing 用 stage 駕馭、但 query 載入無 fallback）
- **P0** aria-* 只有 1 處、camera / 倒數 / 拍照按鈕缺 aria-label 與 aria-live
- **P1** 倒數計時器無視障輔助（缺 aria-live="polite"）
- **P1** Stage 跳轉缺視覺進度（intro→preview→countdown→…7 步玩家心智地圖弱）
- **P2** 「下載 / 分享」按鈕 disabled 狀態回饋不清

**使用體感** (P0: 1 / P1: 3)
- **P0** 7 個 stage 切換無動畫過渡（無 framer）— 玩家覺得「斷」
- **P1** 拍照快門無 haptic feedback（手機可加 navigator.vibrate）
- **P1** toast 6 次但無 dedup（連拍可能彈 4 個 toast 疊）
- **P1** compositing 階段進度文字「準備中…」過簡（應給預估秒數）

**效能優化** (P0: 3 / P1: 2)
- **P0** 0 useMemo + 0 useCallback — onComplete callback / config 物件 每次 render 都新建、子件白白重 render
- **P0** burstImages 用 base64 陣列存記憶體（連拍 4 張可能 > 20MB）
- **P0** Cloudinary 合成是 server 端、但前端先用 client-collage fallback — 雙重合成耗 CPU
- **P1** lucide-react 7 個 icon 直 import、應拆 dynamic import
- **P1** apiRequestWithTimeout 多次呼叫、無 abort controller

**功能穩定** (P0: 2 / P1: 3)
- **P0** try 7 但 catch 10、不對稱 — 表示有 `.catch()` chain（行為較弱）+ 上層 catch 重複
- **P0** finishedRef 防重複完成、但 race condition：上傳途中業主取消會卡住
- **P1** 連拍中相機被切（用戶切回 home 又回來）— stage 不會 recover
- **P1** 網路斷線：上傳失敗無 retry、只 toast 一次
- **P1** Cloudinary 額度耗盡 → fallback 路徑不明

**總體**：P0 = 10 / P1 = 12 / P2 = 1 / 預估修補 12-15h

---

### 2. photo_ar（809 行 🚨）

**事實**
- AR 貼圖 + 臉部錨定（FaceLandmarker WASM）
- 已做效能優化：FACE_DETECT_FRAME_INTERVAL=2（半 FPS）
- Dialog opt-in 同意機制（合規）
- requestAnimationFrame loop

**細緻優化** (P0: 1 / P1: 2)
- **P0** 行數 809 破 800、建議拆 ArFaceTracker / ArStickerCanvas / ArResult
- **P1** Sticker position type 7 種、用 Map / Record 取代 switch-case 更乾淨
- **P1** 0 useMemo + 0 useCallback、`positionToStyle` 每幀重算

**介面完善** (P0: 2 / P1: 2)
- **P0** aria-* = 0、Dialog 視障使用者進不來
- **P0** 缺 face detection 失敗 fallback UI（只有 toast、看不到「人臉偵測失敗、改用固定模式」）
- **P1** Sticker preview 載入無 skeleton
- **P1** 同意 Dialog 缺「為什麼需要這個」延伸說明（合規友善度）

**使用體感** (P0: 1 / P1: 3)
- **P0** AR sticker 跟隨人臉無平滑（直接 x/y 變換、未做緩動）
- **P1** WASM 載入時間長（首次 1-3 秒）、缺 loading 提示
- **P1** 切前後鏡頭 sticker 會抖一下
- **P1** 拍照 shutter 動畫缺（無快門聲 / 閃白回饋）

**效能優化** (P0: 2 / P1: 2)
- **P0** rAF loop 持續跑、即使 sticker 沒動也在 detect — 應加 throttle 或 idle 暫停
- **P0** Canvas draw 在主執行緒、考慮 OffscreenCanvas
- **P1** WASM 載入無 prefetch（進元件後才下載）
- **P1** FaceLandmarker close 時機需驗證（unmount 時 close、否則記憶體洩漏）

**功能穩定** (P0: 2 / P1: 2)
- **P0** try 5 / catch 6 — 不對稱、且 WASM init 失敗 fallback 邏輯不明
- **P0** 同意被拒後再進入元件、邏輯不確定（重新問？跳過？）
- **P1** 多次切換相機 + face landmarker、可能 memory leak
- **P1** localStorage FACE_CONSENT_KEY 過期策略無

**總體**：P0 = 8 / P1 = 11 / 預估修補 10-14h

---

### 3. shooting_mission（643 行）

**事實**
- useState 9、useEffect 6、try/catch 僅 1/1
- toast 15 次（最多）

**細緻優化** (P1: 3)
- **P1** 行數 643、接近上限但未破、建議重構為 ShootingControls + ShootingScoreboard
- **P1** 0 useMemo、score / target 計算每 render 跑
- **P1** useCallback 3 但不完整、event handlers 多數仍每次新建

**介面完善** (P0: 2 / P1: 1)
- **P0** aria-* = 0、無視障支援
- **P0** 缺 Loading state 顯式定義（async 操作開始前 UI 凍結）
- **P1** Score 顯示無 animation（瞬跳）

**使用體感** (P0: 1 / P1: 3)
- **P0** 15 次 toast 過量、玩家「通知疲勞」風險高
- **P1** 射擊回饋無 haptic（命中 / miss 無震動）
- **P1** 命中音效 / 視覺特效不清楚
- **P1** 倒數計時無危急視覺（最後 5 秒應紅閃）

**效能優化** (P0: 1 / P1: 1)
- **P0** try/catch 1/1 + useEffect 6 — 副作用密集但錯誤處理薄、可能漏網之魚
- **P1** target 陣列重新計算每次都跑（缺 useMemo）

**功能穩定** (P0: 3)
- **P0** try/catch = 1/1 — **嚴重不足**、9 個 useState 任一 setter 出錯都會 crash
- **P0** 多人模式同步衝突未處理（如多人同時 hit 同一靶）
- **P0** 計分 race condition：倒數結束的瞬間還有彈道飛行、結算邏輯不明

**總體**：P0 = 7 / P1 = 8 / 預估修補 10-12h

---

### 4. conditional_verify（623 行）

**事實**
- useState 8、useMemo 5（有做）、useCallback 0
- **try/catch = 0/0** ⚠️ 完全無錯誤處理
- 5/13-14 業主大批修補（碎片切割）
- 已標情境（gov, private, event, space）✅

**細緻優化** (P0: 1 / P1: 2)
- **P0** 行數 623、建議拆 FragmentList + ConditionChecker + VerifyResult
- **P1** useState 8 散裝、考慮 useReducer
- **P1** useMemo 5 但 useCallback 0（不對稱、event handler 仍每次新建）

**介面完善** (P0: 2 / P1: 2)
- **P0** aria-* = 0 + Dialog 進入失敗無焦點管理
- **P0** 缺 Loading state（fragments 還在載入時 UI 空白）
- **P1** 碎片視覺一致性（image / text 模式切換時樣式跳）
- **P1** 失敗訊息「failureMessage」未口語化（多顯示開發者文字）

**使用體感** (P0: 1 / P1: 3)
- **P0** 碎片組合過程無動畫（瞬間達成、玩家少了完成感）
- **P1** demoMode 切換指引不明（業主測試時容易誤觸）
- **P1** 6 個 transition 但 hover / focus 不一致
- **P1** 答對 / 答錯回饋音效缺

**效能優化** (P0: 1 / P1: 2)
- **P0** useMemo 5 但仍可能重複計算（依賴陣列若漏）
- **P1** fragment image 大圖載入無 lazy / preload 策略
- **P1** verificationMode 三選一邏輯每次都跑

**功能穩定** (P0: 3 / P1: 1)
- **P0** **try/catch = 0**、normalizeFragments / validate 失敗會 unhandled
- **P0** fragmentCount 與 fragments[] 長度可能不一致（5/14 stale closure bug 證明）
- **P0** 5/14 stale closure 補丁後、需驗證所有 edge case
- **P1** 業主切換 fragmentSource (text↔image) 時、舊資料殘留

**總體**：P0 = 7 / P1 = 8 / 預估修補 10-12h（含補錯誤處理是重點）

---

### 5. choice_verify_race（573 行 / 多人）

**事實**
- useState 5、useEffect 8（最多）— 大量副作用同步
- useMemo 4 / useCallback 4 — **唯一有完整優化的元件**
- Loading 字眼 7、Error 12 — 有處理意識
- 埋點接通 ✅

**細緻優化** (P1: 2)
- **P1** 行數 573、結構相對健康、不急拆但可考慮抽出 RaceTimer / RaceScoreboard
- **P1** useEffect 8 過多、應該 group 合併相關副作用

**介面完善** (P0: 1 / P1: 2)
- **P0** aria-* = 0、即時對戰元件無視障支援
- **P1** Loading state 雖有但分散 7 處、應集中
- **P1** 倒數時間無危急視覺（最後 3 秒）

**使用體感** (P1: 3)
- **P1** 0 transition — 完全無動畫
- **P1** 答題切換無過渡（玩家覺得跳）
- **P1** 多人即時排名變化無 reorder 動畫

**效能優化** (P0: 0 / P1: 2)
- **P1** useEffect 8 + WebSocket 同步、可能引發過度 re-render
- **P1** 已用 useMemo + useCallback 是亮點、但仍可優化 deps

**功能穩定** (P0: 2 / P1: 1)
- **P0** try/catch = 0/3 — catch chain 3 個、無同步錯誤捕捉
- **P0** 多人 race condition：兩人同時答對同一題的結算
- **P1** WS 斷線 grace 處理需驗證（與 squad 系統整合）

**總體**：P0 = 3 / P1 = 10 / 預估修補 8-10h（最健康的一個）

---

### 6. gps_mission（569 行）

**事實**
- useState 9、useCallback **7（最多）**、useMemo 0
- toast 8 / Error 17（最多）
- aria 1
- 已埋點 + 已標情境 ✅✅

**細緻優化** (P1: 2)
- **P1** 行數 569、可拆 GpsTracker / GpsArrow / GpsScoreboard
- **P1** useState 9 散裝、useCallback 7 — 不對稱、考慮 useReducer

**介面完善** (P0: 1 / P1: 2)
- **P0** Error 字眼 17 但 aria-live 缺、視障 / 螢幕閱讀器拿不到
- **P1** GPS 權限拒絕後 UI 引導不明
- **P1** 室內 GPS 漂移時、無「訊號弱」提示

**使用體感** (P0: 1 / P1: 3)
- **P0** 7 transition 但 5/14 補的「箭頭朝向」需驗證真實場域體感
- **P1** 距離數字 jitter（GPS 抖動讓玩家心煩）— 應 smooth 化
- **P1** 抵達目標時動畫 / 音效缺
- **P1** 多任務切換時 GPS 不必要重啟

**效能優化** (P0: 1 / P1: 2)
- **P0** useMemo = 0、距離計算每次 GPS update 都跑
- **P1** GPS watchPosition 多訂閱風險（unmount 時 clear？）
- **P1** Map / 箭頭 component 重 render 頻繁（GPS update 1/秒）

**功能穩定** (P1: 3)
- **P1** try/catch 1/1 — 不足（GPS API 多種 error code）
- **P1** 多任務切換 GPS state recovery
- **P1** 跨場域時 fieldId 變更後路徑緩存清理

**總體**：P0 = 3 / P1 = 12 / 預估修補 8-10h（接通 + 情境完整、相對成熟）

---

### 7. photo_team（537 行 / 多人）

**事實**
- useState 7、useCallback 2、try/catch 2/3
- 2 個 console.* 殘留
- 埋點接通 ✅

**細緻優化** (P1: 2)
- **P1** 行數 537、可拆 PhotoTeamCapture / PhotoTeamReview
- **P1** 2 個 console.* 移除

**介面完善** (P0: 1 / P1: 2)
- **P0** aria-* = 1（不足）
- **P1** 缺 Loading state 顯式
- **P1** 多人合照成員到齊回饋（誰還沒到？）

**使用體感** (P1: 3)
- **P1** 0 framer + 1 transition — 動畫稀疏
- **P1** 拍照倒數無視覺強化
- **P1** toast 3 次但無 dedup

**效能優化** (P1: 3)
- **P1** 0 useMemo、photo 物件 props 每次新建
- **P1** 多人 WS 同步可能 re-render 全部成員圖
- **P1** 上傳並行控制策略不明

**功能穩定** (P1: 3)
- **P1** 2/3 try/catch 不對稱
- **P1** 多人非同步：A 拍完 B 還沒進來、狀態定義不清
- **P1** 隊伍解散邊界

**總體**：P0 = 1 / P1 = 13 / 預估修補 8-10h

---

### 8. dialogue（530 行）

**事實**
- useState 6、useEffect 4、try/catch 2/3
- **toast 0、Error 字眼 0** — 完全無錯誤反饋給玩家
- 6 transition — 動畫有做
- 跨模式共用（solo + multi）

**細緻優化** (P1: 1)
- **P1** 行數 530、可拆 DialogueText / DialogueChoice

**介面完善** (P0: 2 / P1: 1)
- **P0** **無任何 toast / Error UI** — 玩家不知道哪裡出錯
- **P0** aria-* = 0、對話元件對視障最關鍵卻完全沒做
- **P1** Loading state 缺

**使用體感** (P0: 1 / P1: 2)
- **P0** 對話自動播放 / 跳過機制體感未驗證
- **P1** 6 transition 已做、但文字打字機效果可能太慢 / 太快
- **P1** 跳過按鈕位置 / 大小（手機誤觸風險）

**效能優化** (P1: 2)
- **P1** 0 useMemo / useCallback、對話 step 切換時整樹 re-render
- **P1** 多分支選項可能引發 ContextProvider re-render

**功能穩定** (P0: 1 / P1: 2)
- **P0** **無錯誤回饋給玩家**、try/catch 2/3 但失敗只有 console
- **P1** 跨模式 solo/multi 行為差異未驗證
- **P1** 分支選擇後跳轉 nextPageId 找不到時的 fallback

**總體**：P0 = 4 / P1 = 8 / 預估修補 7-9h（重點：補錯誤反饋 + a11y）

---

### 9. photo_spot（528 行）

**事實**
- useState **4**（最少）、useEffect 2
- aria 3（最多）✅ — 唯一有做 a11y 的元件
- toast 9、Error 12
- 1 個 console.* 殘留

**細緻優化** (P1: 1)
- **P1** 行數 528、結構相對單純、拆檔效益低

**介面完善** (P1: 2)
- **P1** aria-* = 3 已有但仍可加強（focus management）
- **P1** Loading state 缺

**使用體感** (P1: 3)
- **P1** 0 framer、3 transition、定點拍照引導動畫缺
- **P1** GPS 引導抵達定點時無慶祝動畫
- **P1** 拍照前 spot 預覽不夠突出

**效能優化** (P1: 2)
- **P1** 0 useMemo / useCallback
- **P1** spot 圖片載入策略

**功能穩定** (P1: 2)
- **P1** try/catch 2/2 對稱、但 toast 9 表示有大量 try catch chain
- **P1** GPS 漂移處理

**總體**：P0 = 0 / P1 = 10 / 預估修補 6-8h（相對輕量、收尾型元件）

---

### 10. photo_compare（513 行）

**事實**
- useState 6、useEffect 2、try/catch 3/3 對稱
- toast 8、Error 7
- 1 個 console.* 殘留

**細緻優化** (P1: 1)
- **P1** 行數 513、拆檔效益低、可保

**介面完善** (P0: 1 / P1: 1)
- **P0** aria-* = 0
- **P1** Loading state 缺

**使用體感** (P1: 3)
- **P1** 0 framer / 3 transition — 對比照轉場無動畫
- **P1** 雙照片並排無 swipe 對比 slider
- **P1** 結果頁無 share 預覽

**效能優化** (P1: 2)
- **P1** 0 useMemo / useCallback
- **P1** 兩張圖同時載入無優先級

**功能穩定** (P1: 1)
- **P1** try/catch 3/3 對稱（相對健康）

**總體**：P0 = 1 / P1 = 8 / 預估修補 6-8h

---

## 五、全域彙整

### 5.1 P0 優先佇列（依商業 ROI 排序）

| 順位 | 元件 | P0 原因 | 工時 |
|------|------|---------|------|
| 1 | photo_burst | 873 行破上限 + 18 console + base64 占記憶體 | 12-15h |
| 2 | photo_ar | 809 行破上限 + WASM cleanup 風險 + a11y 全缺 | 10-14h |
| 3 | shooting_mission | try/catch 1/1 嚴重不足 + 多人 race condition | 10-12h |
| 4 | conditional_verify | try/catch 0/0 + 5/14 stale closure 持續觀察 | 10-12h |
| 5 | dialogue | 完全無錯誤回饋給玩家 + a11y 全缺 | 7-9h |
| 6 | gps_mission | aria-live 缺、Error 17 拿不到 | 8-10h |
| 7 | choice_verify_race | a11y + race condition | 8-10h |
| 8 | photo_team | console 殘留 + 多人邊界 | 8-10h |
| 9 | photo_compare | aria 全缺 | 6-8h |
| 10 | photo_spot | 相對健康（a11y 已部分做） | 6-8h |

**P0 修補總工時：85-110h**
**P0 + P1 全跑：~ 200h**

### 5.2 五維度問題分布（10 元件累計 P0 + P1 點數）

| 維度 | P0 點數 | P1 點數 | 總計 | 最關注 |
|------|---------|---------|------|--------|
| 細緻優化 | 5 | 18 | 23 | photo_burst / photo_ar |
| 介面完善 | 12 | 16 | 28 | 全體 a11y 全缺 |
| 使用體感 | 6 | 26 | 32 | 全體無 framer / 動畫稀疏 |
| 效能優化 | 9 | 19 | 28 | 全體 useMemo 缺 |
| 功能穩定 | 12 | 19 | 31 | conditional / shooting 錯誤處理缺 |

**結論**：「介面完善」與「使用體感」是 Top 2 缺口（aria + 動畫）

### 5.3 共通可快速補的低風險修補（≤ 2h 一次性）

| 修補 | 影響元件 | 工時 | 風險 |
|------|---------|------|------|
| 加 framer-motion 基本切場動畫 | 10/10 | 4h | 🟢 低 |
| 補 aria-label + role | 10/10 | 6h | 🟢 低 |
| 補 useMemo / useCallback | 8/10 | 8h | 🟡 中（要測 deps） |
| 移除 console.\* 殘留 | 4/10 | 1h | 🟢 低 |
| 顯式 Loading state 命名 | 9/10 | 4h | 🟢 低 |

**快速勝利批：~ 23h、改善 5 維度的 ~40%**

### 5.4 不在本分析範圍

- ❌ 實際修補實作（要等業主決定哪些 P0 先動）
- ❌ Cyclomatic complexity 真實量測（需要 eslint-plugin-complexity 跑）
- ❌ Bundle size 真實量測（需要 build + analyzer）
- ❌ 真實 component_runs 完成率資料（生產才有、本地無）
- ❌ 真實使用者測試結果（要等 pilot）

---

## 六、建議下一步

### 立即可做（≤ 1h）
1. 移除 photo_burst 18 個 console.\*
2. 移除 photo_team / photo_compare / photo_spot 共 4 個 console.\*
3. 補完 `shared/component-scenarios.ts` 中 conditional_verify / gps_mission 以外的 8 個 Top 10 元件情境標註

### 本週（≤ 1 天）
4. 「快速勝利批」5 項一次性補（23h）
5. 跑生產 `/admin/completion-attribution` 抓真實放棄率 cross-reference 本分析

### 本月（需業主同意）
6. 拆 photo_burst + photo_ar 兩個破 800 元件（22-29h）
7. 補 conditional_verify / shooting_mission 錯誤處理（20-24h）

### Phase 6 候選
8. a11y 全平台補 WCAG 2.1 AA（≥ 40h）
9. framer-motion 動畫系統整合（≥ 30h）
10. 完成率歸因 dashboard 上線後、cross-reference 補修補真實「玩家放棄熱點」

---

## 七、相關文件

- [元件 → 情境 mapping](../../shared/component-scenarios.ts) — W3 已建
- [completion-attribution endpoint](/admin/completion-attribution) — W1 已部署
- [SLA dashboard](/admin/sla-dashboard) — W2 已部署
- [Phase 5 W17 規劃](.) — 真實付費客戶 → 用本分析優先修補
- [全域 35 元件盤點](.) — 本分析的 Top 10 之外還有 25 個元件待掃

---

## 八、本批限制（誠實揭露）

1. **基於程式碼靜態分析**：沒跑真實 e2e、沒看真實 component_runs 資料、沒做使用者測試
2. **5 維度有主觀成分**：「體感」「介面完善」依經驗判斷、業主可能不認同某些 P 級判定
3. **修補工時估是粗估**：實際拆檔可能遇到耦合 / 測試補齊額外耗時
4. **未涵蓋多語系 / 國際化**：i18n 範疇本分析未含
5. **未跑 lighthouse / web vitals**：效能優化建議來自模式分析、非真實量測

---

## 狀態

✅ **盤點分析完成** — 等業主選擇要先動哪個 P0。

不進行：實際修補（要等明確指示）。
