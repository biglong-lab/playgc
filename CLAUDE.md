# 賈村數位遊戲平台 — Claude 工作指南

> 專案層 Claude 規範，與 `~/.claude/CLAUDE.md`（全域）搭配使用。
> 衝突時專案優先。最後更新：2026-05-02

---

## ⚡ 必知（不知道會出事）

### 系統定位
- **產品**：金門場域型互動遊戲 SaaS 平台（賈村競技場、後浦小鎮等多場域）
- **使用者**：玩家端 + 場域管理員（admin）+ 平台管理員（super_admin）
- **生產**：[https://game.homi.cc](https://game.homi.cc) — Linode 172.233.89.147

### 技術棧
- **前端**：React 18 + Vite + TypeScript + wouter + TanStack Query + Tailwind + Radix
- **後端**：Express + Drizzle ORM + WebSocket
- **DB**：PostgreSQL 16（生產：本地 Docker `gamehomicc-db-1`）
- **Auth**：Firebase Auth（玩家）+ Admin JWT（後台）
- **儲存**：Cloudinary（圖片）
- **部署**：Docker Compose + Nginx + Coolify（自動 webhook）

### 生產資訊
- **SSH**：`ssh root@172.233.89.147`（已設 key）
- **部署目錄**：`/www/wwwroot/game.homi.cc`
- **更新流程**：`git pull origin main && docker compose -f docker-compose.prod.yml up -d --build`
- **Nginx 設定**：`/www/server/panel/vhost/nginx/game.homi.cc.conf`
- **本地開發 port**：3333（避開 5050/5060/3001 被佔用）

---

## 🚨 絕對紅線

1. **❌ 禁止自動部署** — 只有使用者明確說「部署」才執行
2. **❌ 禁止 scp 傳檔** — 一律走 git push
3. **❌ 禁止直連生產 DB 開發** — 用本地 Docker `gameplatform-postgres` (port 5437)
4. **❌ Schema 只新增不刪除** — 禁 DROP TABLE / DROP COLUMN（生產資料保護）
5. **❌ 禁止 console.log 留正式版**
6. **❌ 禁止密碼/API key 寫進程式碼** — 用環境變數
7. **❌ Squad 系統已取代 battle_clans** — 不可再加 battle_clans 寫入點
8. **❌ 程式碼結構限制**：單檔 ≤ 800 行 / 函式 ≤ 50 行 / 巢狀 ≤ 3 層
9. **❌ Loop 模式禁止連續 5 輪不做接地驗證** — 每 5 輪必須打開 admin editor 確認新元件可被選用 + 跑真實 session 流程；產出 5 個元件後若 admin editor 看不到 = 立即停止 loop（[ADR-0017](docs/decisions/0017-loop-mode-safeguards.md)）
10. **❌ 禁止用單元測試替代 e2e** — 原指令要 e2e 就必須用 Playwright/真瀏覽器跑「admin 建場 → 玩家加入 → 互動 → 持久化」完整流程；Vitest mock 通過 ≠ e2e 通過
11. **❌ 新元件必須對應五大商業情境之一** — 公部門/私部門/活動/空間/交誼；對應不到（如鳥居/霜晶/楓葉等詩意主題）禁止建立
12. **❌ 禁止把模糊詞彙當作明確指令** — 「完整完成」「全套」「優化」必先確認範圍才動手；不確定就問，不要猜

---

## 🧠 必知概念

### Squad 系統（2026-05-02 一次到位）
```
Squad = 永久身份（隊伍是誰、有誰、累積什麼）→ docs/domains/squad-system.md
teams = 一場遊戲執行容器（teams.squadId 關聯 Squad）
battle_registrations = 一次水彈報名（squad_id 關聯 Squad）
battle_clans = 寫入凍結（POST 410 Gone），舊資料只讀保留
```
細節 → [decisions/0003-squad-unification.md](docs/decisions/0003-squad-unification.md)

### 多場域隔離
- 每個遊戲屬於一個 `fieldId`，玩家透過 URL `/f/:fieldCode/...` 進入
- 玩家可跨場域，但戰績與會員身份依場域獨立
- 細節 → [domains/multi-field.md](docs/domains/multi-field.md)

### Session 完成偵測（多人遊戲）
- 隊伍解散 / 玩家離開 → `gameSessions.status` 仍是 "playing"
- `getSessionsByUser` 動態覆寫為 "completed"（讀時計算，不寫回 DB）
- 不影響其他還在玩同一 session 的玩家

### PWA 機制
- `start_url` 帶 `?launch=pwa` flag
- 三層版本檢查（60s + visibilitychange + cache hash）
- 強制 reload via `controllerchange`
- 細節 → [domains/pwa.md](docs/domains/pwa.md)

---

## 📝 工作流程

### 開發前（每次必做）
1. `git pull origin main`
2. 確認本地 `.env` 連 dev DB（不是生產）
3. 啟動本地 server 驗證

### 開發中
- 頻繁 commit（本地）
- Schema 變更只 ADD COLUMN
- 大型 feature 先在 `docs/changes/{date}-{topic}.md` 規劃

### 推送前
1. 本地完整測試通過
2. 無 console.log、無硬編碼密碼
3. `npx tsc --noEmit` 通過
4. `git push origin main`（CI 跑檢查，不會自動部署）

### 部署
- 使用者明確說「部署」才執行
- 流程：SSH → `git pull` → `docker compose up -d --build`
- 部署後驗證 + 更新 `CHANGELOG.md`

---

## 📚 文件導航

| 找什麼 | 去哪 |
|--------|------|
| 系統架構 | [docs/architecture/](docs/architecture/) |
| 業務領域細節 | [docs/domains/](docs/domains/) |
| 為什麼這樣設計 | [docs/decisions/](docs/decisions/) |
| 維運操作 | [docs/runbooks/](docs/runbooks/) |
| 大型變動紀錄 | [docs/changes/](docs/changes/) |
| 版本紀錄 | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| 過時 / 完成的舊計畫 | [docs/archive/](docs/archive/) |
| 文件機制與規則 | [docs/README.md](docs/README.md) |

---

## 🤝 對話規則

- **語言**：全程繁體中文
- **風格**：簡潔，先做事再解釋
- **不要**：「您要我...嗎？」直接做
- **commit 訊息**：繁體中文 + Conventional Commits
- **註解**：繁體中文（程式碼語法保持英文）

---

## 🎯 確認回應

> 開始任何任務前，回應：
> 「✅ 已確認 CLAUDE.md 規則」
