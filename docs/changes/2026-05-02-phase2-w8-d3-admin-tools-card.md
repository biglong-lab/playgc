# Phase 2 W8 D3 — AdminDashboard 平台工具快速入口

**日期**：2026-05-02
**範圍**：W8 D3、AdminDashboard 加 4 個工具入口卡
**狀態**：🟢 W8 D3 完成、admin 進後台即看到 W6-W8 全部工具

---

## 🎯 目標達成

> Phase 2 W6-W7 已建立完整工具鏈，但 admin 進後台時看不到入口
> Phase 2 W8 D3 補上 dashboard 整合 — admin 一進後台就看到「情境模板平台工具」卡

---

## 📦 改動

### `client/src/pages/AdminDashboard.tsx`

新增「情境模板平台工具」Card，放在 MetricCard 之後、WeeklyTrendChart 之前：

```tsx
<Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30">
  <CardHeader>
    <CardTitle>
      <Sparkles /> 情境模板平台工具
    </CardTitle>
  </CardHeader>
  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {/* 4 個入口卡 */}
  </CardContent>
</Card>
```

**4 個入口**：

| 卡片 | 連結 | 用途 |
|------|------|------|
| 🌟 情境模板市集 | `/template-market` | 12 個預組情境一鍵建場 |
| 📺 主控場次 | `/admin/host-sessions` | 進行中大螢幕 + QR 列印 |
| 🧭 3 問找情境 | `/find-scenario` | 推薦 Top 3 適合你的情境 |
| 🎤 客戶簡報頁 | `/pitch` | 帶客戶看的銷售工具 |

每個入口卡：
- icon（Sparkles / Tv / Compass / Presentation）+ 對應顏色
- 標題 + 一句說明
- hover 時邊框轉 primary
- 響應式：手機 2 欄、桌機 4 欄

---

## 💡 設計決策

### 為何放在 MetricCard 之後？

選擇：上方 4 個指標 → 平台工具 → 下方圖表 + 列表

理由：
- 上方指標是「現況概覽」，admin 一進來先看數字
- 平台工具是「我要做什麼動作」，緊接其後最自然
- 下方圖表 + 遊戲列表是「深入分析」，最後查看

### 為何 4 個工具卡而不是 3 或 5？

選擇：4 個（對應 W6-W7 主要產出）

理由：
- 情境市集（W6 D1）+ 主控場次（W6 D2-D4）+ 3 問 wizard（W7 D3）+ Pitch（W7 D4）
- 響應式 grid 對 4 個剛好（手機 2x2、桌機 4x1）
- 5 個會擠、3 個會少
- 第 5 個如「smoke test 結果」屬於監控，不適合 dashboard 入口

### 為何漸層 primary/5 → primary/10 底色？

選擇：輕微強調但不搶戲

理由：
- 與 dashboard 其他白色卡片區分
- 但不蓋過上方 MetricCard 的數字
- 與 FieldEntry 主頁業務入口的視覺風格一致（也是 primary 漸層）

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署：commit `256b362f` ✅
- Smoke test：24/24 通過 ✅

---

## ⏭ 下一步：W8 D4-D5

- W8 D4：Phase 2 整體收尾文件（W4-W8 五週路徑彙整）
- W8 D5：Phase 3 規劃啟動

---

## 🔗 相關文件

- [W8 D2 AdminHostSessions QR 列印整合](2026-05-02-phase2-w8-d2-admin-print-qr.md)
- [W8 D1 Smoke Test](2026-05-02-phase2-w8-d1-smoke-test.md)
- [W7 完整收尾](2026-05-02-phase2-w7-complete.md)
