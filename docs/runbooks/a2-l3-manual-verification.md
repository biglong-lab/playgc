# 🧪 A2 多人元件 L3 持久化實機驗證 checklist

> **建立日期**：2026-05-07
> **對應**：Phase 3 A2 — 9 個 L3 持久化元件驗證
> **互補**：[e2e-multiplayer-checklist.md](e2e-multiplayer-checklist.md)（重玩法）/ 本份（重持久化）
> **預估時長**：60-90 分鐘走完 9 個元件

---

## 為什麼需要這份

按 [ADR-0017](../decisions/0017-loop-mode-safeguards.md) 紅線 #10「禁止用單元測試替代 e2e」：原指令要驗 L3 持久化必須用真瀏覽器 + 真 admin 後台 + 真實玩家流程。

**Playwright e2e 的限制**：Firebase auth 無法 bypass，`isAuthenticated` middleware 擋住所有 `/api/team-*` 端點 → 自動化只能驗到 page 載入級別（見 `e2e/a2-multi-l3-smoke.spec.ts`）。

**自動化能驗**：page 建立、config 寫入、/play 載入不崩潰 → 約 70% 信心
**實機要驗**：玩家操作、ws 即時推送、重整後 L3 還原 → 補完 30% 信心

---

## 前置設定

### 環境
- [ ] 啟動本地 dev：`npm run dev`（port 3333）
- [ ] 開啟 dev DB（Docker `gameplatform-postgres` port 5437）
- [ ] 設備：電腦（admin 後台）+ 手機 / 第二瀏覽器（玩家 1）+ 第三瀏覽器隱身視窗（玩家 2）

### Admin 登入
- [ ] http://localhost:3333/admin
- [ ] 用 twfam4@gmail.com Firebase 登入

### 玩家準備
- [ ] 兩個玩家分別用不同 Google 帳號 Firebase 登入（玩家 A / 玩家 B）
- [ ] 兩個玩家進同一場域（`/f/<fieldCode>`）

---

## 9 個元件分組

按驗證重點分三組：
- **G1（高風險）**：lock_coop / relay_mission / territory_capture — 既有 ws 即時同步，要驗多 client
- **G2（DB only L3 升級）**：collective_score / role_assign / quest_chain — 2026-05-05 從 L0 升 L3
- **G3（DB L3 升級）**：jigsaw_puzzle / treasure_hunt / gps_cascade — 同 G2 升級時間

每組共用驗證流程，不同元件操作步驟略不同。

---

## G1 — ws 即時同步元件（最關鍵）

### 通用驗證流程
1. **建場**：admin 建多人 game → 拖入指定 page_type → 設 default config（見下方）→ 公開
2. **加入**：兩玩家進 `/play/<sessionId>` → 同一隊
3. **A 操作**：玩家 A 觸發狀態變化（輸入/答對/佔領）
4. **B 看到**：玩家 B 螢幕**在 1 秒內**同步顯示變化（驗 ws 即時推送）✅
5. **A 重整**：玩家 A F5 → 操作前狀態還原（驗 DB 持久化）✅
6. **B 重整**：玩家 B F5 → 看到 A 的最新狀態（驗 DB + ws 雙路）✅

---

### G1.1 LockCoop（協作解鎖）
- [ ] **建場**：digits=4, combination="1234", clues=[{text:"前兩位 12"},{text:"後兩位 34"}]
- [ ] **A 輸入「12」** → B 螢幕應在 1 秒內看到 sharedCode 顯示「12」
- [ ] **A F5** → 重整後 sharedCode 仍為「12」
- [ ] **B 輸入「34」** → A 看到「1234」
- [ ] **任一人按解鎖** → 雙方都看到 unlocked 狀態
- [ ] **B F5** → 重整後仍為 unlocked
- [ ] **異常**：A 跟 B 同時輸入不同數字 → 最後一個寫入勝出（記錄誰勝）

### G1.2 RelayMission（接力任務）
- [ ] **建場**：segments=[{title:"段1",prompt:"答A",answer:"A"},{title:"段2",prompt:"答B",answer:"B"}]
- [ ] **A 答對段 1**（輸入「A」）→ B 看到段 1 完成、進到段 2
- [ ] **A F5** → 重整後仍在段 2、不會回段 1
- [ ] **B 答對段 2** → 兩邊看到通關
- [ ] **B F5** → 仍顯示通關狀態

### G1.3 TerritoryCapture（地盤戰）
- [ ] **建場**：points=[2 個點], timeLimitSec=300, capturePoints=5
- [ ] 兩人開瀏覽器允許 GPS 權限
- [ ] **mock A 位置到點 1**（瀏覽器 devtools sensors）→ 點擊佔領 → B 看到點 1 變色
- [ ] **A F5** → 點 1 仍為 A 隊佔領
- [ ] **mock B 位置到點 2** → B 佔領 → A 看到
- [ ] **異常**：cooldown 30 秒內不能再佔領同一點

---

## G2 — DB 持久化元件（L0→L3 升級驗證）

### 通用驗證流程
1. **建場 + 加入**（同 G1）
2. **A 操作**：產生狀態變化
3. **A F5**：狀態還原 ← 主驗證點（升級前重整會丟失）
4. **B 加入後**：看到 A 累積的狀態（DB sync）

---

### G2.1 CollectiveScore（集體分數）
- [ ] **建場**：goal=100, mode="additive"
- [ ] **A 加 30 分** → 顯示 30/100
- [ ] **A F5** → 仍顯示 30/100（升級前會歸 0）
- [ ] **B 加 50 分** → A 看到 80/100
- [ ] **B F5** → 仍 80/100
- [ ] 滿 100 分 → 完成事件觸發

### G2.2 RoleAssign（角色分派）
- [ ] **建場**：roles=["隊長","記錄","計時","發言"]
- [ ] **A 領「隊長」** → B 看到隊長已被認領
- [ ] **A F5** → A 仍是隊長（升級前會被重複認領）
- [ ] **B 領「記錄」** → 兩邊都看到分配
- [ ] **B F5** → 角色仍正確
- [ ] 異常：A 嘗試領 B 已認領的「記錄」→ 應被拒絕

### G2.3 QuestChain（任務鏈）
- [ ] **建場**：quests=[{q1:"答 X"},{q2:"答 Y"}]
- [ ] **A 答對 q1**（輸入「X」）→ 進度條更新、B 看到
- [ ] **A F5** → 仍在 q2 步驟（升級前會回 q1）
- [ ] **B 答對 q2** → 全鏈完成
- [ ] **B F5** → 仍顯示完成

---

## G3 — 進階 DB 持久化元件

### G3.1 JigsawPuzzle（拼圖協作）
- [ ] **建場**：pieces=9, timeLimit=300
- [ ] **A 拖移 1 片** → B 看到該片位置變化
- [ ] **A F5** → 該片位置還原
- [ ] **B 拖移 2 片** → A 看到
- [ ] **B F5** → 拼圖狀態正確
- [ ] 全部拼完 → 通關事件

### G3.2 TreasureHunt（尋寶任務）
- [ ] **建場**：clues=[{c1:"答 A"},{c2:"答 B"}]
- [ ] **A 答對 c1** → 解鎖 c2、B 看到
- [ ] **A F5** → c1 仍解鎖
- [ ] **B 答對 c2** → 通關
- [ ] **B F5** → 通關狀態保留

### G3.3 GpsCascade（GPS 連鎖）
- [ ] **建場**：checkpoints=[2 個點], radius=30
- [ ] mock A 位置到 cp1 → check-in → B 看到 cp1 解鎖
- [ ] **A F5** → cp1 仍 checked
- [ ] mock B 位置到 cp2 → 通關
- [ ] **B F5** → 通關狀態保留

---

## 驗證結果記錄

每個元件驗完打勾，記下：
- ✅ 通過（持久化 + 同步都正常）
- ⚠ 部分通過（持久化 OK / ws 同步有延遲或丟訊息）
- ❌ 失敗（重整後狀態丟失，等同 L0）

填到 next-action-guide.md「已知問題 / 紅旗」區。

---

## 異常處理

### 持久化失效（重整丟狀態）
1. 開瀏覽器 devtools Network 看 POST /api/team-* 是否 200
2. 確認 server log 有對應 INSERT/UPDATE
3. 直接查 DB：`SELECT * FROM team_game_states WHERE session_id = '<sessionId>'`
4. 沒資料 → 元件 client 沒有送出 POST → 改 client code
5. 有資料但 reload 後沒帶回 → server GET 路徑問題 → 改 server / hook

### ws 同步失效（B 看不到 A 的動作）
1. 開瀏覽器 devtools Network → WS frames → 確認 server 有送 message
2. 確認 client onMessage 有處理對應 type（如 `lock_coop_updated`）
3. 沒收到 → server `broadcastToTeam` 條件不滿足 → 改 server
4. 收到但 UI 沒更新 → state setter 漏調用 → 改 client

---

## 相關文件

- [Phase 3 A2 規劃](../changes/2026-05-07-next-action-guide.md)
- [既有多人元件玩法 checklist](e2e-multiplayer-checklist.md)
- [ADR-0017 Loop 護欄](../decisions/0017-loop-mode-safeguards.md)
- [自動化 e2e（smoke 級）](../../e2e/a2-multi-l3-smoke.spec.ts)
