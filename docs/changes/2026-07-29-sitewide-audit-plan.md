# 全站通盤盤點與優化計畫 — 2026-07-29

> 範圍：賈村數位遊戲平台全站（server + client + shared + 生產環境）
> 狀態：**盤點完成、待使用者確認後執行**
> 基準 commit：`f536d409`（已 push GitHub，尚未部署生產）

---

## 一句話現況

**程式碼健康度良好**（技術債標記僅 8 處、索引覆蓋 317/90 表、安全 headers 全綠），
**但有 3 個必須處理的問題**：生產版本落後 11 個 commit 且 `/api/version=unknown`、
`scenarios.ts` 存在會導致預設值錯誤的重複 case bug、金流與預約端點缺 rate limit。

---

## 一、現況快照

| 項目 | 數值 | 評價 |
|------|------|------|
| 總程式碼行數 | 297,529 行 | — |
| server / client / shared 檔數 | 339 / 878 / 88 | — |
| 前端路由 | 198 個 | 規模大 |
| API 端點 | 399 個 | 規模大 |
| 資料表 / 索引 | 90 表 / 317 索引 | 🟢 覆蓋良好 |
| 測試檔 | 298 個（server 50 / client 147 / shared 4 / e2e 24） | 🟢 |
| TODO/FIXME 技術債 | 8 處 | 🟢 極低 |
| @ts-ignore | 0 | 🟢 |
| 依賴數 | 100 prod + 38 dev | 🟡 偏多 |

### 檔案行數分布（紅線：單檔 ≤ 800 行）

| 等級 | 檔數 | 佔比 |
|------|------|------|
| 🟢 < 500 行 | 1,196 | 90.6% |
| 🟡 500–800 行 | 82 | 6.2% |
| 🟠 800–1000 行 | 12 | 0.9% |
| 🔴 > 1000 行 | 15 | 1.1% |

**結論**：90.6% 的檔案合規，違規集中在 27 個檔（2%）。

---

## 二、功能領域盤點

### 後端 API（399 端點，依領域）

| 領域 | 端點數 | 說明 |
|------|--------|------|
| admin | 107 | 後台管理（遊戲/場域/帳號/角色/報表） |
| platform | 76 | 平台級（super_admin、多租戶、計費） |
| pos | 27 | POS 點餐、結帳、班別、報表 |
| battle | 22 | 水彈對戰（賽季/排名/場地/時段/報名） |
| devices | 17 | IoT 裝置（MQTT v1、LED、命中記錄） |
| games | 16 | 遊戲 CRUD、關卡、QR |
| squads | 12 | Squad 永久身份系統 |
| matches | 10 | 對戰媒合 |
| bookings | 8 | 預約系統 |
| locations | 7 | 地點與 GPS 驗證 |
| payments | 6 | Stripe / recur-tw 金流 |
| ai | 6 | AI 評分、內容生成 |
| 其他 | 85 | auth/cron/fields/sessions/webhooks… |

### 前端頁面（198 路由，三大區）

1. **玩家端**：`/`、`/f/:fieldCode/*`（多場域入口）、遊戲進行、Squad、排行榜、預約
2. **場域後台** `/admin/*`（約 60 頁）：遊戲編輯器、裝置、POS、預約、活動、報表、AI 工具
3. **平台後台** `/admin-staff/*`（約 14 頁）：跨場域管理、帳號、稽核、工單

### 核心子系統

| 子系統 | 狀態 |
|--------|------|
| Squad 永久身份 | ✅ 已統一（battle_clans 寫入凍結） |
| 多場域隔離 | ✅ fieldId + `/f/:fieldCode` |
| MQTT v1 裝置整合 | ✅ 契約凍結 + HMAC 簽章（**本地完成、未部署**） |
| PWA 三層版本檢查 | ⚠️ **失效中**（`/api/version=unknown`） |
| WebSocket 多人同步 | ✅ 單 worker 紅線（CLUSTER_WORKERS=0） |
| Firebase Auth + Admin JWT | ✅ 雙軌並存 |

---

## 三、發現的問題（依嚴重度）

### 🔴 P0-1：生產版本落後且 PWA 自動更新失效

- 生產 `/api/version` 回 `{"commit":"unknown"}` → 前端版本比對直接 return → **PWA 永遠不會自動更新**
- 根因：某次用手動 `docker compose --build` 部署（沒帶 `GIT_SHA`）
- 連帶風險：換 chunk hash 後舊 bundle 使用者 lazy-load 失敗 → Safari `_result.default` 錯誤
- 現況加劇：本地已 push 11 個 commit（含 MQTT HMAC 全套），生產完全沒有

### 🟡 P0-2【已修正 + 判斷更正】：`scenarios.ts` 重複 case

**原判斷（2026-07-29 初稿）**：「重複 case 導致 `hope_fear`/`idea_market` 預設值錯誤」→ **不成立，已更正**。

**查證後的事實**：
- 這兩個 pageType **不在** `SCENARIO_TEMPLATES`（模板實用 30 種）、**不在** `PAGE_TYPES`（前端註冊 107 種）、
  **不在** `GamePageRenderer`（渲染器支援 100 種）→ 它們本來就不會被呼叫
- 因此重複 case 的實際功能影響 = **零**，屬死碼內部的重複
- 但 esbuild 每次 build 都報 `duplicate-case` 警告，屬程式碼衛生問題

**處置**：已刪除後出現的重複 case（保留原生效版本，行為完全不變），
build 警告歸零，並在 CI 加防護（commit `311cbb74`、`cebadaa5`）。

### 🟠 P0-3【新發現】：`getDefaultConfigForPageType` 大量死碼

| 指標 | 數值 | 可信度 |
|------|------|--------|
| 函式長度 | 2,823 行（紅線 50 行） | ✅ |
| case 總數 | 347 個 | ✅ |
| 前端渲染器支援 | 100 種（`GamePageRenderer`） | ✅ |
| 模板實際使用 | 30 種 | ✅ |
| 推估死碼 case | ≥ 289 個（約 83%） | ⚠️ 方向可靠，精確數字需人工核對 |

**為何數字需保守**：自動比對會把其他 switch 的 case（如 `gps`/`photo`/`message`）誤計為 pageType，
故「渲染器支援數」偏大、死碼數反而被低估。清理前必須人工逐項確認。

**影響**：死碼本身不影響執行，但它是 bug 溫床（重複 case 正是被 2,823 行的體積掩蓋）。

### 🟠 P1-1：金流與預約端點缺 rate limit

| 端點 | 認證 | Rate limit | 風險 |
|------|------|-----------|------|
| `POST /api/payments/create-checkout` | ❌ 無 | ❌ 無 | Stripe API 被濫用刷配額／費用 |
| `POST /api/bookings` | ❌ 無 | ❌ 無 | 惡意灌爆預約佔滿時段 |

- 已驗證**不是**價格竄改風險（價格由 server `defaultPrice()` 決定，未信任前端）
- 對照組（已做對的）：`cron` 有 `CRON_SECRET` timing-safe 驗證、`error-log` 有自訂 rate limit
- Rate limit 覆蓋率：僅 16/119 個路由檔

### 🟠 P1-2：27 個檔案超過 800 行紅線

最嚴重前 8 名：

| 檔案 | 行數 |
|------|------|
| `server/routes/scenarios.ts` | 3,448 |
| `server/routes/platform.ts` | 2,800 |
| `client/src/pages/admin/FieldSettingsPage.tsx` | 2,343 |
| `client/src/pages/game-editor/PageConfigEditor.tsx` | 2,193 |
| `client/src/pages/AdminDashboard.tsx` | 1,606 |
| `client/src/pages/game-editor/page-config-inline-editors.tsx` | 1,582 |
| `server/routes/websocket.ts` | 1,259 |
| `client/src/pages/admin/AdminBookings.tsx` | 1,175 |

### 🟡 P2-1：Bundle 體積

- 主 bundle `index.js` **680 KB**（2026-07-09 曾優化到 622 KB → 回胖 58 KB）
- JS 總計 6.4 MB / 353 chunks
- 大宗：`livekit-client` 480K、`vendor-charts` 384K、`vendor-ui` 284K、`vision_bundle` 136K、`jsQR` 128K
- livekit / vision / jsQR 屬特定功能，應確認是否已 lazy load

### 🟡 P2-2：console.log 殘留（紅線）

- server 90 處、client 21 處（已排除測試檔）
- 紅線明訂「禁止 console.log 留正式版」
- 註：部分 server 端可能是有意的結構化 log，需逐一判斷後改用 logger

### 🟡 P2-3【新發現】：ESLint 約 450 errors / 3,278 warnings

CI 的 ESLint 步驟目前掛 `continue-on-error: true`（報告但不擋 merge），
註解寫明「待技術債清乾淨後轉為硬閘門」。這是本次盤點初稿漏記的項目。

### 🟢 P3：`as any` 184 處

紅線禁用 `any`。184 處需分批收斂，但多數應屬第三方型別缺失的邊界處理，優先度最低。

---

## 四、優化計畫（分 4 批）

### 第 1 批：P0 修復（建議立即，約 1–2 小時）

| # | 項目 | 狀態 |
|---|------|------|
| 1 | 部署恢復 | 🔴 **阻塞中** — 源站 SSH 不可達，需先解除封鎖 |
| 2 | 重複 case | ✅ **已完成** `311cbb74` — 刪 2 個死碼 case，build 警告歸零、行為不變 |
| 3 | 迴歸防護 | ✅ **已完成** `cebadaa5` — CI 攔截 duplicate-case，YAML 已驗證 |

### 第 2 批：P1 安全與結構（約 3–5 小時）

| # | 項目 | 動作 |
|---|------|------|
| 4 | 金流 rate limit | `payments/create-checkout` 掛 limiter（建議 10 次/15 分/IP） |
| 5 | 預約 rate limit | `POST /api/bookings` 掛 limiter（建議 5 次/30 分/IP） |
| 6 | rate limit 稽核 | 掃 399 端點，對照全域規範表補齊公開端點 |
| 7 | 拆 `scenarios.ts` | 2,823 行巨型函式 → 按元件類別拆成 config map 模組（消除同類 bug 溫床） |

### 第 3 批：P2 效能（約 2–4 小時）

| # | 項目 | 動作 |
|---|------|------|
| 8 | bundle 回胖分析 | 比對 7-09 基準，找出多出來的 58 KB |
| 9 | 重型套件 lazy load | 確認 livekit / vision_bundle / jsQR 只在用到的頁面載入 |
| 10 | console.log 清理 | server 90 + client 21 處，改 logger 或移除 |

### 第 4 批：P3 健康（持續）

| # | 項目 | 動作 |
|---|------|------|
| 11 | 拆其餘大檔 | 26 個 >800 行檔案，每次改到就順手拆 |
| 12 | `as any` 收斂 | 184 處分批補型別 |
| 13 | 文件更新 | `next-action-guide.md` 停在 2026-05-07，需更新到現況 |

---

## 五、不建議做的事

- **不要**大規模重寫 `scenarios.ts`：221 個 case 對應真實情境設定，一次全改風險極高，應按類別分批搬移並保留測試
- **不要**為降 bundle 而移除 livekit：那是多人視訊核心功能
- **不要**動 `CLUSTER_WORKERS`：紅線，開多 worker 會多人腦裂（ADR-0023）

---

## 六、驗證方式

每批完成後：
1. `npx tsc --noEmit` 零錯誤
2. `npm run test:run` 全綠
3. `npm run build` **零警告**（含 duplicate-case）
4. 部署後 `curl https://game.homi.cc/api/version` 回真實 commit

---

## 相關文件

- 前次全站優化：[2026-07-09-sitewide-optimization.md](2026-07-09-sitewide-optimization.md)
- MQTT 裝置整合：[2026-07-22-mqtt-device-integration-plan.md](2026-07-22-mqtt-device-integration-plan.md)
- 部署規範：`~/.claude` memory `game-deploy-command`
