# Phase 3 W9 D3 — 客戶 onboarding 文件包（業務工具完整化）

**日期**：2026-05-02
**範圍**：W9 D3、3 個 runbook 文件
**狀態**：🟢 W9 D3 完成、業務帶看 → 收費 → 建場 → 現場一條龍工具就緒

---

## 🎯 目標達成

> Phase 3 W9 D1-D2 完成 AI 內容生成 + 雙軌建場（純技術）
> W9 D3 補上業務工具 — 找客戶時直接拿來用、不用再想動線

---

## 📦 新增文件

### 1. `docs/runbooks/customer-onboarding.md`

**完整客戶接洽 SOP（30-60 分鐘）**：

| Step | 重點 | 時間 |
|------|------|------|
| 1 | 接洽 / 預約（含開場白 / 行前確認）| 10 分鐘 |
| 2 | 會面 / 帶看（Pitch + Wizard + 詳情頁）| 20 分鐘 |
| 3 | 收費 / 簽單（含 5 種規模建議價）| 10 分鐘 |
| 4 | 建場（admin 操作含 AI 預覽 / 失敗 fallback）| 5 分鐘 |
| 5 | 交付（給客戶用的 LINE / Email 模板）| 5 分鐘 |
| 6 | 活動當天 + 後續（前一天確認 / 即時支援 / 後續寄回顧）| 持續 |

**5 個紅線（不可違反）**：
- 不誇大、不亂報價、不繞過付款、不外洩 hostToken、不刪除既有資料

### 2. `docs/runbooks/customer-faq.md`

**5 大類 25+ 常見問題答案模板**：

- 業務 / 商業：是平台還是接案 / 跟坊間活動公司差別 / 退費 / 客製化
- 情境 / 玩法：混搭情境 / 跨日 / App / 匿名 / 隱私
- 技術 / 設備：投影機 / Wi-Fi / 斷線
- AI 客製內容：原理 / 編輯 / 失敗 / 成本
- 售後 / 緊急：資料保留 / 重複使用 / 案例 / 緊急電話

每題都有「直接複製貼上」格式答案、業務不用再想答案。

### 3. `docs/runbooks/event-day-cheatsheet.md`

**A4 一張小抄、業務帶現場列印用**：

- 開始前 30 分鐘檢查清單（設備 / 玩家測試）
- 多元件切換策略（婚禮 / 內訓 / ...）
- 5 大常見緊急狀況 + 解法
- 緊急聯絡人欄位（手寫填）
- 活動後即時動作 + 後續追蹤

設計重點：
- 列印格式：A4 一張、單面
- 不需要連網即可參考
- 緊急狀況快速決策（3 秒看完）

---

## 💼 文件協同關係

```
業務接到客戶詢問
    ↓
1. 看 customer-onboarding.md (帶看 SOP)
    ↓ 客戶問問題
2. 查 customer-faq.md (FAQ 答案)
    ↓ 客戶決定 → 收款 → 建場
3. 進 admin 用 scenario-launch.md (技術操作)
    ↓ 活動當天
4. 帶 event-day-cheatsheet.md (現場小抄) 到場
    ↓ 異常 → cheatsheet 自查 / LINE 求救
5. 活動後 → 寫案例（從 onboarding.md Step 6）
```

---

## 💡 設計決策

### 為何 3 個獨立文件而非 1 個大文件？

選擇：拆 onboarding + faq + cheatsheet

理由：
- 不同場景查不同文件（接洽前查 SOP、客戶問題查 FAQ、現場查 cheatsheet）
- 1 個大文件不適合列印（cheatsheet 必須單張 A4）
- FAQ 可獨立維護（依客戶實際問題追加）
- onboarding 是流程、FAQ 是知識、cheatsheet 是 emergency

### 為何 SOP 含「答案模板」而非「請依情況回答」？

選擇：直接寫好開場白 / 問題答案 / LINE 訊息範例

理由：
- 業務不一定每個都熟（新業務上線快）
- 有模板可避免「臨場答錯」
- 模板可持續優化（依客戶反饋更新）
- 模板不是死的、業務可依場合微調

### 為何 cheatsheet 設計成手寫填空？

選擇：留 4 個空格（服務商 LINE / 電話 / 場地 / 客戶緊急聯絡人）

理由：
- 現場用紙筆比看手機快
- 不依賴設備（手機沒電也能看）
- 視覺清晰（標題 / 表格分明）

---

## 🚀 部署 + Smoke Test

純文件 commit、不影響程式碼。

- TypeScript：N/A（無程式碼變動）
- Smoke test：25/25 維持綠色

---

## ⏭ 下一步：W9 D4-D5

- W9 D4：依實戰反饋微調 AI prompt（若 D3 真實接洽搜集到客戶意見）
- W9 D5：W9 收尾 + 第一場活動案例（若有真實客戶）

---

## 🔗 相關文件

- [客戶 onboarding SOP](../runbooks/customer-onboarding.md)
- [客戶 FAQ](../runbooks/customer-faq.md)
- [活動當天小抄](../runbooks/event-day-cheatsheet.md)
- [情境啟動 SOP](../runbooks/scenario-launch.md)
- [W9 D1 AI MVP](2026-05-02-phase3-w9-d1-ai-content-mvp.md)
- [W9 D2 AI 預覽 UI](2026-05-02-phase3-w9-d2-ai-preview-ui.md)
- [Phase 3 規劃](2026-05-02-phase3-plan.md)
