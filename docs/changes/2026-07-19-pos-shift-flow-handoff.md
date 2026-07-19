# POS 結帳流程優化 — 盤點紀錄（2026-07-19，跨對話接手用）

> 本檔為交接紀錄。原對話因 context 過大 + 環境干擾，使用者要求重開對話。
> 接手者先讀本檔，即可掌握全貌。

## 🟢 生產狀態（最重要，先看）
- 遠端 `origin/main` = **ff599c74**，**完全沒動、沒 push、沒部署**
- 生產資料庫**一筆沒改**（全程只跑唯讀 SELECT 排查）
- game.homi.cc 線上是原本版本，營業/畫面/操作不受任何影響

## 任務
排查賈村 POS「7/18 結帳後誤按又變上班、歷史統計出現三筆」→ 防誤按 + 使用者延伸需求「結帳後補記」。

## 排查結論（已用生產唯讀查詢核對）
- 18 日根因：**收班後誤按開帳**（誤按筆 id = `a23ef788`，07-18）
- 全歷史共 **7 組重複清點**（06-22/25/29、07-11/16/18）；經逐組分析：**多數是合理的「重新清點/換人重收班」，只有 18 日是真誤按**
- 18 日 settle：**實際現金 20,435 正確、隔日開帳基礎正確**；帳面「差異 7,486」是誤按致「現金銷售統計窗口被截斷、cash_sales 漏算」的錯誤歸類，實為當日正常營收

## ✅ 已完成程式碼（本地 commit 8d51a22a，未部署，tsc 綠）
1. **後端精準防呆**（`server/routes/pos-cash.ts` count 端點）
   - 已結帳 → 擋開帳（`already_settled`）
   - 收班後 → 擋開帳（`opening_after_closing`）；**僅擋此情境**，開帳階段重新清點/換人重收班等原本合理操作照常
2. **結帳後補記閉環**（新檔 `server/routes/pos-cash-adjustments.ts`）
   - `POST /api/pos/cash/post-settlement`：補收入/支出 → 計入實際現金 → 更新隔日基礎 → 推播 → append 軌跡；可多次（多次閉環）
   - 需 schema 欄位 `post_settlement`（已加在 pos_transactions / pos_expenses）
3. **檔案拆分**：adjust + adjustments + 補記 → 移到 pos-cash-adjustments.ts（pos-cash.ts 回 ≤800 行；export NT/nowHM/getSettlement）
4. **前端**（`client/src/pages/pos/PosCash.tsx`）：**原本畫面與操作完全保留**（上班/下班切換 tab、清點表單常駐都沒動），只**新增**兩個「已結帳後才出現」的元素：已結帳提示、結帳後補記卡
5. `server/routes/index.ts` 註冊 `registerPosCashAdjustmentRoutes`

## ⛔ 刻意「不做」（保守，避免破壞原本操作 / 動歷史）
- 不清任何歷史重複（多為合理重新清點）
- 不建 UNIQUE 硬約束（會誤擋合理重新清點）
- 不改 18 日結帳快照（實際現金正確）

## 📋 待辦（接手者）
1. 環境穩定時再跑一次 `npx tsc --noEmit` 確認（目前 8d51a22a 為 exit 0）
2. **部署前必跑 migration**（只加 2 欄位、additive、可重複執行）：
   `/private/tmp/.../scratchpad/migration-pos-shift-2026-07-19.sql`（若清掉，內容為）
   ```sql
   ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS post_settlement boolean NOT NULL DEFAULT false;
   ALTER TABLE pos_expenses      ADD COLUMN IF NOT EXISTS post_settlement boolean NOT NULL DEFAULT false;
   ```
   ⚠️ 順序：**先跑 migration 加欄位 → 再部署 code**（否則 code 讀 post_settlement 會報錯）
3. 前端本地驗證：開 /pos/cash 跑「上班→收班→結帳→補記」一輪
4. **部署**（使用者明確說「部署」才做）：SSH → git pull → docker compose up -d --build
5. 本地領先 origin/main 多個 commit（含大量 auto-save chore + 本次），push 前留意

## ⚠️ 環境雷（務必知道）
- 這台有「自動存檔」（Claude 桌面 app 內建、**非設定檔 hook**）會在**幾秒內還原未 commit 的編輯**
- 現象：Edit 工具回報成功 → 當場驗證 OK → 幾秒後被還原回舊版
- **應對**：把「改檔 + git commit」寫成**同一個 Bash 命令**原子執行（如用 python 改檔後 subprocess git commit）；或請使用者在 app 設定關掉自動存檔（根治）
- 8d51a22a 即用原子方式鎖定成功

## 🔌 生產連線（排查/部署用）
- SSH：`ssh -p 52099 root@172.233.89.147`（非 22）
- DB：`docker exec -i gamehomicc-db-1 psql -U postgres -d gameplatform`
- 部署目錄：`/www/wwwroot/game.homi.cc`

## 📁 本次相關檔案
- server/routes/pos-cash.ts（清點/結帳/支出 + 精準防呆）
- server/routes/pos-cash-adjustments.ts（新：管理員調整 + 結帳後補記）
- shared/schema/pos-products.ts、pos-transactions.ts（+post_settlement）
- client/src/pages/pos/PosCash.tsx（原操作 + 補記卡）
- server/routes/index.ts（註冊）
