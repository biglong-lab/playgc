# 🤖 AI 自主成長平台 ROADMAP

> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **鎖定範圍**：本檔案內 P1-P10，**不擴散**
> **完成標準**：每個 Phase 完成後跑 E2E + 部署
> **最後狀態**：所有 Phase 完成 → 停止 /loop

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: P9
CURRENT_TASK: P9-5
LAST_UPDATE: 2026-05-01T01:53:00Z
TOTAL_PROGRESS: 106/120 (88%)
```

**注意**：P1-P8 完成 + P9 lib 完成。剩 P9 路由 + UI + P10。


## 📋 工作守則（loop 每次必遵守）

1. **讀本檔**找下一個未完成 task `[ ]`
2. **只做該 task**，不擴散到清單外
3. 完成後 **標記 `[x]`** + 更新「當前狀態」
4. 每完成一個 Phase 跑 **E2E 測試**
5. 每個 Phase 結尾 **commit + push + 部署**
6. 每次 fire 至少推進 1 個 task（小步快走）
7. 全部完成 → **不再 ScheduleWakeup**，回報結束

---

# Phase 1：模型分工切換 ⚡ ✅ 完成

## 任務清單

- [x] **P1-1** 修改 `shared/schema/ai-models.ts`：`DEFAULT_VISION_MODEL` 改為 `meta-llama/llama-4-scout`
- [x] **P1-2** 重排 `OPENROUTER_FALLBACK_CHAIN` 順序：[llama-4-scout, mistral-small-3.2-24b, gemma-3-12b-it:free]
- [x] **P1-3** TS check 通過
- [x] **P1-4** commit `fix(ai): vision 預設改 Llama 4 Scout（速度 0.5s）` + push
- [x] **P1-5** 部署生產（ssh + docker compose build app）
- [x] **P1-E2E** curl https://game.homi.cc/api/health（HTTP 200）+ 確認服務正常啟動

---

# Phase 2：變體池系統 ⭐ 核心 ✅ 完成

## 後端任務

- [x] **P2-1** 建立 `shared/schema/ai-variant-pool.ts`（VariantPool 型別 + Zod schema）
- [x] **P2-2** 在 `shared/schema/index.ts` 加 export
- [x] **P2-3** SQL: `ALTER TABLE pages ADD COLUMN IF NOT EXISTS variant_pool JSONB`（本地 + 生產 DB）
- [x] **P2-4** 在 `shared/schema/games.ts` 的 pages table 加 `variantPool: jsonb` 欄位
- [x] **P2-5** 建立 `server/lib/variant-generator.ts`：用 DeepSeek V3.2 生成變體
- [x] **P2-6** 建立 `server/routes/admin/variant-pool.ts`：路由模組（檔名實際為 admin-variant-pool.ts）
- [x] **P2-7** 實作 `POST /api/admin/games/:gameId/pages/:pageId/generate-variants`
- [x] **P2-8** 實作 `GET /api/admin/games/:gameId/pages/:pageId/variants`
- [x] **P2-9** 實作 `PATCH /api/admin/games/:gameId/pages/:pageId/variants`（手動編輯）
- [x] **P2-10** 在 `server/routes/index.ts`（或對應主路由檔）註冊 variant-pool 路由
- [x] **P2-11** TS check 通過

## 前端任務

- [x] **P2-12** 建立 `client/src/lib/variant-picker.ts`：`pickVariant(pool, key, fallback)` 工具（含 hasVariantPool / countVariants）
- [x] **P2-13** 修改 `PhotoSpotFlow.tsx` 成功/失敗 toast 改用 variant-picker
- [x] **P2-14** 修改 `PhotoCompareFlow.tsx` 同樣改造
- [x] **P2-15** 修改 `PhotoOcrFlow.tsx` 同樣改造
- [x] **P2-16** 修改 `TextVerifyPage.tsx` 同樣改造
- [x] **P2-17** 修改 `ConditionalVerifyPage.tsx` 同樣改造
- [x] **P2-Bonus** GamePageRenderer commonProps 加 `variantPool: page.variantPool`（一次傳給所有元件）
- [x] **P2-18** 建立 `client/src/components/admin/VariantPoolEditor.tsx`：admin 編輯 UI
- [x] **P2-19** 在 `PageConfigEditor.tsx` 整合 VariantPoolEditor（每個 page 卡片底）
- [x] **P2-20** TS check 通過

## 收尾

- [x] **P2-21** commit `feat(ai): 變體池系統（取代即時 AI 呼叫）` + push + 部署
- [x] **P2-E2E** 測試：HTTP 200 ✅ / variant-pool API 401 認證 ✅ / 生產 DB pages.variant_pool 欄位存在 ✅

---

# Phase 3：智慧分流 🧠 ✅ 完成

- [x] **P3-1** 建立 `server/lib/text-match.ts`：`normalize` + `levenshtein` + `matchAnswer`
- [x] **P3-2** `matchAnswer` 三層：exact / fuzzy(distance≤2) / ai_needed
- [x] **P3-3** 修改 `server/routes/ai-scoring.ts` 的 `score-text` endpoint：先試 matchAnswer，命中就回傳不呼叫 AI
- [x] **P3-4** 加 `layer` 欄位到回傳 JSON（'exact' / 'fuzzy' / 'ai'）+ aiUsed 欄位
- [x] **P3-5** 寫單元測試 `server/lib/__tests__/text-match.test.ts`（17 個 case）
- [x] **P3-6** TS check EXIT 0 + vitest 17/17 通過
- [x] **P3-7** commit `feat(ai): P3 智慧分流` + push + 部署 ✅
- [x] **P3-E2E** HTTP 200 ✅ / score-text 401 認證正確 ✅

---

# Phase 4：Hash 圖片快取 📸 ✅ 完成

## 資料庫

- [x] **P4-1** 建立 `shared/schema/ai-cache.ts`：ai_result_cache 定義（含 4 個 index）
- [x] **P4-2** 在 `shared/schema/index.ts` export
- [x] **P4-3** SQL: `CREATE TABLE IF NOT EXISTS ai_result_cache(...)` + 4 個 index（本地 ✅ + 生產 ✅）

## 後端

- [x] **P4-4** 安裝 `sharp ^0.34.5` npm 套件（高效能影像處理）
- [x] **P4-5** 建立 `server/lib/image-hash.ts`：`computeImageHash` + `hammingDistance` + `isSimilarHash`
- [x] **P4-6** 建立 `server/lib/ai-cache.ts`：`getCached` + `setCached` + `cleanupExpired` + `getCacheStats` + `buildCacheKey`
- [x] **P4-7** 修改 `verify-photo` endpoint：先查 cache（pHash 距離 < 5 命中）+ schema 加 pageId
- [x] **P4-8** 修改 `compare-photos` endpoint：同樣加 cache
- [x] **P4-9** AI 結果寫回 cache（含 30 天 TTL）
- [x] **P4-10** 回應加 `cached: boolean` + `cacheDistance` metadata
- [x] **P4-11** TS check EXIT 0

## 收尾

- [x] **P4-12** commit `dc84b630` + push + 部署 ✅
- [x] **P4-E2E** HTTP 200 ✅ / verify-photo schema 接受 pageId（401 認證擋下） ✅ / ai_result_cache 表存在 ✅

---

# Phase 5：週期生成 cron 🌙 ✅ 完成

- [x] **P5-1** 建立 `scripts/cron/daily-content-generation.ts`（runDailyCron entry）
- [x] **P5-2** 任務 1：補變體池（找 variant_pool=null 的 7 種 page type，每次最多 20 個）
- [x] **P5-3** 任務 2：清過期快取（呼叫 cleanupCacheExpired）
- [x] **P5-4** 任務 3：策展素材庫（P6 預留 stub，邏輯註解中）
- [x] **P5-5** 加 `npm run cron:daily` script 到 package.json
- [x] **P5-6** 生產 host crontab 加 `0 3 * * * docker exec gamehomicc-app-1 npm run cron:daily`
- [x] **P5-7** TS check EXIT 0
- [x] **P5-8** commit + push + 部署（含 cron-daily.cjs build 整合）✅
- [x] **P5-E2E** 手動觸發成功：DeepSeek 真實生成 1 個變體池（耗時 23.6s）✅

---

# Phase 6：場域素材庫 🖼️ ✅ 完成

- [x] **P6-1** 建立 `shared/schema/field-exemplar.ts`（含 4 個 index + ExemplarSource 型別）
- [x] **P6-2** SQL: `CREATE TABLE field_exemplar_photos(...)` + 4 個 index（本地 ✅ + 生產 ✅）
- [x] **P6-3** 建立 `server/routes/admin-exemplar.ts`（routes/index.ts 已註冊）
- [x] **P6-4** 實作 `GET /api/admin/exemplar?fieldId=&gameId=&pageId=&isCurated=` 列表（含 is_curated/confidence 排序）
- [x] **P6-5** 實作 `POST /api/admin/exemplar`（手動上傳，Zod 驗證）
- [x] **P6-6** 實作 `PATCH /api/admin/exemplar/:id`（標記 is_curated/tags/description）+ `DELETE` 移除
- [x] **P6-7** 修改 cron 任務 3：從 ai_result_cache 找 confidence ≥ 0.85 自動策展（含 ALTER TABLE 加 image_url 欄位 + verify/compare endpoint 寫 imageUrl）
- [x] **P6-8** 修改 `compare-photos` endpoint：加 `useExemplar` flag，true 時優先用素材庫 is_curated 範本（依 confidence DESC 取最佳），fallback admin reference；回應加 `referenceSource: 'admin'\|'exemplar'`
- [x] **P6-9** 建立 `client/src/pages/admin/ExemplarLibrary.tsx`（網格列表 + 標精選 / 刪除 / pageId 篩選）
- [x] **P6-10** TS check EXIT 0
- [x] **P6-11** commit `43c6762d` + push + 部署 ✅
- [x] **P6-E2E** HTTP 200 ✅ / 4 個 endpoint 401 認證 ✅ / 頁面 200 ✅ / DB 表存在 ✅

---

# Phase 7：AI 訓練中心（後台專區）🎓 ✅ 完成

- [x] **P7-1** 建立 `client/src/pages/platform/PlatformAiCenter.tsx`（4 分頁完整 UI 含 P7-8~P7-11 內容）
- [x] **P7-2** `platform-menu.ts` 加「AI 訓練中心」(Sparkles icon)，放在「平台總覽」群組末
- [x] **P7-3** `App.tsx` 加路由 `/platform/ai-center`
- [x] **P7-4** 建立 `server/routes/platform-ai-center.ts`（registerPlatformAiCenterRoutes 註冊）
- [x] **P7-5** 實作 `GET /api/platform/ai-center/usage`（本月 logs 按 endpoint/provider 統計 + cacheHitRate + 成本估算）
- [x] **P7-6** 實作 `GET /api/platform/ai-center/health`（pages/cache/exemplar 統計）
- [x] **P7-7** 實作 `POST /api/platform/ai-center/batch-generate-variants`（與 cron task 1 同邏輯）
- [x] **P7-8** PlatformAiCenter UI：用量總覽分頁（4 卡片 + endpoint/provider 分佈）
- [x] **P7-9** PlatformAiCenter UI：內容打磨分頁（3 卡片 + 一鍵批次按鈕）
- [x] **P7-10** PlatformAiCenter UI：素材庫管理分頁（連結 ExemplarLibrary）
- [x] **P7-11** PlatformAiCenter UI：訓練設定分頁（顯示 3 個模型分工，唯讀預覽）
- [x] **P7-12** TS check EXIT 0
- [x] **P7-13** commit `3df76145` + push + 部署 ✅
- [x] **P7-E2E** HTTP 200 ✅ / `/platform/ai-center` 200 ✅ / 3 個 API endpoints 都 401 認證擋下 ✅

---

# Phase 8：AI 遊戲腳本產生器 🪄 ✅ 完成

- [x] **P8-1** 建立 `shared/schema/module-catalog.ts`：23 個現有 page type 的能力描述（含 ModuleScenario / ModuleSpec / formatModuleCatalog）
- [x] **P8-2** 建立 `server/lib/game-script-generator.ts`：DeepSeek prompt + Zod 驗證生成的 page configs
- [x] **P8-3** 建立 `server/routes/admin-game-generator.ts`（registerGameGeneratorRoutes 註冊）
- [x] **P8-4** 實作 `POST /api/admin/games/generate-from-script`：腳本 → pages array（純生成，不寫 DB）
- [x] **P8-5** Zod schema 驗證（generatedGameSchema 在 P8-2 lib + 路由內 generatedPageSchema 二次驗證）
- [x] **P8-6** 實作 `POST /api/admin/games/:gameId/apply-generated`：append/replace 模式 + audit log
- [x] **P8-7** 建立 `client/src/pages/admin/GameGenerator.tsx`（3 步驟：輸入 → 預覽 → 套用）+ App.tsx 路由
- [x] **P8-8** UI：腳本輸入區（textarea + 場域風格 + 時長 + 難度 + 範例填入）
- [x] **P8-9** UI：生成 loading（「AI 正在解析腳本... 約 10-30 秒」）
- [x] **P8-10** UI：預覽區（每頁卡片 + pageOrder + pageType + customName + config 摘要）
- [x] **P8-11** UI：可移除單頁（admin 微調）+ 重新生成按鈕
- [x] **P8-12** UI：一鍵發布按鈕（含 replace toggle 警告）
- [x] **P8-13** 在 game-editor header 加「✨ AI 產生器」入口（紫粉漸層按鈕）
- [x] **P8-14** TS check EXIT 0
- [x] **P8-15** commit `fae01fd0` + push + 部署 ✅
- [x] **P8-E2E** HTTP 200 ✅ / `/admin/game-generator` 200 ✅ / 兩個 API endpoints 401 認證 ✅

---

# Phase 9：模組智慧副駕駛 🤖

- [x] **P9-1** 建立 `server/lib/admin-copilot.ts`：3 種 AI 助手函式 + 型別
- [x] **P9-2** 實作 `suggestNextModule(currentPages, apiKey)`：DeepSeek 推薦 3 個 page type + 過濾無效類型
- [x] **P9-3** 實作 `diagnoseFlow(pages)`：純規則引擎（不耗 AI）— 5 種診斷（道具鏈/必填/節奏/結尾）
- [x] **P9-4** 實作 `polishCopy(original, style)`：DeepSeek 7 種風格 × 3 個變體
- [ ] **P9-5** 建立 `server/routes/admin/copilot.ts`
- [ ] **P9-6** 加 `POST /api/admin/copilot/suggest-next`
- [ ] **P9-7** 加 `POST /api/admin/copilot/diagnose`
- [ ] **P9-8** 加 `POST /api/admin/copilot/polish-copy`
- [ ] **P9-9** 在 `PageConfigEditor.tsx` 加「💡 推薦下一頁」按鈕
- [ ] **P9-10** 在遊戲儲存時觸發診斷，顯示 banner 警告
- [ ] **P9-11** 在所有文字輸入旁加「✨」魔法棒按鈕
- [ ] **P9-12** TS check
- [ ] **P9-13** commit `feat(admin): AI 副駕駛（推薦/診斷/文案）` + push + 部署
- [ ] **P9-E2E** 測試 3 個 endpoint（suggest-next / diagnose / polish-copy）回應正常

---

# Phase 10：多人/多腳本架構 🎮

- [ ] **P10-1** 建立 `shared/schema/game-routes.ts`：game_routes 表定義
- [ ] **P10-2** SQL: `ALTER TABLE games ADD COLUMN game_mode VARCHAR(20)`（本地 + 生產）
- [ ] **P10-3** SQL: `CREATE TABLE game_routes(...)`
- [ ] **P10-4** SQL: `ALTER TABLE play_sessions ADD COLUMN route_id`
- [ ] **P10-5** SQL: `CREATE TABLE coop_sync_points(...)`
- [ ] **P10-6** 建立 `server/routes/admin/game-routes.ts`：CRUD endpoint
- [ ] **P10-7** 修改 game session 邏輯：開始遊戲時可選 route
- [ ] **P10-8** 建立 `server/lib/roguelike-composer.ts`：從 page pool 隨機抽組合
- [ ] **P10-9** 加 `POST /api/games/:gameId/start-roguelike`：產生個人化流程
- [ ] **P10-10** 修改 `client/src/pages/PlayPage.tsx`：支援多腳本選擇
- [ ] **P10-11** 建立 `client/src/pages/admin/GameRoutesEditor.tsx`
- [ ] **P10-12** TS check
- [ ] **P10-13** commit `feat(game): 多人/多腳本/Roguelike 架構` + push + 部署
- [ ] **P10-E2E** 建立測試 game 含 2 條 route → start-roguelike 應回隨機抽選的 6 個 page

---

# 🏁 完成

- [ ] **DONE** 在本檔案標記 `STATUS: ALL_COMPLETED`，回報總結，停止 /loop（不再 ScheduleWakeup）
