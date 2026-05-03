# 🤝 CodexClaude Debug — 主索引

> 雙 AI（Claude / Codex）協作除錯紀錄
> 此檔為**入口**、所有細節在 [codex-claude/](codex-claude/)

---

## ⚡ 最快速：`cc` 指令

雙方共用、語意一致：

| 指令 | 行為 | 動手？ |
|------|------|--------|
| `cc` 或 `cc 狀態` | 報告當前狀態（讀 STATUS） | ❌ |
| `cc 接 P0` ~ `P4` | 接 backlog 對應優先項 | ✅ |
| `cc 接 <檔名>` | 接指定項目 | ✅ |
| `cc 檢查 <檔名>` | 跑該測試檔報結果（不修） | ❌ |
| `cc 修完` | smoke + TS + build 全驗證 + commit + push | ✅ |
| `cc claude <args>` / `cc codex <args>` | 指定哪邊接 | ✅ |
| `cc <自由描述>` | 視為任務描述 | 視內容 |

> ⚠️ **不要打 `/cc`（前面加斜線）**：Claude Code CLI 會攔截為 slash command（"Unknown command"）、訊息根本送不到 AI
> 直接打 `cc xxx`（純文字、無斜線）— Claude 與 Codex 都認得

完整 protocol → [codex-claude/PROTOCOL.md](codex-claude/PROTOCOL.md)

---

## 📂 檔案地圖

```
專案根/
├── codexclaude-dbug.md            ← 你正在讀（主索引）
├── AGENTS.md                       ← Codex CLI 對應 protocol
└── codex-claude/                   ← 協作詳細檔
    ├── PROTOCOL.md                 ← 規則本體（少改、改需 ADR）
    ├── STATUS.md                   ← 當前狀態（最常更新）
    ├── BACKLOG.md                  ← 任務清單
    ├── logs/                       ← append-only 紀錄
    │   └── YYYY-MM-DD.md          ← 日切
    ├── tasks/                      ← 任務深度檔
    │   └── TXXX-<title>.md
    └── decisions/                  ← 協作決策 ADR
        └── DXXX-<title>.md
```

---

## 📍 雙方第一次讀順序

### Claude / Codex 啟動時必讀
1. **本檔（codexclaude-dbug.md）** — 1 分鐘看完整體
2. **[codex-claude/STATUS.md](codex-claude/STATUS.md)** — 看當前誰在做什麼
3. **[codex-claude/BACKLOG.md](codex-claude/BACKLOG.md)** — 看待處理項
4. **[codex-claude/PROTOCOL.md](codex-claude/PROTOCOL.md)** — 規則細節（首次讀、之後查）

### 動手前（**必讀全部進度資料**）
1. 讀 [STATUS.md](codex-claude/STATUS.md) 看負責人 + 系統健康
2. 讀 [BACKLOG.md](codex-claude/BACKLOG.md) 對齊任務
3. 讀 [logs/{今日}.md](codex-claude/logs/) 看最近 3-5 筆動作
4. 讀對應 [tasks/](codex-claude/tasks/) 細節（如有）
5. 跑即時健康檢查：`git log --oneline -5 && git status -s && smoke test`
6. 改 STATUS 搶鎖
7. **給使用者四項進度快報**（系統健康 / 當前進度 / 新動作 / 預估）後才動手

### 動手後
1. append 到 [logs/{今日}.md](codex-claude/logs/)
2. 更新 BACKLOG（標 [x]）
3. 改 STATUS「上次更新」
4. commit + push（含紀錄連結）
5. 回報使用者

---

## 🚨 三大紅線（完整版見 [PROTOCOL.md](codex-claude/PROTOCOL.md#-紅線觸犯即-stop)）

1. ❌ **不刪 / 不改別人在 logs/ 的紀錄**（append-only）
2. ❌ **不要違反專案紅線**（CLAUDE.md：battle-clans 410 / schema 只新增 / 沒說「部署」不 deploy）
3. ❌ **同時間多人動同檔**（30 分鐘鎖期）

---

## 📊 快速狀態速查

最新狀態 → [codex-claude/STATUS.md](codex-claude/STATUS.md)
最新紀錄 → [codex-claude/logs/2026-05-03.md](codex-claude/logs/2026-05-03.md)
任務清單 → [codex-claude/BACKLOG.md](codex-claude/BACKLOG.md)

---

## 🎬 範例：使用者打 `/cc 接 P0`

1. **Claude / Codex 讀檔**：本檔 → STATUS → BACKLOG
2. **看 STATUS**：目前負責人 = ？、上次更新 ≥ 30 分鐘前 → 可接
3. **改 STATUS**：負責人 = 自己 / 開始時間 / 進行中 = P0
4. **看 BACKLOG P0**：T002.1 + T002.2 修 db mock
5. **動手**：依 [tasks/T002](codex-claude/tasks/T002-test-suite-cleanup.md) 樣板
6. **驗證**：單檔測試 / TS / smoke
7. **append 紀錄**：寫到 [logs/2026-05-03.md](codex-claude/logs/2026-05-03.md)
8. **更新 BACKLOG**：標 [x] + 移到「✅ 已完成」
9. **commit + push**：commit message 含「紀錄：codex-claude/logs/2026-05-03.md」
10. **回報**：「P0 完成、X/X 測試綠、smoke 51/51 維持」

---

## 🔧 環境快速速查

| 項目 | 值 |
|------|-----|
| 專案根 | `/Users/hung-macmini/projects/數位遊戲平台/.claude/worktrees/priceless-mestorf-2e034e` |
| 主分支 | `main` |
| 生產 | [https://game.homi.cc](https://game.homi.cc) |
| 測試 | `npm run test:run -- <path>` |
| smoke | `node scripts/smoke-test-scenarios.mjs` |
| TS check | `npx tsc --noEmit` |
| build | `npm run build` |

完整環境 / 紅線細節 → [AGENTS.md](AGENTS.md) / [CLAUDE.md](CLAUDE.md)

---

## 📚 跟專案文件的關係

| 文件 | 給誰 | 範圍 |
|------|------|------|
| **本檔（codexclaude-dbug.md）**| 雙 AI | 協作元數據主索引 |
| [AGENTS.md](AGENTS.md) | Codex / 其他 agent | 協作 protocol（與本檔重疊、給 agent CLI 慣例讀）|
| [CLAUDE.md](CLAUDE.md) | Claude（本機）| 專案級指引 |
| [docs/](docs/) | 人 + AI | 專案技術文件 |
| [codex-claude/](codex-claude/) | 雙 AI | 協作詳細紀錄 |

兩個系統獨立但互通：協作元數據在 `codex-claude/`、專案技術文件在 `docs/`。
