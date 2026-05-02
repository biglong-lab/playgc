# ADR-0013: W18 元件擴充規劃 — 5 個高商業價值新元件

> **日期**：2026-05-03
> **狀態**：採用中
> **影響**：W18 全週工程方向、Phase 5 整體商業覆蓋率

---

## 背景

Phase 1-2 累積 ~30 個元件，覆蓋 12 情境：婚禮 / 生日 / 同學會 / 親子 / 園遊會 / 破冰 / 頒獎 / 街區 / 商圈 / 內訓 / 旅遊 / 場域。

W17 業務週開始接觸真實客戶，需要為 W18-W19 預判：
1. 哪些元件會被點到「啊我要這個」？
2. 哪些元件能擴大商業覆蓋（單一元件多情境通用）？
3. 哪些元件實作快、產出比高？

ADR-0012 W18 規劃要選 5 個新元件、要平衡：
- 商業價值（客戶會問 / 會買單）
- 工程複雜度（W18 一週能做完）
- 跨情境通用（一個元件多市場用）
- 視覺衝擊（demo 會讓客戶說「哇」）

---

## 選項

### 候選 8 個元件（從業務 / 創意發想）

| 候選 | 商業價值 | 工程估時 | 通用性 | 視覺衝擊 |
|------|----------|----------|--------|----------|
| host_lottery_wheel（轉盤抽獎）| ⭐⭐⭐⭐⭐ | 1 天 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| host_progress_quest（全場進度條）| ⭐⭐⭐⭐ | 1 天 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| host_word_cloud（即時字雲）| ⭐⭐⭐⭐ | 1 天 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| multi_quest_chain（隊伍任務鏈）| ⭐⭐⭐⭐ | 1 天 | ⭐⭐⭐ | ⭐⭐ |
| solo_memory_match（配對記憶）| ⭐⭐⭐ | 1 天 | ⭐⭐⭐ | ⭐⭐⭐ |
| host_emoji_rain_v2（升級版）| ⭐⭐ | 0.5 天 | ⭐⭐⭐ | ⭐⭐⭐ |
| multi_photo_battle（合照大賽）| ⭐⭐⭐ | 1.5 天 | ⭐⭐ | ⭐⭐⭐⭐ |
| host_countdown_show（倒數秀）| ⭐⭐ | 0.5 天 | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 決定

**採前 5 個高分候選：**

1. **host_lottery_wheel** — 轉盤抽獎
2. **host_progress_quest** — 全場進度條
3. **host_word_cloud** — 即時字雲
4. **multi_quest_chain** — 隊伍任務鏈
5. **solo_memory_match** — 配對記憶遊戲

理由（≤ 5 點）：
1. 5 個都跨 ≥ 3 情境通用（避免單情境元件）
2. 每個 1 天、合計 5 天剛好對應 W18 D1-D5
3. host:multi:solo = 3:1:1 軸線平衡（不偏 host）
4. 視覺衝擊強的占 3 個（demo 殺手）
5. 加完後元件覆蓋商業情境再升級（婚禮 / 派對 / 街區 / 內訓 / 通用過場）

---

## 5 個元件詳細規格

### 1. host_lottery_wheel（轉盤抽獎）— W18 D1

**用途**：婚禮抽伴娘、生日抽禮物、園遊會抽獎、企業福委會抽獎

**大螢幕**：
- 圓盤動畫（CSS / Canvas）
- 名字 / 獎項繞圈、減速停在中獎者
- 中獎後 sticker / 煙火慶祝

**玩家手機**：
- 看自己中獎結果（如有）
- 沒中獎也看到「下次再來」

**Config**：
```json
{
  "title": "婚禮抽伴娘",
  "items": [
    { "id": "1", "label": "@小明", "weight": 1 },
    { "id": "2", "label": "@小華", "weight": 1 }
  ],
  "winnerCount": 1,
  "spinDurationMs": 5000
}
```

**情境覆蓋**：婚禮 / 生日 / 派對 / 內訓 / 福委會 / 園遊會（6+）

### 2. host_progress_quest（全場進度條）— W18 D2

**用途**：街區走讀進度、企業內訓 KPI、大型活動里程碑

**大螢幕**：
- 大進度條（0% → 100%）
- 達 25% / 50% / 75% / 100% 慶祝動畫
- 即時顯示「全場已完成 X / Y 任務」

**玩家手機**：
- 看自己貢獻 + 全場狀態

**Config**：
```json
{
  "title": "金門街區走讀",
  "totalTasks": 50,
  "milestones": [25, 50, 75, 100],
  "celebrationLevel": "auto"
}
```

**情境覆蓋**：街區 / 商圈 / 內訓 / 旅遊 / 場域 / 解謎遊戲（6+）

### 3. host_word_cloud（即時字雲）— W18 D3

**用途**：婚禮新人特質、同學會記憶詞、內訓回饋

**大螢幕**：
- 玩家送詞、詞雲即時生成
- 重複詞 → 字越大
- 有趣動畫：新詞掉下來、舊詞往邊緣移

**玩家手機**：
- 簡單輸入框（單詞 / 短句）

**Config**：
```json
{
  "title": "你心中的新人是？",
  "subtitle": "一人一詞、字雲即時長出來",
  "maxWordsPerUser": 3,
  "maxLength": 10
}
```

**情境覆蓋**：婚禮 / 同學會 / 內訓 / 派對 / 解謎開場（5+）

### 4. multi_quest_chain（隊伍任務鏈）— W18 D4

**用途**：街區走讀、企業內訓、員工旅遊

**機制**：
- 隊伍依序解 N 個任務（可全圖 / 序章 / 線性）
- 解 task[i] 才解鎖 task[i+1]
- 完成全部 → 隊伍上榜

**Config**：
```json
{
  "title": "金門 5 站串聯",
  "stations": [
    { "id": "s1", "label": "後浦小鎮入口", "puzzle": "..." },
    { "id": "s2", "label": "..." }
  ],
  "rewardOnComplete": "隊伍榮譽勳章"
}
```

**情境覆蓋**：街區 / 商圈 / 內訓 / 員工旅遊 / 解謎活動（5+）

### 5. solo_memory_match（配對記憶遊戲）— W18 D5

**用途**：等待時間 / 過場 / 個人挑戰

**機制**：
- 4×4 / 6×6 翻牌配對
- 個人計時 / 計步
- 完成 → 上隊伍榜（如有隊伍）

**Config**：
```json
{
  "title": "金門記憶大挑戰",
  "size": "4x4",
  "imagesUrl": ["...", "...", "..."],
  "showFirstNSeconds": 3
}
```

**情境覆蓋**：等待過場 / 解謎延伸 / 親子 / 個人挑戰（4+）

---

## 影響

### 程式碼對應

每個元件需要：
- `client/src/components/host-screens/<Name>.tsx`（host）或 `<Name>Multi.tsx`（multi）或 `<Name>Solo.tsx`（solo）
- 對應 page-types.ts 註冊
- ShowcaseHub demo 補對應元件
- ≥ 5 個單元測試
- `getDefaultConfigForPageType` 補預設 config

W18 D1-D5 每天一個、不超出。

### Schema 影響

**無**。pageType 是 string，新增 page type 不需 migration。

### 紅線

- ✅ Schema 只新增不刪除（無變動）
- ✅ 既有元件向後相容
- ✅ 每個元件 ≤ 800 行（強制要求）

### 已知限制

- 5 個元件無法滿足所有客戶反饋（W19 才補情境模板）
- multi_quest_chain 與既有 relay_mission 概念類似、需差異化說明
- solo_memory_match 與 jigsaw_puzzle 概念類似、需差異化（記憶 vs 拼圖）

---

## 後續可能變動

什麼情境會讓我們重新評估？
- W17 業務反饋客戶非常想要「OOO 元件」、不在這 5 個內 → 替換優先順序
- W18 D1 lottery_wheel 實作超時（> 1 天）→ 砍 D5（solo_memory_match 視為加值）
- 客戶說「現有 30 個元件已夠」→ W18 D2-D5 改做情境模板擴充

---

## 相關文件

- [Phase 4 完整收尾](../changes/2026-05-03-phase4-complete.md)
- [W17 業務週 retro](../changes/2026-05-03-phase5-w17-complete.md)
- [ADR-0012 Phase 5 方向](0012-phase5-direction.md)
- 既有元件清單：[shared/scenario-templates.ts](../../shared/scenario-templates.ts)
