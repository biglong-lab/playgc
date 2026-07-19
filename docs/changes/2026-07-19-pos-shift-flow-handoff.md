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


---

## 🔄 接手更新（2026-07-19 第二對話）

### 已完成
1. **修好 index.ts 漏註冊**（commit 51f18fef）：`registerPosCashAdjustmentRoutes` 原本沒掛進 index.ts → 補記/調整/軌跡三端點是死的（會 404）。自動存檔把註冊行還原所致。已原子補回，tsc 綠。
2. **line-webhook.ts 全面查證 → 安全、不需滾回**：
   - 本地 HEAD vs 生產 origin/main 逐字元 diff = 完全一致（750 行好版）
   - line-webhook 在本地 31 commit（含 27 auto）中被動過 **0 次**
   - 本地相對生產只有 7 個 POS 差異檔，零損壞
   - 使用者看到的損壞是 **working tree 暫態（未 commit）**，git 從沒記錄過壞版本 → 滾回是空操作，不做
3. **自動 commit hook 已移除**：從 `~/.claude/settings.json` 移除 PostToolUse + Stop（都呼叫 auto-checkpoint.sh），已 commit 進 `~/.claude` git。⚠️ **需重開對話才生效**。

### 根因定位（澄清交接文件原誤判）
- 「自動 commit（chore(auto)）」= PostToolUse hook → auto-checkpoint.sh（**是設定檔 hook**，原說「非設定檔」錯）。**只 commit、不改內容**。已移除。
- 「還原編輯 / 損壞檔案」= **Claude 桌面 app 內建**（已排除 launchd/watcher/還原 hook；唯一相關 process 是 Claude.app）。shell 關不掉，需 app 端處理。
- auto-checkpoint 的 **push 已於 07-18 停用**，不會自動推遠端；origin/main 仍停 ff599c74。

### 剩餘待辦
1. POS 本地 e2e 驗證（上班→收班→結帳→補記）
2. 部署前 migration（加 2 欄位）
3. 部署（使用者說了才做；用 `npm run deploy`，非手動 docker compose --build）
4. push 前留意本地領先 origin 32 commit + `pos-cash.ts` 831 行超標

### e2e 接地驗證（2026-07-19 第二對話收尾）
- ✅ 本地 server 真實啟動（port 3333）
- ✅ migration 已套用**本地 dev DB**（pos_transactions / pos_expenses 加 post_settlement）
- ✅ 三端點真實驗證：`POST post-settlement` / `POST adjust` / `GET adjustments` 全 **404→401**（修復生效、auth 正常擋）
- ⚠️ 完整 UI 流程（上班→收班→結帳→補記）**未跑**：admin 登入統一 Firebase Google、AI 不能代做登入（安全紅線）→ **留部署後使用者本人實測**
- 附記：本地 dev DB 的 games 表缺 is_demo 欄位（demo-cleanup cron 報錯），與 POS 無關、既有 schema 漂移

### ⚠️ 部署前務必（生產尚未有欄位）
1. 生產 DB 尚未有 post_settlement → **先跑 migration 加欄位、再部署 code**（否則 code 讀欄位報錯）
2. 部署用 `npm run deploy`（注入 GIT_SHA），**非**手動 docker compose --build
3. push 前：`git diff --stat origin/main HEAD` 確認只有預期檔 + tsc 綠 + line-webhook 零損壞
