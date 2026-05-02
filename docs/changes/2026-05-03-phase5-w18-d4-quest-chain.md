# Phase 5 W18 D4 — quest_chain 任務鏈元件

**日期**：2026-05-03
**範圍**：W18 D4（依 ADR-0013 規劃）
**狀態**：🟢 W18 D4 完成、任務鏈元件 live、11 測試全綠

---

## 🎯 目標達成

> ADR-0013 W18 D4：實作 multi_quest_chain
> 從「沒有線性解鎖元件」→「街區走讀 / 內訓 / 員工旅遊通用任務鏈」（5+ 情境）

---

## 📦 新增

### 1. `client/src/components/game/multi/QuestChain.tsx`

主元件、純展示 + 純函式：
- 標題 + 進度條（amber/orange 漸層）
- 站點列表（已完成 ✅ / 當前 🔢 / 鎖住 🔒）
- 當前站答題區（input + hint + 送出按鈕）
- 全部完成 banner（金牌獎勵 + onComplete 按鈕）

**輔助函式**：
- `checkStationAnswer(station, answer)` — 純函式比對（normalize + 無 answer 時任答案都過）
- `calculateChainProgress(completedIds, total)` — 進度百分比計算

### 2. `client/src/components/game/multi/QuestChainPage.tsx`

WS 容器簡化版（W18 D4 範圍）：
- local state 進度管理
- localStorage 持久化（重整不卡關、key by page.id）
- pulse handler 內含 `checkStationAnswer` 邏輯
- 答錯累計 failureCount → 達閾值顯示 hint

**未來擴充（W19+）**：可加 team WS sync 讓隊員共享進度

### 3. 註冊

- GamePageRenderer 加 `case "quest_chain"`
- `getDefaultConfigForPageType` 加預設（3 站範例 + 金牌獎勵）

### 4. 測試（11 個）

```
✓ 顯示標題 + 進度
✓ 已完成 ✅ / 鎖住 🔒 視覺差異
✓ 當前站顯示輸入框 + 送出按鈕
✓ 送出答案觸發 onSubmitAnswer
✓ 達 hintAfterFailures 顯示 hint
✓ 全部完成顯示獎勵 banner + onComplete 按鈕
✓ checkStationAnswer 比對 normalize 後相等
✓ checkStationAnswer 大小寫不敏感
✓ checkStationAnswer 無 answer 時任何答案都過
✓ calculateChainProgress 計算百分比（含 div by 0 防護）
✓ 無 stations 顯示 fallback 訊息
```

---

## 💡 設計決策

### 為何不接 team WS sync（簡化版）？

選擇：W18 D4 僅 local state + localStorage、W19+ 才補 team sync

理由：
- W18 D4 1 天內完成、不能花時間做複雜 sync
- 既有 useTeamRelaySync 是 RelayMission 專用、需要新建類似 hook
- 客戶反饋未實際抱怨「進度不共享」前，先單人版可用就好
- localStorage 重整保進度（90% 真實使用情境足夠）

### 為何站點 hint 達 N 次失敗才顯示？

選擇：`hintAfterFailures = 2` 預設

理由：
- 立即顯示 hint = 玩家不會嘗試
- 無 hint = 玩家卡關放棄
- 2 次失敗剛好（已嘗試但確實卡住）
- admin 可調（hintAfterFailures: 0 → 一直顯示、3 → 給更多自主嘗試）

### 為何用 checkStationAnswer 而非直接 normalize 比較？

選擇：抽出 pure function 給容器層用

理由：
- 容器需要做答案驗證（決定要不要推進 currentIndex）
- pure function = 容易單測（不依賴 React component）
- 答案邏輯擴充（如答案陣列、模糊比對）只改一處

### 為何 station.answer 是 optional？

選擇：可不設 answer（任何答案都過）

理由：
- 街區走讀情境：admin 可能設「到了打卡就過、不問題目」
- 簡化 admin 設定（不必每站想答案）
- 未來可擴充 GPS 觸發、photo 觸發等其他完成條件

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 11 / 11 單元測試通過 ✅
- Smoke test：維持 51/51

---

## 📊 W18 元件覆蓋率（D1-D4 累積）

| 元件 | 軸線 | 情境覆蓋 |
|------|------|----------|
| host_lottery_wheel | host | 婚禮 / 派對 / 福委會（+6）|
| host_progress_quest | host | 街區 / 商圈 / 內訓 KPI（+6）|
| host_word_cloud | host | 婚禮 / 同學會 / 內訓回饋（+5）|
| quest_chain | multi | 街區走讀 / 內訓 / 員工旅遊（+5）|

W18 四個元件累計 **+22 情境覆蓋** ⚡

---

## ⏭ 下一步：W18 D5

依 ADR-0013：solo_memory_match（配對記憶遊戲）+ W18 retro

---

## 🔗 相關文件

- [ADR-0013 W18 元件擴充規劃](../decisions/0013-w18-component-expansion.md)
- [W18 D1-D3 元件](2026-05-03-phase5-w18-d1-lottery-wheel.md)
