# 數位遊戲平台（賈村競技場）- 開發進度

## 專案概述

賈村競技場是一個實境遊戲平台，結合 QR Code 掃描、GPS 定位、團隊合作等互動機制，提供沉浸式戶外遊戲體驗。

## 技術棧

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **後端**: Express + WebSocket + MQTT
- **資料庫**: PostgreSQL 16 (Drizzle ORM)
- **認證**: Firebase Auth + 自訂管理員認證
- **媒體**: Cloudinary
- **地圖**: Leaflet.js
- **測試**: Vitest + React Testing Library + Playwright (E2E)

## 目前狀態

**最後更新**: 2026-02-23
**分支**: main
**Git 狀態**: 已提交並推送至 origin/main，CI/CD 已啟用

### 已完成功能

#### 玩家端
- [x] Landing 首頁
- [x] 遊戲大廳 (Home)
- [x] 遊戲進行 (GamePlay) - 多種頁面類型（影片、對話、文字卡、QR 掃描、GPS 任務、拍照任務等）
- [x] 地圖導航 (MapView) - Leaflet 整合
- [x] 團隊大廳 (TeamLobby) - 組隊機制
- [x] 對戰大廳 (MatchLobby) - 競爭/接力模式
- [x] 排行榜 (Leaderboard)
- [x] QR Code 遊戲入口 (/g/:slug)
- [x] Firebase 玩家認證
- [x] i18n 多語系支援
- [x] 章節選擇 (ChapterSelect) - Phase 1 章節系統

#### 管理端（場主 Admin）
- [x] 管理員登入 (Firebase Auth)
- [x] 儀表板 (AdminDashboard)
- [x] 遊戲管理 (AdminGames)
- [x] 遊戲編輯器 (GameEditor) - 頁面拖拉排序
- [x] 章節管理 (ChapterManager + ChapterConfigEditor) - Phase 1
- [x] 地點編輯器 (LocationEditor)
- [x] 道具編輯器 (ItemEditor)
- [x] 成就編輯器 (AchievementEditor)
- [x] 遊戲設定 (GameSettings)
- [x] 場次管理 (AdminSessions)
- [x] 裝置管理 (AdminDevices)
- [x] 數據分析 (AdminAnalytics)
- [x] 排行榜管理 (AdminLeaderboard)
- [x] 系統設定 (AdminSettings)

#### 管理端（場域管理員 Admin Staff）
- [x] 場域管理員登入 (JWT)
- [x] 場域管理儀表板
- [x] 場域管理 (Fields)
- [x] 角色管理 (Roles)
- [x] 帳號管理 (Accounts)
- [x] 稽核日誌 (Audit Logs)
- [x] 玩家管理 (Players)
- [x] QR Code 管理

#### 後端 API（已模組化拆分）
- [x] 認證路由 (auth) - 355 行
- [x] 場域管理路由 (admin-fields) - 145 行
- [x] 角色管理路由 (admin-roles) - 446 行
- [x] 遊戲管理路由 (admin-games, admin-content) - 476/441 行
- [x] 玩家遊戲路由 (player-games) - 445 行
- [x] 玩家道具路由 (player-items) - 123 行
- [x] 玩家成就路由 (player-achievements) - 132 行
- [x] 玩家場次路由 (player-sessions) - 382 行
- [x] 裝置路由 (devices) - 450 行
- [x] 排行榜路由 (leaderboard) - 124 行
- [x] 媒體路由 (media) - 208 行
- [x] 地點路由 (locations) - 245 行
- [x] 地點追蹤路由 (location-tracking) - 292 行
- [x] 團隊路由 (teams) - 323 行
- [x] 團隊生命週期路由 (team-lifecycle) - 284 行
- [x] 團隊投票路由 (team-votes) - 270 行
- [x] 團隊分數路由 (team-scores) - 106 行
- [x] 管理端章節路由 (admin-chapters) - 177 行
- [x] 玩家端章節路由 (player-chapters) - 271 行
- [x] 對戰路由 (matches) - 392 行（含 recover 端點）
- [x] 接力路由 (relay) - 199 行
- [x] 兌換碼管理路由 (admin-redeem-codes) - 235 行
- [x] 購買管理路由 (admin-purchases) - 133 行
- [x] 玩家購買路由 (player-purchases) - 247 行
- [x] WebSocket 即時通訊 (含 match 廣播)
- [x] MQTT 服務

#### 資料庫 Schema
- [x] users, roles, fields, games, sessions, teams, devices, locations, leaderboard
- [x] game-templates
- [x] gameChapters, playerChapterProgress (Phase 1 章節系統)
- [x] gameMatches, matchParticipants (Phase 2 對戰系統)
- [x] redeemCodes, redeemCodeUses, purchases, paymentTransactions (Phase 27 付費系統)
- [x] relations
- [x] DB Migration 完成（41+ 資料表已同步）

## 工作紀錄

### 2026-02-23 (Phase 30：流程控制強化 — 條件分支、迴圈、隨機路徑)

新增 `flow_router` 頁面類型 + `onCompleteActions` 通用機制，讓遊戲設計師建立非線性流程。

#### Schema 更新
- [x] 新增 `FlowCondition` — 10 種條件類型（variable_equals/gt/lt/gte/lte, has_item/not_has_item, score_above/below, random）
- [x] 新增 `FlowRoute` — 路由規則（條件列表 + AND/OR 邏輯 + 目標頁面）
- [x] 新增 `FlowRouterConfig` — 條件分支 / 隨機路徑 兩種模式
- [x] 新增 `OnCompleteAction` — 7 種動作（set/increment/decrement/toggle 變數、add/remove 道具、add_score）
- [x] 更新 PageConfig union type 加入 FlowRouterConfig

#### 路由評估引擎
- [x] 新增 `client/src/lib/flow-router.ts` (~188 行) — 純函式模組
  - `evaluateCondition()` — 單一條件評估
  - `evaluateRoute()` — AND/OR 邏輯評估
  - `pickRandomRoute()` — 加權隨機選擇
  - `evaluateFlowRouter()` — 主路由評估（conditional / random）
  - `resolveFlowRouter()` — 連續 flow_router 解析（maxHops=10 防無限迴圈）
  - `processOnCompleteActions()` — 不可變狀態更新

#### 遊戲引擎整合
- [x] 修改 `GamePlay.tsx` — handlePageComplete 加入 onCompleteActions 處理 + resolveFlowRouter 整合
- [x] 新增 `FlowRouterPage.tsx` (~42 行) — Fallback 元件（正常不會渲染）
- [x] 修改 `GamePageRenderer.tsx` — +flow_router lazy import + case

#### 編輯器
- [x] 新增 `FlowRouterEditor.tsx` (~383 行) — 流程路由編輯器
  - 模式切換（conditional / random）
  - 路由規則列表（條件/權重 + 目標頁面選擇器）
  - 預設 fallback 頁面
- [x] 新增 `OnCompleteActionsEditor.tsx` (~216 行) — 通用完成動作編輯器（可折疊）
- [x] 修改 `PageConfigEditor.tsx` — +flow_router case + OnCompleteActionsEditor（flow_router 除外）
- [x] 修改 `constants.ts` — PAGE_TYPES 新增 flow_router（第 16 種）

#### 測試更新
- [x] 修改 `constants.test.ts` — PAGE_TYPES 16 種
- [x] 修改 `GamePageRenderer.test.tsx` — +flow_router mock + 涵蓋

**設計決策**:
1. 新頁面類型而非修改現有 — flow_router 是獨立的純邏輯節點
2. 純函式評估引擎 — flow-router.ts 完全無副作用，方便測試
3. onCompleteActions 通用化 — 所有 16 種頁面都能用
4. maxHops=10 防護 — 防止無限迴圈導致瀏覽器凍結
5. 向後兼容 — 所有新欄位 optional，不需 DB migration

**迴圈支援**：flow_router 的 nextPageId 可指向之前的頁面，搭配 onCompleteActions 的變數操作，天然支援「重複直到條件滿足」的迴圈模式。

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 58 檔案 861 測試全通過、`npm run build` 成功

---

### 2026-02-22 (Phase 29：AI 自動評分 — 照片驗證 + 文字語意評分)

整合 Google Gemini 2.0 Flash，實現照片 AI 驗證和文字語意評分。

#### 後端
- [x] 安裝 `@google/generative-ai` SDK
- [x] 新增 `server/lib/gemini.ts` (~120 行) — Gemini API 封裝
  - `verifyPhoto()` — 下載圖片 → base64 → Gemini Vision → 結構化 JSON 結果
  - `scoreTextAnswer()` — 語意相似度評分 → 0-100 分 + 回饋
  - `isGeminiConfigured()` — 環境變數檢查
- [x] 新增 `server/routes/ai-scoring.ts` (~140 行) — 2 個 API 端點
  - `POST /api/ai/verify-photo` — 照片 AI 驗證（Zod 驗證 + rate limit）
  - `POST /api/ai/score-text` — 文字語意評分（Zod 驗證 + rate limit）
  - Rate limit: 每用戶每分鐘 10 次（記憶體 Map + 定期清理）
  - Graceful fallback: AI 失敗時照片自動通過、文字回傳 fallback 標記
- [x] 修改 `server/routes/index.ts` — 註冊 AI 路由

#### Schema 更新
- [x] `PhotoMissionConfig` +4 欄位: aiConfidenceThreshold, aiFailMessage, allowRetryOnAiFail, maxAiRetries
- [x] `TextVerifyConfig` +3 欄位: aiScoring, aiPassingScore, aiContext

#### 前端 — 照片任務 AI 驗證
- [x] 改寫 `PhotoMissionPage.tsx` — 上傳後呼叫真實 AI 驗證端點
  - AI 通過 → 完成任務、AI 未通過 → 顯示回饋 + 重拍、API 失敗 → graceful fallback
- [x] 更新 `PhotoViews.tsx` — 新增 AiFailView（顯示回饋、偵測物件、重拍/跳過按鈕）
- [x] 更新 `usePhotoCamera.ts` — 新增 ai_fail 模式

#### 前端 — 文字語意評分
- [x] 改寫 `TextVerifyPage.tsx` — checkAnswer 增加 AI 分支
  - 精確匹配優先（匹配成功不呼叫 AI，省費用）
  - AI 評分中顯示 loading spinner
  - API 失敗 → fallback 到原始邏輯

#### 管理端編輯器
- [x] 修改 `PageConfigEditor.tsx` — 新增 AI 設定 UI
  - photo_mission: AI 開關、目標關鍵字標籤編輯器、信心度滑桿、失敗提示、重拍次數
  - text_verify: AI 開關、通過分數滑桿、場景描述

**設計決策**:
1. Gemini 2.0 Flash — 價格最低（~$0.001/照片），速度快
2. 後端 AI 呼叫 — API Key 不暴露前端
3. 精確匹配優先 — 省 API 費用
4. Graceful fallback — AI 掛掉遊戲不中斷
5. Rate limit 防濫用 — 每用戶每分鐘 10 次

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 58 檔案 860 測試全通過、`npm run build` 成功（90 precache entries）

---

### 2026-02-21 (第二十七階段：Phase 27 Phase A — 付費/票券系統：兌換碼 + 現金收款)

#### 步驟 A1：Schema + Storage
- [x] 修改 `shared/schema/games.ts` — +3 欄位：pricingType, price, currency
- [x] 新增 `shared/schema/purchases.ts` (~220 行) — 4 張新表：redeemCodes, redeemCodeUses, purchases, paymentTransactions
- [x] 修改 `shared/schema/index.ts` + `relations.ts` — 匯出新 schema + 關聯定義
- [x] 新增 `server/storage/purchase-storage.ts` (~260 行) — 22 個兌換碼/購買 CRUD 方法
- [x] 修改 `server/storage.ts` — IStorage 介面 + DatabaseStorage 整合 22 個購買方法
- [x] `npm run db:push` 成功同步 4 張新表 + 3 個新欄位

#### 步驟 A2：後端 API
- [x] 新增 `server/utils/redeem-code-generator.ts` (~35 行) — 碼格式 JCQ-XXXX-XXXX（32 字元集排除 0/O/1/I）
- [x] 新增 `server/routes/admin-redeem-codes.ts` (~235 行) — 6 個 API 端點（CRUD + 批次建立 + 使用紀錄）
- [x] 新增 `server/routes/admin-purchases.ts` (~133 行) — 3 個 API 端點（購買記錄 + 現金收款授權 + 撤銷）
- [x] 新增 `server/routes/player-purchases.ts` (~247 行) — 3 個 API 端點（兌換碼 + 存取權查詢 + 購買記錄）
  - Rate limit: 15 分鐘/10 次（記憶體 Map）
  - 兌換流程: rate limit → 格式 → DB 查碼 → 狀態/過期/用完/重複 → DB Transaction
- [x] 修改 `server/routes/index.ts` — 註冊 3 個新路由模組
- [x] 修改 `server/storage/chapter-storage.ts` — isChapterUnlocked() 整合購買記錄查詢（遊戲級 + 章節級）

#### 步驟 A3：管理端前端
- [x] 新增 `client/src/pages/admin-redeem-codes/` 目錄（6 個檔案）
  - `index.tsx` (~95 行) — 票券管理主頁（Tab: 兌換碼/購買記錄）
  - `useRedeemCodes.ts` (~140 行) — 管理 Hook（codes/purchases 查詢 + 6 個 mutation）
  - `CodeTable.tsx` (~100 行) — 兌換碼列表（複製/停用/刪除）
  - `CreateCodeDialog.tsx` (~155 行) — 單一/批次建立對話框
  - `GrantAccessDialog.tsx` (~185 行) — 現金收款授權對話框（搜尋玩家 → 選遊戲/章節 → 授權）
  - `PurchaseHistory.tsx` (~80 行) — 購買記錄列表
- [x] 修改 `client/src/pages/game-settings/useGameSettings.ts` — 新增 PricingType/PricingState + state + 存儲邏輯
- [x] 修改 `client/src/pages/game-settings/SettingsCards.tsx` — 新增 PricingCard 元件
- [x] 修改 `client/src/pages/GameSettings.tsx` — 渲染 PricingCard
- [x] 修改 `client/src/App.tsx` — 新增管理端票券路由

#### 步驟 A4：玩家端前端
- [x] 新增 `client/src/hooks/useGameAccess.ts` (~25 行) — 遊戲存取權查詢 Hook
- [x] 新增 `client/src/hooks/useRedeemCode.ts` (~30 行) — 兌換碼兌換 Hook
- [x] 新增 `client/src/hooks/usePurchases.ts` (~10 行) — 購買記錄 Hook
- [x] 新增 `client/src/components/shared/RedeemCodeInput.tsx` (~55 行) — 格式化兌換碼輸入（自動加破折號）
- [x] 新增 `client/src/pages/PurchaseGate.tsx` (~100 行) — 付費攔截頁面（兌換碼 + 線上付費按鈕預留）
- [x] 新增 `client/src/pages/MyPurchases.tsx` (~90 行) — 玩家購買歷史頁面
- [x] 修改 `client/src/App.tsx` — 新增玩家端路由（/game/:gameId/purchase, /purchases）

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 58 檔案 860 測試全通過、`npm run db:push` 成功

### 2026-02-21 (第二十六階段：程式碼品質持續改善 — any 清理 + GamePlay 重構)

#### 修改 1：Server 端 any 型別消除（3 檔案 4 處）
- [x] `adminAuth.ts` — `verifyToken(): any` → `AdminTokenPayload | null`（新增 AdminTokenPayload 介面）
- [x] `adminAuth.ts` — `decoded: any` → `AdminTokenPayload | null`
- [x] `admin-fields.ts` — `(data as any).codeLastChangedAt` → `data.codeLastChangedAt`（insertFieldSchema 已含此欄位）
- [x] `locations.ts` — GPS 任務虛擬地點：`config as any` → `Record<string, unknown>` + 正確 Location 欄位名

#### 修改 2：Client 端 game-editor any 型別統一治理（8 檔案）
- [x] `page-config-shared.tsx` — 新增 `PageConfigValue`、`PageConfig`、`EditorProps` 共用型別
- [x] 7 個編輯器改用 `EditorProps`：LockEditor, MotionChallengeEditor, ConditionalVerifyEditor, TimeBombEditor, VoteEditor, ButtonConfigEditor
- [x] 每個元件內部集合型別具體化：`Fragment`、`BombTask`、`ButtonItem`
- [x] 消除 `updateField: (field: string, value: any)` → `PageConfigValue`

#### 修改 3：Client 端其他 any 消除（2 檔案 6 處）
- [x] `admin-devices/index.tsx` — 3 個 mutation 參數：`data: any` → `Record<string, unknown>` / `{ r, g, b } | string`
- [x] `MapView.tsx` — `error: any` → `Error` / `unknown`、`L: any` 加 eslint-disable 說明

#### 修改 4：GamePlay.tsx 重構（541 → 306 行）
- [x] 抽出 `useSessionManager` hook (212 行) — session 恢復/新建/replay 邏輯
- [x] `handleCompletion` 函式獨立化，避免 `handlePageComplete` 超長
- [x] 移除 7 個獨立 useState + useRef → 統一為 `SessionState` 物件
- [x] 消除 stale closure 風險：ref 同步改在 hook 內部管理

#### 修改 5：ErrorBoundary console.error 移除
- [x] `ErrorBoundary.tsx` — 移除 2 處 `console.error`，錯誤資訊已在 state 中保留供 UI 顯示

**測試結果**: 58 個測試檔案、860 個 Vitest 測試全部通過，TS 零錯誤

### 2026-02-21 (第二十五階段：any 型別全面清除 + 大檔案拆分 + Bug 修復)

#### 修改 1：遊戲頁面元件 onVariableUpdate any → unknown（12 檔案）
- [x] 批次修正 11 個遊戲頁面元件 `value: any` → `value: unknown`
  - TextCardPage, DialoguePage, VideoPage, GpsMissionPage, QrScanPage, ChoiceVerifyPage
  - TextVerifyPage, ShootingMissionPage, TimeBombPage, LockPage, MotionChallengePage, VotePage
- [x] ConditionalVerifyPage 手動修正 3 處：`variableValue?: any`、`Record<string, any>`、`onVariableUpdate`

#### 修改 2：firebase.ts + AuthContext 型別安全
- [x] `AuthContext.tsx` — `firebaseUser: any | null` → `User | null`（import from firebase/auth）
- [x] `firebase.ts` — 新增 `getFirebaseErrorCode()` helper，8 處 `catch (error: any)` → `catch (error: unknown)`
- [x] `firebase.ts` — `(window as any).opera` → `(window as unknown as Record<string, string>).opera`

#### 修改 3：as any 殘留清理 + adminAuth bug 修復
- [x] `firebaseAuth.ts` — import AuthenticatedRequest，移除 `(req as any).user` → `req.user`
- [x] `adminAuth.ts` — **發現並修復真實 Bug**：`(req as any).user.id` 存取了錯誤的層級
  - 修正前：`user.id` / `user.defaultFieldId` / `user.role`（undefined，因為 user 是 `{ claims, dbUser }`）
  - 修正後：`authUser.dbUser.id` / `dbUser.defaultFieldId` / `dbUser.role`
- [x] `page-sync.ts` — `config as any` → `Record<string, unknown>`，`btn: any` → 具型別陣列
- [x] `MapView.tsx` — `page.config as any` → `Record<string, unknown>` + 型別斷言

#### 修改 4：locations.ts 拆分（522 → 245 + 292）
- [x] 新增 `server/routes/location-tracking.ts` (292 行) — 玩家位置追蹤 + 地點造訪 + 導航計算
- [x] 改寫 `server/routes/locations.ts` (245 行) — 地點 CRUD + 導航路徑 + 掛載子模組
- [x] 同步修正 `error: any` → `error: unknown` + 正確型別檢查

#### 修改 5：EventsEditor.tsx 拆分（519 → 340 + 215）
- [x] 新增 `client/src/pages/game-editor/event-config-editors.tsx` (215 行) — TriggerConfigEditor + RewardConfigEditor
  - 消除所有 `config: any` → `Record<string, unknown>` + `String()` / `Number()` 安全轉換
  - 消除 RewardConfigEditor 中 4 處 `as any`
- [x] 改寫 `client/src/pages/game-editor/EventsEditor.tsx` (340 行) — 主元件 + EventDetailEditor 子元件

**測試結果**: 58 個測試檔案、860 個 Vitest 測試全部通過，TS 零錯誤

### 2026-02-21 (第二十四階段：程式碼品質清理 — 大檔案拆分 + any 型別消除)

#### 修改 1：playerChapters.test.ts 拆分（975 → 3 檔 + helper）
- [x] 新增 `server/__tests__/helpers/playerChapterSetup.ts` (75 行) — 共用 MockStorage 型別、工廠函式、常數
- [x] 改寫 `server/__tests__/playerChapters.test.ts` (290 行) — GET 查詢類測試（15 個）
- [x] 新增 `server/__tests__/playerChapterActions.test.ts` (323 行) — POST start + PATCH complete（15 個）
- [x] 新增 `server/__tests__/playerChapterPurchase.test.ts` (353 行) — score_threshold 解鎖 + purchase（12 個）

#### 修改 2：seed-fake-village.ts 拆分（758 → 3 檔）
- [x] 新增 `scripts/seed-data/page-factories.ts` (179 行) — 12 個頁面配置工廠函式
- [x] 新增 `scripts/seed-data/fake-village-data.ts` (415 行) — 章節定義、道具、團隊版差異
- [x] 改寫 `scripts/seed-fake-village.ts` (174 行) — 純執行邏輯

#### 修改 3：PageConfigEditor.tsx 拆分（676 → 2 檔）
- [x] 新增 `client/src/pages/game-editor/page-config-inline-editors.tsx` (461 行) — 6 個子元件
  - TextCardEditor、DialogueEditor、GpsMissionEditor、QrScanEditor、ChoiceVerifyEditor、VideoEditor
- [x] 改寫 `client/src/pages/game-editor/PageConfigEditor.tsx` (234 行) — 純 switch 分發器
- [x] 消除所有 `any` 型別 — `config: any` → `Record<string, unknown>` + 型別斷言

#### 修改 4：GamePlay.tsx 型別修正
- [x] `handleVariableUpdate` 參數 `value: any` → `value: unknown`
- [x] 修復 TS18047: `existingSession.progress` null safety（提取局部變數）

#### 修改 5：測試 mock 洩漏修復
- [x] `resetStorageMocks()` — 對所有 11 個 storage mock 呼叫 `mockReset()`
  - 修正 `vi.clearAllMocks()` 不重設 `mockResolvedValue` 的已知問題

**測試結果**: 58 個測試檔案、860 個 Vitest 測試全部通過，TS 零錯誤

### 2026-02-21 (第二十三階段：型別安全強化 + teams.ts 拆分 + 測試補強)

#### 修改 1：後端 `any` 型別消除
- [x] 修改 `server/index.ts` — `Record<string, any>` → `Record<string, unknown>`，錯誤處理 `err: any` → 具體型別
- [x] 修改 `server/routes/types.ts` — 新增 `WsBroadcastMessage` 介面，3 個 broadcast 函式 `any` → 型別安全
- [x] 修改 `server/routes/websocket.ts` — 4 個 broadcast 函式 + hitBroadcast `any` → 具體型別
- [x] 修改 `server/mqttService.ts` — 11 處 `any` 改為具體型別
  - `MqttMessage.data` → `unknown`
  - `SensorData.value` → `string | number | boolean`
  - `updateData` → `Partial<Pick<ArduinoDevice, ...>>`
  - 回呼參數 → `unknown`
  - publish/sendCommand/broadcastToAllDevices → `Record<string, unknown>`

#### 修改 2：teams.ts 路由拆分
- [x] 新增 `server/routes/team-lifecycle.ts` (284 行) — 準備狀態/離開/開始遊戲 3 個端點
- [x] 修改 `server/routes/teams.ts` — 592 行 → 323 行（移除 ready/leave/start，新增子模組註冊）

#### 修改 3：useTeamLobby Hook 測試
- [x] 新增 `client/src/pages/__tests__/useTeamLobby.test.ts` (21 測試)
  - 初始狀態、currentUserId、gameLoading/teamLoading、myTeam
  - isLeader/allReady/hasEnoughPlayers 計算屬性
  - mutation pending 狀態、setAccessCode/setTeamName/setShowJoinForm
  - handleJoinTeam 空碼防護 + API 呼叫、handleCreateTeam API 呼叫
  - navigate、wsConnected
  - WebSocket callbacks: onMemberJoined/onMemberLeft/onReadyUpdate

#### 修改 4：GameEditor 頁面測試
- [x] 新增 `client/src/pages/__tests__/GameEditor.test.tsx` (14 測試)
  - 載入 spinner、新遊戲模式、標題輸入框、儲存/發布按鈕
  - 預覽 disabled、返回導航、admin-staff 路徑分流
  - 資源管理列隱藏、Tabs 頁籤、Sidebar 元件
  - 提示文字、標題修改、遊戲設定 Tab、章節 Tab 提示

**測試結果**: 56 個測試檔案、848 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-19 (第二十二階段：團隊 WebSocket 測試 + player-games 路由拆分)

#### 修改 1：useTeamWebSocket 測試
- [x] 新增 `client/src/hooks/__tests__/useTeamWebSocket.test.ts` (17 測試)
  - MockWebSocket class 模擬完整 WebSocket 生命週期
  - team_member_joined/left/location/vote_cast/score_update/ready_update 6 種消息處理
  - sendChat/sendLocation/sendVote/sendReady 4 種發送方法
  - 未連線安全防護、無效 JSON 容錯、unmount 清理

#### 修改 2：修復 use-team-websocket.ts 的 `any` 型別
- [x] 修改 `client/src/hooks/use-team-websocket.ts`
  - TeamMessage 介面新增 `latitude?/longitude?/accuracy?` 欄位
  - 移除 3 處 `(data as any)` 改為型別安全存取 + `?? 0` 預設值

#### 修改 3：player-games.ts 路由拆分
- [x] 新增 `server/routes/player-items.ts` (123 行) — Items CRUD 5 端點
- [x] 新增 `server/routes/player-achievements.ts` (132 行) — Achievements CRUD 5 端點
- [x] 修改 `server/routes/player-games.ts` — 678 行 → 445 行（移除 items/achievements，新增子模組註冊）

**測試結果**: 54 個測試檔案、813 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-19 (第二十一階段：Vite 6 升級 + AdminGames 頁面測試)

#### 修改 1：Vite 5→6 依賴升級
- [x] `package.json` — `vite` ^5.4.20 → ^6.0.0（實裝 6.4.1）
- [x] `package.json` — `@vitejs/plugin-react` ^4.7.0 → ^5.0.0（實裝 5.2.0）
- [x] `server/vite.ts` — `ssrFixStacktrace` 仍保留為 backward compat alias，無需修改
- [x] `npm audit fix` — 從 18→15 漏洞（剩餘為 eslint/drizzle-kit 間接依賴，開發環境限定）

#### 修改 2：AdminGames 頁面測試
- [x] 新增 `client/src/pages/__tests__/AdminGames.test.tsx` (12 測試)
  - authLoading spinner、未認證 null、AdminLayout 渲染
  - 搜尋欄位 + setSearchQuery、4 個狀態標籤 + counts
  - 新增遊戲按鈕、載入/空/篩選/有資料 4 種狀態
  - 對話框 mock 全渲染

**測試結果**: 53 個測試檔案、796 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-17 (第二十階段：核心 Hook 測試補強)

#### 修改 1：useMatchLobby 測試
- [x] 新增 `client/src/pages/__tests__/useMatchLobby.test.ts` (12 測試)
  - determineView 狀態轉換、authLoading/gameLoading、currentUserId 優先序
  - isCreator/isLoading/isPending 初始值、handleGoBack 導航

#### 修改 2：useMatchWebSocket 測試
- [x] 新增 `client/src/hooks/__tests__/useMatchWebSocket.test.ts` (14 測試)
  - MockWebSocket class 模擬完整 WebSocket 生命週期
  - match_ranking/countdown/started/finished/relay_handoff 5 種消息處理
  - 前端倒數遞減、到 0 發送 match_countdown_complete
  - 初始 state、URL token 參數、sendMessage

#### 修改 3：useAdminGames 測試
- [x] 新增 `client/src/pages/__tests__/useAdminGames.test.ts` (12 測試)
  - 初始 state、認證資訊、statusFilter/searchQuery 切換
  - handleEdit/resetForm、mutation pending 初始值
  - handleSubmit 呼叫 fetch POST、navigate 函式、isWizardOpen

**測試結果**: 52 個測試檔案、784 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-17 (第十九階段：對戰元件測試補強 + 接力進度條)

#### 修改 1：MatchTimer 測試
- [x] 新增 `client/src/components/match/__tests__/MatchTimer.test.tsx` (11 測試)
  - countdown 渲染/遞減/到 0 回呼、≤10 秒 destructive 樣式、icon 切換
  - elapsed 模式遞增、格式化分鐘、秒數變更重置

#### 修改 2：LiveRanking 測試
- [x] 新增 `client/src/components/match/__tests__/LiveRanking.test.tsx` (11 測試)
  - 空排名提示、排名渲染、Trophy icon、當前玩家高亮 "(你)"
  - showRelay 3 種 badge（進行中/已完成/待命）、false 不顯示

#### 修改 3：MatchViews 6 視圖測試
- [x] 新增 `client/src/pages/__tests__/MatchViews.test.tsx` (23 測試)
  - LoadingView、BrowseMatchesView（標題/按鈕/空列表/加入/返回/接力模式）
  - WaitingView（存取碼/人數/開始按鈕/非創建者/1人禁用）
  - CountdownView、PlayingView（計時器切換）、FinishedView

#### 修改 4：RelayProgress 接力進度條元件
- [x] 新增 `client/src/components/match/RelayProgress.tsx` (~85 行)
  - 段落方塊：completed=綠、active=藍脈衝、pending=灰
  - 進度文字：「第 N/M 段進行中」/「接力完成！」
- [x] 修改 `client/src/pages/match-lobby/MatchViews.tsx` — PlayingView 整合 RelayProgress

#### 修改 5：RelayProgress 測試
- [x] 新增 `client/src/components/match/__tests__/RelayProgress.test.tsx` (8 測試)
  - 段落數渲染、segmentCount=0 不渲染、3 種色彩、進度文字、全完成文字

**測試結果**: 49 個測試檔案、746 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-17 (第十八階段：Rate Limiting 清理 + 圖片優化 + 對戰 UI 動畫)

（詳見 Git 歷史）

**測試結果**: 45 個測試檔案、693 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-17 (第十七階段：安全強化 + GamePlay 拆分 + React 效能優化)

#### 修改 1：media.ts 錯誤訊息洩漏修復
- [x] `server/routes/media.ts` — 4 處 `catch (error: any) { error.message }` 改為固定錯誤訊息
  - L72, L128, L160, L205 — 避免堆疊追蹤、DB 錯誤等內部資訊洩漏給客戶端

#### 修改 2：ID 參數驗證 + 端點防護
- [x] `server/routes/utils.ts` — 新增 `validateId()` 工具函式（Zod UUID 驗證）
- [x] `server/routes/matches.ts` — 3 個 GET 端點加入 UUID 驗證
- [x] `server/routes/leaderboard.ts` — gameId 查詢參數加入 UUID 驗證

#### 修改 3：CORS 正式環境防護
- [x] `server/index.ts` — allowedOrigins 改用 `CORS_ORIGIN` 環境變數
  - 正式環境要求 origin header，開發環境允許無 origin 請求

#### 修改 4：GamePlay chunk 拆分（React.lazy）
- [x] `client/src/components/game/GamePageRenderer.tsx` — 15 個靜態 import → React.lazy 動態載入
  - 新增 `Suspense` + `PageLoadingFallback` 元件
  - 新增 `useMemo` 快取 commonProps
  - **效果**: GamePlay 445KB chunk 消除，拆分為個別按需載入 chunk

#### 修改 5：React 效能優化
- [x] `client/src/components/match/MatchTimer.tsx` — 包裝 `memo()`（每秒更新的高頻元件）
- [x] `client/src/components/match/LiveRanking.tsx` — 包裝 `memo()`（分數變更時更新）
- [x] `client/src/lib/queryClient.ts` — 快取策略調整
  - staleTime: Infinity → 5 分鐘、新增 gcTime: 10 分鐘、retry: false → 1

#### 修改 6：測試修復
- [x] `server/__tests__/matches.test.ts` — 測試 ID 改為 UUID 格式 + 新增「無效 ID 回傳 400」測試
- [x] `server/__tests__/leaderboard.test.ts` — gameId 改為 UUID 格式 + 新增驗證測試
- [x] `client/src/lib/queryClient.test.ts` — 更新 staleTime/retry 斷言
- [x] `client/src/components/game/__tests__/GamePageRenderer.test.tsx` — async + waitFor 適配 React.lazy

**測試結果**: 42 個測試檔案、665 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-16 (第十六階段：穩定性 + 型別安全 + 效能強化)

#### 修改 1：清理 console.log
- [x] `server/routes/auth.ts` — console.error 改為 HTTP 錯誤回應
- [x] `server/routes/websocket.ts` — 移除 console.warn/console.error
- [x] `server/db.ts` — 精簡 pool 錯誤處理，移除 connect 監聽器與 closePool 日誌

#### 修改 2：型別安全
- [x] `server/routes/types.ts` — WebSocketClient 新增 `matchId?: string` 屬性
- [x] `server/routes/websocket.ts` — 4 處 `(ws as any).matchId` → `ws.matchId`
- [x] `server/routes/matches.ts` — `(match.settings as any)` → `(match.settings as MatchSettings | null)`

#### 修改 3：N+1 查詢優化
- [x] `server/routes/relay.ts` L58-74 — for-loop 逐筆 UPDATE → `Promise.all` 並行
- [x] `server/routes/matches.ts` L243-252 — finish 排名更新同樣改為 `Promise.all`

#### 修改 4：移除 setTimeout + 新增 recover 端點
- [x] `server/routes/matches.ts` — 移除 server 端 `setTimeout` 倒數（重啟遺失風險）
- [x] 新增 `POST /api/matches/:matchId/recover` — 自動恢復卡在 countdown 的對戰（含 2 秒容錯）
- [x] `server/routes/websocket.ts` — 新增 `match_countdown_complete` 事件處理器
  - 前端倒數完成後通知後端，後端驗證 countdown 狀態後切換為 playing

#### 修改 5：WebSocket 重連 + 前端倒數
- [x] `client/src/hooks/use-match-websocket.ts` — 全面重寫
  - 指數退避重連（1s → 2s → 4s → ... 30s，最多 10 次）
  - 前端 `setInterval` 倒數計時，倒數完成自動送 `match_countdown_complete`
  - unmount 完整清理（重連計時器 + 倒數計時器 + WebSocket）

#### 測試更新
- [x] `server/__tests__/matches.test.ts` — 新增 4 個 recover 端點測試，更新 mock 策略
- [x] `server/__tests__/websocket.test.ts` — 新增 db mock（因 websocket.ts 新增 db import）

**測試結果**: 42 個測試檔案、663 個 Vitest 測試全部通過，TS 零錯誤，Build 成功

### 2026-02-16 (第十五階段：全面推進 — Code Splitting + 前端測試 + Phase 2 對戰 + E2E)

#### 步驟 1：Code Splitting 效能優化
- [x] 修改 `vite.config.ts` — 新增 `manualChunks` 拆分 8 個 vendor chunk
  - vendor-react, vendor-ui, vendor-data, vendor-firebase, vendor-map, vendor-charts, vendor-motion, vendor-icons
- [x] 修改 `client/src/App.tsx` — 30+ 個頁面改為 `React.lazy()` 動態載入
- [x] 新增 `client/src/components/shared/PageLoader.tsx` — 全站載入佔位元件
- [x] **效果**: index.js 從 ~3MB 降至 ~22KB，拆分為 ~40 個 chunk

#### 步驟 2：前端元件測試（64 個新測試）
- [x] 新增 `client/src/test/test-utils.tsx` — customRender + factory 函式
- [x] 新增 `client/src/hooks/__tests__/useAuth.test.ts` (8 測試) — 認證 Hook
- [x] 新增 `client/src/components/game/__tests__/GamePageRenderer.test.tsx` (16 測試) — 15 種頁面類型分發
- [x] 新增 `client/src/pages/__tests__/Landing.test.tsx` (8 測試) — 首頁
- [x] 新增 `client/src/pages/__tests__/Home.test.tsx` (12 測試) — 遊戲大廳路由分流
- [x] 新增 `client/src/pages/__tests__/GamePlay.test.tsx` (10 測試) — 遊戲主流程
- [x] 新增 `client/src/pages/__tests__/TeamLobby.test.tsx` (10 測試) — 團隊大廳

#### 步驟 3：Phase 2 對戰系統（Schema + API + WebSocket + 前端 + 45 測試）
- [x] 擴充 `shared/schema/games.ts` — gameModeEnum 加入 competitive/relay
- [x] 新增 `shared/schema/matches.ts` (~150 行) — gameMatches + matchParticipants 表
  - MatchSettings, RelayConfig 介面、Zod 驗證、Type exports
- [x] 修改 `shared/schema/index.ts` + `relations.ts` — 匯出新 schema + 關聯
- [x] 新增 `server/routes/matches.ts` (~350 行) — 8 個 API 端點
  - POST create, GET list, GET detail, POST join, POST start, POST finish, PATCH score, GET ranking
- [x] 新增 `server/routes/relay.ts` (~199 行) — 3 個接力 API 端點
  - POST assign segments, GET relay status, POST handoff
- [x] 修改 `server/routes/websocket.ts` — matchClients + broadcastToMatch + match 事件
- [x] 修改 `server/routes/types.ts` — RouteContext 加入 broadcastToMatch
- [x] 修改 `server/routes/teams.ts` — gameMode 檢查支援 competitive/relay
- [x] 新增前端 6 個檔案：
  - `MatchLobby.tsx` (~65 行) — 對戰大廳主頁
  - `match-lobby/useMatchLobby.ts` (~125 行) — 對戰邏輯 Hook
  - `match-lobby/MatchViews.tsx` (~250 行) — 6 個視圖元件
  - `components/match/LiveRanking.tsx` (~90 行) — 即時排名
  - `components/match/MatchTimer.tsx` (~60 行) — 計時器
  - `hooks/use-match-websocket.ts` (~110 行) — WebSocket Hook
- [x] 修改 `App.tsx` + `Home.tsx` — 新增 /match/:gameId 路由 + gameMode 分流
- [x] 新增 `shared/schema/__tests__/matches.test.ts` (18 測試) — Schema 驗證
- [x] 新增 `server/__tests__/matches.test.ts` (18 測試) — 對戰 API 整合測試
- [x] 新增 `server/__tests__/relay.test.ts` (9 測試) — 接力 API 整合測試

#### 步驟 4：E2E 測試
- [x] 安裝 `@playwright/test` + Chromium 瀏覽器
- [x] 新增 `playwright.config.ts` — Desktop Chrome + Pixel 5 雙專案
- [x] 新增 5 個 E2E 測試檔案（25 測試）：
  - `e2e/landing.spec.ts` (4 測試) — 首頁載入、導航、404、RWD
  - `e2e/game-browsing.spec.ts` (5 測試) — 遊戲大廳、搜尋、回應式
  - `e2e/individual-game.spec.ts` (6 測試) — 遊戲頁面、章節、地圖、排行榜
  - `e2e/team-game.spec.ts` (5 測試) — 團隊/對戰大廳、JS 錯誤監控
  - `e2e/admin-management.spec.ts` (5 測試) — 管理端登入、權限、重導向
- [x] 修改 `package.json` — 新增 test:e2e / test:e2e:ui scripts
- [x] 修改 `.github/workflows/ci.yml` — 新增 E2E job（main 分支限定，含 PostgreSQL service）

**測試結果**: 42 個測試檔案、659 個 Vitest 測試全部通過 + 25 個 E2E 測試（第十六階段已增至 663）

### 2026-02-16 (第十四階段：CI/CD Pipeline + 前端測試提升)

- [x] 建立 GitHub Actions CI 工作流程 `.github/workflows/ci.yml`
  - lint-and-typecheck：TypeScript 型別檢查
  - test：550 個單元/整合測試
  - build：生產環境建置（需 lint+test 通過才觸發）
- [x] 建立手動部署工作流程 `.github/workflows/deploy.yml`
  - 手動觸發：`gh workflow run deploy.yml -f confirm=yes`
  - 配合嚴格部署控制規則，需明確確認才執行
  - 部署前自動執行完整驗證（tsc + test + build）
- [x] CI 首次觸發執行成功
- [x] 測試結果：33 個測試檔案、550 個測試全部通過，TS 零錯誤，Build 通過

### 2026-02-16 (第十三階段：遊戲模組庫 + 種子資料 + Admin Staff 整合)

- [x] 新增 `shared/schema/game-modules.ts` (~310 行) - GameModule 介面 + 5 套完整遊戲模組定義
- [x] 新增 `server/routes/admin-modules.ts` (~120 行) - 3 個 API 端點
- [x] 新增前端模組庫頁面 + 元件
- [x] 新增 `scripts/seed.ts` (~170 行) - 資料庫種子腳本
- [x] 新增模組 API 測試 + 前端測試覆蓋率提升（+88 測試）
- [x] 測試結果：33 個測試檔案、550 個測試全部通過，TS 零錯誤

### 2026-02-16 (第十二階段以前)

- 完整紀錄請見 Git 歷史記錄

## 測試統計

| 類別 | 檔案數 | 測試數 |
|------|--------|--------|
| Schema 驗證 | 5 | 67 |
| 前端元件測試 | 24 | 312 |
| API 整合測試 | 22 | 382 |
| Storage 層 | 1 | 29 |
| 工具函式 | 6 | 70 |
| **Vitest 合計** | **58** | **860** |
| E2E 測試 (Playwright) | 5 | 25 |
| **總計** | **63** | **885** |

## Build 統計

| 指標 | 值 |
|------|------|
| 前端 index.js | ~22KB (原 ~3MB) |
| 前端 chunk 數 | ~40 |
| 後端 dist/index.cjs | 1.4MB |
| TypeScript 錯誤 | 0 |

## 待處理問題

### 🟡 注意
1. **npm audit** - 15 個漏洞（eslint/minimatch high + drizzle-kit moderate，皆開發環境間接依賴）
2. **DB Migration** - Phase 2 的 game_matches + match_participants 表需要 `npm run db:push`

### 🟢 優化方向
1. ~~安全性審查（查詢優化）~~ → 第十六階段已完成 N+1 查詢優化 + setTimeout 風險修復
2. ~~安全性審查（error leak + ID validation + CORS）~~ → 第十七階段已完成
3. ~~GamePlay.tsx chunk 過大警告（445KB）~~ → 第十七階段已用 React.lazy 拆分消除
4. ~~React.memo 策略~~ → 第十七階段已完成高頻元件 memo + queryClient 快取調整
5. ~~Rate limiting 清理~~ → 第十八階段已清理重複邏輯（express-rate-limit 已覆蓋）
6. ~~圖片懶載入~~ → 第十八階段已完成 OptimizedImage + Cloudinary URL 優化
7. ~~對戰 UI 動畫~~ → 第十八階段已完成 framer-motion 倒數/排名/轉場/慶祝動畫
8. ~~Vite 升級~~ → 第二十一階段已完成 Vite 5→6 升級（6.4.1 + plugin-react 5.2.0）
9. ~~接力進度條 UI~~ → 第十九階段已完成 RelayProgress 元件
10. ~~前端對戰元件測試~~ → 第十九階段已補 MatchTimer/LiveRanking/MatchViews 測試
11. ~~useTeamWebSocket 測試~~ → 第二十二階段已完成 17 個測試
12. ~~player-games.ts 行數超標~~ → 第二十二階段已拆分為 3 個模組（445+123+132 行）
13. ~~teams.ts 行數超標~~ → 第二十三階段已拆分為 teams.ts(323) + team-lifecycle.ts(284)
14. ~~後端 any 型別~~ → 第二十三階段已消除 types.ts/websocket.ts/mqttService.ts/index.ts 的 any
15. ~~useTeamLobby 測試~~ → 第二十三階段已完成 21 個測試
16. ~~GameEditor 測試~~ → 第二十三階段已完成 14 個測試

## 下一步建議

1. ~~DB Migration~~ → Phase 27 已完成 `npm run db:push`（41+ 資料表）
2. **Phase 27 Phase B：Recur.tw 金流整合** — 線上付費（server/services/recur-client.ts + webhook）
3. **E2E 完整流程測試** - 需要開發伺服器運行時執行
4. **ESLint 9 升級** - 解決 minimatch high 漏洞（需 eslint major 升級）
4. ~~PageConfigEditor 拆分~~ → 第二十四階段已拆分為 PageConfigEditor(234) + page-config-inline-editors(461)
5. ~~locations.ts 拆分~~ → 第二十五階段已拆分為 locations(245) + location-tracking(292)
6. ~~EventsEditor.tsx 拆分~~ → 第二十五階段已拆分為 EventsEditor(340) + event-config-editors(215)
7. ~~adminAuth.ts bug~~ → 第二十五階段修復 resolveUnifiedAdminContext 中 user 物件存取層級錯誤
8. ~~GamePlay.tsx 超長函式~~ → 第二十六階段已重構（541→306 行 + useSessionManager 212 行）
9. ~~game-editor any 型別~~ → 第二十六階段已統一為 EditorProps + PageConfigValue 型別
10. ~~ErrorBoundary console.error~~ → 第二十六階段已移除
11. **Vitest 並行 mock 洩漏** - playerChapterActions 和 teams 偶爾因 mock 洩漏失敗（單獨跑通過）
