# 🎬 遊戲預覽模式 ROADMAP

> **聚焦範圍**：admin 預覽未發布遊戲、不污染統計、自由翻頁、AI mock + 上線實測機制
> **嚴禁擴散**：不做 Battle/Squad 預覽 / 不改 AI 元件邏輯本身 / 不重構 GamePlay 架構
> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **完成條件**：所有 [ ] 變 [x] → STATUS: ALL_COMPLETED → 停止 cron

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: DONE
CURRENT_TASK: -
LAST_UPDATE: 2026-05-01T10:55:00Z
TOTAL_PROGRESS: 17/18
```

## 📋 工作守則

1. 讀本檔找下一個未完成 task `[ ]`
2. **只做該 task**，嚴禁擴散
3. 完成標記 `[x]` + 更新「當前狀態」
4. 每 Phase 完成 commit + push（修生產才需部署）
5. 用既有元件 + Context（不重構 16 個遊戲元件）
6. AI 任務一律 mock 不實打 OpenRouter
7. 全部完成 → STATUS: ALL_COMPLETED → 不再 ScheduleWakeup

---

# Phase 1：基礎建設 🛠️

- [x] **P1-1** App.tsx 加路由 `/admin/games/:gameId/preview`（lazy import GamePreview + ProtectedAdminRoute 包覆 + 取 params.gameId 傳入）+ 建立 `client/src/pages/GamePreview.tsx` 骨架（useQuery 取 game + loading/error 處理 + Phase 階段提示）；TS check ✅
- [x] **P1-2** 建立 `client/src/contexts/PreviewContext.tsx`：`PreviewContextValue { isPreview, gameId }` + `PreviewProvider` 元件 + `usePreview()` hook；預設 `{ isPreview: false, gameId: null }` 確保正式遊玩流程不受影響；TS check ✅
- [x] **P1-3** 修改 `client/src/pages/game-editor/index.tsx`：「預覽」按鈕 `setLocation` 從 `/game/${gameId}` 改為 `/admin/games/${gameId}/preview`；TS check ✅；Phase 1 收尾 push `2e0e9886` ✅（無生產變更，等 Phase 5 完整功能再部署）

---

# Phase 2：UI 元件 🎨

- [x] **P2-1** 建立 `client/src/components/preview/PreviewBanner.tsx`：頂部 sticky amber banner（z-50 backdrop-blur）+ Eye icon + 「🎬 預覽模式 · {gameTitle}」+ 副標籤「不會記錄玩家資料 · 可自由翻頁 · ⚠️ AI 任務已 mock，上線後請實機測試」+ 退出按鈕（X icon）；data-testid: preview-banner / button-exit-preview；TS check ✅
- [x] **P2-2** 建立 `client/src/components/preview/PreviewNavBar.tsx`：底部 sticky 導航條（⏮ ChevronsLeft 第一頁 / ◀ 上一頁 / 中央「第 X / Y 頁」+ 跳頁 input / 下一頁 ▶ / ⏭ ChevronsRight 最後頁）+ 邊界 disabled（首/尾頁禁用）+ Enter 確認跳轉；6 個 data-testid 友善 E2E；TS check ✅；Phase 2 commit `f2b2e4d9` push ✅

---

# Phase 3：資料隔離 🚫

- [x] **P3-1** GamePreview 完整骨架：useState 維護 currentIndex（純 in-memory，不建 session）+ PreviewProvider 包覆樹（傳 isPreview + gameId）+ PreviewBanner 頂部 + PreviewNavBar 底部 + 中間先顯 page metadata（pageOrder/pageType/customName/config JSON）佔位等 P3-2 替換 GamePageRenderer；無 sessions API 呼叫；空 pages / load fail 都有 fallback；TS check ✅
- [x] **P3-2** 採用最小擴散策略：GamePreview 直接渲染 `<GamePageRenderer>`（不 mount GamePlay 整體）+ sessionId="" + onComplete 跳下一頁 + onVariableUpdate 純 in-memory（local useState） + score=0/inventory=[]/visitedLocations=[] 都用空值；下游元件嘗試呼叫 sessions API 因 sessionId 空會 404（不寫 DB），P3-3 處理 AI 元件 mock
- [x] **P3-3** AI 驗證 mock：在 `apiRequest` 全域攔截 4 個 AI endpoint（verify-photo / score-text / compare-photos / ocr-detect）+ 透過 `sessionStorage.previewMode='1'` 標記偵測 + 直接回 happy-path mock Response（含 success/passed/verified/detected/similar 各端點期望欄位）；GamePreview useEffect mount 時設、unmount 清；不擴散到 16 個元件；TS check ✅
- [x] **P3-4** 全域 mutation 攔截：apiRequest 加 `WRITE_ENDPOINT_PREFIXES`（sessions / locations / leaderboard / rewards / redeem-codes / player-feedback / matches）+ 只攔 POST/PATCH/DELETE（GET 不攔讓預覽能讀真實 game/page 資料）；preview 模式下這些 mutation 全部直接回 mock 200，0 個 元件被改；TS check ✅；Phase 3 push `084938df`

---

# Phase 4：上下頁邏輯 ⏭

- [x] **P4-1** 驗證確認：GamePreview 已在 P3-1+P3-2 階段實作完成 — useState(0) + onComplete `Math.min(prev+1, totalPages-1)` 只 clamp 邊界 + NavBar onJump 直接 setCurrentIndex；3 處無 resolveFlowRouter / condition / completedPageIds 檢查；自由翻頁完成 ✅
- [x] **P4-2** 鍵盤快捷：useEffect 註冊 keydown listener — Esc 任何時候退出 / ←→ 翻頁；isEditableTarget() 偵測 INPUT/TEXTAREA/SELECT/contentEditable 焦點時忽略 ←→（不干擾打字）+ e.preventDefault() 避免捲動；deps [gameId, setLocation, totalPages] 確保 totalPages 變化時 listener 取最新值；TS check ✅；Phase 4 push `6dcb8666`

---

# Phase 5：流程驗證 ✅

- [x] **P5-1** Smoke test 準備：取 baseline（sessions=0 / player_event_logs=24 / variant_feedback=5 / ai_usage_logs=90，含 test seed）；grep 確認 client mutation endpoint 全在攔截白名單；修正 `/api/player-feedback` → `/api/player/feedback` + 補 `/api/player/event` 實際路徑（伺服器是斜線分隔不是連字號）；TS check ✅；推 `cf27da5a`；P5-2 部署後請使用者實機跑一輪預覽，回 SQL 比對 baseline 應 0 增量
- [x] **P5-2** TS check ✅ EXIT 0 + push `402f338b` + 部署生產（Docker recreate）+ 主站 https://game.homi.cc HTTP/2 200 ✅ + 預覽路由 https://game.homi.cc/admin/games/test-id/preview HTTP/2 200 ✅；首次完整功能上線，使用者可實機測試

---

# Phase 6：AI 實測機制 🤖

- [x] **P6-1** 建立 `docs/AI_LIVE_TEST_CHECKLIST.md`：完整實機測試清單（測試前準備 + 7 種 AI 任務逐項表格化檢查 ✅/❌/⚠️ 路徑 / 共通確認項目（速度/UX/資料/Fallback）/ 紅燈條件 / 測試結束後流程）；給場域 admin 發布前用，每個遊戲走一輪
- [x] **P6-2** PreviewBanner 副標籤加「📋 實測清單」inline link → GitHub raw URL `biglong-lab/playgc/blob/main/docs/AI_LIVE_TEST_CHECKLIST.md`（target=_blank + ExternalLink icon + underline 高亮）；與既有「⚠️ AI 任務已 mock」串成完整提醒；data-testid: link-test-checklist；TS check ✅
- [x] **P6-3** 改最少擴散策略：在 GamePreview 層判斷 `AI_PAGE_TYPES.has(currentPage.pageType)` 條件式渲染 inline 黃底警告（border-l-4 amber + AlertTriangle icon + 顯示當前 pageType + link 到實測清單）；只動 1 個檔案（GamePreview.tsx），不擴散到 7 個遊戲元件本身（守則 7）；data-testid: ai-mock-warning；TS check ✅
- [x] **P6-4** 完整實作：(1) games schema 加 `lastLiveTestedAt: timestamp` (2) SQL ALTER TABLE 本地 ✅ + 生產 ✅ (3) admin-games.ts updateGameSchema 加 lastLiveTestedAt (z.coerce.date().nullable().optional()) (4) game-editor 加 markTestedMutation + 發布按鈕前加「標記已實測 / 已實測」按鈕（已測時 secondary variant + 綠色 CheckCircle2 + tooltip 顯示時戳；未測時 outline + 提示走 checklist）；不阻擋發布只提醒；TS check ✅；Phase 6 push `4b25fccd` + 部署生產 + HTTP 200

---

# 🏁 完成

- [ ] **DONE** 在本檔頂部寫 STATUS: ALL_COMPLETED + 停止 cron + 回報

---

## 預期產出

- ✅ 全新「預覽模式」路由 `/admin/games/:gameId/preview`
- ✅ 不污染任何統計表的安全測試環境
- ✅ 自由上下頁的設計者體驗
- ✅ 顯眼提醒「AI 已 mock」+ 實測 checklist
- ✅ 發布前提醒已實測（防上線後 AI 出包）
