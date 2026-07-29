# Runbook：遷移至 prod-osa（172.233.67.87）

> **狀態**：規劃中，尚未執行。目前生產在 **172.233.89.147**（寶塔 nginx、`/www/wwwroot/game.homi.cc`）。
> 先例：hosting-tool（7/28）、kinmen-coupon（7/29）皆已完成。
> **本專案是整批遷移中最複雜的一個** —— 原因是 LiveKit WebRTC。

## 為什麼本專案最麻煩

| 一般專案 | playgc 多出來的 |
|---|---|
| HTTP 走 nginx 反代即可 | **LiveKit 媒體流不能反代**：UDP 50000-50100 + TCP 7881 必須直達源站 |
| DNS 換完就好 | **Cloudflare 橘雲 + Full(strict)**：源站憑證要先備妥，否則 526 |
| 憑證用 HTTP-01 續期 | 現行 certbot webroot 是**寶塔專屬路徑**，新機不適用 |

## 🔴 阻斷點一：Cloudflare Full(strict) 的雞生蛋

CF Full(strict) 要求源站有**有效憑證**。但現行 runbook 的 certbot HTTP-01 需要
`http://game.homi.cc/.well-known/...` 能打到新機 —— 而那要 DNS 已經指向新機。
**先切 DNS 就會 526（全站掛）；先簽憑證又打不到。**

**解法（擇一，建議 A）**：

- **A. Cloudflare Origin Certificate（推薦）**
  在 CF 後台簽一張 Origin CA 憑證（有效期最長 15 年，只有 CF 認、不需公開驗證），
  直接放到新機。**完全不需要 DNS 先切換**，切過去就是有效的。
- **B. DNS-01 challenge**
  用 CF API token 跑 `certbot --dns-cloudflare`，不需要 port 80 可達。
- **C. 暫時關橘雲**
  DNS 改灰雲 → 簽 HTTP-01 → 再開橘雲。過渡期源站 IP 會直接暴露，且有短暫風險。

> ⚠️ 現行 `ssl-cert-renew-cf-proxy.md` 記錄的 `-w /www/wwwroot/java_node_ssl` 是**寶塔的
> fallback webroot**，新機（純系統 nginx）沒有這個路徑。遷移後該 runbook 需要改寫。

## 🔴 阻斷點二：LiveKit 的 UDP/TCP 必須直達

```
UDP 50000-50100  ← WebRTC 音訊流（101 個 port）
TCP 7881         ← NAT 穿透失敗時的 fallback
```

這兩者**繞過 Cloudflare、直接連源站 IP**（CF 不代理 UDP）。

- 新機防火牆（ufw / iptables / 雲端安全群組）**必須放行這 101 個 UDP port 與 TCP 7881**
- 沒放行的症狀是 **「對講機連得上、但完全沒有聲音」** —— signaling 走 nginx 沒問題，
  媒體流卻進不來。這種半死狀態最容易在驗收時被漏掉。
- `livekit.yaml` 的 `use_external_ip: true` 會自動偵測新機公網 IP 並公告給客戶端，
  **不需要改設定**，但前提是新機能正確取得自己的公網 IP。

## 部署路徑：建議改 `/opt/playgc`

舊機是 `/www/wwwroot/game.homi.cc`（寶塔慣例）。prod-osa 是純系統 nginx，
既有專案都放 `/opt/<專案名>`（hosting-tool、kinmen-coupon 皆是）。

改路徑要同步更新：
- GitHub Secret `DEPLOY_PATH` → `/opt/playgc`
- [deploy.md](./deploy.md) 裡寫死的 `cd /www/wwwroot/game.homi.cc`

> 想降低變動面的話，沿用原路徑也可以（`DEPLOY_PATH` 不改即可），
> 只是與 prod-osa 其他專案不一致。

## 遷移步驟

```
0. 【先做】新機防火牆放行 TCP 7881 + UDP 50000-50100
1. 【先做】備妥源站憑證（建議 CF Origin Certificate，見阻斷點一）
2. 新機建目錄 /opt/playgc，deploy key clone repo
3. 機對機直傳（不經本機、不進 git）：
     .env（含 POSTGRES_PASSWORD / SESSION_SECRET / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
           / FIREBASE_ADMIN_* / CLOUDINARY_* / TELEGRAM_* ）
     secrets/gcp-vision.json（Google Vision OCR 用，compose 有掛載）
4. DB 搬遷：舊機 pg_dump → 新機 restore
     docker compose -f docker-compose.prod.yml exec -T db \
       pg_dump -U postgres -d gameplatform --no-owner --no-acl | gzip > gameplatform.sql.gz
5. 計數驗證：逐表比對筆數與舊機一致
6. 新機首次啟動（記得帶 GIT_SHA，見 deploy.md 的警告）：
     export GIT_SHA=$(git rev-parse HEAD)
     docker compose -f docker-compose.prod.yml up -d --build
7. nginx：套用 docs/runbooks/nginx-vhost.md
8. 本機直測（DNS 還沒切，用 --resolve 繞過）：
     curl -s --resolve game.homi.cc:443:172.233.67.87 https://game.homi.cc/health -k
9. DNS：Cloudflare 的 game.homi.cc A 紀錄改指 172.233.67.87（先降 TTL）
10. 對講機實測（最重要，見驗收清單）
11. 舊機停服但不刪，觀察數日再回收
```

## GitHub Secrets 要改（只有業主能改）

| Secret | 新值 |
|--------|------|
| `DEPLOY_HOST` | `172.233.67.87` |
| `DEPLOY_USER` | prod-osa 慣例是 `root` |
| `DEPLOY_SSH_KEY` | 沿用同一把即可，新機 `authorized_keys` 要放公鑰 |
| `DEPLOY_PATH` | `/opt/playgc`（若決定改路徑）|

> 本 workflow **沒有** `DEPLOY_PORT` 設定，appleboy/ssh-action 預設走 22，
> 與 prod-osa 一致，不用額外處理。

部署指令（已是手動確認制）：

```bash
gh workflow run deploy.yml -f confirm=yes -f method=docker-ssh
```

## 驗收清單

**基本**
- [ ] `db` / `app` / `gamehomicc-livekit` 三個容器都健康
- [ ] **DB 逐表計數與舊機一致**
- [ ] `https://game.homi.cc/health` 回 200
- [ ] `https://game.homi.cc/api/version` 的 commit **不是 `"unknown"`**（GIT_SHA 有注入）
- [ ] 安全 headers 齊全、錯誤頁不露 nginx 版本
- [ ] nginx access log 首欄是玩家真實 IP，不是 Cloudflare 網段

**LiveKit 對講機（最容易漏、且症狀是「半死」）**
- [ ] 兩個裝置加入同一隊伍，按 PTT **實際聽得到聲音**
- [ ] 管理者廣播功能正常
- [ ] 用手機 4G（非 WiFi）測一次 —— NAT 環境不同，才會走到 TCP 7881 fallback
- [ ] 確認防火牆 UDP 50000-50100 已放行：
      `nc -zvu 172.233.67.87 50000` 或從 livekit 容器 log 看 ICE candidate

**其他功能**
- [ ] Google Vision OCR（招牌辨識）正常 → `secrets/gcp-vision.json` 有掛到
- [ ] Firebase 登入正常
- [ ] Cloudinary 圖片上傳正常
- [ ] Telegram 通知正常

## 已知技術債（遷移時可一併處理）

1. **`.env.production.example` 缺 LiveKit 段** — `docker-compose.prod.yml` 用到
   `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`，但範例檔沒列，新機建 `.env` 容易漏。
2. **CI 的 E2E 黃金路徑長期失敗**（`e2e/admin-editor-split.spec.ts:81`，
   `/api/scenarios/health` 回傳情境數不符）。與遷移無關，但遷移後更難分辨新問題。

## 相關

- nginx 設定：[nginx-vhost.md](./nginx-vhost.md)
- 部署流程：[deploy.md](./deploy.md)
- 憑證續期（現行寶塔架構，遷移後需改寫）：[ssl-cert-renew-cf-proxy.md](./ssl-cert-renew-cf-proxy.md)
