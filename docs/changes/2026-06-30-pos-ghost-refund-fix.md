# POS 幽靈退款修復 + 退款防呆 — 2026-06-30

> 範圍：POS 銷售報表 / 櫃檯現金 / 今日小結　狀態：已修復（待部署）　部署 commit：（待補）

## 背景

現場 2026-06-29 回報 POS 結帳金額有誤：櫃台實際現金應為 **NT$13,880**，系統卻顯示 12,782（差 1,098）。

查證生產 DB 還原當天事件：店員處理「重複記帳」時操作混亂，當天建立 3 筆 1,098 現金交易：

| 時間(台北) | 交易 | 結局 |
|-----------|------|------|
| 17:52 | 第1筆（散客） | 18:00 被**退款** → 18:14 又被**刪除** |
| 17:56 | 第2筆（重複） | 18:14 刪除 |
| 18:15 | 第3筆（王司導） | ✅ 保留＝真實收入 |

收班點鈔兩次：17:48 數 12,782、**18:20 數 13,880（系統標溢 +1,098）**。店員自己數出來就是 13,880。

## 根因

退款（`refunds`）與刪除（`pos_transactions.deleted_at`）是兩條獨立路徑：對第1筆**先退款、後刪除**，產生一筆「幽靈退款」——退款記錄 status=completed 仍在，但其來源交易已軟刪除。

而報表/現金的退款加總**只看 `refunds.status='completed'`，從不回頭檢查來源交易是否已刪除**，於是憑空扣掉 1,098：
- 銷售報表淨收款 1,098 → 0
- 櫃台現金預期 13,880 → 12,782

## 影響範圍

- `server/routes/admin-pos-reports.ts`：`aggregateDaily` / `aggregateRange` / `status` 三處退款聚合
- `server/routes/pos-cash.ts`：`cashFlows` 現金退款聚合
- `server/routes/pos.ts`：`GET /api/pos/summary` 回傳每筆已退款金額 + 淨額
- `client/src/pages/pos/PosSummary.tsx`：今日小結改顯示淨額、已退款標記、退款二次確認

## 解決方案（A／B／C）

**C（核心）— 聚合層排除幽靈退款**：在四處退款 SUM 加 `REFUND_SOURCE_NOT_DELETED` 條件——當 `source_type='pos_transaction'` 且來源交易 `deleted_at IS NOT NULL` 時排除。既有錯誤資料**自動失效，不需手動改生產 DB**。

**B — 今日小結顯示淨額**：`/api/pos/summary` 新增 `totalRefundedCents` / `netPaidCents`；前端大字改顯示淨收款，有退款時並列「收 X · 退 Y」。

**A — 退款防呆**：每筆交易回傳 `refundedCents`；全額退款者顯示「已退款」標記＋金額劃線、退款鈕隱藏；退款前加 `confirm` 二次確認金額。退款後一併刷新報表/現金頁快取。

## 驗證

生產 DB 以修復後邏輯試算 6/29：舊退款 1,098 → **修復後 0**；當日收入 1,098。`npx tsc --noEmit` 通過。

修復部署後重開 6/29 報表預期：淨收款 1,098、下班結算/櫃檯實際現金 13,880（getCount 取最新收班 13,880）。

## 已知限制 / 後續

- 6/29 尚未做最終結帳（無 `pos_daily_settlements` 記錄）。部署後請對 6/29 結帳，此時 `computeExpected` 即時重算 variance=0、actualCash=13,880 成為隔日開班基礎。
- 18:20 那筆 closing count 記錄存的 `variance_cents=+1098` 為歷史顯示值，不影響結帳即時計算。
- 未做「刪除交易時連動作廢其退款」（C2），因聚合層排除已覆蓋所有計帳點且不影響垃圾桶還原邏輯，較安全。

## 相關文件

- [domains/pos（如有）] · [changes/2026-06-22-pos-cash-management.md](2026-06-22-pos-cash-management.md)
