# 🌐 數位遊戲平台 — SaaS 多租戶重構藍圖

> **版本**：v4.0（Final）
> **建立日期**：2026-04-17
> **作者**：Hung（大哉實業）
> **狀態**：執行中
> **原則**：零損失重構、搬家不拆房、新增不刪除

---

## 🎯 核心定位

**本專案是 SaaS 服務平台**，賈村是第一個租戶，未來開放更多場域（民宿、營隊、觀光地、學校、企業）使用。

### 三層角色

```
🌐 平台方（大哉實業）      → 提供工具、收訂閱費 + 交易抽成
    ↓
🏢 場域方（賈村 + 其他）    → 使用工具、經營自己的玩家
    ↓
👤 玩家                    → 在場域內玩遊戲 / 參加對戰
```

---

## 💰 平台營收模式

| 模式 | 說明 | 適合對象 |
|------|------|---------|
| 🎟️ 訂閱費 | 月/年費，開通功能 | 中大型場域 |
| 💸 交易抽成 | 按 % 抽成 | 活動型場域 |
| 🎁 功能加購 | 按模組付費 | 想擴充的場域 |
| 🤝 營收分潤 | 共同分潤 | 戰略夥伴 |

### 方案分級

- **🆓 Free**：3 款遊戲 / 100 次結帳 / 必顯示平台品牌
- **💼 Pro（NT$ 1,999/月）**：無限遊戲 / 1000 次結帳 / 水彈對戰 / 自訂品牌
- **🚀 Enterprise**：專屬子網域 / 白牌 / API / SLA
- **🤝 RevShare**：無月費 / 交易抽成 10-20%

---

## 🏛️ 完整資訊架構

### 三層結構

```
🌐 平台後台 /platform/*
├─ 場域管理（所有租戶）
├─ 方案管理
├─ 功能開關
├─ 平台營收
├─ 跨場域數據
├─ 系統公告
└─ 平台設定

🏢 場域後台 /admin/*
├─ 📊 總覽
├─ 🎮 遊戲中心
├─ ⚔️ 對戰中心
├─ 💰 財務中心
├─ 🏢 場域總部
└─ 🔐 權限管理

👤 玩家端 /*
├─ / 歡迎分流
├─ /games 遊戲世界
├─ /battle 競技擂台
└─ /me 會員中心
```

---

## 📊 完整功能對照表（零損失）

### 玩家端 11 頁全保留

| 現有 | 新位置 | 世界 |
|------|--------|------|
| Landing `/` | `/` 歡迎分流 | 入口 |
| Home `/home` | `/games` | 🎮 |
| GamePlay `/game/:id` | `/games/:id/play` | 🎮 |
| ChapterSelect | `/games/:id/chapters` | 🎮 |
| MapView | `/games/:id/map` | 🎮 |
| TeamLobby | `/games/:id/team` | 🎮 |
| MatchLobby | `/games/:id/match` | 🎮 |
| Leaderboard | `/games/leaderboard` | 🎮 |
| QR Entry `/g/:slug` | `/g/:slug` | 通用 |
| PurchaseGate | `/checkout/:productId` | 💳 統一結帳 |
| MyPurchases | `/me/purchases` | 💳 |

### 對戰端 11 頁全保留

| 現有 | 新位置 | 世界 |
|------|--------|------|
| BattleHome | `/battle` | ⚔️ |
| BattleSlotDetail | `/battle/slots/:id` | ⚔️ |
| BattleResult | `/battle/slots/:id/result` | ⚔️ |
| BattleRanking | `/battle/rankings` | ⚔️ |
| BattleClanCreate | `/battle/clans/create` | ⚔️ |
| BattleClanDetail | `/battle/clans/:id` | ⚔️ |
| BattleSeasonHistory | `/battle/seasons` | ⚔️ |
| BattleHistory | `/me/battles` | 💳 移入會員 |
| BattleMyProfile | `/me/battle-profile` | 💳 移入會員 |
| BattleNotifications | `/me/notifications` | 💳 升級為全站通知 |
| BattleAchievements | `/me/achievements` | 💳 整合遊戲成就 |

### 管理端 27 頁全保留 → 5 大分組

**🎮 遊戲中心（11 頁）**
- AdminGames、GameEditor、GameSettings、ChapterManager、LocationEditor、ItemEditor、AchievementEditor、AdminSessions、AdminDevices、AdminTemplates、QRCodeMgmt

**⚔️ 對戰中心（5 頁）**
- AdminBattleDashboard、AdminBattleVenues、AdminBattleSlots、AdminBattleRankings、AdminBattleSeasons

**💰 財務中心（2 頁 → 擴充到 6 頁）**
- TicketsOverview（升級為營收總覽，含平台費用）
- AdminRedeemCodes（升級為跨遊戲兌換碼）
- 🆕 ProductManagement（商品管理：遊戲+對戰+章節）
- 🆕 Transactions（交易記錄）
- 🆕 Refunds（退款管理）
- 🆕 Gateway（金流設定）

**🏢 場域總部（6 頁）**
- Fields（升級為「我的場域」）
- FieldSettings（AI Key / 品牌 / 配額 / 開關）
- Roles、Accounts、Audit Logs、Players
- 🆕 Subscription（我的方案 + 用量 + 平台費用）

**📊 總覽（3 頁）**
- AdminDashboard、AdminAnalytics、AdminLeaderboard

### 平台後台（全新 7 頁）

- PlatformDashboard
- PlatformFields（所有場域管理）
- PlatformPlans（訂閱方案管理）
- PlatformRevenue（平台營收報表）
- PlatformFeatureFlags（功能開關）
- PlatformAnalytics（跨場域數據）
- PlatformSettings（系統公告、客服）

---

## 🗃️ 資料模型變動

### 保留不動（41 張表）
games, pages, items, achievements, gameChapters, playerChapterProgress, locations, sessions, devices, teams, team_scores, team_votes, team_lifecycle, match, match_participants, relay, leaderboard, users, roles, fields, audit_logs, battleVenues, battleSlots, battleRegistrations, battleResults, battleClans, battleRankings, battleNotifications, battleSeasons, battleAchievements, redeem_codes, redeem_code_uses, purchases, payment_transactions, game_templates, playerGameAccess ...

### 新增 7 張平台表

```sql
platform_plans              -- 訂閱方案
field_subscriptions         -- 場域訂閱狀態
platform_transactions       -- 平台收入（訂閱費、抽成）
platform_feature_flags      -- 功能旗標定義
field_feature_overrides     -- 場域個別覆寫
field_usage_meters          -- 用量計量
platform_admins             -- 平台管理員
```

### 新增 3 張聚合表（選做）

```sql
products                   -- 統一商品
product_links              -- products ↔ games/battleSlots/chapters
customer_profiles          -- 玩家跨場域檔案
```

### fields 表擴充

```sql
ALTER TABLE fields ADD COLUMN
  slug, custom_domain, business_name, tax_id,
  contact_email, contact_phone, status,
  suspended_reason, logo_url, primary_color,
  remove_platform_branding;
```

---

## 🎨 視覺語言

| 世界 | 主色 | 語氣 |
|------|------|------|
| 🌐 平台層 | `#1E40AF` 藍 | 專業、可信賴 |
| 🎮 遊戲世界 | `#7C3AED` 紫 | 神秘、好奇 |
| ⚔️ 競技擂台 | `#DC2626` 紅 | 熱血、競爭 |
| 💳 會員 / 財務 | `#059669` 綠 | 安全、金流 |
| 🏢 場域總部 | `#475569` 灰藍 | 中立、管理 |

---

## 📅 八階段實施路線圖

| Phase | 名稱 | 天數 | 關鍵產出 |
|-------|------|------|---------|
| 0 | 盤點與設計凍結 | 1 | 本文件 + Task 建立 |
| 1 | SaaS 基礎層 | 3 | 7 張平台表 + PlatformShell + 隔離 middleware |
| 2 | 管理端三中心重組 | 3 | 側邊欄重分組 + 舊路由 redirect |
| 3 | 財務中心擴建 | 4 | 統一商品模型 + 6 個新頁面 |
| 4 | 玩家端三世界 | 5 | 歡迎頁 + 統一結帳 + 會員中心 |
| 5 | 平台後台 | 5 | 7 個平台頁面 + 場域管理 |
| 6 | SaaS 計費引擎 | 4 | 自動扣款 + 抽成 + 用量計量 |
| 7 | 打磨與引導 | 4 | Onboarding + 空狀態 + 骨架屏 |
| 8 | 開放新場域申請（選做） | 3 | 公開申請頁 + 審核流程 |

**總計**：Phase 0-7 約 **4-5 週**，Phase 8 另加 **3 天**。

---

## 🔒 無損保證清單

### 絕對保留
- ✅ 38 個頁面全部保留
- ✅ 57+ API 全部保留
- ✅ 41 個資料表全部保留
- ✅ 所有遊戲模式（解謎/隊伍/競爭/接力/章節）
- ✅ 所有對戰功能（Phase 1-4）
- ✅ 所有金流邏輯（Recur.tw / 兌換碼 / 現金）
- ✅ Firebase Auth、Cloudinary、WebSocket、MQTT、i18n、RBAC、Audit Log

### 純擴充項目
- 🆕 SaaS 平台層（7 表 + 7 頁面 + 1 後台）
- 🆕 統一商品模型
- 🆕 訂閱計費引擎
- 🆕 Feature Flag 系統（擴充現有）
- 🆕 設計系統 + 引導機制

---

## 🎯 成功指標

### 技術
- 現有功能保留率：100%
- API 向後相容：100%（舊路徑 redirect）
- 頁面載入：< 1.5s
- 測試覆蓋率：> 80%

### 商業
- 場域數：Q2 達 3 個 / Q4 達 10 個
- MRR：Q2 達 $15,000 / Q4 達 $50,000
- 付費場域比例：> 50%

### 體驗
- 管理員找設定點擊數：≤ 2
- 玩家首頁到結帳：2 步
- 新場域首次建立遊戲：< 10 分鐘

---

## 📝 變更記錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2026-04-17 | v1.0 | 初次盤點，三大系統混亂分析 |
| 2026-04-17 | v2.0 | 加入設計系統與打磨原則 |
| 2026-04-17 | v3.0 | 納入 SaaS 多租戶架構 |
| 2026-04-17 | v4.0 | 零損失完整重構藍圖（Final） |
