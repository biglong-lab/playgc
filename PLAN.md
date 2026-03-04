# 水彈對戰 PK 擂台 — 完整功能規劃

**規劃日期**: 2026-03-04
**版本**: v1.0
**狀態**: 待確認

---

## 一、產品定位

### 核心概念

「水彈對戰 PK 擂台」是一個**獨立的對戰預約配對系統**，專門提供給擁有水彈/漆彈/生存遊戲場地的場館使用。與現有的賈村競技場實境解謎遊戲**完全獨立**，不共用遊戲邏輯，僅共用基礎設施（認證、場域管理、WebSocket）。

### 解決的痛點

| 痛點 | 現況 | 解決方案 |
|------|------|---------|
| 散客湊不到人 | 場地要求 8-10 人起跳，散客放棄 | **自動配對** — 散客報名後系統湊人 |
| 預約流程古老 | LINE/電話人工溝通 | **線上自助預約** — 選時段、付訂金、等成局 |
| 配對不透明 | 不知道還差幾人 | **即時人數顯示** — WebSocket 推送報名進度 |
| 無重複遊玩動力 | 打完就走 | **段位排名系統** — 積分、成就、戰隊 |
| 時段利用率低 | 固定場次制 | **按需開場** — 人數夠就開 |

### 適用場景

- 水彈對戰場地
- 漆彈場
- 雷射槍場
- Nerf 對戰場
- 其他生存遊戲場地

### 業界現況分析（台灣）

| 場地類型 | 代表 | 預約方式 | 最低人數 | 痛點 |
|---------|------|---------|---------|------|
| 大型漆彈場 | 亞太漆彈、獵鷹 | LINE/電話 | 8-10 人 | 散客無法參與 |
| 室內 CQB | 防空動 | 預約制+散兵場 | 10 人 | 月僅 1-2 次散客場 |
| 水彈場 | 虎鯨射擊俱樂部 | LINE 預約 | 8 人 | 50% 訂金，流程不透明 |
| 雷射槍場 | Lazertreks | 線上預約 | 2 人 | 無配對機制 |

**市場空白**：台灣目前沒有統一的水彈/生存遊戲線上預約配對平台。

---

## 二、系統架構（獨立模組設計）

### 與現有系統的關係

```
賈村競技場平台
├── 🎮 實境解謎遊戲（現有功能，不動）
│   ├── GamePlay、章節、地圖、QR 掃描...
│   └── 對戰系統（gameMatches）— 遊戲內 PvP
│
├── ⚔️ 水彈對戰 PK 擂台（新增獨立模組）★
│   ├── 獨立 Schema（battle_* 開頭）
│   ├── 獨立 API 路由（/api/battle/*）
│   ├── 獨立前端頁面（/battle/*）
│   └── 獨立 WebSocket 頻道（battleClients）
│
└── 🔧 共用基礎設施
    ├── Firebase Auth（玩家認證）
    ├── 場域管理（fields）
    ├── 管理員認證（JWT/RBAC）
    └── WebSocket 伺服器（共用連線）
```

### 模組目錄結構

```
shared/schema/
├── battle-venues.ts          # 對戰場地 Schema
├── battle-slots.ts           # 時段與報名 Schema
├── battle-teams.ts           # 戰隊 Schema
├── battle-rankings.ts        # 排名與段位 Schema
└── battle-results.ts         # 對戰結果 Schema

server/routes/
├── battle-venues.ts          # 場地管理 API
├── battle-slots.ts           # 時段管理 API
├── battle-registration.ts    # 報名與配對 API
├── battle-teams.ts           # 戰隊管理 API
├── battle-rankings.ts        # 排名 API
├── battle-results.ts         # 對戰結果 API
└── battle-admin.ts           # 管理端 API

server/services/
├── battle-matchmaking.ts     # 配對引擎（核心邏輯）
└── battle-scheduler.ts       # 通知排程器

server/storage/
└── battle-storage.ts         # 對戰系統 Storage 層

client/src/pages/battle/
├── BattleHome.tsx            # 對戰首頁（時段列表）
├── BattleSlotDetail.tsx      # 時段詳情與報名
├── BattleCheckIn.tsx         # 報到與分隊
├── BattleLive.tsx            # 對戰進行中（即時計分）
├── BattleResult.tsx          # 對戰結果
├── BattleRanking.tsx         # 排行榜
├── BattleMyTeam.tsx          # 我的戰隊
├── BattleHistory.tsx         # 對戰歷史
└── admin/
    ├── BattleVenueSettings.tsx   # 場地設定
    ├── BattleSlotManager.tsx     # 時段管理
    └── BattleDashboard.tsx       # 對戰儀表板
```

---

## 三、資料庫設計

### 3.1 對戰場地表 `battle_venues`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| field_id | UUID FK→fields | 所屬場域 |
| name | TEXT | 場地名稱（如「叢林戰場」） |
| description | TEXT | 場地描述 |
| cover_image | TEXT | 封面圖 URL |
| venue_type | ENUM | water_gun / paintball / laser / nerf / airsoft |
| min_players | INT (預設 8) | 最低開場人數 |
| max_players | INT (預設 20) | 最大人數 |
| team_size | INT (預設 5) | 每隊人數（如 5v5） |
| max_teams | INT (預設 2) | 隊伍數（2=紅藍、3+=多隊混戰） |
| game_duration_minutes | INT (預設 60) | 每場時長 |
| settings | JSONB | 進階設定（見下方） |
| is_active | BOOLEAN | 是否啟用 |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

**settings JSON 結構：**

```jsonc
{
  "requireDeposit": true,           // 是否需要訂金
  "depositAmount": 200,             // 訂金金額（TWD）
  "pricePerPerson": 500,            // 每人費用
  "cancelDeadlineHours": 24,        // 取消期限（活動前 N 小時）
  "confirmDeadlineHours": 2,        // 出席確認期限（活動前 N 小時）
  "checkInMinutesBefore": 30,       // 開放報到（活動前 N 分鐘）
  "autoMatchEnabled": true,         // 啟用散客自動配對
  "skillMatchEnabled": false,       // 依段位配對
  "allowPremadeTeams": true,        // 允許預組小隊
  "notifyHoursBefore": [24, 2],     // 通知時間（陣列，活動前 N 小時）
  "autoCloseHoursBefore": 1,        // 報名自動截止（活動前 N 小時）
  "equipmentOptions": [             // 可選裝備
    { "name": "標準水槍", "price": 0, "included": true },
    { "name": "進階水槍", "price": 100 },
    { "name": "護目鏡", "price": 50 }
  ],
  "rules": "場地規則說明文字..."
}
```

### 3.2 對戰時段表 `battle_slots`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| venue_id | UUID FK→battle_venues | 所屬場地 |
| slot_date | DATE | 日期 |
| start_time | TIME | 開始時間 |
| end_time | TIME | 結束時間 |
| slot_type | ENUM | open（公開場）/ private（包場）/ tournament（賽事） |
| status | ENUM | open / confirmed / full / in_progress / completed / cancelled |
| min_players_override | INT? | 覆蓋場地最低人數 |
| max_players_override | INT? | 覆蓋場地最大人數 |
| current_count | INT (預設 0) | 目前報名人數 |
| confirmed_count | INT (預設 0) | 已確認出席人數 |
| price_per_person | INT? | 覆蓋場地每人費用 |
| registration_deadline | TIMESTAMPTZ? | 報名截止時間 |
| confirmation_deadline | TIMESTAMPTZ? | 確認出席截止時間 |
| notes | TEXT? | 備註 |
| repeat_rule | JSONB? | 重複規則（每週、每日等） |
| created_by | UUID FK→users | 建立者 |
| created_at | TIMESTAMPTZ | 建立時間 |
| updated_at | TIMESTAMPTZ | 更新時間 |

**索引：** `(venue_id, slot_date)`, `(status)`

### 3.3 報名記錄表 `battle_registrations`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| slot_id | UUID FK→battle_slots | 所屬時段 |
| user_id | UUID FK→users | 報名者 |
| premade_group_id | UUID? FK→battle_premade_groups | 預組小隊 |
| registration_type | ENUM | individual / premade_leader / premade_member |
| status | ENUM | registered / confirmed / checked_in / no_show / cancelled |
| assigned_team | TEXT? | 分配到的隊伍（紅/藍/...） |
| equipment_selection | JSONB | 選擇的裝備 |
| deposit_paid | BOOLEAN | 訂金已付 |
| deposit_transaction_id | UUID? | 訂金交易 ID |
| skill_level | ENUM | beginner / intermediate / advanced |
| notes | TEXT? | 備註 |
| registered_at | TIMESTAMPTZ | 報名時間 |
| confirmed_at | TIMESTAMPTZ? | 確認時間 |
| checked_in_at | TIMESTAMPTZ? | 報到時間 |
| cancelled_at | TIMESTAMPTZ? | 取消時間 |

**約束：** `UNIQUE(slot_id, user_id)` — 每人每時段只能報名一次

### 3.4 預組小隊表 `battle_premade_groups`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| slot_id | UUID FK→battle_slots | 所屬時段 |
| leader_id | UUID FK→users | 隊長 |
| name | TEXT? | 小隊名稱 |
| access_code | TEXT UNIQUE | 邀請碼（6 位） |
| member_count | INT | 成員數 |
| keep_together | BOOLEAN (預設 true) | 分隊時保持同隊 |
| created_at | TIMESTAMPTZ | 建立時間 |

### 3.5 戰隊表 `battle_clans`（長期戰隊，跨場次）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| field_id | UUID FK→fields | 所屬場域 |
| name | TEXT | 戰隊名稱 |
| tag | TEXT | 簡稱（如 [ACE]） |
| logo_url | TEXT? | 戰隊 Logo |
| leader_id | UUID FK→users | 隊長 |
| description | TEXT? | 描述 |
| member_count | INT | 成員數 |
| total_wins / losses / draws | INT | 戰績 |
| clan_rating | INT (預設 1000) | 戰隊 ELO 分數 |
| is_active | BOOLEAN | 是否啟用 |
| created_at | TIMESTAMPTZ | 建立時間 |

**`battle_clan_members` 子表：** clan_id, user_id, role (leader/officer/member), joined_at, left_at

### 3.6 玩家排名表 `battle_player_rankings`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| user_id | UUID FK→users | 玩家 |
| field_id | UUID FK→fields | 場域（每場域獨立排名） |
| rating | INT (預設 1000) | ELO/MMR 分數 |
| tier | ENUM | bronze / silver / gold / platinum / diamond / master |
| total_battles | INT | 總場次 |
| wins / losses / draws | INT | 勝負 |
| win_streak | INT | 目前連勝 |
| best_streak | INT | 最佳連勝 |
| mvp_count | INT | MVP 次數 |
| season | INT | 賽季 |
| season_rating | INT | 賽季分數 |
| updated_at | TIMESTAMPTZ | 更新時間 |

**約束：** `UNIQUE(user_id, field_id)`

**段位門檻：**

| 段位 | 圖示 | 分數範圍 |
|------|------|---------|
| 新兵 Bronze | 🥉 | 0-299 |
| 步兵 Silver | 🥈 | 300-599 |
| 突擊 Gold | 🥇 | 600-999 |
| 精英 Platinum | 💎 | 1000-1499 |
| 菁英 Diamond | 💠 | 1500-1999 |
| 傳奇 Master | 👑 | 2000+ |

### 3.7 對戰結果表 `battle_results`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| slot_id | UUID FK→battle_slots | 所屬時段 |
| venue_id | UUID FK→battle_venues | 場地 |
| winning_team | TEXT? | 獲勝隊伍 |
| team_scores | JSONB | 各隊分數 `{ "red": 150, "blue": 120 }` |
| duration_minutes | INT? | 實際時長 |
| mvp_user_id | UUID? FK→users | MVP |
| highlights | JSONB | 精彩時刻 |
| photos | JSONB | 活動照片 URL |
| recorded_by | UUID FK→users | 記錄者（管理員） |
| created_at | TIMESTAMPTZ | 記錄時間 |

**`battle_player_results` 子表：** result_id, user_id, team, score, hits, eliminations, is_mvp, rating_change, new_rating

### 3.8 通知記錄表 `battle_notifications`

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | UUID PK | 主鍵 |
| slot_id | UUID? FK→battle_slots | 相關時段 |
| user_id | UUID FK→users | 通知對象 |
| type | ENUM | slot_confirmed / reminder_24h / reminder_2h / confirm_request / team_assigned / check_in_open / slot_cancelled / waitlist_available / result_published |
| channel | ENUM | push / email / sms / in_app |
| status | ENUM | pending / sent / failed |
| scheduled_at | TIMESTAMPTZ | 排程時間 |
| sent_at | TIMESTAMPTZ? | 發送時間 |
| content | JSONB | 通知內容 |
| created_at | TIMESTAMPTZ | 建立時間 |

---

## 四、核心流程設計

### 4.1 完整預約流程圖

```
┌────────────────────────────────────────────────────────────────┐
│                         玩家端完整流程                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1️⃣  瀏覽時段                                                   │
│  ┌───────────────────────────────────────┐                     │
│  │ 🔫 叢林戰場 5v5     週六 14:00-15:00   │                     │
│  │ ████████░░ 6/8 人（還差 2 人成局）      │ ← WebSocket 即時   │
│  │ [立即報名]  [揪團報名]                  │                     │
│  └───────────────────────────────────────┘                     │
│                                                                │
│  2️⃣  報名（兩種方式）                                            │
│                                                                │
│  方式 A：個人報名（散客）                                        │
│  → 選時段 → 選裝備 → 付訂金 → 加入等候                          │
│                                                                │
│  方式 B：揪團報名（預組小隊）                                    │
│  → 選時段 → 建立小隊 → 分享邀請碼給朋友                         │
│  → 朋友用邀請碼加入 → 一起付訂金 → 加入等候                     │
│  → 分隊時保持同隊                                               │
│                                                                │
│  3️⃣  等待成局（WebSocket 即時推送人數變化）                       │
│  ┌───────────────────────────────────────┐                     │
│  │ 你已報名 週六 14:00 場次               │                     │
│  │ 目前 7/8 人，還差 1 人！               │ ← 即時更新           │
│  │ 你的小隊：你 + 小明 + 小華（3 人）     │                     │
│  └───────────────────────────────────────┘                     │
│                                                                │
│  4️⃣  成局通知（達到最低人數自動觸發）                             │
│  📱 推播 + Email：「週六 14:00 水彈對戰已成局！共 8 人參戰」      │
│                                                                │
│  5️⃣  出席確認（活動前 N 小時，可設定）                            │
│  📱 推播：「距離對戰還有 2 小時，請確認出席！」                    │
│  → [確認出席] → 標記已確認                                       │
│  → [臨時取消] → 退訂金（扣手續費）→ 觸發候補遞補                 │
│                                                                │
│  6️⃣  報到（活動前 30 分鐘開放）                                   │
│  → 到場 → 掃 QR Code → 系統標記已報到                           │
│  → 報到截止後自動執行分隊                                        │
│  ┌───────────────────────────────────────┐                     │
│  │ 🔴 紅隊              🔵 藍隊           │                     │
│  │ 你、小明、小華、A、B  C、D、E、F、G    │ ← 預組小隊同隊      │
│  └───────────────────────────────────────┘                     │
│                                                                │
│  7️⃣  對戰進行                                                   │
│  → 管理員宣布開始 → 計時 → 即時計分（可選）→ 管理員宣布結束      │
│                                                                │
│  8️⃣  結果公布                                                   │
│  → 勝負 → 個人數據（命中/淘汰/得分）                            │
│  → 積分變動（+25 / -15）→ 段位更新（Silver → Gold）             │
│  → MVP 公布 → 活動照片                                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 自動分隊演算法

```
輸入：已報到的玩家列表 + 預組小隊資訊 + 玩家 rating

Step 1：識別預組小隊
  → 收集所有 keep_together = true 的預組小隊

Step 2：計算隊伍配置
  → 總人數 ÷ team_size = 隊伍數
  → 若無法整除，最後一隊 ±1 人

Step 3：分配預組小隊（優先）
  → 將預組小隊視為一個單位
  → 優先放入人數較少的隊伍
  → 若預組人數 > team_size → 提前警告拆分

Step 4：分配散客（平衡 rating）
  → 散客按 rating 排序
  → 蛇形分配（S-draft）：最強到 A 隊、次強到 B 隊、第三到 B 隊、第四到 A 隊...
  → 目標：兩隊平均 rating 差距 < 50

Step 5：輸出
  → { "red": [玩家列表], "blue": [玩家列表] }
  → 管理員可手動微調後確認

範例（10 人 5v5）：
  預組小隊 A（3 人，avg rating 800）
  預組小隊 B（2 人，avg rating 600）
  散客 5 人（rating: 1200, 900, 700, 500, 400）

  → 紅隊：小隊 A(3) + 散客 500 + 散客 400 = avg 580
  → 藍隊：小隊 B(2) + 散客 1200 + 散客 900 + 散客 700 = avg 880
  → 蛇形調整後達到平衡
```

### 4.3 時段狀態機

```
                      ┌─────────────┐
                      │    open     │ （開放報名中）
                      └──────┬──────┘
                             │ 達到 min_players
                      ┌──────▼──────┐
                ┌─────│  confirmed  │ （已成局，繼續接受至滿員）
                │     └──────┬──────┘
                │            │ 達到 max_players
                │     ┌──────▼──────┐
                │     │    full     │ （已滿，候補等待）
                │     └──────┬──────┘
                │            │ 管理員開始
    截止未達人數│     ┌──────▼──────┐
                │     │ in_progress │ （對戰進行中）
                │     └──────┬──────┘
                │            │ 管理員結束
                │     ┌──────▼──────┐
                │     │  completed  │ （已完成，記錄結果）
                │     └─────────────┘
                │
                │     ┌─────────────┐
                └────▶│  cancelled  │ （已取消，退款）
                      └─────────────┘
```

### 4.4 通知時間線

```
時間線（以活動 14:00 為例）：

報名後即時 ──────────── 📱 「報名成功！等待更多玩家加入」
每有人報名 ──────────── 📱 「已有 6/8 人報名」（WebSocket 即時推送）
達最低人數 ──────────── 📱📧 「已成局！共 8 人，請準時出席」
活動前 24h（13:00 前日）─ 📱 「明天 14:00 水彈對戰提醒」
活動前 2h（12:00）────── 📱 「請確認出席」→ [確認] / [取消]
              ↳ 未確認者 ─ 📱 「即將截止，未確認視同取消」
活動前 30min（13:30）─── 📱 「報到已開放，請到場掃碼」
報到截止後 ──────────── 📱 「你被分配到 🔴 紅隊」
管理員結束對戰 ───────── 📱 「結果出爐！🏆 紅隊勝利，你的段位 Silver → Gold」
```

---

## 五、API 設計

### 5.1 場地管理 `/api/battle/venues`（管理端）

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/battle/venues` | 場域 | 取得場域下所有場地 |
| POST | `/api/battle/venues` | 管理員 | 建立場地 |
| GET | `/api/battle/venues/:id` | 公開 | 場地詳情 |
| PATCH | `/api/battle/venues/:id` | 管理員 | 更新場地設定 |
| DELETE | `/api/battle/venues/:id` | 管理員 | 停用場地 |

### 5.2 時段管理 `/api/battle/slots`

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/battle/venues/:venueId/slots` | 公開 | 時段列表（含即時人數） |
| POST | `/api/battle/venues/:venueId/slots` | 管理員 | 建立時段 |
| POST | `/api/battle/venues/:venueId/slots/batch` | 管理員 | 批次建立（每週重複） |
| GET | `/api/battle/slots/:slotId` | 公開 | 時段詳情 + 報名者列表 |
| PATCH | `/api/battle/slots/:slotId` | 管理員 | 更新時段 |
| DELETE | `/api/battle/slots/:slotId` | 管理員 | 取消時段 |
| POST | `/api/battle/slots/:slotId/start` | 管理員 | 開始對戰 |
| POST | `/api/battle/slots/:slotId/finish` | 管理員 | 結束對戰 |

### 5.3 報名系統 `/api/battle/registration`

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/battle/slots/:slotId/register` | 玩家 | 個人報名 |
| DELETE | `/api/battle/slots/:slotId/register` | 玩家 | 取消報名 |
| POST | `/api/battle/slots/:slotId/premade` | 玩家 | 建立預組小隊（回傳邀請碼） |
| POST | `/api/battle/premade/:code/join` | 玩家 | 用邀請碼加入小隊 |
| POST | `/api/battle/slots/:slotId/confirm` | 玩家 | 確認出席 |
| POST | `/api/battle/slots/:slotId/check-in` | 玩家 | QR Code 報到 |
| GET | `/api/battle/slots/:slotId/registrations` | 管理員 | 報名者列表 |

### 5.4 分隊與結果

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| POST | `/api/battle/slots/:slotId/assign-teams` | 管理員 | 自動分隊 |
| PATCH | `/api/battle/slots/:slotId/assign-teams` | 管理員 | 手動調整分隊 |
| POST | `/api/battle/slots/:slotId/result` | 管理員 | 記錄對戰結果 |
| GET | `/api/battle/slots/:slotId/result` | 公開 | 取得對戰結果 |

### 5.5 排名與戰隊

| 方法 | 路由 | 認證 | 說明 |
|------|------|------|------|
| GET | `/api/battle/rankings` | 公開 | 排行榜（支援場域篩選） |
| GET | `/api/battle/rankings/me` | 玩家 | 我的排名與段位 |
| GET | `/api/battle/my/history` | 玩家 | 我的對戰歷史 |
| POST | `/api/battle/clans` | 玩家 | 建立戰隊 |
| GET | `/api/battle/clans` | 公開 | 戰隊列表 |
| GET | `/api/battle/clans/:id` | 公開 | 戰隊詳情 |
| POST | `/api/battle/clans/:id/join` | 玩家 | 加入戰隊 |
| DELETE | `/api/battle/clans/:id/leave` | 玩家 | 離開戰隊 |

### 5.6 WebSocket 事件（新增 battle 頻道）

| 事件 | 方向 | 說明 |
|------|------|------|
| `battle_slot_subscribe` | C→S | 訂閱時段即時更新 |
| `battle_count_update` | S→C | 報名人數變動推送 |
| `battle_slot_confirmed` | S→C | 時段已成局通知 |
| `battle_slot_full` | S→C | 時段已滿通知 |
| `battle_confirm_request` | S→C | 請求確認出席 |
| `battle_team_assigned` | S→C | 分隊結果通知 |
| `battle_started` | S→C | 對戰開始 |
| `battle_score_update` | S→C | 即時計分更新（可選） |
| `battle_finished` | S→C | 對戰結束 + 結果 |

---

## 六、前端頁面設計

### 6.1 路由規劃

```
# 玩家端
/battle                              # 對戰首頁（近期時段 + 我的狀態）
/battle/venue/:venueId               # 場地詳情 + 時段日曆
/battle/slot/:slotId                 # 時段詳情 + 報名/揪團
/battle/slot/:slotId/check-in        # 報到頁面（QR Code）
/battle/slot/:slotId/live            # 對戰進行中
/battle/slot/:slotId/result          # 對戰結果
/battle/ranking                      # 排行榜
/battle/my                           # 我的戰績/段位/歷史
/battle/clan/:clanId                 # 戰隊頁面
/battle/clan/create                  # 建立戰隊

# 管理端
/admin/battle                        # 對戰管理儀表板
/admin/battle/venues                 # 場地管理
/admin/battle/venues/:id/settings    # 場地設定
/admin/battle/venues/:id/slots       # 時段管理（日曆視圖）
/admin/battle/results                # 對戰結果記錄
```

### 6.2 首頁 UI 概念

```
┌────────────────────────────────────────────┐
│  ⚔️ 水彈對戰 PK 擂台                       │
│                                            │
│  ── 近期可報名場次 ──────────────────────   │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 🔫 叢林戰場 5v5     週六 3/8 14:00   │  │
│  │ ████████░░ 6/8 人（還差 2 人成局）    │  │
│  │ 💰 500/人（含裝備）                   │  │
│  │ [立即報名]  [揪團報名]                │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 🔫 城市巷戰 3v3     週日 3/9 10:00   │  │
│  │ ██░░░░░░░░ 2/6 人（還差 4 人）       │  │
│  │ 💰 400/人                            │  │
│  │ [立即報名]  [揪團報名]                │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ── 我的戰鬥狀態 ──────────────────────    │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ 段位：🥈 Silver（450 分）             │  │
│  │ 戰績：12 勝 8 負（60% 勝率）         │  │
│  │ 連勝：🔥 3 連勝中！                  │  │
│  │ 戰隊：[ACE] 王牌突擊隊               │  │
│  │ 下場預約：週六 14:00（已確認 ✅）      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [🏆 排行榜]  [👥 我的戰隊]  [📜 歷史]   │
│                                            │
└────────────────────────────────────────────┘
```

---

## 七、ELO 積分與段位系統

### 計分規則

```
新玩家初始分數：1000（Platinum 起步）

基礎分數變動：
  勝利：+20 ~ +30（依對手強度）
  失敗：-10 ~ -20（依對手強度）
  平手：±5

加成：
  連勝 3 場起：額外 +5/場
  MVP：額外 +10
  淘汰數前 3：額外 +5

K 值（波動係數）：
  新手（< 10 場）：K = 40（快速定位）
  一般：K = 20
  高段（> 1500）：K = 10（穩定）

ELO 公式：
  預期勝率 = 1 / (1 + 10^((對手平均 rating - 我的 rating) / 400))
  新 rating = 舊 rating + K × (實際結果 - 預期勝率)
```

### 成就系統

| 成就 | 條件 | 獎勵 |
|------|------|------|
| 初出茅廬 | 完成首場對戰 | 新手徽章 |
| 連勝新星 | 連續獲勝 3 場 | +50 額外積分 |
| 百戰老將 | 累計 100 場 | 專屬稱號 |
| 神槍手 | 單場淘汰 10+ | 專屬徽章 |
| 不倒翁 | 連續 5 場未被淘汰 | 生存徽章 |
| 戰隊領袖 | 帶隊獲勝 20 場 | 戰隊框 |
| 賽季王者 | 賽季排名前 3 | 限定獎勵 |

---

## 八、管理端功能

### 8.1 場地設定頁

- 基本資訊（名稱/描述/封面圖/類型）
- 人數規則（最低/最大/每隊/隊伍數）
- 費用設定（每人費用/訂金金額）
- 時間設定（通知/確認/報到的時間門檻）
- 裝備選項管理
- 場地規則文字

### 8.2 時段管理頁

- **日曆視圖**：整月/週視圖顯示所有時段
- **快速建立**：
  - 單一時段
  - 重複時段（每週六 14:00、16:00）
  - 批次建立一個月的時段
- **時段卡片**：顯示狀態/報名人數/操作按鈕
- **報名者管理**：查看/手動新增/移除/標記已到
- **分隊操作**：一鍵自動分隊 + 手動微調

### 8.3 對戰結果記錄頁

- 選擇時段 → 選擇獲勝隊伍
- 輸入個人數據（得分/命中/淘汰）
- 選擇 MVP
- 上傳活動照片
- 送出 → 系統自動計算 ELO 變動

### 8.4 儀表板

- 本週/本月場次數
- 報名率 / 成局率 / 出席率
- 熱門時段分析
- 收入統計
- 玩家活躍度

---

## 九、分階段開發計畫

### Phase 1：核心預約功能（MVP）⭐

**目標**：可以報名、成局、報到、分隊

| 項目 | 說明 | 預估行數 |
|------|------|---------|
| Schema | battle_venues + battle_slots + battle_registrations + battle_premade_groups | ~250 行 |
| Storage | battle-storage.ts（CRUD 操作） | ~300 行 |
| 場地 API | battle-venues.ts | ~150 行 |
| 時段 API | battle-slots.ts | ~300 行 |
| 報名 API | battle-registration.ts（含預組小隊） | ~350 行 |
| 配對引擎 | battle-matchmaking.ts（自動分隊） | ~200 行 |
| WebSocket | battleClients Map + 人數推送 | ~100 行 |
| 前端-首頁 | BattleHome.tsx | ~200 行 |
| 前端-時段 | BattleSlotDetail.tsx（報名/揪團） | ~300 行 |
| 前端-報到 | BattleCheckIn.tsx（QR 掃碼） | ~150 行 |
| 前端-管理 | BattleVenueSettings + BattleSlotManager | ~400 行 |
| DB Migration | db:push | - |
| **合計** | | ~2,700 行 |

### Phase 2：對戰結果與基礎排名

**目標**：記錄結果、基礎排行榜

| 項目 | 說明 |
|------|------|
| Schema | battle_results + battle_player_results + battle_player_rankings |
| 結果 API | battle-results.ts |
| 排名 API | battle-rankings.ts |
| ELO 引擎 | 自動計算積分變動 |
| 前端-結果 | BattleResult.tsx |
| 前端-排行 | BattleRanking.tsx |
| 前端-歷史 | BattleHistory.tsx |
| 前端-管理 | 結果記錄頁面 |

### Phase 3：戰隊系統

**目標**：長期戰隊、戰隊排名

| 項目 | 說明 |
|------|------|
| Schema | battle_clans + battle_clan_members |
| 戰隊 API | battle-teams.ts |
| 前端-戰隊 | BattleMyTeam.tsx + 戰隊頁面 |

### Phase 4：通知排程系統

**目標**：完整的自動通知流程

| 項目 | 說明 |
|------|------|
| Schema | battle_notifications |
| 排程器 | battle-scheduler.ts（cron / setInterval） |
| 推播 | Firebase Cloud Messaging 或 Web Push |
| 確認流程 | 確認出席/取消/候補遞補 |

### Phase 5：進階功能

| 項目 | 說明 |
|------|------|
| 成就系統 | 徽章/稱號 |
| 賽事模式 | 聯賽/錦標賽 |
| 訂金線上付款 | 整合 Recur.tw |
| 管理儀表板 | 數據分析 |

---

## 十、技術決策

| 決策 | 選擇 | 原因 |
|------|------|------|
| Schema 命名前綴 | `battle_` | 與現有 41+ 表完全隔離 |
| API 命名空間 | `/api/battle/` | 獨立路由，不干擾現有 API |
| 前端路由 | `/battle/*` | 獨立入口，可單獨行銷 |
| WebSocket | 共用連線 + 新 `battleClients` Map | 避免多連線，複用心跳機制 |
| 認證 | 共用 Firebase Auth | 玩家帳號統一，不需重新註冊 |
| 管理權限 | 共用 RBAC + 新增 battle 權限 | 場域管理員可同時管理遊戲和對戰 |
| 排名演算法 | Modified ELO | 業界標準、好理解、易實作 |
| 配對演算法 | 貪心平衡 + 蛇形分配 | 簡單有效，保護預組小隊 |

---

## 十一、風險評估

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| 散客太少無法成局 | 時段頻繁取消 | 降低門檻（如 4v4）、合併時段 |
| 爽約率高 | 影響體驗 | 訂金制度 + 連續爽約禁報名 |
| 分隊不平衡 | 玩家抱怨 | 先按 rating 分配，收集數據持續調整 |
| 通知不到位 | 玩家忘記 | 多渠道（推播+Email+SMS） |
| 即時人數延遲 | 誤判成局 | WebSocket + DB 雙重校驗 |

---

## 十二、總結

### 核心價值

1. **降低門檻** — 1 人也能報名，系統幫你湊人開場
2. **透明即時** — 報名人數 WebSocket 即時推送，不用傻等
3. **遊戲化** — 段位、排名、戰隊、成就，讓每場對戰有意義
4. **自動化** — 自動成局、自動分隊、自動通知、自動計分

### 市場定位

台灣目前**沒有**統一的水彈/生存遊戲線上預約配對平台，這是明確的市場空白。本系統可同時服務：
- **散客玩家**：不用自己湊人，報名等系統配對
- **團體玩家**：揪團報名，保持同隊
- **場地經營者**：提高時段利用率、降低人工溝通成本
- **硬核玩家**：段位排名、戰隊系統、賽事

---

**此規劃待 Hung 確認後開始實作。建議從 Phase 1（核心預約功能）開始。**
