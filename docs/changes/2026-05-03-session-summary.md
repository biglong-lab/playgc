# 📋 2026-05-03 完整 Session 工作總覽（逐步確認用）

> 涵蓋：Phase 4 W15 D4 → Phase 5 W18 D5
> 共 **16 個工作日 / 16 commits / 約 13,000 行程式碼**
> 全部已部署到 game.homi.cc、smoke test 51/51 全綠

---

## 🌐 立即可體驗的功能（公開頁）

逐一打開確認：

| # | 連結 | 用途 | 何時加入 |
|---|------|------|----------|
| 1 | [/](https://game.homi.cc/) | 首頁 | 既有 |
| 2 | [/pitch](https://game.homi.cc/pitch) | 業務銷售簡報 | 既有 + W17 D2/D3 加 CTA |
| 3 | [/find-scenario](https://game.homi.cc/find-scenario) | 三問配對情境 | 既有 |
| 4 | [/template-market](https://game.homi.cc/template-market) | 12 情境模板市集 | 既有 |
| 5 | [/showcase](https://game.homi.cc/showcase) | 元件展示館 | 既有 |
| 6 | [/pricing](https://game.homi.cc/pricing) | 價格頁（三方案）| 既有 |
| 7 | [/api-docs](https://game.homi.cc/api-docs) | Public API 文件 | 既有 |
| 8 | **[/faq](https://game.homi.cc/faq)** ⭐ | **常見問題（14 題 7 類）** | **W17 D2 新加** |
| 9 | **[/roi](https://game.homi.cc/roi)** ⭐ | **ROI 試算機** | **W17 D3 新加** |
| 10 | [/admin/scenario-qr-print](https://game.homi.cc/admin/scenario-qr-print) | A4 QR 列印頁 | 既有 |

---

## 🚀 完整工作明細（依時序）

### 📅 Phase 4 W15 D4-D5（LINE Bot 完整鏈路收尾）

#### W15 D4：活動結束 webhook 鉤子
- **commit**：`af1a49d7`
- **新功能**：admin 結束 host session → 自動派 `instance.expired` webhook
- **變動**：
  - [server/routes/host-sessions.ts](server/routes/host-sessions.ts) `/end` 端點加 dispatchWebhook
  - 偵測 `[via:api/v1]` 標記、未來支援代理商收 webhook
  - HMAC SHA-256 簽章 + 3 retry（fire-and-forget 不 block 主流程）
- **環境變數**：`API_KEY_DEFAULT_FOR_WEBHOOKS`
- **文件**：[2026-05-03-phase4-w15-d4-session-end-webhook.md](docs/changes/2026-05-03-phase4-w15-d4-session-end-webhook.md)

#### W15 D5：admin 認證 + LINE 真實建場
- **commit**：`5d5486fd`
- **新功能**：admin 在 LINE 用「@chito 婚禮 ...」即可真建場（30 秒收到網址）
- **新檔**：
  - [server/lib/admin-line-auth.ts](server/lib/admin-line-auth.ts) — LINE userId admin 白名單（環境變數）
  - [server/lib/scenario-instantiator-line.ts](server/lib/scenario-instantiator-line.ts) — LINE 簡化建場
- **環境變數**：`LINE_ADMIN_USER_IDS` / `LINE_ADMIN_FIELD_<short>`
- **smoke test**：44 → 45（health admin status）
- **文件**：[2026-05-03-phase4-w15-d5-admin-instantiate.md](docs/changes/2026-05-03-phase4-w15-d5-admin-instantiate.md)
- **ADR**：[0011 W16 規劃](docs/decisions/0011-w16-planning.md)

---

### 📅 Phase 4 W16 D1-D5（LINE 進階互動）

#### W16 D1：instantiator-line 擴充多元件
- **commit**：`d105b92b`
- **新功能**：LINE admin 建場從「只第 1 個 host 元件」→「全 axis 全元件」
- **變動**：
  - [server/routes/scenarios.ts](server/routes/scenarios.ts) — 兩個 helper 改 export
  - [server/lib/scenario-instantiator-line.ts](server/lib/scenario-instantiator-line.ts) — 重寫支援 host + multi + solo + shared
  - [server/routes/line-webhook.ts](server/routes/line-webhook.ts) — `formatInstantiateReply` 多元件範本
- **場景覆蓋率**：60% → **100%**
- **文件**：[2026-05-03-phase4-w16-d1-multi-component-instantiate.md](docs/changes/2026-05-03-phase4-w16-d1-multi-component-instantiate.md)

#### W16 D2：LINE Quick Reply + Sticker
- **commit**：`7790bede`
- **新功能**：建場成功 sticker 慶祝 + admin 6 個快捷按鈕
- **變動**：
  - [server/lib/line-bot.ts](server/lib/line-bot.ts) — 加 `LineQuickReply` / `LineQuickReplyItem` 型別
  - [server/routes/line-webhook.ts](server/routes/line-webhook.ts) — `adminQuickReply()` + `celebrationSticker()` 工廠
- **效果**：admin 點按鈕 1 秒 vs 打字 5 秒 ⚡ 5×
- **文件**：[2026-05-03-phase4-w16-d2-line-quick-reply.md](docs/changes/2026-05-03-phase4-w16-d2-line-quick-reply.md)

#### W16 D3：LINE Admin 直接管理活動
- **commit**：`34e5dd4a`
- **新功能**：admin 在 LINE 看 / 結束 active sessions（不必開電腦）
- **新檔**：
  - [server/lib/admin-line-actions.ts](server/lib/admin-line-actions.ts) — list/end actions
- **新指令**：
  - `@chito 我的活動` → list_active intent → 看 active sessions 列表
  - `@chito 結束 <id>` → end_session intent → 真實結束（支援前 8 字元）
- **文件**：[2026-05-03-phase4-w16-d3-line-admin-actions.md](docs/changes/2026-05-03-phase4-w16-d3-line-admin-actions.md)

#### W16 D4：活動即將過期 LINE reminder
- **commit**：`363d4e30`
- **新功能**：活動過期前 1 小時自動推 LINE 給 admin
- **新檔**：
  - [server/lib/expiring-session-checker.ts](server/lib/expiring-session-checker.ts) — checker 邏輯
  - [server/routes/cron-endpoints.ts](server/routes/cron-endpoints.ts) — HTTP endpoint
- **新端點**：
  - `GET /api/cron/health` — 公開 health
  - `POST /api/cron/check-expiring-sessions` — CRON_SECRET Bearer 認證觸發
- **環境變數**：`CRON_SECRET` / `APP_BASE_URL`
- **部署側 cron**：`0 * * * * curl ... -H "Authorization: Bearer $CRON_SECRET"`
- **smoke test**：45 → 48（cron health + 兩個 401 驗證）
- **文件**：[2026-05-03-phase4-w16-d4-expiring-reminder.md](docs/changes/2026-05-03-phase4-w16-d4-expiring-reminder.md)

#### W16 D5：Phase 4 完整收尾 + Phase 5 規劃
- **commit**：`7abe8bb7`
- **新文件**：
  - [Phase 4 完整 retro](docs/changes/2026-05-03-phase4-complete.md) — W13-W16 整體統計
  - [ADR-0012 Phase 5 方向](docs/decisions/0012-phase5-direction.md) — W17-W21 五週規劃

---

### 📅 Phase 5 W17 D1-D5（業務週工程備援）

#### W17 D1：業務跑團 SOP（純 docs）
- **commit**：`9eca1081`
- **新文件**：
  - [docs/runbooks/customer-pilot.md](docs/runbooks/customer-pilot.md) — 10 步驟跑團 SOP
  - [docs/runbooks/pilot-feedback-template.md](docs/runbooks/pilot-feedback-template.md) — 5 錨點反饋表
- **業務 KPI**：W17 接觸 ≥ 5 客戶 / 成交 ≥ 1 場 / 反饋 ≥ 1 份

#### W17 D2：公開 FAQ 頁
- **commit**：`ac2d4d4d`
- **新功能**：客戶 self-service 看常見問題
- **新檔**：
  - [client/src/pages/Faq.tsx](client/src/pages/Faq.tsx) — 14 題分 7 類
- **路由**：[/faq](https://game.homi.cc/faq)
- **smoke test**：48 → 49
- **文件**：[2026-05-03-phase5-w17-d2-faq-page.md](docs/changes/2026-05-03-phase5-w17-d2-faq-page.md)

#### W17 D3：ROI 計算機公開頁
- **commit**：`2d314eea`
- **新功能**：客戶填 3 參數即時試算 ROI
- **新檔**：
  - [client/src/pages/RoiCalculator.tsx](client/src/pages/RoiCalculator.tsx)
- **路由**：[/roi](https://game.homi.cc/roi)
- **試算依據**：時薪 NT$ 500 / 業界互動率 30→75% / 來賓單值 NT$ 80-200
- **smoke test**：49 → 50
- **文件**：[2026-05-03-phase5-w17-d3-roi-calculator.md](docs/changes/2026-05-03-phase5-w17-d3-roi-calculator.md)

#### W17 D4：Admin Pilot 健康度雛形 endpoint
- **commit**：`9d7693f7`
- **新功能**：admin 用 endpoint 看平台運作數據（W20 雛形）
- **新檔**：
  - [server/routes/admin-pilot-health.ts](server/routes/admin-pilot-health.ts)
- **新端點**：`GET /api/admin/pilot/health`（admin 認證）
- **回傳結構**：activity / coverage / serviceStatus 三大區塊
- **smoke test**：50 → 51
- **文件**：[2026-05-03-phase5-w17-d4-pilot-health.md](docs/changes/2026-05-03-phase5-w17-d4-pilot-health.md)

#### W17 D5：W17 retro + W18 規劃
- **commit**：`c2903e55`
- **新文件**：
  - [W17 業務週 retro](docs/changes/2026-05-03-phase5-w17-complete.md)
  - [ADR-0013 W18 元件擴充規劃](docs/decisions/0013-w18-component-expansion.md)

---

### 📅 Phase 5 W18 D1-D5（元件擴充週）

5 個新元件，依 ADR-0013：

#### W18 D1：host_lottery_wheel — 轉盤抽獎
- **commit**：`239dfc0e`
- **新檔**：
  - [LotteryWheel.tsx](client/src/components/game/host/LotteryWheel.tsx) + [LotteryWheelPage.tsx](client/src/components/game/host/LotteryWheelPage.tsx)
  - [LotteryWheel.test.tsx](client/src/components/game/host/__tests__/LotteryWheel.test.tsx) — 9 測試
- **特色**：CSS clip-path 切片 + 5 圈 ease-out 旋轉 + 玩家報名 + 中獎 banner
- **新覆蓋情境**：婚禮抽伴娘 / 生日禮物 / 福委會 / 派對 / 尾牙（+6）
- **文件**：[2026-05-03-phase5-w18-d1-lottery-wheel.md](docs/changes/2026-05-03-phase5-w18-d1-lottery-wheel.md)

#### W18 D2：host_progress_quest — 全場進度條
- **commit**：`600b499c`
- **新檔**：
  - [ProgressQuest.tsx](client/src/components/game/host/ProgressQuest.tsx) + [ProgressQuestPage.tsx](client/src/components/game/host/ProgressQuestPage.tsx)
  - [ProgressQuest.test.tsx](client/src/components/game/host/__tests__/ProgressQuest.test.tsx) — 9 測試
- **特色**：emerald→cyan 漸層進度條 + 25/50/75/100% 慶祝動畫 + top 5 貢獻榜
- **新覆蓋情境**：街區 / 商圈 / 內訓 KPI / 員工旅遊（+6）
- **文件**：[2026-05-03-phase5-w18-d2-progress-quest.md](docs/changes/2026-05-03-phase5-w18-d2-progress-quest.md)

#### W18 D3：host_word_cloud — 即時字雲
- **commit**：`68260485`
- **新檔**：
  - [WordCloud.tsx](client/src/components/game/host/WordCloud.tsx) + [WordCloudPage.tsx](client/src/components/game/host/WordCloudPage.tsx)
  - [WordCloud.test.tsx](client/src/components/game/host/__tests__/WordCloud.test.tsx) — 9 測試
- **特色**：紫色漸層字雲 + 詞頻 → 字體大小 + 6 色循環 + 新詞 2.5s 進場動畫
- **新覆蓋情境**：婚禮新人特質 / 同學會記憶詞 / 內訓回饋 / 派對暖身（+5）
- **文件**：[2026-05-03-phase5-w18-d3-word-cloud.md](docs/changes/2026-05-03-phase5-w18-d3-word-cloud.md)

#### W18 D4：quest_chain — 任務鏈
- **commit**：`1c175283`
- **新檔**：
  - [QuestChain.tsx](client/src/components/game/multi/QuestChain.tsx) + [QuestChainPage.tsx](client/src/components/game/multi/QuestChainPage.tsx)
  - [QuestChain.test.tsx](client/src/components/game/multi/__tests__/QuestChain.test.tsx) — 11 測試
- **特色**：依序解鎖（已完成 ✅ / 當前 🔢 / 鎖住 🔒）+ 答錯 N 次顯示 hint + 金牌獎勵 banner
- **新覆蓋情境**：街區走讀 / 商圈打卡 / 內訓 / 員工旅遊 / 解謎（+5）
- **文件**：[2026-05-03-phase5-w18-d4-quest-chain.md](docs/changes/2026-05-03-phase5-w18-d4-quest-chain.md)

#### W18 D5：memory_match — 配對記憶遊戲
- **commit**：`4cce4b41`
- **新檔**：
  - [MemoryMatchPage.tsx](client/src/components/game/solo/MemoryMatchPage.tsx)
  - [MemoryMatch.test.tsx](client/src/components/game/solo/__tests__/MemoryMatch.test.tsx) — 10 測試
- **特色**：4×4 / 6×6 翻牌 + N 秒 preview + 計時計步 + localStorage 最佳成績
- **新覆蓋情境**：等待過場 / 個人挑戰 / 親子互動 / 解謎熱身（+4）
- **文件**：[2026-05-03-phase5-w18-d5-memory-match.md](docs/changes/2026-05-03-phase5-w18-d5-memory-match.md)
- **W18 完整收尾文件**：[2026-05-03-phase5-w18-complete.md](docs/changes/2026-05-03-phase5-w18-complete.md)

---

## 📊 整體統計

| 區塊 | 工作日 | Commits | 程式碼 | 測試 |
|------|--------|---------|--------|------|
| Phase 4 W15 D4-D5 | 2 | 2 | ~ 700 行 | smoke 44→45 |
| Phase 4 W16 D1-D5 | 5 | 5 | ~ 2,800 行 | smoke 45→48 |
| Phase 5 W17 D1-D5 | 5 | 5 | ~ 1,500 行 | smoke 48→51 |
| Phase 5 W18 D1-D5 | 5 | 5 | ~ 3,300 行 | 49 單元測試 |
| **總計** | **17** | **17** | **~ 8,300 行** | **smoke 51/51 全綠** |

---

## 🔑 環境變數整理（admin 部署設定）

依 `host:172.233.89.147` 上 `/www/wwwroot/game.homi.cc` 的 `.env`：

```bash
# === LINE Bot 完整鏈路（W14-W16）===
LINE_CHANNEL_SECRET=xxx
LINE_CHANNEL_ACCESS_TOKEN=xxx
OPENROUTER_API_KEY=sk-or-xxx           # AI NLU
LINE_ADMIN_USER_IDS=Uabc...,Uxyz...    # admin LINE userId 白名單
LINE_ADMIN_FIELD_Uabc123def=<fieldId>  # 可選

# === Webhook + Cron（W15-W16）===
API_KEY_DEFAULT_FOR_WEBHOOKS=ck_live_xxx  # 場域 default API key（可選）
CRON_SECRET=<random-32-char>              # cron endpoint 認證
APP_BASE_URL=https://game.homi.cc         # 訊息 URL 帶 domain

# === 既有（W9-W12）===
RECUR_TW_API_KEY=xxx / RECUR_TW_WEBHOOK_SECRET=xxx
STRIPE_SECRET_KEY=xxx
RESEND_API_KEY=xxx / EMAIL_FROM=xxx
API_KEYS=xxx / API_KEY_FIELD_<keyIdShort>=<fieldId>
SCENARIO_QUOTA_DEFAULT=10
```

**部署側 crontab（每小時跑）**：
```bash
0 * * * * curl -X POST https://game.homi.cc/api/cron/check-expiring-sessions \
          -H "Authorization: Bearer $CRON_SECRET" -s
```

---

## 🎯 admin 完整工具鏈

### LINE 端（手機）— W14-W16 累積
- `@chito 婚禮 Hung & Anita 5/15` — 真建場（30 秒收 hostUrl + playUrl）
- `@chito 我的活動` — 看 active sessions 列表
- `@chito 結束 abc12345` — 結束指定 session（前 8 字元）
- `@chito help` / `@chito list` — 用法 / 情境清單
- 系統自動推：活動過期前 1 小時 reminder
- 客戶端 webhook：instance.expired 自動派發

### 後台端（電腦）— 既有
- 模板市集 → 一鍵建場
- A4 QR 列印
- AI 內容生成（DeepSeek）
- 場域管理 / 用量 / 統計

### 業務端（W17 累積）
- /pitch 簡報 / /find-scenario 配對 / /faq 客戶答疑 / /roi 客戶試算
- /api-docs 代理商整合
- pilot SOP（10 步驟）+ 反饋表（5 錨點）
- /api/admin/pilot/health 平台健康度

### 玩家端（W14 + W18 累積）
- LINE LIFF 自動帶名字
- 既有元件 30+
- W18 加 5 個（轉盤 / 進度 / 字雲 / 任務鏈 / 配對）

---

## ⏭ Phase 5 剩餘規劃（依 ADR-0012）

- **W19**：情境模板擴充（12 → 20+）— 不需新元件、純配置
- **W20**：完整觀測儀表板（W17 D4 endpoint 包成 UI）
- **W21**：緩衝 + Phase 6 規劃

是否繼續、由你決定。

---

## 🔗 完整 ADR 索引

- [ADR-0010 LINE Bot 整合](docs/decisions/0010-line-bot-integration.md)
- [ADR-0011 W16 規劃](docs/decisions/0011-w16-planning.md)
- [ADR-0012 Phase 5 方向](docs/decisions/0012-phase5-direction.md)
- [ADR-0013 W18 元件擴充](docs/decisions/0013-w18-component-expansion.md)

---

**生產部署**：[https://game.homi.cc](https://game.homi.cc)
**最後 commit**：`4cce4b41` (W18 D5 + 完整收尾)
**Smoke test 狀態**：51/51 全綠 ✅
