# Phase 3 W9 D4 — 情境使用統計

**日期**：2026-05-02
**範圍**：W9 D4、scenarioId 標記 + GET stats endpoint + AdminDashboard 統計卡
**狀態**：🟢 W9 D4 完成、admin 可看自己用過哪些情境

---

## 🎯 目標達成

> Phase 3 W9 D1-D3 完成 AI 內容 + 客戶 onboarding 文件
> W9 D4 補上「使用統計」 — admin 可在 dashboard 看哪些情境最常用、哪些沒人用

---

## 📦 改動

### 1. 後端 `server/routes/scenarios.ts`

**標記情境實例**：
```ts
description: `情境模板實例：${component.role} [scenario:${scenarioId}]`,
```

每個 instantiate 建立的 game 會在 description 加 `[scenario:<id>]` 標記，
可用 SQL LIKE 或 regex 查詢。

**新 endpoint：`GET /api/admin/scenarios/stats`**

權限：requireAdminAuth + game:view
邏輯：
1. 抓所有 games（場域過濾 + 最近 30 天）
2. 用 regex 匹配 `[scenario:<id>]` 抽 scenarioId
3. 統計各情境 game 數
4. 加上情境名稱（從 SCENARIO_TEMPLATES 查）
5. 回傳 sorted breakdown

回應結構：
```json
{
  "windowDays": 30,
  "totalGamesCreated": 12,
  "totalScenariosUsed": 5,
  "breakdown": [
    { "scenarioId": "wedding", "scenarioName": "婚禮派對情境包", "category": "social", "count": 5 },
    { "scenarioId": "icebreaker", "scenarioName": "破冰熱場情境包", "category": "event", "count": 3 },
    ...
  ]
}
```

### 2. 前端 `AdminDashboard.tsx`

新增「情境使用統計」Card（紫色強調），位於 Phase 2 工具卡之後、WeeklyTrendChart 之前：

- 只在 `totalGamesCreated > 0` 時顯示（新場域不會看到空白）
- 顯示前 8 個最常用情境
- 每行：情境名 + 分類 + 進度條（百分比）+ 次數
- 點任一行跳到 `/template-market/<id>` 詳情頁
- Header 含「N 個 game · M 種情境」摘要

### 3. Smoke test 擴充

`scripts/smoke-test-scenarios.mjs` 加 Section 4c：
- GET `/api/admin/scenarios/stats` → 401 認證守衛

從 25 → **26 個檢查**

---

## 💡 設計決策

### 為何用 description LIKE 而非 schema 變更？

選擇：標記在既有 description 欄位

理由：
- 不動 schema（符合「Schema 只新增不刪除」紅線、避免 DB migration）
- description 是文字、含 `[scenario:wedding]` 也不影響顯示
- regex 解析簡單、效能可接受（場域 game 數通常 < 1000）
- 未來若要結構化 → 可加 `scenarioId` 欄位（symptoms 不變）

### 為何只看最近 30 天？

選擇：固定 30 天 window

理由：
- 統計太久遠的場次不能反映現況
- 太短（如 7 天）取樣不足
- 30 天 = 1 個月、活動週期匹配
- 未來可加 query param `?days=N` 自訂

### 為何 dashboard 顯示前 8 個？

選擇：top 8 + 隱藏其餘

理由：
- 通常 admin 用 5-7 種情境最常見
- 8 個 row 視覺清晰、不擠
- 第 9+ 個極少被用、admin 可去 template-market 看
- 進度條長度差距明顯（top 1 vs top 8）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- 部署：（即將）
- Smoke test 預期：**26/26 通過**

---

## ⏭ 下一步：W9 D5

- W9 D5：W9 收尾文件 + Phase 3 W10 規劃（付費機制）

---

## 🔗 相關文件

- [W9 D1 AI MVP](2026-05-02-phase3-w9-d1-ai-content-mvp.md)
- [W9 D2 AI 預覽 UI](2026-05-02-phase3-w9-d2-ai-preview-ui.md)
- [W9 D3 客戶文件包](2026-05-02-phase3-w9-d3-customer-runbooks.md)
- [Phase 3 規劃](2026-05-02-phase3-plan.md)
