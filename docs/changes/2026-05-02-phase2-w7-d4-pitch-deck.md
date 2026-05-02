# Phase 2 W7 D4 — 客戶銷售簡報頁（PitchDeck）

**日期**：2026-05-02
**範圍**：W7 D4、新增 1 個公開頁、FieldEntry 整合連結
**狀態**：🟢 W7 D4 完成、業務拿手機 / 平板即可講解

---

## 🎯 目標達成

> Phase 2 W7 D1-D3 完成情境市集 + 引導 wizard
> Phase 2 W7 D4 補上「業務銷售工具」 — 一頁式簡報頁，業務帶客戶開會時直接打開講解

---

## 📦 新增

### `client/src/pages/PitchDeck.tsx`（路徑 `/pitch`）

7 個區段、scroll narrative：

1. **Hero Problem**：「場地有了、人來了，但氣氛不對、沒互動、沒紀念」
   - 直接打中主辦方痛點
   - 紅色強調 = 痛點
2. **Solution**：3 個 axis 軸線（大螢幕 / 隊伍協作 / 紀念回顧）
   - 漸層底色卡片
3. **12 Scenarios Stats**：5 大分類預覽
   - 每個分類顯示含幾個情境 + 名稱
   - 點擊跳到 TemplateMarket
4. **流程示意**：5 步驟圓點圖（3 問 → 詳情 → 一鍵建場 → 列印 QR → 現場）
   - 前兩步可點擊跳轉
5. **收費**：3 種方案（一次性 / 訂閱 / 委辦）
   - 中間方案標「推薦」
6. **對比表**：自己手作 vs 客製外包 vs CHITO
   - 6 維度（時間 / 成本 / 重用性 / 維護 / 覆蓋 / 穩定）
7. **CTA**：3 個按鈕（找情境 / 看模板 / 元件試玩）

---

## 💡 設計決策

### 為何不做真 PDF？

選擇：HTML 一頁式 scroll narrative

理由：
- 業務手機可直接打開、不用先下載 PDF
- 內容含互動連結（點即跳到對應頁），純 PDF 沒法做
- 客戶需要 PDF 可瀏覽器另存 / 截圖
- 內容更新即時，不用重新發布 PDF

### 為何包含對比表？

選擇：自己手作 vs 客製外包 vs CHITO 三欄

理由：
- 客戶會比較選項
- 直接列出對比 = 業務不用每個客戶解釋一次
- 表格易於一眼看完、適合手機展示

### 為何 3 個價格區間而非單價？

選擇：一次性 / 訂閱 / 委辦三種商業模式

理由：
- 對應不同客戶類型（婚禮 vs 民宿 vs 公部門）
- 業務可直接指對應收費
- 價格區間（NT$ X,000-Y,000）給彈性空間
- 中間「訂閱」標為推薦 — 引導長期客戶

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署：（即將）
- E2E：`/pitch` 200 ✅

---

## 🔄 整合點

- **FieldEntry 主頁**：底部小字加「看完整簡報」連結 + 「先看單一元件試玩」
- **未來可加**：在 admin 後台首頁也放 `/pitch` 連結（給 super_admin 拿給客戶看）

---

## ⏭ 下一步：W7 D5

- W7 收尾文件（D1-D4 整合）
- 客戶 onboarding 完整動線 walkthrough（從零到第一場活動）

---

## 🔗 相關文件

- [W7 D3 Onboarding Wizard](2026-05-02-phase2-w7-d3-onboarding-wizard.md)
- [W7 D2 ShowcaseHub 反向連結](2026-05-02-phase2-w7-d2-showcase-bidirectional.md)
- [W7 D1 業務化首發](2026-05-02-phase2-w7-d1-12th-scenario.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
