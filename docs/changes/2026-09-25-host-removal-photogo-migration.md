# 大螢幕互動移交 PhotoGo：CHITO 完整清除 + PhotoGo 補齊 — 2026-09-25

> 範圍：CHITO 移除整條 HostScreen 軸（程式、模板、入口、文件）；PhotoGo 補到現場等級與功能對等
> 狀態：**執行中**／上游：[穩定度評估](2026-09-25-hostscreen-stability-evaluation.md)
> 業主決定（2026-09-25 原話）：「把功能完整的移動到 PhotoGo，CHITO 就清乾淨，大螢幕遊戲都沒有再用，所以不用擔心會有問題，系統完整到 PhotoGo，CHITO 完整清乾淨是重點」
> B-0 止血已部署 `5571da9f`（模組預設關）；本文是接下來的完整清除

## 影響範圍（清除前實查）

| 類別 | 數量 | 內容 |
|---|---|---|
| 整檔刪除 | 12 檔 + 2 目錄 | `components/game/host/`（38 檔）與其 `__tests__/`（17 檔）、`useHostScreenSync.ts`、`HostScreen.tsx`、`HostPlay.tsx`、`PlayLiff.tsx`、`AdminHostSessions.tsx`、`routes/host-sessions.ts`、`routes/admin-trivia.ts`、`showcase/InteractiveDemo.tsx`、`showcase/W22DemoSection.tsx`、`e2e/host-*.spec.ts` ×2、`scripts/scaffold-host-component.mjs`、`HostComponentEditor.tsx` + 測試 |
| 逐一拆線 | ~50 檔 | `scenario-templates.ts`（72 處）、`ShowcaseHub.tsx`（46）、編輯器 `constants.ts`（44）、`scenarios.ts`（29）、`websocket.ts`（22）、`GamePageRenderer.tsx`（19）、`getDefaultConfig.ts`（18）、`multiplayer-component-types.ts`（14）、`scenario-content-generator.ts`、`admin-line-actions.ts`、`TemplateMarketDetail.tsx`、`api/v1.ts`、`scenario-instantiator-line.ts`、`expiring-session-checker.ts`、`page-types.ts`、`Faq.tsx`、`App.tsx`、`test-only.ts`、`admin-pilot-health.ts`、`admin-multi-sessions.ts`、`ScenarioQrPrint.tsx`、`WebSocketContext.tsx`、`resend-mailer.ts`、`line-webhook.ts`… |
| 情境模板 | 13 個**全部**含 host | **6 個純大螢幕情境整個移除**：婚禮派對、生日派對、同學會／聚會、園遊會主舞台、破冰熱場、頒獎典禮 → PhotoGo 已有同名 6 個（另有尾牙春酒、講座研討會）；**7 個混合情境拔掉大螢幕頁**：街區走讀（剩 gps_cascade）、商圈打卡（剩 treasure_hunt）、企業內訓（剩 8）、員工旅遊（剩 4）、親子冒險（剩 2）、場域故事（剩 2）、實體打擊競技場（剩 2） |
| 資料庫 | **不動** | `game_sessions.host_mode / host_token / host_token_expires_at` 三欄與 `trivia_answers` 表保留（表只加不刪）；schema 檔留著加「已停用」註解，避免 drizzle 想刪欄 |
| 生產資料 | 18 場 host 場次 | 全部已是 completed / abandoned，保留不動 |

商業情境對照（[business-model.md](../domains/business-model.md) 五大情境）：#2 私部門活動、#3 活動、#5 交誼破冰的「大螢幕熱場」部分**整個轉為 PhotoGo 的業務**；CHITO 保留 #1 公部門（街區走讀、商圈打卡）、#4 空間活化（場域故事、親子冒險、打擊競技場）與企業內訓的手機協作部分。

## CHITO 清除順序（每段 tsc + 全套測試 + 單獨 commit；全部完成才部署）

| 段 | 內容 | 驗收 |
|---|---|---|
| R1 入口 | `App.tsx` 拿掉 `/host /play /liff/play /admin/host-sessions`；`routes/index.ts` 拿掉 host-sessions 與 admin-trivia 註冊；選單項移除；刪 4 頁 + 2 路由檔 + showcase 兩個 demo 檔 + e2e 兩支 + scaffold 腳本；`/showcase` 拿掉 host 展示段（留 multi 協作 demo 與 PhotoGo 告示）；Faq / PitchDeck / TemplateMarket「管理我的場次」文案 | 打 `/host/x` → 404 頁；`/showcase` 200 |
| R2 模板與建場 | `scenario-templates.ts` 移除 6 個純 host 情境、7 個混合情境拔 host 元件；`scenarios.ts` `instantiateComponent` 拿掉 isHost 分支（含 B-0 的模組檢查）；`scenario-instantiator-line.ts`、`admin-line-actions.ts`、`api/v1.ts` 的 host 場次路徑；`scenario-content-generator.ts` host 提示詞；`TemplateMarket` / `TemplateMarketDetail` 免登入判斷改為「無 host」；`ScenarioQrPrint` | 模板市集 7 個情境、都能一鍵建場；`shared/__tests__/scenario-*.test.ts` 更新後通過 |
| R3 元件與編輯器 | 刪 `components/game/host/` 與測試、`useHostScreenSync`；`GamePageRenderer` 17 個 host_* case；編輯器 `constants.ts` 17 筆 + `host_screen` 分類 + `EditorMode` 'activity' 的 host 部分；`HostComponentEditor` + 測試；`getDefaultConfig`；`page-types.ts`；`multiplayer-component-types.ts` host 型別；`ToolboxSidebar` 的 B-0 過濾 | 編輯器工具箱無 📺 元件；`constants.test.ts` 更新通過 |
| R4 伺服器與即時 | `websocket.ts` 三種 `host_screen_*` 訊息、`hostScreenClients / hostPlayerClients / hostSessionStateCache` 與回收、`broadcastToHostSession`；`expiring-session-checker.ts` host 分支；`resend-mailer.ts`、`admin-pilot-health.ts`、`admin-multi-sessions.ts` + `AdminMultiSessions.tsx`、`player-sessions.ts`、`admin-sessions.ts`、`test-only.ts`、`types.ts`、`line-webhook.ts`、`WebSocketContext.tsx` host 分支；`observability.ts` 的 hostToken 遮罩留著（歷史資料仍可能含） | WS 測試通過；`playerSessions.test.ts` 更新 |
| R5 收尾與守護 | `module-registry` 拿掉 `host`、`admin-fields.ts` / `FieldThemeProvider` / `admin-menu` 的 host 鍵、B-0 三支測試改為「host 已移除」守護（全專案不得再出現 `host_` pageType、`/host` 路由、`hostMode: true` 寫入）；ADR-0029「大螢幕互動移交 PhotoGo」+ ADR-0004 標 Superseded；`domains/host-screen-components.md`、`host-multi-pairing.md` 搬 `archive/`；`docs/README`、CLAUDE.md 導航；CHANGELOG | 守護測試通過；`npx tsc` 0；全套 vitest；e2e：訪客 QR / 組隊 / 競賽 / 接力 4 支真瀏覽器回歸 |

預估 3–4 天。R1–R5 完成後一次部署（等口令）；部署後驗：`/host/任意` 404、模板市集 7 情境可建場、既有玩家動線不變。

部署時必做（R4 發現）：
- 生產主機 crontab 有 `0 * * * * curl … /api/cron/check-expiring-sessions`（host token 到期提醒，端點已移除）→ 部署時**刪掉這行**，否則每小時 404
- `scripts/smoke-test-scenarios.mjs` 已改打 `generate-session-reports`，部署後跑一次 smoke

## PhotoGo 補齊（在 `/projects/互動`；另開工作串）

### 現場等級（必做，5–7 天）

| # | 項目 | 內容 |
|---|---|---|
| P1 | 限流 | 連點類（情緒池／人浪／拔河／紅包雨）手機端每 250ms 合併送出；「每來源每活動 10 分鐘」上限依玩法分級；文件補齊 |
| P2 | 壓測 | k6：300 併發手機 `/m/interactive` + 大螢幕 `/state` 輪詢，看 DB 與 350MB 記憶體；結果寫進 `interactive.md` 驗收清單 |
| P3 | 主機 | 搬獨立機（Linode 4GB）；現在 2GB 跟 4 個別的產品共用 |
| P4 | 告警 | 接 Telegram；互動事件：大螢幕離線 > 2 分鐘、限流命中、`/state` 慢查詢 |
| P5 | 免配對大螢幕 | 有期限的大螢幕網址（沿用 host link 作法），主持人用筆電開網址就能投影 |
| P6 | 文件 | `overview.md:160`、`interactive.md:124` 改成實際的 server 權威架構 |

### 功能對等（CHITO 有、PhotoGo 沒有；依需求排序）

| # | 功能 | 估 |
|---|---|---|
| F1 | 通用排行榜（主持人手動加減分） | 0.5–1 天 |
| F2 | 隊伍對戰：自訂隊名、自選隊、主持人加分（現在拔河只能依加入順序分紅藍） | 1–2 天 |
| F3 | 搶答：一個活動多題 + 作答中即時前 3（防洩題） | 1–2 天 |
| F4 | 全場進度任務 | 0.5 天 |
| F5 | 跑馬燈公告型別（score / celebrate） | 0.5 天 |
| F6 | 拍立得牆的手機文字卡模式 | 0.5 天 |
| F7 | 場域全景地圖打卡（KnowledgeMap：上傳地圖、設 POI、手機免 JS 選點） | 2–3 天 |

情境模板：CHITO 的 6 個純大螢幕情境 PhotoGo 已有同名對應，不需搬。

### 首場驗證

賈村下一場現場活動用 PhotoGo 跑完整場（大螢幕 + ≥ 30 支手機），看告警與壓測數字；**沒跑過一場真的之前不對外賣**。

## 相關

- [穩定度評估](2026-09-25-hostscreen-stability-evaluation.md)、[定位分析（已取代）](2026-09-25-showcase-photogo-positioning.md)
- [ADR-0004 host-screen-axis](../decisions/0004-host-screen-axis.md)（將標 Superseded by ADR-0029）
- PhotoGo：`docs/domains/interactive.md`、`docs/runbooks/go-live-checklist.md`
