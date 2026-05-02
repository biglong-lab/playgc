# Runbook — 用情境模板舉辦活動（Phase 2 W6）

> 給 admin / 客戶的「如何辦一場活動」操作手冊
> 適用：婚禮、園遊會、街區走讀、企業內訓、員工旅遊…
> 平均所需時間：5-10 分鐘（不含現場活動本身）

---

## 🎯 適用情境

11 個內建情境，全部支援一鍵建場：

| 分類 | 情境 |
|------|------|
| 交誼 | 婚禮派對 / 生日派對 / 同學會 |
| 活動 | 園遊會主舞台 / 破冰熱場 / 頒獎典禮（preview）|
| 公部門 | 街區走讀 / 商圈打卡（preview）|
| 私部門 | 企業內訓 / 員工旅遊（preview）|
| 空間 | 場域故事 |

---

## 🚀 完整流程（5 步驟）

### Step 1：選情境

訪問 [/template-market](https://game.homi.cc/template-market)

按 5 大分類瀏覽情境卡片，每張卡片顯示：
- 情境名稱 + 標語
- 預估玩家數 + 時長
- 含哪些元件（前 4 個元件 chips）
- 商業價值（收費區間）

點擊感興趣的情境進入詳情頁。

### Step 2：閱讀詳情頁

詳情頁 [/template-market/:id](https://game.homi.cc/template-market/wedding) 顯示：
- 情境完整描述
- 適用情境（具體舉例）
- 元件組合（依 axis 分類，每個元件可點「試玩」連結到 ShowcaseHub）
- 商業價值說明

確認情境符合你的場合。

### Step 3：Admin 一鍵建場

> 前提：已 admin 登入 + 帳號綁定場域

在詳情頁中段會看到綠色「Admin 一鍵建場」卡片：

點擊「立即建立 N 個元件實例」 → 後台會：
1. 為每個 host 元件建立：game + page + host_session（hostToken 12 小時有效）
2. 為每個 multi/solo 元件建立：game + page + publicSlug（玩家入口 `/g/<slug>`）
3. 結果 Dialog 顯示所有 instance 的 URL + breakdown

### Step 4：列印 QR

結果 Dialog 點「列印 QR」按鈕 → 另開新分頁到 [/admin/scenario-qr-print](https://game.homi.cc/admin/scenario-qr-print)

**列印頁特色**：
- 每張 QR 一頁 A4
- 漸層底色依 axis 區分（藍色大螢幕 / 紫色隊伍 / 綠色個人 / 灰色通用）
- 顯示：元件名稱 + 元件作用 + URL 類型 emoji + QR + 完整網址 + pageType

點頁面右上「列印」按鈕 → 系統列印對話框 → 可直接列印或儲存為 PDF。

### Step 5：現場執行

把 QR 印出後：
- **大螢幕主控 QR**（host 元件含「📺 大螢幕」QR）：
  - admin 在會場用筆電 / 主辦電腦掃 QR → 進 `/host/:sessionId?token=xxx`
  - 連到投影機，全螢幕投影
  - **注意**：含 hostToken，這張 QR 不要公開展示
- **玩家手機端 QR**（host 元件含「📱 玩家」QR）：
  - 公開貼在現場（接待桌、餐桌中央、攤位看板）
  - 玩家用手機掃 QR → 進 `/play/:sessionId`
- **multi/solo 玩家入口 QR**（內含「👥 玩家入口」QR）：
  - 同樣公開貼出
  - 玩家掃 QR → 進 `/g/:slug` → 走既有 game 流程（隊伍 / 個人）

---

## 🛡 安全與隔離

- **hostToken**：12 小時 TTL，過期需要重新一鍵建場
- **場域隔離**：建立的 game 自動屬於 admin 的 fieldId
- **super_admin** 可建在任何場域，否則 admin 必須有 fieldId
- **玩家**：不需登入就能掃 QR 進入

---

## 🎨 微調建議

預設 config 是「最小可玩」的範本（如 trivia 只有 1 題範例題）。
活動前 admin 可去 `/admin/games/<gameId>/edit` 微調：
- 婚禮：上傳新人合照、自訂祝福預設 emoji
- 街區：把預設 GPS 點換成你的場域實際座標
- 企業：把搶答題目換成內訓內容

---

## ⏱ 預估時間

| 任務 | 時間 |
|------|------|
| 選情境 + 看詳情 | 2-3 分鐘 |
| 一鍵建場 | < 5 秒（自動）|
| 列印 QR（5 個元件 = 約 7 張 A4）| 1 分鐘 |
| 現場張貼 + 設定大螢幕 | 5-10 分鐘 |
| **總計** | **10-15 分鐘** 即可開場 |

> 過去手動建場：admin 需 1 小時逐一建 game / page / 配 host session

---

## 🐛 常見問題

### Q: 點一鍵建場後 401 錯誤？
A: Admin session 過期 → 重新登入 [/admin/login](https://game.homi.cc/admin/login)

### Q: 「您的帳號未綁定場域」？
A: 請先有 admin 場域綁定（一般 admin），或 super_admin 直接建。

### Q: hostToken 12 小時不夠？
A: 重新一鍵建場（會建新的 game + session），或在 `/admin/host-sessions` 手動結束舊的後重建。

### Q: QR 印出來模糊？
A: 列印頁用 600px QR — 預設清晰。如果還是模糊，請改用 PDF 列印不要列印「縮放至頁面」，選原始大小。

### Q: 玩家掃 QR 後連不到？
A: 確認伺服器有 HTTPS、生產環境網址（game.homi.cc）正確。本機開發網址（localhost）QR 只能本機掃。

---

## 🔗 相關文件

- [Phase 2 W6 完整紀錄](../changes/2026-05-02-phase2-w6-complete.md)
- [W6 D1 TemplateMarket](../changes/2026-05-02-phase2-w6-d1-template-market.md)
- [W6 D2 Scenario Instantiate](../changes/2026-05-02-phase2-w6-d2-scenario-instantiate.md)
- [W6 D3 混合情境支援](../changes/2026-05-02-phase2-w6-d3-mixed-scenarios.md)
- [W6 D4 QR 列印頁](../changes/2026-05-02-phase2-w6-d4-qr-print.md)
- [Phase 2 W5 HostScreen 軸線完成](../changes/2026-05-02-phase2-w5-host-axis-complete.md)
