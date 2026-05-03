# 📚 文件索引

> 賈村數位遊戲平台 — 文件導覽
> 最後更新：2026-05-02

本目錄是專案的**唯一文件來源**。需要找任何資訊請從這裡進入。

---

## 🚀 快速導航

| 需要找... | 去這裡 |
|----------|--------|
| 「這個專案在做什麼？」 | [架構總覽](architecture/overview.md) |
| 「為什麼用 Firebase / Neon / Squad？」 | [decisions/](decisions/) ADR 紀錄 |
| 「Squad 系統怎麼設計的？」 | [domains/squad-system.md](domains/squad-system.md) |
| 「如何部署？」 | [runbooks/deploy.md](runbooks/deploy.md) |
| 「最近改了什麼？」 | [CHANGELOG.md](CHANGELOG.md) |
| 「DB schema 變動怎麼辦？」 | [runbooks/db-migration.md](runbooks/db-migration.md) |
| 「過去的某個變動細節」 | [changes/](changes/) 變動紀錄 |
| 「過時 / 完成的舊計畫」 | [archive/](archive/) |

---

## 📖 目錄結構與職責

### 1. [`architecture/`](architecture/) — 系統架構
**寫什麼**：系統的「骨架」級資訊，穩定少改。
- [overview.md](architecture/overview.md) — 整體架構圖、技術棧、模組關係
- [data-model.md](architecture/data-model.md) — 主要 DB schema 解說
- [auth-flow.md](architecture/auth-flow.md) — 認證流程（Firebase + Admin JWT）
- [deployment.md](architecture/deployment.md) — Coolify / Docker / Nginx 部署架構

### 2. [`domains/`](domains/) — 業務領域（持續更新的活文件）
**寫什麼**：單一業務領域的 source of truth — 設計、API、Schema、UI 流程整合。
- [squad-system.md](domains/squad-system.md) — Squad 隊伍系統（取代 teams/battle_clans）
- [battle-system.md](domains/battle-system.md) — 水彈對戰
- [photo-system.md](domains/photo-system.md) — 照片元件與 Cloudinary
- [pwa.md](domains/pwa.md) — PWA / Service Worker / 離線
- [multi-field.md](domains/multi-field.md) — 多場域隔離與 SaaS 架構
- [host-screen-components.md](domains/host-screen-components.md) — 13 個大螢幕互動元件 × 5 大市場對照

### 3. [`decisions/`](decisions/) — ADR（架構決策紀錄）
**寫什麼**：影響 ≥ 3 模組的技術決策。**寫完不改**，只能新增「Superseded by XXX」。
- [0001-firebase-auth.md](decisions/0001-firebase-auth.md) — 為什麼用 Firebase Auth
- [0002-neon-postgres.md](decisions/0002-neon-postgres.md) — 為什麼用 Neon PostgreSQL
- [0003-squad-unification.md](decisions/0003-squad-unification.md) — 為什麼把三套組隊統一成 Squad

### 4. [`runbooks/`](runbooks/) — 維運手冊
**寫什麼**：步驟式操作指南，命令式（複製貼上可執行），含失敗回滾。
- [deploy.md](runbooks/deploy.md) — 標準部署流程
- [db-migration.md](runbooks/db-migration.md) — DB schema 變動操作
- [incident-response.md](runbooks/incident-response.md) — 故障應對手冊（待建）
- [backup-restore.md](runbooks/backup-restore.md) — 備份與還原（待建）

### 5. [`changes/`](changes/) — 大型變動紀錄
**寫什麼**：每個大型 feature / refactor 一份檔，含背景、實作、驗證、回顧。**寫完不改**。
- [README.md](changes/README.md) — 變動紀錄索引
- 命名規則：`{YYYY-MM-DD}-{topic}.md`

### 6. [`archive/`](archive/) — 過時 / 已完成
**寫什麼**：已完成的計畫、過時的評估文件。**只進不出**，避免污染主目錄。

### 根層級
- [CHANGELOG.md](CHANGELOG.md) — 版本紀錄（每版 ≤ 50 行，連結到 changes/）

---

## ✍️ 文件規範（撰寫規則）

### 行數上限
| 類型 | 上限 | 超過時 |
|------|------|--------|
| `CLAUDE.md`（主索引）| 200 行 | 內容拆到 docs/ |
| `domains/{topic}.md` | 800 行 | 拆子檔（如 `squad-system/elo.md`）|
| `decisions/{N}.md` | 200 行 | 不該超過 — 決策該精簡 |
| `runbooks/{op}.md` | 300 行 | 拆子流程 |
| `changes/{date}.md` | 500 行 | 拆子主題 |

### 命名規則
- ADR：`{4位數編號}-{topic}.md`（編號永不重用）
- 變動紀錄：`{YYYY-MM-DD}-{topic}.md`
- 領域文件：`{kebab-case}.md`

### 連結規則
所有文件互相連結用相對路徑（`../decisions/0003-*.md`），方便 IDE 預覽與 GitHub 渲染。

---

## 🔄 紀錄節奏

| 觸發點 | 動作 |
|--------|------|
| 大型 feature 啟動 | `changes/{date}-{topic}.md` 開新檔（規劃階段） |
| Feature 完成 | 補「實作回顧」+ 更新 `CHANGELOG.md` |
| 重要決策（影響 ≥ 3 模組） | `decisions/{N}-{topic}.md` 寫 ADR |
| Schema 變動 | `runbooks/db-migration.md` 加紀錄 |
| 部署 | `CHANGELOG.md` 加版本 commit |
| 月底維護 | 6 個月以上的 changes/ 搬 archive/ |

---

## 🔗 與全域 Claude 規範的關係

```
~/.claude/CLAUDE.md（全域）— 通用規則：語言、安全、行數、Git 工作流
            ↓
本專案 /CLAUDE.md（專案）— 專案特殊資訊：技術棧、生產位址、紅線、必知概念
            ↓
本目錄 docs/ — 細節文件
```

**衝突原則**：專案 > 全域。專案沒寫的依全域。
