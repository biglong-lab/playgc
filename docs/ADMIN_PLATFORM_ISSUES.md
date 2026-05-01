# 🐛 Admin + Platform 後台問題收集

> **用途**：P2/P3 smoke test 過程發現的問題集中於此，待 P4 統一修復
> **不直接修**：每個 issue 只記錄不修，避免邊測邊改干擾測試
> **格式**：嚴重度 / 頁面 / API / 觀察 / 建議

---

## 📊 統計

```
總問題數: 0
Critical: 0   (500 / 認證錯誤 / 路由註冊缺失)
High:     0   (404 endpoint / SQL 錯誤 / undefined 訪問)
Medium:   0   (loading state 缺失 / 錯誤訊息混雜)
Low:      0   (cosmetic / 中文化不統一)
Resolved: 0
```

## 🏷️ 嚴重度說明

| 級別 | 標準 | P4 處理優先序 |
|---|---|---|
| **Critical** | 完全無法運作（500 / 路由未註冊 / 無權限突破）| P4-2 |
| **High** | 功能不正常（404 / SQL 錯誤 / 使用者看到 undefined）| P4-3 |
| **Medium** | UX 不佳但功能可用（loading state 缺、錯誤訊息混雜）| P4-4 |
| **Low** | 美觀問題（顏色 / 間距 / 中英混雜）| P5（如時間允許）|

---

## 🚨 Critical 問題

> 必須優先修復 — 完全無法運作

_（尚無 issue，由 P2/P3 smoke test 填入）_

---

## 🔴 High 問題

> 功能異常 — 應修

_（尚無 issue，由 P2/P3 smoke test 填入）_

---

## 🟡 Medium 問題

> UX 缺失

_（尚無 issue，由 P2/P3 smoke test 填入）_

---

## 🟢 Low 問題

> Cosmetic

_（尚無 issue，由 P2/P3 smoke test 填入）_

---

## ✅ Resolved

> P4 修復後移到此處

_（尚無）_

---

## 📝 Issue 模板（複製到上方對應嚴重度區塊使用）

```markdown
### [Critical|High|Medium|Low] [#001] 簡短描述

**頁面**：`/admin/xxx` 或 `/platform/xxx`
**檔案**：`client/src/pages/...` 或 `server/routes/...`
**API**：`METHOD /api/...`
**觀察**：
  - 在做 X 時看到 Y（HTTP code / 訊息 / 行為）
  - 重現步驟：
    1. ...
    2. ...

**預期**：應該 ...
**實際**：發生 ...
**建議**：
  - 短期 fix：...
  - 長期改善：...

**P4 task**：[尚未指派 | P4-X]
```

---

## 🎯 P4 修復優先序（建議）

當 P2/P3 完成後，依以下順序處理：

1. **批次 1（P4-2 Critical）**：
   - 路由未註冊 → 加進 `routes/index.ts`
   - 500 錯誤 → 加 try/catch / fix SQL

2. **批次 2（P4-3 High）**：
   - 404 不存在的 endpoint → 確認 route registration
   - SQL 錯誤 → fix Drizzle query
   - undefined 訪問 → optional chaining / null check

3. **批次 3（P4-4 Medium）**：
   - 加 loading state（Skeleton / Loader2）
   - 中文化錯誤訊息（toast / Error throw）

---

**最後更新**：2026-05-01（P1-4 建立模板）
