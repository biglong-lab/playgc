# 🔍 B 級元件多人化評估（暫緩項 5/5）

> **建立日期**：2026-05-02
> **狀態**：⏸️ 條件性保留 — 等使用者回饋有需求
> **依據**：[GAME_COMPONENT_MULTIPLAYER_PLAN.md](GAME_COMPONENT_MULTIPLAYER_PLAN.md) §10.2

---

## 為何條件性保留

文件 §10.2「條件性做的事」明確：
> ⚠️ 新增 B 級元件多人版（TextVerifyTeam / QrScanRelay / TimeBombCoop）→ 等使用者回饋有需求

文件 §13「風險評估」：
> 元件分類爭議（Vote 是個人還是多人？）— 本規劃明確：Vote = 個人，VoteTeam = 多人，**禁混**

換言之：拆分模式 SRP 原則 — 個人版用個人元件，多人版必須建獨立元件。**不該因為「順便做」而新增**。

每個多人元件約 4-5 commit + 20-30 測試（依 LockCoop / RelayMission / TerritoryCapture 慣例），無實際遊戲設計需求時做了會：
- 增加維護成本（沒人玩的元件還要持續 typecheck / 測試）
- 增加 admin 元件選單複雜度（PAGE_TYPES 變長）
- 違反「最小可行 + 依需求迭代」原則

---

## 三個候選元件需求分析

### TextVerifyTeam（隊伍文字答題）

**個人版現況**：[client/src/components/game/solo/TextVerifyPage.tsx](../client/src/components/game/solo/TextVerifyPage.tsx)（398 行）
**多人版設想**：隊伍協作答題（線索拼接） / 搶答 / 投票決定答案

**為何暫緩**：
- ChoiceVerifyRace 已實作搶答模式（選擇題版）— 文字題搶答需求重疊
- LockCoop 已涵蓋「分頭收集線索拼答案」玩法（密碼版）
- 「文字題隊伍協作」獨立需求未明確 → 等使用者回饋

### QrScanRelay（隊伍 QR 接力掃描）

**個人版現況**：[client/src/components/game/solo/QrScanPage.tsx](../client/src/components/game/solo/QrScanPage.tsx)
**多人版設想**：N 個 QR 散落場域 → 隊伍每人掃一個 → 全部掃完才過關

**為何暫緩**：
- RelayMission 已涵蓋「分段協作完成」結構（接力任務）
- GpsTeamMission 已涵蓋「隊伍到多個點」概念（含 any/all 觸發）
- QR 接力 = RelayMission 的 segmentType="qr" 變體 — 未來擴充 RelayMission segments 即可，不必新建

### TimeBombCoop（隊伍協作拆彈）

**個人版現況**：[client/src/components/game/solo/TimeBombPage.tsx](../client/src/components/game/solo/TimeBombPage.tsx)（357 行）
**多人版設想**：限時拆彈，每人負責不同任務（tap/input/choice/swipe）

**為何暫緩**：
- LockCoop 已涵蓋「協作拼出密碼」核心玩法（限時可在 admin config 加 timeLimit）
- TimeBomb 多任務協作 vs LockCoop 線索分配 — 玩法重疊度高
- TimeBomb 個人版多任務切換已複雜，多人版會更難設計平衡

---

## 觸發實作的條件

依文件 §10.2 + §13，當以下**任一**條件出現時再啟動 B 級多人化：

1. **使用者明確要求**：「我需要 [元件名] 多人版來支持 [具體場景]」
2. **實機回饋驗證**：某場域實際辦活動發現「多人 A 元件 + 多人 B 元件」組合不夠用
3. **既有多人元件不足以涵蓋**：例如 LockCoop 不適合某種協作解謎情境

啟動時依 LockCoop / RelayMission 的 5-step 流程（schema → UI → hook → 容器 → 測試）。

---

## 已實作多人元件覆蓋率

8 個多人元件已涵蓋的玩法類型：

| 玩法類型 | 多人元件 | 是否需要 B 級補強 |
|---------|---------|-----------------|
| 拍照協作 | PhotoTeam | 否（PhotoTeam 已涵蓋） |
| 投票決議 | VoteTeam | 否 |
| 累計射擊 | ShootingTeam | 否 |
| GPS 協作走訪 | GpsTeamMission | 否 |
| 搶答競爭 | ChoiceVerifyRace | 否（文字題重疊度高） |
| 協作解鎖（不對稱資訊） | LockCoop | 否（包含拆彈玩法概念） |
| 接力分段 | RelayMission | 否（含 QR / 解謎 / 拍照可擴 segmentType） |
| 地盤戰（多隊對抗） | TerritoryCapture | 否 |

**結論**：8 個多人元件涵蓋了 Phase 1-4 規劃的所有核心多人玩法。
B 級元件多人版**目前不必主動實作**，等實機回饋有具體缺口再補。

---

## 結語

✅ **暫緩項 5/5 結案** — B 級多人化評估完成，按文件 §10.2 保留為條件性項目。

實機驗證或回饋出現需求時，請：
1. 在 PROGRESS.md 記錄需求來源
2. 開新 commit 啟動 5-step 實作
3. 完工後更新本文件 + STATUS_V2

整體 GAME_COMPONENT_MULTIPLAYER_PLAN 規劃內容已 100% 完成。
