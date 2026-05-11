# 元件自癒 — Phase 2 of 5（5 Phase 穩定性計畫）— 2026-05-12

> 範圍：元件級 ErrorBoundary + Stuck detection hook + API retry helper
> 狀態：✅ 完成、tsc 0 / smoke 51/51 / ADR-0018 通過

## 1. 業主需求對應

> 「元件監測自我紀錄方便修復甚至是可以自我修復」

5 Phase 計畫：
- ✅ Phase 1：元件健康度紀錄（5/12 上線）
- ✅ **Phase 2：元件級 ErrorBoundary + 自癒（本次）**
- ⏸ Phase 3：體感升級（Skeleton / Toast / 友善 error）
- ⏸ Phase 4：Feature flags + 自動降級
- ⏸ Phase 5：合成監測（Playwright cron）

## 2. 完成清單

### 2.1 `ComponentErrorBoundary`
**檔案**：`client/src/components/game/ComponentErrorBoundary.tsx`

class component（React ErrorBoundary 必須）：
- `componentDidCatch` 自動 `reportClientEvent` 上報（含 stack + componentStack）
- 通知父層 `onError(error)`（給 Phase 1 telemetry 標 finalState='errored'）
- UI：「重試」「跳過此題」「回報」三按鈕
- 「重試」：用 errorKey state 強制 unmount + remount 子元件（清狀態重新跑）
- 「跳過」：呼叫 `onSkip()`（通常 `onComplete({ points: 0 })`、繼續下一頁）
- 「回報」：開 mailto 給玩家手動發 email（不打擾 game flow）

### 2.2 `GamePageRenderer` 包裝
**檔案**：`client/src/components/game/GamePageRenderer.tsx`

在 `renderPage()` 外層包：
```tsx
<ComponentErrorBoundary
  componentType={page.pageType}
  sessionId={sessionId}
  pageId={page.id}
  onSkip={() => wrappedOnComplete({ points: 0 }, undefined)}
>
  {renderPage()}
</ComponentErrorBoundary>
```

→ **單個元件 throw 不影響整場遊戲**、玩家可自救（跳過 / 重試）。

### 2.3 `useStuckDetection` hook
**檔案**：`client/src/hooks/useStuckDetection.ts`

監聽：
- pointerdown / keydown / touchstart / scroll
- visibilitychange（page hide 不算、回來算互動）

60 秒（可調 thresholdMs）無互動 → 觸發 `onStuck()` + 自動 `reportClientEvent("stuck_detected")` 含完整 context。

用法：
```ts
const stuck = useStuckDetection({
  onStuck: () => setShowStuckDialog(true),
  thresholdMs: 60_000,
  componentType: "lock_coop",
  sessionId, userId, pageId,
});
stuck.reset(); // 元件可手動 reset（如 timer tick 不算互動）
```

注意：本次只寫 hook、未整合到具體元件。元件作者選擇性接（如 LockCoop / Trivia 需要時）。

### 2.4 `apiRequestWithRetry` helper
**檔案**：`client/src/lib/api-retry.ts`

包裝 `apiRequest`：
- 5xx 自動 retry（最多 3 次、exp backoff 500ms → 5s + jitter）
- 4xx 不 retry（業務錯誤）
- network error / abort 視為 retry-able
- 全部失敗 `reportClientEvent("api_retry_exhausted")`

用法：
```ts
const res = await apiRequestWithRetry("POST", "/api/foo", body, {
  retries: 3,
  componentType: "trivia_showdown",
  onRetry: (attempt) => tele.reportRetry(),
});
```

注意：本次只寫 helper、未替換現有元件的 apiRequest 呼叫。元件作者選擇性換（穩定性敏感的 mutation 可換）。

## 3. 驗收
- ✅ tsc 0
- ✅ smoke 51/51
- ✅ ADR-0018 通過
- ✅ ComponentErrorBoundary 全包 60+ 元件（透過 GamePageRenderer）

## 4. 業主能感受到的改變

| 情境 | 改前 | 改後 |
|------|------|------|
| 某元件 throw error | 整頁壞掉、玩家被卡住 | 友善 error UI + 跳過 / 重試 |
| API 偶發 5xx | mutation 失敗、玩家手動重試 | 自動 retry 3 次（exp backoff） |
| 玩家卡住不動 60s | 系統不知道 | 自動上報、可選顯示「卡住了？」dialog（待元件接 hook） |
| 開發團隊 debug | 看 console 找錯 | error 自動進 ws_event_log / Sentry / Phase 1 telemetry（finalState=errored）|

## 5. 後續可選整合（不在本次範圍）

- 元件接 `useStuckDetection`（如 LockCoop / Trivia）+ 顯示「卡住了？」dialog
- 元件 mutation 換 `apiRequestWithRetry`（敏感 mutation 優先：trivia answer / score update）

下次 Phase 3 體感升級時可一起處理。

## 6. 相關文件
- [Phase 1 元件健康度](2026-05-12-component-telemetry.md)
- [5/12 12 項 bug 批 1](2026-05-12-bug-batch-1.md) / [批 4](2026-05-12-bug-batch-4.md)
- [Session Handoff](2026-05-12-session-handoff.md)
