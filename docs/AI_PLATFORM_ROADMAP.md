# 🤖 AI 自主成長平台 ROADMAP

> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **鎖定範圍**：本檔案內 P1-P10，**不擴散**
> **完成標準**：每個 Phase 完成後跑 E2E + 部署
> **最後狀態**：所有 Phase 完成 → 停止 /loop

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: P5
CURRENT_TASK: P5-1
LAST_UPDATE: 2026-05-01T00:38:00Z
TOTAL_PROGRESS: 51/64
```

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

- [ ] **P4-12** commit `feat(ai): pHash 圖片快取（熱門景點 50ms 秒回）` + push + 部署
- [ ] **P4-E2E** 同一張圖連續呼叫 verify-photo 兩次：第二次應回 cached=true 且 < 100ms

---

# Phase 5：週期生成 cron 🌙

- [ ] **P5-1** 建立 `scripts/cron/daily-content-generation.ts`
- [ ] **P5-2** 任務 1：補變體池（找 variant_pool=null 且 play_count>5 的任務）
- [ ] **P5-3** 任務 2：清過期快取（DELETE expires_at < NOW()）
- [ ] **P5-4** 任務 3：策展素材庫（從成功玩家照片取樣，留待 P6 用）
- [ ] **P5-5** 加 `npm run cron:daily` script 到 package.json
- [ ] **P5-6** 在生產 docker-compose.prod.yml 加 cron service（用 node-cron 或 host crontab）
- [ ] **P5-7** TS check
- [ ] **P5-8** commit `feat(ai): 每日內容生成 cron` + push + 部署
- [ ] **P5-E2E** 手動觸發一次 cron 確認執行成功 + log 顯示處理數量

---

# Phase 6：場域素材庫 🖼️

- [ ] **P6-1** 建立 `shared/schema/field-exemplar.ts`
- [ ] **P6-2** SQL: `CREATE TABLE field_exemplar_photos(...)`（本地 + 生產）
- [ ] **P6-3** 建立 `server/routes/admin/exemplar.ts`
- [ ] **P6-4** 實作 `GET /api/admin/exemplar?fieldId=&pageId=` 列表
- [ ] **P6-5** 實作 `POST /api/admin/exemplar`（手動上傳）
- [ ] **P6-6** 實作 `PATCH /api/admin/exemplar/:id`（標記 is_curated）
- [ ] **P6-7** 修改 cron 任務 3：自動策展（confidence > 0.85 自動加入）
- [ ] **P6-8** 修改 `compare-photos` endpoint：除了 admin 設定參考圖，也比對素材庫範本
- [ ] **P6-9** 建立 `client/src/pages/admin/ExemplarLibrary.tsx`
- [ ] **P6-10** TS check
- [ ] **P6-11** commit `feat(ai): 場域素材庫（內容資產化）` + push + 部署
- [ ] **P6-E2E** admin 上傳 1 張範本 / cron 執行後素材庫有自動加入紀錄

---

# Phase 7：AI 訓練中心（後台專區）🎓

- [ ] **P7-1** 建立 `client/src/pages/platform/PlatformAiCenter.tsx`
- [ ] **P7-2** 在 `client/src/config/platform-menu.ts` 加 sidebar item「AI 訓練中心」
- [ ] **P7-3** 在 `App.tsx` 加路由 `/platform/ai-center`
- [ ] **P7-4** 建立 `server/routes/platform/ai-center.ts`
- [ ] **P7-5** 實作 `GET /api/platform/ai-center/usage`（按月/按 endpoint/按 model 統計）
- [ ] **P7-6** 實作 `GET /api/platform/ai-center/health`（變體池健康度、快取 hit 率）
- [ ] **P7-7** 實作 `POST /api/platform/ai-center/batch-generate-variants`（批次補生成）
- [ ] **P7-8** PlatformAiCenter UI：用量總覽分頁（圖表）
- [ ] **P7-9** PlatformAiCenter UI：內容打磨分頁（健康度 + 一鍵補生成）
- [ ] **P7-10** PlatformAiCenter UI：素材庫管理分頁（連結到 P6）
- [ ] **P7-11** PlatformAiCenter UI：訓練設定分頁（修改各 endpoint 模型）
- [ ] **P7-12** TS check
- [ ] **P7-13** commit `feat(platform): AI 訓練中心後台專區` + push + 部署
- [ ] **P7-E2E** 訪問 `/platform/ai-center`（HTTP 200）+ API 4 個端點都回 401（未登入正確擋下）

---

# Phase 8：AI 遊戲腳本產生器 🪄

- [ ] **P8-1** 建立 `shared/schema/module-catalog.ts`：23 個現有 page type 的能力描述
- [ ] **P8-2** 建立 `server/lib/game-script-generator.ts`：DeepSeek prompt + 解析邏輯
- [ ] **P8-3** 建立 `server/routes/admin/game-generator.ts`
- [ ] **P8-4** 實作 `POST /api/admin/games/generate-from-script`：腳本 → pages array
- [ ] **P8-5** 實作 Zod schema 驗證生成的 page configs（防 AI 亂組）
- [ ] **P8-6** 實作 `POST /api/admin/games/:gameId/apply-generated`：寫入 DB
- [ ] **P8-7** 建立 `client/src/pages/admin/GameGenerator.tsx`：腳本輸入 + 預覽 UI
- [ ] **P8-8** GameGenerator UI：腳本輸入區（多行 + 設定欄位）
- [ ] **P8-9** GameGenerator UI：AI 解析中 loading
- [ ] **P8-10** GameGenerator UI：預覽區（顯示生成的 page list）
- [ ] **P8-11** GameGenerator UI：每頁可微調 + 重新生成單頁
- [ ] **P8-12** GameGenerator UI：一鍵發布按鈕
- [ ] **P8-13** 在 admin 遊戲列表加「✨ AI 產生器」入口
- [ ] **P8-14** TS check
- [ ] **P8-15** commit `feat(admin): AI 遊戲腳本產生器（5 分鐘出遊戲）` + push + 部署
- [ ] **P8-E2E** 用測試腳本「拍 3 張古蹟照」呼叫 API → 應回 4-5 個 page 配置 + 通過 schema 驗證

---

# Phase 9：模組智慧副駕駛 🤖

- [ ] **P9-1** 建立 `server/lib/admin-copilot.ts`：3 種 AI 助手函式
- [ ] **P9-2** 實作 `suggestNextModule(currentPages)`：推薦下一個 page type
- [ ] **P9-3** 實作 `diagnoseFlow(pages)`：流程診斷（找漏發道具、孤兒頁等）
- [ ] **P9-4** 實作 `polishCopy(text, style)`：文案優化（DeepSeek）
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
