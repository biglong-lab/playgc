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

## 目前狀態

**最後更新**: 2026-02-08
**分支**: main
**Git 狀態**: 有未提交變更（清理 + 重構）

### 已完成功能

#### 玩家端
- [x] Landing 首頁
- [x] 遊戲大廳 (Home)
- [x] 遊戲進行 (GamePlay) - 多種頁面類型（影片、對話、文字卡、QR 掃描、GPS 任務、拍照任務等）
- [x] 地圖導航 (MapView) - Leaflet 整合
- [x] 團隊大廳 (TeamLobby) - 組隊機制
- [x] 排行榜 (Leaderboard)
- [x] QR Code 遊戲入口 (/g/:slug)
- [x] Firebase 玩家認證
- [x] i18n 多語系支援

#### 管理端（場主 Admin）
- [x] 管理員登入 (Firebase Auth)
- [x] 儀表板 (AdminDashboard)
- [x] 遊戲管理 (AdminGames)
- [x] 遊戲編輯器 (GameEditor) - 頁面拖拉排序
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
- [x] 玩家場次路由 (player-sessions) - 382 行 ← 新拆分
- [x] 裝置路由 (devices) - 450 行
- [x] 排行榜路由 (leaderboard) - 124 行
- [x] 媒體路由 (media) - 208 行
- [x] 地點路由 (locations) - 522 行
- [x] 團隊路由 (teams) - 591 行
- [x] 團隊投票路由 (team-votes) - 270 行 ← 新拆分
- [x] 團隊分數路由 (team-scores) - 106 行 ← 新拆分
- [x] WebSocket 即時通訊
- [x] MQTT 服務

#### 資料庫 Schema
- [x] users, roles, fields, games, sessions, teams, devices, locations, leaderboard
- [x] game-templates
- [x] relations

## 工作紀錄

### 2026-02-16 (第三階段：程式碼品質 + 漏洞修復)

- [x] 拆分 PageConfigEditor.tsx：1,502 行 → 7 個檔案（主檔 676 行 + 6 個子元件）
  - `page-config-shared.tsx` (163 行) - 共用區塊（獎勵、地圖定位）
  - `ConditionalVerifyEditor.tsx` (193 行) - 碎片收集編輯器
  - `TimeBombEditor.tsx` (169 行) - 拆彈任務編輯器
  - `LockEditor.tsx` (106 行) - 密碼鎖編輯器
  - `MotionChallengeEditor.tsx` (110 行) - 體感挑戰編輯器
  - `VoteEditor.tsx` (146 行) - 投票編輯器
- [x] 確認 TS 錯誤已全部修復（0 個錯誤）
- [x] 修復 qs 安全漏洞（npm audit fix）
- [x] 剩餘 5 個 esbuild/vite 漏洞為開發環境限定，需 Vite 7 breaking change
- [x] 測試結果：10 個測試檔案、88 個測試全部通過
- [x] Build 驗證通過

### 2026-02-08 (第二階段：測試建設)

- [x] 安裝測試依賴：supertest + @types/supertest
- [x] Schema 驗證測試：games.test.ts (13 測試) + sessions.test.ts (8 測試)
- [x] Server 工具函式測試：qrCodeService.test.ts (5 測試) + routeUtils.test.ts (9 測試)
- [x] API 路由整合測試：leaderboard.test.ts (6 測試) + playerGames.test.ts (11 測試)
- [x] 測試結果：9 個測試檔案、77 個測試全部通過
- [x] 測試覆蓋範圍：Schema 驗證、純函式、工具函式、HTTP 端點（含認證、權限檢查）

### 2026-02-08 (第一階段：清理 + 重構)

- [x] 建立 PROGRESS.md 追蹤進度
- [x] 清理 Replit 殘留套件（移除 @replit/vite-plugin-* 共 3 個）
- [x] 拆分 teams.ts：816 行 → teams.ts (591) + team-votes.ts (270) + team-scores.ts (106)
- [x] 拆分 player-games.ts：805 行 → player-games.ts (678) + player-sessions.ts (382)
- [x] 修復 team-votes.ts 的 Map iteration TS 錯誤
- [x] 驗證開發環境啟動正常，API 回應正確

## 測試統計

| 測試檔案 | 測試數 | 類型 |
|---------|--------|------|
| client/src/lib/authUtils.test.ts | 6 | 既有 - 工具函式 |
| client/src/components/admin-games/constants.test.ts | 11 | 既有 - 常數 |
| client/src/lib/utils.test.ts | 8 | 既有 - 工具函式 |
| shared/schema/__tests__/games.test.ts | 13 | 新增 - Schema 驗證 |
| shared/schema/__tests__/sessions.test.ts | 8 | 新增 - Schema 驗證 |
| server/__tests__/qrCodeService.test.ts | 5 | 新增 - 純函式 |
| server/__tests__/routeUtils.test.ts | 9 | 新增 - 工具函式 |
| server/__tests__/leaderboard.test.ts | 6 | 新增 - API 整合 |
| server/__tests__/playerGames.test.ts | 11 | 新增 - API 整合 |
| shared/schema/__tests__/chapters.test.ts | 11 | 新增 - Schema 驗證 |
| **合計** | **88** | |

## 待處理問題

### 🟡 注意
1. **邊界檔案** - `client/src/pages/MapView.tsx` (800行) 剛好上限
2. **npm audit** - 5 個 esbuild/vite moderate 漏洞（開發環境限定，需 Vite 7 升級）
3. **測試覆蓋率待提升** - 目前 88 個測試，需持續增加以達 80% 覆蓋率

### 🟢 優化方向
4. 建立 CI/CD Pipeline (GitHub Actions)
5. 安全性審查（rate limiting、input validation 完整性）
6. 效能優化（查詢最佳化、快取策略）
7. Vite 7 升級（解決剩餘安全漏洞）

## 下一步建議

1. **繼續 Phase 1 章節系統** - 驗證前後端整合，完善章節功能
2. **持續增加測試** - storage 層、更多路由端點、前端元件
3. **拆分 MapView.tsx** - 800 行已達上限
