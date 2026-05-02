# Phase 5 W18 D3 — host_word_cloud 即時字雲元件

**日期**：2026-05-03
**範圍**：W18 D3（依 ADR-0013 規劃）
**狀態**：🟢 W18 D3 完成、字雲元件 live、9 測試全綠

---

## 🎯 目標達成

> ADR-0013 W18 D3：實作 host_word_cloud
> 從「靜態投票答題」→「玩家送詞、字雲即時長出」（婚禮 / 同學會 / 內訓 5+ 情境）

---

## 📦 新增

### 1. `client/src/components/game/host/WordCloud.tsx`

主元件、純展示 + 純函式：
- 大螢幕：紫色漸層背景 + 字雲展示（依詞頻字體大小不同 + 6 色循環）
- 動畫層：新詞往下掉（2.5s 進場動畫）
- 詞頻 > 1 顯示 ×N 計數
- 玩家端：input + 送出按鈕 + 已用次數 + 全場熱詞 top 5

**輔助函式**：
- `buildInitialWordCloudState()` — 乾淨初始狀態
- `calculateWordSize(count)` — 詞頻 → 字體大小（baseSize 24 + count×8、上限 96px）
- `getSortedWords(wordCounts)` — 依詞頻降冪排序、附 size

### 2. `client/src/components/game/host/WordCloudPage.tsx`

WebSocket 容器：
- pulse `submit` → 累加 wordCounts + submitters（防超過 maxWordsPerUser）
- recentWords 滑動視窗（max 20）給動畫用

### 3. 註冊

- GamePageRenderer + HostPageRenderer 加 `case "host_word_cloud"`
- `getDefaultConfigForPageType` 加預設（maxWordsPerUser=3、maxLength=10）

### 4. 測試（9 個）

```
✓ hostMode 顯示標題 + 等待訊息（無詞）
✓ hostMode 顯示字雲（依詞頻字體大小不同）
✓ 玩家端顯示 input + 送出按鈕
✓ 玩家端 - 輸入並送出觸發 onPulse
✓ 玩家端 - 達上限後 input 與按鈕 disabled
✓ calculateWordSize 詞頻越多字越大（含上限）
✓ getSortedWords 依詞頻降冪排序
✓ buildInitialWordCloudState 回傳乾淨初始狀態
✓ 玩家端顯示熱詞 top 5
```

---

## 💡 設計決策

### 為何不用 d3-cloud / wordcloud2.js？

選擇：純 React + CSS、自己算 fontSize

理由：
- d3-cloud 套件 ~ 100kb gzipped、bundle 變大
- 我們的字雲不需精確 collision detection（並排顯示就夠美）
- 純 React 更容易寫測試 + SSR 安全
- W19+ 若需要更精緻可再評估

### 為何 fontSize 公式 baseSize + count×8？

選擇：線性 + min cap

理由：
- 線性 = 視覺直觀（詞頻 5 倍 = 字大 ~5 倍）
- 不用 log（log 在 1-3 詞頻時差異不明顯、不有趣）
- 上限 96px 防詞頻爆衝（如有 100+ 票會破版）

### 為何 maxWordsPerUser 預設 3？

選擇：每位玩家最多送 3 個詞

理由：
- 1 個太少（玩家覺得參與感不夠）
- 5+ 太多（同個玩家洗字雲、影響公平）
- 3 個剛好：第一個直覺、第二個再想、第三個確認

### 為何 server / client 雙重檢查 maxWordsPerUser？

選擇：client 防 UX、server（pulse handler）防繞過

理由：
- 客戶端按鈕 disabled = UX 友善
- WebSocket 訊息可被惡意客戶端繞過
- pulse handler 內 `if (userCount >= maxWordsPerUser) return null` 是最終防線

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 9 / 9 單元測試通過 ✅
- Smoke test：維持 51/51

---

## 📊 W18 元件覆蓋率（D1-D3 累積）

| 元件 | 軸線 | 情境覆蓋 |
|------|------|----------|
| host_lottery_wheel | host | 婚禮 / 派對 / 福委會 / 尾牙（+6）|
| host_progress_quest | host | 街區 / 商圈 / 內訓 KPI（+6）|
| host_word_cloud | host | 婚禮 / 同學會 / 內訓 / 派對 / 開場暖身（+5）|

W18 三個元件累計 **+17 情境覆蓋** ⚡

---

## ⏭ 下一步：W18 D4

依 ADR-0013：multi_quest_chain（隊伍任務鏈）

---

## 🔗 相關文件

- [ADR-0013 W18 元件擴充規劃](../decisions/0013-w18-component-expansion.md)
- [W18 D1 LotteryWheel](2026-05-03-phase5-w18-d1-lottery-wheel.md)
- [W18 D2 ProgressQuest](2026-05-03-phase5-w18-d2-progress-quest.md)
