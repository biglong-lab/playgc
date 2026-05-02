# Squad 系統（隊伍）

> 跨遊戲統一隊伍系統 — 玩家的「永久身份」
> 狀態：已實作完成（2026-05-02 一次到位）

---

## 核心概念

```
Squad           = 永久身份（隊伍是誰、有誰、累積戰績）
teams           = 一場遊戲執行容器（teams.squadId 關聯 Squad）
battle_registrations = 一次水彈報名（squad_id 關聯 Squad）
battle_clans    = 寫入凍結（POST 410），舊資料只讀保留
```

一個玩家：
- 可加入多個 Squad
- 只能擔任一個 Squad 的隊長（防寡頭）
- 每場遊戲開始前選擇要用哪個 Squad 出戰

---

## DB Schema

| 表 | 用途 |
|----|------|
| `squads` | 隊伍主表（id, name, tag, leaderId, homeFieldId, status）|
| `squad_members` | 成員（leader / officer / member，soft delete via leftAt）|
| `squad_match_records` | 每場戰績（跨遊戲統一）|
| `squad_ratings` | 各遊戲類型獨立 rating（水彈、冒險各自）|
| `squad_stats` | 聚合統計（總場次、總點數、跨域陣列）|
| `squad_name_locks` | 隊名鎖（解散後 180 天）|
| `squad_name_history` | 改名歷史 |
| `squad_invites` | 邀請連結 |

詳細 schema → [`shared/schema/squads.ts`](../../shared/schema/squads.ts)

---

## 入口

| 路徑 | 用途 |
|------|------|
| `/squad/create` | 建立新 Squad |
| `/me/squads` 或 `/f/:fieldCode/me/squads` | 我參與的所有 Squad |
| `/squad/:squadId` | Squad 公開頁（成員 / 戰績 / 介紹） |
| `/squad/:squadId/settings` | Squad 設定（隊長 / officer）|
| `/invite/squad/:token` | 透過邀請連結加入 |
| `/squads/leaderboards` | 排行榜（場次 / 名人堂 / 新人榜 / 上升星） |

---

## API

### 主要端點
- `POST /api/squads` — 建立
- `GET /api/squads/:id` — 取詳情
- `PATCH /api/squads/:id` — 更新（隊長/officer）
- `DELETE /api/squads/:id` — 解散（隊長）
- `POST /api/squads/:id/members` — 加成員
- `DELETE /api/squads/:id/members/:userId` — 離開 / 踢出
- `PATCH /api/squads/:id/members/:userId` — 改角色（含轉讓隊長）
- `GET /api/me/squads` — 我參與的所有 Squad

### 凍結端點（已棄用）
- `POST /api/battle/clans` → 410 Gone
- `POST /api/battle/clans/:id/join` → 410 Gone

---

## 5 種計分模式

依 [archive/SQUAD_SYSTEM_DESIGN.md](../archive/SQUAD_SYSTEM_DESIGN.md) §3：

| 模式 | 適用 | 算分 |
|------|------|------|
| **Mode A — PvP 對戰** | 水彈、競賽、接力 | ELO |
| **Mode B — PvE 完成** | 冒險、解謎、QR 闖關 | 期望完成度模型 |
| **Mode C — 純體驗** | 嘉年華、導覽、生日派對 | 體驗點數（不算 rating）|
| **Mode D — 合作達成** | 團隊解謎、共同任務 | 全隊共享分數 |
| **Mode E — 個人挑戰** | 速通、極限挑戰 | 比較歷史最佳 |

---

## 隊伍狀態（自動轉換）

```
🌱 新隊伍 (場次=0) → 🌿 新人 (1-9 場) → 🔵 活躍 (10-49)
  → 💜 資深 (50-99) → 🌟 傳奇 (100+)
30 天無活動 → 😴 休眠
90 天無活動 / 隊長解散 → ☠️ 解散（鎖名 180 天）
```

---

## 戰績寫入流程

1. 一般遊戲完成 → `writeSquadRecordFromSession`
   - 查 `team_sessions → teams.squadId`
   - 寫 `squad_match_records` (squadType="squad")
2. 水彈結算 → `writeSquadRecordFromBattle`
   - 查 `battle_registrations.squadId`
   - 寫 `squad_match_records` (squadType="squad" / "clan" / "premade_group")

實作 → [`server/services/squad-record-writer.ts`](../../server/services/squad-record-writer.ts)

---

## 紅線

- ❌ **不可再加 battle_clans 寫入點**
- ❌ **squads.id 一旦寫入 squad_match_records 不可刪**（戰績完整性）
- ✅ **舊 battle_clans GET/PATCH 仍可用**（向後相容）

---

## 相關文件

- ADR：[decisions/0003-squad-unification.md](../decisions/0003-squad-unification.md)
- 變動紀錄：[changes/2026-05-02-squad-unification.md](../changes/2026-05-02-squad-unification.md)
- 原始設計（已 archive）：[archive/SQUAD_SYSTEM_DESIGN.md](../archive/SQUAD_SYSTEM_DESIGN.md) — 2363 行完整設計
- 程式碼：
  - 後端 routes：[server/routes/squads-core.ts](../../server/routes/squads-core.ts)、[squad-leaderboards.ts](../../server/routes/squad-leaderboards.ts)、[squad-records.ts](../../server/routes/squad-records.ts)、[squad-invites.ts](../../server/routes/squad-invites.ts)
  - Schema：[shared/schema/squads.ts](../../shared/schema/squads.ts)
  - 前端：`client/src/pages/Squad*.tsx`、`MySquads.tsx`
