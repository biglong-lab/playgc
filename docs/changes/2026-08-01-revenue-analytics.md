# 營收報表分析中心 — 2026-08-01

> 範圍：`/admin/revenue` 從佔位頁改造為完整分析儀表板 + 修正 4 個計帳 bug
> 狀態：🟡 已完成開發與本機驗證，**尚未部署**
> Commit 範圍：`d505da37` → （本次最後一筆）

---

## 背景

使用者回報：「pos報表功能完整，但 https://game.homi.cc/admin/revenue 看起來是未完成的項目」。

實際檢查確認：該頁自己還掛著「Phase 3 建置中」的佔位提示（`RevenueOverview.tsx:141-149`），
只有 3 張靜態數字卡 + 2 張分類卡 + 4 個連結，**零圖表、零時間篩選、零項目維度**。

盤點過程中另外查出 4 個真實的計帳 bug（詳見下節），其中兩個會讓帳面數字直接錯誤。

---

## 🐛 查出並修正的計帳 bug

| # | 問題 | 後果 | 位置 |
|---|------|------|------|
| 1 | POS 用「分」、遊戲/對戰用「元」，直接相加 | **總收入被誇大 100 倍**（POS 收 NT$100 算成 NT$10,000） | `revenue.ts:94-102` |
| 2 | POS 統計未排除 `deleted_at` 軟刪除 | 已作廢交易仍計入營收（含活動切片） | 同上 |
| 3 | 完全沒扣 `refunds` | 營收虛高，與 POS 報表對不起來 | 同上 |
| 4 | `refunds.created_at` 是 timestamptz，卻用 naive 的轉換法 | 退款會被錯歸前一天 | 本次新寫的正規化層，開發中自檢發現 |

### 時區的兩種轉換法（踩過一次的坑）

DB timezone 是 `Etc/UTC`，naive `timestamp` 欄位存的是 UTC 當地值：

| 欄位型別 | 正確寫法 | 寫錯的後果 |
|---|---|---|
| `timestamp`（naive） | `(col AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei'` | 少一層 → 台北 00:00–16:00 錯歸前一天 |
| `timestamptz` | `col AT TIME ZONE 'Asia/Taipei'` | 多一層 → 同樣差一天 |

實測（UTC `2026-03-10 02:00` = 台北 10:00，正解 `03-10`）：

```
naive 雙層 → 2026-03-10 ✅ ｜ tz 雙層 → 2026-03-09 ❌ ｜ tz 單層 → 2026-03-10 ✅
```

### ⚠️ 連帶發現：POS 報表也有同一個時區 bug（尚未處理）

`admin-pos-reports.ts` 對 naive 的 `pos_transactions.created_at` 只做單層轉換，
會把**台北 00:00–16:00 的交易全部歸到前一天** —— 也就是白天營業黃金時段
在每日結帳報表中錯歸前一日。

本次**刻意沒動它**：那是使用者認為「功能完整」且天天在用的頁面，
修它會改變既有數字，需先確認再處理。對帳 SQL 已備妥（見下方驗證章節第 ②③ 段）。

---

## 🔑 關鍵設計決定：預約不是獨立收入源

原本規劃把「預約付款」當成第 4 個收入來源，查證後推翻：

- `pos.ts:916` 是**全系統唯一**會把 booking 標記為 `paid` 的位置，
  收款時同步寫入 `bookings.paidAt / paidAmountCents / paymentStatus`
- 線上金流 webhook（`webhook-recur.ts`）**完全沒有**寫這些欄位

所以 `bookings.paidAmountCents` 與 `posTransactions` 是同一筆錢的兩次紀錄，
列入營收 = **重複計算**。

**結論**：實際金流源是 3 個（POS / 遊戲 / 對戰）；預約降為維度，
以 `posTransactions.bookingId` 切分「預約收款 vs 散客現場」。

---

## 影響範圍

### 新增
```
server/lib/revenue-facts.ts              營收計算的唯一基準（278 行）
server/lib/revenue-aggregations.ts       趨勢/維度/明細/熱力圖聚合（666 行）
server/routes/revenue-analytics.ts       5 個分析端點（301 行）
server/__tests__/revenue-facts.test.ts        真實 DB 整合測試 10 項
server/__tests__/revenue-aggregations.test.ts 真實 DB 整合測試 14 項
e2e/revenue-analytics.spec.ts            真實瀏覽器 e2e 8 項 ×2 裝置
client/src/pages/revenue/analytics/      7 個前端模組（最大 267 行）
```

### 修改
```
server/routes/revenue.ts       overview 改用正規化層（修 bug 1-3）
server/routes/index.ts         註冊 analytics 路由
client/src/pages/revenue/RevenueOverview.tsx   佔位頁 → 分析儀表板
client/src/index.css           新增 viz 色板 CSS 變數
```

所有檔案 ≤ 800 行（最大 666）。**無 schema 變更**。

---

## API

| 端點 | 用途 |
|------|------|
| `GET /api/revenue/analytics/summary` | KPI + 環比（`compare=prev`） |
| `GET /api/revenue/analytics/timeseries` | 趨勢（日/週/月粒度，空桶補零） |
| `GET /api/revenue/analytics/breakdown` | 7 種維度排行（Top N 外歸「其他」） |
| `GET /api/revenue/analytics/transactions` | 跨源明細（CSV 匯出用） |
| `GET /api/revenue/analytics/heatmap` | 星期 × 小時（回滿 7×24 格） |

共同規則：`requireAdminAuth` + `game:view` + `fieldId` 場域隔離；
Zod 驗日期格式；區間上限 400 天防大範圍掃表；金額一律回「分」。

---

## 圖表設計（依 dataviz 規範）

| 圖表 | 形式 | 為什麼 |
|------|------|--------|
| 營收趨勢 | 來源堆疊柱 + 退款負值柱 | **單一 Y 軸**；累計線刻意不畫（與每期金額尺度差太多，雙 y 軸是最典型的圖表錯誤），累計改在 KPI 呈現 |
| 來源占比 | 甜甜圈 3 片 | 恰好是色板通過 all-pairs CVD 驗證的槽數上限 |
| 項目排行 | **單色**橫條 | 維度動輒 10+ 項，多色必然產生無法辨識的相鄰對；改由軸標籤 + 條末數值區分 |
| 時段熱力圖 | 順序色（單一藍色相） | 連續量用順序色，絕不用類別色或彩虹色 |

### 色板驗證結果（`validate_palette.js`，非目測）

```
亮色（surface #ffffff）：all-pairs CVD ΔE 9.2、normal-vision 24.0 → ALL PASS
深色（surface #16181d）：all-pairs CVD ΔE 9.4、normal-vision 20.9 → ALL PASS
```

一個 WARN：亮色 `--viz-3` 對白底 2.82:1（< 3:1）→ 依 relief 規則，
每個圖表都提供**表格檢視**與可見數值標籤，顏色不是唯一資訊來源。

### 為什麼只開 3 個類別色槽

第 4 槽起（黃↔橘）無法通過 all-pairs 門檻。這是刻意的限制，
不是偷懶 —— 超過 3 類的維度一律改用單色橫條。

---

## 驗證

### 自動化
- `server/__tests__/revenue-facts.test.ts` — 10 項全綠（幣別、跨日邊界、軟刪除、幽靈退款、區間）
- `server/__tests__/revenue-aggregations.test.ts` — 14 項全綠（補零、月粒度、7 維度、Top N、share）
- `e2e/revenue-analytics.spec.ts` — 16 項全綠（桌機 + 手機，真實瀏覽器）
- 完整測試套件：**3310 passed**，未破壞既有測試
- `npx tsc --noEmit` 全綠

用真實 DB 而非 mock：幣別、時區、軟刪除全寫在 SQL 裡，mock 掉等於沒測。
CI 無 `DATABASE_URL` 時 `skipIf` 自動跳過，不製造假紅燈。

### 本機接地驗證（截圖確認）
API 回傳 NT$91,950 / 210 筆 ↔ 畫面 KPI 完全一致。
看截圖後修掉 3 個版面問題：KPI 數字折行、來源占比圖例被壓成直排單字、
最短長條的數值標籤被 recharts 折行。

### 生產對帳（待執行）
對帳 SQL 已備妥，輸出 4 段：①舊vs新數字對照 ②POS 時區 bug 影響筆數
③最近 7 日歸屬日對照 ④預約是否重複計算。**唯讀，不改資料。**

---

## 已知限制 / 後續

1. **POS 報表時區 bug 未修** —— 需先跑對帳確認影響再決定（見上方 ⚠️ 段）
2. **修正後帳面數字會下降** —— 原本的值是錯的（虛高），需以對帳表向使用者說明
3. **`.light` class 是死碼**（既有問題，非本次造成）——
   `useTheme` 只操作 `.dark` class，但 `index.css` 用 `:root`(深色) + `.light`(亮色)，
   沒有任何程式碼會加上 `.light`，因此亮色模式的 CSS 變數實際上不生效。
   本次 viz 色板跟隨專案同一機制（同樣定義在 `.light`），未來修好會一起生效。
4. 對戰金額由 `battleSlots.pricePerPerson` fallback 到場地設定推算，非實收金額
5. 遊戲 / 對戰目前沒有退款關聯，退款全數歸屬 POS

---

## 相關文件

- [CHANGELOG](../CHANGELOG.md)
- [POS 報表現況](../../server/routes/admin-pos-reports.ts)
- 計算基準單一來源：`server/lib/revenue-facts.ts`（改動營收計算請一律從這裡開始）
