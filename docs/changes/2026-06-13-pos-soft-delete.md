# POS 全面軟刪除 + 刪除原因 + 垃圾桶 + 歷史 — 2026-06-13

> 範圍：POS 資料治理｜狀態：完成待部署

## 背景
使用者要求 POS 帳務/資料都能刪除但走「軟刪除」(進垃圾桶可還原)，刪除需填原因，
並完整紀錄增刪改的時間+操作者，方便日後查閱比對。

## 資料模型
4 表加軟刪除欄位 deleted_at / deleted_by / delete_reason：
pos_products、pos_modifier_groups、pos_modifier_options、pos_transactions

## 後端
- 品項/客製群組 DELETE → 改軟刪除 + **強制原因**(≥2字)；選項刪除原因選填
- 帳務交易 POST /api/pos/transactions/:id/delete → 軟刪除 + 強制原因 + audit
- 所有列表/選單/報表/儀表板查詢排除 deleted_at（不含已刪）
- 垃圾桶 GET /api/admin/pos/trash（品項/群組/交易）+ POST /api/admin/pos/restore 還原
- 歷史：全域稽核中介層已記操作者+時間+動作；每筆另存 delete_reason/deleted_by/deleted_at

## 前端
- PosProductsAdmin：刪品項/群組強制填原因(prompt)
- PosSummary：每筆帳務交易加刪除鈕(強制原因)
- PosTrash /admin/pos-trash：列已刪資料(原因/時間)+還原；POS 首頁加「垃圾桶」入口

## 需在生產 DB 跑（部署時）
4 表各加 deleted_at / deleted_by / delete_reason（見 /tmp/pos_softdelete.sql 同內容）

## 驗證
tsc PASS、端點 401、垃圾桶頁 boot smoke 無崩潰

## 已知限制
- shift_closes(結帳封存)暫不開放刪；預約用既有取消機制
- 還原品項不自動還原其客製關聯(關聯仍在、群組若也被刪需另還原)
