# POS 品項系統 + 客製 + 銷售報表 — 2026-06-13

> 範圍：POS 大升級｜狀態：Phase1-3 已部署、Phase4 待部署

## 背景
POS 原本只記總金額(自由輸入),無品項/明細/客製 → 難詳細統計。升級為「選品項+客製→自動算總→記明細」+ 完整報表。

## 資料模型(6 新表)
pos_products(品項:類別food/goods/course、照片、價) / pos_modifier_groups(客製群組) /
pos_modifier_options(選項+加價) / pos_product_modifiers(品項↔群組) /
pos_transaction_items(交易明細+客製快照) / shift_closes(每日結帳)

## 後端
- admin-pos-products.ts:品項+客製 CRUD + 照片上傳 + 預設糖度/冰塊 + GET /api/pos/menu
- pos.ts checkout:接 items → 伺服器端用 DB 價重算(防竄改)→ 寫 line items
- admin-pos-reports.ts:每日銷售報表聚合(分類/付款/品項/客製) + 狀態總覽(預約/退款) +
  POST /api/pos/shift/close(結帳→寫 shift_closes→推 Telegram 群組)

## 前端
- /admin/pos-products:品項設定(三類別 CRUD + 客製管理)
- PosCheckout + PosItemPicker:選品項/自由金額切換、客製選擇、購物車
- /admin/pos-reports:每日報表 + 狀態 + 每日結帳按鈕
- POS 首頁加「品項設定/銷售報表」入口

## 部署
- Phase1-3(品項+結帳):已部署 commit a499224e,生產已建 6 表
- Phase4(報表+結帳):待部署(無新表,既有表即可)

## 驗證
tsc PASS、各頁 boot smoke 無崩潰、金額伺服器端重算

## 已知限制
- 報表聚合在 JS 端(每日資料量小、可接受);未來量大可改 SQL group by
- 課程品項可選填 activity_id 連結,但報名整合仍走既有 activities/bookings
