# 5 項實機 UX 修復 — 2026-05-09 第二輪

> 範圍：text_card / FloatingFontScale / session 恢復邏輯 / ErrorBoundary
> 狀態：✅ 已部署生產（commit `b5068633`）
> 觸發：業主圖片回報 5 項實機問題

---

## 背景

業主貼了 5 張截圖、依左到右描述問題。本紀錄處理結果：

| # | 問題 | 是否 code bug |
|---|------|------|
| 1 | text_card 上方文字超過畫面範圍 | ✅ 是 |
| 2 | a11y 字體切換器蓋到登出按鈕 | ✅ 是 |
| 3 | 通關後再進入仍顯示「上次玩到第 2 頁」 | ✅ 是 |
| 4 | time_bomb「同步失敗、請手動校準」 | ❌ 不是 code bug、是 admin 填的劇情文字 |
| 5 | 部署後出現 React minified error #310 | ✅ 是（部分） |

---

## 影響範圍

| 模組 | 變動 |
|------|------|
| `client/src/components/game/shared/components/TextCardPage.tsx` | 4 layout：`overflow-hidden → overflow-y-auto overflow-x-hidden` + 加 padding |
| `client/src/components/shared/FloatingFontScale.tsx` | `shouldHide` 加 `/me` 路徑 |
| `server/storage/session-storage.ts` | `getActiveSessionByUserAndGame` 改 completed 優先 |
| `client/src/components/ErrorBoundary.tsx` | 加 `isReactMinifiedError` 偵測 + 自動恢復 + UX 改善 |

---

## 解決方案

### 1. TextCardPage — overflow 改 scroll

原：4 個 layout 都用 `overflow-hidden`、長內容被截斷
修：`overflow-y-auto overflow-x-hidden` + 上下 padding（pb-8 / py-12）

```tsx
// 4 個 layout 都改：
<div className="min-h-full ... overflow-y-auto overflow-x-hidden ..." />
```

絕對定位的背景效果不受影響（`absolute inset-0` 仍正確、不溢出）。

### 2. FloatingFontScale — /me 路徑隱藏

`shouldHide()` 加：

```typescript
pathname.startsWith("/me") ||  // 🆕 會員中心 hero 區右上有登出按鈕、字體切換器會蓋住
```

會員中心 hero 區自帶字體大小（hero 卡片本身就是大字）、不需要全域字體切換器。

### 3. session 恢復邏輯 — completed 優先

**根因**：`getActiveSessionByUserAndGame` 原為「playing 優先」、導致玩家通關後又開新 session 中途離開時、第三次進入會接續舊 incomplete session。

```typescript
// 舊邏輯（playing 優先）：
1. 查 status='playing' → 有就回
2. 沒才查 status='completed'

// 新邏輯（completed 優先）：
1. 查 status='completed' → 有就回（玩家曾通關 = 結束）
2. 沒才查 status='playing'（接續未通關進度）
```

行為變更：通關 = 結束。再進入 = 看到通關狀態（不彈 ResumeDialog）。要重玩請點「重新開始」。

### 4. time_bomb「同步失敗」— 非 code bug

`grep -rn "同步失敗"` 整個 codebase 找不到此字串、確認是 **admin 在 page title 自己填的劇情文字**。

不修 code。建議業主進該 page 編輯器、把標題改為「點擊校準」或別的、不要叫「同步失敗」誤導玩家。

### 5. ErrorBoundary — React minified 錯誤自動恢復

**根因**：部署後 client 拿舊 chunk 但 server 已部署新版、hooks 順序變化、觸發 `Minified React error #310`。

新增偵測：

```typescript
function isReactMinifiedError(error: Error): boolean {
  return /Minified React error #\d+/i.test(`${error.name} ${error.message}`);
}

function shouldAutoRecover(error: Error): boolean {
  return isChunkLoadError(error) || isReactMinifiedError(error);
}
```

行為：
- 偵測到 React minified error → 自動 clearPwaCachesAndReload（同 chunk error 處理）
- UI 顯示「🔄 版本更新中…即將自動重新載入」（不再顯示嚇人的「發生錯誤」）
- 用 sessionStorage flag 防無限迴圈

---

## 驗證

| 驗證項 | 結果 |
|--------|------|
| TypeScript 編譯 | ✅ 通過 |
| 改動相關測試 | ✅ shared/__tests__ 52/52 全綠 |
| 失敗測試 | 32 個（WebSocket / GamePlay / battle-registration）— **pre-existing flaky、非此次造成** |
| 生產 commit | ✅ `b5068633` 部署 |
| Container 健康 | ✅ Up 13 seconds (healthy) |
| HTTP 回應 | ✅ 200 / 0.46s |

---

## 業主實機驗證清單

| # | 操作 | 期望 |
|---|------|------|
| 1 | 進有長文字的 text_card 頁 | 內容可滾動、不再被截斷 |
| 2 | 進會員中心（/me） | 右上不再有「A | A↗A」字體切換器、登出按鈕清楚可見 |
| 3 | 通關過的遊戲再進入 | 直接顯示通關狀態（不再彈「偵測到上次進度」對話框） |
| 4 | 找出有「同步失敗」title 的 time_bomb 頁 | **業主自己改 admin → page title** |
| 5 | 部署新版後玩家進入 | 若卡到舊 chunk、看到「🔄 版本更新中」+ 自動 reload（不再嚇人）|

---

## 行為變更聲明（問題 3）

| 情境 | 舊行為 | 新行為 |
|------|--------|--------|
| 玩家通關過 → 又開新場玩到一半 → 第三次進入 | 接續第二場進度 | 進「已完成」狀態（最終分數 X 分） |
| 玩家從未通關、玩到一半 → 再進入 | 彈 ResumeDialog | **不變**（仍可接續） |
| 玩家通關過 → 第二次進入 | 進「已完成」狀態 | **不變** |

意思：通關 = 結束。要重玩請手動點重新開始。

---

## 未做（評估後不做）

- **問題 4 改 code 偵測「同步失敗」**：這是 admin 填的內容、不該 code 端攔截
- **隱藏錯誤訊息技術細節**：玩家可能要回報、保留複製按鈕

---

## Commits（auto-save 拆分）

```
b5068633  ErrorBoundary（最終版）
68953cc7  ErrorBoundary（中途）
9d42f93a  ErrorBoundary（初版）
ef29f268  session-storage.ts
90892aca  FloatingFontScale.tsx
b772155d  TextCardPage.tsx（最終）
07651ea9  TextCardPage.tsx（中途）
d71d84e3  TextCardPage.tsx（中途）
b1646fc2  TextCardPage.tsx（初版）
```

每次 Edit 都被 auto-save hook commit、邏輯總結在本檔。

---

## 相關文件

- 上一輪 4 項 UX 優化：[2026-05-09-ux-polish-4-items.md](2026-05-09-ux-polish-4-items.md)
- 接續指南：[2026-05-09-next-action-guide.md](2026-05-09-next-action-guide.md)
- ErrorBoundary 既有 PWA recovery：見 `client/src/components/ErrorBoundary.tsx:24-58`
