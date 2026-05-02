# Phase 5 W18 D1 — host_lottery_wheel 轉盤抽獎元件

**日期**：2026-05-03
**範圍**：W18 D1（依 ADR-0013 規劃）
**狀態**：🟢 W18 D1 完成、轉盤抽獎元件 live、9 測試全綠

---

## 🎯 目標達成

> ADR-0013 W18 D1：實作 host_lottery_wheel
> 從「沒有抽獎元件」→「婚禮 / 派對 / 福委會通用轉盤」（6+ 情境覆蓋）

---

## 📦 新增

### 1. `client/src/components/game/host/LotteryWheel.tsx`

主元件、純展示 + 純函式（純測試友善）：
- 大螢幕：圓盤 N 等分（CSS clip-path 切片）+ 中心圖標 + 紅色指針
- 旋轉動畫：5 圈 + ease-out cubic 減速到中獎位置
- 中獎結果 banner（金色漸層）
- 玩家端：報名按鈕 + 中獎結果（區分「您中獎」「他中獎」）

**props**：
```ts
{
  config: { title, subtitle, items, spinDurationMs, allowJoin }
  hostMode: boolean
  state: { items, spinning, winnerId, spinStartedAt, spinDurationMs }
  onPulse: (type, payload) => void
  onBroadcastState: (state) => void
}
```

**輔助函式**：
- `buildInitialLotteryState(config)` — 從 config 建初始狀態
- `calculateWheelAngle(...)` — 旋轉角度計算（純函式、易測試）

### 2. `client/src/components/game/host/LotteryWheelPage.tsx`

WebSocket 整合容器：
- pulse `join` → 玩家報名（防重複名）
- pulse `spin` → admin 觸發旋轉（隨機選 winner）
- pulse `stop` → 結束狀態同步

### 3. 註冊

- `GamePageRenderer.tsx` 加 `case "host_lottery_wheel"`
- `HostPageRenderer.tsx` 加 `case "host_lottery_wheel"`
- `server/routes/scenarios.ts` `getDefaultConfigForPageType` 加預設 config

### 4. 測試（9 個）

```
✓ hostMode 顯示標題 + 候選數
✓ hostMode 無候選時顯示等待訊息
✓ hostMode 旋轉結束顯示中獎者
✓ 玩家端顯示報名按鈕（allowJoin 預設 true）
✓ 玩家端 allowJoin=false 不顯示報名按鈕
✓ buildInitialLotteryState 套用 config 預設值
✓ calculateWheelAngle 旋轉中回傳合理角度
✓ calculateWheelAngle 結束後固定在 winner 角度
✓ 玩家端 - 點擊報名觸發 onPulse
```

---

## 💡 設計決策

### 為何用 CSS clip-path 切片而非 Canvas？

選擇：CSS clip-path（純 React 渲染）

理由：
- 純 React + CSS、無 imperative DOM 操作、SSR 安全
- Canvas 需要 ref + animation loop、複雜度高
- clip-path 性能對 30 等分以下足夠
- 易響應式（vmin 單位天然適配大螢幕 / mobile）

### 為何旋轉用 5 圈 ease-out？

選擇：5 圈 + cubic ease-out

理由：
- 5 圈視覺剛好（< 5 圈 = 短促無懸念、> 5 圈 = 太久）
- ease-out cubic 是「轉盤類動畫」業界標準
- 減速感強、戲劇張力夠

### 為何 winner 在 spin 時就決定？

選擇：pulse `spin` 立即決定 winner

理由：
- 公平性：避免玩家看到部份畫面後重連改變結果
- 簡化邏輯：state 只需 winnerId、不需後驗計算
- 即時同步：所有 client 看到的是同一動畫終點

### 為何單元測試含 calculateWheelAngle？

選擇：抽出純函式 + 單獨測試

理由：
- 角度計算是核心邏輯、出 bug 難以人眼驗證
- 純函式 → 100% 可測（無 DOM / 無 timer）
- 兩個 edge case：旋轉中、結束後
- 未來改動算法時測試會 catch regression

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 9 / 9 單元測試通過 ✅
- Smoke test：維持 51/51（W18 D1 不新增 endpoint）

---

## 📊 情境覆蓋率提升

W17 結束 = 12 情境 / ~30 元件
W18 D1 加 host_lottery_wheel：

**新可用情境**：
- 婚禮（已有）+ 抽伴娘 / 抽花東
- 生日（已有）+ 抽生日禮物
- 園遊會（已有）+ 抽獎攤位
- 企業福委會（新覆蓋）⚡
- 派對遊戲（新覆蓋）⚡
- 公司尾牙（新覆蓋）⚡

→ 元件覆蓋情境數 +6

---

## ⏭ 下一步：W18 D2

依 ADR-0013：host_progress_quest（全場進度條）

---

## 🔗 相關文件

- [ADR-0013 W18 元件擴充規劃](../decisions/0013-w18-component-expansion.md)
- [W17 業務週 retro](2026-05-03-phase5-w17-complete.md)
