# 🧠 AI 自我學習 ROADMAP（Wave 2 — 演算法 / 反饋 / 自我打磨）

> **聚焦範圍**：演算法、玩家反饋、自主學習、自動優化
> **嚴禁擴散**：不做新功能、不重構既有、不加無關 UI
> **核心目標**：從「規則系統」進化為「自我打磨的演算法系統」
> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **完成條件**：所有 [ ] 變 [x] → 標記 STATUS: ALL_COMPLETED → 停止 /loop

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: P11
CURRENT_TASK: P11-9
LAST_UPDATE: 2026-05-01T03:11:00Z
TOTAL_PROGRESS: 8/42
```

## 📋 工作守則（loop 每次必遵守）

1. 讀本檔找下一個未完成 task `[ ]`
2. **只做該 task**，嚴禁擴散
3. 完成標記 `[x]` + 更新「當前狀態」
4. 每 Phase 完成跑 E2E + commit + push + 部署
5. SQL 變更：本地（gameplatform-postgres）+ 生產（gamehomicc-db-1）都做
6. 部署用：`ssh root@172.233.89.147 + docker compose -f docker-compose.prod.yml up -d --build app`
7. **保留向後相容**：所有新邏輯走 opt-in，沒設定 = fallback 舊行為
8. **不破壞既有**：所有新表附加、舊表禁止 DROP
9. 全部完成 → 不再 ScheduleWakeup，回報結束

---

# 核心理念

```
玩家行為訊號 → 資料累積 → 演算法分析 → 自動優化 → 玩家更好體驗 → 更多訊號
                                ↑                                   ↓
                                ⤺━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⤸
                                  「自我打磨的演算法系統」迴路
```

---

# Phase 11：玩家反饋訊號收集 📊

> 沒有訊號就無法學習。先建立資料收集底盤。

## 資料層
- [x] **P11-1** 建立 `shared/schema/player-feedback.ts`：variant_feedback 表（5 段 key + 4 個 index + feedbackActionEnum）
- [x] **P11-2** SQL CREATE TABLE variant_feedback（unique on user × page × variantKey × variantIndex）— 本地 ✅ + 生產 ✅
- [x] **P11-3** 建立 `shared/schema/player-events.ts`：player_event_logs 表（9 種 event type + jsonb payload + duration_ms）
- [x] **P11-4** SQL CREATE TABLE player_event_logs（4 個 index：field_time / page_action / session / created）— 本地 ✅ + 生產 ✅

## 後端
- [x] **P11-5** 建立 `server/routes/player-feedback.ts`：3 個 endpoint（feedback POST UPSERT / event POST append-only / variant-scores GET）+ 註冊
- [x] **P11-6** 建立 `server/lib/feedback-aggregator.ts`：`getVariantScores()` + Wilson Lower Bound 評分 + 30s in-memory cache + 自動 hidden（5 dislike）

## 前端
- [ ] **P11-7** 建立 `client/src/components/game/FeedbackButtons.tsx`（reusable）— 成功 toast 旁加 👍/👎
- [ ] **P11-8** 整合到 PhotoSpotFlow / TextVerifyPage 等 5 個玩家元件（修改 toast 觸發處）
- [ ] **P11-9** admin UI：VariantPoolEditor 顯示每個變體的 like/dislike 數 + 排序

## 收尾
- [ ] **P11-10** TS check + commit + push + 部署 + E2E（4 endpoint 401 認證）

---

# Phase 12：Multi-Armed Bandit 變體選擇 🎰

> 從「純隨機」進化為「依品質加權」。經典 Bandit 演算法。

- [ ] **P12-1** 建立 `server/lib/bandit.ts`：UCB1 + epsilon-greedy 兩種策略 + 冷啟動處理
- [ ] **P12-2** 單元測試 `server/lib/__tests__/bandit.test.ts`（5+ case）
- [ ] **P12-3** 修改 `client/src/lib/variant-picker.ts`：接收 scores 參數，加權抽取（fallback 純隨機）
- [ ] **P12-4** 建立 `server/routes/variant-picker-server.ts`：GET `/api/player/variants/:pageId/pick`（後端用 bandit 抽，玩家請求時呼叫）
- [ ] **P12-5** 自動淘汰：連續 5 個 👎 標記 hidden（feedback-aggregator 加邏輯）
- [ ] **P12-6** 冷啟動：新變體強制曝光 N 次（未達 N 不算分）
- [ ] **P12-7** TS check + commit + push + 部署 + E2E

---

# Phase 13：自適應閾值系統 🎯

> pHash 距離 / Levenshtein tolerance / AI confidence 閾值依任務歷史自動調整。

## 資料 + 邏輯
- [ ] **P13-1** 建立 `shared/schema/task-thresholds.ts`：task_thresholds 表（task_id × pHashThreshold / fuzzyTolerance / aiConfidenceThreshold + 統計）
- [ ] **P13-2** SQL CREATE TABLE task_thresholds（含 unique on task_id）— 本地 + 生產
- [ ] **P13-3** 建立 `server/lib/threshold-adapter.ts`：calculateOptimalThreshold(taskId) — 從歷史 ai_usage_logs / player_event_logs 算最佳值

## 整合
- [ ] **P13-4** 修改 `server/lib/ai-cache.ts` getCached：讀 task_thresholds.pHashThreshold（fallback 5）
- [ ] **P13-5** 修改 `server/lib/text-match.ts` matchAnswer：接收動態 fuzzyTolerance（fallback 2）
- [ ] **P13-6** 修改 `server/routes/ai-scoring.ts`：依 task_thresholds 套用各閾值

## cron
- [ ] **P13-7** 修改 cron daily：加 task 4「重算閾值」— 每天分析昨日資料後 upsert task_thresholds
- [ ] **P13-8** TS check + commit + push + 部署 + E2E

---

# Phase 14：A/B 自動實驗框架 🔬

> 自動分組 / 統計 / 自動結論的內容實驗系統。

## 資料層
- [ ] **P14-1** 建立 `shared/schema/ab-experiments.ts`：ab_experiments + ab_assignments 兩張表
- [ ] **P14-2** SQL CREATE TABLE ab_experiments / ab_assignments — 本地 + 生產

## 邏輯
- [ ] **P14-3** 建立 `server/lib/ab-test.ts`：assignVariant(userId, experimentId) — 用 user_id hash 確定性分組
- [ ] **P14-4** 建立 `server/lib/ab-stats.ts`：calculateSignificance(expId) — z-test 計算顯著性 + 自動結論

## API
- [ ] **P14-5** 建立 `server/routes/admin-ab-experiments.ts`：CRUD + getResults endpoint
- [ ] **P14-6** 整合到 variant-picker：若變體屬於 active 實驗，依分組返回對應變體

## UI
- [ ] **P14-7** 建立 `client/src/pages/admin/AbExperiments.tsx`：實驗清單 + 結果儀表板
- [ ] **P14-8** App.tsx 加路由 `/admin/ab-experiments`

## cron
- [ ] **P14-9** cron task 5：每天檢查 active 實驗，達顯著性閾值自動標記結論
- [ ] **P14-10** TS check + commit + push + 部署 + E2E

---

# Phase 15：內容健康度監控 🏥

> 自動找出「殭屍變體」「孤兒任務」「死路 page」等問題內容。

## 邏輯
- [ ] **P15-1** 建立 `server/lib/content-health.ts`：detectZombieVariants（從沒被選中）
- [ ] **P15-2** content-health 加 detectOrphanTasks（沒玩家完成過）
- [ ] **P15-3** content-health 加 detectDeadEndPages（玩家進去就退出，從 player_event_logs 算）
- [ ] **P15-4** content-health 加 calculateHealthScore（綜合分數 0-100）

## API + UI
- [ ] **P15-5** 加 `GET /api/platform/ai-center/content-health`（platform-ai-center.ts 內加）
- [ ] **P15-6** PlatformAiCenter UI 加「內容健康度」分頁（顯示 4 種問題清單）

## cron
- [ ] **P15-7** cron task 6：每天跑健康度分析 + log 統計

## 收尾
- [ ] **P15-8** TS check + commit + push + 部署 + E2E

---

# Phase 16：Markov 流程推薦 🔄

> 從成功玩家的歷史流程學「page type 銜接合理度」，用於 Roguelike + 副駕駛推薦。

## 資料 + 邏輯
- [ ] **P16-1** 建立 `shared/schema/markov-transitions.ts`：page_type_transitions 表（from_type × to_type × success_count × total_count）
- [ ] **P16-2** SQL CREATE TABLE — 本地 + 生產
- [ ] **P16-3** 建立 `server/lib/markov-trainer.ts`：trainTransitionMatrix() — 從 player_event_logs 提取統計
- [ ] **P16-4** 建立 `server/lib/markov-sampler.ts`：sampleNextType(currentType) — 依機率抽下一個

## 整合
- [ ] **P16-5** 修改 `server/lib/roguelike-composer.ts`：用 Markov 排序而非純 shuffle（fallback 純隨機）
- [ ] **P16-6** 修改 `server/lib/admin-copilot.ts` suggestNextModule：將 Markov 機率注入 prompt 給 AI 參考

## cron + 部署
- [ ] **P16-7** cron task 7：每週訓練 transition matrix（資料量大，不需每天）
- [ ] **P16-8** TS check + commit + push + 部署 + E2E

---

# 🏁 完成

- [ ] **DONE** 在本檔案頂部寫 STATUS: ALL_COMPLETED，停止 /loop

---

## 預期效益（量化目標）

完成所有 phase 後，平台應該達到：
- ⭐ **變體訊息有人性**：玩家覺得不機械（按讚率提升）
- 📈 **內容自我打磨**：「殭屍變體」<5%、「孤兒任務」<10%
- 🎯 **任務難度合理**：失敗率穩定在 20-40% 區間
- 🔬 **A/B 持續實驗**：admin 隨時可實驗新內容
- 💰 **AI 費用持續下降**：自適應閾值省更多 AI 呼叫
- 🌱 **真正的自主成長**：1-2 週後玩家會看到「平台變聰明了」
