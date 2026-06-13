# POS 優化批次:餐飲營運包 + 交易完整度 + 報表強化 — 2026-06-13

> 狀態:完成待部署

## A 餐飲營運包
- 售完:pos_products.sold_out;品項設定一鍵切供應中/售完;結帳菜單售完不可點+後端擋
- 整單折扣:pos_transactions.manual_discount_cents+discount_reason;結帳填折抵+原因
- 臨時品項:結帳加非目錄品項(自訂名/價)→ line item(productId null)

## B 交易完整度
- B1 收據:結帳成功頁顯示品項/客製/折扣/合計(可截圖給客人)
- B2 退款:POST /api/pos/transactions/:id/refund(現金、記 refunds 表、支援部分退款累計);
  PosSummary 交易加「退款」鈕。原交易保留、退款記入退款報表

## C 報表強化
- 每日報表:加退款/淨額(netCents=total-refunds)+時段分析(byHour)
- 新增區間報表 GET /api/admin/pos/reports/range(本週/本月)+每日明細
- PosReports 顯示淨收款/退款/時段/週月

## 需在生產 DB 跑(部署時)
ALTER TABLE pos_products ADD COLUMN IF NOT EXISTS sold_out boolean NOT NULL DEFAULT false;
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS manual_discount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS discount_reason text;
(refunds 表已存在,B2/C 無新表)

## 驗證
tsc PASS、各端點 401、報表/結帳/品項頁 boot smoke 無崩潰
