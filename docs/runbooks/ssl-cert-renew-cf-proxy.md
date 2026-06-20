# Runbook：SSL 憑證續期（Cloudflare proxy 站）

> 對象：game.homi.cc（走 Cloudflare 橘雲 + 寶塔 nginx + Docker proxy）
> 建立：2026-06-19（憑證過期事件後）

## 症狀 → 快速判斷

前端出現 `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`（登入或 API 呼叫時）。

```bash
# 邊緣狀態碼：526 = Cloudflare↔源站 SSL 握手失敗（源站憑證過期/無效）
curl -s -o /dev/null -w "%{http_code}\n" https://game.homi.cc/health

# 源站直連（繞 CF）：若 200 JSON = app 正常，問題純在憑證
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --resolve game.homi.cc:443:172.233.89.147 https://game.homi.cc/health -k

# 源站憑證到期日
echo | openssl s_client -servername game.homi.cc -connect 172.233.89.147:443 2>/dev/null | openssl x509 -noout -dates
```

526 + 源站直連正常 + 憑證過期 → 就是憑證問題。

## 根因

game.homi.cc 原本由**寶塔自簽**的 LE 憑證，自動續期早就壞了 → 90 天後過期 → CF Full(strict) 驗不過 → 526 → 回 HTML 錯誤頁 → 前端 JSON.parse 爆掉。

## ⚠️ 關鍵坑

本站 nginx 是純 `proxy_pass http://127.0.0.1:3333`，**server 區塊沒有 `root`**。寶塔的 well-known include 用 lua 從 `document_root` 找驗證檔 → 找不到 → fallback 到 **`/www/wwwroot/java_node_ssl`**（寶塔給 node/proxy 站的 webroot）。

所以 certbot webroot 必須用 `/www/wwwroot/java_node_ssl`，不是站點目錄。

## 修復步驟（已自動化，僅供再發時參考）

```bash
ssh root@172.233.89.147

# 1.（可選）先測 webroot 能否經 CF 取到
mkdir -p /www/wwwroot/java_node_ssl/.well-known/acme-challenge
echo ok > /www/wwwroot/java_node_ssl/.well-known/acme-challenge/probe
curl -s http://game.homi.cc/.well-known/acme-challenge/probe   # 應回 ok（port 80 經 CF 回源，未強制 https）

# 2. certbot webroot 重簽
certbot certonly --webroot -w /www/wwwroot/java_node_ssl -d game.homi.cc -n --agree-tos

# 3. 套進寶塔憑證路徑（nginx conf 指向此）+ 重載
cp /etc/letsencrypt/live/game.homi.cc/fullchain.pem /www/server/panel/vhost/cert/game.homi.cc/fullchain.pem
cp /etc/letsencrypt/live/game.homi.cc/privkey.pem   /www/server/panel/vhost/cert/game.homi.cc/privkey.pem
nginx -t && nginx -s reload
```

## 自動續期（已設定，不會再過期）

deploy-hook：`/etc/letsencrypt/renewal-hooks/deploy/game-homi-cc.sh`
→ certbot 每次自動續期後，自動 cp 新憑證到寶塔路徑 + `nginx -s reload`。

驗證 hook 存在：`cat /etc/letsencrypt/renewal-hooks/deploy/game-homi-cc.sh`
測試續期（不實際續）：`certbot renew --dry-run`

## 驗證修復

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://game.homi.cc/health   # 200
curl -s https://game.homi.cc/api/health                                 # JSON 非 HTML
echo | openssl s_client -servername game.homi.cc -connect 172.233.89.147:443 2>/dev/null | openssl x509 -noout -enddate
```

## 相關

- 部署流程：[deploy.md](deploy.md)
- 生產資訊：專案 `CLAUDE.md`
