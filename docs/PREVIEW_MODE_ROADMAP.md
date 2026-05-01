# 🎬 遊戲預覽模式 ROADMAP

> **聚焦範圍**：admin 預覽未發布遊戲、不污染統計、自由翻頁、AI mock + 上線實測機制
> **嚴禁擴散**：不做 Battle/Squad 預覽 / 不改 AI 元件邏輯本身 / 不重構 GamePlay 架構
> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **完成條件**：所有 [ ] 變 [x] → STATUS: ALL_COMPLETED → 停止 cron

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: P1
CURRENT_TASK: P1-3
LAST_UPDATE: 2026-05-01T09:40:00Z
TOTAL_PROGRESS: 2/18
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
- [ ] **P1-3** 修改 `client/src/pages/game-editor/index.tsx`：「預覽」按鈕從 `/game/:gameId` 改為 `/admin/games/:gameId/preview`

---

# Phase 2：UI 元件 🎨

- [ ] **P2-1** 建立 `client/src/components/preview/PreviewBanner.tsx`：頂部固定 amber banner（🎬 預覽模式 + 遊戲名 + 不會記錄資料 + ⚠️ AI 已 mock + 退出按鈕）
- [ ] **P2-2** 建立 `client/src/components/preview/PreviewNavBar.tsx`：底部固定（⏮ 第一頁 / ◀ 上一頁 / 第 X / Y 頁 / 下一頁 ▶ / ⏭ 最後頁 / 跳到第 X 頁）

---

# Phase 3：資料隔離 🚫

- [ ] **P3-1** GamePreview 不呼叫 `POST /api/sessions`（不建 session）+ 用 in-memory state 模擬 sessionId='preview'
- [ ] **P3-2** GamePlay 元件 `apiRequest("PATCH"|"POST", "/api/sessions/...")` 全包 `if (!isPreview)` 跳過
- [ ] **P3-3** AI 驗證在預覽模式 mock 直接回 `{ success: true, confidence: 1.0 }`（不打 OpenRouter / Vision）
- [ ] **P3-4** 排行榜 / 獎勵發放 / 兌換碼消耗 / `/api/locations/.../visit` 在 preview 模式跳過

---

# Phase 4：上下頁邏輯 ⏭

- [ ] **P4-1** GamePreview 維護 `currentPageIndex` state，PreviewNavBar 按鈕直接 setIndex（不檢查 condition）
- [ ] **P4-2** 鍵盤快捷：← 上一頁 / → 下一頁 / Esc 退出（預覽限定）

---

# Phase 5：流程驗證 ✅

- [ ] **P5-1** Smoke test：admin 預覽一輪後 `SELECT COUNT(*) FROM sessions WHERE created_at > now()` 應為 0；同時 player_event_logs / variant_feedback / ai_usage_logs 也不增加
- [ ] **P5-2** TS check + commit + push + 部署 + 主站 200

---

# Phase 6：AI 實測機制 🤖

- [ ] **P6-1** 建立 `docs/AI_LIVE_TEST_CHECKLIST.md`：標準測試清單模板（含 7 種 AI 任務檢查項 + 確認項目）
- [ ] **P6-2** PreviewBanner 加「⚠️ AI 已 mock，上線後必須實測」+ link 到 checklist
- [ ] **P6-3** 在 photo_spot/photo_compare/photo_ocr/photo_mission/text_verify/choice_verify/conditional_verify 7 種 AI 元件渲染處，加 inline 黃底警告框（preview 模式才顯示）
- [ ] **P6-4** game-editor「發布」按鈕旁加「📋 已完成 AI 實測」checkbox（ToggleButton + games schema 加 `lastLiveTestedAt` timestamp）— 不阻擋發布只提醒

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
