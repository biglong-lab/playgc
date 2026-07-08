# 全站優化盤點與執行（第 1-4 批）— 2026-07-09

> 範圍：安全 / 穩定 / 效能 / 程式健康 全站
> 狀態：4 批全部執行完成、待部署
> 方法：三路盤點（即時健康數據 + 架構效能掃描 + 安全維運掃描），全部有 file:line 出處

## 背景

7/8 CHITO 11 項 bug 修完後，業主指示做全站優化盤點分析（/plan）。
對照基準：7/4 盤點（A1 依賴漏洞 / A2 測試債 / B1 icons 已完成）。

## 第 1 批：P0 安全

- **S1 IDOR ×2**：`GET /api/teams/:teamId/votes`、`GET .../score-history` 原本只驗登入
  → 任何登入者可讀他隊投票/分數。補 `requireTeamMember` middleware。
- **S2 統一驗證**：`isTeamMember` 原散落 5 檔各自複製（S1 就是漏網）
  → 抽 `server/lib/team-membership.ts` 單一事實來源，5 檔改 import。
- **S3 rate limit**：`aiLimiter` 定義了從未掛載 → 掛上 4 個 AI 端點；
  新增 `teamActionLimiter`（建隊/加隊/rejoin、30 次/5min/user）、
  `sessionCreateLimiter`（POST /sessions、30 次/10min/user）。

## 第 2 批：P1 穩定

- **M1 WS 記憶體洩漏**：`teamStateCache`/`teamMemberHistory`/`teamSessionIdCache`/
  `hostSessionStateCache` 只 set 不 delete → 加閒置回收（無連線 30 分鐘後清、
  10 分鐘掃一次；不能斷線即清 — 全隊換頁短斷線需要重連快照）。
- **M3 輸入驗證**：PATCH /progress 補 zod（score 0~100 萬/int、inventory ≤500、
  型別擋掉）、chat message 長度 1-1000、auth.ts fieldCode/email 型別防禦。
  scenarios.ts 既有 slice/toString 防禦 + admin-only → 判定可接受未動。
- **M2 N+1 查詢**：
  - `admin-multi-sessions` state 端點：S×T×4 次 DB 往返 → 4 次批次查詢 + JS 分組
  - `admin-rescue` stuck-players：每玩家 2 查詢 → 2 次批次
  - 判定不動：walkie（accessCode 重試迴圈、非 N+1）、player-chapters（低頻付費
    操作）、field-memberships（刻意逐一、防單人失敗串聯）

## 第 3 批：P2 效能

- **B3 refetchInterval 審查（58 處）**：結論 = 現況合理不硬改。
  5s 全是即時場景（live 監控/隊友位置/大廳）、10s 是多人同步必要、
  30-60s 儀表板可接受；TanStack 預設背景分頁不輪詢（refetchIntervalInBackground=false）。
- **B2 bundle**：主 bundle 647KB → **622KB** — `LobbyDesktopHero`/`UseOnMobileScreen`
  的 qrcode 靜態 import 在 Home 首屏鏈上 → 改動態載入。
  livekit 477KB 確認已是 dynamic import 自動分包（不在首載）→ 無需動。
  剩餘 622KB 為 app shell + 共用元件（無大型第三方殘留）、記為基線。

## 第 4 批：P3 程式健康

- **C2 useMyTeam hook**：7 個多人容器各自複製 my-team useQuery（複製漂移曾造成
  「有的頁有 refetch 有的沒有」的同步 bug）→ 抽 `shared/hooks/useMyTeam.ts`，
  淨 -47 行、查詢行為單一來源。
- **C1 拆大檔**：GamePlay.tsx **992 → 810 行** — 隊伍同步邏輯（my-team/自動
  rejoin/leader-decide/WS 訂閱/advance/跟隊跳頁）抽到
  `pages/hooks/useTeamPlaySync.ts`（289 行、行為不變純搬移）。
  **延後**：websocket.ts（1182+）與 Home.tsx（1123+）拆分 — 純健康債無行為
  bug，本批變更量已大，留待下批（避免與 CHITO 待複測項疊加風險）。

## 驗證

- tsc 通過、vitest **223 檔 3234 測試全綠**、`npm run build` 成功
- 新增測試：votes GET 403（IDOR）、team-rejoin/vote-eval 既有 24 例續綠

## 已知限制 / 後續

- websocket.ts / Home.tsx 拆分延後（>800 行紅線仍違規，下批處理）
- 依賴 9 vulnerabilities（0 high）需 breaking 升級、每月檢視
- >800 行違規總數 25 → 24 檔（scenarios.ts 3441 等低頻大檔照「碰到才拆」原則不動）

## 相關文件

- 前情：`2026-07-04-optimization-inventory.md`（A1/A2/B1）
- 多人修復：CHANGELOG 2026-07-08 條目
