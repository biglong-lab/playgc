# 真實客戶反饋彙整

> 真實業主 / pilot 客戶反饋的 single source of truth
> 與 `admin-platform-issues.md` 互補：本檔記錄真實使用者聲音、後者記錄內部測試發現問題
> 與 `runbooks/pilot-feedback-template.md` 互補：本檔彙整、後者是新 pilot 的填寫模板
> 最後更新：2026-05-14

---

## 目的

把散在 `docs/changes/` 與對話紀錄中的業主真實聲音結構化、可查可分析。

**不是**：
- ❌ 技術 bug 清單（→ `admin-platform-issues.md`）
- ❌ 設計討論（→ `decisions/`）
- ❌ 修補實作（→ `changes/`）

**是**：
- ✅ 客戶口頭 / 訊息 / 螢幕截圖原話
- ✅ 對應的修補追蹤狀態
- ✅ 趨勢與分群（哪類客戶在意什麼）

---

## 統計快照（持續更新）

| 維度 | 數值 |
|------|------|
| 累計 pilot 場數 | _待補_ |
| 累計 unique 業主數 | _待補_ |
| 結構化反饋筆數 | _初稿建檔中_ |
| 高頻反饋 top 3 | _待第一輪盤點後填_ |

---

## 已知真實業主聲音（依時序）

### 2026-05-13 ~ 2026-05-14（碎片設定大批回報日）

**來源**：[changes/2026-05-13-fragment-image-implementation.md](../changes/2026-05-13-fragment-image-implementation.md) / [changes/2026-05-13-fragment-image-feasibility.md](../changes/2026-05-13-fragment-image-feasibility.md) / [changes/2026-05-14-session-handoff.md](../changes/2026-05-14-session-handoff.md)

| 反饋類型 | 業主原話/觀察 | 影響元件 | 處理狀態 |
|----------|---------------|----------|----------|
| 功能缺口 | 「碎片設定切割不對」 | conditional_verify 碎片 | ✅ 已修（commit `78d384e2`）+ 待業主驗證 |
| UX 問題 | 進行中卡片缺繼續按鈕 | dashboard 卡片 | ✅ 已修（`415645a2`） |
| UX 問題 | 右上按鈕重疊 | admin 工具列 | ✅ 已修（`31d0453c`） |
| 預覽異常 | 預覽拍照 400 | conditional_verify 預覽 | ✅ 已修（`415645a2`） |

### 2026-05-12（業主大批回報 — bug-batch 系列）

**來源**：[changes/2026-05-12-bug-batch-1.md](../changes/2026-05-12-bug-batch-1.md) / [changes/2026-05-12-bug-batch-5.md](../changes/2026-05-12-bug-batch-5.md)

待從原檔提取結構化 entry（**TODO 下一輪補**）。

### 2026-05-10（多人遊戲穩定性與觀測）

**來源**：[changes/2026-05-10-multi-leader-stability.md](../changes/2026-05-10-multi-leader-stability.md) / [changes/2026-05-10-observability-suite.md](../changes/2026-05-10-observability-suite.md)

待補。

### 2026-05-09（UX 拋光批次）

**來源**：[changes/2026-05-09-ux-polish-5-items.md](../changes/2026-05-09-ux-polish-5-items.md) / [changes/2026-05-09-pwa-rwd-optimization.md](../changes/2026-05-09-pwa-rwd-optimization.md)

待補。

---

## 高頻關鍵字（盤點中）

從上方 entry 提取的反覆出現主題（**初稿**）：

1. **碎片系統** — 切割行為、預覽、儲存（5/13-14 批次集中爆發）
2. **dashboard 進行中卡片** — 多次提到 UX 不順
3. **admin 編輯器 stale closure** — 修補後仍出現過、需驗證

---

## 商業 KPI 對應（5/14 一次性快照）

| 指標 | 數值 | 來源 |
|------|------|------|
| 業主活動 7 天完成率 | **9.5%** 🚨 | [session-handoff](../changes/2026-05-14-session-handoff.md) |
| 業主活動放棄率 | **47.5%** 🚨 | 同上 |
| ErrorBoundary 次數 | 30（React #310 占 27 已修） | 同上 |
| Failed to fetch chunk | 45 次（自動恢復中） | 同上 |

**重要**：本檔不分析「為什麼」— 那是 W1 完成率歸因 endpoint + dashboard 的工作（[本批計畫](../changes/2026-05-14-platform-optimization-comprehensive.md)）。

---

## 新增反饋的方式

### 即時記錄（業主當下回報時）

1. 把客戶原話貼到本檔對應日期段
2. 標註元件 + 處理狀態（待修 / 修補中 / 已修 / 已驗證）
3. 連結到對應 commit / change 檔

### Pilot 完整反饋（業務跑完一場活動）

1. 用 `runbooks/pilot-feedback-template.md` 複製到 `changes/2026-XX-XX-pilot-feedback-<客戶>.md`
2. 填完後，把摘要 + 連結加進本檔
3. 高頻關鍵字段更新

---

## 相關文件

- [admin-platform-issues.md](admin-platform-issues.md) — 內部測試發現的 SPA/API 問題
- [business-metrics.md](business-metrics.md) — MRR / 付費客戶 SOT（下一輪建檔）
- [business-model.md](business-model.md) — 商業模式統合（待建檔）
- [runbooks/pilot-feedback-template.md](../runbooks/pilot-feedback-template.md) — 新 pilot 反饋模板
- [runbooks/customer-pilot.md](../runbooks/customer-pilot.md) — pilot 執行 runbook

---

## 狀態

🟡 **初稿建檔中** — 5/13-14 已結構化、5/12 / 5/10 / 5/9 三批 TODO 在下次推進補。
