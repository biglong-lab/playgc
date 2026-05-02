# Phase 5 W17 D2 — 公開 FAQ 頁

**日期**：2026-05-03
**範圍**：W17 D2（業務週工程備援任務）
**狀態**：🟢 W17 D2 完成、客戶可 self-service 看 14 個常見問題

---

## 🎯 目標達成

> W17 業務跑客戶、D2 工程同步補強客戶 self-service 工具
> 從「業務每次都要回答相同問題」→「客戶看頁面自助」

---

## 📦 新增

### 1. `client/src/pages/Faq.tsx`

公開 FAQ 頁、14 個問題分 7 大類：

| 類別 | 問題數 |
|------|--------|
| 活動規模 | 2 |
| 玩家體驗 | 2 |
| 資料保留 | 2 |
| 連線問題 | 2 |
| 客製化 | 2 |
| 收費 | 2 |
| 技術整合 | 2 |

**特色**：
- 互動展開 / 收合（一次只開一個）
- 分類顯示 + 顏色 indicator
- 底部 CTA：簡報 / 找情境 / 價格三個按鈕
- ChevronDown 展開圖示
- 完全 mobile-first

### 2. 路由 + PitchDeck CTA 更新

- `/faq` 路由註冊
- PitchDeck 底部加「常見問題」按鈕（cta-pitch-faq）
- 與 `/find-scenario` `/template-market` `/showcase` 並列

### 3. Smoke test 加 `/faq` 驗證

PUBLIC_PAGES 陣列加 `/faq`，smoke test 從 48 → 49。

---

## 💡 設計決策

### 為何 14 個問題（非 5 / 30）？

選擇：14 個（每類 2 題）

理由：
- 5 題：問題覆蓋不足、客戶仍會問業務
- 30 題：頁面太長、客戶滑不下去
- 14 題：每類 2 題剛好、覆蓋 80% 客戶問題
- 留空間給後續客戶反饋補（W17-W21 累積到 20+）

### 為何分類顯示而非 search？

選擇：垂直分類列表

理由：
- 客戶第一次看不知道要 search 什麼
- 分類讓客戶逛 → 看到自己沒想到的問題
- search 對 14 題太 overkill
- 未來題數 > 30 再加 search

### 為何展開 / 收合而非全部展開？

選擇：點擊展開、一次只開一個

理由：
- 全展開：頁面太長（14 題 × 200 字 = 2800 字）
- 全收合 + 展開：客戶聚焦在當下問題
- 一次只開一個：避免上下文混亂

---

## 🚀 部署 + Smoke Test

- TypeScript：零錯誤 ✅
- Vite + server build：成功 ✅
- Smoke test：48 → 49（新增 `/faq` 驗證）

---

## 📊 客戶 self-service 工具完整度（W17 D2 後）

| 工具 | 路徑 | 用途 | 階段 |
|------|------|------|------|
| Pitch 簡報 | /pitch | 完整介紹 | W7 D4 |
| 找情境 | /find-scenario | 三問配對 | W7 D3 |
| 模板市集 | /template-market | 12 情境瀏覽 | W6 D1 |
| 試玩 | /showcase | 元件實際操作 | W1 D5 |
| 價格 | /pricing | 三方案 | W10 D1 |
| API 文件 | /api-docs | 代理商整合 | W11 D4 |
| **FAQ** | **/faq** | **常見問題** | **W17 D2** |

業務角度：客戶 90% 問題不必業務介入 ✅

---

## ⏭ 下一步：W17 D3

備援工程任務（業務不需 hotfix 時）：
- W17 D3：Case Studies 頁（需累積 1-2 場真實案例後才有內容）
- 或 ROI 計算機（讓客戶估省下多少時間 / 增加多少互動）
- 或 admin 後台 UX 微調（依業務 D2-D3 反饋）

---

## 🔗 相關文件

- [Customer Pilot Runbook](../runbooks/customer-pilot.md)
- [Pilot Feedback Template](../runbooks/pilot-feedback-template.md)
- [ADR-0012 Phase 5 方向](../decisions/0012-phase5-direction.md)
- [W17 D1 客戶 pilot 啟動](2026-05-03-phase5-w17-d1-customer-pilot.md)
