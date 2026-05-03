# 錯誤處理體系盤點報告 — 2026-05-03

> **範圍**：客戶端 / 後端 / WebSocket / 後台紀錄 五類
> **目的**：找缺口、不實作
> **生產 HEAD**：commit `9f8d48db`

---

## 1. 已有能力

### A. 客戶端錯誤頁面 / Boundary
| 檔案 | 用途 |
|------|------|
| `client/src/pages/not-found.tsx` | 404 頁、含「返回首頁」按鈕 |
| `client/src/components/ErrorBoundary.tsx` | 全域 React 錯誤邊界、處理 PWA chunk load error 自動恢復 |
| `client/src/components/game/GamePageErrorBoundary.tsx` | 遊戲頁面單頁錯誤邊界（防相機/MediaPipe 拋例外整頁白屏）|
| `client/src/components/shared/ForbiddenPage.tsx` | 403 權限不足、含「返回」+「建議路徑」 |
| `client/src/components/admin-login/LoginErrorAlert.tsx` | 登入失敗錯誤提示 |
| `client/src/components/game/photo-mission/GameErrorView.tsx` | 拍照任務錯誤畫面 |

### B. API 錯誤統一處理
- `client/src/lib/queryClient.ts:throwIfResNotOk`：
  - **401** → `登入已失效，請重新登入`、自動 force refresh Firebase token + retry 一次
  - **403** → 解析 server message + 加「如需更多權限，請聯絡場域管理員」
  - 其他 → `${status}: ${text}`
- `useAdminAuth` → 401 自動 navigate 到 `/admin/login`
- `ProtectedAdminRoute` → 加 requiredPermission 檢查、不足顯示 ForbiddenPage

### C. 客戶端 error 上報（基礎建設已建好）
- `client/src/hooks/useErrorReport.ts` — hook 已建：
  - 攔截 window `error` + `unhandledrejection`
  - ErrorBoundary 透過 `window.__chitoReportError()` 上報
  - rate limit 10 errors/min + dedup 60 秒同 fingerprint
  - 失敗 fail-silent 防無限迴圈
- `server/routes/error-log.ts` — POST /api/error-log endpoint：
  - 有 IP rate limit + zod validate + 永遠回 200
- `shared/schema/error-logs.ts` — DB schema：
  - level / message / stack / source / url / userAgent
  - userId / fieldId / ipAddress
  - fingerprint + occurrenceCount（同類聚合）
  - resolvedAt / resolvedByAdminId / resolvedNote
- `client/src/pages/platform/PlatformErrorLogs.tsx`（325 行）— 後台查詢頁：
  - filter by level / resolved
  - stats 統計
  - 標記 resolved + 註記

### D. Server 端全域錯誤
- `server/index.ts` 全域 `app.use((err, req, res, next) => ...)`：
  - status = err.status || 500
  - 回 `{ message }`

### E. errorCode 規範範本（僅 1 處）
- `server/routes/ai-scoring.ts` 用 errorCode pattern：
  - `AI_NOT_CONFIGURED` / `RATE_LIMITED` / `FIELD_AI_DISABLED` / `QUOTA_EXCEEDED` / `API_KEY_INVALID` / `NETWORK_ERROR` / `UNHANDLED_ERROR`

### F. 各 status code 使用次數（後端）
| code | 用法 | 次數 |
|------|------|------|
| 401 | 未認證 | 191 |
| 403 | 權限不足 | 125 |
| 404 | 資源不存在 | 282 |
| 429 | rate limit | 5 |
| 500 | 伺服器錯誤 | 464 |
| 503 | 服務未啟用（Recur / Resend / LINE 未配置） | 22 |

---

## 2. 明確缺口

### 🔴 P0：工程師無法追查

**P0-1. `useErrorReport` 整個被註解**
- 位置：`client/src/App.tsx:453` `// useErrorReport();`
- 註解原因：`2026-04-24 hotfix：暫時停用，懷疑跟生產端 React error #310 有關，待根因確認後恢復`
- 後果：
  - **後台 PlatformErrorLogs 頁面收不到任何資料**（整個 client error 上報鏈路斷開）
  - 工程師完全無法知道 client 端 crash 狀況
  - ErrorBoundary 仍能 catch 但只 log 到 console、沒進 DB
- 影響範圍：所有玩家端 / admin 端 / 平台端 client crash

**P0-2. 沒有 server-side error logging**
- 位置：`server/index.ts` 全域 error middleware 只 `res.status().json()`
- 缺：
  - 沒寫進 error_logs（只有 client 端會寫）
  - 沒 request id 追蹤
  - 沒 stack trace 結構化
  - server 5xx 完全只在 docker logs（沒查詢頁）
- 後果：
  - 使用者報「按了沒反應」→ 工程師只能去 SSH 看 docker logs grep
  - 沒辦法用 PlatformErrorLogs 後台查 server 端問題

### 🔴 P0：使用者迷路

**P0-3. 玩家進入過期活動連結 → 沒「找替代」入口**
- `HostPlay.tsx` 失敗時只顯示「活動已結束或主辦方未開啟、請通知主辦方」
- 缺：「返回首頁」/「找其他活動」/「掃 QR 進其他場域」按鈕
- 玩家被卡住、必須自己重新打 URL

**P0-4. WebSocket 失連時沒 UI 提示**
- `useTeamWebSocket` / `useHostScreenSync` 有 `isConnected` state
- 但 `GamePlay.tsx` / `HostPlay.tsx` / `HostScreen.tsx` **沒在 UI 顯示斷線**
- 玩家以為畫面 lag、實際是 WS 斷了不會自動更新
- ChatPanel 和 admin 連線狀態 indicator 已存在、但其他互動頁面沒

### 🟡 P1：錯誤頁面不分流

**P1-5. 沒有 401 / 429 / 500 / 503 專屬頁面**
- 401 由 navigate 處理（OK）
- 429 / 500 / 503 都靠 toast 一閃 message、沒專屬頁面
- 玩家 / admin / 平台端 share 同一個 NotFound + ErrorBoundary
- 缺：場景化錯誤頁（活動結束 / 系統維護中 / 過於頻繁）

**P1-6. 沒有 user-facing error code**
- client 直接 toast `error.message`（raw server message）
- 缺：
  - error code（讓使用者報修時可以說「我看到錯誤碼 ABC123」）
  - request id（工程師可去 logs 找到對應 request）
  - retryable 提示（這個錯誤是否該重試）

### 🟡 P1：阻斷防呆缺漏

**P1-7. HostPlay 半套 UI 風險**
- `info` query 成功 → 不顯示 isLoading
- 但 `pages` query 失敗 → 顯示 header 但 main 空白
- 沒被 GamePageErrorBoundary 接住、玩家看到一半畫面

**P1-8. server route 大量 catch (error) 直接回 500**
- 282 處 res.status(404) + 464 處 res.status(500)
- 多數沒明確區分「資源不存在」vs「邏輯失敗」vs「DB 錯誤」
- 沒有結構化 errorCode

### 🟢 P2：UX 改善

**P2-9. ErrorBoundary 沒「回報問題」入口**
- 只說「請截圖回報」、沒提供 LINE / email / form 連結
- 玩家不知道要回報給誰

**P2-10. error_logs schema 缺欄位**
- 沒 sessionId / teamId / matchId / requestId
- 沒 platform = "client" | "server" 區分
- 排錯時要靠 url 反推、麻煩

---

## 3. 高優先修正項

| # | 項目 | 級別 | 修法成本 | 影響範圍 |
|---|------|------|----------|----------|
| **1** | **取消註解 `useErrorReport()` + 釐清 React error #310 根因** | P0 | 低（試開 + 觀察）| 全平台 client 錯誤可追溯 |
| **2** | **server 端錯誤上報到 error_logs**（全域 middleware 補寫 DB）| P0 | 中 | 工程師可在後台查 server 5xx |
| **3** | **WS 失連 UI indicator 統一**（GamePlay / HostPlay / HostScreen）| P0 | 低 | 玩家不再以為「lag」 |
| **4** | **HostPlay 過期活動加替代入口**（返回首頁 / 找場域）| P0 | 低 | 玩家不迷路 |
| **5** | **error_logs schema 加欄位**（sessionId / teamId / matchId / requestId / platform）| P1 | 低（migration ADD COLUMN）| 排錯效率 |
| **6** | **errorCode 規範擴充**（ai-scoring 模式推到所有 routes）| P1 | 中 | user-facing 報修可追蹤 |
| **7** | **429 / 500 / 503 專屬頁面**（玩家 vs admin 分流）| P1 | 中 | 體驗一致性 |
| **8** | **「回報問題」入口**（ErrorBoundary + GamePlay menu）| P2 | 低 | 收到回報率提升 |

---

## 4. 建議修正順序

**Stage 1（追查能力 — 最高 ROI）**：
1. ✅ 修正項 #1（取消 useErrorReport 註解、觀察是否仍有 React error #310）
2. ✅ 修正項 #2（server 全域 middleware 加 error_logs 寫入）
3. ✅ 修正項 #5（schema 加欄位 — 為 #2 鋪路）

**這 3 個修完 = 工程師可在後台查所有 client + server 錯誤。**

**Stage 2（玩家不迷路）**：
4. ✅ 修正項 #4（HostPlay 過期活動加替代入口）
5. ✅ 修正項 #3（WS 失連 UI indicator）

**Stage 3（體驗一致性）**：
6. ✅ 修正項 #7（5xx 專屬頁面 — 玩家 / admin 分流）
7. ✅ 修正項 #6（errorCode 規範擴充）
8. ✅ 修正項 #8（回報問題入口）

---

## 5. 涉及檔案清單

### 取消 useErrorReport 註解（P0-1）
- `client/src/App.tsx` — 取消 line 453 註解

### Server 端錯誤上報（P0-2）
- `server/index.ts` — 全域 error middleware 補寫 DB
- `server/lib/error-logger.ts` — 新增（共用 helper）
- `server/routes/platform.ts` — `/api/platform/errors` GET endpoint 加 platform filter

### WS 失連 UI（P0-3）
- `client/src/pages/GamePlay.tsx` — 加 connectionBadge
- `client/src/pages/HostPlay.tsx` — 同上
- `client/src/pages/HostScreen.tsx` — 同上
- `client/src/components/shared/WsConnectionBadge.tsx` — 新增（共用 component）

### 過期活動替代入口（P0-4）
- `client/src/pages/HostPlay.tsx` — error UI 加按鈕
- `client/src/pages/HostScreen.tsx` — 同上

### error_logs schema 擴充（P1-5）
- `shared/schema/error-logs.ts` — 加 sessionId / teamId / matchId / requestId / platform
- `migrations/` — 新 migration（只 ADD COLUMN）
- `server/routes/error-log.ts` — accept new fields
- `server/routes/platform.ts` — query 加 filter

### errorCode 規範（P1-6）
- `shared/lib/error-codes.ts` — 新增（中央定義）
- `server/lib/api-error.ts` — ApiError class
- `client/src/lib/queryClient.ts` — parse errorCode + display

### 5xx 專屬頁面（P1-7）
- `client/src/pages/errors/RateLimit429.tsx` — 新增
- `client/src/pages/errors/Maintenance503.tsx` — 新增
- `client/src/pages/errors/ServerError500.tsx` — 新增
- `client/src/components/ErrorBoundary.tsx` — 加 5xx 路由

### 回報入口（P2-8）
- `client/src/components/ErrorBoundary.tsx` — 加 「回報問題」按鈕
- `client/src/components/shared/ReportProblemDialog.tsx` — 新增

---

## 🚨 「使用者會迷路」的場景列表

| # | 場景 | 目前體驗 | 應該怎樣 |
|---|------|----------|----------|
| A | 玩家進入過期 `host_play` 連結 | 「活動已結束、請通知主辦方」 | 多加「返回 / 找其他活動」按鈕 |
| B | 玩家在 GamePlay 中、API 5xx | toast 一閃、不知怎辦 | 顯示「重試 / 跳關 / 回首頁」選項 |
| C | WS 斷線（網路不穩 / server 重啟）| 畫面以為 lag、不會自動更新 | 顯眼斷線 indicator + 自動重連倒數 |
| D | admin 點到沒權限的頁 | ForbiddenPage 但只說「沒權限」 | 提示「申請此權限」入口 |
| E | host token 過期 | 「缺少 host token」 | 加「重新申請大螢幕網址」按鈕 |
| F | 玩家對講機建群失敗（quota / 網路）| toast「建立失敗」 | 加 retry + 跳過 + 不使用對講 選項 |

---

## 🔧 「工程師無法追查」的錯誤場景列表

| # | 場景 | 目前狀況 | 應該怎樣 |
|---|------|----------|----------|
| α | client React crash | useErrorReport 註解、進不了 DB | 重啟上報 |
| β | server route 拋例外 | 只 console.error、用 SSH grep | 全域 middleware 寫 error_logs |
| γ | 玩家報「按按鈕沒反應」 | 沒 request id 對不上 logs | 注入 X-Request-Id |
| δ | WebSocket message 處理失敗 | catch 後 ws.send(error)、不進 DB | logger 寫 error_logs |
| ε | 第三方 API 失敗（Cloudinary / Resend / Recur）| 各 route 自己 console.error | shared httpError logger |
| ζ | 同類錯誤大量出現 | error_logs 有 fingerprint 但沒告警 | 後台 alert（>10/min 同 fingerprint）|

---

## 相關文件

- 既有：[ADR-0014 Realtime 協定清理](../decisions/0014-realtime-protocol-cleanup.md)
- 既有：[ADR-0015 WebSocket 匿名寫入政策](0015-websocket-anonymous-write-policy.md)
- 修正後可能新增：`docs/decisions/0016-error-handling-policy.md`（錯誤處理政策統一）
