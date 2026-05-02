# Phase 5 W18 D5 — solo_memory_match 配對記憶遊戲

**日期**：2026-05-03
**範圍**：W18 D5（依 ADR-0013 規劃）+ W18 完整收尾
**狀態**：🟢 W18 D5 完成、配對遊戲 live、10 測試全綠

---

## 🎯 目標達成

> ADR-0013 W18 D5：實作 solo_memory_match
> 從「沒有單人輕量元件」→「過場 / 親子 / 個人挑戰通用」（4+ 情境）

---

## 📦 新增

### 1. `client/src/components/game/solo/MemoryMatchPage.tsx`

主元件（solo 軸線、無 WS）：
- 4×4（16 張 / 8 對）/ 6×6（36 張 / 18 對）兩種尺寸
- preview 期：先翻開 N 秒給玩家記
- 主玩法：點兩張 → 配對成功變綠 / 失敗翻回
- 計時 + 計步 + 進度 badge
- 完成 banner：用時 / 步數 + 「再玩一次」/「繼續下一頁」
- localStorage 紀錄最佳成績（依 size key）

**輔助函式**：
- `shuffleCards(emojis, totalCards, seed?)` — 確定性洗牌（測試友善）
- `isAllMatched(cards)` — 純函式判定完成
- `getTotalCards(size)` — 4x4=16 / 6x6=36

### 2. 註冊

- GamePageRenderer 加 `case "memory_match"`
- `getDefaultConfigForPageType` 加預設（4x4 / 3 秒 preview / 100 點獎勵）

### 3. 測試（10 個）

```
✓ shuffleCards 生成偶數張、每個 emoji 兩張
✓ shuffleCards 同樣 seed 產生相同順序（確定性）
✓ shuffleCards 不同 seed 產生不同順序
✓ shuffleCards 初始狀態 flipped/matched=false
✓ isAllMatched 全部 matched=true 才回 true
✓ getTotalCards 4x4=16 / 6x6=36
✓ 頁面渲染顯示標題 + 棋盤 + 計數
✓ 頁面預設 4x4 棋盤（16 張）
✓ size=6x6 顯示 36 張卡片
✓ preview 期間顯示 emoji 後翻回去（fake timers）
```

---

## 💡 設計決策

### 為何用「種子洗牌」（rand 帶 seed）？

選擇：實作可確定性的 PRNG（線性同餘）

理由：
- 測試需要確定性（同 seed 同結果、可斷言）
- Math.random() 不可控、測試會 flaky
- 線性同餘 PRNG 簡單（10 行）+ 質量足夠（玩家不會察覺週期性）

### 為何 preview 預設 3 秒？

選擇：showFirstNSeconds = 3

理由：
- < 2 秒：4×4 玩家來不及記
- 4-5 秒：6×6 也夠用
- > 6 秒：玩家無聊
- 3 秒是 4×4 / 6×6 折衷預設

### 為何 localStorage 而非後端？

選擇：純 client localStorage 紀錄最佳

理由：
- 個人挑戰元件不該依賴後端
- 後端紀錄需新增 schema（違紅線）
- localStorage 對個人「破紀錄」激勵足夠
- 真要排行榜可用既有 leaderboard 元件

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 10 / 10 單元測試通過 ✅
- Smoke test：維持 51/51

---

## 🔗 相關文件

- [ADR-0013 W18 元件擴充規劃](../decisions/0013-w18-component-expansion.md)
- [W18 完整收尾](2026-05-03-phase5-w18-complete.md)
