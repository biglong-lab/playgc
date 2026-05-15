# 變動紀錄索引

> 每個大型 feature / refactor 一份檔案，含背景、實作、驗證、回顧。
> 命名：`{YYYY-MM-DD}-{topic}.md`，**寫完不改**（修錯字除外）。

---

## 2026-05

- 🟢 [2026-05-16 — 業主 5/15 問題清單批次處理 8/12](2026-05-16-owner-feedback-batch.md) — #2 PWA iOS + #5 道具下拉 + #7 #8 預覽過關 + #9 訪問 stack + #10 進度 toggle
- 🟢 [2026-05-16 — Admin 頁面優化 A+B+C+D + 碎片 bug 修補](2026-05-16-admin-pages-optimization-and-fragment-fix.md) — 4 admin 頁面 motion/a11y + AdminMultiSessions 拆檔 + reports-health endpoint + #11/#12 race condition 修
- 🟢 [2026-05-15 — 元件優化 follow-up 立即/本週批次](2026-05-15-component-audit-followup.md) — console + 情境 + 4 元件 a11y 已交付 + 剩餘 pattern 給業主
- 🟢 [2026-05-15 — 遊戲元件 Top 10 深度盤點分析](2026-05-15-component-audit-top10.md) — 5 維度 × 10 元件 / 80+ 具體建議 / 修補工時估
- 🟢 [2026-05-14 — 平台全站優化計劃 P0-P3 全包](2026-05-14-platform-optimization-comprehensive.md) — 三週路徑 / 商業閉環 + KPI 校準 + 紅線自動化 + 文件層（**已交付 + 部署上線**）
- 🟡 [2026-05-02 — 多人遊戲元件平台 12 週路徑](2026-05-02-multiplayer-component-platform.md) — 38 新元件 + 4 大平台基建（**進行中**）
- [2026-05-02 — Squad 系統一次到位](2026-05-02-squad-unification.md) — teams/battle_clans/squads 三套合一
- [2026-05-01 — PWA 流程優化](2026-05-01-pwa-flow.md) — Phase A-D 完整推進

## 2026-04

- 2026-04-30 — 多場域隔離稽核（待補）
- 2026-04-19 — 16 個遊戲元件最佳化（待補）

## 2026-03

- 2026-03-23 — 庫存管理工具 v1.3.0（密碼洩漏修復、DB 遷移）（待補，獨立專案）

---

## 撰寫模板

新增變動紀錄時複製此模板：

```markdown
# {主題} — {YYYY-MM-DD}

> 範圍：{N 個 commit / N 個檔案}
> 狀態：{進行中 / 已完成 / 已部署}
> 部署：{commit hash 範圍}

## 背景

{為什麼做這個？是 bug / 需求 / 技術債？引用使用者反饋或截圖原話}

## 影響範圍

{改了哪些檔案 / 模組 / 端點 / DB 表}

## 解決方案

{核心做法摘要 — 跟 ADR 不同，這裡寫「實作」不寫「為什麼選這個」}

## 實作步驟

{時序列出每個 commit 做了什麼，連結到 commit hash}

1. `{hash}` 步驟一
2. `{hash}` 步驟二

## 驗證

{怎麼確認改完是 OK 的？實機測試項目 / 監控指標}

## 已知限制 / 後續優化

{完成度、留下的 TODO、之後可能要補的東西}

## 相關文件

- ADR：[decisions/{N}-{topic}.md]
- 領域文件：[domains/{topic}.md]
- 影響的 runbook：[runbooks/{op}.md]
```
