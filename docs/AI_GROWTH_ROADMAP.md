# 🧠 AI 自我學習 ROADMAP（Wave 2 — 演算法 / 反饋 / 自我打磨）

> **聚焦範圍**：演算法、玩家反饋、自主學習、自動優化
> **嚴禁擴散**：不做新功能、不重構既有、不加無關 UI
> **核心目標**：從「規則系統」進化為「自我打磨的演算法系統」
> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **完成條件**：所有 [ ] 變 [x] → 標記 STATUS: ALL_COMPLETED → 停止 /loop

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: P15
CURRENT_TASK: P15-2
LAST_UPDATE: 2026-05-01T04:40:00Z
TOTAL_PROGRESS: 36/42
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

# Phase 11：玩家反饋訊號收集 📊 ✅ 完成

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
- [x] **P11-7** 建立 `client/src/components/game/FeedbackButtons.tsx`（reusable + inline/floating 兩種樣式 + 30s 防 spam）+ `pickVariantWithIndex()` + `feedback-tracker.ts`
- [x] **P11-8** 整合到 GamePageRenderer（最小擴散：用 `useLastShownVariant` hook + 浮動按鈕 fixed bottom-4 right-4，不需修改 5 個玩家元件 toast 邏輯）
- [x] **P11-9** admin UI：VariantPoolEditor 顯示每個變體 👍/👎/⏭ 統計 + Wilson 分數 + auto-hidden 警告 + 新增 admin variant-scores endpoint

## 收尾
- [x] **P11-10** TS check ✅ + 部署 `83868a63` ✅ + E2E（HTTP 200 / 4 endpoint 全 401 / 2 DB tables 存在）

---

# Phase 12：Multi-Armed Bandit 變體選擇 🎰 ✅ 完成

> 從「純隨機」進化為「依品質加權」。經典 Bandit 演算法。

- [x] **P12-1** 建立 `server/lib/bandit.ts`：UCB1 / Epsilon-greedy / Thompson-like 3 種策略 + 冷啟動 + buildArmsFromVariants helper
- [x] **P12-2** 單元測試 `bandit.test.ts`（12 case 全通過：cold-start / hidden / single-arm / UCB1 / ε-greedy / 整體）
- [x] **P12-3** 修改 `client/src/lib/variant-picker.ts`：新增 `pickVariantWeighted()` — 加權隨機 + 冷啟動 + hidden 過濾（沒 scores 退化純隨機）
- [x] **P12-4** 建立 `server/routes/variant-picker-server.ts`：GET `/api/player/variants/:pageId/pick`（用 server-side bandit，支援 ucb1/epsilon/thompson 三策略）
- [x] **P12-5** 自動淘汰：在 `feedback-aggregator.ts:93` 已實作（`dislikeCount >= 5 && likeCount === 0 → hidden=true`，bandit.test.ts 有 hidden case 驗證）
- [x] **P12-6** 冷啟動：在 `bandit.ts` 已實作（`coldStartMin = 3` 強制曝光，bandit.test.ts 有 cold-start case 驗證）
- [x] **P12-7** TS check ✅ / 部署 `c461d20e` ✅ / E2E（HTTP 200 / pick endpoint 401 認證）✅

---

# Phase 13：自適應閾值系統 🎯 ✅ 完成

> pHash 距離 / Levenshtein tolerance / AI confidence 閾值依任務歷史自動調整。

## 資料 + 邏輯
- [x] **P13-1** 建立 `shared/schema/task-thresholds.ts`（4 個閾值欄位 + stats jsonb + DEFAULT_THRESHOLDS 常數）
- [x] **P13-2** SQL CREATE TABLE task_thresholds（task_id PRIMARY KEY + 2 個 index）— 本地 ✅ + 生產 ✅
- [x] **P13-3** 建立 `server/lib/threshold-adapter.ts`：calculateOptimalThreshold + applyThresholdRecommendation + getEffectiveThresholds（含失敗率區間判斷 / hard limits / 樣本不足保護）

## 整合
- [x] **P13-4** 修改 `ai-cache.ts` getCached：用 `getEffectiveThresholds(taskId).pHashThreshold` 取代硬編碼 5（含 60s in-memory cache）
- [x] **P13-5** `text-match.ts` 已支援 `options.fuzzyTolerance`，改由 ai-scoring score-text endpoint 傳入（pageId 自適應值）
- [x] **P13-6** `ai-scoring.ts` 三個 endpoint 套用：verify-photo（aiConfidenceThreshold）/ compare-photos（similarityThreshold）/ score-text（fuzzyTolerance），全保留 admin override 優先級

## cron
- [x] **P13-7** cron task 4：每天最多分析 100 個近 30 天有事件的 task → upsert task_thresholds + invalidateThresholdCache
- [x] **P13-8** TS check ✅ / 部署 `0b9a6c33` ✅ / cron 實跑成功（task 4 訊息顯示 0/0/0 樣本不足，符合預期）

---

# Phase 14：A/B 自動實驗框架 🔬

> 自動分組 / 統計 / 自動結論的內容實驗系統。

## 資料層
- [x] **P14-1** 建立 `shared/schema/ab-experiments.ts`：ab_experiments + ab_assignments + 3 個 enum
- [x] **P14-2** SQL CREATE TABLE × 2（含 4 個 index + unique on experiment×user）— 本地 ✅ + 生產 ✅

## 邏輯
- [x] **P14-3** 建立 `server/lib/ab-test.ts`：assignVariant + hashAssign + findActiveExperiment + getGroupAssignmentCount（SHA256 確定性分組 + onConflictDoNothing 防 race）
- [x] **P14-4** 建立 `server/lib/ab-stats.ts`：calculateSignificance + twoProportionZTest + normalCdf（Abramowitz-Stegun 近似 < 7.5e-8）

## API
- [x] **P14-5** 建立 `server/routes/admin-ab-experiments.ts`：6 endpoint（GET 列表/單一/results、POST 建立、PATCH 更新含 status 流轉、DELETE 僅 draft）+ 場域隔離（super_admin 全看）+ audit log + 註冊到 routes/index.ts
- [x] **P14-6** 整合到 variant-picker-server：在 bandit 之前先檢 `findActiveExperiment` → 命中則 `assignVariant` 確定性分組 → 返回對應 index（reason: "ab-experiment"）+ index 越界 fallback bandit 保留容錯

## UI
- [x] **P14-7** 建立 `client/src/pages/admin/AbExperiments.tsx`（500 行）：實驗清單（含篩選 + 狀態流轉按鈕：啟動/完成/中止）+ 建立 dialog + 結果儀表板 dialog（z 值 / p 值 / 效果量 / A 組 vs B 組滿意度卡片 / 結論 badge）
- [x] **P14-8** App.tsx 加路由 `/admin/ab-experiments`：lazy import + ProtectedAdminRoute 包裹（與其他 admin 頁面一致）

## cron
- [x] **P14-9** cron task 5：抓所有 status=running 實驗 → calculateSignificance → a_wins/b_wins 自動 status=completed + endedAt + conclusionStats（含 pValue/zStatistic/effectSize/groupA/groupB/conclusionReason/calculatedAt）；no_difference 寫結論但保持 running；insufficient_data 不更新
- [x] **P14-10** TS check ✅ EXIT 0 + milestone commit + push + 部署 + E2E（HTTP 200）

---

# Phase 15：內容健康度監控 🏥

> 自動找出「殭屍變體」「孤兒任務」「死路 page」等問題內容。

## 邏輯
- [x] **P15-1** 建立 `server/lib/content-health.ts`：detectZombieVariants — 一次取 pool + 一次 selectDistinct feedback → Set 比對找出 pool 內存在但從沒 feedback 的變體；含 minDays 防剛生成誤判（預設 14 天）+ limit 上限 + ZombieVariant 介面（pageId/gameId/variantKey/index/text/daysOld）
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
