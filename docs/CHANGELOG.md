# CHANGELOG

> 版本紀錄總表 — 每版 ≤ 50 行，細節連結到 [`changes/`](changes/)
> 格式：`feat:` 新功能 / `fix:` 修復 / `refactor:` 重構 / `docs:` 文件 / `chore:` 雜項

---

## 2026-06-13 (d)

### 🔐 場域執行者現場帳號 + 全域變更稽核 + 退款開放（feat / security）
**狀態**：🟢 部署上線（commit `8859e19f`）
**細節** → [changes/2026-06-13-field-mode-telegram-bookings.md](changes/2026-06-13-field-mode-telegram-bookings.md)（四、五節）

- **場域執行者**：登入直接進 /pos 現場模式、看不到後台設定（ProtectedAdminRoute 導向 + PosLayout 隱藏後台鈕）；角色加 `game:edit` → 可排障（重置/卡關救援）
- **退款開放現場**：`field:manage`→`game:edit`，沿用強制理由（≥5字）+ refunds 表 + audit log
- **全域變更稽核**：新增 auditMutationMiddleware — 所有 /api/admin、/api/pos 的 POST/PUT/PATCH/DELETE 成功後自動寫 audit_log（操作者+時間+路徑+body摘要+IP），敏感欄位遮罩、未來端點自動涵蓋、長期保留
- **驗證**：tsc PASS；audit 中介層 7 測試 + shared 共 92 passed；生產 version=8859e19f、3 個 field_executor 角色已授 game:edit、cron 啟動

---

## 2026-06-13 (c)

### 🏪 現場模式 + Telegram 賈村群組通知 + 體驗預約強化（feat）
**狀態**：🟢 部署上線（commit `6ce3752f`）
**細節** → [changes/2026-06-13-field-mode-telegram-bookings.md](changes/2026-06-13-field-mode-telegram-bookings.md)

- **現場模式**：修 PlayerBottomNav 洩漏 /pos（玩家選單蓋掉 POS）；PosLayout 現場 6 選單（首頁/掃描/預約/收款/核銷/排解）；AdminDashboard 加「🏪 進入現場模式」入口
- **Telegram 賈村群組**（`-5126162505`，與個人 ops chat 分流）：新預約（含人工登記）、賈村遊戲開玩（時間/遊戲/帳號）、今日預約晨報（每天 08:00 Taipei，新 today-bookings-cron）
- **體驗預約**：人工登記（電話預約，createManualBooking + dialog）、今日/本月/未來快速檢視
- **新 env**：`TELEGRAM_FIELD_GROUP_CHAT_IDS`、`TELEGRAM_GAME_NOTIFY_FIELD_ID`（已加生產）
- **驗證**：tsc PASS；742 單元 passed；bot 端到端發群組成功；生產 version=6ce3752f、cron 啟動

---

## 2026-06-13 (b)

### 🎨 template-market 12 情境主題化呈現（feat）
**狀態**：🟢 部署上線（commit `d0cb232e`）
**細節** → [changes/2026-06-13-template-market-prune.md](changes/2026-06-13-template-market-prune.md)（第三輪）

- **問題**：`getDefaultConfigForPageType` 只用 pageType 當 key、不分情境 → 同學會/園遊會/頒獎的投票全顯示「範例:你最想看哪個橋段?」佔位，一鍵建場後無法直接用
- **解法**：`ScenarioComponent` 加 `config?` 欄位；instantiate 優先序 `aiConfig ?? component.config ?? default`；23 個元件填主題化內容（祝福牆 theme、投票/搶答真實題目、尋寶線索、NPC 對白、角色分派…）
- **向後相容**：沒填 config 的元件 fallback 回原 default
- **驗證**：tsc PASS；新增 `scenario-config.test.ts`（9 測試:形狀+無佔位）；shared 85/85；e2e 18/18；部署後生產 version=d0cb232e、health=12

---

## 2026-06-13

### 🎯 template-market 12 情境瘦身 + 登入優化（fix / refactor / feat）
**狀態**：🟢 部署上線（commit `a0dfc74e`）
**細節** → [changes/2026-06-13-template-market-prune.md](changes/2026-06-13-template-market-prune.md)

- **瘦身**：上一輪 loop 灌成 112 情境 / 338 元件（含 70% 無 renderer 的幽靈元件，玩家看到「未知頁面類型」）→ 清除 99 個無實質意義樣板 + 121 個幽靈元件，回歸 12 個全部可運作的情境（檔案 5106→673 行）
- **修 bug**：詳情頁 `useAdminAuth()` 預設把未登入訪客導向 `/admin/login` → 改 `redirectTo:""`，銷售頁恢復公開可瀏覽
- **使用情境優化**：6 個社交情境（婚禮/生日/同學會/園遊會/頒獎/破冰）的 multi 元件換成匿名 host 等價版 → 全程免登入掃 QR 即玩；詳情頁新增登入需求標示
- **防呆**：新增 `scenario-renderable.test.ts` 不變式鎖死「每元件都有 renderer」
- **驗證**：tsc PASS；scenario 24/24；e2e 18/18；部署後生產 version=a0dfc74e、health=12 情境、首頁/template-market 200

---

## 2026-05-31

### 🛡️ Repo 衛生 + 安全護欄 + CI 可信度（chore / fix）
**狀態**：🟢 部署上線（commit `20b1c8b6`）
**細節** → [changes/2026-05-31-repo-hygiene-security-hardening.md](changes/2026-05-31-repo-hygiene-security-hardening.md)

- **安全護欄**：API logger 遮罩敏感欄位（production 不記 response body）；`/api/health/detail` 加 `HEALTH_SECRET` 守門（已驗證生產不再洩漏 memory/pool）；rate-limiter IPv6 正規化防繞限速；seed 生產守門 + 密碼環境變數化
- **部署安全**：`deploy.sh` 改「工作區不乾淨即中止」（不再自動收檔）；`deploy.yml` health 失敗即失敗
- **CI 可信度**：ESLint ignores 修正（lint 噪音 16 萬→真實 345 errors）；CI 補 lint；移除掩蓋 schema 的 continue-on-error；vitest retry CI 設 0（測試 547s→30s）
- **Repo 衛生**：DB dump / coverage / 測試產物移出版控 + gitignore
- **驗證**：tsc 零錯誤；測試 53 既有失敗零 regression；部署後生產 health/version 全綠

---

## 2026-05-25

### 🐛 遊戲 QR Code 編碼為 localhost URL（fix）
**狀態**：🟢 部署上線

**症狀**：使用者掃 QR Code 解碼出 `http://localhost:3333/g/xxx`、無法進入遊戲。

**根因**：
- DB `games.qr_code_url` 欄位儲存的是 **PNG DataURL**（不是純 URL）
- 過去產生時 server `resolveBaseUrl()` fallback 到 `localhost:3333`（無 PUBLIC_BASE_URL）
- 那個 localhost URL **被 QR Code 編碼進 PNG**、存進 DB
- 之後即使生產 `.env` 設了 `PUBLIC_BASE_URL=https://game.homi.cc`、**PNG 內容也不會自動更新**
- `GET /api/admin/games` 列表直接回傳 DB cached PNG → 玩家拿到舊版

**修法**：
1. 清空所有 `games.qr_code_url`（15 筆）— 強制每次都動態生成
2. `GET /api/admin/games` 與 `GET /api/admin/games/:id` 回傳時剝離 `qrCodeUrl`（防未來再有 cache 風險）
3. `QRCodeDialog` 與 `AdminStaffQRCodes` 對話框開啟時自動觸發 `POST /api/admin/games/:id/qrcode` 即時生成
4. 表格 QR 狀態判定改用 `publicSlug`（而非 `qrCodeUrl`）

---

## 2026-05-22

### 🎯 多元定位驗證系統 — GPS 替代方案（feat）
**狀態**：🟢 部署上線（2026-05-22 22:38）
**細節**：[changes/2026-05-22-multi-tier-location-verification.md](changes/2026-05-22-multi-tier-location-verification.md)
**ADR**：[decisions/0021-multi-tier-location-verification.md](decisions/0021-multi-tier-location-verification.md)

業主反映「學校場域 GPS 統一被關、遊戲卡關」、現場手機訊號薄弱但有 WiFi。完整重構定位驗證為五層備援架構：

```
GPS → QR Code → 數字代碼 → PDR 相對定位 → 管理員救援
```

主要變動：
- Schema：`locations` 加 `verificationMode/Code/qrToken/allowAdminRescue/referenceImageHash`；`location_visits` 加 `verifyMethod/verifyMetadata`
- 後端：`server/lib/location-verification.ts` 統一分流、`/api/sessions/.../visit` 接 `verifyMethod`、`admin-rescue.ts` 救援端點
- 玩家端：`LocationVerifier` / `LocationQRScanner` / `ARVerifier` 元件、`usePDRNavigation` Hook
- Admin：`LocationVerificationConfig` 設定區塊、`LocationPrintSheet` 列印頁、`StuckPlayersPanel` 救援面板
- WiFi SSID / iBeacon / NFC 在 web 端**不可行**（瀏覽器限制），未來原生 APP 才能加

### 🐛 CHITO 5/20 docx 第二批 3 項修正（業主截圖 repro 後）
**狀態**：🟢 部署上線（commit d81ea7c7）
**細節**：[changes/2026-05-22-chito-feedback-batch.md](changes/2026-05-22-chito-feedback-batch.md) 第二批段落

| # | 問題 | 修法 |
|---|------|------|
| 1 | 多人卡「同步隊伍進度中」 | ChoiceVerifyRacePage 加 8s timeout + 重試按鈕（loading / error 兩處都加）|
| 2 | 對講按鍵窄裝置消失 | WalkiePill 預設 y=80 改 110（高過底部 nav 90px）+ loadPos 加 viewport clamp + resize/orientation listener |
| 12 | 點數通知藍色橫幅遮擋 | RewardFeedback 只有點數的事件跳過橫幅、保留 haptic + GameHeader 既有 +N 動畫；道具/成就仍保留 |

剩 **#15 通過頁 1 又跳回頁 1** 仍待業主提供 repro 步驟（哪個遊戲 / 頁 1 元件類型）。

### 🐛 CHITO 5/20 docx 第一批 7 項修正
**狀態**：🟢 部署上線（commit bbabbf1d + 2f7c9c3f + fb7a4791）
**細節**：[changes/2026-05-22-chito-feedback-batch.md](changes/2026-05-22-chito-feedback-batch.md)

業主第二輪驗收 docx 提出 10 個問題、第一批 7 項已修：

| # | 問題 | 修法重點 |
|---|------|---------|
| 11 | **保留進度沒「繼續」、按返回跳完成** | GameBySlug 改三態按鈕（never/playing/completed）、`?restart=1` 帶入 GamePlay 強制 replay 路徑 |
| 14 | runtime 中又彈「偵測到上次進度」 | 移除 GamePlay 冗餘 ResumeDialog 第二處、useSessionManager 加 `!state.sessionId` 防衛 |
| 13 | 「遊戲開始祝你好運」黑色橫幅 | 直接移除 toast |
| 3 | 字體切換無效 | 根因：`.game-prose` 0 元件用、main 加 class + 擴大繼承到 div/h1-h4/button/label |
| 4 | <380px 按鈕被裁 | GameHeader RWD 強化（max-w-full + 縮 padding + icon h-9 sm:h-10）|
| 9 | 按鈕長文字超出 | break-words whitespace-normal min-w-0 |
| - | （未涉及 docx）| 平板放行（5/20 已部署） |

**等業主回報 repro**：#1 多人卡同步 / #2 對講按鍵消失 / #12 藍色橫幅位置 / #15 頁 1 跳回

---

## 2026-05-20

### 📱 平板開放、桌機仍封鎖
**狀態**：🟢 部署上線（commit 2b8bd410）

DeviceGate.tsx：放行條件從 `isMobile` 改成 `isMobile || isTablet`。
useDeviceType.ts：補 iPad Pro 12.9 偵測（UA 偽裝 Macintosh、寬 1366）`isTouch + Macintosh → tablet`。
UseOnMobileScreen.tsx 文案改成「請改用手機或平板」。

### 📷 LINE 內建瀏覽器拍照 fallback
**狀態**：🟢 部署上線（commit f5e88097）

LINE WebView 沙箱不允許 getUserMedia。修法三層保護：
- 永遠顯示「從相簿選照片」備用按鈕（原本故意隱藏）
- 偵測 LINE 環境（UA 含 `Line/`）→ 顯示提示
- 相機錯誤 banner 加「從相簿選」雙按鈕

---

## 2026-05-19

### 🆘 後台導航重構 + 排解中心（5 Phase 一日完成）
**狀態**：🟢 全部部署上線
**細節**：[changes/2026-05-19-admin-nav-rescue.md](changes/2026-05-19-admin-nav-rescue.md)

業主回報「整體選單超級複雜」、依使用情境重組 + 新增「排解中心」處理現場問題（重來 / 退款 / 改梯次 / 補償）。所有操作留時間 + 操作者紀錄。

| Phase | 部署 commit | 內容 |
|-------|------------|------|
| **A** 選單情境化 | `556a6553` | 5 群（設計/現場/排解/紀錄/設定）取代 12 分組 40+ 項；對戰歸「設計」、財務歸「紀錄」；6 排解子路由佔位 |
| **B** Audit 覆蓋（3 批） | `c72e13e7` / `a15edc0b` / `1fcbef23` | POS 7 endpoint + admin-bookings/activities/redeem-codes/feature-flags/purchases/line-config/settings/sessions/rewards 共 **40+ 寫入端點** 補 audit log；新增 32 個中文 action 標籤 |
| **C** 遊戲重置 | `86974811` | `game_sessions` 加 `reset_count` + `reset_history`；POST `/admin/sessions/:id/reset` 必填 reason ≥ 10 字、清 playerProgress、寫入 audit；前端 /troubleshoot/reset 有完整 lookup + 二段確認 + 歷史 |
| **D** Cash 退款 | `e76ee4cb` | 新 `refunds` 表（生產 DB 已建）；POST `/admin/refunds` cash 立即 completed、防呆退超原額、連動 booking；前端 /troubleshoot/refund 含查交易 + 全退快捷 + 最近退款列表 |
| **E** 排解中心首頁 | `e9b534b8` | `/admin/troubleshoot` 取代佔位頁；4 大入口卡 + 4 統計 + 異常預約列表（cancelled/no_show 已付款）+ 卡住場次（playing > 24h）+ 最近 50 排解操作 audit；自動 refetch |

**業主端閉環完整**：客人卡 bug → 重置 ✅、爭議 → cash 退款 ✅、提前/遲到 → 改梯次 / 強制核銷 ✅、額外補償 → 手動發券 ✅、追責任 → audit_logs ✅

---

### 🐛 POS fieldId 根因修正 + 智慧排解流程
**狀態**：🟢 部署上線（commit 63e94805 + 85034598）
**細節**：[changes/2026-05-19-pos-rescue.md](changes/2026-05-19-pos-rescue.md)

| 範圍 | 內容 |
|------|------|
| 根因 | `bookings.field_id` 存代碼 `JIACHUN`、`admin_accounts.field_id` 存 UUID `72cc204d-...`、eq() 永遠 0 match → 所有 POS 「找不到」|
| 修正 | 新 `resolveFieldScope()` 同時拿 UUID + code、所有 POS query 用 `inArray(scope.identifiers)`、覆蓋 7 endpoint |
| 智慧錯誤 | checkin 改為先全域找預約、再分流 5 種狀態：not_found / wrong_field / too_early / too_late / cancelled |
| 強制核銷 | `POST /bookings/:id/check-in { force: true, note }` 忽略狀態與時段、自動 reactivate、寫 adminNote |
| 改梯次 | 新 `POST /bookings/:id/reschedule { slotStart, durationMinutes, reason }`、業主可現場改 |
| 前端 | 拆 `PosScanResultCard.tsx`（379 行）、5 種狀態各自 banner + 修正按鈕 + confirm 對話框 |

業主同日提出「後台導航重構 + 排解中心」大計畫、Claude 已產出方案等業主確認。

---

## 2026-05-18

### 🎯 多活動預約 + POS 工作站（一次大型整合）
**狀態**：🟢 部署上線、生產 e2e 全綠
**細節**：[changes/2026-05-18-multi-activity-pos.md](changes/2026-05-18-multi-activity-pos.md)

| 範圍 | 內容 |
|------|------|
| Schema | 新 `activities` / `activity_schedules` / `pos_transactions` 表；`bookings` +7 欄位（activityId / paymentMode / paidByStaffId / paidAt / paidAmountCents / qrToken / checkedInAt / By）；`coupon_templates` 加面額；`platform_coupons` 加 qrToken |
| Admin | `/admin/activities` 多活動管理（封面/定價/時長/容量/付款模式） |
| 玩家端 | `/book/:fieldCode` 智能路由（有活動→卡片列表、沒有→fallback）；`/book/:fieldCode/activity/:slug` 獨立預約頁；BookDonePage 大 QR Code；LINE Flex 用活動封面 |
| POS（mobile-first） | `/pos` Dashboard + `/pos/scan` 相機/手輸 + `/pos/bookings/today` 清單 + `/pos/checkout` 收款 + `/pos/voucher` 券核銷 + `/pos/summary` 小結 |
| 後端 API | 13 新 endpoint：admin-activities(5)、public-activities(2)、pos(7)、revenue overview 加 POS 切片 |
| 權限 | 新 6 permissions：pos:view/scan/checkout/voucher_redeem + booking:view_today/mark_attended |
| 金流 | 預留欄位、實際 Recur/Stripe/LinePay 串接延後（業主等商戶帳號） |

業主 5/18 確認：「全部推展、金流可以預留、其他功能都可以推進、並且持續打磨一段時間」

### 🪄 Phase 8 持續打磨（Round 16-29、共 14 個小改進）

**現場 UX 強化**：
- POS Dashboard「下個 30 分鐘」加倒數時間（「5 分後」/「已過 3 分」）+ 10 分鐘內紅色 highlight、遲到琥珀色
- PosScan / PosCheckout 加震動+音效反饋（成功上升音、錯誤低長嗶、桌機自動 fallback）
- PosScan 確認頁顯示電話（tap-to-call）+ 備註（黃色 highlight）
- PosBookingsToday 每筆顯示 `📞 電話` 可一鍵撥
- PosSummary 加按收款員分組 + 交易明細顯示收款員姓名

**業主端管理優化**：
- AdminActivities 加「📋 複製活動」按鈕（一鍵複製設定建副本）
- AdminActivities 卡片加 sortOrder 上下調整按鈕 + #N 顯示
- AdminActivities 加「📅 時段」按鈕、可為每活動設專屬時段（重用 ScheduleEditor）
- AdminBookings 列表加活動 filter + 活動名稱欄 + ✓到場/✓已收 badge + 電話 tap-to-call
- Admin sidebar 加「💰 POS 工作站」入口

**玩家體驗**：
- BookActivitiesPage 卡片加「📱 現場付款」標籤
- MyBookingsPage 預約卡片顯示活動名 + 金額 + 付款狀態
- BookDonePage 顯示「✓ 已付款」狀態 + 收款時間
- BookPage 應付金額提示改「現場出示 QR Code」

**後端整合**：
- activity_schedules 整合：getAvailability 接 activityId、優先用活動專屬時段、fallback booking_configs
- /api/pos/dashboard 含 fieldName + phone + customerNote
- /api/pos/summary 加 byStaff 分組 + 收款員姓名 join
- /api/bookings/mine join activities 拿活動名
- 線上付款暫時 fallback onsite（保持流程順暢、待商戶帳號開通）
- 新 client lib：pos-feedback（震動/音效統一 API）

**業主操作手冊**：`docs/runbooks/multi-activity-pos.md`（198 行、業主可直接照做）

**接地驗證**：Round 22 + 29 各跑一次完整 e2e（建活動 → 預約 → POS 收款 → 紀錄全欄位）、生產 DB 實證可用、清乾淨

---

## 2026-05-12

### 🐛 批 5 業主 5 項 bug 全修
**狀態**：🟢 部署上線（commit `16e5ae89`、生產 HEAD `55558eac`、e2e 4/4 全 200）

| # | 問題 | 修法 |
|---|------|------|
| 1 | 再玩一次失效跳通關 | `useSessionManager.resetAndCreateNew` 加 forceNewSession + invalidate query |
| 2 | GPS 下拉無法分辨點位 | LocationSelect 加 allPages prop、顯示「#N · pageName」+ pageType badge |
| 3 | 獎勵設 0 仍給點 | 16 元件 `??` fallback 全改 `?? 0` |
| 4 | GPS 箭頭固定不跟玩家轉 | 新 `useCompassHeading` hook（iOS webkit + Android alpha 翻正）+ 相對方位計算 |
| 5 | ResumeDialog 渲染遊戲頁後才彈 | `pendingDecision` state、未決定前蓋遊戲頁顯示 dialog |

**細節** → [changes/2026-05-12-bug-batch-5.md](changes/2026-05-12-bug-batch-5.md)

### 🎯 5 Phase 觀測穩定性計畫全部完工
**狀態**：🟢 部署上線、commit 序列 `d1ce1e67` → `48e845e4`

| Phase | 主題 | commit |
|-------|------|--------|
| 1 | 元件健康度紀錄（`component_runs` 表 + 6 元件 + dashboard）| `d1ce1e67` |
| 2 | 元件級 ErrorBoundary + 自癒 | `1ea3e61e` |
| 3 | 體感升級 | `8a6d9c77` |
| 4 | Feature flags + 自動降級 | `deeb26e9` |
| 5 | 合成監測 | `48e845e4` |

**業主可立即量化**：「水彈這週表現？」「哪個元件最容易放棄？」「修 GPS 後完成率變化？」

**細節** → [changes/2026-05-12-component-telemetry.md](changes/2026-05-12-component-telemetry.md) / [component-self-healing.md](changes/2026-05-12-component-self-healing.md) / [ux-polish.md](changes/2026-05-12-ux-polish.md) / [feature-flags.md](changes/2026-05-12-feature-flags.md) / [synthetic-monitoring.md](changes/2026-05-12-synthetic-monitoring.md)

### 🐛 批 1-4 業主 bug 修復
**狀態**：🟢 部署上線

- **批 1** `fac03b54`：reward + nextPage 鏈路（業主 12 項之 #4/#5/#6/#8/#13）
- **批 2+3** `8f097de0`：業主 #1/#2/#7/#3 修復
- **批 4** `80d8bdae`：GPS 方向箭頭 + 整場 BGM 音量（業主 #10 #11）

**細節** → [changes/2026-05-12-bug-batch-1.md](changes/2026-05-12-bug-batch-1.md) / [bug-batch-4.md](changes/2026-05-12-bug-batch-4.md)

### 📝 5/9~5/12 session handoff
**commit `4d396bb4`** → [changes/2026-05-12-session-handoff.md](changes/2026-05-12-session-handoff.md)

---

## 2026-05-11

休息日 — 觀察 5/10 觀測完整化部署後的 24h 數據、無實質 commit。

---

## 2026-05-09（額外補記）

### 📱 PWA 下拉重整 hook（與 4 項實機優化同日）
**狀態**：🟢 部署上線
**commits**：`5ecabf2f`（PTR hook + 元件）/ `b409d5c1` / `75cb8543` / `eb41a4a8`（docs）

**主題**：PullToRefresh / safe-area / dvh / iOS Shortcuts — 兩輪 UX 修復共 9 項

> 同日 `32750517` 4 項實機 UX 優化見下方既有 entry。

**細節** → codex-claude/logs/2026-05-09.md

---

## 2026-05-10（晚上）

### 📊 觀測完整化 — 自動報告 + Web Vitals + 第三方腳手架
**主題**：業主要求「用數據佐證、自動回報、第三方專業工具？」
**狀態**：🟢 本地 commit / tsc 0 / smoke 51/51 / ADR-0018 通過、待業主授權部署
**部署 commit**：（待部署）

**Phase 3 自動化活動結束報告**（最有商業價值）：
- 新表 `session_reports`（11 個欄位、含 anomaly score + baseline snapshot）
- `server/lib/generateSessionReport.ts` 撈 ws + 業務 + 跟前 5 場對比
- `POST /api/cron/generate-session-reports` 每 15 分鐘 cron 觸發
- 自動推 Telegram 摘要（健康 🟢 靜音 / 異常 🟠🔴 出聲）

**Phase 4 Web Vitals**：
- 收集 LCP/INP/CLS/FCP/TTFB、只上報 needs-improvement / poor
- 透過既有 `reportClientEvent` → ws_event_log（dedup + keepalive）
- main.tsx 啟動呼叫 `initWebVitals()`

**Phase 5 admin/reports UI**：
- 列表 + 異常分數醒目（🟢🟡🟠🔴）
- 30 秒自動 refresh、手動觸發、跳 Replay
- admin menu 加「📊 活動結束報告」

**Phase 1+2 第三方腳手架**（待業主憑證）：
- `.env.example` 預留 Sentry DSN / CF beacon token / CRON_SECRET
- main.tsx CF beacon 條件動態載入
- Sentry 整合 code 等業主給 DSN 後再裝

**業主部署後操作**：
- 設 `CRON_SECRET`（必要）+ 加 crontab `*/15 * * * *`
- Sentry / CF beacon 申請後給我接（< 30 分）

**細節** → [changes/2026-05-10-observability-suite.md](changes/2026-05-10-observability-suite.md)

---

## 2026-05-10

### 🔥 多人斷線根因修 + 團體合照隊長鎖
**主題**：業主回報「組隊成功進遊戲就斷線、對講機離線」+ 「合照只有隊長能拍」
**狀態**：🟢 本地 commit / tsc 0 / smoke 51/51 / ADR-0018 通過、待業主授權部署
**部署 commit**：（待部署）

**找到根因**（生產 ws_event_log 7 天統計）：
- `close.reason='config_change'` 佔 **67%**（51/76）→ Provider 自己關 ws、不是真斷線
- 78% 連線進 grace、73% expired、45% auto_leave
- 玩家 lobby → game page 切換時 `alsoJoinSessionId` 變動 → ws 被關 → server 進 grace → 玩家被誤踢 team

**修法**（4 個檔案）：
1. **WebSocketContext.tsx** — `alsoJoinSessionId` 變動 → 保留 ws + send 新 join 訊息（不再 close）
2. **WebSocketContext.tsx** — 首次 reconnect 從 800-1200ms 加速到 200ms
3. **PhotoTeamGather.tsx** — 加 `isLeader` 隊長鎖、非隊長顯示「等待隊長拍照」+ 不開鏡頭
4. **PhotoTeamFlow.tsx** — `captureMode='collage'` 強制改走 gather（含隊長鎖）
5. **TriviaShowdownPage.tsx** — reconnect 後補拉 `/api/trivia/:id/state`（Phase 4 §6 已知限制）

**預期改善**：close.reason='config_change' 67%→<5% / grace_start 78%→<30% / auto_leave 45%→<10%

**細節** → [changes/2026-05-10-multi-leader-stability.md](changes/2026-05-10-multi-leader-stability.md)

---

## 2026-05-09（晚上）

### 🎯 5 項實機 UX 修復（text_card / FontScale / session 恢復 / ErrorBoundary）
**主題**：業主第二輪實機回報的 5 項問題
**狀態**：🟢 部署生產 / TS 通過 / 改動相關測試全綠
**部署 commit**：`b5068633`

**變更**：
1. **text_card 上方超出畫面** — 4 layout `overflow-hidden → overflow-y-auto`、長內容可滾
2. **a11y 字體切換器蓋登出** — `FloatingFontScale.shouldHide()` 加 `/me` 路徑
3. **通關後仍顯示舊進度** — `getActiveSessionByUserAndGame` 改 **completed 優先**
4. **time_bomb「同步失敗」** — 非 code bug、是 admin 填的劇情文字（標記不修）
5. **React #310 部署後現** — `ErrorBoundary` 加 `isReactMinifiedError` 偵測 + 自動 reload + UX 改善為「🔄 版本更新中」

**行為變更**：通關 = 結束。要重玩請手動點重新開始。

**細節** → [changes/2026-05-09-ux-polish-5-items.md](changes/2026-05-09-ux-polish-5-items.md)

⏭ 業主待手動：找有「同步失敗」標題的 time_bomb page、改 page title

---

## 2026-05-09（下午）

### 📲 PWA / RWD 體感優化（PTR 下拉重整 + safe-area + dvh + App Shortcuts）
**主題**：業主提出 RWD/PWA 全面體感打磨、要穩定好用不過於笨重
**狀態**：🟢 部署生產 / TS 通過 / 業主待實機測試 PTR
**部署 commit**：`5ecabf2f`（feat 本體）/ commits `31565415..5ecabf2f`

**新增**：
1. **`usePullToRefresh` hook**（155 行）— window scroll 監聽 / 邊緣保留 iOS swipe-back / 阻尼 / haptic / 至少 600ms
2. **`PullToRefresh` 元件**（70 行）— fixed indicator 配 `safe-area-inset-top`、不改 layout

**RWD 補強**：
- `tailwind.config` 加 `safe-{top,bottom,left,right}` spacing + `dvh/svh/lvh` height extend
- 6 個 layout/loader（Unified/Platform/PageLoader/SmartRedirect/Forbidden/ErrorBoundary）`min-h-screen` → `min-h-screen-dynamic`

**PWA 補強**：
- `Home.tsx` 套用 PTR：軟重整 4 個 query（games/stats/sessions/battle slots）、不硬 reload
- `vite.config.ts` manifest 加 3 個 App Shortcuts（場域/對戰/找情境）

**審計後跳過**（避免重工）：ErrorBoundary 已超完善、Workbox / WebSocket / OfflineBanner / A2HS 已實作完整、不動

**規模**：2 個新檔 / 8 個修改 / ~280 行新增

**未做（避免笨重）**：Web Push / Background Sync / 動態 splash / share_target / 長按選單

**🔥 Hot Fix（同日深夜）**：iPhone PWA 撞 React #310（Minified hooks rule violation）
- 根因：我把 `useCallback` 加在 Home.tsx early return 之後、第一次 render auth loading 跳過、第二次跑到 → hooks 數量不一致
- 修復：useCallback 移到 line 339（最後一個 useEffect 後、所有 early return 前）
- 雙保險：業主同步補 `ErrorBoundary.isReactMinifiedError` 偵測 + 自動清快取 reload（commit `b5068633`）
- 部署 commit：`95a7e5b5`

**細節** → [changes/2026-05-09-pwa-rwd-optimization.md](changes/2026-05-09-pwa-rwd-optimization.md)

⏭ 待業主實機驗證：iPhone PWA 不再 #310 / Home PTR 體感對 / 體感 OK 後擴大套用 BattleMyProfile / MySquads / SquadPublic

---

## 2026-05-09

### 🎯 4 項實機 UX 優化（PhotoTeam / Lock / BGM × 2）
**主題**：業主實機測試後反映的 4 項 UX 痛點
**狀態**：🟢 部署生產 / TS 通過 / 1061 單元測試全綠
**部署 commit**：`32750517`

**變更**：
1. **PhotoTeam 加「先跳過」按鈕** — 隊長不拍也能跳、稍後可回來補拍
   `PhotoTeamGather.tsx` intro 加 ghost button + 文字引導
2. **Lock 轉盤鎖修復** — 數字顛倒（兩層 div 修字體朝上）+「下一位」復歸 dialRotation
3. **頁面 BGM 加上傳按鈕** — `PageConfigEditor.tsx` 加 MediaUploadButton
4. **整場 BGM 加上傳按鈕** — 新 `useGameMediaUpload` hook + `GameFormDialog` 編輯模式上傳

**規模**：7 檔修改 / 241 行新增 / 43 行刪除 / 1 個新 hook

**未做**：PhotoTeam 隊長重拍（風險高）、新建遊戲時上傳 BGM（需後端臨時 folder 端點）

**細節** → [changes/2026-05-09-ux-polish-4-items.md](changes/2026-05-09-ux-polish-4-items.md)

⏭ 下一步：等業主實機驗證 / 或進 next-action-guide A1 ws_event_log Dashboard

---

## 2026-05-08（晚上）

### 🎨 AdminMultiSessions v2 — 16 項完整打磨（已上線）
**主題**：使用者反映「排版比照 /admin/sessions、資料是否真實、解決問題、不要浪費」、針對即時連線監控做完整打磨
**狀態**：🟢 已上線生產、commit `550d60bc`
**詳情** → [changes/2026-05-08-admin-multi-sessions-v2.md](changes/2026-05-08-admin-multi-sessions-v2.md)

**P0 核心改造**（5 項）：
- 三列卡片佈局（grid-cols-1 md:2 lg:3）
- 頂部 4 MetricCard（共用元件、可點 filter）
- **真實 online**：用 ws_event_log 取代 5 分鐘 polling 假象（三態：online/away/offline）
- ws 健康指標（grace / auto_leave / kick / error 過去 5 分鐘聚合）
- 異常 session 自動排序到頂（anomalyScore = grace×5 + autoLeave×10 + ...）

**P1 工具增強**（4 項）：
- 篩選列（搜尋 / 場域 / 健康度）
- 玩家詳情真實 ws 狀態（連線時間 / 重連次數 / IP / UA / lastReason）
- 迷你連線時間軸（30 格、紅橘綠標事件分布）
- CSV 匯出（16 欄）

**P2/P3 加分**（7 項）：
- game 進度指標 / sessionId 點擊複製 / refresh 倒數
- **Telegram 異常告警 cron**（critical → notify + Replay 連結 + 30min cooldown）
- **玩家 cross-session 歷史 dialog**（1/7/30/90 天 + 多 IP 偵測）
- broadcast/min 統計 / 鍵盤導航

**新 server endpoint**：`GET /api/admin/players/:userId/connection-history`
**新 server cron**：`server/lib/multi-sessions-alert-cron.ts`

**明確拒絕**（避免浪費）：大型趨勢圖 / emoji 動畫 / server CPU metrics / 漏接偵測

---

## 2026-05-08（下午）

### 🌐 多人遊戲穩定性架構重構（Phase 0-4 全套完成、已上線）
**主題**：自寫 WS + 全域單例 + 完整監測 + 規範訂定，徹底解決 user 回報「進入遊戲斷線 + 對講機離線 + 猜謎不公平」
**狀態**：🟢 已上線生產、含真實多人 e2e
**規劃** → [changes/2026-05-08-multi-stability-refactor-plan.md](changes/2026-05-08-multi-stability-refactor-plan.md)
**全日總結** → [changes/2026-05-08-summary.md](changes/2026-05-08-summary.md)

**根因**：演進累積 4 條獨立 ws connection（useTeamWebSocket / useHostScreenSync / useTeamShootingSync / ChatPanel），同玩家瀏覽器同時開、互相干擾、isUserStillConnected 競態誤判。

**核心交付**（8 個 commit、~5380 行新增、~700 行 Legacy 清理）：
- **Phase 0.1** admin/multi-sessions 即時連線監控 UI（5s refresh）
- **Phase 0.2** ws_event_log + db_write_log + 90 天 retention（爭議仲裁基礎）
- **Phase 0.3** Session Replay UI + CSV export（爭議仲裁工具）
- **Phase 1** WebSocketProvider 全域單例（feature flag 控）
- **Phase 2** 合併 ChatPanel / useHostScreenSync / useTeamShootingSync 到 Provider
- **Phase 3** 移除 feature flag + ADR-0018 + CI script + e2e
- **Phase 4** TriviaShowdown server-side scoring（DB persistence）
- **e2e 補完** 真實多人 e2e（16 tests、填補 CLAUDE.md 紅線第 10 條）

**完成後**：
- 1 user = 1 條 ws（4 條 → 1 條）
- 進入遊戲不斷線、page 切換無 close
- 對講機自動繼承 reconnect
- 猜謎絕對公平（server-side source-of-truth）
- 90 天事件 log 任何時間可溯源（爭議仲裁）
- CI 規範防回頭（grep new WebSocket）

**部署完成**：2 個 migration（observability + trivia_answers）+ docker rebuild、生產驗證 401/JSON

**Commits**：`13d1c594` Phase 0.1 / `a8a9d27c` Phase 0.2 / `57b89812` Phase 0.3 / `0cb06f09` Phase 1 / `d268f351` Phase 2 / `66be6625` Phase 3 / `26ffd996` Phase 4 / `f457c085` e2e
**ADR** → [decisions/0018-realtime-architecture.md](decisions/0018-realtime-architecture.md)

---

## 2026-05-08（上午）

### 📅 預約系統 + LINE 通知 + Telegram 內部通知 + Rich Menu（Phase δ W1-W3）
**主題**：完整預約迴圈：客戶預約 → 30 分前 LINE 提醒 → 現場「開始遊戲」關鍵字 → 結束送禮
**狀態**：🟢 完整鏈路上線、生產 commit `0e45a875`、賈村已 init
**部署**：生產 schema migrated + jiacun init + TZ=Asia/Taipei + Telegram chat_id 5858549388

**核心交付**：
- DB：4 個新表（booking_configs / bookings / booking_blackouts / booking_notification_templates）
- 客戶端：`/book/:fieldCode` LIFF 預約頁（14 天 picker / slot grid / 人數 / 備註）
- Admin 端：`/admin/bookings` 4 tab（列表 / 設定 / 黑名單 / 通知模板）
- LINE 通知 service：5 種訊息（confirmed / reminder cron / game start reply / completed / cancelled）
- 規則引擎：rule-based + 優先級（特定日 100 > 區間 50 > 平假日 0）
- Rich Menu：6 鍵 postback dispatcher（reply 不扣 quota）
- Telegram bot：10 個事件（boot / booking / payment / smoke / 早報 / quota 告警）

**LINE quota 設計**（每客戶 ≤ 3 push）：
- booking_confirmed = 1 push / reminder_30min = 1 push / game_completed = 1 push
- game_start_keyword = 0（reply）
- → 200 free / 月 ≈ 67-200 客戶/月

**16 + 14 endpoints + 3 LIFF 頁面 + admin 管理頁**
**詳情** → [changes/2026-05-07-coupon-integration-spec.md](changes/2026-05-07-coupon-integration-spec.md)

---

## 2026-05-07

### 🎯 軟分流階段 1 — admin editor 入口分流（B2 架構重做）
**主題**：解決「遊戲腳本 vs 活動互動混在一起」核心架構問題（使用者抓到的痛點）
**狀態**：🟢 程式碼層完成、e2e 72/72 全綠、待實機驗證
**詳情** → [changes/2026-05-07-admin-editor-split.md](changes/2026-05-07-admin-editor-split.md)

**核心**：games 表加 editorMode 欄位（'game' / 'activity'）、admin 兩個獨立入口建場、editor 自動過濾元件清單。

**修改**：
- DB schema：games.editorMode（NOT NULL DEFAULT 'game'、向後相容）
- AdminGames：兩個並排按鈕（🎮 建立遊戲 / 🎉 建立活動）+ filter UI
- ToolboxSidebar：依 editorMode 過濾元件（game 35 個 / activity 68 個）
- AdminHostSessions：select 只列 activity mode game
- SCENARIO instantiate：依 axis 自動設 editorMode（host → activity / 其他 → game）

**為什麼軟分流（不硬分流）**：同 codebase、共用 schema、修 bug 改一處、未來客戶要「年會 = 遊戲段 + 大螢幕段」混搭時可在同 SCENARIO 跑兩種 session。詳見 architecture/three-paths.md。

**E2E 驗證**：黃金路徑 17 + A2 18 + Host 34 + 階段 1 分流 3 = 72/72

---

### 📺 補接 16 個 host 元件到 admin editor + 三路線架構文件
**主題**：B2 重做 — 修「admin editor 看不到 host 元件」根因
**狀態**：🟢 程式碼層 + e2e smoke 完成、PAGE_TYPES 17/17、e2e 69/69 全綠
**詳情** → [changes/2026-05-07-host-component-admin-integration.md](changes/2026-05-07-host-component-admin-integration.md)

**接地調查發現**：admin editor PAGE_TYPES 只接入 1/17 個 host 元件（只有 host_word_cloud），導致 admin 自由建場時 99% host 元件選不到，逼迫 SCENARIO_TEMPLATES 91% 元件用 multi 軸（要登入），跟「現場活動不該登入」本意違背。

**修正**：
- `client/src/pages/game-editor/constants.ts`：補 16 個 host_* PAGE_TYPES + PageCategory 加第 6 類「host_screen 📺」
- `client/src/pages/game-editor/getDefaultConfig.ts`：補 16 個 case
- `server/routes/test-only.ts`：seed-multi-game-with-page 支援 host 軸（gameMode=individual + hostMode=true）
- `e2e/host-components-smoke.spec.ts`：17 元件 × 2 = 34 個 smoke（全綠）
- `docs/architecture/three-paths.md`（新）：三條路線架構文件、避免將來再混亂

**架構釐清**：
- 路線 I（GamePlay）：solo + multi 軸、要登入、傳統 game
- 路線 II（HostPlay）：host 軸玩家手機端、可匿名、活動互動
- 路線 III（HostScreen）：host 軸大螢幕、hostToken、配對路線 II

---

### 🧪 Phase 3 A2 — 多人元件 L3 持久化驗證（接地）
**主題**：驗證 9 個 L3 元件程式碼層真實可用 + 補實機 checklist
**狀態**：🟢 自動 e2e 18/18 全綠、實機 checklist 待跑
**詳情** → [changes/2026-05-07-a2-l3-validation.md](changes/2026-05-07-a2-l3-validation.md)

**接地發現**：原 plan「L0/L1→L3 升級」實為 2026-05-05 已完成（Phase 5 W18）。本次補的是「驗證 L3 真實可用」。

**新增**：
- `server/routes/test-only.ts`：`seed-multi-game-with-page` 端點（9 元件 default config）
- `e2e/a2-multi-l3-smoke.spec.ts`：18 個 smoke e2e（建場 + 載入 + DB schema）
- `docs/runbooks/a2-l3-manual-verification.md`：實機 checklist（補 e2e 不能驗的 ws + 重整還原）
- CI grep 加入 `A2 多人元件`（黃金路徑 17 + A2 18 = 35/35）

**順便修**：本地 dev DB schema drift（補 game_sessions.host_mode / host_token / host_token_expires_at）

---

### 🚀 Phase 1 (DBAC 路徑) 完整收尾 — D4 + D2 + D1 + D3 全套
**主題**：補 e2e 真實測試 / 30 分鐘建場流程優化 / 元件分類 + 搜尋
**狀態**：🟢 14 commits 全部部署、CI e2e 17/17 全綠
**部署 commit 範圍**：`1c4b9075..e7647c82`

**D4 — e2e 真實測試**：
- 新增 dev-only seed endpoint（生產禁用）
- 17 個黃金路徑 e2e（A 單人 5 / B 多人 6 / C 活動 6）
- CI workflow 啟動 server + ENABLE_E2E_HELPERS

**D2 — 30 分鐘建場流程**：
- D2-c 4 痛點修復（admin 未登入 / 複製 fallback / 列印重列 / toast 引導）
- D2-b onboarding wizard 加 30 分鐘建場捷徑步驟
- 插隊：text_card audioAutoplay 設定（admin 反映）

**D1 — host + multi 配對 spec**：
- 17 個 host 元件完整配對表 + 5 大商業情境組合範例
- `docs/domains/host-multi-pairing.md`

**D3 — 元件三軸 category 分組**：
- 81 個 page_type 分 5 大類（敘事/驗證/拍照/多人協作/活動互動）
- ToolboxSidebar 摺疊式分組 + 搜尋

**整體影響**：e2e smoke test → 真實 e2e；30 分鐘建場流程 4 痛點全修；
admin editor 元件 81 個從平鋪改成分組+搜尋。

**細節** → [changes/2026-05-07-phase-1-complete.md](changes/2026-05-07-phase-1-complete.md)
**規劃** → [changes/2026-05-07-phase-dbac-plan.md](changes/2026-05-07-phase-dbac-plan.md)

⏭ 下一步：Phase 2 (B 結構優化) — 情境模板組合、AI 推薦引擎

---

## 2026-05-06

### 🧹 多人元件大清理（416 → 60）+ Loop 安全護欄 ADR
**主題**：清理跨多 session loop 累積的不可用元件、接入 admin editor、寫入預防機制
**狀態**：🟢 TypeScript 編譯通過 / 取樣測試 255/255 全綠 / 待部署
**部署 commit 範圍**：`9d634b21 .. 8762d5da`（2 commits）

關鍵 commits：
- `9d634b21` 階段 A：刪除 265 個空轉元件 + 接入 21 個保留元件到 admin editor
- `8762d5da` 階段 B：精選 30 個接入 + 刪除 91 個重複工具

**規模**：
- 變更檔案：1,060 / 刪除程式碼：-141,040 行
- multi/ 元件：416 → 60 / GamePageRenderer：1602 → 540 行
- admin editor 可選 page type：30 → 60

**根因**：跨多 session `/loop` 模式失控（任務翻譯誤解 + 缺接地驗證 + 模板成功陷阱）

**新 ADR**：[ADR-0017 Loop 模式安全護欄](decisions/0017-loop-mode-safeguards.md)
**新紅線**：CLAUDE.md #9-#12（loop 5 輪驗證 / e2e 真實性 / 商業情境對照 / 模糊詞彙確認）

**細節** → [changes/2026-05-06-multi-component-cleanup.md](changes/2026-05-06-multi-component-cleanup.md)

⏭ 下一步：手動測試 admin editor 拖拉新 page type、用真實 session 跑 e2e 流程

---

## 2026-05-03

### 🐛 錯誤處理體系 3 階段（Stage 1+2+3#8、追查能力 / 不迷路 / 回報）
**主題**：完整錯誤處理升級、修「玩家迷路」+「工程師追查不到」12 個場景
**部署 commit 範圍**：`648fef51 .. c1ab07d6`

關鍵 commits：
- `648fef51` 錯誤處理體系盤點報告（5 類純盤點）
- `91033939` Stage 1 追查能力（useErrorReport 重啟 + server middleware 寫 DB + schema +8 欄）
- `95145eea` Stage 2 玩家不迷路（HostPlay 替代入口 + WsConnectionBadge + GamePlay 失連警示）
- `cb4367e7` Stage 3 #8 ErrorBoundary 複製錯誤回報 + ADR-0016 完整規劃

**生產 ALTER TABLE**：`error_logs` 新增 8 欄 + 4 index（platform/requestId/sessionId/teamId/matchId/statusCode/method/route）
**新公開頁**：無（沿用既有 `/platform/errors`、現在有資料）
**新 ADR**：ADR-0016 錯誤處理政策統一

**細節** → [changes/2026-05-03-error-handling-audit.md](changes/2026-05-03-error-handling-audit.md)
**完整移交** → [changes/2026-05-03-session-handoff.md](changes/2026-05-03-session-handoff.md)

⏭ 下一步：24h 觀察 PlatformErrorLogs 真實資料 + 啟動 Stage 3 #6+#7（ADR-0016 規劃）

---

### 🔒 Codex 9 輪審查 + 使用者 P0/UX 修法 + Webhook 安全統一（39 commits）
**主題**：雙 AI 協作橫向掃描 + 使用者回報修法 + 整體系統安全姿態統一
**範圍**：39 個 commits / 一個 working session（11:30 → 14:35）
**狀態**：🟢 完整 test:run 156/2190 全綠 / 生產部署 healthy
**部署**：`44cc1c81 .. 2fb3b9f5`

關鍵 commits：
- `44cc1c81 .. 092eba69` Codex 第 1-5 輪：座標 + Hook deps + Chat 雙寫 + team realtime 房間統一
- `120fda71` Codex 第 8 輪：race_answered realtime 鏈路補完
- `e1844a2f` ADR-0014 Realtime 協定清理
- `a98781b4 .. 2c276308` 第 14 個 host 元件 TeamBattleScore（紅藍對抗）
- `f02b1652` P0-security: Recur webhook 簽章 stub → HMAC SHA-256 實作
- `04b68d99` P0: super_admin 不需區域代號進後台（findFirst 隨機抓非 super_admin）
- `df2c5855` UX: 單人遊戲對講機自動登入 → 多人組隊才自動連、單人顯示選單
- `cd766036` Security: 4 個 webhook signature 全部 timing-safe 統一

**修復的真 bug 統計**：
- 5 個 user-facing silent bugs（Codex 9 輪挖出）
- 1 個未爆彈安全洞（Recur webhook stub）
- 1 個 admin 入口失效（findFirst 多帳號隨機抓）
- 1 個玩家 UX 問題（對講機強制登入）
- 4 個 webhook signature 風格不一統一

**新元件**：TeamBattleScore（第 14 個 host、紅藍對抗即時計分）
**新文件**：ADR-0014 Realtime 協定清理 + host-screen-components.md（13→14 元件對照）

**細節** → [changes/2026-05-03-codex-realtime-cleanup.md](changes/2026-05-03-codex-realtime-cleanup.md)
**細節** → [changes/2026-05-03-security-and-ux-fixes.md](changes/2026-05-03-security-and-ux-fixes.md)
**ADR** → [decisions/0014-realtime-protocol-cleanup.md](decisions/0014-realtime-protocol-cleanup.md)

⏭ 下一步：商業價值推進（PhotoMosaic 候選 #2）/ 長期防護（WS schema 化）

---

## 2026-05-02

### 🎮 多人遊戲元件平台 12 週路徑（Phase 1 Week 1 完成 ✅）
**主題**：38 新元件 + 4 大平台基建 + 12 個情境模板
**範圍**：Week 1 7 個 commit / 5 個工作日
**狀態**：🟢 Week 1 完成、E2E 驗證通過、生產部署 healthy
**部署**：`d6134d6b..3d7dcedc`

關鍵 commit：
- `0c52ad49` W1 D1+D2: ADR-0004 + schema + types
- `6803b373` W1 D3: WS 事件 + /host /play 路徑 + admin endpoints
- `1ebe435c` W1 D4: scaffold:host 腳手架 + host/ 目錄
- `3d7dcedc` W1 D5: ShowcaseHub MVP 元件展示館

**生產 SQL**：`game_sessions` 加 `host_mode` / `host_token` / `host_token_expires_at`
**新公開頁**：[/showcase](https://game.homi.cc/showcase) 元件展示館
**新路徑**：`/host/:sessionId`（大螢幕）+ `/play/:sessionId`（玩家）

**細節** → [changes/2026-05-02-multiplayer-component-platform.md](changes/2026-05-02-multiplayer-component-platform.md)
**ADR** → [decisions/0004-host-screen-axis.md](decisions/0004-host-screen-axis.md)

⏭ 下一步：Phase 1 Week 2 — PollLive 完整實作（HostScreen 軸線首發業務元件）

### 🎮 Phase 1 Week 2 完成 ✅（PollLive 全鏈路上線）
**部署**：`3d7dcedc..e8b1447c`

關鍵 commit：
- `0201b25e` W2 D1: PollLive 元件本體（雙版型 + 10 測試）
- `c8c81b3a` W2 D2: useHostScreenSync hook + GamePageRenderer 註冊
- `6f232c69` W2 D3: HostPageRenderer + HostScreen/HostPlay 整合 game pages
- `dd8ed648` W2 D4: ShowcaseHub PollLive demo 預覽
- `e8b1447c` W2 D5: Admin host-session UI 後台管理

**完整商業鏈路打通** 🎉：admin 建 session → 大螢幕投影 → 玩家投票 → 即時更新

⏭ 下一步：Phase 1 Week 3 — HostScreen 連發 4 個元件

### 🎮 Phase 1 Week 3 完成 ✅（4 個 host 元件 + 22 測試）
**部署**：`e8b1447c..c6405f5a`

關鍵 commit：
- `6582ed45` W3 D1: EmojiReact (S) — 全場 emoji 雨 + 即時統計
- `7d2d66aa` W3 D2: WaveResponse (S) — 人浪應援 + 30 秒長條圖
- `276d9ab0` W3 D3: CrowdGather (S) — 簽到聚眾達標
- `708e2a01` W3 D4: LiveLeaderboard (M) — 即時排行 + 金銀銅 + ↑↓ 變動
- `c6405f5a` W3 D5: ShowcaseHub demo 擴充 5 元件雙版型 + W3 收尾

**HostScreen 軸線進度**：5/8 元件就位（含 PollLive）

⏭ 下一步：Phase 1 Week 4 — 補 5 個 multi 元件（JigsawPuzzle 等）

### 🎯 Phase 1 Week 4 完成 ✅（5 個 multi 元件 + Phase 1 全套收尾）
**部署**：`c6405f5a..a4e61714`

關鍵 commit：
- `90c78434` W4 D1: JigsawPuzzle (M) — 拼圖協作（親子王牌） 6/6 測試
- `8f814310` W4 D2: TreasureHunt + GpsCascade — 兩元件同輪 11/11 測試
- `5fc01cd2` W4 D3: CollectiveScore + RoleAssign — 兩元件同輪
- `a4e61714` W4 D4: ShowcaseHub demo 擴充 5 multi 元件 + 部署

**ShowcaseHub** [showcase](https://game.homi.cc/showcase)：
- 15 個 demo 入口（10 host × 雙版型 + 5 multi）
- 客戶不需登入、不需建 session 即可看到全部元件玩法

## 2026-05-03（Phase 5 啟動）

### 🎉 Phase 5 W18 完整收尾 ✅（D5 — solo_memory_match + W18 retro）
**主題**：W18 元件擴充週完成、5 個新元件 live、+26 情境覆蓋
**範圍**：3 新檔（D5 元件 + 測試 + W18 retro 文件）

W18 五天累計：
- D1 host_lottery_wheel（轉盤抽獎）+6 情境
- D2 host_progress_quest（全場進度條）+6 情境
- D3 host_word_cloud（即時字雲）+5 情境
- D4 quest_chain（任務鏈）+5 情境
- D5 memory_match（配對記憶遊戲）+4 情境

**統計**：15+ 檔 / ~3,300 行 / 5 commits / 49 測試全綠 / smoke 51/51

**5 大市場全強化**：公部門 / 私部門 / 活動 / 空間 / 交誼

**Smoke test 維持 51/51**

**W18 完整收尾** → [changes/2026-05-03-phase5-w18-complete.md](changes/2026-05-03-phase5-w18-complete.md)
**W18 D5 細節** → [changes/2026-05-03-phase5-w18-d5-memory-match.md](changes/2026-05-03-phase5-w18-d5-memory-match.md)

⏭ 下一步：Phase 5 W19 — 情境模板擴充（12 → 20+）

### ⛓ Phase 5 W18 D4 ✅（quest_chain 任務鏈元件）
**主題**：街區走讀 / 內訓 / 員工旅遊通用線性任務鏈（5+ 情境）
**範圍**：3 新檔 + 3 修改

關鍵變動：
- `client/src/components/game/multi/QuestChain.tsx`（新）
  - 進度條 + 站點列表（已完成 ✅ / 當前 🔢 / 鎖住 🔒）
  - 當前站答題（input + hint + 送出）
  - 達 N 次失敗顯示 hint
  - 全部完成 banner（金牌獎勵 + onComplete）
  - 純函式 checkStationAnswer / calculateChainProgress
- `QuestChainPage.tsx`（新）
  - local state + localStorage 持久化（重整不卡關）
  - W18 D4 簡化版、W19+ 補 team WS sync
- `QuestChain.test.tsx`（新）11 測試全綠
- GamePageRenderer 註冊
- getDefaultConfigForPageType 加 3 站範例

**新覆蓋情境**：街區走讀 / 商圈打卡 / 內訓任務鏈 / 員工旅遊景點 / 解謎活動（+5）

**W18 累計（D1-D4）**：+22 情境覆蓋

**Smoke test 維持 51/51**

**細節** → [changes/2026-05-03-phase5-w18-d4-quest-chain.md](changes/2026-05-03-phase5-w18-d4-quest-chain.md)

⏭ 下一步：W18 D5 — solo_memory_match + W18 retro

### 💬 Phase 5 W18 D3 ✅（host_word_cloud 即時字雲元件）
**主題**：玩家送詞、字雲即時生成（婚禮 / 同學會 / 內訓 5+ 情境）
**範圍**：3 新檔 + 4 修改

關鍵變動：
- `client/src/components/game/host/WordCloud.tsx`（新）
  - 大螢幕：紫色漸層 + 字雲（詞頻 → 字體 + 6 色循環）
  - 新詞動畫：2.5s 從上往下掉
  - 詞頻 > 1 顯示 ×N
  - 玩家端：input + 送出 + 已用次數 + top 5 熱詞
  - 純函式 calculateWordSize / getSortedWords（易測試）
- `WordCloudPage.tsx`（新）— WS 容器
  - pulse submit 雙重防超限（client UX + server 強制）
- `WordCloud.test.tsx`（新）9 測試全綠
- GamePageRenderer + HostPageRenderer 註冊
- getDefaultConfigForPageType 加預設

**新覆蓋情境**：婚禮新人特質 / 同學會記憶詞 / 內訓回饋 / 派對暖身（+5）

**W18 累計（D1-D3）**：+17 情境覆蓋

**Smoke test 維持 51/51**

**細節** → [changes/2026-05-03-phase5-w18-d3-word-cloud.md](changes/2026-05-03-phase5-w18-d3-word-cloud.md)

⏭ 下一步：W18 D4 — multi_quest_chain（隊伍任務鏈）

### 🚀 Phase 5 W18 D2 ✅（host_progress_quest 全場進度條元件）
**主題**：街區走讀 / 內訓 KPI / 通用全場進度視覺化（6+ 情境覆蓋）
**範圍**：3 新檔 + 4 修改

關鍵變動：
- `client/src/components/game/host/ProgressQuest.tsx`（新）— 主元件
  - 大螢幕：大進度條（漸層 emerald→cyan）+ 里程碑刻度 + 計數 + top 5 貢獻榜
  - 達成里程碑覆蓋層慶祝動畫（3.5s）
  - 玩家端：全場進度 + 我的貢獻 + 推進按鈕
  - 純函式 calculateProgress / detectNewMilestones（易測試）
- `ProgressQuestPage.tsx`（新）— WebSocket 容器
  - pulse `complete` 防超過 totalTasks
  - 自動偵測新里程碑加入 milestonesReached
- `ProgressQuest.test.tsx`（新）— 9 測試全綠
- GamePageRenderer + HostPageRenderer 註冊
- `getDefaultConfigForPageType` 加預設

**新覆蓋情境**：街區 / 商圈 / 內訓 KPI / 員工旅遊 / 通用任務（+6）

**W18 累計（D1+D2）**：+12 情境覆蓋

**Smoke test 維持 51/51**

**細節** → [changes/2026-05-03-phase5-w18-d2-progress-quest.md](changes/2026-05-03-phase5-w18-d2-progress-quest.md)

⏭ 下一步：W18 D3 — host_word_cloud（即時字雲）

### 🎯 Phase 5 W18 D1 ✅（host_lottery_wheel 轉盤抽獎元件）
**主題**：婚禮 / 派對 / 福委會通用轉盤抽獎（6+ 情境覆蓋）
**範圍**：3 新檔 + 4 修改

關鍵變動：
- `client/src/components/game/host/LotteryWheel.tsx`（新）— 主元件
  - CSS clip-path 切片轉盤（無 Canvas）
  - 5 圈 ease-out cubic 減速到中獎位置
  - 大螢幕：指針 + 圓盤 + 中獎 banner
  - 玩家端：報名按鈕 + 中獎結果區分「您 / 他」
  - 純函式 calculateWheelAngle / buildInitialLotteryState 易測試
- `LotteryWheelPage.tsx`（新）— WebSocket 容器（pulse: join/spin/stop）
- `LotteryWheel.test.tsx`（新）— 9 測試全綠
- GamePageRenderer + HostPageRenderer 註冊 host_lottery_wheel
- `getDefaultConfigForPageType` 加預設 config

**新覆蓋情境**：婚禮抽伴娘 / 生日抽禮物 / 福委會 / 派對 / 尾牙（+6）

**Smoke test 維持 51/51**

**細節** → [changes/2026-05-03-phase5-w18-d1-lottery-wheel.md](changes/2026-05-03-phase5-w18-d1-lottery-wheel.md)

⏭ 下一步：W18 D2 — host_progress_quest（全場進度條）

### 🎉 Phase 5 W17 完整收尾 ✅（D5 — retro + ADR-0013 W18 規劃）
**主題**：W17 業務週工程備援任務全套完成、W18 元件擴充清單就緒
**範圍**：2 個新文件（retro + ADR）

W17 五天累計：
- D1 業務跑團 SOP（10 步驟、5 錨點反饋表）
- D2 公開 FAQ 頁（14 題 7 類）
- D3 ROI 計算機（5 種活動 + Slider 試算）
- D4 Pilot Health endpoint（W20 雛形）
- D5 retro + W18 規劃

**統計**：12 檔 / ~1,500 行 / 5 commits / smoke 48→51

**業務 KPI（W17）**：
- 接觸潛在客戶 / 真實成交 / 完整跑團 / 客戶反饋 ⏳ 業務統計中

**ADR-0013 W18 5 個新元件**：
- D1 host_lottery_wheel（轉盤抽獎、6+ 情境通用）
- D2 host_progress_quest（全場進度條、6+ 情境）
- D3 host_word_cloud（即時字雲、5+ 情境）
- D4 multi_quest_chain（隊伍任務鏈、5+ 情境）
- D5 solo_memory_match（配對記憶遊戲、4+ 情境）

**Smoke test 維持 51/51**（純 docs）

**W17 完整收尾** → [changes/2026-05-03-phase5-w17-complete.md](changes/2026-05-03-phase5-w17-complete.md)
**ADR-0013** → [decisions/0013-w18-component-expansion.md](decisions/0013-w18-component-expansion.md)

⏭ 下一步：W18 D1 — host_lottery_wheel 元件實作

### 📊 Phase 5 W17 D4 ✅（Admin Pilot 健康度雛形 endpoint）
**主題**：admin 一個 endpoint 看平台運作（為 W20 觀測儀表板鋪路）
**範圍**：1 新檔 + 2 修改

關鍵變動：
- `server/routes/admin-pilot-health.ts`（新）
  - GET /api/admin/pilot/health（admin 認證）
  - 三大區塊：activity / coverage / serviceStatus
  - 場域過濾（super_admin / 一般 admin）
  - 不暴露 secrets（只看 service 有沒配置）
- 註冊到 routes/index.ts
- smoke test 加 401 驗證

**回傳結構**：
- activity：activeSessions / completedSessions30d / totalSessions30d / completionRate
- coverage：distinctScenarios / scenarioIds / fieldsCount
- serviceStatus：lineBot / lineNlu / cronEnabled / webhookDispatch / payment / email / ai

**Smoke test 50 → 51**

**雛形原則**：W17 D4 endpoint only、W20 才做完整 UI（看真實數據後再設計）

**細節** → [changes/2026-05-03-phase5-w17-d4-pilot-health.md](changes/2026-05-03-phase5-w17-d4-pilot-health.md)

⏭ 下一步：W17 D5 — W17 業務週 retro + W18 元件擴充清單

### 💰 Phase 5 W17 D3 ✅（ROI 計算機公開頁）
**主題**：客戶填 3 參數即時試算 ROI（業務殺手級工具）
**範圍**：1 新檔 + 3 修改

關鍵變動：
- `client/src/pages/RoiCalculator.tsx`（新）
  - 5 種活動類型（婚禮 / 同學會 / 內訓 / 街區 / 破冰）
  - Slider 輸入：人數（10-500）+ 預算（3K-200K）
  - 3 個輸出：節省時間 / 互動率提升 / 互動價值
  - 總結：ROI 比例（例 1:5.3）
- App.tsx /roi 路由
- PitchDeck 加「💰 ROI 試算」CTA
- smoke PUBLIC_PAGES 加 /roi

**試算依據透明**：時薪 NT$ 500、業界互動率 30% vs 75%、來賓單值 NT$ 80-200

**Smoke test 49 → 50**

**細節** → [changes/2026-05-03-phase5-w17-d3-roi-calculator.md](changes/2026-05-03-phase5-w17-d3-roi-calculator.md)

⏭ 下一步：W17 D4 — admin 健康度儀表板雛形 / 業務反饋 hotfix

### ❓ Phase 5 W17 D2 ✅（公開 FAQ 頁）
**主題**：客戶 self-service 14 個常見問題（業務不必每次都答）
**範圍**：1 新檔 + 3 修改

關鍵變動：
- `client/src/pages/Faq.tsx`（新）— 14 題分 7 類（規模 / 體驗 / 資料 / 連線 / 客製 / 收費 / 整合）
- `App.tsx` `/faq` 路由註冊
- `PitchDeck.tsx` 底部 CTA 加「常見問題」按鈕
- smoke test PUBLIC_PAGES 加 `/faq`

**互動**：點擊展開 / 收合、一次只開一個、底部三個 CTA（簡報 / 找情境 / 價格）

**Smoke test 48 → 49**

**細節** → [changes/2026-05-03-phase5-w17-d2-faq-page.md](changes/2026-05-03-phase5-w17-d2-faq-page.md)

⏭ 下一步：W17 D3 — 業務反饋 hotfix / ROI 計算 / admin UX 微調

### 🚀 Phase 5 W17 D1 ✅（真實客戶 pilot 啟動）
**主題**：W17 業務週啟動、SOP + 反饋表就緒
**範圍**：3 個新文件（純 docs）

關鍵變動：
- `docs/runbooks/customer-pilot.md`（新）
  - 10 步驟業務跑團 SOP（每步 ≤ 30 分鐘）
  - 5 個常見 FAQ（人數 / App / 資料 / 連線 / 客製）
  - 業務工具速查表（6 個公開頁）
- `docs/runbooks/pilot-feedback-template.md`（新）
  - 5 個關鍵錨點（對齊 ADR-0012）
  - 詳細反饋（活動前 / 中 / 後）
  - 競品比較 + 後續意願
- `docs/changes/2026-05-03-phase5-w17-d1-customer-pilot.md`

**W17 預期**：接觸 ≥ 5 客戶、成交 ≥ 1 場、反饋 ≥ 1 份

**Smoke test 維持 48/48**（純 docs 變動）

**細節** → [changes/2026-05-03-phase5-w17-d1-customer-pilot.md](changes/2026-05-03-phase5-w17-d1-customer-pilot.md)

⏭ 下一步：W17 D2 — 業務跑客戶 / 工程備援任務

---

### 🎉 Phase 4 完整收尾 ✅（W16 D5 — Phase 4 retro + Phase 5 ADR）
**主題**：Phase 4 W13-W16 全套完成、Phase 5 規劃 ADR-0012
**範圍**：2 個新文件

關鍵成果（Phase 4 整體）：
- 4 週 / 20 工作日 / 50+ 檔 / ~5,000 行 / 19 commits
- Smoke test 38 → 48（+10 筆驗證）
- admin 體驗從電腦端 → LINE 隨身（30 秒建場 ⚡ 10×）
- 完整工具鏈：建場 / 管理 / reminder / webhook 全套

商業價值對比：
- 建場時間：5-10 分鐘 → 30 秒
- 玩家進入：QR + 輸入名 → LINE LIFF 自動帶入
- 過期通知：靜默等過期 → 前 1 小時 LINE 推播
- 客戶通知：admin 手動 → webhook 自動派發

Phase 5 規劃（W17-W21）：
- W17：真實客戶 + 第一場付費活動
- W18：元件庫擴充 5 個 host 新元件
- W19：情境模板擴充（12 → 20+）
- W20：觀測 + 健康度儀表板
- W21：緩衝 + Phase 6 規劃

**Smoke test 維持 48/48**

**Phase 4 完整收尾** → [changes/2026-05-03-phase4-complete.md](changes/2026-05-03-phase4-complete.md)
**Phase 5 ADR** → [decisions/0012-phase5-direction.md](decisions/0012-phase5-direction.md)

⏭ 下一步：Phase 5 W17 D1 — 真實客戶招募啟動

### ⏰ Phase 4 W16 D4 ✅（活動即將過期 LINE reminder）
**主題**：過期前 1 小時自動推 LINE 提醒（避免活動意外結束）
**範圍**：2 新檔 + 1 修改

關鍵變動：
- `server/lib/expiring-session-checker.ts`（新）
  - checkExpiringSessionsAndNotify（± 10 分鐘 buffer）
  - 用 Set 防重複（不動 schema、紅線符合）
  - fire-and-forget 推給所有 LINE_ADMIN_USER_IDS
- `server/routes/cron-endpoints.ts`（新）
  - GET /api/cron/health（公開、不洩漏 secret）
  - POST /api/cron/check-expiring-sessions（CRON_SECRET 認證）
- 註冊到 server/routes/index.ts
- 系統 crontab 範例：每小時觸發

**LINE 推播範本**：含 hostUrl + 結束指令提示

**Smoke test 45 → 48**（新增 3 筆驗證）

**細節** → [changes/2026-05-03-phase4-w16-d4-expiring-reminder.md](changes/2026-05-03-phase4-w16-d4-expiring-reminder.md)

⏭ 下一步：W16 D5 — Phase 4 整體收尾 + Phase 5 規劃 ADR-0012

### 🛠 Phase 4 W16 D3 ✅（LINE Admin 直接管理活動）
**主題**：admin 在 LINE 看 active 活動 + 結束指定活動（不必開電腦）
**範圍**：1 新檔 + 3 修改

關鍵變動：
- `server/lib/admin-line-actions.ts`（新）
  - listActiveSessionsForLineAdmin / endSessionForLineAdmin
  - 認證透過 W15 D5 環境變數、不動 schema
  - 場域過濾 + webhook 派發（與 admin endpoint 一致）
- `server/lib/admin-nlu.ts`
  - 加 list_active / end_session intent
  - 快速路徑（regex 不耗 AI）：「@chito 我的活動」/「@chito 結束 <id>」
- `server/routes/line-webhook.ts`
  - formatActiveSessionsReply / postEndQuickReply
  - end_session 支援前 8 字元（admin 不必複製完整 UUID）
- Quick reply 加「📋 我的活動」（第一順位）

**完整 admin LINE 工具鏈（W15-W16 累積）**：
- 建場 / 看用法 / 看情境 / 看 active / 結束某場

**Smoke test 維持 45/45**

**細節** → [changes/2026-05-03-phase4-w16-d3-line-admin-actions.md](changes/2026-05-03-phase4-w16-d3-line-admin-actions.md)

⏭ 下一步：W16 D4 — 排程推播（cron）

### 🎉 Phase 4 W16 D2 ✅（LINE Quick Reply + Sticker）
**主題**：admin LINE 操作體驗升級（按鈕 + 慶祝貼圖）
**範圍**：2 個檔案修改

關鍵變動：
- `server/lib/line-bot.ts` 加 LineQuickReply / LineQuickReplyItem 型別
- `server/routes/line-webhook.ts` 加兩個工廠
  - `adminQuickReply()` — 6 個常用指令按鈕（help/list/婚禮/生日/破冰/同學會）
  - `celebrationSticker()` — 拍手慶祝 sticker（LINE Friends 11537）
- 訊息分發策略
  - 建場成功 → sticker + text(quickReply)
  - 失敗 / help / list → text(quickReply)
  - 一般訊息：admin 給 quickReply、非 admin 不給（避免困惑）

**效果**：
- 建場成功有慶祝感（admin 印象深刻）
- 點按鈕 1 秒 vs 打字 5 秒 ⚡ 5×

**Smoke test 維持 45/45**

**細節** → [changes/2026-05-03-phase4-w16-d2-line-quick-reply.md](changes/2026-05-03-phase4-w16-d2-line-quick-reply.md)

⏭ 下一步：W16 D3 — LINE 進階互動（postback / Flex Message / admin 管理）

### 🚀 Phase 4 W16 D1 ✅（instantiator-line 擴充多元件）
**主題**：LINE admin 建場從「只第 1 個 host」→「全元件（host + multi + solo + shared）」
**範圍**：3 個檔案修改

關鍵變動：
- `server/routes/scenarios.ts` 兩個 helper 改 export（getDefaultConfigForPageType / getGameModeForComponent）
- `server/lib/scenario-instantiator-line.ts` 重寫
  - 建立所有 components（不只第 1 個 host）
  - LineInstance 介面 + primaryHostUrl/primaryPlayUrl/primaryGameUrl
  - 序列建立（DB 連線壓力 + 易 debug）
- `server/routes/line-webhook.ts` 加 formatInstantiateReply
  - 主入口（host 第一個 / 非 host 第一個）
  - 元件清單（最多顯示 5 個、超過 truncate 提示）
  - LINE 5000 字上限保護

**場景覆蓋率**：60% → 100%（12 情境全支援）

**Smoke test 維持 45/45**

**細節** → [changes/2026-05-03-phase4-w16-d1-multi-component-instantiate.md](changes/2026-05-03-phase4-w16-d1-multi-component-instantiate.md)

⏭ 下一步：W16 D2 — LINE reply 進階範本（quick reply / sticker / 多訊息）

### 🎉 Phase 4 W15 完整收尾 ✅（D5 — Admin 認證 + LINE 真建場）
**主題**：LINE admin @chito 指令一鍵真實建場（30 秒收到 hostUrl）
**範圍**：3 個新檔 + 2 個修改 + ADR-0011

關鍵變動：
- `server/lib/admin-line-auth.ts`（新）— LINE userId → admin 對應（環境變數版）
- `server/lib/scenario-instantiator-line.ts`（新）— LINE admin 簡化建場（W15 D5 只建第 1 個 host 元件、W16 擴充全部）
- `server/routes/line-webhook.ts`（修改）— 偵測 admin + create_scenario → 真建場 → reply hostUrl + playUrl
- `health` endpoint 加 nluConfigured / adminConfigured / adminCount
- ADR-0011 W16 規劃（完整 instantiate + 進階 LINE + Phase 5）

**業務加速**：admin 開電腦建場 5-10 分鐘 → LINE 30 秒 ⚡ 10×

**W15 五天完整鏈路**：
- D1 LINE Bot scaffold（webhook + signature）
- D2 LINE Pusher（活動推播）
- D3 Admin NLU（DeepSeek 解析、純預覽）
- D4 活動結束 webhook 鉤子
- D5 admin 認證 + 真建場

**Smoke test 44 → 45 全綠**

**細節** → [changes/2026-05-03-phase4-w15-d5-admin-instantiate.md](changes/2026-05-03-phase4-w15-d5-admin-instantiate.md)
**ADR** → [decisions/0011-w16-planning.md](decisions/0011-w16-planning.md)

⏭ 下一步：Phase 4 W16 D1 — instantiator-line 擴充支援多元件 + multi/solo

### 🪝 Phase 4 W15 D4 ✅（活動結束 webhook 鉤子）
**主題**：host_session ended → 自動派 instance.expired webhook
**範圍**：1 個檔案修改

關鍵變動：
- `server/routes/host-sessions.ts` POST /:id/end 加 webhook 派發
  - 偵測 `[via:api/v1]` 標記（W15 D5 補完整 game→apiKey mapping）
  - 派 instance.expired 給 `API_KEY_DEFAULT_FOR_WEBHOOKS`（如有設）
  - fire-and-forget（不 block admin UI）
  - HMAC SHA-256 簽章 + 3 retry（dispatcher 內建）

**Webhook payload**：sessionId / gameId / endedAt / endedBy

**Smoke test 維持 44/44**（W15 D4 不新增 endpoint、僅整合既有 /end 流程）

**細節** → [changes/2026-05-03-phase4-w15-d4-session-end-webhook.md](changes/2026-05-03-phase4-w15-d4-session-end-webhook.md)

⏭ 下一步：W15 D5 — admin 認證 + 真實建場 + W16 規劃

### 🧠 Phase 4 W15 D3 ✅（Admin NLU 自然語言解析）
**主題**：admin 在 LINE 用自然語言預覽指令（DeepSeek 整合）
**範圍**：3 個檔案

關鍵變動：
- `server/lib/admin-nlu.ts` Admin NLU lib
  - parseAdminCommand 解析自然語言為結構化指令
  - 4 種 intent: create_scenario / help / list_scenarios / unknown
  - 快速路徑（help/list regex 不耗 AI cost）
  - DeepSeek prompt 含 12 情境動態清單
  - formatCommandReply 4 種訊息範本
- line-webhook 整合
  - 偵測 `@chito` 開頭 → parseAdminCommand → formatCommandReply
  - 一般訊息保留 echo + 加「試試 @chito help」提示
- 友善 fallback（OPENROUTER_API_KEY 未設）

**範例**：
```
"@chito 婚禮 Hung & Anita 5/15"
→ {scenarioId: "wedding", displayName: "Hung & Anita 5/15 婚禮"}
```

**W15 D5 才真建場**：W15 D3 純解析預覽（避免假指令誤建）

**Smoke test 維持 44/44**

**細節** → [changes/2026-05-03-phase4-w15-d3-admin-nlu.md](changes/2026-05-03-phase4-w15-d3-admin-nlu.md)

⏭ 下一步：W15 D4 — 活動結束推播鉤子

### 📣 Phase 4 W15 D2 ✅（LINE Pusher + activity reminder endpoint）
**主題**：admin 主動推播 LINE 通知（4 種 type）
**範圍**：3 個檔案

關鍵變動：
- `server/lib/line-pusher.ts` 高層推播 helper
  - pushActivityCreated（建場通知）
  - pushActivityReminder（24h / 1h 前提醒）
  - pushActivityEnded（結束 + 回顧）
  - broadcastToUsers + 100ms throttle
- POST /api/admin/scenarios/notify-line
  - type: created / reminder-24h / reminder-1h / ended
  - 503 graceful（未設 ACCESS_TOKEN）
- smoke test 加 4c3 (43 → 44)

**Smoke test 44/44 全綠**

**細節** → [changes/2026-05-03-phase4-w15-d2-line-pusher.md](changes/2026-05-03-phase4-w15-d2-line-pusher.md)

⏭ 下一步：W15 D3 — admin 文字建場（DeepSeek NLU）

### 🤖 Phase 4 W15 D1 ✅（LINE Bot scaffold）
**主題**：Bot 雙向溝通基礎（Webhook + signing 驗證 + reply API）
**範圍**：4 個檔案

關鍵變動：
- `server/lib/line-bot.ts` Bot 工具
  - verifyLineSignature (HMAC SHA-256 + base64 + timingSafeEqual)
  - replyMessage / pushMessage
- `server/routes/line-webhook.ts`
  - GET /api/webhooks/line/health（公開）
  - POST /api/webhooks/line（簽章驗證 + fire-and-forget）
  - 預設 echo bot（W15 D2-D3 加 NLU）
- routes/index.ts 註冊
- smoke test 加 5h (41 → 43)

**環境變數**：LINE_CHANNEL_SECRET + LINE_CHANNEL_ACCESS_TOKEN

**Smoke test 43/43 全綠**

**細節** → [changes/2026-05-03-phase4-w15-d1-line-bot-scaffold.md](changes/2026-05-03-phase4-w15-d1-line-bot-scaffold.md)

⏭ 下一步：W15 D2 — 推播 activity reminder

### 🎉 Phase 4 W14 完整收尾 + ADR-0010 LINE Bot 規劃 ✅
**主題**：W14 5 天累計 + W15 LINE Bot 整合策略
**範圍**：W14 23 檔、~1,400 行 + 2 個收尾文件 + ADR-0010

**W14 5 天時序**：
- D1（`aee902a7`）LIFF SDK + PlayLiff 中繼頁
- D2（`d6b3b19c`）/play LINE profile 整合
- D3（`409b4c2c`）useMyUserName hook + 4 Page 元件
- D4（`3a771976`）QR 列印頁 LIFF URL 切換
- D5 W14 收尾 + ADR-0010

**完整玩家旅程**：admin 列印「💚 LINE」QR → 玩家從 LINE 點 → LIFF SDK 取 displayName → 跳 /play 帶名字 → host 元件全部用 LINE 名字

**ADR-0010 W15 LINE Bot 路徑**：
- 功能 A 活動推播（24h / 1h 前 / 結束後）
- 功能 B admin 文字建場（DeepSeek NLU）
- 暫緩：玩家報名 / 客服 NLU / CRM 行銷

**W14 完整收尾** → [changes/2026-05-03-phase4-w14-complete.md](changes/2026-05-03-phase4-w14-complete.md)
**ADR-0010** → [decisions/0010-line-bot-integration.md](decisions/0010-line-bot-integration.md)

⏭ 下一步：Phase 4 W15 D1 — LINE Bot scaffold 啟動

### 💚 Phase 4 W14 D4 ✅（QR 列印頁 LIFF URL 切換）
**主題**：admin 一鍵切換玩家 QR 為 LIFF URL（從 LINE 進入）
**範圍**：1 個檔案

關鍵變動：
- ScenarioQrPrint.tsx 新增 `urlMode: "web" | "liff"` state
- Toolbar UI 切換器（🌐 一般 / 💚 LINE）
- maybeLiffify() helper：`/play/...` → `/liff/play/...`
- localStorage `chitoQrUrlMode` 記住選擇
- 切換時自動重生 QR
- 大螢幕 QR 永遠用一般 URL（LIFF 不適合 host）

**Smoke test 維持 41/41**

**細節** → [changes/2026-05-03-phase4-w14-d4-qr-liff-toggle.md](changes/2026-05-03-phase4-w14-d4-qr-liff-toggle.md)

⏭ 下一步：W14 D5 — W14 收尾 + W15 LINE Bot 規劃

### 🪝 Phase 4 W14 D3 ✅（useMyUserName hook + 4 Page 元件整合）
**主題**：所有主要 host 元件統一從 hook 取 LINE 名字
**範圍**：5 個檔案

關鍵變動：
- `client/src/hooks/useMyUserName.ts` 新 hook
  - URL query > localStorage > "" 三層優先序
  - 跨 tab 同步（listen storage event）
  - 30 字內限制
- 4 個 Page 元件整合：
  - PolaroidCollagePage（婚禮王牌）
  - GuestbookDigitalPage（婚禮配套）
  - TriviaShowdownPage（園遊會主舞台）
  - KnowledgeMapPage（街區走讀，prop 向下相容）

**Pattern**：`lineName || useAuth user || "匿名"`

**Smoke test 維持 41/41**

**細節** → [changes/2026-05-03-phase4-w14-d3-username-hook.md](changes/2026-05-03-phase4-w14-d3-username-hook.md)

⏭ 下一步：W14 D4 — QR code LIFF URL 選項

### 👋 Phase 4 W14 D2 ✅（LINE profile 整合到 /play）
**主題**：玩家從 LINE 進入後自動帶名字、不用手動輸入
**範圍**：3 個檔案

關鍵變動：
- HostPlay.tsx 新增 `useLineProfileFromQuery()` hook
  - 讀 URL query `line_display_name`
  - 存 localStorage `chitoUserName`（跨頁持久）
  - Header 顯示「👋 {LINE 名字}」綠色強調
- HostPageRenderer 加 `myUserName` prop 傳遞
- KnowledgeMapPage 已自動接收（既有支援）

**localStorage 規範**：`chitoUserName` 30 字內、跨頁可讀

**Smoke test 維持 41/41**

**細節** → [changes/2026-05-03-phase4-w14-d2-line-profile-integration.md](changes/2026-05-03-phase4-w14-d2-line-profile-integration.md)

⏭ 下一步：W14 D3 — 其他 Page 元件 myUserName 整合

### 📱 Phase 4 W14 D1 ✅（LINE LIFF MVP scaffold）
**主題**：玩家從 LINE 直接進入遊戲、不離開 LINE app
**範圍**：4 個檔案

關鍵變動：
- `client/src/lib/liff.ts` LIFF SDK wrapper
  - Lazy load CDN SDK（不裝 npm）
  - initLiff / triggerLineLogin / closeLiffWindow
- `client/src/pages/PlayLiff.tsx` LIFF 玩家中繼頁
  - 自動取 LINE profile → 跳 /play?line_user_id=...
  - fallback 到一般 /play（無 LIFF ID 或非 LINE 環境）
- App.tsx 路由 /liff/play/:sessionId
- smoke test 加 5g (40 → 41)

**環境變數**：`VITE_LIFF_ID_PLAY`（admin 在 LINE 後台申請後設定）

**Smoke test 41/41 全綠**

**細節** → [changes/2026-05-03-phase4-w14-d1-liff-mvp.md](changes/2026-05-03-phase4-w14-d1-liff-mvp.md)

⏭ 下一步：W14 D2 — LINE profile 整合到 /play 頁

### 🎉 Phase 3 完整收尾 + ADR-0009 Phase 4 方向 ✅
**主題**：W12 5 天累計 + Phase 3 整體 4 週路徑收尾 + Phase 4 規劃
**範圍**：W12 26 檔、~2,141 行 + Phase 3 累計 93 檔、~7,940 行

**Phase 3 W9-W12 四週時序**：
- W9（17 檔）AI 內容 + 客戶 onboarding 工具
- W10（24 檔）付費 + 信件 + 配額（Recur.tw + Resend + Stripe fallback）
- W11（26 檔）Public API + Rate limit + Idempotency + OpenAPI
- W12（26 檔）API Key Store + SDK + Webhook 雙向

**Phase 3 累積能力**：
- ✅ AI 內容生成（DeepSeek）
- ✅ 付費機制（Recur.tw 主 + Stripe fallback）
- ✅ 信件系統（Resend）
- ✅ 用量配額追蹤
- ✅ Public REST API v1（含 SDK + Webhook）
- ✅ 雙向通訊（outbound + inbound webhook）
- ✅ 完整 onboarding 文件（客戶 + 代理商）
- ✅ Smoke test 自動化（24 → 40，+16 個檢查）

**ADR-0009 Phase 4 方向**：
- 選項 A 真實客戶 + 案例（業務）
- 選項 B LINE LIFF 整合（技術）
- W13-W16 路徑：W13 真實客戶 / W14 LIFF MVP / W15 LINE Bot / W16 收尾

**完整收尾** → [changes/2026-05-03-phase3-complete.md](changes/2026-05-03-phase3-complete.md)
**ADR-0009** → [decisions/0009-phase4-direction.md](decisions/0009-phase4-direction.md)

⏭ 下一步：Phase 4 W13 — 真實付費客戶 + LINE LIFF MVP

### 🧪 Phase 3 W12 D4 ✅（Webhook 測試 endpoint + SDK 擴充）
**主題**：代理商可主動測試 webhook（onboarding 階段驗證）
**範圍**：4 個檔案

關鍵變動：
- 新 `POST /api/v1/webhooks/test` endpoint
  - 派送 webhook.test 測試事件
  - 未設 webhook URL → 400 + webhook_not_configured
- OpenAPI 加 /keys/me + /webhooks/test paths（5 → 7 paths）
- SDK 加 `chito.webhooks.test()` resource
- smoke test 加 5f (39 → 40)

**用法**：
```ts
const test = await chito.webhooks.test();
// → 代理商檢查自家 webhook endpoint log
```

**Smoke test 40/40 全綠**

**細節** → [changes/2026-05-03-phase3-w12-d4-webhook-test.md](changes/2026-05-03-phase3-w12-d4-webhook-test.md)

⏭ 下一步：W12 D5 — Phase 3 整體收尾 + Phase 4 規劃

### 📡 Phase 3 W12 D3 ✅（Webhook 反向觸發機制）
**主題**：CHITO 主動通知代理商（事件發生時）
**範圍**：3 個檔案

關鍵變動：
- `server/lib/webhook-dispatcher.ts` outbound dispatcher
  - HMAC SHA-256 簽章（X-CHITO-Signature: t=...,v1=...）
  - Fire-and-forget + setTimeout retry（1/5/15 分鐘）
  - 4xx 不重試、5xx 進重試
- v1.ts POST /instances 整合
  - 建場成功後 dispatch instance.created
  - 不阻擋 response（先 dispatch 再 res.json）
- ApiDocs 加「📡 Webhook 反向觸發」區段
  - 含 Node 簽章驗證範例（timingSafeEqual）

**環境變數**：
- API_KEY_WEBHOOK_URL_<keyIdShort>（代理商 URL）
- API_KEY_WEBHOOK_SECRET_<keyIdShort>（簽章）

**事件類型**：
- instance.created（已實作）
- instance.expired / payment.succeeded（後續）

**Smoke test 維持 39/39**

**細節** → [changes/2026-05-03-phase3-w12-d3-webhook-dispatcher.md](changes/2026-05-03-phase3-w12-d3-webhook-dispatcher.md)

⏭ 下一步：W12 D4 — 反饋微調 / W12 D5 Phase 3 收尾

### 📦 Phase 3 W12 D2 ✅（TypeScript SDK package）
**主題**：代理商整合工具 — 零依賴 TypeScript SDK
**範圍**：4 個檔案

關鍵變動：
- `sdk/typescript/` 新目錄
  - `package.json` (Node 18+, zero deps)
  - `src/index.ts` ChitoClient 主類別（5 個 resource）
  - `src/types.ts` 完整 OpenAPI types
  - `README.md` 150+ 行完整文件
- ApiDocs 公開頁加「📦 TypeScript SDK」區段（含 import 範例）

**SDK 介面**：
```ts
const chito = new ChitoClient({ apiKey: "ck_test_xxx" });
chito.scenarios.list({ status: "live" });
chito.instances.create({ scenarioId, idempotencyKey });
chito.keys.me();
chito.health();
```

**特色**：零依賴（內建 fetch）、完整 types、ChitoApiError 錯誤類別、可注入 fetch（polyfill）

**Smoke test 維持 39/39**

**細節** → [changes/2026-05-03-phase3-w12-d2-typescript-sdk.md](changes/2026-05-03-phase3-w12-d2-typescript-sdk.md)

⏭ 下一步：W12 D3 — 業務驗證（找客戶 / 真實活動）

### 🔐 Phase 3 W12 D1 ✅（API Key Store 抽象層 + JSON metadata）
**主題**：API key 從純字串升級為含 metadata（label / fieldId / quota）
**範圍**：4 個檔案

關鍵變動：
- `server/lib/api-key-store.ts` 新抽象層
  - 來源優先序：API_KEYS_JSON（推薦）> API_KEYS 純字串（向下相容）
  - 含 helper：findApiKey / listApiKeys / getApiKeyStats / reloadApiKeys
- `server/middleware/api-key.ts` 改用 store
  - ApiKeyContext 擴充 fieldId / quota / label
- `server/routes/api/v1.ts` 重構
  - 移除 getFieldIdForApiKey() helper
  - POST /instances 直接用 req.apiKey.fieldId
  - 新 endpoint GET /api/v1/keys/me（代理商查自己 metadata）
- smoke test 加 5e (38 → 39)

**JSON 格式**：
```json
[
  { "key": "ck_test_xxx", "label": "代理商 A", "fieldId": "field_xxx", "quota": 50 }
]
```

**Smoke test 39/39 全綠**

**細節** → [changes/2026-05-03-phase3-w12-d1-api-key-store.md](changes/2026-05-03-phase3-w12-d1-api-key-store.md)

⏭ 下一步：W12 D2 — 業務驗證（找客戶 / 真實活動）

### 🎉 Phase 3 W11 完整收尾 ✅（Public API + 代理商 onboarding 工具）
**主題**：W11 5 天累計 + 代理商 onboarding runbook
**範圍**：W11 26 檔、~2,606 行、smoke test 31→38

**W11 5 天時序**：
- D1（`0932a57c`）ADR-0008 + API key middleware + 3 read-only endpoints
- D2（`967b14c6`）Rate limit (60/min) + Idempotency (24h cache)
- D3（`170e4933`）POST /api/v1/instances + API key→fieldId mapping
- D4（`4d5db5c4`）OpenAPI 3.1 spec + ApiDocs 公開頁
- D5 代理商 onboarding runbook + W11 收尾

**新公開頁**：`/api-docs` + `/api/v1/openapi.json`

**新 endpoints**：5 個（health / openapi / scenarios×2 / instances）

**完整代理商工作流**：
1. 評估 /api-docs → 2. 簽約 → 3. 收 ck_test_xxx → 4. 自我測試 → 5. 收 ck_live_xxx → 6. 整合上線

**Runbook**：[runbooks/agency-onboarding.md](runbooks/agency-onboarding.md)

**Smoke test 38/38 全綠**

**完整收尾** → [changes/2026-05-03-phase3-w11-complete.md](changes/2026-05-03-phase3-w11-complete.md)

⏭ 下一步：Phase 3 W12 — 擴大客戶 + Phase 3 整體收尾

### 📖 Phase 3 W11 D4 ✅（OpenAPI 規格 + 公開 API 文件頁）
**主題**：代理商正式參考文件
**範圍**：4 個檔案

關鍵變動：
- `GET /api/v1/openapi.json` 公開 OpenAPI 3.1 規格 endpoint
- `client/src/pages/ApiDocs.tsx` 公開頁 `/api-docs`
  - Hero + 認證 + 速率 + Idempotency + Endpoints + Error 格式 + CTA
  - 每個 curl 範例一鍵複製
  - 右上「OpenAPI JSON」直接下載 spec
- App.tsx /api-docs 路由
- smoke test 加 5d (36 → 38): openapi.json + /api-docs 公開頁

**OpenAPI spec 含**:
- 4 endpoints: GET /health, GET /scenarios, GET /scenarios/{id}, POST /instances
- Schemas: Error / ScenarioListItem / Instance / InstanceComponent
- Security: ApiKeyAuth (Bearer)

**Smoke test 38/38 全綠**

**細節** → [changes/2026-05-03-phase3-w11-d4-api-docs.md](changes/2026-05-03-phase3-w11-d4-api-docs.md)

⏭ 下一步：W11 D5 — 收尾 + 代理商 onboarding runbook

### 🤝 Phase 3 W11 D3 ✅（POST /api/v1/instances 代理商一鍵建場）
**主題**：代理商核心 API + API key → fieldId mapping
**範圍**：3 個檔案

關鍵變動：
- `POST /api/v1/instances` endpoint
  - middleware: requireApiKey → rateLimit → idempotency
  - body: scenarioId / displayName / customerEmail
  - header: Idempotency-Key（24h 防重發）
- `getFieldIdForApiKey()` helper
  - 環境變數 `API_KEY_FIELD_<keyIdShort>` mapping
  - fallback: `API_KEY_DEFAULT_FIELD`
- `instantiateForApi()` 內嵌邏輯（W11 D5 可重構共用）
- description 標記 `[scenario:<id>] [via:api/v1]` 區分代理商建立
- smoke test 加 5c POST /instances 401 守衛 (35 → 36)

**完整代理商工作流**：
1. 取得 ck_live_xxx
2. 環境變數 admin 設好 API_KEY_FIELD_<keyIdShort>=field_xxx
3. POST /api/v1/instances 帶 scenarioId
4. 即得 hostUrl + playUrl 實例

**Smoke test 36/36 全綠**

**細節** → [changes/2026-05-03-phase3-w11-d3-instances-endpoint.md](changes/2026-05-03-phase3-w11-d3-instances-endpoint.md)

⏭ 下一步：W11 D4 — API 文件（OpenAPI / Postman）

### 🚦 Phase 3 W11 D2 ✅（Rate limit + Idempotency middleware）
**主題**：API 生產級保障（限速 + 防重發）
**範圍**：3 個檔案

關鍵變動：
- `server/middleware/rate-limit.ts` sliding window in-memory（60 req/min/key）
  - 429 + Retry-After / X-RateLimit-* headers
  - 每 5 分鐘自動清理過期 entries
- `server/middleware/idempotency.ts` 24h in-memory cache
  - Idempotency-Key header 防重發
  - cache key 隔離（apiKeyId:idempotencyKey）
- v1 routes 整合 rateLimit（順序：requireApiKey → rateLimit → handler）
- smoke test 加 5b 驗證 middleware 順序（34 → 35）

**設計**：
- in-memory 適合 W11 單 server、W12 規模擴大可升 Redis
- 401 不吃 rate quota（避免 brute force 耗盡他人配額）
- idempotency 24h TTL、不持久化

**Smoke test 35/35 全綠**

**細節** → [changes/2026-05-03-phase3-w11-d2-rate-limit-idempotency.md](changes/2026-05-03-phase3-w11-d2-rate-limit-idempotency.md)

⏭ 下一步：W11 D3 — POST /api/v1/instances（含計費）

### 🌐 Phase 3 W11 D1 ✅（Public API v1 啟動）
**主題**：對外 API + API key 認證機制 + read-only endpoints
**範圍**：4 個檔案

關鍵變動：
- ADR-0008 Public API 設計原則（path versioning / Bearer key / 統一 error）
- `server/middleware/api-key.ts` requireApiKey middleware
- `server/routes/api/v1.ts` 3 個 read-only endpoints：
  - GET /api/v1/health（公開）
  - GET /api/v1/scenarios（需 key）
  - GET /api/v1/scenarios/:id（需 key）
- smoke test 31 → 34（5a 加 health + 401 守衛 ×2）

**設計**：
- Versioning：URL path（`/api/v1/`）
- API key 格式：`ck_test_*` / `ck_live_*`（仿 Stripe）
- 環境變數：`API_KEYS`（逗號分隔，W12 改 DB）
- 統一 error 格式：`{ error: { code, message, documentation_url } }`

**Smoke test 34/34 全綠**

**細節** → [changes/2026-05-03-phase3-w11-d1-public-api.md](changes/2026-05-03-phase3-w11-d1-public-api.md)
**ADR** → [decisions/0008-public-api-design.md](decisions/0008-public-api-design.md)

⏭ 下一步：W11 D2 — Rate limit + Idempotency middleware

### 🎉 Phase 3 W10 完整收尾 ✅（付費 + 信件 + 配額三軸完整）
**主題**：W10 5 天累計 + Resend 信件整合
**範圍**：W10 24 檔、~1,633 行、smoke test 24→31

**W10 5 天時序**：
- D1（`370a4781`）Stripe scaffold + Pricing 公開頁 + ADR 切換
- D2（`4084aeb8`）Recur.tw API client + endpoints
- D3（`9aff6a8d`）Pricing 切換 Recur.tw + productId 環境變數
- D4（`476c6784`）用量配額追蹤
- D5 Resend 信件整合 + payment success email + W10 收尾

**新增 endpoints**：7 個（payments + recur + email/test + quota + 既有）

**3 套外部服務統一風格**：
- Stripe（國際 fallback）/ Recur.tw（主路徑）/ Resend（信件）
- 都用 fetch 直打、graceful 503、統一環境變數命名

**待 admin 設定**：
- RECUR_TW_API_KEY + RECUR_PRODUCT_<SCENARIO_ID>×12
- RESEND_API_KEY + EMAIL_FROM
- SCENARIO_QUOTA_DEFAULT / SCENARIO_QUOTA_FIELD_<id>

**Smoke test 31/31 全綠**

**完整收尾** → [changes/2026-05-02-phase3-w10-complete.md](changes/2026-05-02-phase3-w10-complete.md)

⏭ 下一步：Phase 3 W11 — 業務 API + 代理商 onboarding

### 📈 Phase 3 W10 D4 ✅（用量配額追蹤）
**主題**：admin 看本月情境建場用量 / 配額 / 重置時間
**範圍**：3 個檔案

關鍵變動：
- 新 endpoint `GET /api/admin/scenarios/quota`（場域過濾 + 環境變數配額）
- AdminDashboard「本月情境建場配額」Card
  - 進度條（綠/藍/琥珀依百分比）
  - ≥ 80% 警告 + 整卡轉琥珀
- 配額來源：`SCENARIO_QUOTA_FIELD_<fieldId>` > `SCENARIO_QUOTA_DEFAULT` > 50
- smoke test 29 → 30（4c2 quota 401 守衛）

**設計**：
- 不動 schema（環境變數）
- 純資訊性（不阻擋 instantiate）
- 80% 警告閾值（標準 disk usage 慣例）

**細節** → [changes/2026-05-02-phase3-w10-d4-quota.md](changes/2026-05-02-phase3-w10-d4-quota.md)

⏭ 下一步：W10 D5 — Resend 信件 + Recur webhook 簽章 + W10 收尾

### 🔀 Phase 3 W10 D3 ✅（Pricing 切換 Recur.tw、Stripe 退場為 fallback）
**主題**：Pricing 頁前端切換 Recur.tw 主路徑 + 後端 productId 環境變數對應
**範圍**：3 個檔案

關鍵變動：
- Pricing.tsx 改呼叫 `/api/payments/recur/create-checkout`（取代 Stripe）
- 後端自動從 `RECUR_PRODUCT_<SCENARIO_ID>` 環境變數查 productId
- friendly error 處理（RECUR_NOT_CONFIGURED / RECUR_PRODUCT_NOT_MAPPED → 「請聯絡業務」）
- UI 文案：信用卡 / LINE Pay / ATM / 超商 + 自動電子發票

**12 個產品 ID 環境變數規格**（admin 在 Recur.tw 後台建後填入）

**Smoke test 29/29 維持綠色**

**細節** → [changes/2026-05-02-phase3-w10-d3-pricing-recur-switch.md](changes/2026-05-02-phase3-w10-d3-pricing-recur-switch.md)

⏭ 下一步：W10 D4 — 用量配額追蹤

### 🇹🇼 Phase 3 W10 D2 ✅（Recur.tw API client 整合）
**主題**：依 ADR-0006 啟動 Recur.tw 主要付費路徑
**範圍**：3 個檔案

關鍵變動：
- `server/lib/recur-tw.ts` Recur.tw API client（fetch 直打 + JSON）
- `server/routes/payments.ts` 新增 2 endpoints：
  - POST /api/payments/recur/create-checkout（一次性 / 訂閱、503 graceful）
  - POST /api/payments/recur/webhook（待 D5 補簽章驗證）
- Health endpoint 加 `recurTwConfigured` / `recurWebhookConfigured` 欄位
- smoke test 28 → 29（4f Recur create-checkout 400/503 守衛）

**Recur.tw 設定就緒**：
- Base URL: `https://api.recur.tw/v1`
- Auth: Bearer sk_test_*
- 環境變數：`RECUR_TW_API_KEY` + `RECUR_TW_WEBHOOK_SECRET`
- 待生產設定 productId 對應（admin 在 Recur.tw 後台建立產品）

**Smoke test 29/29 全綠**

**細節** → [changes/2026-05-02-phase3-w10-d2-recur-tw.md](changes/2026-05-02-phase3-w10-d2-recur-tw.md)

⏭ 下一步：W10 D3 — Pricing 切換 Recur.tw、Stripe 退場為 fallback

### 💳 Phase 3 W10 D1 ✅（付費 scaffold + Pricing 公開頁 + ADR 切換）
**主題**：Stripe scaffold 上線 + ADR-0006 切換為 Recur.tw 主導
**範圍**：6 個檔案

關鍵變動：
- `server/lib/stripe-checkout.ts` Stripe Checkout 整合（保留為國際 fallback）
- `server/routes/payments.ts` 3 endpoints（create-checkout / webhook / health）
- `client/src/pages/Pricing.tsx` 公開定價頁（三方案 + 一次性下單流程）
- App.tsx 路由 /pricing 註冊
- smoke test 26 → 28（加 4d payments health + 4e pricing 頁）

**ADR 切換**（依用戶決策）：
- ADR-0006 改寫：Stripe + Recur.tw 雙軌 → **Recur.tw 主導**
- ADR-0007 新增：Resend 信件服務選用

**理由**：台灣客戶 95%+ / 抽成低 / 自動發票合規 / 單一 vendor 簡化
**Stripe**：保留 scaffold 當國際 fallback、不主動推

**Smoke test 28/28 全綠**：含 /pricing 公開頁 + payments health 公開端點

**細節** → [changes/2026-05-02-phase3-w10-d1-payment-scaffold.md](changes/2026-05-02-phase3-w10-d1-payment-scaffold.md)

⏭ 下一步：W10 D2 — Recur.tw API client + endpoint

### 🎉 Phase 3 W9 完整收尾 ✅（AI 內容 + 客戶 onboarding 工具完整化）
**主題**：W9 5 天累計 + ADR-0006 付費機制技術選型 + W10 規劃
**範圍**：W9 17 個檔、~1,560 行 + 5 個新文件

**W9 5 天時序**：
- D1（`63d0f629`）AI 內容生成 MVP（DeepSeek 整合）
- D2（`959124d9`）AI 預覽 UI + 雙軌建場（紫色 AI / 綠色 default）
- D3（`7c508f3a`）客戶 onboarding 文件包（onboarding + faq + cheatsheet）
- D4（`f280a8d0`）情境使用統計（dashboard 紫色卡）
- D5 收尾 + ADR-0006 + W10 規劃

**新公開頁能力**：
- /template-market/:id 多 AI 預覽 Card
- /admin dashboard 多情境統計 Card

**新 endpoint**：
- POST /api/admin/scenarios/:id/ai-preview
- GET /api/admin/scenarios/stats

**Smoke test**：26/26 全綠（4b ai-preview + 4c stats）

**ADR-0006 付費選型**：Stripe Checkout（一次性）+ Recur.tw（訂閱）雙軌

**W10 路徑**：D1 Stripe / D2 解鎖機制 / D3 Recur.tw 訂閱 / D4 配額追蹤 / D5 收尾發票退款

**完整收尾** → [changes/2026-05-02-phase3-w9-complete.md](changes/2026-05-02-phase3-w9-complete.md)
**ADR-0006** → [decisions/0006-payment-system.md](decisions/0006-payment-system.md)

⏭ 下一步：Phase 3 W10 D1 — Stripe Checkout 整合啟動

### 📊 Phase 3 W9 D4 ✅（情境使用統計）
**主題**：admin dashboard 加情境使用統計 Card（最近 30 天）
**範圍**：3 個檔案

關鍵變動：
- `server/routes/scenarios.ts` instantiate 加 `[scenario:<id>]` 標記
- 新 `GET /api/admin/scenarios/stats` endpoint（場域過濾 + 30 天 window）
- AdminDashboard 加紫色「情境使用統計」Card（top 8 + 進度條）
- 點任一行跳 /template-market/:id

**Smoke test 26/26**（加 4c GET stats 401 守衛）

**細節** → [changes/2026-05-02-phase3-w9-d4-scenario-stats.md](changes/2026-05-02-phase3-w9-d4-scenario-stats.md)

⏭ 下一步：W9 D5 — W9 收尾 + W10 付費機制規劃

### 📒 Phase 3 W9 D3 ✅（客戶 onboarding 文件包）
**主題**：業務帶看 → 收費 → 建場 → 現場一條龍工具就緒
**範圍**：3 個 runbook 新文件

關鍵變動：
- `runbooks/customer-onboarding.md` 完整 SOP（6 步驟、30-60 分鐘）
- `runbooks/customer-faq.md` 5 大類 25+ 常見問題答案模板
- `runbooks/event-day-cheatsheet.md` A4 列印小抄（業務帶現場用）

**文件協同**：onboarding（流程）+ FAQ（知識）+ cheatsheet（emergency）

業務工具完整化：找客戶不用再想動線、客戶問什麼可直接答、活動現場有應急小抄

**細節** → [changes/2026-05-02-phase3-w9-d3-customer-runbooks.md](changes/2026-05-02-phase3-w9-d3-customer-runbooks.md)

⏭ 下一步：W9 D4 — 依真實客戶反饋微調 AI prompt（業務工作）

### ✨ Phase 3 W9 D2 ✅（AI 預覽 UI + 套用建場）
**主題**：admin 完整工作流（輸入 context → AI 預覽 → 套用建場）
**範圍**：2 個檔案

關鍵變動：
- 後端 instantiate 接受 `aiConfigs`（key=pageType / value=config）
- 每個 component 用 `aiConfig ?? defaultConfig` fallback 邏輯
- TemplateMarketDetail 新增紫色「AI 客製化內容」Card
  - 500 字 textarea
  - 預覽按鈕 → AI 思考 + 元件 ✅/⚠ + JSON details
  - 「用 AI 內容建場」按鈕（紫色）
- 既有綠色「default 內容建場」Card 保留（雙軌並存）

**雙軌設計**：紫色 AI 推薦在上、綠色 default fallback 在下

**細節** → [changes/2026-05-02-phase3-w9-d2-ai-preview-ui.md](changes/2026-05-02-phase3-w9-d2-ai-preview-ui.md)

⏭ 下一步：W9 D3 — 找第一個付費客戶（業務工作）

### 🤖 Phase 3 W9 D1 ✅（AI 內容生成 MVP — DeepSeek 整合）
**主題**：admin 可輸入 context 讓 AI 為情境生成客製化 config
**範圍**：3 個檔案

關鍵變動：
- `server/lib/scenario-content-generator.ts` AI 內容生成器
- `server/routes/scenarios.ts` 新增 POST /api/admin/scenarios/:id/ai-preview
- smoke test 擴充至 25 個檢查（加 ai-preview 401 守衛）

**功能**：
- 接收 context（500 字內）
- 用 OpenRouter（DeepSeek V3.2）為每個元件生成客製 config
- 支援 13 種 pageType（10 host + 5 multi）
- 純 preview、不寫 DB、不影響 instantiate

**安全**：requireAdminAuth + game:create + 場域 API key 解密 + sk-or-* 驗證

**Smoke test**：預期 **25/25 全綠**（含新增 4b ai-preview）

**細節** → [changes/2026-05-02-phase3-w9-d1-ai-content-mvp.md](changes/2026-05-02-phase3-w9-d1-ai-content-mvp.md)

⏭ 下一步：W9 D2 — 前端 AI 預覽 UI + 套用按鈕

### 📋 Phase 3 規劃啟動 ✅（W8 D5 — ADR-0005 + W9-W12 路徑書）
**主題**：Phase 2 收尾、Phase 3 真實付費 + AI 內容 + 業務 API 規劃

關鍵變動：
- `docs/decisions/0005-phase3-direction.md` ADR-0005 方向決策
- `docs/changes/2026-05-02-phase3-plan.md` W9-W12 4 週路徑書

**W9-W12 路徑**：
- W9 PMF 驗證（第一場付費活動）+ DeepSeek AI 內容 MVP
- W10 付費機制（Stripe Checkout + Recur.tw 訂閱 + 用量配額）
- W11 業務 API（public REST + API key + 代理商 onboarding）
- W12 第 2-3 場活動 + Phase 3 收尾

**6 個選項評估**：A 真實活動 / B 付費機制 / C AI 內容 / D 業務 API / E 多語系 / F LINE 整合
**選定組合**：A + C → B → D → A 收尾（暫緩 E、F）

**目標**：Phase 3 結束時 ≥ 3 場真實付費 + 1 個月訂閱 + 1 個 API 代理商 + NT$30K-50K

**細節**：
- ADR-0005 → [decisions/0005-phase3-direction.md](decisions/0005-phase3-direction.md)
- W9-W12 路徑 → [changes/2026-05-02-phase3-plan.md](changes/2026-05-02-phase3-plan.md)

⏭ 下一步：W9 D1 — 找第一個付費客戶 + DeepSeek AI 內容生成

### 🎉 Phase 2 完整收尾 ✅（W5-W8 四週路徑全部完成）
**主題**：從元件展示進化到完整 SaaS 平台
**範圍**：4 週、19 commits、27 個新檔、~5,620 行、120+ 測試

**4 週時序**：
- W5 HostScreen 軸線 5/10 → 10/10（5 個新元件、33 測試）
- W6 情境模板平台基建（12 情境 + 一鍵建場 + QR 列印 + runbook）
- W7 業務化工具鏈（反向連結 + 引導 wizard + 銷售簡報）
- W8 自動化 + 整合 + 收尾（health endpoint + smoke test + AdminDashboard 工具入口）

**核心商業改造**：
- admin 流程：1 小時 → 10 分鐘 ⚡ 6× 加速
- 客戶旅程：不認識 → 30 分鐘現場可玩
- 5 大商業市場全覆蓋（公 / 私 / 活動 / 空間 / 交誼）
- 收費三方案：一次性 / 訂閱（推薦）/ 委辦

**E2E**：smoke test 24/24 全綠（自動化驗收）

**Phase 2 完整收尾** → [changes/2026-05-02-phase2-complete.md](changes/2026-05-02-phase2-complete.md)

⏭ 下一步：Phase 3 規劃啟動（第一場真實付費活動 / 業務 SDK / 多語系 / AI 生成內容）

### 🎛 Phase 2 W8 D3 ✅（AdminDashboard 平台工具快速入口）
**主題**：admin 後台首頁加 4 個 W6-W7 工具入口
**範圍**：1 個檔案（AdminDashboard）

關鍵變動：
- AdminDashboard 中段加「情境模板平台工具」Card（漸層 primary 5/10）
- 4 個入口（Grid 2x2 / 4x1 響應式）：
  - 🌟 情境模板市集 / 📺 主控場次 / 🧭 3 問找情境 / 🎤 客戶簡報頁
- 每個入口卡有 icon + title + 一句說明、hover 時邊框轉 primary

**Smoke test 24/24 全綠** ✅

**細節** → [changes/2026-05-02-phase2-w8-d3-admin-tools-card.md](changes/2026-05-02-phase2-w8-d3-admin-tools-card.md)

⏭ 下一步：W8 D4 — Phase 2 W4-W8 五週路徑彙整收尾文件

### 🖨 Phase 2 W8 D2 ✅（AdminHostSessions QR 列印整合）
**主題**：admin 後台直接列印 QR（單張 / 批次）
**範圍**：1 個檔案

關鍵變動：
- `AdminHostSessions.tsx` 新增 openPrintPage helper（複用 ScenarioQrPrint 列印頁）
- 頂部「列印全部 QR」批次按鈕
- 每張 session 卡新增單張「列印」按鈕（與「結束場次」並列）

**設計**：兩個入口（TemplateMarketDetail + AdminHostSessions）共用同一個列印頁，DRY

**細節** → [changes/2026-05-02-phase2-w8-d2-admin-print-qr.md](changes/2026-05-02-phase2-w8-d2-admin-print-qr.md)

⏭ 下一步：W8 D3 — admin 後台首頁整合情境市集連結

### 🩺 Phase 2 W8 D1 ✅（Scenario Health endpoint + Smoke Test 自動化）
**主題**：CI / 監控可自動驗證情境平台健康
**範圍**：3 個新檔

關鍵變動：
- `server/routes/scenario-health.ts` 新公開 endpoint `GET /api/scenarios/health`
- `server/routes/index.ts` registerScenarioHealthRoutes 註冊
- `scripts/smoke-test-scenarios.mjs` 24 個檢查的 smoke test 腳本

**Health endpoint 回應**：12 情境 metadata + byStatus + byCategory + totalComponents

**Smoke test 5 區塊**：
1. 6 個公開頁
2. 12 個情境詳情頁
3. Health endpoint JSON 結構
4. 3 個 POST instantiate 401 認證守衛
5. host/play SPA 路徑

**CI 整合**：`BASE_URL=https://game.homi.cc node scripts/smoke-test-scenarios.mjs`

**細節** → [changes/2026-05-02-phase2-w8-d1-smoke-test.md](changes/2026-05-02-phase2-w8-d1-smoke-test.md)

⏭ 下一步：W8 D2 — Admin scenario instances 列表頁

### 🎉 Phase 2 W7 完整收尾 + W5-W7 三週階段性回顧 ✅
**主題**：W7 業務化工具鏈完成 + 三週路徑成果回顧
**範圍**：W7 5 天（6 個檔、~920 行）+ 三週累計（22 檔、~4,920 行、18 commits、120+ 測試）

**W7 5 天時序**：
- W7 D1（`95465776`）第 12 情境補位（kids-adventure）+ 主頁業務入口
- W7 D2（`2d290f48`）ShowcaseHub 元件 → 情境反向連結 + DemoCard DRY
- W7 D3（`f779cba7`）Onboarding Wizard 3 問找情境 + score-based Top 3
- W7 D4（`0ecdd52d`）PitchDeck 7 區段銷售簡報 + 收費三方案 + 對比表
- W7 D5 收尾文件 + 三週回顧

**完整客戶轉換動線達成**：
- 業務帶看 `/pitch` → 客戶 `/find-scenario` 3 問 → Top 3 `/template-market/:id` →
  admin 一鍵建場 → A4 QR 列印 → 現場掃碼即玩
- 第一次接觸到第一場活動上線 < 30 分鐘 ⚡

**E2E 9 端點全綠**：/ /pitch /find-scenario /template-market /showcase
+ 12 情境詳情頁 + /admin/scenario-qr-print + /host /play /admin/host-sessions

**收費三方案**：一次性 NT$3K-30K / 訂閱 NT$1.5K-5K（推薦）/ 委辦 NT$80K-200K

**細節** → [W7 完整收尾](changes/2026-05-02-phase2-w7-complete.md)
**三週回顧** → [Phase 2 W5-W7 階段性回顧](changes/2026-05-02-phase2-w5w6w7-recap.md)

⏭ 下一步：Phase 2 W8 — 第一場真實付費活動 + Phase 2 整體收尾

### 🎤 Phase 2 W7 D4 ✅（客戶銷售簡報頁 PitchDeck）
**主題**：業務拿手機 / 平板開會即可講解的一頁式簡報
**範圍**：3 個檔案

關鍵變動：
- `PitchDeck.tsx` 新公開頁 `/pitch`（7 個區段 scroll narrative）
- App.tsx 路由註冊
- FieldEntry 底部加「看完整簡報」入口

**7 區段**：痛點 → 解法 → 12 情境 → 流程 → 收費 → 對比表 → CTA

**收費三方案**：
- 一次性 NT$ 3,000-30,000 / 場
- 訂閱 NT$ 1,500-5,000 / 月（推薦）
- 委辦 NT$ 80,000-200,000 / 季

**對比表**：自己手作 vs 客製外包 vs CHITO（6 維度）

**E2E**：/pitch 200 + JS bundle 引用整合

**細節** → [changes/2026-05-02-phase2-w7-d4-pitch-deck.md](changes/2026-05-02-phase2-w7-d4-pitch-deck.md)

⏭ 下一步：W7 D5 — W7 完整收尾 + 客戶 onboarding walkthrough

### 🧭 Phase 2 W7 D3 ✅（Onboarding Wizard 3 問找情境）
**主題**：客戶不知道選什麼情境時的引導工具
**範圍**：3 個檔案

關鍵變動：
- `FindScenarioWizard.tsx` 新公開頁 `/find-scenario`
- 3 題（分類 / 人數 / 重點）→ score-based 推薦 Top 3
- TemplateMarket Hero 新增「3 問找情境」CTA
- FieldEntry 主頁雙 CTA 改為「12 模板 + 3 問找情境」

**演算法**：分類匹配 +5、人數匹配 +3、重點關鍵字命中 +2、live 狀態 +0.5

**E2E**：/find-scenario 200 + 推薦 Dialog 含 score + reasons 列表

**細節** → [changes/2026-05-02-phase2-w7-d3-onboarding-wizard.md](changes/2026-05-02-phase2-w7-d3-onboarding-wizard.md)

⏭ 下一步：W7 D4 — 客戶簡報模板（PDF / 影片）

### 🔄 Phase 2 W7 D2 ✅（ShowcaseHub 元件 → 情境反向連結）
**主題**：客戶試玩元件時直接看到「這個能用在什麼場合」
**範圍**：3 個檔案

關鍵變動：
- `shared/scenario-templates.ts` 新增 `getScenariosForPageType()` 反向索引 helper
- `shared/__tests__/scenario-templates.test.ts` +4 測試（20/20 通過）
- `client/src/pages/ShowcaseHub.tsx` 抽 DemoCard 元件、15 張 demo 卡片全部含「適用情境」連結

**範例反向連結**：
- emoji_react → 婚禮 / 生日 / 親子
- polaroid_collage → 婚禮 / 生日 / 同學會
- trivia_showdown → 同學會 / 園遊會 / 頒獎
- treasure_hunt → 親子 / 商圈 / 場域

**細節** → [changes/2026-05-02-phase2-w7-d2-showcase-bidirectional.md](changes/2026-05-02-phase2-w7-d2-showcase-bidirectional.md)

⏭ 下一步：W7 D3 — 客戶 onboarding 引導 wizard

### 🚀 Phase 2 W7 D1 ✅（業務化首發 — 第 12 情境 + 主頁業務入口）
**主題**：12 情境清單補位 + 主辦方主頁入口
**範圍**：4 個檔案

關鍵變動：
- `shared/scenario-templates.ts` 新增 `kids-adventure` 親子冒險（social/混合 multi+host）
- `shared/__tests__/scenario-templates.test.ts` 16/16 通過
- `client/src/pages/FieldEntry.tsx` 主頁新增「主辦活動的人？」入口區塊（漸層 primary/5）
- 雙 CTA：瀏覽 12 情境模板 / 先看單一元件試玩

**12 情境全部 live**（包含 4 個 social / 3 個 event / 2 個 public / 2 個 corporate / 1 個 venue）

**E2E 全綠**：12 情境詳情頁 + 主頁業務入口

**細節** → [changes/2026-05-02-phase2-w7-d1-12th-scenario.md](changes/2026-05-02-phase2-w7-d1-12th-scenario.md)

⏭ 下一步：W7 D2 — ShowcaseHub 改版深化 demo 互連

### 🎉 Phase 2 W6 完整收尾 ✅（情境模板平台基建上線）
**主題**：從元件展示進化到「情境組合銷售 + 一鍵建場 + 現場 QR 列印」
**範圍**：W6 5 天連續推進、6 個新檔、~1,600 行程式碼、11 情境全部可用
**部署**：`d27caffb..fcbfca58`

**5 天歷程**：
- W6 D1（`01f0ffbf`）TemplateMarket 12 情境 + 公開頁 + 詳情頁 + 15 測試
- W6 D2（`cba7b5b3`）Pure-host 一鍵建場（後端 endpoint + Dialog UX）
- W6 D3（`af919703`）混合情境（multi/solo）支援 + axis-aware UI
- W6 D4（`fcbfca58`）QR 列印頁（A4 自動分頁、漸層底色）
- W6 D5 收尾文件 + admin runbook

**商業流程改造**：admin 從 1 小時手動建場 → 10 分鐘一鍵搞定 ⚡ 6× 加速

**E2E 全綠**：`/template-market` `/template-market/wedding` `/admin/scenario-qr-print`
+ POST /api/admin/scenarios/:id/instantiate 認證守衛正確

**Runbook**：[runbooks/scenario-launch.md](runbooks/scenario-launch.md)

**細節** → [changes/2026-05-02-phase2-w6-complete.md](changes/2026-05-02-phase2-w6-complete.md)

⏭ 下一步：Phase 2 W7 — 業務化 + 客戶 onboarding 簡化 + 第 12 情境補位

### 📄 Phase 2 W6 D4 ✅（Scenario QR 列印頁）
**主題**：admin 一鍵生成所有元件 QR codes 列印（A4，每張 QR 一頁）
**範圍**：1 天、新增 1 個 client 頁面

關鍵變動：
- `ScenarioQrPrint.tsx` 新頁（路徑 `/admin/scenario-qr-print?data=<base64>`）
- TemplateMarketDetail 結果 Dialog 新增「列印 QR」按鈕
- 用 client side `qrcode` 套件即時產生 base64 data URL
- @media print CSS 自動分頁（每張 QR 一頁）

**功能**：
- host 元件 → 兩張 QR（大螢幕 + 玩家）
- multi/solo → 一張 QR（玩家入口）
- 漸層底色依 axis 區分（藍/紫/綠/灰）
- 顯示元件名稱 + URL 類型 + 完整 URL + pageType

**E2E 8 端點全綠**（含新增 /admin/scenario-qr-print）

**細節** → [changes/2026-05-02-phase2-w6-d4-qr-print.md](changes/2026-05-02-phase2-w6-d4-qr-print.md)

⏭ 下一步：W6 D5 — W6 收尾文件 + 完整流程 walkthrough

### 🔀 Phase 2 W6 D3 ✅（混合情境一鍵建場）
**主題**：移除 pure-host 限制、所有 11 個情境都可一鍵建場
**範圍**：1 天、後端 endpoint 擴充 + 前端 axis-aware UI

關鍵變動：
- scenarios.ts ScenarioInstance 介面 axis-aware（host vs multi/solo/shared）
- getDefaultConfigForPageType 擴充支援 13 個 multi 元件 + shared
- getGameModeForComponent 依 axis 推導 gameMode（multi → team）
- 回應加 breakdown { host, multi, other }
- TemplateMarketDetail 移除 isPureHost 守衛
- InstanceRow axis-aware 顯示對應 URL
- UrlRow 元件抽取（DRY）

**11 情境全部可一鍵建場**：婚禮 / 生日 / 同學會 / 街區走讀 / 商圈打卡 / 園遊會 / 破冰 / 頒獎 / 企業內訓 / 員工旅遊 / 場域故事

**細節** → [changes/2026-05-02-phase2-w6-d3-mixed-scenarios.md](changes/2026-05-02-phase2-w6-d3-mixed-scenarios.md)

⏭ 下一步：W6 D4 — QR code 生成 + 列印頁

### ⚡ Phase 2 W6 D2 ✅（Scenario Instantiate 一鍵建場）
**主題**：admin 從情境詳情頁一鍵建好所有大螢幕場次
**範圍**：1 天、3 個檔案、後端 endpoint + 前端完整 UX

關鍵變動：
- `server/routes/scenarios.ts` — POST /api/admin/scenarios/:id/instantiate
- `server/routes/index.ts` — registerScenarioRoutes 註冊
- `client/src/pages/TemplateMarketDetail.tsx` — Admin 一鍵建場卡片 + 結果 Dialog

**邏輯**：
- pure-host 情境（所有 components.axis === "host"）支援
- 為每個 host 元件建立：game + page（合理預設 config）+ host_session（12h token）
- 結果 Dialog 顯示所有場次的 hostUrl + playUrl + Copy 按鈕

**安全**：requireAdminAuth + game:create + 場域隔離

**E2E 6 端點全綠** + 新 endpoint POST 正確回傳 401（無認證）

**細節** → [changes/2026-05-02-phase2-w6-d2-scenario-instantiate.md](changes/2026-05-02-phase2-w6-d2-scenario-instantiate.md)

⏭ 下一步：W6 D3 — 含 multi 元件的情境一鍵建場

### 🎯 Phase 2 W6 D1 ✅（TemplateMarket 12 情境模板首發）
**主題**：跨軸線情境模板市集（情境包 = 銷售武器）
**範圍**：1 天、3 個新檔、15 個單元測試、2 個新公開頁路由

關鍵變動：
- `shared/scenario-templates.ts` — 12 個情境（11 live/preview + 1 保留）
- `client/src/pages/TemplateMarket.tsx` — 情境市集列表頁（5 大分類）
- `client/src/pages/TemplateMarketDetail.tsx` — 單一情境詳情頁
- App.tsx 路由：`/template-market` + `/template-market/:scenarioId`
- ShowcaseHub 新增 TemplateMarket 入口

**12 情境**：
- 交誼類：婚禮 / 生日 / 同學會（live）
- 活動類：園遊會 / 破冰 / 頒獎（live × 2 + preview）
- 公部門：街區走讀 / 商圈打卡（live + preview）
- 私部門：企業內訓 / 員工旅遊（live + preview）
- 空間類：場域故事（live）

**E2E 6 端點全綠**：showcase + template-market + template-market/wedding + host + play + admin/host-sessions

**細節** → [changes/2026-05-02-phase2-w6-d1-template-market.md](changes/2026-05-02-phase2-w6-d1-template-market.md)

⏭ 下一步：W6 D2 — 自動化建場（一鍵套用婚禮模板）

### 🎮 Phase 2 Week 5 完成 ✅（HostScreen 軸線 10/10 收尾）
**主題**：5 個新元件補齊 HostScreen 軸線（紀念類 + 競賽類 + 場域類）
**範圍**：5 天連續推進、5 個元件、33 個新測試
**狀態**：🟢 W5 完成、HostScreen 軸線 100%、E2E 5 端點全綠

關鍵 commit：
- W5 D1: PolaroidCollage (M) — 拍立得紀念牆（婚禮王牌） 6/6 測試
- W5 D2: GuestbookDigital (S) — 數位簽名簿（婚禮 / 退休） 6/6 測試
- W5 D3: TriviaShowdown (M) — 搶答秀（園遊會主舞台） 6/6 測試
- `7554be00` W5 D4: ScoreboardAnnouncement (S) — 跑馬燈宣告（賽事播報）6/6 測試
- W5 D5: KnowledgeMap (M) — 場域全景地圖（街區商圈打卡） 9/9 測試 + ShowcaseHub demo 擴充

**HostScreen 軸線 10/10**：PollLive / EmojiReact / WaveResponse / CrowdGather / LiveLeaderboard
+ PolaroidCollage / GuestbookDigital / TriviaShowdown / ScoreboardAnnouncement / KnowledgeMap

**ShowcaseHub** [showcase](https://game.homi.cc/showcase)：
- 25 個 demo 入口（10 host × 雙版型 + 5 multi）
- 5 大商業情境完整覆蓋（婚禮 / 主舞台 / 街區 / 內訓 / 課堂）

**細節** → [changes/2026-05-02-phase2-w5-host-axis-complete.md](changes/2026-05-02-phase2-w5-host-axis-complete.md)

⏭ 下一步：Phase 2 Week 6 — TemplateMarket 12 情境模板（婚禮 / 園遊會 / 街區 / 內訓四大首發）

### 🎉 Phase 1 全套完成（4 週路徑）

```
Phase 1（4 週、~30 個 commit、~80 個單元測試）
├ W1: ADR-0004 + HostScreen 骨架 + ShowcaseHub MVP + scaffold
├ W2: PollLive 完整商業鏈路 + Admin UI
├ W3: 4 個 host 元件（EmojiReact/WaveResponse/CrowdGather/LiveLeaderboard）
├ W4: 5 個 multi 元件（JigsawPuzzle/TreasureHunt/GpsCascade/CollectiveScore/RoleAssign）
└ 完整部署、healthy、E2E 5 端點全綠
```

**累計能力**：
- HostScreen 軸線 5/8 元件 + Multi 軸線 13/13 元件
- Admin 後台 host-session 管理
- ShowcaseHub 15 個公開 demo 入口
- 完整鏈路：admin 建 session → 大螢幕 → 玩家投票 → 即時更新

⏭ 下一步：Phase 2（W5-W8）— 紀念類 + 接力類 + 12 情境模板（首批客戶變現）

### 🛡 Squad 系統一次到位（取代三套組隊系統）
**主題**：合併 teams / battle_clans / 過渡 squads 為單一 Squad 系統
**範圍**：8 個 commit（PR0 + PR1-PR6）
**結果**：使用者只看到「Squad 隊伍」一套概念
**細節** → [changes/2026-05-02-squad-unification.md](changes/2026-05-02-squad-unification.md)

關鍵 commit：
- `19c293aa` PR0: QR 掃描依 game mode 導正流程
- `0da1f3c0` PR1: Squad 建立頁 + 我的隊伍頁
- `22c83d8e` PR2: 戰鬥檔案 / 擂台改用 Squad
- `23e679a9` PR3a: 401 token 自動 refresh
- `921c0d2d` PR3b: 水彈報名 squad-aware
- `ff611899` PR4: teams ↔ squads bridge
- `e9bdff39` PR5: 戰績寫 squad_match_records
- `d6134d6b` PR6: battle_clans 凍結寫入（最終）

ADR：[decisions/0003-squad-unification.md](decisions/0003-squad-unification.md)

---

## 2026-05-01 ~ 2026-05-02

### 📱 PWA 使用流程優化（4 Phase A-D）
**主題**：PWA 進入動線、安裝提示、使用統計
**範圍**：8 個 commit
**細節** → [changes/2026-05-01-pwa-flow.md](changes/2026-05-01-pwa-flow.md)

關鍵 commit：
- `a42db548` Phase A: FloatingHomeButton 全域救援動線
- `d49af32a` Phase B: manifest start_url + lastVisitedField 智能路由
- `58729052` Phase C: PWA 內 QR Scan FAB（不離開 App）
- `cd202129` Phase D: PWA 使用情境統計分析
- `0f2e35fc` 後台 PWA 使用情境分析頁
- `1ed14f4a` 介面避讓 + 安裝提示防擾人優化

### 🔧 QR Code 修復
- `061843f4` 移除 Replit localhost 殘留，QR 永遠用正確 BASE_URL
- `19c293aa` QR 掃描進入依 game mode 導正流程

### 🎮 多人遊戲修復
- `9f584041` 多人遊戲完成後正確顯示「再玩一次」（getSessionsByUser effective status）

---

## 2026-04-19 ~ 2026-04-30

### 🎮 16 個遊戲元件全面優化
**範圍**：8 個 PR
**細節** → [changes/2026-04-19-game-components-audit.md](changes/2026-04-19-game-components-audit.md)（待補）

### 🌐 多場域隔離完整稽核
**細節** → [changes/2026-04-30-multi-field-isolation.md](changes/2026-04-30-multi-field-isolation.md)（待補）

---

## 歷史紀錄

> 2026-04-19 之前的詳細紀錄整理中，原 PROGRESS.md 的內容會逐步搬入 [changes/](changes/)。
> 完整歷史 commit：`git log --all --oneline`

---

## 維護規則

1. **每次部署**：在頂端加新區段（按日期降序）
2. **單版本上限**：50 行 — 超過拆到 `changes/{date}-{topic}.md`
3. **超過 6 個月**：搬到 `archive/CHANGELOG-{year}.md`
4. **格式統一**：日期、主題、範圍、commit hash、細節連結
