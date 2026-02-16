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

**最後更新**: 2026-02-16
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
- [x] 對戰路由 (matches) - 350 行
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

**測試結果**: 42 個測試檔案、659 個 Vitest 測試全部通過 + 25 個 E2E 測試

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
| 前端元件測試 | 12 | 147 |
| API 整合測試 | 20 | 370 |
| Storage 層 | 1 | 29 |
| 工具函式 | 4 | 46 |
| **Vitest 合計** | **42** | **659** |
| E2E 測試 (Playwright) | 5 | 25 |
| **總計** | **47** | **684** |

## Build 統計

| 指標 | 值 |
|------|------|
| 前端 index.js | ~22KB (原 ~3MB) |
| 前端 chunk 數 | ~40 |
| 後端 dist/index.cjs | 1.4MB |
| TypeScript 錯誤 | 0 |

## 待處理問題

### 🟡 注意
1. **npm audit** - 5 個 esbuild/vite moderate 漏洞（開發環境限定，需 Vite 7 升級）
2. **DB Migration** - Phase 2 的 game_matches + match_participants 表需要 `npm run db:push`

### 🟢 優化方向
1. 安全性審查（rate limiting、input validation 完整性）
2. 效能優化（查詢最佳化、快取策略）
3. Vite 7 升級（解決剩餘安全漏洞）
4. GamePlay.tsx chunk 過大警告（445KB，考慮進一步拆分）

## 下一步建議

1. **DB Migration** - `npm run db:push` 同步 Phase 2 資料表
2. **E2E 完整流程測試** - 需要開發伺服器運行時執行
3. **Phase 2 功能完善** - 倒數計時動畫、排名即時更新 UI、接力進度條
4. **效能優化** - GamePlay chunk 拆分、圖片懶載入
