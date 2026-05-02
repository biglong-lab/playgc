# Phase 2 W7 D2 — ShowcaseHub 元件 → 情境反向連結

**日期**：2026-05-02
**範圍**：W7 D2、3 個檔案、新增反向索引 helper + 4 個測試 + ShowcaseHub UI 改造
**狀態**：🟢 W7 D2 完成、ShowcaseHub 15 張 demo 卡片全部含「適用情境」連結

---

## 🎯 目標達成

> Phase 2 W6 完成 TemplateMarket（情境 → 元件）
> Phase 2 W7 D2 補上反向：元件 → 情境（讓客戶在試玩元件時就知道「這個能用在什麼場合」）

---

## 📦 新增

### 1. 反向索引 helper：`shared/scenario-templates.ts`

```ts
/** 反向索引：給定 pageType，回傳所有含這個元件的情境 */
export function getScenariosForPageType(pageType: string): ScenarioTemplate[] {
  return SCENARIO_TEMPLATES.filter((s) =>
    s.components.some((c) => c.pageType === pageType),
  );
}
```

### 2. 4 個新測試（共 20/20 通過）

```ts
- host_emoji_react 至少出現在 3 個情境
- host_polaroid_collage 出現在婚禮 + 生日
- treasure_hunt 出現在親子冒險 + 商圈打卡 + 場域故事
- 不存在的 pageType 回傳空陣列
```

### 3. ShowcaseHub 改造

抽出 `DemoCard` 元件，所有 15 張 demo 卡片（5 個 host W3 + 5 個 host W5 + 5 個 multi）共用：

- **「適用情境」橫排**：每張卡顯示前 3 個含此元件的情境 chips
- **可點擊**：點 chip 跳到 `/template-market/<scenarioId>`
- **更多計數**：第 4+ 個情境顯示 `+N`
- **hasBoth flag**：host 元件顯示「📺 大螢幕」「📱 玩家」雙按鈕，multi 顯示單一「📱 看玩家版型」

### 4. 範例反向連結

| 元件 | 適用情境（前 3）|
|------|----------------|
| host_emoji_react | 婚禮派對 / 生日派對 / 親子冒險 |
| host_polaroid_collage | 婚禮派對 / 生日派對 / 同學會 |
| host_trivia_showdown | 同學會 / 園遊會主舞台 / 頒獎典禮 |
| treasure_hunt | 親子冒險 / 商圈打卡 / 場域故事 |
| jigsaw_puzzle | 親子冒險 / 破冰熱場 |
| host_knowledge_map | 街區走讀 / 商圈打卡 |

---

## 💡 設計決策

### 為何抽 DemoCard 元件？

選擇：將 3 個區段的 `.map((item) => <Card>...</Card>)` 抽成共用 `DemoCard`

理由：
- 避免在 3 個區段重複加「適用情境」邏輯
- DRY — 未來新增區段（如 W7 D3 預計加 solo 元件展示）可重用
- 集中管理 hasBoth / pageType 等元件狀態

### 為何只顯示前 3 個情境？

選擇：顯示前 3 個 + 「+N」摘要

理由：
- 視覺簡潔（3 個 chips 不會擠爆 card）
- 玩家不需看完所有情境就能轉換
- 點 +N 可看完整列表（未來可加 popover）

### 為何用 chip 而不是純文字？

選擇：Badge 元件 + hover bg + cursor pointer

理由：
- 視覺上明確「可點擊」
- 一致與 TemplateMarket 卡片的元件 chips 風格
- mobile 上更好 tap

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- 測試：20/20 scenario tests + 全部 host tests ✅
- Vite build：成功 ✅
- 部署：（即將）

---

## ⏭ 下一步：W7 D3-D5

- W7 D3：客戶 onboarding 流程（首次主辦方引導 wizard）
- W7 D4：第一個付費情境的 demo 影片連結
- W7 D5：W7 收尾、客戶簡報模板

---

## 🔗 相關文件

- [W7 D1 業務化首發](2026-05-02-phase2-w7-d1-12th-scenario.md)
- [W6 完整收尾](2026-05-02-phase2-w6-complete.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
