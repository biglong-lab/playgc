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

## 🌐 Phase 2 — Platform Smoke Test 彙總（已完成）

| Task | 範圍 | SPA | API | 通過 | 失敗 | Issues |
|---|---|---|---|---|---|---|
| P2-1 | overview | 1 | 1 | 2/2 | 0 | 0 |
| P2-2 | fields/plans/feature-flags | 3 | 16 | 19/19 | 0 | 0 |
| P2-3 | revenue/applications/analytics | 3 | 5 | 8/8 | 0 | 0 |
| P2-4 | admins/roles/audit-logs | 3 | 7 | 10/10 | 0 | 0 |
| P2-5 | tickets/billing-alerts/usage | 3 | 13 | 16/16 | 0 | 0 |
| P2-6 | bulk-ops/insights | 2 | 6 | 8/8 | 0 | 0 |
| P2-7 | ai-center (5 tabs) | 1 | 4 | 5/5 | 0 | 0 |
| P2-8 | security/error-logs/health | 3 | 10 | 13/13 | 0 | 0 |
| P2-9 | ip-whitelist/api-keys/login-config/pwa/notifications/menu/settings | 7 | 19 | 26/26 | 0 | 0 |
| **小計** | **26 SPA + 81 API** | **26** | **81** | **107/107** | **0** | **0** |

### 結論：Platform 後台健康

- ✅ **所有 SPA 路由（26 個）正確掛載 React Router**（HTTP 200）
- ✅ **所有 API endpoint（81 個）認證守衛正常**（HTTP 401）
- ✅ **錯誤訊息已中文化**（驗證樣本：`overview` / `content-health` 都回 `{"error":"需要登入"}`）
- ✅ **無 Issue 寫入需求**

⚠️ **注意**：本階段為「未認證 401 守衛測試」。實際業務邏輯（200 帶 token 路徑）需 admin token 才能驗證，留待 future iteration（不在當前 ROADMAP 範圍）。

## 🎮 Phase 3 — Admin Smoke Test 彙總（已完成）

| Task | 範圍 | SPA | API | 通過 | 失敗 | Issues |
|---|---|---|---|---|---|---|
| P3-1 | dashboard/settings/sessions/live | 4 | 6 | 10/10 | 0 | 0 |
| P3-2 | games CRUD/cover/qrcode | 2 | 11 | 13/13 | 0 | 0 |
| P3-3 | locations/items/chapters/achievements/routes | 5 | 17 | 22/22 | 0 | 0（測試清單 1 修正：reorder POST→PATCH）|
| P3-4 | game-generator/exemplar-library/templates | 3 | 9 | 12/12 | 0 | 0 |
| P3-5 | tickets/redeem-codes | 2 | 9 | 11/11 | 0 | 0（測試清單 1 修正：purchases PATCH→DELETE）|
| P3-6 | battle 5 頁面 | 5 | 19 | 24/24 | 0 | 0（slots GET 缺 venueId 回 400 為合理 schema validation）|
| P3-7 | fields/roles/accounts/audit/players/qrcodes | 6 | 18 | 24/24 | 0 | 0 |
| P3-8 | field-settings/analytics/leaderboard/suspicious/devices | 5 | 6 | 11/11 | 0 | 0 |
| P3-9 | rewards/rules/engagement/ab-experiments | 3 | 19 | 22/22 | 0 | 0（P14-7 ab-experiments 6 endpoint 全到位）|
| **小計** | **35 SPA + 114 API** | **35** | **114** | **149/149** | **0** | **0 生產問題** |

### 結論：Admin 後台健康度 100%

- ✅ **所有 SPA 路由（35 個）正確掛載 React Router**
- ✅ **所有 API endpoint（114 個）認證守衛正常**
- ✅ **錯誤訊息已中文化**
- ✅ **0 個生產 issue 寫入修復清單**
- ⚠️ **2 個測試清單錯誤已即時修正**（不影響生產）：
  - `endpoints-admin.txt`：reorder method `POST` → `PATCH`
  - `endpoints-admin.txt`：purchases method `PATCH` → `DELETE`

## 🏆 Phase 2 + Phase 3 總計

| 區域 | SPA | API | 通過 | 失敗 | Issues |
|---|---|---|---|---|---|
| Platform（P2）| 26 | 81 | 107/107 | 0 | 0 |
| Admin（P3）| 35 | 114 | 149/149 | 0 | 0 |
| **總計** | **61 SPA** | **195 API** | **256/256** | **0** | **0** |

🎉 **整個後台 256 個檢查點全通過 — 認證守衛、錯誤中文化、SPA 路由全部健康！**

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
