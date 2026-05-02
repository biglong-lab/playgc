# 🗳️ 團隊投票後端同步規劃

> 盤點日期：2026-04-24
> 狀態：**需產品決策**（前後端已有雛形但未對接）

---

## 📊 現況盤點

### 1. 前端 VotePage.tsx — 完全單機

位置：`client/src/components/game/VotePage.tsx`

```tsx
// 核心行為
handleVoteSubmit()
  ├── setHasVoted(true)
  ├── 本地計算 voteResults + totalVotes
  └── onVariableUpdate(voteStorageKey, { results, total })
      ↓ 存進 session.variables（每個玩家自己的 state）

canContinue = hasVoted  // 投完自己票就可前進，不等隊友
```

**特徵**：
- ✅ 單人遊戲運作完美
- ❌ 團隊模式下，每個隊友各自投票、看不到彼此
- ❌ 註解自承「minVotes 為團隊同步保留；單機模式下無意義」（第 44 行）

### 2. 後端 team-votes.ts — API 完整但無人呼叫

位置：`server/routes/team-votes.ts`（270 行）

已實作：
- `POST /api/teams/:teamId/votes` — 建立投票
- `POST /api/votes/:voteId/cast` — 投票
- `GET /api/teams/:teamId/votes` — 取隊伍投票列表
- WebSocket broadcast：`vote_created` / `vote_cast`
- 支援 `majority`（過半決）/ `unanimous`（全員同意）兩種模式

**特徵**：
- ✅ 邏輯完整：過期、重複投票、去重、結果計算
- ✅ WebSocket 即時廣播
- ❌ **前端任何地方都沒有呼叫這些端點**（grep 確認）

### 3. Schema 對應

```ts
// shared/schema/teams.ts
teamVotes         // 投票主表（title, options, status, votingMode, ...）
teamVoteBallots   // 投票紀錄（userId, voteId, optionId）
```

資料表存在但無資料（因前端沒寫入）。

---

## 🎯 需要決策的問題

### 問題 A：哪種投票要同步？

**選項**：
1. **全部 VotePage 都同步** — 不論單人/團隊遊戲，只要有其他玩家同 session 就同步
2. **只在 team mode 同步** — 其他情境維持單機
3. **管理員 per-page 設定** — 遊戲頁 metadata 加 `syncToTeam: boolean` 開關

### 問題 B：同步語意？

**選項**：
1. **計票展示** — 每個玩家看到大家票數，但投完自己票就可前進（不卡住）
2. **等全員投** — 必須全隊都投完才能前進
3. **過半可前進** — 過半數投完就可前進
4. **投票結果決定下一頁** — 隊伍共同走向的分支（多人劇情）

### 問題 C：誰建立投票？

**選項**：
1. **頁面進入自動建立** — 第一個進入 VotePage 的玩家建立，其他人加入
2. **隊長手動建立** — 隊長按鈕開啟投票
3. **管理員預建** — 遊戲編輯器就預設好投票

---

## 💡 建議方案（最小改動 + 最大價值）

### Phase 1：僅在 Team Mode 開啟同步
```
條件觸發：
  gameMode === "team" + VotePage 出現
    → 呼叫後端 API，其他人投票進度即時顯示
  單人 / competitive mode
    → 維持目前單機，零改動

優點：
  - 影響範圍可控
  - 現有單人遊戲不受影響
  - 明確用戶情境

改動範圍：
  - VotePage.tsx 加入「若是 team mode 則呼叫 API」分支
  - 第一個進入的玩家自動建立 vote（POST /api/teams/:teamId/votes）
  - 其他人拿到進行中的 vote（GET /api/teams/:teamId/votes）
  - 投票時呼叫 cast API
  - 監聽 WebSocket `vote_cast` 事件更新本地 state
```

### Phase 2：票數視覺化與領先者 pulse
```
後端 broadcast 的 voteCounts 即時顯示在所有隊友畫面
領先選項加脈動邊框，增加緊張感
```

### Phase 3：投票結果影響走向
```
支援投票結果決定 nextPage（已有 nextPageStrategy = "winner" 邏輯）
整合後端 winningOptionId 與前端 onComplete(nextPage)
```

---

## 🔧 Phase 1 實作估計

```
📝 VotePage.tsx 擴充：
  ├── 新增 useTeamVote hook（條件性呼叫，team mode 才啟動）
  ├── 分支邏輯：teamMode ? 同步版 : 單機版
  ├── WebSocket 監聽 vote_cast 更新 voteResults
  └── 保留現有單機 fallback

🔌 對接 API：
  ├── POST /api/teams/:teamId/votes（首位玩家建立）
  ├── GET /api/teams/:teamId/votes（後進者取得）
  └── POST /api/votes/:voteId/cast（投票）

🧪 測試：
  ├── 兩個瀏覽器 window 模擬團隊
  └── 驗證即時同步 + 斷線重連

預估：8–12h
```

---

## 🚦 需要您回答的問題

請擇一告訴我：

**A.**「先做 Phase 1 Team Mode 同步」
→ 我會實作 useTeamVote hook 並對接 API

**B.**「暫時不做、保持現狀」
→ 我更新註解、把後端 API 標為「內部預留」，避免他人誤以為是完成品

**C.**「要完整三 Phase 一次做完」
→ 需規劃更長時間（~25–30h）

**D.**「要先做別的」
→ 告訴我優先項目

---

## 📌 附註：當前單機版不是 bug

現有的 VotePage 單人運作是**符合設計的**：
- 投完自己票 + 5 秒自動前進
- 不依賴隊友，避免卡關
- 寫入 session.variables 供後續劇情使用

只是**缺了多人同步的那一半**。做與不做都 OK，看產品決策。
