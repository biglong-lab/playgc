# CHANGELOG

> 版本紀錄總表 — 每版 ≤ 50 行，細節連結到 [`changes/`](changes/)
> 格式：`feat:` 新功能 / `fix:` 修復 / `refactor:` 重構 / `docs:` 文件 / `chore:` 雜項

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
