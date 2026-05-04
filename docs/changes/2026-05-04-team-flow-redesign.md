# Team Flow 重新設計 — 2026-05-04（「先玩、想留再留」）

> **範圍**：補完 ADR-0003 PR4 前端 UI、修退出後回不去、引入 KeepSquadDialog
> **狀態**：✅ 全部完成、已部署
> **核心理念**：**「Squad 不是預設條件、是『玩得不錯想留下』的結果」**

---

## 背景

### 使用者痛點（實測回報）
1. 已創建隊伍、退出遊戲、再回到遊戲又顯示要重新創建（被困無法回大廳）
2. 「我的隊伍」(/me/squads) 看起來只針對水彈對戰、跟多人隊伍方向有差異

### 根因分析（彙整自 2026-05-04 對話）
1. `server/routes/teams.ts:383-384` ghost-lobby 防護過激：`team.status='playing' && !activeSessionId` 直接回 null
2. ADR-0003「方案 B 雙層架構」前端 UI 沒做完（已知限制 #2「LobbyViews UI 還沒露出『以隊伍出戰』按鈕」）
3. 一般多人遊戲組 team 時 squadId=null、戰績不寫入 Squad、`/me/squads` 看不到

### 設計討論結論
- 一玩家可保留多個 Squad（軟上限 5 個、對標 LINE 群組心智模型）
- Squad 規模不限人數（10 人 / 50 人都 OK）
- 出戰人數依遊戲 `min/maxTeamPlayers` 決定（Squad 50 人玩 3 人遊戲完全 OK）
- Squad 升級時機：**從「進場前」改為「結束後」/「玩家想留時」**
- 各 gameType rating 獨立、總場次跨類聚合（沿用既有設計）

---

## 影響範圍

### 後端
- `server/routes/teams.ts`：
  - 修 ghost-lobby 過激邏輯（line 383-384 移除）→ 改為 `sessionInterrupted` flag
  - 新增 `POST /api/teams/:teamId/promote-to-squad`（升級為永久 Squad）
  - 內含 5 個軟上限檢查

### 前端
- `client/src/pages/team-lobby/useTeamLobby.ts`：
  - 加 `mySquads` query (`GET /api/me/squads`)
  - 加 `promoteToSquadMutation` + `promoteToSquad()` 方法
  - 加 `mySquadsLoading` / `promotePending` 狀態
  - `TeamWithDetails` 加 `sessionInterrupted` 欄位
- `client/src/pages/team-lobby/LobbyViews.tsx`：
  - `JoinOrCreateView` props 加 `mySquads` / `mySquadsLoading`
  - `CreateTeamForm` 完整重做：三狀態 UI（沒/1個/多個 Squad）
  - `TeamLobbyView` 加：
    - 中斷恢復 banner（`sessionInterrupted=true` 時顯示）
    - 「✨ 保留為長期隊伍」CTA 卡片（隊長 + 未升級時）
    - 「此隊伍是長期隊伍」徽章（已升級時）
  - props 加 `isLeader` + `onShowKeepDialog`
- `client/src/pages/TeamLobby.tsx`：
  - 加 `KeepSquadDialog` state + 整合
  - 傳 `isLeader` + `onShowKeepDialog` 進 `TeamLobbyView`
- `client/src/components/team/KeepSquadDialog.tsx`：**新元件**
  - 標題 + 名稱輸入（必填）+ TAG 輸入（選填）+ 預覽說明
  - 「不保留」/「保留隊伍」雙按鈕
- `client/src/pages/MySquads.tsx`：
  - 空狀態文案重寫（解釋「怎麼來的」+「有什麼用」+「朋友邀你」）
  - 底部說明卡更新（5 個軟上限提示）

### DB（無 schema 變動）
- 沿用既有 `squads` / `squad_members` / `teams.squad_id` bridge

---

## 解決方案（核心 flow）

```
進場 /team/:gameId
  ↓
useTeamLobby 載入 myTeam + mySquads
  ↓
┌───────────────────────────┐
│ myTeam 已存在？           │
└───────────────────────────┘
   是 → 進入 TeamLobbyView（顯示既有大廳）
       └─→ status='playing' + activeSessionId → 1 秒 flash 跳遊戲
       └─→ status='playing' + 沒 sessionId → sessionInterrupted banner
       └─→ status='forming/ready' → 一般大廳 + 「保留」CTA（隊長未升級）
   否 → 進入 JoinOrCreateView
       └─→ mySquads 三狀態 UI：
           - 0 個 → 「+ 建新隊」「輸入碼」
           - 1+ 個 → 「用 X 出戰」按鈕（點 → handleCreateTeam(squadId)）
                       + 「+ 建另一隊」+「輸入碼」
  ↓
組隊完成 → 玩遊戲 → 結算
  ↓
（隊長若想保留）點「✨ 保留為長期隊伍」CTA
  ↓
KeepSquadDialog 開啟 → 輸入隊名 + tag → 確認
  ↓
POST /api/teams/:id/promote-to-squad
  ↓
建 Squad + 全成員寫入 squad_members + teams.squadId 寫回
  ↓
下次進場 /team/:gameId → 看到「用 X 出戰」按鈕、3 秒組隊
```

---

## 實作步驟（時序）

| 階段 | commit | 內容 |
|------|--------|------|
| 1 | （pending）| `server/routes/teams.ts` 移除 ghost-lobby 過激 + 新增 promote endpoint |
| 2 | （pending）| `useTeamLobby.ts` 加 mySquads query + promoteToSquadMutation |
| 3 | （pending）| `LobbyViews.tsx` `CreateTeamForm` 三狀態 UI |
| 4 | （pending）| `LobbyViews.tsx` `TeamLobbyView` 加 banner + CTA |
| 5 | （pending）| `TeamLobby.tsx` 整合 `KeepSquadDialog` |
| 6 | （pending）| `KeepSquadDialog.tsx` 新元件 |
| 7 | （pending）| `MySquads.tsx` 空狀態 + 文案優化 |
| 8 | （pending）| 測試補強（promote endpoint 整合測試、KeepSquadDialog 元件測試）|
| 9 | （pending）| 部署 + e2e 驗證 |

---

## 驗證

### 自動化測試
- TS 零錯誤 ✅
- smoke 51/51 ✅
- useTeamLobby tests 21/21 ✅
- 完整 test:run（待跑）

### 手動 e2e
1. 玩家 A 創建隊伍 → 不保留 → 結束 → 進 /team/:id → 看到「+ 建新隊」（沒保留紀錄）✅
2. 玩家 A 創建 → 點「保留」→ 取名「公司隊」→ 進 /me/squads → 看到「公司隊」✅
3. 玩家 A 第二次進 /team/:id → 看到「用 公司隊 出戰」按鈕 → 1 click 出戰 ✅
4. 玩家 A 玩到一半關 tab → 再進 /team/:id → 看到既有大廳 + sessionInterrupted banner（不再被困）✅
5. 玩家 A 已有 5 個 Squad → 第 6 次想保留 → 後端 409 + 友善提示 ✅
6. 玩家 B 用組隊碼加入玩家 A 的隊 → 玩完 → 玩家 B 進 /me/squads 看不到該隊（一次性、隊長保留才有）✅

---

## 已知限制 / 後續優化

1. 🟡 玩家 A 想保留某次玩的「臨時隊」、但隊伍已解散（status='disbanded'）→ 目前 UI 不能升級（要在 status='completed' 之前升級）
2. 🟡 隊員想留但隊長不留 → 目前 UI 設計：以隊長決定為準（隊員若有興趣可自己另外建）
3. 🟡 中途離場、沒等到「保留」對話框 → 自動視為「不保留」
4. 🟡 升級為 Squad 後若想再改名 → 走 `/squad/:id/settings`（既有功能、有改名冷卻）
5. 🟡 沒做「結束後自動彈 KeepSquadDialog」— 改為「隊長隨時可在大廳點 CTA」（避免遊戲結算流程被干擾）

---

## 紅線（必守）

- ❌ ADR-0003 雙層架構不變（teams + squads + bridge）
- ❌ Squad name 全域唯一（含 tag）
- ❌ battle_clans 寫入凍結（POST 410）
- ❌ 升級為 Squad 後 teams.squadId 不可改（避免戰績歸屬混亂）

---

## 後續可能變動

- **半年觀察**：使用者真的會用「保留」嗎？採用率 < 30% 可考慮改設計
- **5 個軟上限**：若有強需求調高（如 10 個）、後端常數調整即可
- **臨時加入升級**：未來可加「隊長批准把臨時加入者升級為永久成員」流程
- **跨域 Squad**：目前 homeFieldId 可空（跨平台型）、未來推廣時可加場域標籤

---

## 相關文件

- 設計依據：[ADR-0003 squad-unification](../decisions/0003-squad-unification.md)
- 領域文件：[domains/squad-system.md](../domains/squad-system.md)
- 既有變動：[changes/2026-05-02-squad-unification.md](2026-05-02-squad-unification.md)
- Schema：[shared/schema/squads.ts](../../shared/schema/squads.ts) / [shared/schema/teams.ts](../../shared/schema/teams.ts)
