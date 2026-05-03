# 2026-05-03 Session 完整移交紀錄

> **Session 時長**：11:30 → 19:10、~7.5 小時
> **commits**：73 個（base `f04cefe4` → HEAD `c1ab07d6`）
> **生產**：commit `c1ab07d6` 已部署、健康完全穩定
> **目的**：未來接手者可直接讀懂今天做了什麼、待做什麼、怎麼繼續

---

## 🎯 高層成果（今天上線到生產）

### A. Codex 9 輪 realtime 審查
5 個 user-facing silent bugs 全修：
- WebSocket team realtime 房間 + 事件名雙重不一致（5 個事件）
- ChatPanel 雙寫 DB + WS auth bypass
- useTeamShootingSync session_join 協定錯誤
- HostPlay/HostScreen 重複 WS 連線
- ChoiceVerifyRace race_answered 半成品補完

→ [docs/changes/2026-05-03-codex-realtime-cleanup.md](2026-05-03-codex-realtime-cleanup.md)

### B. Codex 5 輪資安審查
19 個建議 14 實作 + 5 ADR 設計取捨：
- match_countdown_complete 匿名寫 DB → 強制認證 + 參與者驗證
- team_score WS dead code 移除
- team_chat / location / vote / ready 4 個寫入事件強制 authenticatedUserId
- WS-level rate limit per connection（10/秒 silent drop）
- join/team_join 用 effectiveUserId 防偽造身份
- /api/admin/switch-field 改用 requireAdminAuth 統一
- /api/dev/custom-token 確認 production 404

→ [ADR-0015](../decisions/0015-websocket-anonymous-write-policy.md)

### C. 使用者新問題 P0/UX
- super_admin 不需區域代號進後台（findFirst 隨機抓非 super_admin）
- super_admin 跨場域登入（HPSPACE / HDSH / WDLW 任一場域代號或留空）
- 軟刪 3 個冗餘 admin_accounts（DB 操作）
- 單人遊戲對講機 UX（多人自動連、單人 QR 可選）
- Recur webhook 簽章 stub（HMAC SHA-256 實作 + 401 阻擋）

→ [docs/changes/2026-05-03-security-and-ux-fixes.md](2026-05-03-security-and-ux-fixes.md)

### D. 4 個 webhook signature timing-safe + shared util
- `lib/line-bot.ts` / `lib/recur-tw.ts` / `services/recur-client.ts` / `services/aihomi-adapter.ts`
- 提取共用 `lib/webhook-signature.ts`（verifyHmacSignature / verifySharedSecret）
- cron-endpoints token 也加入 shared util
- 全 server token/secret 100% timing-safe

### E. 公開 POST rate limit 補齊
- /api/apply（場域申請）：publicWriteLimiter 10/小時 per IP
- /api/invites/:token/click：hotPathLimiter 120/分鐘 per IP

### F. 第 14 個 host 元件 TeamBattleScore（紅藍對抗）
- 純 UI + reducer 純函式 + 17 unit tests
- W18 全 11 個 host pages config 統一 useMemo
- host-screen-components.md 對照表（13 → 14、5 大市場矩陣）

### G. 依賴漏洞修補（npm audit）
- 35 → 5 high（剩餘全是 dev only：vite/serialize-javascript/uuid/drizzle-kit）
- production critical: 1 → 0
- production high: 多 → 0
- drizzle-orm 0.39.1 → 0.45.2（修 SQL injection CVE GHSA-gpj5-g38j-94v9）

### H. 錯誤處理體系 3 階段
- **Stage 1（追查能力）✅ 上線**
  - useErrorReport 重啟（4/24 hotfix 註解解開）
  - error_logs schema +8 欄 +4 index（platform/requestId/sessionId/teamId/matchId/statusCode/method/route）
  - server 全域 middleware 寫 error_logs（5xx）
  - X-Request-Id middleware（全 request 注入 + response header）
  - 共用 `server/lib/error-logger.ts` util
  - 生產 ALTER TABLE 已執行
- **Stage 2（玩家不迷路）✅ 上線**
  - HostPlay 過期活動加替代入口（返首頁 / 重掃 QR）
  - HostScreen 缺 token / Session 過期加替代入口
  - WsConnectionBadge 共用元件 + GamePlay 多人組隊失連警示
- **Stage 3 部分（體驗一致性）**
  - ✅ #8 ErrorBoundary 複製錯誤資訊回報按鈕
  - 📋 #6 errorCode 規範（範圍 50+ 檔、留下個 sprint）
  - 📋 #7 5xx 專屬頁（待 #6 完成後一起）

→ [docs/changes/2026-05-03-error-handling-audit.md](2026-05-03-error-handling-audit.md) 完整盤點報告
→ [ADR-0016](../decisions/0016-error-handling-policy.md) 完整政策規劃

---

## 📦 健康狀態（session 收尾）

| 指標 | 狀態 |
|------|------|
| 完整 test:run | 157 檔 / 2210 tests 全綠 ✅ |
| TypeScript | 0 錯誤 ✅ |
| Smoke test | 51/51 ✅ |
| 生產 5 endpoints | 全 200 ✅ |
| 生產 CPU | 極低（< 5%）|
| 生產 Memory | ~327MiB / 1.5GiB（21%）|
| 累計 commits | 73（從 base `f04cefe4`）|
| Production critical 漏洞 | 0 ✅ |
| Production high 漏洞 | 0 ✅ |

---

## 📋 下個 Sprint 待做（依優先順序）

### P0：24 小時觀察期（先做）

**1. 確認 Stage 1 追查能力真實生效**
- 進 [/platform/errors](https://game.homi.cc/platform/errors) 看資料是否流入
- 期望看到：client errors（boundary / window-error / unhandled-rejection）+ server 5xx
- 失敗 → 排查 useErrorReport 是否有 React error #310 復現
- 排查方式：`docker logs gamehomicc-app-1 | grep "client-error\|error-logger"`

**2. 玩家測試體驗**
- 用 [docs/runbooks/2026-05-03-qa-test-checklist.md](../runbooks/2026-05-03-qa-test-checklist.md) 找人測
- 重點驗證：
  - super_admin 場域留空登入
  - 多人組隊隊員加入/離開即時通知
  - 單人遊戲對講機 UX
  - GamePlay 多人組隊 WS 失連警示

### P1：Stage 3 #6 + #7 完整實作

**規劃見 [ADR-0016](../decisions/0016-error-handling-policy.md)**：

#### Phase A：errorCode 中央定義（小、半天）
建立 `shared/lib/error-codes.ts`：
```typescript
export const ERROR_CODES = {
  AUTH_REQUIRED: { http: 401, message: "請先登入", retryable: false },
  PERMISSION_DENIED: { http: 403, message: "權限不足", retryable: false },
  NOT_FOUND: { http: 404, message: "找不到資源", retryable: false },
  RATE_LIMIT: { http: 429, message: "操作過於頻繁、請稍後再試", retryable: true },
  SERVICE_UNAVAILABLE: { http: 503, message: "服務暫時無法使用", retryable: true },
  INTERNAL_ERROR: { http: 500, message: "伺服器錯誤", retryable: true },
  TEAM_NOT_MEMBER: { http: 403, message: "你不是此隊伍成員", retryable: false },
  GAME_NOT_STARTED: { http: 400, message: "遊戲尚未開始", retryable: false },
} as const;
```

#### Phase B：server ApiError class（小、半天）
建立 `server/lib/api-error.ts`：
```typescript
export class ApiError extends Error {
  constructor(public code: keyof typeof ERROR_CODES, public details?: Record<string, unknown>) {
    super(ERROR_CODES[code].message);
  }
  toJSON() { /* { code, message, retryable, details } */ }
}
```

#### Phase C：route 漸進採用（中、1-2 天）
- 不一次全改、新 route 強制用 ApiError
- 高頻 / 重要 route（auth / scoring / payments）優先重構
- 既有 route 保留 `res.status().json({ message })` 不破壞

#### Phase D：client 解析 + ServerErrorView（中、1 天）
- `queryClient.ts` parse errorCode → `{message}（錯誤代碼：{code}）`
- 建 `ServerErrorView` 共用 component
- 業務頁 query failure 時用

→ 預估總時間：3-4 天獨立 sprint

### P2：依賴漏洞 dev only 修補

剩餘 5 個 high 全是 dev dependency（不影響 production）：
- vite via vitest（test runner）
- serialize-javascript via @rollup/plugin-terser（build tool）
- uuid via gaxios via @google-cloud/storage（dev / build）
- drizzle-kit 內部 @esbuild-kit/esm-loader（dev only）

`npm audit fix --force` 會 downgrade vite-plugin-pwa 0.19.8（不可接受）。
建議：等 vitest 主流版本演進、或手動測試各依賴升級影響。

### P3：refresh token 機制（UX）

當前：JWT 24 小時 hard expire、用戶被踢出
未來：refresh token 流程 + 自動 silent refresh

→ 範圍中、影響 admin 體驗、不影響玩家

### P4：cluster mode rate limit Redis 化

當前：cluster 4 workers 各自記憶體計數、實際 rate limit ×4 鬆
未來：用 RedisStore 共享計數

→ 等生產量上來再做

### P5：個資 / 越權審計

當前：未做、範圍大
未來：A 玩家能否看 B 玩家的資料？跨場域 / 跨用戶資料外洩風險？

→ 季度安全 review 級別

---

## 🚨 重要紅線 / 設計取捨（已記錄）

### 紅線（不可違反）
- ❌ 禁 WS 路徑做 DB write（[ADR-0015](../decisions/0015-websocket-anonymous-write-policy.md)）
- ❌ 禁 WS 路徑做 admin identity 決策
- ❌ 未來新 route 必用 ApiError + ERROR_CODES（[ADR-0016](../decisions/0016-error-handling-policy.md)）
- ❌ 禁直接 `res.status(500).json({ message: rawError })`（必走 error-logger）
- ❌ 禁直接比對 secret 用 `===`（必用 verifySharedSecret）

### 設計取捨（不算 bug、是有意設計）
- WS 純廣播事件（host_screen_pulse / race_answer / lock_coop / relay / territory）保留匿名（產品要求 LIFF 玩家）
- 5 個 dead WS broadcasts（user_joined / user_left / match_participant_*）保留給未來 toast / lobby 擴充
- HostPlay/HostScreen 不另建 WS badge（已用 query loading 當 indicator）

---

## 🛠️ 接手者 Quick Start

### 1. 確認當前狀態
```bash
git log --oneline -5
# 最新 commit 應是 c1ab07d6 或之後
```

### 2. 跑健康檢查
```bash
npx tsc --noEmit                          # 應 0 錯誤
node scripts/smoke-test-scenarios.mjs     # 應 51/51
npm run test:run                          # 應 157 檔 / 2210 tests
curl https://game.homi.cc/api/scenarios/health  # 應 200 OK
```

### 3. 看接手第一份文件
**[docs/runbooks/2026-05-03-qa-test-checklist.md](../runbooks/2026-05-03-qa-test-checklist.md)** — 給 QA / 業務的測試清單

### 4. 看設計決策
- [ADR-0014](../decisions/0014-realtime-protocol-cleanup.md) — Realtime 協定
- [ADR-0015](../decisions/0015-websocket-anonymous-write-policy.md) — WebSocket 匿名寫入政策
- [ADR-0016](../decisions/0016-error-handling-policy.md) — 錯誤處理政策

### 5. 看完整時序
[codex-claude/logs/2026-05-03.md](../../codex-claude/logs/2026-05-03.md) — 每筆 commit + 判斷理由

### 6. 啟動下個 sprint
- 建議第一步：先做 P0 觀察期（24h 看 PlatformErrorLogs 資料）
- 第二步：依本文件 P1 順序做 Stage 3 #6+#7（ADR-0016 已有完整規劃）

---

## 📊 73 commits 完整時序（重要里程碑）

| 時間 | commit | 內容 |
|------|--------|------|
| 11:30 | `84946958` | 起跑：React Hooks 順序 + 座標 0 值修 |
| 11:35 | `32428fae` | 10 失敗檔全修綠 |
| 12:00 | `44cc1c81` | Codex 第 1 輪 A+B：座標全鏈 + Hook deps |
| 12:25 | `60a628b3` | Codex 第 2 輪：useHostScreenSync hook opts dep |
| 12:35 | `ba0872f9` | Codex 第 3 輪 P0-A：Chat 雙寫 + WS auth bypass |
| 12:35 | `8b015cc2` | Codex 第 3 輪 P0-B：useTeamShootingSync 協定錯誤 |
| 12:50 | `1392305f` | Codex 第 4 輪：HostPlay/HostScreen 重複 WS |
| 13:05 | `092eba69` | Codex 第 5 輪：team realtime 系統性修法 |
| 13:25 | `e1844a2f` | ADR-0014 + 0015 文件化 |
| 13:35 | `120fda71` | race_answered 補完 |
| 14:00 | `04b68d99` | super_admin 不需區域代號進後台 |
| 14:10 | `df2c5855` | 對講機 UX 修法 |
| 14:25 | `cd766036` | 4 個 webhook signature timing-safe |
| 15:00 | `8c722355` | shared util 重構（webhook-signature.ts）|
| 15:25 | `0bef2190` | 公開 POST rate limit 補齊 |
| 15:45 | `d01f73e6` | super_admin 跨場域 active filter |
| 16:00 | `87c8d5a6` | switch-field 改 requireAdminAuth |
| 16:15 | `5a3f809b` | 第 2 輪資安 P0：match_countdown 認證 |
| 16:30 | `a7093508` | 第 3 輪資安 P1：4 個 WS 強制 authenticatedUserId |
| 16:45 | `b512a7b0` | 第 4 輪資安：WS-level rate limit |
| 17:00 | `648d04f0` | 第 5 輪資安 P0 #3：join 用 effectiveUserId |
| 17:30 | `2199cbfe` | drizzle-orm 0.45.2（SQL injection CVE）|
| 17:50 | `648fef51` | 錯誤處理盤點報告 |
| 18:30 | `91033939` | Stage 1 追查能力（useErrorReport + middleware + schema）|
| 18:50 | `95145eea` | Stage 2 玩家不迷路（HostPlay 替代入口 + WsBadge）|
| 19:10 | `cb4367e7` | Stage 3 #8 + ADR-0016 |
| 19:15 | `c1ab07d6` | 結尾紀錄 |

---

## 🎯 一句話總結

**今天 73 commits 上線：Codex 9+5 輪雙重審查全處理 + 5 個使用者問題修法 + 第 14 個元件 + 完整錯誤處理體系（追查 + 不迷路 + 自助回報）。生產 critical/high 漏洞清零、156 → 157 檔測試 / 2163 → 2210 tests 全綠。**

下個 sprint 第一步：**24 小時觀察 PlatformErrorLogs 是否開始有資料**、然後啟動 Stage 3 #6+#7（ADR-0016 完整規劃）。
