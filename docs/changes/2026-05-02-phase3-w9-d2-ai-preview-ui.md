# Phase 3 W9 D2 — AI 預覽 UI + 套用按鈕

**日期**：2026-05-02
**範圍**：W9 D2、後端 instantiate 接收 aiConfigs + 前端 AI 預覽 Card
**狀態**：🟢 W9 D2 完成、AI 雙軌建場（default vs AI）就緒

---

## 🎯 目標達成

> Phase 3 W9 D1 完成 ai-preview endpoint
> W9 D2 補上完整 admin 工作流：輸入 context → 預覽 AI → 套用 → 建場

---

## 📦 改動

### 1. 後端 `server/routes/scenarios.ts`

**instantiate endpoint 接受 `aiConfigs`**：
```ts
// req.body.aiConfigs?: { "<pageType>": { ...config } }
const aiConfigs = req.body?.aiConfigs ?? null;
// 為每個 component 取對應 aiConfig 或 fallback default
```

**instantiateComponent 新增 `aiConfig` 參數**：
```ts
const config = aiConfig ?? getDefaultConfigForPageType(component.pageType, scenarioDisplayName);
```

**邏輯**：
- 若 `aiConfigs[pageType]` 存在 → 用 AI 生成的內容
- 否則 → fallback 到 default 範例

### 2. 前端 `TemplateMarketDetail.tsx`

新增「AI 客製化內容」Card（紫色強調），位於詳情頁中段、一鍵建場 Card 之上：

**UI 流程**：
1. textarea 輸入 context（500 字內）
2. 點「預覽 AI 客製內容」 → 呼叫 ai-preview endpoint
3. 顯示：
   - 💡 AI 思考摘要（rationale）
   - 📦 客製化結果（每個元件 ✅/⚠ 標示）
   - 📄 完整 JSON（details 折疊、debug 用）
4. 點「用 AI 內容建場」 → 呼叫 instantiate 帶上 aiConfigs
5. 建場成功 → 開啟結果 Dialog（同既有流程）

**雙軌設計**：
- 紫色 Card：AI 客製內容（建議）
- 綠色 Card：default 範例建場（快速 demo / 不用 AI）

兩者 UX 並存、admin 自由選擇。

---

## 💡 設計決策

### 為何兩個 Card 並存而非合併？

選擇：紫色（AI）+ 綠色（default）兩張獨立 Card

理由：
- 視覺清楚區分「用 AI」vs「用 default」
- AI 失敗時 admin 仍可走綠色 fallback
- 不同情境主辦方偏好不同（婚禮一定要 AI、demo 用 default 即可）
- 紫色 Card 在上 = 預設推薦、綠色在下 = 後備

### 為何用 details 標籤折疊 JSON？

選擇：HTML 原生 `<details>` 標籤

理由：
- admin 看 ✅/⚠ 元件清單即知是否 OK
- 不需要看完整 JSON 也能決定是否建場
- 進階 admin 想 debug 才展開
- 不增加 UI 複雜度（無需 Dialog / Modal）

### 為何不直接讓 AI preview 結果可編輯？

選擇：純 review、不可在 UI 內微調

理由：
- 編輯每個 pageType 的 config 需要動態表單（複雜）
- W9 D2 範圍：先確認 AI 內容可用就足夠
- W9 D3 起若客戶反饋需要編輯 → 再考慮整合 game-editor 的編輯機制
- 目前 admin 仍可在建場後到 `/admin/games/<id>/edit` 編輯

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：25/25 全綠

---

## ⏭ 下一步：W9 D3-D5

- W9 D3：找第一個付費客戶 + 帶他們完整跑流程（含 AI 客製）
- W9 D4：依客戶反饋微調 AI prompt + 內容品質
- W9 D5：W9 收尾 + 第一場活動案例文件

---

## 🔗 相關文件

- [W9 D1 AI MVP](2026-05-02-phase3-w9-d1-ai-content-mvp.md)
- [Phase 3 W9-W12 規劃書](2026-05-02-phase3-plan.md)
- [ADR-0005 Phase 3 方向](../decisions/0005-phase3-direction.md)
