# Runbook: 標準部署流程

> 觸發：使用者明確說「部署」才執行
> 估時：3-5 分鐘
> 風險：低（容器健康檢查、可立即回滾）

---

## 前置檢查

```bash
# 確認本地與 origin/main 同步
git status
git log --oneline -3

# 確認沒有未推送變更
git push origin claude/<branch>:main 2>&1
```

---

## 部署步驟

```bash
# 1. SSH 到生產
ssh root@172.233.89.147

# 2. 進入專案目錄
cd /www/wwwroot/game.homi.cc

# 3. 拉取最新程式碼
git pull origin main

# 4. 注入 GIT_SHA 並重新 build + restart 容器（下方說明注意）
export GIT_SHA=$(git rev-parse HEAD)
docker compose -f docker-compose.prod.yml up -d --build app
```

### ⚠️ 必須帶 `GIT_SHA` 的原因（2026-05-07 加固）

`GIT_SHA` 是 docker build arg、會被注入兩個地方：
1. **client bundle**（`VITE_APP_COMMIT`）— 前端版本檢查（AppUpdateChecker）
2. **server runtime**（`process.env.GIT_SHA`）— `/api/version` 回的 commit

**沒帶 `GIT_SHA` → server 回 `commit: "unknown"` → AppUpdateChecker 失效**（client 看到 "unknown" 就 return、不檢查更新），玩家無法收到「有新版本可用」通知。

`docker-compose.prod.yml` 設了 `${GIT_SHA:-unknown}` fallback、所以**忘記 export 不會 build 失敗，但會默默損壞版本檢查**。每次都要記得 export。

### 標準單行版本（從本地直接執行）— **推薦**

```bash
ssh root@172.233.89.147 "cd /www/wwwroot/game.homi.cc \
  && git pull origin main \
  && export GIT_SHA=\$(git rev-parse HEAD) \
  && docker compose -f docker-compose.prod.yml up -d --build app"
```

注意：
- `\$(git rev-parse HEAD)` 的 `\$` 跳脫，讓 SSH session 內才執行（否則本地 shell 先 expand 會抓到本地 commit）
- 只 build `app`（不 build `db`/`livekit`，加快 build 時間）

### 部署後驗證 commit 注入成功

```bash
# 應該回真實 commit hash、不是 "unknown"
curl -s https://game.homi.cc/api/version
# 預期：{"commit":"80198d4dc7c6...","buildTime":"unknown","timestamp":...}
```

如果回 `"unknown"` → 重新跑一次部署、確認有 `export GIT_SHA=$(git rev-parse HEAD)`。

---

## 驗證部署成功

```bash
# 1. 容器狀態（必須是 healthy）
ssh root@172.233.89.147 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep gamehomicc"

# 預期：
# gamehomicc-app-1      Up XX seconds (healthy)
# gamehomicc-db-1       Up X days (healthy)
# gamehomicc-livekit    Up X days

# 2. HTTPS 可訪問
curl -sI https://game.homi.cc/ | head -3
# 預期：HTTP/2 200

# 3. API 健康
curl -s https://game.homi.cc/api/version
# 預期：{"commit":"<真實 git hash>","timestamp":...}
# ⚠️ 若 commit 是 "unknown" → AppUpdateChecker 會失效，重跑 deploy 並帶 GIT_SHA
```

---

## 失敗回滾

### 情境 1：build 失敗（容器沒起來）

```bash
ssh root@172.233.89.147 "cd /www/wwwroot/game.homi.cc && docker compose -f docker-compose.prod.yml logs --tail 100 app"
```

修 → push → 重新部署。**不要強制 down 現有 container**（舊版仍在跑）。

### 情境 2：容器起來但功能異常

```bash
# 1. Git revert 最後 commit
git revert HEAD
git push origin main

# 2. 重新部署上一版
ssh root@172.233.89.147 "cd /www/wwwroot/game.homi.cc && git pull origin main && docker compose -f docker-compose.prod.yml up -d --build"
```

### 情境 3：DB schema 不相容（最嚴重）

如果新版程式期待新欄位但 DB 沒有：
1. **先補 schema**（[runbooks/db-migration.md](db-migration.md)）
2. 再重新部署

---

## 環境變數變更後

如果改了 `.env`（例：加新 `PUBLIC_BASE_URL`）：

```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
nano .env  # 編輯
docker compose -f docker-compose.prod.yml up -d --build  # 必須加 --build
```

注意：**只重啟（restart）不會載入新環境變數**，必須 `up -d --build`。

---

## 部署後檢查清單

- [ ] 容器 `(healthy)` 狀態
- [ ] 網站 HTTPS 200
- [ ] 抽查關鍵頁面（首頁 / 遊戲列表 / Admin 登入）
- [ ] 測試本次新功能（看 commit 訊息列出的範圍）
- [ ] 確認舊資料完整保留（玩家紀錄、遊戲、QR）
- [ ] 更新 `docs/CHANGELOG.md`

---

## 紅線

- ❌ **不要 scp 傳檔** — 一律走 git
- ❌ **不要直接改生產容器內檔案** — 重啟就消失
- ❌ **不要強推 `--no-verify`** — 跑 hook 確保品質
- ❌ **使用者沒說「部署」之前不要主動部署**

---

## 相關文件

- [architecture/deployment.md](../architecture/deployment.md) — 部署架構
- [runbooks/db-migration.md](db-migration.md) — DB schema 變動
- [runbooks/incident-response.md](incident-response.md) — 故障應對（待建）
