# ADR-0003: Squad 系統一次到位（取代 teams / battle_clans）

> 日期：2026-05-02
> 狀態：✅ 採用中
> 影響：所有組隊功能、戰績統計、UI 入口
> Supersedes：原 Phase 14 過渡期方案

---

## 背景

專案曾有 4 套組隊概念並存：
- `teams`：一般遊戲一場結束的臨時組隊
- `battle_clans`：水彈長期戰隊（每場域限 1 個）
- `battle_premade_groups`：水彈報名前的臨時小組
- `squads`：Phase 14 設計的「跨遊戲統一隊伍」（建表但前端無入口）

[`SQUAD_SYSTEM_DESIGN.md`](../archive/SQUAD_SYSTEM_DESIGN.md) §22 規劃了三階段遷移（UI 統一 → 資料聚合 → 徹底合併），預估 6 週工程。

使用者實機後發現嚴重混亂：
- 「409 你已經有戰隊了」（建立隊伍頁撞錯）
- 「我的小隊」「戰隊」「隊伍」三套並存使用者完全不知道差別

---

## 選項

### 方案 A — 跟原規劃做完整三階段過渡
- ⏱ 6-12 週
- 🟡 雙寫 + backfill + 灰度 → 不破壞歷史資料
- 🔴 30% 工時花在拋棄式的過渡邏輯

### 方案 B — 直接「跳級」到單一系統
- ⏱ 2-3 週（實際 1 天分 6 PR 完成）
- 🟢 沒過渡期工程，全部一次到位
- 🟡 條件：沒有歷史資料要保護

---

## 決定

**採方案 B（跳級）**。

決定關鍵：使用者問「現在使用者還沒很多，把這個重要的項目完備不是更好嗎？」— 確認沒有歷史包袱，可省去 §22.3 的雙寫遷移工程。

最終架構：
```
Squad           = 永久身份（誰、有誰、累積戰績）
teams           = 一場遊戲執行容器（teams.squadId 關聯 Squad）
battle_registrations = 一次水彈報名（squad_id 關聯 Squad）
battle_clans    = 寫入凍結（POST 410 Gone），舊資料只讀保留
battle_premade_groups = 短期保留，未來淘汰
```

---

## 實作分 6 PR

| PR | 主題 |
|----|------|
| PR0 | QR 掃描依 game mode 導正流程（前置修復）|
| PR1 | Squad 建立頁 + 我的隊伍頁（前端入口補完）|
| PR2 | 戰鬥檔案 / 擂台「隊伍」改用 Squad 顯示 |
| PR3a | 401 token 自動 force-refresh + retry |
| PR3b | 水彈報名 squad-aware（schema + 後端 + UI）|
| PR4 | 多人遊戲 teams ↔ squads bridge |
| PR5 | 戰績寫 squad_match_records 連動真正 squad |
| PR6 | battle_clans 寫入凍結（POST 410）+ UI redirect |

詳情 → [changes/2026-05-02-squad-unification.md](../changes/2026-05-02-squad-unification.md)

---

## 影響

### 紅線（必守）
- ❌ **不可再加 battle_clans 寫入點** — 全凍結
- ❌ **不可再用 BattleClanCreate UI** — 已 redirect 到 SquadCreate
- ✅ **戰績統一寫 `squad_match_records`** — 用 squadType 分（squad / clan / team / premade_group）

### 後端 API 變更
- `POST /api/squads` → 主要建隊端點
- `POST /api/battle/clans` → 410 Gone（已棄用）
- `POST /api/battle/clans/:id/join` → 410 Gone（已棄用）
- 其他 `/api/battle/clans/*` GET / PATCH / leave / transfer → 仍可用（向後相容）

### Schema 變動
```sql
ALTER TABLE battle_registrations ADD COLUMN squad_id varchar;
CREATE INDEX idx_battle_reg_squad ON battle_registrations(squad_id);
ALTER TABLE teams ADD COLUMN squad_id varchar;
CREATE INDEX idx_teams_squad ON teams(squad_id);
-- battle_clans, battle_clan_members 表保留（不刪），未來可清資料但不刪表
```

### 已知限制
- battle_clans 舊資料未自動遷移到 squads（手動清理或留著只讀）
- LobbyViews UI 還沒露出「以隊伍出戰」按鈕（後端 PR4 就位但前端待補）

---

## 後續可能變動

- 半年後 battle_clans 完全沒讀取流量 → 可考慮 DROP（要再寫個 ADR）
- 跨遊戲徽章 / 推廣連結（squad-invites）後續做

---

## 相關文件

- 變動紀錄：[changes/2026-05-02-squad-unification.md](../changes/2026-05-02-squad-unification.md)
- 領域文件：[domains/squad-system.md](../domains/squad-system.md)
- 原始設計：[archive/SQUAD_SYSTEM_DESIGN.md](../archive/SQUAD_SYSTEM_DESIGN.md)（已 archived 但保留作參考）
