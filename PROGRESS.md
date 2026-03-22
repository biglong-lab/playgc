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

**最後更新**: 2026-03-23
**分支**: main
**Git 狀態**: 已提交，待推送（local 64 commits ahead，remote 75 commits ahead — 需 merge）

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

#### 管理端（統一 Layout — UnifiedAdminLayout + JWT/RBAC）
- [x] 統一登入 `/admin/login` (Firebase Auth — 支援 super_admin 空場域碼)
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
- [x] 模組庫 (AdminTemplates)
- [x] 場域管理 (Fields)
- [x] 場域進階設定 (FieldSettings) — AI Key / 配額 / 功能開關 / 品牌
- [x] 票券/收款管理 (TicketsOverview) — 統計總覽 + 各遊戲明細
- [x] 角色管理 (Roles) — RBAC 權限過濾
- [x] 帳號管理 (Accounts)
- [x] 稽核日誌 (Audit Logs)
- [x] 玩家管理 (Players)
- [x] QR Code 管理
- [x] `/admin-staff/*` 向後兼容重導向到 `/admin/*`

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

#### 水彈對戰 PK 擂台
- [x] Phase 1 MVP：場地 + 時段 + 報名 + 配對 + WebSocket（Schema/Storage/API/前端）
- [x] Phase 2：對戰結果 + ELO 排名 + 歷史紀錄（Schema/ELO 引擎/Storage/API/前端）
- [x] Phase 3：戰隊系統（Schema/Storage/API/前端）
- [x] Phase 4：通知排程系統（Schema/Storage/排程器/通知服務/API/前端）
- [x] 功能優化：玩家名稱顯示 + 戰隊管理 UI + 響應式 + 路由守衛 + 確認出席 + Code Review 修復
- [x] 全站功能審查：管理端 27 頁面 + 玩家端 11 頁面 + 57+ API 全部驗證通過

### 待處理 / 下一步推展

#### 🔴 立即處理
- [ ] **Git 分支合併**：local 與 remote 已分叉（64 vs 75 commits），需 merge 後才能 push
- [ ] **Google 登入修復**：本地 Google OAuth popup 無法使用，需設定 Google Cloud Console（正式環境可能正常）

#### 🟡 功能完善
- [ ] **AdminSettings 儲存功能**：目前只是 UI，後端 API 尚未實作（設定值存到 DB）
- [ ] **系統設定 API**：`POST /api/admin/settings` — 儲存預設遊戲時間/最大玩家數/閒置超時等
- [ ] **管理端排行榜** `useAdminAuth` 一致性：加入 `enabled: isAuthenticated` 條件

#### 🟢 可選優化
- [ ] 對戰系統：實際水彈對戰流程 E2E 測試（場地→報名→配對→開戰→記錄→排名）
- [ ] PWA 離線功能驗證
- [ ] 正式環境部署 + 生產資料同步
- [ ] 測試覆蓋率提升（目前 1034 測試，可補前端元件測試）

## 工作紀錄

### 2026-03-10 (管理員登入修復 + 全站功能完整性審查)

#### 管理員登入修復
- [x] 新增 Email 登入支援 — `useAdminLogin.ts` 加入 `handleEmailLogin` / `handleEmailSignup`
- [x] 新增開發環境快速登入 — `POST /api/dev/custom-token` + `signInWithCustomToken`
- [x] `FieldAdminLogin.tsx` — 加入 Tabs（Email / Google）+ Dev 快速登入按鈕
- [x] Firebase UID 自動綁定 — `server/routes/auth.ts` email 匹配時自動綁定 firebaseUserId
- [x] 修復 handleDevLogin 未觸發驗證 — 加入 `setStep("firebase")` + `firebaseLoginMutation.reset()`

#### 管理端功能審查（27 個頁面 + 27 個 API）
- [x] 全部 27 個管理端 API 端點實測回傳 200
- [x] `AdminSettings.tsx` — 修復假儲存成功 → 改為「功能開發中」提示
- [x] `AdminStaffQRCodes.tsx` — 移除自訂 `fetchWithAdminAuth`，改用統一 `apiRequest`（修復 Auth token 缺失）
- [x] `AdminLeaderboard.tsx` — 評估為低優先級（server 端已保護路由）
- [x] `admin-devices/index.tsx` — LED 類型確認無 bug

#### 玩家端對戰功能審查（11 個頁面 + 30+ API）
- [x] displayName 統一使用確認 — 11/11 頁面正確
- [x] MyRegistrations 顯示場地名/日期/時間 — 正確
- [x] ClanManagePanel 戰隊管理整合 — 完整
- [x] 確認出席按鈕邏輯 — 正確
- [x] AuthBattleRoute 路由守衛 — 6 個需登入頁面已保護
- [x] refetchOnWindowFocus — 通知查詢已設置
- [x] 響應式 grid — 全部修正
- [x] API 端點回傳格式 — 全部正確（venues/rankings/slots/achievements 實測通過）

#### 修改檔案清單

| 檔案 | 動作 | 說明 |
|------|------|------|
| `client/src/hooks/useAdminLogin.ts` | 修改 | 加入 Email/Dev 登入 |
| `client/src/pages/FieldAdminLogin.tsx` | 修改 | Email/Google Tabs + Dev 按鈕 |
| `client/src/lib/firebase.ts` | 修改 | 加入 signInWithCustomToken |
| `server/routes/auth.ts` | 修改 | dev/custom-token + email 自動綁定 |
| `client/src/pages/AdminSettings.tsx` | 修改 | 假儲存 → 功能開發中提示 |
| `client/src/pages/AdminStaffQRCodes.tsx` | 修改 | 移除自訂 fetch → 統一 apiRequest |

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vite build` 構建通過

---

### 2026-03-08 (對戰系統完整功能優化 + Code Review 修復)

#### Phase 1：後端 API — JOIN users 表 + 資料擴充

##### 新增共用查詢模組
- [x] `server/storage/battle-storage-queries.ts`（新建 ~140 行）— 6 個 JOIN 查詢函式
  - `getRankingsByFieldWithNames()` — 排行榜 JOIN users
  - `getRegistrationsBySlotWithNames()` — 時段報名 JOIN users
  - `getClanMembersWithNames()` — 戰隊成員 JOIN users
  - `getPlayerResultsByResultWithNames()` — 對戰結果 JOIN users
  - `getPlayerHistoryWithDetails()` — 歷史 JOIN results/slots/venues
  - `getUpcomingRegistrationsWithDetails()` — 我的報名 JOIN slots/venues

##### 修改路由（5 個模組）
- [x] `battle-rankings.ts` — 排行榜/歷史回傳 displayName + slotDate/venueName
- [x] `battle-slots.ts` — 時段詳情的報名列表加 displayName
- [x] `battle-clans.ts` — 戰隊詳情/我的戰隊成員加 displayName + 新增 kick 端點
- [x] `battle-registration.ts` — MyRegistrations 回傳 slotDate/startTime/endTime/venueName/slotStatus
- [x] `battle-results.ts` — 對戰結果 playerResults 加 displayName

##### 共用工具
- [x] `server/utils/display-name.ts`（新建）— buildDisplayName 函式（原本重複 4 份）

#### Phase 2：前端 — 顯示玩家名稱
- [x] `BattleRanking.tsx` — RankingEntry 加 displayName，替換 userId.slice
- [x] `BattleSlotDetail.tsx` — RegistrationWithName interface，報名列表/TeamsDisplay 改用 displayName
- [x] `BattleClanDetail.tsx` — 成員列表改用 displayName
- [x] `BattleResult.tsx` — PlayerResultWithName interface，全員戰績改用 displayName
- [x] `BattleHistory.tsx` — 新增 HistoryRecord interface，顯示場地名/日期/時間

#### Phase 3：戰隊管理 UI
- [x] `ClanManagePanel.tsx`（新建 ~330 行）— 編輯戰隊 Dialog + 成員操作 DropdownMenu
  - 隊長可：編輯戰隊/升幹部/降隊員/轉讓隊長/踢出
  - 幹部可：踢出隊員
  - 含 MemberActionMenu 元件（per-member dropdown）
- [x] `BattleClanDetail.tsx` — 整合 ClanManagePanel + MemberActionMenu

#### Phase 4：響應式 + 路由守衛 + 通知優化
- [x] 響應式 Grid 修正（4 個檔案）— `grid-cols-2 sm:grid-cols-4` / `grid-cols-3 sm:grid-cols-5`
- [x] `App.tsx` — AuthBattleRoute 路由守衛（保護 6 個需登入路由）
- [x] `BattleNotifications.tsx` + `BattleLayout.tsx` — `refetchOnWindowFocus: true`

#### Phase 5：確認出席按鈕
- [x] `BattleSlotDetail.tsx` — confirmMutation + 確認出席按鈕 + CheckCircle 圖示

#### Code Review 修復（4 項 HIGH/MEDIUM）

| 問題 | 嚴重度 | 修復方式 |
|------|--------|---------|
| 確認出席 API 無所有權驗證 | HIGH | 新增 getRegistrationById + 完整所有權/狀態檢查 |
| buildDisplayName 重複 4 份 | HIGH | 抽取至 `server/utils/display-name.ts` |
| battle-storage.ts 超過 800 行 | HIGH | 拆分 6 個查詢至 `battle-storage-queries.ts`（822→707 行）|
| authFetch + ClanMemberWithName 重複 | MEDIUM | 抽取至 `client/src/lib/authFetch.ts` + export 共用型別 |

#### 修改檔案清單

| 檔案 | 動作 | 說明 |
|------|------|------|
| `server/utils/display-name.ts` | 新建 | buildDisplayName 共用函式 |
| `server/storage/battle-storage-queries.ts` | 新建 | 6 個 JOIN 查詢函式 |
| `server/storage/battle-storage.ts` | 修改 | 拆分查詢 + 新增 getRegistrationById |
| `server/routes/battle-rankings.ts` | 修改 | 使用帶名稱查詢 |
| `server/routes/battle-slots.ts` | 修改 | 使用帶名稱查詢 |
| `server/routes/battle-clans.ts` | 修改 | 使用帶名稱查詢 + kick 端點 |
| `server/routes/battle-registration.ts` | 修改 | MyRegistrations 擴充 + confirm 安全修復 |
| `server/routes/battle-results.ts` | 修改 | 使用帶名稱查詢 |
| `client/src/lib/authFetch.ts` | 新建 | 共用認證 fetch |
| `client/src/components/battle/ClanManagePanel.tsx` | 新建 | 戰隊管理面板 |
| `client/src/pages/BattleRanking.tsx` | 修改 | displayName + 響應式 |
| `client/src/pages/BattleSlotDetail.tsx` | 修改 | displayName + 確認出席 |
| `client/src/pages/BattleClanDetail.tsx` | 修改 | displayName + 管理面板整合 + 響應式 |
| `client/src/pages/BattleResult.tsx` | 修改 | displayName + 響應式 |
| `client/src/pages/BattleHistory.tsx` | 修改 | 場地名/日期顯示 |
| `client/src/pages/BattleMyProfile.tsx` | 修改 | 響應式 grid |
| `client/src/pages/BattleNotifications.tsx` | 修改 | authFetch 抽取 + refetchOnWindowFocus |
| `client/src/components/battle/BattleLayout.tsx` | 修改 | refetchOnWindowFocus |
| `client/src/App.tsx` | 修改 | AuthBattleRoute 路由守衛 |

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vite build` 構建通過

---

### 2026-03-04 (Firebase Auth 登入修復 — Private Key PEM 解析錯誤)

#### 問題描述
所有 Firebase token 驗證失敗，導致玩家端/管理端登入全部無法運作。

#### 根因分析
- `.env` 的 `FIREBASE_ADMIN_PRIVATE_KEY` 使用雙引號包裹，含 `\\n` 跳脫序列
- `node --env-file` 處理雙引號內的 `\\n` → 變成 `\`(charCode 92) + 實際換行(charCode 10)
- 原修正邏輯用 `privateKey.includes("\\n")` 檢查 literal `\n`（charCode 92+110），永遠不匹配
- Firebase Admin SDK 收到含 `\` + 換行的 PEM → 解析失敗 → `verifyFirebaseToken()` 永遠回傳 null

#### 修復
- [x] `server/firebaseAuth.ts` — 改寫 Private Key 格式化邏輯
  ```typescript
  // 修正前（無效）：
  if (privateKey.includes("\\n")) {
    formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
  }
  // 修正後：
  formattedPrivateKey = privateKey
    .replace(/\\\n/g, '\n')   // \+實際換行 → 只保留換行
    .replace(/\\n/g, '\n');   // literal \n → 實際換行
  ```

#### 驗證
- [x] Firebase Admin SDK 成功連線（列出 14 個 Firebase 使用者）
- [x] `verifyIdToken()` 驗證成功
- [x] `isAuthenticated` middleware 回傳 200
- [x] `npx tsc --noEmit` 零錯誤
- [x] `npx vitest run` 75 檔案 1034 測試全通過

---

### 2026-03-04 (水彈對戰 PK 擂台 — Phase 5-8 完善 + E2E 測試)

#### Phase 5-7 已在前一次對話完成（管理端儀表板/排名/賽季/成就系統）

#### Phase 8：測試補齊

##### 單元測試（3 檔案）
- [x] `server/__tests__/battle-elo.test.ts` — 14 個 ELO 引擎測試
- [x] `server/__tests__/battle-achievement-checker.test.ts` — 8 個成就檢測測試
- [x] `shared/schema/__tests__/battle-schemas.test.ts` — 12 個 Schema 測試

##### API 整合測試（10 檔案）
- [x] `server/__tests__/battle-venues.test.ts` — 8 個場地 CRUD 測試
- [x] `server/__tests__/battle-slots.test.ts` — 10 個時段生命週期測試
- [x] `server/__tests__/battle-registration.test.ts` — 10 個報名流程測試
- [x] `server/__tests__/battle-matchmaking.test.ts` — 6 個配對測試
- [x] `server/__tests__/battle-results-api.test.ts` — 8 個結果記錄 + ELO 測試
- [x] `server/__tests__/battle-rankings.test.ts` — 7 個排名 API 測試
- [x] `server/__tests__/battle-clans.test.ts` — 10 個戰隊管理測試
- [x] `server/__tests__/battle-notifications.test.ts` — 5 個通知 API 測試
- [x] `server/__tests__/admin-battle.test.ts` — 8 個管理端統計測試
- [x] `server/__tests__/admin-battle-seasons.test.ts` — 8 個賽季管理測試

##### E2E 完整流程測試
- [x] `scripts/test-battle-e2e.mjs` — 27 個 E2E 測試全通過
  - 場地建立 → 時段建立 → 玩家報名 → 配對 → 開始對戰
  - 結果記錄 + ELO 計算（勝方 +30/+20，敗方 -20）
  - 成就系統（首戰/首勝/首 MVP/金段/白金段 5 個成就解鎖）
  - 重複記錄 → 409
  - 排行榜驗證
  - 賽季完整流程（建立→結束→快照→重置）
  - 管理端統計數據驗證

##### 修復的 Bug
1. `server/routes/admin-battle.ts` — `sql ANY()` 不支援 JS 陣列 → 改用 `inArray()`
2. `server/routes/battle-slots.ts` — `createdBy: req.admin.id` FK 違反（admin 不在 users 表）→ 移除
3. `shared/schema/battle-results.ts` — `recordedBy` FK 指向 users.id 但傳入 admin ID → 改為 nullable 無 FK

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 75 檔案 1034 測試全通過、E2E 27/27 通過

### 2026-03-04 (水彈對戰 PK 擂台 — Phase 1+2 完整實作)

#### Phase 1 MVP：場地 + 時段 + 報名 + 配對

##### Schema（3 張表）
- [x] `shared/schema/battle-venues.ts` — battleVenues 場地表
- [x] `shared/schema/battle-slots.ts` — battleSlots 時段表 + battleRegistrations 報名表 + battlePremadeGroups 預組隊伍表

##### Storage
- [x] `server/storage/battle-storage.ts` — 場地/時段/報名/預組隊伍 CRUD 方法

##### API 路由（4 個模組）
- [x] `server/routes/battle-venues.ts` — 場地 CRUD（GET 列表/詳情, POST/PATCH/DELETE）
- [x] `server/routes/battle-slots.ts` — 時段管理（GET/POST/PATCH + batch/cancel/start/finish）
- [x] `server/routes/battle-registration.ts` — 報名/取消/預組隊伍/Check-in
- [x] `server/routes/battle-matchmaking.ts` — 蛇形分配配對 + WebSocket 廣播

##### 前端頁面（4 頁）
- [x] `client/src/pages/BattleHome.tsx` — 玩家首頁（場地列表 + 我的報名）
- [x] `client/src/pages/BattleSlotDetail.tsx` — 時段詳情（報名/組隊/邀請碼）
- [x] `client/src/pages/AdminBattleVenues.tsx` — 管理端場地 CRUD
- [x] `client/src/pages/AdminBattleSlots.tsx` — 管理端時段管理 + 配對觸發

#### Phase 2：對戰結果 + ELO 排名

##### Schema（3 張表）
- [x] `shared/schema/battle-results.ts` — battleResults + battlePlayerResults + battlePlayerRankings
  - Tier 段位系統：bronze(0-299) → silver → gold → platinum(1000) → diamond → master(2000+)
  - `getTierFromRating()` 純函式 + `tierLabels` 中文對照

##### ELO 引擎
- [x] `server/services/battle-elo.ts` (~90 行) — Modified ELO 系統
  - K-factor 動態調整（新手 40 / 一般 20 / 高手 10）
  - 連勝加分（+5/勝, 上限 +15）+ MVP 加分（+10）

##### Storage 擴充（9 個新方法）
- [x] `battle-storage.ts` — 結果 CRUD + 排名 getOrCreate/update + 歷史查詢

##### API 路由（2 個模組）
- [x] `server/routes/battle-results.ts` — POST 記錄結果（含 ELO 計算）+ GET 查詢
- [x] `server/routes/battle-rankings.ts` — 排行榜 + 我的排名 + 對戰歷史

##### 前端頁面（3 頁）
- [x] `client/src/pages/BattleResult.tsx` — 對戰結果（勝負/隊伍分數/個人戰績/ELO 變動）
- [x] `client/src/pages/BattleRanking.tsx` — 排行榜（段位卡片 + 全場域排名）
- [x] `client/src/pages/BattleHistory.tsx` — 個人對戰歷史

**新增檔案**: 17 個（schema 2 + storage 1 + services 2 + routes 6 + pages 7）
**修改檔案**: App.tsx, index.ts, websocket.ts, types.ts, schema/index.ts, schema/relations.ts

**驗證結果**: `npm run db:push` 成功、`npx tsc --noEmit` 零錯誤、`npx vitest run` 62 檔案 898 測試全通過

#### Phase 3：戰隊系統

##### Schema（2 張表）
- [x] `shared/schema/battle-clans.ts` — battleClans 表 + battleClanMembers 子表
  - 戰隊角色：leader / officer / member
  - 唯一約束：場域+名稱、場域+標籤

##### Storage 擴充（10 個新方法）
- [x] `battle-storage.ts` — createClan, getClan, getClansByField, updateClan, getClanMembers, addClanMember, removeClanMember, getUserClan, updateClanMemberRole, updateClanStats

##### API 路由
- [x] `server/routes/battle-clans.ts` (~260 行) — 8 個端點
  - GET 列表 + GET 詳情（含成員）+ GET 我的戰隊
  - POST 建立（自動加入隊長）+ PATCH 更新（隊長/幹部限定）
  - POST 加入 + DELETE 離開 + POST 轉讓隊長 + POST 設定角色

##### 前端頁面（3 頁 + BattleHome 更新）
- [x] `BattleClanDetail.tsx` — 戰隊詳情（數據卡/成員列表/加入離開）
- [x] `BattleClanCreate.tsx` — 建立戰隊表單
- [x] `BattleMyProfile.tsx` — 我的戰鬥檔案（段位/戰隊/快速連結）
- [x] `BattleHome.tsx` — 底部新增 4 格導航（個人檔案/排行榜/戰隊/歷史）

**驗證結果**: `npm run db:push` 成功、`npx tsc --noEmit` 零錯誤、`npx vitest run` 62 檔案 898 測試全通過

#### Phase 4：通知排程系統

##### Schema（1 張表）
- [x] `shared/schema/battle-notifications.ts` — battleNotifications 表
  - 9 種通知類型（slot_confirmed, reminder_24h, reminder_2h, confirm_request, team_assigned, check_in_open, slot_cancelled, result_published, clan_invite）
  - 3 種通知頻道（in_app, push, email）
  - 4 種通知狀態（pending, sent, read, failed）
  - JSONB 欄位儲存通知內容（title, body, actionUrl, meta）

##### Storage 擴充（8 個新方法）
- [x] `battle-storage.ts` — createNotification, createNotificationsBatch, getNotificationsByUser, getUnreadCount, markNotificationAsRead, markAllNotificationsAsRead, getPendingScheduledNotifications, updateNotificationStatus

##### 通知服務
- [x] `server/services/battle-notifier.ts` — 統一通知發送介面 + 9 種通知內容建構函式
- [x] `server/services/battle-scheduler.ts` — 排程器（定期處理待發送通知 + 場次提醒排程 API）

##### API 路由（4 個端點）
- [x] `server/routes/battle-notifications.ts`
  - GET `/api/battle/notifications` — 我的通知列表
  - GET `/api/battle/notifications/unread-count` — 未讀數量
  - POST `/api/battle/notifications/:id/read` — 標記已讀
  - POST `/api/battle/notifications/read-all` — 全部標記已讀

##### 前端
- [x] `BattleNotifications.tsx` — 通知中心頁面（列表 + 標記已讀 + 全部已讀）
- [x] `BattleHome.tsx` — 標題列通知鈴鐺（含未讀紅點，30 秒自動刷新）+ 底部導航新增通知入口
- [x] `App.tsx` — 新增 `/battle/notifications` 路由

**驗證結果**: `npm run db:push` 成功、`npx tsc --noEmit` 零錯誤、`npx vitest run` 62 檔案 898 測試全通過

---

### 2026-02-24 (Vitest Mock 洩漏修復 — 穩定性從 60% 提升到 100%)

修復 Vitest 測試間歇性失敗問題。根本原因：`vi.clearAllMocks()` 不清空 `mockResolvedValueOnce` 佇列，殘留值在下一個測試被消費，導致錯誤的 HTTP status code。

#### 問題分析
- `vi.clearAllMocks()` 只清除呼叫記錄（.mock.calls），不清空 `mockResolvedValueOnce` 佇列
- 不能直接改用 `vi.resetAllMocks()` 因為會破壞 middleware factory mock（requireAdminAuth, isAuthenticated）
- 10 個測試檔案共 126 次 `mockResolvedValueOnce` 呼叫，佇列殘留風險極高

#### 修復方案：精準 mockReset()
- [x] `adminContent.test.ts` — 循環 reset 所有 mockStorage 函式（38 次 once 呼叫）
- [x] `adminRoles.test.ts` — reset 7 個 query mock + chain mock + 重建鏈式關係
- [x] `adminGames.test.ts` — reset query mock + chain mock + select chain + 重建全部鏈式關係（22 次 once 呼叫）
- [x] `adminFields.test.ts` — reset query mock + chain mock + 重建鏈式關係
- [x] `adminModules.test.ts` — reset chain mock + 重建鏈式關係
- [x] `team-votes.test.ts` — reset 3 個 query mock + chain mock + 重建鏈式關係（27 次 once 呼叫）
- [x] `team-scores.test.ts` — reset 2 個 query mock + chain mock + 重建鏈式關係（16 次 once 呼叫）

#### 修復方案：importOriginal 保護
- [x] `devices.test.ts` — `vi.mock("../routes/utils")` 改用 `importOriginal` 保留 `validateId` 純函式
- [x] `locations.test.ts` — 同上，防止跨檔案洩漏時 `validateId` 變成 undefined

#### 安全網
- [x] `vitest.config.ts` — 新增 `retry: 2`（Vitest worker 層級偶發問題的最後防線）
- [x] `vitest.config.ts` — `environmentMatchGlobs` 設定 server/shared 使用 node 環境

#### 驗證結果
- 修復前：10 次測試通過率 60%（6/10）
- 修復後：20 次測試通過率 100%（20/20），無任何 retry 事件

**修改檔案**: 9 個測試檔案 + vitest.config.ts

---

### 2026-02-22 (Phase 27-B：Recur.tw 金流補齊 — Bug 修復 + 章節付款 + 測試)

修復已知 Bug、補齊章節級線上付款、新增管理端 recurProductId UI、撰寫完整測試。

#### Bug 修復
- [x] `webhook-recur.ts` — rawBody 改用 `(req.rawBody as Buffer).toString("utf-8")`（原 `JSON.stringify` 重建字串導致簽名驗證失敗）
- [x] `PurchaseSuccess.tsx` — 改用 `/api/transactions/:txId/status` 端點輪詢交易狀態（原 `purchases?.find()` 取到錯誤記錄）

#### 新增功能
- [x] `player-purchases.ts` — 新增 `GET /api/transactions/:txId/status` 端點（含 userId 驗證）
- [x] `player-purchases.ts` — `POST /api/games/:gameId/checkout` 支援 `chapterId` body 參數（章節級付款）
- [x] `PurchaseGate.tsx` — per_chapter 模式顯示章節清單（Lock/Unlock 狀態 + 單章購買按鈕）
- [x] `useGameSettings.ts` — PricingState 新增 `recurProductId`，handleSave 傳送至後端
- [x] `SettingsCards.tsx` — PricingCard 在 one_time 模式顯示 Recur 產品 ID 輸入欄位
- [x] `GameSettings.tsx` — 傳遞 `onRecurProductIdChange` prop

#### 測試（28 個新測試）
- [x] `webhook-recur.test.ts` (9 測試) — 簽名驗證、事件處理、冪等性、錯誤處理
- [x] `player-purchases-checkout.test.ts` (15 測試) — Checkout、交易狀態、存取權查詢
- [x] `PurchaseSuccess.test.tsx` (4 測試) — 成功/失敗/載入/無 txId 狀態

**新增檔案**: `server/__tests__/webhook-recur.test.ts`, `server/__tests__/player-purchases-checkout.test.ts`, `client/src/pages/__tests__/PurchaseSuccess.test.tsx`

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 62 檔案 898 測試全通過

---

### 2026-02-22 (Phase 31-1：統一 Firebase 認證 — 移除密碼登入 + super_admin 場域選擇)

簡化管理員登入流程，統一使用 Firebase 認證，移除舊密碼登入機制。

#### Phase 1-A：簡化登入流程
- [x] 修改 `useAdminLogin.ts` — 移除 `LoginStep` 的 `"password"` 選項
  - 移除 `username/password/showPassword` 狀態
  - 移除 `passwordLoginMutation`、`handlePasswordSubmit`、`switchToPasswordLogin` 等函式
  - `handleFieldSubmit` 允許空 fieldCode（super_admin 支援）
- [x] 改寫 `AdminLogin.tsx` — 移除密碼表單，簡化為：場域碼 → Firebase Google 登入
  - 新增 super_admin 提示：「超級管理員可留空」
- [x] 改寫 `FieldAdminLogin.tsx` — 同步移除密碼登入相關 UI
- [x] 簡化 `LoginErrorAlert.tsx` — 移除 `onSwitchToPassword` prop 和密碼登入按鈕
- [x] 刪除 `PasswordForm.tsx` 元件
- [x] 更新 `admin-login/index.ts` — 移除 PasswordForm 匯出

#### Phase 1-B：super_admin 場域選擇
- [x] 修改 `server/routes/auth.ts` `/api/admin/firebase-login`
  - 空 fieldCode → 全域搜尋 firebaseUserId → 確認 super_admin 角色 → 自動取得場域
  - 非 super_admin 空 fieldCode → 400「非超級管理員請輸入場域編號」
- [x] 新增 `FieldSelector.tsx` (~100 行) — super_admin 場域切換下拉選單
  - localStorage 持久化場域選擇
  - 非 super_admin 顯示當前場域名稱
  - 匯出 `getStoredFieldId()` / `setStoredFieldId()` 工具函式
- [x] 修改 `AdminStaffLayout.tsx` — 頂部 header 整合 FieldSelector

#### Phase 1-C：後端清理
- [x] `POST /api/admin/login` 改為 410 Gone + 遷移提示
  - 回傳：`{ message: "密碼登入已停用，請使用 Google 帳號登入", migration: "..." }`
- [x] 移除 `adminLogin` 和 `storage` 未使用 import

#### 測試更新
- [x] 更新 `auth.test.ts` — 密碼登入測試改為驗證 410 Gone 行為（2 測試）
- [x] 新增 super_admin 空 fieldCode 測試：無帳號回傳 404、非 super_admin 回傳 400
- [x] 59 個測試檔案、870 個測試全部通過

**刪除檔案**: `client/src/components/admin-login/PasswordForm.tsx`
**新增檔案**: `client/src/components/FieldSelector.tsx`

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 59 檔案 870 測試全通過

---

### 2026-02-22 (Phase 31-2+3：統一 Layout + 路由合併 + 清理)

合併 `/admin/*` 和 `/admin-staff/*` 雙軌管理系統為統一 `UnifiedAdminLayout`。

#### Phase 2：統一 Layout 核心
- [x] `scripts/seed.ts` — 新增 field_director、field_executor 角色（16 權限 x 6 分類）
- [x] `client/src/config/admin-menu.ts` (109 行) — 集中菜單配置 + `filterMenuByPermissions()` 純函式
- [x] `client/src/components/UnifiedAdminLayout.tsx` (209 行) — 統一 Layout（useAdminAuth + 權限過濾菜單 + FieldSelector）
- [x] `client/src/components/shared/ProtectedAdminRoute.tsx` — 新增 `requiredPermission` prop + 403 提示

#### Phase 3-A：遷移 9 個 AdminStaff 頁面
- [x] AdminStaffDashboard/Fields/Roles/Accounts/AuditLogs/Games/Players/QRCodes/Templates — `AdminStaffLayout` → `UnifiedAdminLayout`

#### Phase 3-B：遷移 9 個 Admin 頁面
- [x] AdminGames/Settings/Sessions/Leaderboard/Templates/ItemEditor/AchievementEditor/FieldSettingsPage/TicketsOverview — `AdminLayout` → `UnifiedAdminLayout`

#### Phase 3-C：3 個內嵌 Sidebar 頁面重構
- [x] `AdminDashboard.tsx` (330→210 行) — 移除內嵌 SidebarProvider，保留儀表板卡片
- [x] `AdminAnalytics.tsx` (464→393 行) — 移除內嵌 Sidebar，`useAuth` → `useAdminAuth`，抽出 5 個子元件
- [x] `admin-devices/index.tsx` (515→416 行) — 移除內嵌 Sidebar，`useAuth` → `useAdminAuth`，header 轉 actions prop
- [x] `admin-devices/constants.ts` — 移除 menuItems 死碼 + 未使用 icon import

#### Phase 3-D：路由與登入統一
- [x] `FieldAdminLogin.tsx` — 合併為唯一登入頁（Shield icon、超級管理員可留空場域碼）
- [x] `App.tsx` — 所有管理路由統一到 `/admin/*`，13 個 `/admin-staff/*` 重導向

#### Phase 3-E+F：清理 + 測試
- [x] 移除 `isAdminStaff` 死碼（game-editor、AchievementEditor、ItemEditor、admin-redeem-codes、useGameSettings）
- [x] `Landing.tsx` 連結修正 `/admin-staff/login` → `/admin/login`
- [x] `AdminLogin.tsx` → 重導向到 `/admin/login`
- [x] `AdminLayout.tsx` → deprecated re-export UnifiedAdminLayout
- [x] `AdminStaffLayout.tsx` → deprecated re-export UnifiedAdminLayout
- [x] 測試更新：GameEditor.test.tsx、AdminGames.test.tsx、admin-management.spec.ts

**成功標準達成**：
- ✅ 只有一個 Layout（UnifiedAdminLayout）
- ✅ 只有一個登入頁（/admin/login）
- ✅ 所有管理頁在 /admin/* 下
- ✅ /admin-staff/* 自動重導向（13 條）
- ✅ super_admin 看全部菜單 / field_manager 看場域菜單 / field_executor 只看唯讀項目
- ✅ FieldSelector 對 super_admin 顯示

**新增檔案**: `client/src/config/admin-menu.ts`, `client/src/components/UnifiedAdminLayout.tsx`
**Deprecated**: `AdminLayout.tsx`, `AdminStaffLayout.tsx`, `AdminLogin.tsx`

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 59 檔案 870 測試全通過、`npm run build` 成功

---

### 2026-02-23 (Phase 31：管理介面重構 — 場域設定 + AI Key + 票券 + 配額)

針對管理介面 UX 問題進行優化：場域獨立 AI Key、票券管理直接入口、配額控制。

#### Phase 0：基礎準備
- [x] 新增 `FieldSettings` 介面 (`shared/schema/fields.ts`) — AI 設定、配額、功能開關、品牌
- [x] 新增 `parseFieldSettings()` 安全解析函式
- [x] 新增 `server/lib/crypto.ts` (~65 行) — AES-256-GCM 加密/解密 API Key
- [x] 修改 `server/lib/gemini.ts` — `verifyPhoto()` 和 `scoreTextAnswer()` 新增可選 `apiKey` 參數
- [x] 新增 9 個 crypto 單元測試（roundtrip、IV 隨機、竄改偵測、格式驗證等）

#### Phase 5：AI 每場域獨立 Key
- [x] 修改 `server/routes/ai-scoring.ts` — Schema 加入 `gameId`，新增 `resolveAiApiKey(gameId)`
  - 路徑：gameId → games 表 → fieldId → fields 表 → settings → 解密 API Key
  - 場域 `enableAI=false` → 回傳 503
  - 無場域 Key → fallback 到全域 `GEMINI_API_KEY`
- [x] 修改 `PhotoMissionPage.tsx` — AI 呼叫加入 `gameId`
- [x] 修改 `TextVerifyPage.tsx` — 加入 `gameId` prop + AI 呼叫加入 `gameId`

#### Phase 4：場域設定 UI
- [x] 新增 GET/PATCH `/api/admin/fields/:id/settings` 端點 (`admin-fields.ts`)
  - GET: Key 遮罩回傳（hasGeminiApiKey: boolean）
  - PATCH: Key 自動 AES 加密、支援布林/數值/字串設定、稽核日誌
- [x] 新增 `FieldSettingsPage.tsx` (~350 行) — 三個 Tab
  - AI 設定：開關 + API Key（遮罩顯示/新增/清除）+ 加密說明
  - 功能與配額：maxGames、maxSessions、收費/團隊/競賽開關
  - 品牌：主色調（color picker）、歡迎訊息
- [x] 配額檢查：遊戲建立時檢查 `maxGames`（`admin-games.ts`）

#### Phase 6：票券/收款管理
- [x] 新增 GET `/api/admin/tickets/summary` — 各遊戲收入統計 + 兌換碼統計 + 本月收入
- [x] 新增 `TicketsOverview.tsx` (~170 行) — 統計卡片 + 遊戲明細列表
- [x] AdminLayout 側邊導航新增「票券/收款」和「場域設定」入口
- [x] AdminStaffLayout 導航新增「場域進階設定」和「票券/收款」入口
- [x] App.tsx 路由：`/admin/tickets`、`/admin/field-settings`、`/admin-staff/*` 同步

#### 路由和導航變更
| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/admin/tickets` | TicketsOverview | 票券/收款統計總覽 |
| `/admin/field-settings` | FieldSettingsPage | 場域 AI/配額/品牌設定 |
| `/admin-staff/tickets` | TicketsOverview | 同上（場域管理員） |
| `/admin-staff/field-settings` | FieldSettingsPage | 同上（場域管理員） |

**新增檔案**: `server/lib/crypto.ts`, `client/src/pages/admin/FieldSettingsPage.tsx`, `client/src/pages/admin/TicketsOverview.tsx`, `server/__tests__/crypto.test.ts`

**驗證結果**: `npx tsc --noEmit` 零錯誤、`npx vitest run` 59 檔案 870 測試全通過、`npm run build` 成功

---

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
| Schema 驗證 | 6 | 79 |
| 前端元件測試 | 24 | 312 |
| API 整合測試 | 32 | 500 |
| Storage 層 | 1 | 29 |
| 工具函式 | 12 | 114 |
| **Vitest 合計** | **75** | **1034** |
| E2E 測試 (Playwright) | 5 | 25 |
| 水彈 E2E 流程測試 | 1 | 27 |
| **總計** | **81** | **1086** |

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
11. ~~Vitest mock 洩漏~~ → 已修復（mockResolvedValueOnce 佇列清理 + importOriginal 保護 + retry 安全網）
