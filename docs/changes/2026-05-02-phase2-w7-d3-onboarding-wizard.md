# Phase 2 W7 D3 — Onboarding Wizard「3 問找情境」

**日期**：2026-05-02
**範圍**：W7 D3、新增 1 個公開頁、TemplateMarket + FieldEntry 整合 CTA
**狀態**：🟢 W7 D3 完成、客戶不知道選什麼時有引導工具

---

## 🎯 目標達成

> Phase 2 W6-W7 已建立 12 情境 + 詳情頁 + 雙向元件連結
> 但仍有「客戶不知道從哪個情境開始」的問題
> Phase 2 W7 D3 補上「3 問找情境」引導工具 — 答 3 題即可推薦 Top 3 情境

---

## 📦 新增

### 1. 新頁面：`client/src/pages/FindScenarioWizard.tsx`

**路徑**：`/find-scenario`（公開頁）

**3 個問題**：

| Step | 問題 | 選項 |
|------|------|------|
| 1 | 你要辦什麼類型的活動？ | 交誼 / 公開活動 / 公部門 / 企業 / 空間 |
| 2 | 預估參與人數？ | 小型(<30) / 中型(30-100) / 大型(>100) |
| 3 | 這場活動最重要的是？ | 紀念回憶 / 全場互動 / 知識競賽 / 場域探索 |

### 2. 推薦演算法

簡單 score-based：

```
分類完全匹配 → +5
人數匹配 → +3
重點關鍵字匹配元件 pageType → +2 / 命中
live 狀態 → +0.5
```

排名取分數最高 Top 3，每張卡片顯示：
- 🥇🥈🥉 排名標籤
- 完整分數 + 「為什麼推薦」reasons 列表
- 點擊跳到對應 `/template-market/<scenarioId>`

### 3. 入口整合

**TemplateMarket Hero**：在 3 個 badges 下方新增「不知道選哪個？3 問找情境」CTA 按鈕

**FieldEntry 主頁**：原「主辦活動的人？」區塊雙 CTA 改為：
- 主：瀏覽 12 情境模板
- 副：🧭 3 問找情境
- 小字：或先看單一元件試玩（連 ShowcaseHub）

### 4. 路由：`App.tsx`

```tsx
<Route path="/find-scenario" component={FindScenarioWizard} />
```

---

## 💡 設計決策

### 為何只有 3 題？

選擇：3 題（分類 / 人數 / 重點）

理由：
- 玩家測驗心理學：3 題是「懶人也願意答完」的甜蜜點
- 5 題以上轉換率明顯下降
- 3 題已能覆蓋所有 12 情境的關鍵差異化軸線

### 為何用 client side 純函式？

選擇：演算法純 client side、無 API 呼叫

理由：
- 不需要登入 / 認證
- 無延遲、即時推薦
- 12 情境就是固定資料，無需 server cache
- 未來若情境多了再考慮搬 server

### 為何依 score 而非單一最佳？

選擇：Top 3（金銀銅）而非單一推薦

理由：
- 推薦演算法不一定對 — 給客戶選擇權
- 客戶可能想對比後挑選
- 「次選」常常是「也適合但風格不同」的情境
- 心理學：給太少選項反而讓人不安

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署：（即將）
- E2E 端點：`/find-scenario` 200 ✅

---

## ⏭ 下一步：W7 D4-D5

- W7 D4：客戶簡報模板（PowerPoint / PDF 格式 demo）
- W7 D5：W7 收尾、Phase 2 W8 規劃

---

## 🔗 相關文件

- [W7 D2 ShowcaseHub 反向連結](2026-05-02-phase2-w7-d2-showcase-bidirectional.md)
- [W7 D1 業務化首發](2026-05-02-phase2-w7-d1-12th-scenario.md)
- [W6 完整收尾](2026-05-02-phase2-w6-complete.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
