# LINE Login（B-1 方案） — 2026-05-17

> 範圍：全域 LINE Login OAuth + Firebase custom token + 環境偵測藏 Google
> 狀態：✅ 程式碼完成、待業主 LINE Developers 設定 + 部署實測
> 部署 commit 範圍：9785660a..3aa857b0（10 個 auto commits + 本變動紀錄）

---

## 背景

業主需求（2026-05-17）：
> 「可以增加LINE登入？方便LINE的使用者...你建議怎樣做最好！」

選了 **B-1. 推薦：LINE Login 全域 + 環境偵測藏 Google**。

理由：
- 大多數玩家從 LINE 推播 / LIFF 連結進來、UA 是 LINE 內建瀏覽器
- Google OAuth 在 LINE 內建瀏覽器會卡（popup/redirect 都不順）
- LINE Login（OAuth 2.0）一個全域 channel 就能服務所有場域玩家
- 環境偵測（UA 包含 `Line/`）→ 自動藏 Google 按鈕、優先顯示 LINE

---

## 影響範圍

### 後端
- 新檔 `server/routes/auth-line-login.ts`（~175 行）
- `server/routes/index.ts`（註冊 router）

### 前端
- `client/src/lib/firebase.ts`（加 `startLineLogin` + `consumeLineTokenFromHash`）
- 新檔 `client/src/lib/auth-env.ts`（環境偵測 utility）
- `client/src/hooks/useLoginHandlers.ts`（加 `handleLineLogin`）
- `client/src/components/landing/LoginDialog.tsx`（綠色 LINE 按鈕 + 條件式藏 Google）
- `client/src/contexts/AuthContext.tsx`（啟動時 `consumeLineTokenFromHash`）

### 環境變數
- `LINE_LOGIN_CHANNEL_ID`（新）
- `LINE_LOGIN_CHANNEL_SECRET`（新）
- `LINE_LOGIN_CALLBACK_URL`（新、預設 `https://game.homi.cc/api/auth/line/callback`）
- `APP_BASE_URL`（新或已有、預設 `https://game.homi.cc`）

---

## 解決方案

### 整體流程
```
[玩家] 按 LINE 登入按鈕
       ↓
[前端] startLineLogin(returnTo)
       ↓ window.location = /api/auth/line?returnTo=/f/JIACHUN/home
[後端] GET /api/auth/line
       ↓ 產 state cookie + redirect 到 LINE OAuth authorize
[LINE] 玩家授權
       ↓ redirect 到 callback?code=xxx&state=yyy
[後端] GET /api/auth/line/callback
       ↓ verify state cookie
       ↓ POST /oauth2/v2.1/token （拿 access_token）
       ↓ GET /v2/profile （拿 userId + displayName + pictureUrl）
       ↓ Firebase Admin upsertUser（uid = `line:<userId>`）
       ↓ createCustomToken
       ↓ res.redirect(`/f/JIACHUN/home#lineToken=xxx`)
[前端] AuthProvider mount → consumeLineTokenFromHash()
       ↓ history.replaceState（清 hash、避免 token 留 URL）
       ↓ signInWithCustomToken
       ↓ onAuthStateChanged 觸發 → UI 反映已登入
```

### 環境偵測
- `isInLineApp()` → UA 含 `Line/`
- `getAuthProviderVisibility()` → 回 `{ showLine, showGoogle, showEmail }`
  - LINE 內建瀏覽器 → `showGoogle: false`
  - 一般瀏覽器 → 全顯示

---

## 業主部署清單（必做）

### 1. LINE Developers Console 設定

到 [LINE Developers](https://developers.line.biz/console/) 建立 **LINE Login channel**（注意：與 Messaging API 是不同 channel）：

1. **Create new channel** → **LINE Login**
2. 填基本資料：
   - Channel name：`賈村平台登入`（或統一品牌名）
   - Channel description：自填
   - App types：勾 **Web app**
3. **LINE Login** 分頁 → **Callback URL** 填：
   ```
   https://game.homi.cc/api/auth/line/callback
   ```
4. **App settings** → **Scopes** 確認勾：
   - `profile`（必需）
   - `openid`（必需）
   - `email`（選用，但建議勾，後端會抓）
5. **Basic settings** 拿：
   - Channel ID
   - Channel secret

### 2. 生產環境變數（Coolify / .env）

```bash
LINE_LOGIN_CHANNEL_ID=<從 LINE Developers 拿>
LINE_LOGIN_CHANNEL_SECRET=<從 LINE Developers 拿>
LINE_LOGIN_CALLBACK_URL=https://game.homi.cc/api/auth/line/callback
APP_BASE_URL=https://game.homi.cc
```

### 3. 部署

業主明確說「部署」後：
```bash
ssh root@172.233.89.147
cd /www/wwwroot/game.homi.cc
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. 驗證

部署後依序：
1. 用 Mac Safari 開 https://game.homi.cc/f/JIACHUN/home
   - 確認登入 Dialog 顯示綠色「使用 LINE 登入」按鈕
   - Google + Apple + Email 都還在
2. 用 iPhone LINE App 開同 URL
   - 確認 Dialog 不顯示 Google 按鈕（藏起來）
   - 顯示提示「偵測到 LINE 內建瀏覽器，建議使用上方 LINE 登入（最順暢）」
3. 按 LINE 登入 → LINE 授權 → 應自動 redirect 回 `/f/JIACHUN/home`、看到自己 LINE 名字
4. F12 看 Console、確認沒有 `consumeLineTokenFromHash 失敗`

### 5. Firebase 確認

第一次 LINE 登入後到 Firebase Console → Authentication → Users：
- 應該看到新 user、uid 開頭是 `line:`
- displayName 是 LINE 名字
- photoURL 是 LINE 大頭照

---

## 已知限制 / 後續優化

1. **沒做 email 反向綁定**：若玩家先用 Email 註冊、後用 LINE 登入、會建兩個 uid。後續加「帳號合併」功能。
2. **沒做場域隔離**：所有場域共用一個 LINE Login channel（B-1 方案就是這樣設計）。若未來要每場域獨立 Login channel，需擴展 `resolveLineConfig` 到 Login flow。
3. **state cookie SameSite=Lax**：OAuth redirect 跨站需要、但若有任何 CSP 攔到要調。
4. **LINE Login 與 Messaging API channel 分開**：玩家身份識別（Login channel）vs 推播（Messaging channel）是不同的 channel id，業主要分清楚。

---

## 相關文件

- [domains/multi-field.md](../domains/multi-field.md)
- [changes/2026-05-17-line-per-field.md](2026-05-17-line-per-field.md)（per-field push/webhook/LIFF）
- ADR：待寫（LINE Login 全域 vs per-field 的設計取捨）
