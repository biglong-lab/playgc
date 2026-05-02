# Phase 2 W6 D4 — Scenario QR 列印頁

**日期**：2026-05-02
**範圍**：W6 D4、新增 1 個 client 頁面 + 1 條路由 + Dialog 列印按鈕
**狀態**：🟢 W6 D4 完成、admin 可一鍵生成所有 QR codes 列印

---

## 🎯 目標達成

> Phase 2 W6 D2-D3 完成「一鍵建場」邏輯
> Phase 2 W6 D4 補上「列印 QR」 — admin 不用一個個複製 URL，可直接 A4 印好貼現場

---

## 📦 新增

### 1. 新頁面：`client/src/pages/ScenarioQrPrint.tsx`

**路徑**：`/admin/scenario-qr-print?data=<base64-encoded-json>`

**輸入**：URL query `data` 是 base64 編碼的 JSON：
```json
{
  "displayName": "婚禮派對情境包",
  "expiresAt": "2026-05-03T08:30:00.000Z",
  "instances": [
    { "axis": "host", "label": "拍立得紀念牆", "pageType": "host_polaroid_collage",
      "hostUrl": "/host/...?token=...", "playUrl": "/play/..." },
    ...
  ]
}
```

**功能**：
- 解析 base64 data → JSON
- 為每個 instance 產生 QR code（client side `qrcode` 套件）
- host 元件 → 兩張 QR（大螢幕 + 玩家）
- multi/solo/shared → 一張 QR（玩家入口）
- 每張 QR 一頁（CSS `page-break-after: always`）
- 列印優化：`@media print` 隱藏 toolbar、A4 邊距、列印底色
- 漸層底色依 axis 區分（藍/紫/綠/灰）

**列印格式**：
```
┌────────────────────────────────────┐
│   {displayName} · {N} / {total}    │
│                                    │
│        {元件名稱}                   │
│        {元件作用描述}               │
│        {URL 類型 emoji + label}    │
│                                    │
│           ┌──────┐                 │
│           │  QR  │                 │
│           └──────┘                 │
│                                    │
│        掃描或複製網址：             │
│        https://full.url/...        │
│                                    │
│        pageType: host_xxx          │
└────────────────────────────────────┘
                                  分頁
```

### 2. 路由註冊：`App.tsx`

```tsx
const ScenarioQrPrint = lazy(() => import("@/pages/ScenarioQrPrint"));
// ...
<Route path="/admin/scenario-qr-print" component={ScenarioQrPrint} />
```

### 3. Dialog 新增「列印 QR」按鈕：`TemplateMarketDetail.tsx`

```tsx
<Button onClick={() => openPrintPage(launchResult)}>
  <Printer /> 列印 QR
</Button>
```

`openPrintPage` 將 InstantiateResponse 編碼後 `window.open` 到 `/admin/scenario-qr-print?data=...`。

base64 編碼用 `btoa(unescape(encodeURIComponent(json)))` 處理中文字元。

---

## 💡 設計決策

### 為何 client side 產 QR 而不 server side？

選擇：用 `qrcode` 套件在 browser 產 base64 data URL

理由：
- server side 已用相同套件、無新依賴
- 不需 server roundtrip（admin 點按鈕後立即顯示）
- QR data 完全在 client 計算，不洩漏 hostToken 給 server log
- bundle size 增加可接受（qrcode 套件 ~30KB minified）

### 為何用 base64 encode 傳遞？

選擇：`btoa(JSON)` → URL query

理由：
- URL 直接傳 JSON 會有特殊字元問題（`{`、`"`、`,`）
- 婚禮模板 3 instances 約 600B base64 — URL 在限制內
- 避免額外建 sessionStorage / state management

### 為何不直接列印 Dialog？

選擇：另開新分頁列印

理由：
- Dialog modal 結構不適合 A4 列印（主頁仍在背後）
- 新分頁 = 乾淨的列印環境，可單獨儲存 PDF
- 列印後 admin 可保留分頁、隨時重新印
- 也可截圖貼到簡報、轉傳 LINE

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署目標：`https://game.homi.cc`
- E2E 端點驗證：
  - `/admin/scenario-qr-print` 200 ✅（W6 D4 新）
  - 既有 7 端點維持綠色

---

## ⏭ 下一步：W6 D5 — W6 收尾

- 撰寫 W6 完整收尾文件
- ShowcaseHub 補入 W6 D2-D4 的展示
- E2E 完整流程 walkthrough（admin → 一鍵建場 → 列印 QR → 投影 → 玩家掃 QR）

---

## 🔗 相關文件

- W6 D1：[2026-05-02-phase2-w6-d1-template-market.md](2026-05-02-phase2-w6-d1-template-market.md)
- W6 D2：[2026-05-02-phase2-w6-d2-scenario-instantiate.md](2026-05-02-phase2-w6-d2-scenario-instantiate.md)
- W6 D3：[2026-05-02-phase2-w6-d3-mixed-scenarios.md](2026-05-02-phase2-w6-d3-mixed-scenarios.md)
