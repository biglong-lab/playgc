# Squad 系統一次到位 — 2026-05-02

> 範圍：8 個 commit（PR0 + PR1 ~ PR6）
> 狀態：已完成、已部署
> 部署：`19c293aa..d6134d6b`

---

## 背景

使用者實機反映三套組隊系統混亂：

1. 「我選了賈村卻顯示在後浦，沒地方回首頁」
2. 「掃描遊戲 QR 後直接玩了，但這應該是要走組隊流程」（截圖：金門知識大挑戰直接顯示「開始遊戲」）
3. 「409 你已經有戰隊了，請先離開現有戰隊」（建立隊伍頁撞錯）
4. 「取消失敗 — 登入已失效，請重新登入」（水彈取消報名 401）

**根因**：專案同時跑三套組隊系統：
- `teams`（一般遊戲、一場結束）
- `battle_clans`（水彈長期戰隊、永久 ELO）
- `squads`（Phase 14 設計但只做了後端，前端無入口）

使用者問「現在使用者還沒很多，把這個重要的項目完備不是更好嗎？」— 確認採「一次到位」策略，不留過渡期。

詳細決策 → [`decisions/0003-squad-unification.md`](../decisions/0003-squad-unification.md)

---

## 影響範圍

### 後端
- `shared/schema/teams.ts`：加 `squad_id` 欄位
- `shared/schema/battle-slots.ts`：`battle_registrations` 加 `squad_id` 欄位
- `server/routes/teams.ts`：建 team 接受 `squadId`
- `server/routes/battle-registration.ts`：報名接受 `squadId`
- `server/routes/battle-results.ts`：結算優先用 `registrations.squadId`
- `server/routes/battle-clans.ts`：POST 端點全 410 Gone（凍結寫入）
- `server/services/squad-record-writer.ts`：寫戰績優先連動真正 squad
- `server/lib/firebase.ts` + `client/src/lib/queryClient.ts`：401 自動 force-refresh + retry

### 前端
- 新增 `client/src/pages/SquadCreate.tsx`
- 新增 `client/src/pages/MySquads.tsx`
- `client/src/pages/BattleClanCreate.tsx`：改 redirect 到 `/squad/create`
- `client/src/pages/BattleMyProfile.tsx`：改用 `/api/me/squads`
- `client/src/pages/BattleHome.tsx`：「隊伍」按鈕指向 `/me/squads`
- `client/src/pages/BattleSlotDetail.tsx`：報名 dialog 加「報名身份」選擇
- `client/src/pages/GameBySlug.tsx`：QR 掃描依 game mode 導正
- `client/src/pages/me/MeCenter.tsx`：加「🛡 我的隊伍」入口
- `client/src/pages/team-lobby/useTeamLobby.ts`：建 team 帶 squadId

### DB（生產直接 SQL）
```sql
ALTER TABLE battle_registrations ADD COLUMN squad_id varchar;
CREATE INDEX idx_battle_reg_squad ON battle_registrations(squad_id);
ALTER TABLE teams ADD COLUMN squad_id varchar;
CREATE INDEX idx_teams_squad ON teams(squad_id);
```

---

## 解決方案

**核心觀念**：
```
Squad = 永久身份（隊伍是誰、累積戰績）
teams = 一場遊戲執行容器（teams.squadId 關聯 Squad）
battle_registrations = 一次水彈報名（squad_id 關聯 Squad）
battle_clans = 寫入凍結（POST 410），舊資料只讀保留
```

**取代 §22.3 雙寫遷移**：因為使用者沒有歷史包袱，可直接「跳級」到單一系統，省去過渡期工程。

---

## 實作步驟（時序）

| PR | Commit | 內容 |
|----|--------|------|
| PR0 | `19c293aa` | QR 掃描依 game mode 導正（chapter/team/match/single）|
| PR1 | `0da1f3c0` | SquadCreate + MySquads 前端入口 |
| PR2 | `22c83d8e` | 戰鬥檔案 / 擂台「隊伍」改用 squad |
| PR3a | `23e679a9` | 401 token 自動 force-refresh + retry |
| PR3b | `921c0d2d` | 水彈報名 squad-aware（schema + UI）|
| PR4 | `ff611899` | teams ↔ squads bridge |
| PR5 | `e9bdff39` | 戰績寫 squad_match_records 連動真正 squad |
| PR6 | `d6134d6b` | battle_clans 寫入凍結 + UI redirect |

---

## 驗證

實機測試（[https://game.homi.cc](https://game.homi.cc)）：

1. **多人遊戲 QR 掃描** → 顯示「創建或加入隊伍」+ 💡 提示
2. **「我的」→ 🛡 我的隊伍** → 列出所有 active squads
3. **建立隊伍** → 走 `/squad/create`，不再撞 409
4. **水彈報名 dialog** → 多了「報名身份」選擇（個人 / 各 squad）
5. **PWA 取消報名** → 不再出現「登入已失效」紅卡
6. **多人遊戲完成** → 戰績進真正 squad

---

## 已知限制 / 後續優化

- 🟡 LobbyViews UI 還沒露出「以隊伍出戰」按鈕（PR4 後端就位但前端 UI 待補）
- 🟡 battle_clans 舊資料未自動遷移到 squads（手動清理或留著只讀）
- 🟢 跨遊戲徽章 / 推廣連結（squad-invites 已建後端）下一階段做

---

## 相關文件

- ADR：[decisions/0003-squad-unification.md](../decisions/0003-squad-unification.md)
- 領域文件：[domains/squad-system.md](../domains/squad-system.md)（從 SQUAD_SYSTEM_DESIGN.md 整併）
- 影響的 runbook：[runbooks/db-migration.md](../runbooks/db-migration.md)
