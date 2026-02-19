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

**最後更新**: 2026-02-17
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
- [x] 玩家遊戲路由 (player-games) - 678 行
- [x] 玩家場次路由 (player-sessions) - 382 行
- [x] 裝置路由 (devices) - 450 行
- [x] 排行榜路由 (leaderboard) - 124 行
- [x] 媒體路由 (media) - 208 行
- [x] 地點路由 (locations) - 522 行
- [x] 團隊路由 (teams) - 591 行
- [x] 團隊投票路由 (team-votes) - 270 行
- [x] 團隊分數路由 (team-scores) - 106 行
- [x] 管理端章節路由 (admin-chapters) - 177 行
- [x] 玩家端章節路由 (player-chapters) - 271 行
- [x] 對戰路由 (matches) - 392 行（含 recover 端點）
- [x] 接力路由 (relay) - 199 行
- [x] WebSocket 即時通訊 (含 match 廣播)
- [x] MQTT 服務

#### 資料庫 Schema
- [x] users, roles, fields, games, sessions, teams, devices, locations, leaderboard
- [x] game-templates
- [x] gameChapters, playerChapterProgress (Phase 1 章節系統)
- [x] gameMatches, matchParticipants (Phase 2 對戰系統)
- [x] relations
- [x] DB Migration 完成（37+ 資料表已同步）

## 工作紀錄

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
| 前端元件測試 | 21 | 260 |
| API 整合測試 | 20 | 370 |
| Storage 層 | 1 | 29 |
| 工具函式 | 6 | 70 |
| **Vitest 合計** | **53** | **796** |
| E2E 測試 (Playwright) | 5 | 25 |
| **總計** | **58** | **821** |

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

## 下一步建議

1. **DB Migration** - `npm run db:push` 同步 Phase 2 資料表
2. **E2E 完整流程測試** - 需要開發伺服器運行時執行
3. **GameEditor 測試** - 遊戲編輯器頁面測試覆蓋率提升
4. **useTeamLobby/use-team-websocket 測試** - 團隊 Hook 邏輯測試
5. **ESLint 9 升級** - 解決 minimatch high 漏洞（需 eslint major 升級）
