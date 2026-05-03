# D001 — 協作檔目錄結構決策

> **日期**：2026-05-03
> **狀態**：採用中
> **影響**：所有協作紀錄組織方式

---

## 背景

最初版（commit `020cdef3`）把所有協作內容塞在 `codexclaude-dbug.md` 一份檔（213 行）：
- 協作規則
- 當前狀態
- Backlog
- 紀錄串流
- Codex 上手指南

問題：
1. **單檔會炸**：累積幾天後紀錄串流會超過 1000 行、每次 append 都要 read 整份
2. **多更新衝突**：狀態更新 vs 紀錄 append 要改同一份檔
3. **不利索引**：找 T001 任務、要 grep 一個大檔
4. **新人上手慢**：只有「規則」「紀錄」混在一起、看不出哪個是動態哪個是靜態

## 選項

### 方案 A：保留單檔
- 優點：簡單、一個檔好找
- 缺點：上述四個問題

### 方案 B：拆 5+ 子檔 + 主索引
- 優點：職責分明、可擴展、容易並行
- 缺點：多檔協同、需學習目錄結構

### 方案 C：扁平多檔（不分目錄）
- 優點：拆檔但無目錄層次
- 缺點：根目錄會塞太多協作檔、跟專案檔混雜

## 決定

**採方案 B：`codex-claude/` 目錄 + 主索引保留 `codexclaude-dbug.md` 在 root**

理由：
1. **職責分明**：規則 / 狀態 / 任務 / 紀錄 各司其職
2. **可擴展**：未來協作多了不會炸
3. **主索引留 root**：`codexclaude-dbug.md` 仍是雙方第一個讀的檔、向後相容
4. **目錄分類**：
   - `logs/` 日切、append-only
   - `tasks/` 主題、跨日累積
   - `decisions/` 協作決策（ADR）

## 結構

```
codexclaude-dbug.md                # 主索引（root）
codex-claude/
├── PROTOCOL.md                    # 規則本體（少改）
├── STATUS.md                      # 動態狀態（每次動手 overwrite）
├── BACKLOG.md                     # 任務清單
├── logs/                          # append-only 紀錄
│   └── YYYY-MM-DD.md             # 日切
├── tasks/                         # 任務深度檔
│   └── TXXX-<title>.md           # T001, T002, ...
└── decisions/                     # 協作決策 ADR
    └── DXXX-<title>.md           # D001, D002, ...
```

## 影響

### 給 Claude / Codex
- 動手前讀順序：`codexclaude-dbug.md`（主索引）→ `STATUS.md` → `BACKLOG.md`
- 紀錄寫到：`codex-claude/logs/{今日}.md`
- 大型任務拉獨立檔到 `tasks/`
- 改 protocol 寫 ADR 到 `decisions/`

### 給人
- 看當前狀態：直接打開 `STATUS.md`
- 看歷程：翻 `logs/` 對應日期
- 看任務細節：找 `tasks/T0XX.md`
- 看為什麼這樣設計：找 `decisions/D0XX.md`

### 紅線（同 PROTOCOL.md）
- ❌ 刪舊 logs/
- ❌ 改別人的紀錄
- ❌ 不寫紀錄就 commit

## 後續可能變動

- **logs/ 太多**：6 個月後可考慮按月歸檔（`logs/2026-05/`）
- **tasks/ 太多**：可分類別（`tasks/test/` `tasks/feat/`）
- **多分支協作**：可加 `branches/` 區分（暫不需）

## 命名規則

| 類型 | 格式 | 範例 |
|------|------|------|
| logs | `YYYY-MM-DD.md` | `2026-05-03.md` |
| tasks | `TXXX-<kebab-title>.md` | `T001-leaderboard-playerSessions.md` |
| decisions | `DXXX-<kebab-title>.md` | `D001-folder-structure.md` |

ID 編號連續、不重用、不跳號。

## 相關

- [PROTOCOL.md](../PROTOCOL.md)
- [codexclaude-dbug.md](../../codexclaude-dbug.md)
