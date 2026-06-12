# template-market 12 情境瘦身 + 端到端驗證 — 2026-06-13

> 範圍：原始 12 情境（陣列前 12）｜狀態：進行中｜部署：未部署（等使用者指示）

## 背景
使用者要求「讓 template-market 12 個工具順暢可運作」。盤點發現頁面標題寫「12 情境」但資料已膨脹到 112 情境 / 338 元件類型。前 12 情境共 174 個元件，其中 **121 個（70%）沒有前端 renderer**，玩家打開會看到「未知頁面類型: xxx」。

根因：`server/routes/scenarios.ts:3315` 把 `component.pageType` 原樣寫進 DB pages，`client/src/components/game/GamePageRenderer.tsx` 無對應 case 即 fallback「未知頁面類型」。平台實際可渲染 pageType = 100 種。

決策（使用者選定）：**瘦身策略** — 刪除幽靈元件，只保留有 renderer 且能端到端跑的元件。不補 121 個 renderer（避免過度開發、守紅線 #11）。

## 影響範圍
- `shared/scenario-templates.ts`（前 12 情境的 components 陣列）
- `server/routes/scenarios.ts`（補 3 個缺 default config 的型別）
- 新增/更新 e2e 測試於 `e2e/`

## 可渲染基準（100 種，待 Phase 0 產出權威清單）
缺 default config 但有 renderer：host_bingo_board / host_blessing_wall / host_micro_qa（Phase 0 補）

## 實作步驟
- [ ] Phase 0：權威可渲染清單 + 補 3 個 config
- [ ] Phase 1：瘦身 12 情境
- [ ] Phase 2：instantiate 端點逐情境驗證
- [ ] Phase 3：Playwright e2e（婚禮/員工旅遊/街區走讀）
- [ ] Phase 4：tsc + 全 e2e + commit

## 驗證
每情境 instantiate 回傳的 pageType 全 ∈ 可渲染集合；playUrl 不顯示「未知頁面類型」；e2e 持久化通過。

## 已知限制 / 後續
- 其餘 100 個非主打情境仍含幽靈元件，未處理（範圍外）。
- 頁面是否收斂成只顯示 12 情境 = 另一產品決策，待議。
