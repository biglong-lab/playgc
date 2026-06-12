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

## 實作步驟（commit 時序）
- [x] Phase 0：權威可渲染清單（100 種）；3 個缺 config 型別前 12 沒用到 → 跳過（不過度）
- [x] Phase 1：瘦身 12 情境（174→53 元件，刪 121 幽靈）— `6d9cbfca`
- [x] Phase 1b：刪除 99 個無實質意義樣板（112→12 情境，檔案 5106→673 行）— `b6e67a63`
- [x] Phase 2：可渲染不變式測試 `scenario-renderable.test.ts`（取代需 Firebase token 的 admin API 測試）— `4e1988cd`
- [x] reunion 標語移除已刪的「故事接龍」→「許願牆」
- [x] Phase 3：重寫 `multi-player-components.spec.ts`（874→107 行）；修復詳情頁公開可見 bug
- [x] Phase 4：tsc PASS、24 scenario 單元測試、14/14 e2e

## 修復的真實 bug
**詳情頁未登入被踢到 /admin/login**：`TemplateMarketDetail` 用 `useAdminAuth()` 預設
`redirectTo=/admin/login`，未登入訪客一進情境詳情頁就被導向登入 → 銷售頁形同壞掉。
改 `useAdminAuth({ redirectTo: "" })` 關閉導向（頁面本就有非 admin UI + 登入 CTA）。

## 驗證結果
- `npx tsc --noEmit`：PASS
- `scenario-templates.test.ts` + `scenario-renderable.test.ts`：24/24 PASS
- `e2e/multi-player-components.spec.ts`：14/14 PASS（health=12、市集顯示12卡、
  詳情頁可見且列元件、玩家路由 /play /g 不崩、mobile RWD）
- 不變式：12 情境 53 元件 0 個無 renderer

## 已知限制 / 後續
- golden-path-a/b/c e2e 被「本地 dev DB schema drift」擋住（games 表缺 show_progress
  等欄位，seed-game 500）。此為既有環境問題、非本次改動造成；`db:push` 需 table-level
  互動解析（風險，未強制執行，DB 未被更動）。要跑這 3 條需在終端機 `! npm run db:push`
  互動確認後再跑。
- 本次未部署，等使用者明確說「部署」。
