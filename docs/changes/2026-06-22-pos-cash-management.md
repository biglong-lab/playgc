# POS 櫃檯現金管理 + 報表強化 + 權限矩陣 + RWD — 2026-06-22

> 範圍：POS 現金管理全套 / 報表 / 權限矩陣 / 手機 RWD / 時間 bug
> 狀態：🟢 部署上線（commit `9003dfa8`）
> 部署 commit 範圍：`ccb00a3a`（時間 bug）→ `9003dfa8`

## 背景
使用者要求：櫃檯現金上班清點/下班結算（面額張數統計）、隔日對帳、差異原因+通知管理員+確認、清帳取現金、現金納入報表、報表強化（管理員限定、本月/週/日+每日明細+drill-down）、權限管理矩陣、手機欄位遮蔽優化、今日小結日期錯誤（顯示前一天）。

## 解決方案（7 Phase）
1. **時間 bug**：`getTodayRange()` 回傳的 `date` 改用 Asia/Taipei 牆鐘日期，不用 `start.toISOString()`（UTC，凌晨會少一天）。修 `/api/pos/summary` + `/api/pos/dashboard`。
2. **Schema**：新增 `pos_cash_counts`（開班/收班清點，面額 jsonb、counted/expected/variance/確認）+ `pos_cash_drawdowns`（清帳）+ 權限 `pos_cash_admin`（開機 `ensure-pos-permissions.ts` idempotent 補）。
3. **現金 API**（`server/routes/pos-cash.ts`）：today/count/confirm/drawdown/history/summary。對帳算法：開班預期=上次下班點鈔−期間清帳；下班預期=開班+現金收−現金退−當班清帳；差異→通知群組+pending；確認(依紀錄/輸入調整)。
4. **現金前端**（`client/src/pages/pos/PosCash.tsx`）：面額清點即時統計、差異原因、清帳(cash admin)、差異確認、歷史；現場底部選單加「現金」(7 欄)。
5. **報表強化**（`admin-pos-reports.ts` + `PosReports.tsx`）：aggregateRange 加 drill-down(分類/付款/熱銷)、櫃檯現金納入報表卡與結帳 Telegram、報表端點 gate 改 `pos_cash_admin`。
6. **權限矩陣**（`client/src/pages/PermissionMatrix.tsx`）：角色×權限一覽即時開關，複用 GET roles/permissions + PATCH role；CommandPalette 入口。
7. **RWD**：`FloatingFontScale`/`FloatingBgmMute` 的 shouldHide 漏排除 `/pos` → 浮動字級器遮蔽 PosLayout header「後台」鈕，補上。

## 影響範圍
- 新檔：pos-cash.ts、ensure-pos-permissions.ts、PosCash.tsx、PermissionMatrix.tsx
- 改：pos.ts(export helper+date)、admin-pos-reports.ts、PosReports.tsx、PosLayout.tsx、App.tsx、CommandPalette.tsx、FloatingFontScale/BgmMute、pos-products.ts(schema)、seed.ts、index.ts

## 驗證
- 全程 Playwright 真瀏覽器 e2e（非單元測試）+ API 完整流程
- 對帳：清帳500→下班預期1500−500=1000 variance 0 ✓
- 權限矩陣切換 ""→"✓" + DB 寫入 ✓
- RWD：截圖確認 header 遮蔽消除 ✓
- 生產唯讀 e2e：cash/today 回正確日期 06-22、canCashAdmin true ✓

## 部署紀錄
- 生產建 `pos_cash_counts`/`pos_cash_drawdowns`（DB=gameplatform，非 postgres）
- `pos_cash_admin` 開機自動補 + 指派給 JIACHUN field_manager/field_director
- ⚠️ 生產 SSH 在 **port 52099**（非 22）

## 已知限制 / 後續
- 清點為「提醒不強制」
- super_admin 自動有全部權限；其餘由權限矩陣指派

## 相關文件
- [runbooks/db-migration.md](../runbooks/db-migration.md)
- [CHANGELOG.md](../CHANGELOG.md)
