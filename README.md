# 賈村競技場 - 實境遊戲平台

結合 QR Code 掃描、GPS 定位、團隊合作等互動機制的沉浸式戶外實境遊戲平台。

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI |
| 後端 | Express + WebSocket + MQTT |
| 資料庫 | PostgreSQL 16 (Drizzle ORM) |
| 認證 | Firebase Auth（玩家端）+ JWT（場域管理員） |
| 媒體 | Cloudinary |
| 地圖 | Leaflet.js |
| 路由 | Wouter |
| 狀態管理 | TanStack Query |

---

## 快速開始

### 前置需求

- Node.js 20+
- Docker Desktop（PostgreSQL 資料庫）
- Firebase 專案（認證用）
- Cloudinary 帳號（媒體上傳用）

### 1. 啟動資料庫

```bash
# 建立 Docker Volume（首次）
docker volume create gameplatform-postgres-data

# 啟動 PostgreSQL 16
docker-compose up -d
```

資料庫會在 `localhost:5437` 上執行。

### 2. 設定環境變數

建立 `.env` 檔案，填入以下必要設定：

```env
# 資料庫
DATABASE_URL=postgresql://postgres:postgres@localhost:5437/gameplatform

# 應用設定
PORT=3333
SESSION_SECRET=你的_session_密鑰

# Firebase（前端用，需 VITE_ 前綴）
VITE_FIREBASE_API_KEY=你的_firebase_api_key
VITE_FIREBASE_APP_ID=你的_firebase_app_id
VITE_FIREBASE_PROJECT_ID=你的_firebase_project_id

# Firebase Admin SDK（後端用）
FIREBASE_ADMIN_CLIENT_EMAIL=你的_firebase_admin_email
FIREBASE_ADMIN_PRIVATE_KEY=你的_firebase_admin_private_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=你的_cloudinary_name
CLOUDINARY_API_KEY=你的_cloudinary_api_key
CLOUDINARY_API_SECRET=你的_cloudinary_api_secret
```

### 3. 安裝依賴並同步資料庫

```bash
npm install
npm run db:push
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 `http://localhost:3333` 即可使用。

---

## 可用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器（前後端一體） |
| `npm run build` | 建置正式版 |
| `npm start` | 啟動正式版 |
| `npm run check` | TypeScript 型別檢查 |
| `npm run db:push` | 同步資料庫 Schema |
| `npm test` | 啟動測試（watch 模式） |
| `npm run test:run` | 執行一次全部測試 |
| `npm run test:coverage` | 執行測試並顯示覆蓋率 |
| `npm run lint` | ESLint 程式碼檢查 |
| `npm run format` | Prettier 格式化 |

---

## 系統角色

本平台有三種使用角色：

### 1. 玩家

透過 Firebase 匿名登入或社群帳號登入，參與實境遊戲。

**功能**：
- 瀏覽遊戲大廳、選擇遊戲
- 掃描 QR Code 進入遊戲
- 進行多種互動關卡（影片、問答、GPS 導航、拍照、QR 掃描等）
- 組隊合作或單人挑戰
- 查看排行榜與成就
- 章節進度追蹤

### 2. 超級管理員（Admin）

從 `/admin/login` 進入，使用 Firebase 認證登入。

**功能**：
- 管理所有遊戲（建立、編輯、發布）
- 遊戲編輯器（拖拉排序頁面、設定關卡內容）
- 章節管理（建立章節、指定頁面、設定解鎖條件）
- 地點、道具、成就編輯
- 遊戲設定（團隊模式、地點鎖定等）
- QR Code 產生與管理
- 場次管理與數據分析
- 裝置管理（MQTT 硬體控制）
- 排行榜與系統設定

### 3. 場域管理員（Admin Staff）

從 `/admin-staff/login` 進入，使用帳號密碼 + JWT 認證。

**功能**：
- 場域管理（多場域隔離）
- 角色與權限管理（RBAC）
- 帳號管理（場域下的人員）
- 場域內遊戲管理
- 玩家管理
- QR Code 管理
- 稽核日誌查看

---

## 頁面路由

### 玩家端

| 路徑 | 功能 |
|------|------|
| `/` | 首頁（登入） |
| `/home` | 遊戲大廳 |
| `/game/:gameId` | 遊戲進行 |
| `/game/:gameId/chapters` | 章節選擇 |
| `/game/:gameId/chapters/:chapterId` | 章節遊戲 |
| `/team/:gameId` | 團隊大廳（組隊） |
| `/map/:gameId` | 地圖導航 |
| `/leaderboard` | 排行榜 |
| `/g/:slug` | QR Code 遊戲入口 |

### 超級管理員

| 路徑 | 功能 |
|------|------|
| `/admin/login` | 管理員登入 |
| `/admin` | 儀表板 |
| `/admin/games` | 遊戲管理 |
| `/admin/games/:gameId` | 遊戲編輯器 |
| `/admin/games/:gameId/locations` | 地點編輯 |
| `/admin/games/:gameId/items` | 道具編輯 |
| `/admin/games/:gameId/achievements` | 成就編輯 |
| `/admin/games/:gameId/settings` | 遊戲設定 |
| `/admin/sessions` | 場次管理 |
| `/admin/devices` | 裝置管理 |
| `/admin/analytics` | 數據分析 |
| `/admin/leaderboard` | 排行榜管理 |
| `/admin/settings` | 系統設定 |

### 場域管理員

| 路徑 | 功能 |
|------|------|
| `/admin-staff/login` | 場域管理員登入 |
| `/admin-staff/dashboard` | 場域儀表板 |
| `/admin-staff/fields` | 場域管理 |
| `/admin-staff/roles` | 角色管理 |
| `/admin-staff/accounts` | 帳號管理 |
| `/admin-staff/games` | 遊戲管理 |
| `/admin-staff/games/:gameId` | 遊戲編輯器 |
| `/admin-staff/players` | 玩家管理 |
| `/admin-staff/qrcodes` | QR Code 管理 |
| `/admin-staff/audit-logs` | 稽核日誌 |

---

## API 路由

所有 API 路徑以 `/api` 開頭。

### 認證

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/player` | 玩家 Firebase 認證 |
| POST | `/api/auth/admin/login` | 管理員帳密登入 |
| POST | `/api/auth/admin/firebase` | 管理員 Firebase 登入 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/session` | 驗證 Session |

### 遊戲管理（Admin）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/admin/games` | 遊戲列表 |
| POST | `/api/admin/games` | 建立遊戲 |
| GET | `/api/admin/games/:id` | 遊戲詳情 |
| PATCH | `/api/admin/games/:id` | 更新遊戲 |
| DELETE | `/api/admin/games/:id` | 刪除遊戲 |
| POST | `/api/admin/games/:id/publish` | 發布遊戲 |
| POST | `/api/admin/games/:id/qrcode` | 產生 QR Code |
| GET | `/api/admin/games/:id/qrcode` | 取得 QR Code |

### 遊戲內容（Admin）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET/POST | `/api/admin/games/:id/items` | 道具 CRUD |
| GET/POST | `/api/admin/games/:id/pages` | 頁面 CRUD |
| GET/POST | `/api/admin/games/:id/events` | 事件 CRUD |
| GET/POST | `/api/admin/games/:id/achievements` | 成就 CRUD |

### 玩家遊戲

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/games` | 可用遊戲列表 |
| GET | `/api/games/:id` | 遊戲詳情 |
| POST | `/api/games/:id/start` | 開始遊戲 |
| POST | `/api/games/:id/progress` | 更新進度 |
| GET | `/api/games/slug/:slug` | 透過 slug 取得遊戲 |

### 團隊

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/teams` | 建立團隊 |
| POST | `/api/teams/join` | 加入團隊 |
| GET | `/api/teams/:id` | 團隊詳情 |
| PATCH | `/api/teams/:id/ready` | 更新準備狀態 |
| POST | `/api/teams/:id/leave` | 離開團隊 |
| POST | `/api/teams/:id/start` | 開始遊戲 |

### 其他主要路由

| 模組 | 路徑前綴 | 說明 |
|------|---------|------|
| 章節（管理員） | `/api/admin/chapters` | 章節 CRUD + 排序 |
| 章節（玩家） | `/api/chapters` | 章節進度 + 解鎖 |
| 地點 | `/api/locations` | GPS 地點 + 導航 |
| 裝置 | `/api/devices` | MQTT 裝置控制 |
| 排行榜 | `/api/leaderboard` | 排名查詢 |
| 媒體 | `/api/media` | Cloudinary 上傳 |
| 團隊投票 | `/api/team-votes` | 投票建立 + 投票 |
| 團隊分數 | `/api/team-scores` | 分數更新 + 紀錄 |
| 場域管理 | `/api/admin/fields` | 場域 CRUD |
| 角色管理 | `/api/admin/roles` | RBAC 角色 |
| WebSocket | `ws://` | 即時通訊 |

---

## 遊戲頁面類型

遊戲由多種頁面類型組成，場主可自由搭配：

| 頁面類型 | 說明 |
|---------|------|
| `text_card` | 文字卡片（劇情/說明） |
| `video` | 影片播放 |
| `dialogue` | 對話互動 |
| `qr_scan` | QR Code 掃描任務 |
| `gps_navigation` | GPS 導航至指定地點 |
| `photo_mission` | 拍照任務 |
| `quiz` | 問答題 |
| `puzzle` | 解謎 |
| `vote` | 團隊投票 |
| `motion_challenge` | 體感挑戰 |
| `conditional_verify` | 條件驗證 |
| `time_bomb` | 計時炸彈 |
| `button` | 按鈕互動 |
| `lock` | 密碼鎖 |
| `checkpoint` | 檢查站 |

---

## 資料庫

- 共 37 個資料表
- ORM: Drizzle（型別安全、自動遷移）
- 容器: Docker PostgreSQL 16，port 5437

```bash
# 啟動資料庫
docker-compose up -d

# 同步 Schema（開發用）
npm run db:push
```

---

## 測試

使用 Vitest + Supertest 測試框架。

```bash
# 執行全部測試
npm run test:run

# Watch 模式
npm test

# 顯示覆蓋率
npm run test:coverage
```

**目前狀態**: 23 個測試檔案、392 個測試、全數通過

### 測試涵蓋範圍

| 類型 | 測試檔案 | 測試數 |
|------|---------|--------|
| Schema 驗證 | games, sessions, chapters | 32 |
| 工具函式 | authUtils, utils, routeUtils, qrCodeService, map-utils | 52 |
| API 整合 | leaderboard, playerGames, adminChapters, playerChapters | 66 |
| API 整合 | teams, auth, locations, playerSessions, devices | 121 |
| API 整合 | team-scores, team-votes, adminGames, adminContent | 82 |
| Storage 層 | chapterStorage | 29 |
| 前端常數 | admin-games/constants | 11 |
| **合計** | **23 個檔案** | **392** |

---

## 專案結構

```
.
├── client/                    # 前端
│   ├── src/
│   │   ├── components/        # 共用元件
│   │   │   ├── ui/            # Radix UI 基礎元件
│   │   │   ├── shared/        # 共用業務元件
│   │   │   ├── landing/       # Landing 頁面子元件
│   │   │   └── map/           # 地圖子元件
│   │   ├── contexts/          # React Context
│   │   ├── hooks/             # 共用 Hooks
│   │   ├── lib/               # 工具函式
│   │   ├── pages/             # 頁面元件
│   │   │   ├── admin-devices/ # 裝置管理（子元件）
│   │   │   ├── admin-games/   # 遊戲管理（Hook + 表格）
│   │   │   ├── admin-staff/   # 場域管理員（子元件）
│   │   │   ├── admin-staff-games/ # 場域遊戲管理（Hook）
│   │   │   ├── achievement-editor/ # 成就編輯器（子元件）
│   │   │   ├── game-editor/   # 遊戲編輯器（最複雜）
│   │   │   ├── game-settings/ # 遊戲設定（Hook + 卡片）
│   │   │   ├── photo-mission/ # 拍照任務（Hook + View）
│   │   │   ├── qr-scan/       # QR 掃描（Hook + View）
│   │   │   └── team-lobby/    # 團隊大廳（Hook + View）
│   │   └── styles/            # 全域樣式
│   └── index.html
├── server/                    # 後端
│   ├── routes/                # API 路由（模組化）
│   ├── services/              # 業務邏輯
│   ├── __tests__/             # API 整合測試
│   ├── db.ts                  # 資料庫連線
│   ├── index.ts               # Express 入口
│   ├── storage.ts             # 資料存取層
│   └── auth.ts                # 認證中間件
├── shared/                    # 前後端共用
│   ├── schema/                # Drizzle Schema + Zod 驗證
│   └── types.ts               # 共用型別
├── docker-compose.yml         # PostgreSQL 容器
├── drizzle.config.ts          # 資料庫遷移設定
├── vite.config.ts             # Vite 開發設定
├── PROGRESS.md                # 開發進度追蹤
└── PLAN.md                    # 功能規劃（Phase 1-5）
```

---

## 即時通訊

### WebSocket

用於團隊即時互動：
- 團隊成員狀態同步
- 準備狀態廣播
- 遊戲開始通知
- 分數即時更新
- 團隊投票即時結算

### MQTT

用於硬體裝置控制：
- LED 燈光控制
- 射擊記錄接收
- 裝置指令下發
- 裝置狀態監控

---

## 功能規劃

已完成 Phase 1（章節與進度系統），後續規劃詳見 `PLAN.md`：

| 階段 | 功能 | 狀態 |
|------|------|------|
| Phase 1 | 章節與進度系統 | ✅ 已完成 |
| Phase 2 | 遊戲模式擴充（競爭/接力） | 規劃中 |
| Phase 3 | 付費與票券系統 | 規劃中 |
| Phase 4 | 模組流程引擎（非線性） | 規劃中 |

---

## 常見問題

### Port 被佔用

```bash
# macOS port 5050 被 AirPlay ControlCenter 佔用
# 解決：本專案使用 port 3333

# 如果 3333 也被佔用
PORT=4000 npm run dev
```

### 資料庫連不上

```bash
# 確認 Docker 容器正在執行
docker ps | grep gameplatform-postgres

# 重啟容器
docker-compose restart

# 確認連線
psql postgresql://postgres:postgres@localhost:5437/gameplatform
```

### Firebase 設定不完整

缺少 Firebase 環境變數會導致前端白畫面。確認以下變數都已設定：

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_APP_ID
VITE_FIREBASE_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
```

### 避免使用的 Port

| Port | 原因 |
|------|------|
| 5000 | macOS AirPlay Receiver 佔用 |
| 5050 | 可能被其他服務佔用 |
| 5060 | SIP 保留 port，瀏覽器封鎖 |
| 3001 | OrbStack 佔用 |
