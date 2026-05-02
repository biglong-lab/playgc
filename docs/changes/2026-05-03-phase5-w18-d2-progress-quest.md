# Phase 5 W18 D2 — host_progress_quest 全場進度條元件

**日期**：2026-05-03
**範圍**：W18 D2（依 ADR-0013 規劃）
**狀態**：🟢 W18 D2 完成、進度條元件 live、9 測試全綠

---

## 🎯 目標達成

> ADR-0013 W18 D2：實作 host_progress_quest
> 從「沒有全場進度視覺化」→「街區走讀 / 內訓 KPI / 跨情境通用進度條」（6+ 情境）

---

## 📦 新增

### 1. `client/src/components/game/host/ProgressQuest.tsx`

主元件、純展示 + 純函式：
- 大螢幕：大進度條（漸層 emerald → cyan）+ 里程碑刻度 + 計數面板 + 貢獻榜 top 5
- 達成里程碑時：覆蓋層慶祝動畫（3.5s）
- 玩家端：全場進度條 + 我的貢獻 + 「✅ 我完成一個任務」按鈕

**輔助函式**：
- `buildInitialProgressState(config)` — 從 config 建初始狀態
- `calculateProgress(completed, totalTasks)` — 百分比計算（防超過 / 防 div by 0）
- `detectNewMilestones(prevPercent, newPercent, milestones)` — 偵測本次跨過的里程碑

### 2. `client/src/components/game/host/ProgressQuestPage.tsx`

WebSocket 整合容器：
- pulse `complete` → 玩家完成一個任務（防超過 totalTasks）
- 自動偵測新達成里程碑、加入 milestonesReached
- contributors map 累加各玩家貢獻

### 3. 註冊

- GamePageRenderer 加 `case "host_progress_quest"`
- HostPageRenderer 加 `case "host_progress_quest"`
- `getDefaultConfigForPageType` 加預設 config（totalTasks=100、milestones=[25,50,75,100]）

### 4. 測試（9 個）

```
✓ hostMode 顯示標題 + 進度百分比
✓ hostMode 顯示貢獻榜 top 5
✓ hostMode 達成里程碑時顯示慶祝動畫
✓ 玩家端顯示進度 + 我的貢獻 + 推進按鈕
✓ 玩家端 - 點擊推進 onPulse
✓ 玩家端 - 已達 100% 時按鈕 disabled
✓ calculateProgress 正確計算百分比（含 edge cases）
✓ detectNewMilestones 偵測本次跨過的里程碑
✓ buildInitialProgressState 套用 config 預設值
```

---

## 💡 設計決策

### 為何用 `milestonesReached` 持久化而非每次重算？

選擇：state 內存「已達成里程碑陣列」

理由：
- 慶祝動畫需要「剛達成」的 trigger（pulse 觸發）
- 重算不知道是「剛達成」還是「之前就達成」
- milestonesReached 累加 → 大螢幕 useEffect 監聽 → 觸發動畫
- 純函式 `detectNewMilestones` 計算「本次新達成」、純函數易測試

### 為何貢獻榜只顯示 top 5？

選擇：sort + slice(0, 5)

理由：
- 5 個剛好填一個 box（不破壞版型）
- 大型活動可能 100+ 玩家、全部顯示無意義
- top 5 鼓勵「想上榜」的競爭感
- 自己沒上榜也能在玩家端看「我的貢獻」

### 為何進度條漸層 emerald → cyan？

選擇：from-emerald-400 via-teal-400 to-cyan-400

理由：
- 街區 / 商圈情境通常配自然色
- 內訓 / 里程碑情境「綠色 = 進步 / 達成」直觀
- 漸層比純色視覺豐富、適合大螢幕

### 為何「推進按鈕」由玩家自己點？

選擇：玩家主動點擊 `complete` pulse

理由：
- 簡化系統設計（不需與 game logic 耦合）
- 街區走讀可整合成「完成一站打卡」
- 內訓可整合成「完成一個學習任務」
- 通用性高（admin 自己決定何時讓玩家點）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 9 / 9 單元測試通過 ✅
- Smoke test：維持 51/51

---

## 📊 W18 元件覆蓋率（D1-D2 累積）

| 元件 | 軸線 | 情境覆蓋（+） |
|------|------|--------------|
| host_lottery_wheel（D1）| host | 婚禮抽伴娘 / 生日禮物 / 福委會 / 派對 / 尾牙（+6）|
| host_progress_quest（D2）| host | 街區走讀 / 商圈打卡 / 內訓 KPI / 員工旅遊 / 通用任務（+6）|

W18 兩個元件累計 +12 情境覆蓋 ⚡

---

## ⏭ 下一步：W18 D3

依 ADR-0013：host_word_cloud（即時字雲）

---

## 🔗 相關文件

- [ADR-0013 W18 元件擴充規劃](../decisions/0013-w18-component-expansion.md)
- [W18 D1 LotteryWheel](2026-05-03-phase5-w18-d1-lottery-wheel.md)
