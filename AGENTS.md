# AGENTS.md — Codex / Claude 雙 AI 協作說明

> 此檔給 Codex CLI / 其他 agent 讀
> Claude 端請看 `CLAUDE.md` + `.claude/commands/cc.md`

---

## 🚀 TL;DR — 給 Codex 的最快上手（30 秒看完）

**你在這個專案的角色**：與 Claude 雙 AI 協作除錯、共用 `codex-claude/` 紀錄機制。

**使用者打 `cc <args>`（純文字、無斜線）時**，你必須做：

1. **讀 5 個檔**：
   - [`codex-claude/STATUS.md`](codex-claude/STATUS.md) — 看誰在做什麼
   - [`codex-claude/BACKLOG.md`](codex-claude/BACKLOG.md) — 看待處理任務
   - [`codex-claude/logs/{今日YYYY-MM-DD}.md`](codex-claude/logs/) — 看今日做過什麼
   - [`codex-claude/tasks/`](codex-claude/tasks/) — 進行中任務（如 STATUS 有指）
   - [`codex-claude/PROTOCOL.md`](codex-claude/PROTOCOL.md) — 完整 protocol（首次讀）

2. **跑即時健康檢查**：
   ```bash
   git log --oneline -5
   git status -s
   node scripts/smoke-test-scenarios.mjs | tail -3
   ```

3. **判斷 30 分鐘鎖**：
   - 看 STATUS「目前負責人」+「上次更新」
   - 別人 < 30 分鐘 → 不動、回報該換人或等
   - 自己 / 沒人 / ≥ 30 分鐘 → 可接

4. **搶鎖**：改 STATUS 標自己、開始時間、進行中任務

5. **給使用者四項進度快報**（必做）：
   - 系統健康（smoke / TS / build 數字）
   - 當前進度（負責人 / 上次動作 / backlog 剩多少）
   - 新動作（你打算做什麼）
   - 預估（估時 + 影響範圍）

6. **動手** + **append 紀錄**到 `codex-claude/logs/{今日}.md`（**append-only、不刪舊紀錄**）

7. **commit + push**：commit message 含「紀錄：codex-claude/logs/YYYY-MM-DD.md (Codex HH:MM)」

8. **回報使用者**：做了什麼 / 結果 / backlog 進度 / 下一步

**🚨 三大紅線**：
- ❌ 不刪 / 不改別人在 logs/ 的紀錄（append-only）
- ❌ 不違反專案紅線（battle-clans 410 / schema 只新增 / 不擅自部署）
- ❌ 不要打 `/cc`（CLI 會擋）— 純文字 `cc xxx`

完整細節 → [codex-claude/PROTOCOL.md](codex-claude/PROTOCOL.md)
協作主索引 → [codexclaude-dbug.md](codexclaude-dbug.md)

---

## 📂 重要：協作機制已重構（2026-05-03 09:50）

從單檔改成目錄結構：

```
codexclaude-dbug.md             ← 主索引（雙方第一個讀）
codex-claude/
├── PROTOCOL.md                 ← 規則本體（細節在這）
├── STATUS.md                   ← 當前狀態
├── BACKLOG.md                  ← 任務清單
├── logs/YYYY-MM-DD.md          ← append-only 紀錄
├── tasks/TXXX-<title>.md       ← 任務深度檔
└── decisions/DXXX-<title>.md   ← 協作 ADR
```

**Codex 第一次讀順序**：
1. [codexclaude-dbug.md](codexclaude-dbug.md) — 主索引（1 分鐘看完）
2. [codex-claude/STATUS.md](codex-claude/STATUS.md) — 當前狀態
3. [codex-claude/BACKLOG.md](codex-claude/BACKLOG.md) — 任務清單
4. [codex-claude/PROTOCOL.md](codex-claude/PROTOCOL.md) — 規則細節

---

## 🎯 主要協作機制

當使用者打 **`cc <args>`**（純文字、無斜線）時，依 [codex-claude/PROTOCOL.md](codex-claude/PROTOCOL.md) 執行。

⚠️ **不要打 `cc`**：Claude Code CLI 會攔截為 slash command（"Unknown command"）、訊息送不到 AI

### `cc` 語意（雙方一致）

| 輸入 | 行為 |
|------|------|
| `cc` | 報告當前狀態 + 建議下一步（不動手） |
| `cc 接 P0` / `接 P1` | 接 backlog 對應優先項 |
| `cc 接 <檔名>` | 接指定項目 |
| `cc 檢查 <檔名>` | 跑該測試檔、報告結果（不修） |
| `cc 修完` | 跑 smoke + TS + build 全驗證、commit + push |
| `cc 狀態` | 只讀檔、報告現況、不動手 |
| `cc <自由描述>` | 視為任務描述、判斷如何接力 |

### 你（Codex）必須做的事

#### 1. 開始前
- 讀 `codexclaude-dbug.md` **全部內容**
- 看「📊 當前狀態」目前負責人
  - 是別人（且上次更新 < 30 分鐘）→ **不要動**、回報使用者該換人或等
  - 是自己 / 沒人 / 上次更新 ≥ 30 分鐘 → 可接
- 把「📊 當前狀態」改：
  ```
  目前負責人：Codex
  開始時間：YYYY-MM-DD HH:MM
  進行中任務：<args 描述>
  上次更新：YYYY-MM-DD HH:MM [Codex]
  ```

#### 2. 動手中
- 依 `<args>` 執行任務
- 每步小驗證（測試 / build / smoke）

#### 3. 完成後 — append 紀錄（紅線：不刪舊紀錄）
寫到 [codex-claude/logs/{今日}.md](codex-claude/logs/)（檔名 `YYYY-MM-DD.md`、不存在就建）：
```markdown
### YYYY-MM-DD HH:MM [Codex]
- **動作**：（做了什麼）
- **檢查**：（跑了什麼確認）
- **結果**：（pass / fail / 錯誤摘要）
- **判斷**：（測試過時 / 真 bug / 環境 / ...）
- **建議下一步**：（給對方 Claude 的接力提示）
- **檔案**：（動到哪些檔案路徑）
- **任務 ID**（選用）：（連結到 codex-claude/tasks/TXXX.md）
```

#### 4. 更新 [BACKLOG.md](codex-claude/BACKLOG.md) / [STATUS.md](codex-claude/STATUS.md)
- BACKLOG：完成項標 `[x]` 並移到「✅ 已完成」區
- STATUS：「上次更新」打卡

#### 5. commit + push（如有改檔）
commit message 格式：
```
<type>(<scope>): <檔名> — <一句話>

<詳細變動>

紀錄：codex-claude/logs/YYYY-MM-DD.md (Codex HH:MM)
```

push 到 main：`git push origin HEAD:main`

#### 6. 回報使用者
- 做了什麼
- 結果（測試 / smoke）
- backlog 進度
- 建議下一步

---

## 🚨 紅線（必看 CLAUDE.md 完整版、這是摘要）

### 程式碼 / 商業
- ❌ **不要把 battle-clans POST 改回 200** — Squad 系統已取代、POST 凍結為 410 Gone（紅線設計）
- ❌ 不動 schema（只 ADD COLUMN、禁 DROP TABLE / DROP COLUMN）
- ❌ 程式碼結構：單檔 ≤ 800 行、函式 ≤ 50 行、巢狀 ≤ 3 層
- ❌ 不留 console.log 在正式版
- ❌ 不寫 hardcoded 密碼 / API key

### 部署
- ❌ **沒明確說「部署」不可 deploy 到生產** — 使用者要明確下令
- ❌ 不 scp 檔案到伺服器、走 git push
- ❌ 部署流程：使用者說「部署」→ SSH → `git pull` → `docker compose up -d --build`

### 協作
- ❌ **不刪 / 不改別人在 codexclaude-dbug.md 的紀錄**
- ❌ 不要 mock 掉真實 bug（看到「應 404 但實際 500」先判斷是真 bug 還是測試過時）
- ❌ 同時間只能有一個負責人（30 分鐘鎖期）

### 對話
- ✅ 使用繁體中文
- ✅ 簡潔、先做事再解釋
- ✅ 程式碼註解用繁體中文（語法保英文）

---

## 🛠 環境快速速查

| 項目 | 值 |
|------|-----|
| 專案根 | `/Users/hung-macmini/projects/數位遊戲平台/.claude/worktrees/priceless-mestorf-2e034e` |
| 主分支 | `main` |
| 生產 | [https://game.homi.cc](https://game.homi.cc) |
| 生產 SSH | `root@172.233.89.147` |
| 部署目錄 | `/www/wwwroot/game.homi.cc` |
| 本地 dev port | 3333 |
| 本地 DB | Docker `gameplatform-postgres` (port 5437) |
| 測試指令 | `npm run test:run -- <path>` |
| smoke | `node scripts/smoke-test-scenarios.mjs` |
| TS check | `npx tsc --noEmit` |
| build | `npm run build` |

---

## 📚 重要文件導航

| 找什麼 | 去哪 |
|--------|------|
| **協作紀錄** | [codexclaude-dbug.md](codexclaude-dbug.md) |
| 專案規則 | [CLAUDE.md](CLAUDE.md) |
| 系統架構 | `docs/architecture/` |
| 業務領域 | `docs/domains/` |
| ADR（決策）| `docs/decisions/` |
| 維運操作 | `docs/runbooks/` |
| 變動紀錄 | `docs/changes/` |
| 版本紀錄 | `docs/CHANGELOG.md` |

---

## 🎬 範例：使用者說 `cc 接 P0`

1. 你讀 `codexclaude-dbug.md`
2. 看到 P0 是 `adminContent.test.ts` + `webhook-recur.test.ts` 的 DATABASE_URL 問題
3. 看到目前負責人是 Claude / 上次更新 30 分鐘前 → 可以接
4. 改「📊 當前狀態」：
   ```
   目前負責人：Codex
   開始時間：2026-05-03 09:45
   進行中任務：P0 — 修 adminContent + webhook-recur 環境問題
   ```
5. 修 `server/__tests__/adminContent.test.ts`：加 `vi.mock("../db", () => ({ db: {} }))`
6. 跑 `npm run test:run -- server/__tests__/adminContent.test.ts` → 確認綠
7. 同樣修 webhook-recur.test.ts → 跑單檔
8. 跑 smoke 確認沒 regression
9. append 紀錄到「🔄 紀錄串流」
10. 「📋 Backlog」標 P0 兩項 [x]、移到「✅ 已完成」
11. `git add ... && git commit -m "fix(test): adminContent + webhook-recur — mock db ..."` + push
12. 回報使用者：「P0 完成、X/X 測試綠、smoke 51/51 維持、可接 P1」

---

## 💡 疑問處理

- 不確定路由架構 → 看 `docs/decisions/`（ADR）
- 不確定要修真 bug 還是改測試 → 在紀錄串流寫「需要使用者裁示」+ 等
- 不確定影響範圍 → 跑 smoke + TS + build
- 同名 mock 多個地方用 → grep + 看哪個是新架構
