# PROTOCOL.md — `/cc` 雙 AI 協作 Protocol

> **少更新**：此檔是規則本體、非狀態
> 改動需在 [decisions/](decisions/) 留 ADR

---

## 🎯 `/cc` 指令對照（雙方一致）

| 指令 | 行為 | 是否動手 |
|------|------|----------|
| `/cc` | 報告當前狀態 + 建議下一步 | ❌ 不動 |
| `/cc 狀態` | 只讀檔報告現況 | ❌ 不動 |
| `/cc 接 P0` ~ `P4` | 接 backlog 對應優先項 | ✅ 動 |
| `/cc 接 <檔名>` | 接指定項目 | ✅ 動 |
| `/cc 檢查 <檔名>` | 跑該測試檔、報告結果 | ❌ 只跑、不修 |
| `/cc 修完` | 跑 smoke + TS + build 全驗證、commit + push | ✅ 動 |
| `/cc claude <args>` | 指定 Claude 接 | ✅ Claude 動 |
| `/cc codex <args>` | 指定 Codex 接 | ✅ Codex 動 |
| `/cc <自由描述>` | 視為任務描述、判斷如何接力 | 視內容 |

斜線 `/` 可省略：`cc 接 P0` 等同 `/cc 接 P0`

---

## 📋 動手 protocol（每次必走）

### Step 1：開始前
1. 讀 [STATUS.md](STATUS.md) 看「目前負責人」
2. 判斷：
   - 是別人 + 上次更新 < 30 分鐘 → **不要動**、回報該換人或等
   - 是自己 / 沒人 / 上次更新 ≥ 30 分鐘 → **可接**
3. 讀 [BACKLOG.md](BACKLOG.md) 對齊任務
4. 改 [STATUS.md](STATUS.md)：
   ```
   目前負責人：Claude 或 Codex
   開始時間：YYYY-MM-DD HH:MM
   進行中任務：<args 描述>
   ```

### Step 2：動手中
- 依 `<args>` 執行任務
- 每步小驗證（測試 / build / smoke）
- 紅線：見下方「⚠️ 紅線」區

### Step 3：完成後 — append 紀錄

寫到 [logs/](logs/)`{今日}.md`（檔名 `YYYY-MM-DD.md`、不存在就建）：

```markdown
### YYYY-MM-DD HH:MM [Claude|Codex]
- **動作**：（做了什麼）
- **檢查**：（跑了什麼確認）
- **結果**：（pass / fail / 錯誤摘要）
- **判斷**：（測試過時 / 真 bug / 環境 / ...）
- **建議下一步**：（給對方的接力提示）
- **檔案**：（動到哪些檔案路徑）
- **任務 ID**（選用）：（連結到 tasks/T00X.md）
```

**紅線**：append-only、不刪舊紀錄、不改別人紀錄。

### Step 4：更新 BACKLOG / STATUS
- [BACKLOG.md](BACKLOG.md)：完成項標 `[x]` 並移到「✅ 已完成」區
- [STATUS.md](STATUS.md)：最後一行「上次更新」打卡

### Step 5：commit + push（如有改檔）

commit message 格式：
```
<type>(<scope>): <一句話>

<詳細變動>

紀錄：codex-claude/logs/YYYY-MM-DD.md (角色 HH:MM)
```

`<type>`：fix / feat / refactor / docs / chore / test
`<scope>`：test / route / lib / page / 等

push 到 main：`git push origin HEAD:main`

### Step 6：回報使用者

簡短四項：
1. 做了什麼
2. 結果（測試 pass / fail / smoke）
3. backlog 進度
4. 建議下一步（讓使用者決定再 /cc 還是換人）

---

## ⚠️ 紅線（觸犯即 STOP）

### 商業 / 程式碼
- ❌ **battle-clans POST 改回 200** — Squad 系統取代、410 Gone 是設計
- ❌ 動 schema（只能 ADD COLUMN、禁 DROP）
- ❌ 單檔 > 800 行 / 函式 > 50 行 / 巢狀 > 3 層
- ❌ console.log 留正式版
- ❌ hardcoded 密碼 / API key

### 部署
- ❌ **沒明確說「部署」不可 deploy 到生產**
- ❌ scp 檔案到伺服器、走 git push
- ❌ 跳過 hooks（--no-verify）

### 協作
- ❌ **刪 / 改別人在 logs/ 的紀錄**
- ❌ Mock 掉真實 bug（看到「應 404 但實際 500」要先判斷）
- ❌ 同時間多人動同檔（30 分鐘鎖期）
- ❌ commit 不寫紀錄連結

### 對話
- ✅ 繁體中文
- ✅ 簡潔、先做事再解釋
- ✅ commit message 用繁中

---

## 🤝 衝突避免

### 30 分鐘鎖期
- STATUS.md 顯示「目前負責人」+「上次更新」
- 上次更新 < 30 分鐘 = 別人持鎖中
- override 必須在 logs/ 寫明理由

### Append-only logs/
- 同日紀錄 append 到 `logs/{date}.md`
- 不同 AI 同時寫不同段、git 自動合併
- 真撞行衝突 → 用 git 解、保留雙方紀錄

### 多任務並行
- 兩個 AI 可做不同 backlog 項
- STATUS.md 用「進行中任務 1 / 任務 2」分行
- 完成各自 append、不互相阻塞

---

## 📂 檔案職責

| 檔 | 性質 | 更新頻率 |
|----|------|----------|
| [PROTOCOL.md](PROTOCOL.md) | 規則本體 | 極少（決策需 ADR）|
| [STATUS.md](STATUS.md) | 動態狀態 | 每次動手 overwrite |
| [BACKLOG.md](BACKLOG.md) | 任務清單 | 完成 / 新發現時改 |
| [logs/](logs/) | 紀錄串流 | 每次動手 append（日切）|
| [tasks/](tasks/) | 任務深度檔 | 大型任務時建立 |
| [decisions/](decisions/) | 協作決策 ADR | 改 protocol / 結構時 |

---

## 🔗 索引導航

- [codexclaude-dbug.md](../codexclaude-dbug.md) — 主索引（root level）
- [STATUS.md](STATUS.md) — 當前狀態
- [BACKLOG.md](BACKLOG.md) — 任務清單
- [logs/](logs/) — 歷程紀錄
- [tasks/](tasks/) — 任務深度檔
- [decisions/](decisions/) — 協作決策
