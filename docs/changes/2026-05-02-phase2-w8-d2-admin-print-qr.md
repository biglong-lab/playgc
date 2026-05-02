# Phase 2 W8 D2 — AdminHostSessions QR 列印整合

**日期**：2026-05-02
**範圍**：W8 D2、AdminHostSessions UI 強化
**狀態**：🟢 W8 D2 完成、admin 可從後台直接列印單一或全部 QR

---

## 🎯 目標達成

> Phase 2 W6 D4 完成 ScenarioQrPrint 列印頁
> 但 admin 在後台 `/admin/host-sessions` 看 active sessions 時、**不能直接列印**
> Phase 2 W8 D2 補上整合 — admin 可單張列印或全部批次列印

---

## 📦 改動

### `client/src/pages/admin/AdminHostSessions.tsx`

**新增 helper**：`openPrintPage(sessions, displayName)`
- 把 sessions 陣列轉成 `ScenarioQrPrint` 期望的 PrintData 格式
- 用相同 base64 編碼開新分頁到 `/admin/scenario-qr-print?data=...`
- 與 `TemplateMarketDetail` 用同一個列印頁，DRY

**UI 強化**：

1. **頂部「列印全部 QR」按鈕**：
   ```tsx
   <Button onClick={() => openPrintPage(sessions, `所有進行中場次（${n} 個）`)}>
     <Printer /> 列印全部 QR
   </Button>
   ```
   只在 sessions.length > 0 時顯示。

2. **每張 session 卡新增「列印」按鈕**：
   ```tsx
   <Button onClick={() => openPrintPage([s], s.gameTitle)}>
     <Printer />
   </Button>
   ```
   位於既有「結束場次」按鈕旁邊。

---

## 💡 設計決策

### 為何不另外建 endpoint？

選擇：直接複用 `/admin/scenario-qr-print` 列印頁

理由：
- 列印頁本身已支援任意 instance 列表
- 兩個入口（TemplateMarketDetail + AdminHostSessions）共用同一個工具
- 避免重複實作 QR 產生邏輯

### 為何「列印全部」放上方而非每張卡片重複？

選擇：頂部單一「列印全部」按鈕

理由：
- 批次列印的目的是「印一次貼整個會場」
- 重複按鈕視覺雜亂
- 對應「結束全部」這類批次動作的位置慣例

### 為何每張卡也要單獨列印按鈕？

選擇：保留單一卡片列印選項

理由：
- 過期或新建立的場次需要重印 QR（不影響其他場次）
- 不同場次的 QR 可能要分散貼在不同區域
- 玩家弄丟現有 QR 時可重印該場

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署：（即將）
- Smoke test 預期 24/24 通過（不影響既有路由）

---

## ⏭ 下一步：W8 D3-D5

- W8 D3：admin 後台首頁加情境市集 / pitch / smoke test 連結
- W8 D4：Phase 2 整體收尾文件
- W8 D5：Phase 3 規劃啟動

---

## 🔗 相關文件

- [W8 D1 Smoke Test](2026-05-02-phase2-w8-d1-smoke-test.md)
- [W6 D4 QR 列印頁](2026-05-02-phase2-w6-d4-qr-print.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
