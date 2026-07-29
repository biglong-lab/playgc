# Runbook：nginx vhost（prod-osa 172.233.67.87）

> **狀態**：⚠️ **草稿 —— 本專案尚未遷移**。目前生產在 **172.233.89.147（寶塔 nginx）**。
> 遷移後請把本註記改掉並同步實際設定。
> 目標主機：172.233.67.87（純系統 nginx，無面板，SSH port 22）
> 設定位置：`/etc/nginx/conf.d/game.homi.cc.conf`
> ⚠️ 修改流程：改檔 → `nginx -t`（**通過才**）→ `systemctl reload nginx` → 同步更新本檔

## 架構

```
玩家 ──HTTPS/WSS──> Cloudflare 橘雲 ──> nginx(prod-osa) ──> 127.0.0.1:3333  (app)
                                                      └──> 127.0.0.1:7880  (livekit signaling)

玩家 ──UDP 50000-50100─────────────────(繞過 CF，直連源站 IP)──> livekit 媒體流
玩家 ──TCP 7881───────────────────────(繞過 CF，NAT 穿透 fallback)──> livekit
```

| 路徑 | 上游 | 說明 |
|------|------|------|
| `/` | `127.0.0.1:3333` | 主應用（Express + 靜態前端）|
| `/ws` | `127.0.0.1:3333` | 應用自己的 WebSocket（`server/routes/websocket.ts` path `/ws`）|
| `/livekit` | `127.0.0.1:7880` | LiveKit signaling，對應 `LIVEKIT_PUBLIC_URL=wss://game.homi.cc/livekit` |

**LiveKit 的 UDP/TCP 媒體流不經 nginx 也不經 Cloudflare**，客戶端直連源站 IP。
`livekit.yaml` 的 `use_external_ip: true` 會讓它自動偵測並公告主機公網 IP。

## 前置：http {} 層

```nginx
http {
    server_tokens off;      # 全域隱藏版本（見 kinmen-coupon docs/runbooks/nginx-hardened-vhost.md）

    # Cloudflare 真實來源 IP（否則所有請求看起來都來自 CF，限流會變成全站共用一個桶）
    # ⚠️ kinmen-coupon 2026-07-29 才踩過這個坑，見其 commit fdc24592
    # 網段清單來源 https://www.cloudflare.com/ips/ ，變動時要更新
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    set_real_ip_from 2400:cb00::/32;
    set_real_ip_from 2606:4700::/32;
    set_real_ip_from 2803:f800::/32;
    set_real_ip_from 2405:b500::/32;
    set_real_ip_from 2405:8100::/32;
    set_real_ip_from 2a06:98c0::/29;
    set_real_ip_from 2c0f:f248::/32;
    real_ip_header CF-Connecting-IP;
}
```

## game.homi.cc

```nginx
server {
    listen 80;
    server_name game.homi.cc;
    # 憑證續期用；CF 橘雲下 port 80 仍會回源
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name game.homi.cc;

    ssl_certificate     /etc/letsencrypt/live/game.homi.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/game.homi.cc/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # 對應 server/index.ts 的 express json limit 50mb
    client_max_body_size 50m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    # 遊戲要用麥克風（對講機）→ 不可整個關掉 microphone
    add_header Permissions-Policy "camera=(), geolocation=(), microphone=(self)" always;
    proxy_hide_header X-Powered-By;

    error_page 401 403 404 500 502 503 504 /error.html;
    location = /error.html { internal; root /www/wwwroot/_errorpages; }

    # ── LiveKit signaling（對講機）──
    location /livekit {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 對講機長連線；預設 60s 會讓玩家每分鐘被踢一次
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # ── 應用自己的 WebSocket ──
    location /ws {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;

        # ⚠️ location 內的 add_header 會取消 server 層所有 add_header —— 必須重複
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), geolocation=(), microphone=(self)" always;
    }
}
```

## 驗證

```bash
nginx -t && systemctl reload nginx

# 主站與健康檢查
curl -s https://game.homi.cc/health
curl -s https://game.homi.cc/api/version      # commit 不可是 "unknown"

# 安全 headers
for h in Strict-Transport-Security X-Frame-Options X-Content-Type-Options Referrer-Policy; do
  curl -sI https://game.homi.cc/ | grep -qi "$h" && echo "✅ $h" || echo "❌ 缺 $h"
done

# 版本不外洩（CF 會遮 Server header，但錯誤頁 body 會原樣轉出）
curl -s https://game.homi.cc/__404__ | grep -iE "nginx/[0-9]|ubuntu" && echo "❌ 露版本" || echo "✅"

# 真實來源 IP 有生效（限流才不會全站共用一個桶）
tail -20 /var/log/nginx/access.log     # 開頭應是玩家 IP，不是 CF 網段

# WebSocket（需要 wscat 或用瀏覽器 devtools 看）
# 對講機實測才準：兩個裝置進同一隊伍、按 PTT 確認聽得到
```

## 相關

- 遷移步驟：[migrate-to-prod-osa.md](./migrate-to-prod-osa.md)
- 憑證續期（現行 CF 架構）：[ssl-cert-renew-cf-proxy.md](./ssl-cert-renew-cf-proxy.md)
- 硬化通用範本：kinmen-coupon `docs/runbooks/nginx-hardened-vhost.md`
- 部署流程：[deploy.md](./deploy.md)
