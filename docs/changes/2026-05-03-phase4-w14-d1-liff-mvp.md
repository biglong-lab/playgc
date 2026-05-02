# Phase 4 W14 D1 — LINE LIFF MVP scaffold

**日期**：2026-05-03
**範圍**：W14 D1、LIFF SDK wrapper + PlayLiff 頁 + 路由
**狀態**：🟢 W14 D1 完成、LINE 玩家入口就緒（待 admin 申請 LIFF ID 啟用）

---

## 🎯 目標達成

> Phase 4 W13 主軸是業務（找客戶）— 我做不了
> W14 主軸：LINE LIFF 整合（玩家不離開 LINE）
> W14 D1 補上技術 scaffold

---

## 📦 新增

### 1. `client/src/lib/liff.ts`

**核心**：
- `initLiff(liffId)` — 初始化 + 取得 profile
- `triggerLineLogin(sdk)` — 未登入時觸發 LINE 登入
- `closeLiffWindow(sdk)` — 完成遊戲後關閉 LIFF window

**設計**：
- Lazy load LINE SDK from CDN（`https://static.line-scdn.net/liff/edge/2/sdk.js`）
- 不裝 npm 套件、避免 bundle 增加
- 桌機瀏覽器 fallback（不在 LINE 環境）

### 2. `client/src/pages/PlayLiff.tsx`（路徑 `/liff/play/:sessionId`）

**流程**：
1. 載入 LIFF SDK
2. 自動取 LINE 使用者 profile（displayName / userId）
3. 跳轉到 `/play/:sessionId?line_user_id=...&line_display_name=...`

**Status 處理**：
- `loading` — 載入中
- `login_required` — 未登入、自動觸發 login
- `ok` — 取得 profile、自動跳轉
- `error` — 錯誤、顯示「改用一般網頁」按鈕
- `not_configured` — `VITE_LIFF_ID_PLAY` 未設、fallback `/play/:sessionId`

### 3. App.tsx 路由

```tsx
<Route path="/liff/play/:sessionId" component={PlayLiff} />
```

### 4. Smoke test 5g

- GET `/liff/play/test` → 200

從 40 → **41 個檢查**

---

## 💡 設計決策

### 為何用 CDN SDK 而非 npm?

選擇：lazy load `static.line-scdn.net/liff/edge/2/sdk.js`

理由：
- LINE 官方推薦 CDN
- 不裝 npm 套件、bundle 不變
- LINE 隨時更新 SDK、CDN 自動拿最新

### 為何 LIFF 跳到 `/play` 而非自己渲染遊戲？

選擇：LIFF 頁是「中繼站」、跳到既有 `/play/:sessionId`

理由：
- 既有 `/play` 已支援所有元件、不重寫
- LIFF 只負責「取 LINE profile」+ 跳轉
- 維護單一 source of truth（HostPlay.tsx）

### 為何用 query params 傳 LINE profile？

選擇：`?line_user_id=...&line_display_name=...`

理由：
- 簡單、無需 sessionStorage
- F5 重新整理 profile 仍在
- 後續 `/play` 可讀取 query 用 LINE 名字（取代手動輸入）

### 為何不需要設定整個 LINE Bot？

選擇：W14 D1 只做 LIFF（無需 Bot）

理由：
- LIFF 可獨立運作（用網址分享 / OG meta）
- Bot 是 W15 D1 才整合
- 漸進式：LIFF（被動）→ Bot（主動）

---

## 🛠 環境變數（前端）

| 變數 | 說明 |
|------|------|
| `VITE_LIFF_ID_PLAY` | 玩家 LIFF ID（admin 在 LINE 開發者後台申請）|

LIFF ID 格式：`1660000000-AbcDef12`

未設 → PlayLiff 自動 fallback 到 `/play/:sessionId`（一般瀏覽器體驗）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**41/41 全綠**

---

## ⏭ 下一步：W14 D2-D5

- W14 D2：LIFF profile 整合到 `/play`（讀 query 自動用 LINE 名字）
- W14 D3：QR code 生成 LIFF URL（admin 端可選擇「LIFF」或「網頁」格式）
- W14 D4：依實測反饋微調
- W14 D5：W14 收尾 + W15 LINE Bot 規劃

---

## 🔗 相關文件

- [ADR-0009 Phase 4 方向](../decisions/0009-phase4-direction.md)
- [Phase 3 完整收尾](2026-05-03-phase3-complete.md)
- [LINE LIFF 文件](https://developers.line.biz/en/docs/liff/)
