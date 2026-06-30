# PWA 自動恢復韌性強化 + 6/29 結帳補登 — 2026-06-30

> 範圍：前端 PWA 恢復機制 / 部署流程 / POS 6/29 結帳　狀態：已修復（待部署）

## 背景

現場回報：PWA「很容易卡住，重新整理半天都不會恢復」，讓使用者以為系統壞掉。
另一筆 iPhone Safari `/admin` 錯誤回報：`TypeError: undefined is not an object (evaluating 'l._result.default')`（載入的是舊 bundle `index-BFj2bbWc`，生產已是新版）。

## 根因（三條疊加）

1. **`/api/version` 回 `unknown`** → 前端版本比對（`serverCommit==="unknown"` 直接 return）整個失效，PWA 永遠不主動更新。
   主因：`docker-compose.prod.yml` 用 `GIT_SHA:${GIT_SHA:-unknown}`，**手動 `docker compose up --build` 沒帶 GIT_SHA** 就變 unknown。`npm run deploy`（scripts/deploy.sh）本來就有注入，但繞過它手動部署就中招。
2. **一次性恢復 flag 永久卡死**：`chito_version_reloaded` / `pwa-auto-recovery-attempted` 只允許恢復一次。首次 reload 沒成功（SW/HTTP 快取殘留）就永久不再嘗試 → 使用者重整半天也不恢復。
3. **Safari React.lazy chunk 失敗漏偵測**：lazy chunk 載入失敗時 Safari 在 render 拋 `…._result.default` TypeError，訊息不符既有 chunk-error regex → 自動恢復不觸發，直接顯示死畫面。

## 影響範圍

- `client/src/main.tsx`：chunk error 偵測 + 版本比對恢復節流
- `client/src/components/ErrorBoundary.tsx`：偵測 + 恢復節流，移除重複 block
- 部署流程：一律用 `npm run deploy`（帶 GIT_SHA）

## 解決方案

- **偵測擴充**：`isChunkLoadError` 加入 Safari lazy `_result` 樣態（`/_result/` + `is not an object|Cannot read|undefined is not|null is not`），並補齊 `Importing a module script failed|module script failed|Load failed`。
- **恢復節流改時間窗**：新增 `canRecover(key)` — 5 分鐘窗內最多 3 次、每次至少間隔 15 秒，取代一次性 flag。允許反覆嘗試直到清乾淨，又不無限刷；超過 3 次才停手交給使用者手動「清除快取重新載入」。
- **部署注入 GIT_SHA**：確認 `scripts/deploy.sh` 已注入；本次改用 `npm run deploy` 部署，讓 `/api/version` 回真實 commit、版本比對機制復活。

## 6/29 結帳補登（POS 幽靈退款後續）

[ghost-refund 修復](2026-06-30-pos-ghost-refund-fix.md) 部署後，手動補登 6/29 每日結帳（endpoint 寫死只能結今天，依使用者指示不改 endpoint、改直接寫資料）：
- 動態照 settle 邏輯算：開班 12,782 + 現金收 1,098 − 退 0 = 預期 13,880 = 實點 13,880，**差異 0**、實際現金 **13,880**
- 寫入 `pos_daily_settlements`（id `1a87a1d7`）+ audit log（`manual_backfill`）
- 驗證：6/30 開班基礎已接成 13,880

## 驗證

`npx tsc --noEmit` 通過。部署後須確認 `curl https://game.homi.cc/api/version` 回真實 commit（非 unknown）。

## 已知限制 / 後續

- 自動恢復上限 3 次後停手是刻意設計（避免無限刷耗電）；超過會顯示「清除快取重新載入」按鈕。
- 根治「手動部署忘了 GIT_SHA」：未來一律 `npm run deploy`，勿手動 `docker compose up --build`。

## 相關文件

- [changes/2026-06-30-pos-ghost-refund-fix.md](2026-06-30-pos-ghost-refund-fix.md) · [runbooks/deploy.md](../runbooks/deploy.md)
