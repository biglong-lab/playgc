# 🔍 Admin + Platform 後台全面盤點與 E2E ROADMAP

> **聚焦範圍**：現有功能驗證、優化、修復（不開發新功能）
> **嚴禁擴散**：不加新頁面、不加新 endpoint、不重構既有架構
> **執行模式**：/loop 自動化推進，2 分鐘間隔
> **完成條件**：所有 [ ] 變 [x] → 標記 STATUS: ALL_COMPLETED → 停止 /loop

---

## 📍 當前狀態（loop 每次必讀）

```
CURRENT_PHASE: P3
CURRENT_TASK: P3-3
LAST_UPDATE: 2026-05-01T07:30:00Z
TOTAL_PROGRESS: 16/30
```

## 📋 工作守則

1. 讀本檔找下一個未完成 task `[ ]`
2. **只做該 task**，嚴禁擴散
3. 完成標記 `[x]` + 更新「當前狀態」
4. 每 Phase 完成跑 commit + push（修 bug 才需部署）
5. 發現問題寫到 `docs/ADMIN_PLATFORM_ISSUES.md`（不修，留給 P4）
6. 全部完成 → STATUS: ALL_COMPLETED → 停止

---

## 🎯 範圍盤點（盤點結果）

| 區域 | 頁面 | 路由前綴 | API endpoint 數 |
|---|---|---|---|
| 場域 Admin | 28 | `/admin/*` | 70+ |
| 平台 Super Admin | 26 | `/platform/*` | 50+ |
| **小計** | **54 頁面** | | **120+** |

---

# Phase 1：E2E Smoke Test 基礎建設 🛠️

> 建立可重複跑的端點 smoke test 腳本（curl + jq，不引入 Playwright）

- [x] **P1-1** 建立 `scripts/e2e/smoke-test.sh`：bash 腳本（curl + status 檢查 + token Bearer header + 跳過註解/空行 + auth=yes+no-token 自動 SKIP + 失敗彙總；syntax check 通過 + chmod +x）
- [x] **P1-2** 建立 `scripts/e2e/endpoints-platform.txt`：81 個 platform endpoint（從 platform.ts + platform-ai-center.ts + platform-tickets.ts + revenue.ts + applications.ts 抽出 + 補齊 ai-center 4 個分多行的格式）；分 13 區塊（overview/fields/revenue/applications/analytics/admins/tickets/billing/ai-center/security/errors/system/ip-whitelist/notifications/menu）
- [x] **P1-3** 建立 `scripts/e2e/endpoints-admin.txt`：115 個 admin endpoint（從 22 個 admin-*.ts 檔抽出，含單行與多行 app.METHOD 格式）；分 14 區塊（公開/dashboard/games/pages-chapters-items/variants/modules/copilot/sessions/battle/fields-roles-accounts/rules-coupons/rewards-engagement-ab/walkie）
- [x] **P1-4** 建立 `docs/ADMIN_PLATFORM_ISSUES.md`：4 級嚴重度區塊（Critical/High/Medium/Low）+ Resolved 區 + 統計區（counts）+ Issue 模板（每筆：嚴重度/頁面/檔案/API/觀察/重現/預期/實際/建議/P4 task）+ P4 修復優先序建議（批次 1/2/3）

---

# Phase 2：Platform 後台 Smoke Test 🌐

> 對 26 個 platform 頁面 + 對應 endpoint 跑未認證 401 測試（驗證權限守衛）

- [x] **P2-1** Smoke test：`/platform`（dashboard）+ `/api/platform/overview` — SPA 200 ✅ / API 無 token 回 401 ✅ / 錯誤訊息已中文化「需要登入」✅；無 issue
- [x] **P2-2** Smoke test：fields / plans / feature-flags — 3 SPA 200 ✅ + 16/16 API 401 ✅（16 endpoint：fields 8 含 overrides+bulk / plans 4 / feature-flags 4）；無 issue
- [x] **P2-3** Smoke test：revenue / applications / analytics — 3 SPA 200 ✅ + 5/5 API ✅（revenue+transactions 401 / applications 401 / public POST /api/apply 400 缺 body / analytics 401）；無 issue
- [x] **P2-4** Smoke test：admins / roles / audit-logs — 3 SPA 200 ✅ + 7/7 API 401 ✅（admins 2 / roles 2 / permissions 1 / audit-logs 2）；無 issue
- [x] **P2-5** Smoke test：tickets / billing-alerts / usage — 3 SPA 200 ✅ + 13/13 API 401 ✅（tickets 6 含 messages / billing-alerts 2 / usage 5 含 by-endpoint/provider/meters/overview/top-fields）；無 issue
- [x] **P2-6** Smoke test：bulk-ops / insights — 2 SPA 200 ✅ + 6/6 insights API 401 ✅（overview/engagement/field-rankings/game-rankings/component-usage/daily-trend）；bulk-ops 用的 fields/bulk-* 已在 P2-2 測過避免重複；無 issue
- [x] **P2-7** Smoke test：ai-center — SPA 200 ✅（5 tab 同頁）+ 4/4 API 401 ✅（usage / health / content-health P15-5 / batch-generate-variants）；content-health 錯誤訊息中文化「需要登入」；無 issue
- [x] **P2-8** Smoke test：security / error-logs / health — 3 SPA 200 ✅ + 10/10 API 401 ✅（security 5 含 unlock-account / errors 3 含 resolve / health 2）；無 issue
- [x] **P2-9** Smoke test：ip-whitelist / api-keys / login-config / pwa / notifications / menu / settings — 7 SPA 200 ✅ + 19/19 API 401 ✅（ip-whitelist 4 / api-keys 1 / login-config 1 / pwa 1 / notifications 7 含 templates CRUD+logs+stats / menu 3 / settings 2）；無 issue
- [x] **P2-10** Phase 2 收尾：彙總 platform 測試結果到 ISSUES.md — 9 task 統計表（26 SPA + 81 API = 107/107 全通過 / 0 fail / 0 issue）+ commit + push

---

# Phase 3：Admin 後台 Smoke Test 🎮

> 對 28 個 admin 頁面 + 對應 endpoint 跑 401 測試 + 已認證 200 測試

- [x] **P3-1** Smoke test：dashboard / settings / sessions / live — 4 SPA 200 ✅ + 6/6 API 401 ✅（settings GET+PATCH / stats overview / tickets summary / sessions list+cleanup）；live 頁面主要走 WebSocket 故 API 部分由其他 task 涵蓋；無 issue
- [x] **P3-2** Smoke test：games CRUD + game-editor + cover/qrcode — 2 SPA 200 ✅ + 11/11 API 401 ✅（games CRUD 5 / publish / cover+cover-upload-url / qrcode GET+POST / grant-access）；無 issue
- [ ] **P3-3** Smoke test：locations / items / chapters / achievements / routes（5 個編輯器）
- [ ] **P3-4** Smoke test：game-generator / exemplar-library / templates（3 頁面）
- [ ] **P3-5** Smoke test：tickets / redeem-codes（2 頁面）
- [ ] **P3-6** Smoke test：battle/dashboard / venues / slots / rankings / seasons（5 頁面 10+ endpoint）
- [ ] **P3-7** Smoke test：fields / roles / accounts / audit-logs / players / qrcodes（6 頁面）
- [ ] **P3-8** Smoke test：field-settings / analytics / leaderboard / suspicious / devices（5 頁面）
- [ ] **P3-9** Smoke test：rewards/rules / engagement / ab-experiments（3 頁面，含 P14-7）
- [ ] **P3-10** Phase 3 收尾：彙總 admin 測試結果 + commit

---

# Phase 4：問題修復 🔧

> 處理 P2/P3 抓到的 issue（按優先序）

- [ ] **P4-1** 讀 ISSUES.md 分類（Critical / High / Medium / Low / Cosmetic）
- [ ] **P4-2** 修復 Critical 問題（500 / 認證錯誤 / 路由註冊缺失等）
- [ ] **P4-3** 修復 High 問題（404 endpoint / SQL 錯誤 / undefined 訪問）
- [ ] **P4-4** 修復 Medium 問題（loading state 缺失 / 錯誤訊息混雜中英）
- [ ] **P4-5** Phase 4 收尾：commit + push + 部署 + 驗證

---

# Phase 5：UX 優化 ✨

> 收尾統一性檢查（小幅優化，不重構）

- [ ] **P5-1** 統一錯誤 toast 中文化檢查（pages/platform 全部）
- [ ] **P5-2** 統一錯誤 toast 中文化檢查（pages/admin 全部）
- [ ] **P5-3** Phase 5 收尾 + 整體 commit + push + 部署 + 最終 E2E

---

# 🏁 完成

- [ ] **DONE** 在本檔案頂部寫 STATUS: ALL_COMPLETED，回報總結，停止 /loop

---

## 預期產出

完成後將獲得：
- ✅ `scripts/e2e/smoke-test.sh` 可重複跑的 smoke test 工具
- ✅ `docs/ADMIN_PLATFORM_ISSUES.md` 完整問題清單
- ✅ Critical / High 問題已修復
- ✅ 所有 platform / admin endpoint 認證守衛驗證通過
- ✅ Loading / Error UX 統一化

## 預期不做（嚴禁擴散）

- ❌ 不寫 Playwright 測試（守則 5 用 bash + curl）
- ❌ 不開發新頁面
- ❌ 不重構大型架構
- ❌ 不改變現有 API 簽名
