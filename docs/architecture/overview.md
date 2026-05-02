# 系統架構總覽

> 賈村數位遊戲平台 — 整體架構與技術棧
> 最後更新：2026-05-02

---

## 系統定位

**金門場域型互動遊戲 SaaS 平台** — 多場域（賈村競技場、後浦小鎮等）共用一套基礎設施，每場域可：
- 建自己的遊戲（一般 / 多人 / 章節 / 競賽 / 接力）
- 發 QR Code 給玩家掃描入場
- 看自己場域的玩家數據與戰績
- 啟用 / 停用模組（水彈、相機、章節、GPS、付費）

---

## 三類使用者

| 角色 | 入口 | 認證 |
|------|------|------|
| **玩家** | `https://game.homi.cc/f/:fieldCode/...` 或掃 QR | Firebase Auth（含匿名） |
| **場域管理員** | `https://game.homi.cc/admin` | Admin JWT（自家場域）|
| **平台管理員** | `https://game.homi.cc/platform` | Admin JWT (super_admin) |

---

## 技術棧

```
┌─────────────────────────────────────────────────┐
│  Frontend                                        │
│  React 18 + Vite + TypeScript                    │
│  Routing: wouter                                 │
│  Data: TanStack Query + WebSocket                │
│  UI: Tailwind + Radix + shadcn/ui                │
│  Forms: react-hook-form + zod                    │
│  Charts: recharts                                │
│  PWA: vite-plugin-pwa + Workbox                  │
└──────────────────────┬──────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────┴──────────────────────────┐
│  Backend (Node + Express)                        │
│  Routes: server/routes/*.ts (~50 個檔)            │
│  Storage: server/storage/*.ts                    │
│  Services: server/services/*.ts                  │
│  WS: server/ws/* (Reconnect with snapshot)       │
│  Auth: Firebase ID token + Admin JWT             │
└──────────────────────┬──────────────────────────┘
                       │ Drizzle ORM
┌──────────────────────┴──────────────────────────┐
│  PostgreSQL 16 (Docker)                          │
│  ~80+ tables (見 shared/schema/*.ts)              │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  External Services                               │
│  - Cloudinary (圖片儲存 + 轉檔)                   │
│  - Firebase Auth (Google/Apple/Email/匿名)        │
│  - LiveKit (WebRTC 視訊，selfie 元件)             │
│  - MQTT (硬體 shooting target 通訊)               │
└──────────────────────────────────────────────────┘
```

---

## 模組關係

### 玩家流程
```
QR Scan / Home
  ↓
Field Theme (FieldThemeProvider)
  ↓
Game Selection / Direct Game
  ↓
[Single Mode]                [Team Mode]              [Competitive/Relay]
  GamePlay                     TeamLobby                MatchLobby
    ↓                            ↓                        ↓
  Pages (linear/chapter)       Game Session            Match Session
    ↓                            ↓                        ↓
  Components (16 種)           Components               Components
    ↓                            ↓                        ↓
  Leaderboard                  Squad Match Records     Squad Match Records
```

### 後台流程
```
/admin/login (Email + Google)
  ↓
Admin JWT
  ↓
Field-scoped Operations:
  - Games CRUD
  - Sessions Live View
  - Analytics
  - Settings (Modules / Theme)
  - Battle System (Venues / Slots)
  - Revenue (Products / Codes / Transactions)
  - PWA Analytics
```

---

## 主要 DB Schema 群組

| 群組 | 主要表 | 用途 |
|------|--------|------|
| **使用者 / 場域** | users, fields, field_memberships | 帳號 + 場域關係 |
| **遊戲** | games, pages, locations, items, achievements, chapters | 遊戲內容 |
| **Session 進度** | game_sessions, player_progress, chat_messages | 即時遊戲狀態 |
| **隊伍系統** | squads, squad_members, squad_match_records, squad_ratings, squad_stats | 永久身份（取代 teams/clans）|
| **遊戲組隊（執行容器）** | teams, team_members, team_sessions, team_votes | 一場遊戲組隊（teams.squadId 關聯 squads）|
| **水彈對戰** | battle_venues, battle_slots, battle_registrations, battle_results | 水彈 PK 擂台 |
| **後台帳號** | admin_accounts, roles, audit_logs | RBAC + 稽核 |
| **平台 SaaS** | platform_admins, platform_plans, platform_features, support_tickets | 跨場域管理 |
| **觀測** | client_events, error_logs, ai_usage_logs | 統計 + 除錯 |

詳細 schema → [`shared/schema/`](../../shared/schema/) 各檔
詳細關係 → [data-model.md](data-model.md)（待補）

---

## 部署架構

```
玩家 / Admin 瀏覽器
        │
        │ HTTPS (Let's Encrypt)
        ▼
┌─────────────────────────────────┐
│ Linode Server (172.233.89.147)  │
│                                  │
│ ┌─────────────────────────────┐ │
│ │ Nginx (aaPanel)              │ │
│ │  - SSL termination           │ │
│ │  - Reverse proxy → :3333     │ │
│ │  - Security headers          │ │
│ │  - WebSocket upgrade         │ │
│ └────────┬────────────────────┘ │
│          │                       │
│ ┌────────▼────────────────────┐ │
│ │ Docker Compose               │ │
│ │                              │ │
│ │ gamehomicc-app-1 :3333       │ │
│ │  └ Node + Express + Vite     │ │
│ │    served HTML/JS            │ │
│ │                              │ │
│ │ gamehomicc-db-1 :5432        │ │
│ │  └ PostgreSQL 16             │ │
│ │                              │ │
│ │ gamehomicc-livekit           │ │
│ │  └ LiveKit (WebRTC)          │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

詳細 → [deployment.md](deployment.md)

---

## 關鍵約束

1. **多場域隔離**：所有資料層查詢必須帶 `fieldId` 過濾（除非 super_admin）
2. **生產資料保護**：Schema 只 ADD COLUMN，禁 DROP（[runbooks/db-migration.md](../runbooks/db-migration.md)）
3. **PWA 版本同步**：3 層版本檢查（60s + visibilitychange + cache hash）
4. **WebSocket 重連**：server in-memory cache + team_join 自動 snapshot 給新連線

---

## 延伸閱讀

- [data-model.md](data-model.md) — DB schema 細節（待補）
- [auth-flow.md](auth-flow.md) — 認證流程（待補）
- [deployment.md](deployment.md) — 部署架構（待補）
- [domains/](../domains/) — 各業務領域文件
- [decisions/](../decisions/) — 為什麼這樣設計
