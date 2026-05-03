# BACKLOG.md — 任務清單

> 完成的項目移到末段「✅ 已完成」區、不刪
> 大型任務拉出獨立檔 → [tasks/](tasks/)

---

## 🚧 P0 — 環境問題（最快、5 分鐘 × 2）

### [ ] T003.1 修協作文檔 `cc` / `/cc` 文案矛盾 + 進度板過時
- **症狀**：`AGENTS.md`、`PROTOCOL.md`、`codexclaude-dbug.md` 對 `cc` / `/cc` 說法不一致；`STATUS.md` / `BACKLOG.md` 有過時進度
- **修法**：統一成單一說法、同步 STATUS 最近動作 / smoke 健檢狀態 / 已完成 commit 事實
- **估時**：15 分鐘
- **任務檔**：待建立

<!-- T002.1 / T002.2 已完成、移到「✅ 已完成」區 -->

### [ ] T002.1b adminContent.test.ts 剩 4 失敗（CRUD）
- **症狀**：Items CRUD POST/PATCH/DELETE 回 500/404
- **背景**：T002.1 db mock 修好整檔崩、但 mock storage method 不夠完整
- **修法**：補 mock 對應的 storage method、或對齊路由實際邏輯
- **估時**：15 分鐘
- **優先**：P3（測試過時類型）

### [ ] T002.2b webhook-recur.test.ts 剩 6 失敗
- **症狀**：6/12 測試失敗、需查路由邏輯
- **背景**：T002.2 db mock 修好整檔崩、但仍有 6 個 assertion 失敗
- **修法**：跑單檔看詳細錯誤、判斷類型（過時 / 真 bug）
- **估時**：20 分鐘
- **優先**：P3

---

## 🔴 P1 — 紅線商業邏輯（必須先確認）

### [ ] T002.3 修 `battle-clans.test.ts`（4 失敗）
- **症狀**：實際 410、期望 200/404/409/400
- **真相**：**CLAUDE.md 紅線「Squad 系統取代 battle_clans、POST 凍結為 410 Gone」**
- **修法**：測試斷言改期望 410、刪「成功建立戰隊」case
- **紅線**：⚠️ **不要把路由 410 改回 200**
- **估時**：15 分鐘

---

## 🟡 P2 — 可能含真 bug

### [ ] T002.4 修 `locations.test.ts`（3 失敗）
- **症狀**：500 vs 201/404/400
- **推測**：跟 T001 的 player-sessions 404 fallback 同類真 bug
- **修法**：先看路由確認、必要時修真 bug + 補 mock
- **估時**：30 分鐘

---

## 🟢 P3 — 純測試過時

### [ ] T002.5 修 `adminChapters.test.ts`（11 失敗）
- **症狀**：實際 404、期望 200/201/500
- **推測**：路由 path 改、或 admin auth mock 沒注入
- **修法**：對照路由實際 endpoint + 補 mock
- **估時**：30 分鐘

### [ ] T002.6 修 `team-scores.test.ts`（6 失敗）
- **症狀**：500 vs 200/404
- **推測**：mock storage method 缺
- **估時**：20 分鐘

### [ ] T002.7 修 `team-votes.test.ts`（5 失敗）
- **症狀**：500 vs 200
- **推測**：mock storage method 缺
- **估時**：20 分鐘

### [ ] T002.8 修 `playerChapterActions.test.ts`（3 失敗）
- **症狀**：500
- **推測**：mock storage method 缺
- **估時**：15 分鐘

---

## 🔵 P4 — 訊息文案不匹配（低危險）

### [ ] T002.9 修 `adminRoles.test.ts`（4 失敗）
- **症狀**：訊息不匹配（「使用者不存在」vs「角色不存在」/ 「其他場域的角色」）
- **修法**：對齊新訊息文案 / 補 mock 注入
- **估時**：15 分鐘

### [ ] T002.10 修 `field-memberships.test.ts`（3 失敗）
- **症狀**：訊息不匹配（grantAdmin 流程改）
- **修法**：對齊新流程
- **估時**：15 分鐘

---

## 📊 總覽

| 優先 | 項目數 | 失敗測試數 | 估時 | 性質 |
|------|--------|-----------|------|------|
| P0 | 2 | ~6 | 10 分鐘 | 環境 |
| P1 | 1 | 4 | 15 分鐘 | 紅線（改測試斷言）|
| P2 | 1 | 3 | 30 分鐘 | 真 bug 嫌疑 |
| P3 | 4 | 25 | 85 分鐘 | 測試過時 |
| P4 | 2 | 7 | 30 分鐘 | 文案不匹配 |
| **總計** | **10** | **40** | **~3 小時** | — |

---

## ✅ 已完成

### 2026-05-03 09:15 [Claude]

#### [x] T001 修繕 leaderboard / playerSessions 測試 + player-sessions 404 真 bug
- **影響**：4 失敗 → 6/6 ✅、5 失敗 → 17/17 ✅
- **真 bug 修復**：`server/routes/player-sessions.ts` PATCH progress 兌現原註解承諾「sessionId 不存在 → 404」（之前回 500）
- **commit**：`14eaaea2`
- **詳情**：[tasks/T001-leaderboard-playerSessions.md](tasks/T001-leaderboard-playerSessions.md)
- **logs**：[logs/2026-05-03.md](logs/2026-05-03.md)（多筆 09:00 - 09:15）

### 2026-05-03 09:30 [Claude]

#### [x] T-PROTOCOL 建立雙 AI 協作機制
- **產出**：[codexclaude-dbug.md](../codexclaude-dbug.md) / [AGENTS.md](../AGENTS.md) / `.claude/commands/cc.md`
- **commit**：`020cdef3` + `95a80c82`

### 2026-05-03 09:50 [Claude]

#### [x] T-RESTRUCTURE 重構協作檔為 codex-claude/ 目錄結構
- **目的**：讓未來多次協作不混亂
- **產出**：codex-claude/{PROTOCOL, STATUS, BACKLOG}.md + logs/ + tasks/ + decisions/
- **commit**：`331d5ae4`

### 2026-05-03 10:55 [Claude]

#### [x] T002.1 修 adminContent.test.ts 整檔崩 + [x] T002.2 修 webhook-recur.test.ts 整檔崩
- **修法**：兩檔頂層加 `vi.mock("../db", () => ({ db: { ... } }))` 在 import 路由前
- **影響**：
  - adminContent：0 → 24 tests（20 通過、4 失敗 → 移 T002.1b）
  - webhook-recur：0 → 12 tests（6 通過、6 失敗 → 移 T002.2b）
- **驗證**：smoke 51/51 / TS 零錯誤
- **預估 vs 實際**：估 10 分鐘、實際 ~10 分鐘
- **commit**：（即將）
