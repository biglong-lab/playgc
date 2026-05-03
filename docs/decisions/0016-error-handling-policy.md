# ADR-0016: 錯誤處理政策統一規劃

> **日期**：2026-05-03
> **狀態**：採用中（Stage 1+2+3#8 已實作、Stage 3#6+#7 規劃中）
> **影響**：所有 client / server 錯誤處理流程

---

## 背景

依 [docs/changes/2026-05-03-error-handling-audit.md](../changes/2026-05-03-error-handling-audit.md) 盤點報告、錯誤處理體系有以下缺口：

- P0：useErrorReport 註解、server 沒寫 DB、玩家迷路、WS 失連無 UI
- P1：errorCode 規範、5xx 專屬頁、半套 UI、schema 缺欄位
- P2：回報入口、fingerprint 告警

---

## 決策

分 3 階段實作、每階段獨立部署 + 觀察：

### Stage 1（追查能力）✅ 已實作
- 取消 `useErrorReport()` 註解（commit `91033939`）
- error_logs schema 加 8 欄 + 4 index（platform / requestId / sessionId / teamId / matchId / statusCode / method / route）
- server 全域 middleware 寫 error_logs（5xx）+ X-Request-Id 注入
- 共用 `server/lib/error-logger.ts` util

### Stage 2（玩家不迷路）✅ 已實作
- HostPlay 過期活動加替代入口（commit `95145eea`）
- HostScreen Session 過期 / 缺 token 加替代入口
- WsConnectionBadge 共用元件 + GamePlay 多人組隊失連警示

### Stage 3（體驗一致性）部分實作
- ✅ #8「回報問題」入口（commit 待）— ErrorBoundary 加「複製錯誤資訊」按鈕
- 📋 #6 errorCode 規範擴充（規劃中、見下）
- 📋 #7 5xx 專屬頁面（規劃中、見下）

---

## Stage 3 #6 errorCode 規範（規劃）

### 為什麼還沒做

範圍涉及：
- `shared/lib/error-codes.ts` 中央定義
- `server/lib/api-error.ts` ApiError class（包 errorCode + message + retryable）
- 200+ server route 改用（`throw new ApiError(...)`）
- `client/src/lib/queryClient.ts` parse errorCode + display
- 多語系錯誤訊息（zh-TW / en）

→ 範圍 50+ 檔、可能擾動既有測試、需獨立 sprint

### 規劃

#### Phase A：共享定義（小）
```typescript
// shared/lib/error-codes.ts
export const ERROR_CODES = {
  // Auth
  AUTH_REQUIRED: { http: 401, message: "請先登入", retryable: false },
  PERMISSION_DENIED: { http: 403, message: "權限不足", retryable: false },

  // Resource
  NOT_FOUND: { http: 404, message: "找不到資源", retryable: false },

  // Rate / availability
  RATE_LIMIT: { http: 429, message: "操作過於頻繁、請稍後再試", retryable: true },
  SERVICE_UNAVAILABLE: { http: 503, message: "服務暫時無法使用", retryable: true },

  // Server
  INTERNAL_ERROR: { http: 500, message: "伺服器錯誤", retryable: true },

  // Business specific
  TEAM_NOT_MEMBER: { http: 403, message: "你不是此隊伍成員", retryable: false },
  GAME_NOT_STARTED: { http: 400, message: "遊戲尚未開始", retryable: false },
  // ... 視需求加
} as const;
```

#### Phase B：server ApiError class
```typescript
// server/lib/api-error.ts
export class ApiError extends Error {
  constructor(
    public code: keyof typeof ERROR_CODES,
    public details?: Record<string, unknown>,
  ) {
    super(ERROR_CODES[code].message);
    this.name = "ApiError";
  }
  toJSON() {
    const def = ERROR_CODES[this.code];
    return {
      code: this.code,
      message: def.message,
      retryable: def.retryable,
      details: this.details,
    };
  }
}
```

#### Phase C：route 採用（漸進）
- 不一次全改、新 route 強制用 ApiError
- 高頻 / 重要 route（auth / scoring / payments）優先重構
- 既有 route 保留 `res.status(500).json({ message })` 不破壞

#### Phase D：client 解析
- `queryClient.ts` parse errorCode → 顯示 `{message}（錯誤代碼：{code}）`
- 玩家報修可說「我看到 RATE_LIMIT」、工程師秒懂

---

## Stage 3 #7 5xx 專屬頁面（規劃）

### 為什麼還沒做

「不大改 UI」原則：建獨立 route page 會新增使用者 navigation 路徑、需設計 vs 既有 NotFound + ErrorBoundary 整合。

### 規劃

**選項 A：5xx 專屬獨立 routes**（範圍大、不採用）
- /errors/429 / /errors/500 / /errors/503
- 統一 navigate 過去
- 風險：現有頁面 query failure 不會自動跳轉

**選項 B：5xx 共用 component**（推薦）
- `client/src/components/shared/ServerErrorView.tsx`
- props：`status` / `message` / `onRetry?` / `requestId?`
- 業務頁 query failure 時 `<ServerErrorView />` 取代手寫 fallback
- 不破壞既有頁面、新頁面採用

**選項 C：globalErrorHandler 自動接管**（範圍大、風險高）
- queryClient defaultOptions.queries.onError → 5xx 全頁切換
- 風險：影響所有既有 query、難 debug

→ 採用選項 B、待 Stage 3 #6 完成後一起重構（共用 errorCode + ServerErrorView）

---

## 影響

### 程式碼對應
- Stage 1：commit `91033939` + `4735c3db`
- Stage 2：commit `95145eea` + `56e41154`
- Stage 3#8：本 commit（ErrorBoundary 複製按鈕）
- Stage 3#6+#7：待下個 sprint

### 紅線
- ❌ 禁 throw 不帶 errorCode 的 ApiError（未來新 route 規範）
- ❌ 禁直接 `res.status(500).json({ message: rawError })`（safe message + log via error-logger）
- ✅ ApiError + ERROR_CODES + ServerErrorView 是統一錯誤體系入口

### 已知限制
1. 既有 200+ route 還用舊 `res.status().json({ message })` pattern、漸進 migration
2. multi-language errorCode 訊息暫不支援（先繁中）
3. ServerErrorView 還沒建、業務頁 query failure 仍各自處理 fallback

---

## 後續觀察

Stage 1+2+3#8 部署後 24 小時：
- PlatformErrorLogs 是否開始有 client + server 錯誤資料
- 「回報問題」按鈕點擊率（待加 telemetry）
- 是否仍有 React error #310（4/24 hotfix 註解理由）

24 小時後評估是否啟動 Stage 3 #6 + #7 完整實作。

---

## 相關文件

- [docs/changes/2026-05-03-error-handling-audit.md](../changes/2026-05-03-error-handling-audit.md) — 完整盤點報告
- 既有：[ADR-0014](0014-realtime-protocol-cleanup.md) / [ADR-0015](0015-websocket-anonymous-write-policy.md)
