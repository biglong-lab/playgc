# 訪客 Demo 沙盒 — template-market 免登入一鍵體驗 — 2026-07-05

> 範圍：情境模板市集轉化漏斗（訪客免登入試玩）
> 狀態：程式完成、tsc/build/測試過、**含 schema 變更（部署需 db:push）**

## 背景
template-market 轉化漏斗最大斷點：訪客玩不到完整情境（要 admin 建場）。本功能讓訪客點「立即體驗」→ 免登入建臨時 demo 遊戲 → 進大螢幕玩（搭配常駐加入 QR）→ 2 小時自動清理。

## 設計決策
- **只開放 6 個全 host 情境**（wedding/birthday/reunion/carnival-stage/icebreaker/awards-ceremony）；含 multi/shared 需登入、回 400
- **複用 `instantiateComponent`**（module-scope 參數化）+ 加 `isDemo`/`demoExpiresAt` 參數
- **導向大螢幕 hostUrl**（複用 7/05 上線的 `HostJoinQr` 常駐加入 QR）
- **安全**：`publicWriteLimiter`（每 IP 每小時 10 次）；`fieldId=null` 不綁場域
- **清理**：cron 每 30 分刪過期 demo

## 影響範圍
- `shared/schema/games.ts`：+`isDemo`(bool default false) +`demoExpiresAt`(timestamp nullable)
- `server/routes/scenarios.ts`：
  - 新公開端點 `POST /api/scenarios/:id/demo`（publicWriteLimiter、全 host gate、isDemo+2h TTL）
  - `instantiateComponent` 加 `isDemo`/`demoExpiresAt` 參數
  - stats/quota 掃描排除 `isDemo`（demo 不污染正式統計/配額）
- `server/lib/demo-cleanup-cron.ts`（新）：每 30 分清 `isDemo && demoExpiresAt < now`；**先刪 gameSessions（無 cascade）再刪 games（pages/progress/chat cascade）**
- `server/index.ts`：`IS_SCHEDULER_INSTANCE` gate 內註冊 cron
- `client/src/pages/TemplateMarketDetail.tsx`：訪客區塊全 host 情境 → 「🎮 立即體驗（免登入）」按鈕（含 multi 維持登入提示）

## 外鍵刪除順序（清理正確性關鍵）
- `pages → games` onDelete cascade（隨 games 刪）
- `gameSessions → games` **無 onDelete**（sessions.gameId 未設）→ cron 手動先刪
- `playerProgress`/`chatMessages → gameSessions` cascade（隨 sessions 刪）

## 驗證
- `npx tsc --noEmit` ✅、`npm run build` ✅
- `scenario-demo.test.ts`：可 demo 情境不變式（鎖住「只 6 個全 host 可 demo」安全決策）+ scenario-renderable 不變式，8 測試過
- ⚠️ 部署：需 `npm run db:push`（生產 DB ADD COLUMN is_demo/demo_expires_at、業主把關）
- 手動 e2e（部署後）：無痕視窗 template-market → 全 host 情境 →「立即體驗」→ 進大螢幕看互動 + 常駐 QR → 掃 QR 手機端玩 → 查 `games.is_demo=true` → 2h 後（或手動 runDemoCleanupNow）清除

## 已知限制 / 後續
- multi 情境不做匿名 demo（技術限制、UI 說明）
- 無 demo 種子假資料（訪客靠第二支手機掃 QR 玩）
- 無 demo 使用埋點（未來可加轉化統計）
- rate limit 10/hr/IP + 2h TTL；未做「每 IP 同時上限」

## 守紅線
schema 只加不刪、不動既有 instantiate admin 流程、demo 不進正式統計/配額。
