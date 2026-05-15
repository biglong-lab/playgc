# Admin 頁面優化（A+B+C+D）+ 碎片數量同步 bug 修補 — 2026-05-16

> 範圍：4 個 admin 頁面 motion/a11y + 報告健康指標 + 拆檔 + #11/#12 碎片 bug
> 狀態：🟢 **已交付 + 部署上線**
> 部署：commits `8e14d8cc..c80d8a09`

---

## 背景

### A+B+C+D 來源
業主問 4 個 admin 頁面完整度：
- `/admin/component-health`
- `/admin/sessions`
- `/admin/multi-sessions`
- `/admin/reports`（是否有運作？）

盤點發現：
- AdminMultiSessions **1129 行**破 800 紅線
- AdminSessions 601 行接近上限
- session_reports 表 **6 天無新寫入**（5-09 後最近一筆）
- 4 個 endpoint 全部正常 401 守衛、頁面可載入

「reports 是否運作」結論：頁面健康但底層資料停止累積、根因是過去 7 天 `host_mode=true completed` session = 0（不是 bug、是沒素材）。

### 業主 5/15 問題清單 12 項中
- **#11 圖片碎片更動數量表面上不動但底下碎片欄會增加**
- **#12 文字碎片同上、但又馬上跳不見**

這是 5/13-14 業主大批回報的延續、已修過一次（commit `78d384e2`）但仍有 race condition。

---

## 影響範圍

### 新增檔案（3 個）
- `client/src/pages/admin/AdminMultiSessionsPlayerHistory.tsx`（180 行）— PlayerHistoryDialog 抽出
- `client/src/pages/admin/AdminMultiSessionsTimeline.tsx`（110 行）— MiniTimeline + TimelineEvent type 抽出
- `server/routes/admin-reports-health.ts`（90 行）— reports-health endpoint
- `docs/changes/2026-05-16-admin-pages-optimization-and-fragment-fix.md`（本檔）

### 修改檔案（7 個）
- `client/src/components/UnifiedAdminLayout.tsx` — `{children}` 包 motion（影響所有 admin 頁面）
- `client/src/pages/admin/AdminComponentHealth.tsx` — motion + role=region + aria-label
- `client/src/pages/admin/AdminReports.tsx` — motion + role + 無新報告 hint card（3 級嚴重度）
- `client/src/pages/admin/AdminSlaDashboard.tsx` — 新增 reports-health 卡（4 KPI + 嚴重度 badge + actionable hint）
- `client/src/pages/admin/AdminMultiSessions.tsx` — 1129 → 853 行（-276 行 / -24%）
- `client/src/pages/game-editor/ConditionalVerifyEditor.tsx` — 碎片數量 onChange race condition 修補
- `server/routes/index.ts` — 新 endpoint 註冊

---

## 解決方案

### A：admin 頁面 motion + a11y
- UnifiedAdminLayout 一次性在 `<main>{children}</main>` 包覆 `motion.div`、key=title 切換時各頁面獨立播放動畫
- AdminComponentHealth / AdminReports 個別補 `role="region"` + `aria-label`
- 影響面廣：所有 UnifiedAdminLayout-based 頁面自動取得 motion 切場

### B：AdminReports 無新報告 hint
- 新增 `latestReportInfo` useMemo 計算「最近報告距今天數」
- 3 級嚴重度 hint card：
  - `none`（0 報告）：藍色、提示 host_mode 多人活動 + 手動觸發工具
  - `warning`（> 3 天）：黃色
  - `critical`（> 7 天）：紅色 + cron 故障排查提示

### C：AdminMultiSessions 拆檔
- 抽出 PlayerHistoryDialog（含 2 interfaces、共 167 行）→ AdminMultiSessionsPlayerHistory.tsx
- 抽出 MiniTimeline（含 TimelineEvent type、共 105 行）→ AdminMultiSessionsTimeline.tsx
- 主檔 1129 → 853 行（仍超 800 紅線 53 行、顯著改善 / 待後續再抽 PlayerRow 或 SessionDetail）

### D：reports-health endpoint + SLA dashboard
- 新 endpoint `GET /api/admin/metrics/reports-health`
  - total / last7d / last30d / latestCreatedAt / daysAgo / severity
  - avgAnomaly / telegramSent7d / dailyTrend (last 7d)
- AdminSlaDashboard 新增整張卡顯示
  - 4 個 KPI（7d / 30d / 累計 / 距今天數）
  - 嚴重度 badge（健康 / 注意 / 嚴重 / 無資料）
  - critical 顯示 actionable hint「檢查 cron 或確認 host_mode 多人活動」

### #11/#12 碎片數量同步 bug
**根因**（race condition）：
```ts
// Before（壞）
onChange={(e) => {
  ...
  updateField("fragmentCount", count);        // call 1
  updateFragments(generateFragments(...));    // call 2 — 用 stale config 覆蓋 call 1
}}
```
兩個連續 setState 都用同一個 stale closure 的 `config`、第 2 個 spread `{...config, ...}` 把第 1 個剛寫的 fragmentCount 覆蓋回舊值。

**修補**：用 `updateFields` 一次 batch 寫所有變動
```ts
// After（修）
const newFragments = generateFragments(config.fragmentType || "numbers", count);
if (updateFields) {
  updateFields({
    fragmentCount: count,
    fragments: newFragments,
    ...(config.fragmentType !== "custom" ? { targetCode: newFragments.map(f => f.value).join("") } : {}),
  });
} else {
  // fallback：先 updateFragments（內部 batch）再 updateField（最後寫贏）
  updateFragments(newFragments);
  updateField("fragmentCount", count);
}
```

---

## 實作步驟（時序）

1. `c80d8a09..` 系列 — A：UnifiedAdminLayout motion + AdminComponentHealth + AdminReports motion
2. `...` AdminReports daysAgo + 3 級 hint
3. `...` admin-reports-health.ts endpoint + routes 註冊
4. `...` AdminSlaDashboard reports-health 卡
5. `...` AdminMultiSessionsPlayerHistory.tsx 新檔
6. `...` 主檔 import + sed 刪除 lines 859-1027
7. `...` AdminMultiSessionsTimeline.tsx 新檔
8. `...` 主檔 import + 刪 MiniTimeline section + 補回末尾 `}`
9. `c80d8a09` ConditionalVerifyEditor onChange race condition 修補
10. push + SSH pull + docker rebuild + 驗證

---

## 驗證

| 項目 | 通過條件 | 結果 |
|------|---------|------|
| tsc | 0 errors | ✅ 全程 0 |
| smoke | 51/51 | ✅ 多次驗證通過 |
| 接地驗證次數 | ≥ 5 次 | ✅ 6 次（Round 5/8/9 + 最終 + 修補後 + 部署後） |
| 生產 endpoint | 200 / 401 正常 | ✅ 首頁 200 / admin 200 / reports-health 401 守衛 |
| AdminMultiSessions 行數 | < 1000 | ✅ 853 行 |
| 碎片數量同步 | UI 與 DB 一致 | ⏳ 待業主驗證 |

### 業主驗證碎片 bug 步驟
1. 進 `/admin/games/{gameId}/pages` → 開「碎片收集」元件
2. 改碎片數量為 4 → 預期：輸入框顯示 `4`、碎片配置同步出現 4 個碎片
3. 改為 5 → 預期：出現 5 個
4. 改為 2 → 預期：碎片 4/5 刪掉、剩碎片 1/2 + 2/2
5. **按頂部儲存** → 重新整理後 fragmentCount 與最後設定一致

---

## 已知限制 / 後續優化

### 不在本批
- ❌ AdminMultiSessions 仍 853 行 > 800（再抽 PlayerRow 97 或 SessionDetail 88 可達標）
- ❌ AdminSessions 601 行未動（接近上限、未來再拆）
- ❌ 業主清單剩 10 項未動（RWD / PWA install / 過關按鈕 / 預覽模式 / 上一頁邏輯 等）
- ❌ session_reports 5-09 後無新報告的「真正解決」屬商業面（需新多人活動）、非技術

### 後續建議
- 業主 5/15 清單剩 10 項依優先序處理：
  - P0：#6 遊戲保留進度功能失效
  - P1：#5 道具名稱顯示 + #10 進度顯示 toggle
  - P1：#2 PWA install 通知 + #4 後台預覽元件無法下一步
  - P2：#1 RWD + #9 上一頁邏輯 + #7 #8 預覽模式新功能 + #3 按鍵重疊

---

## 相關文件

- [元件 audit Top 10 深度盤點](2026-05-15-component-audit-top10.md)
- [元件 audit follow-up](2026-05-15-component-audit-followup.md)
- [平台優化計劃 P0-P3 全包](2026-05-14-platform-optimization-comprehensive.md)
- [碎片圖切割可行性](2026-05-13-fragment-image-feasibility.md)
- [碎片圖切割實作](2026-05-13-fragment-image-implementation.md)
- [Session handoff](2026-05-14-session-handoff.md)

---

## 部署紀錄

| 項目 | 值 |
|------|-----|
| 本地 HEAD | `c80d8a09` |
| origin/main HEAD | `c80d8a09` |
| 生產 git HEAD | `c80d8a09` |
| 部署時間 | 2026-05-16 |
| Container 狀態 | gamehomicc-app-1 Running |
| 生產資源 | CPU 0.01% / MEM 30.90% |
| 部署檔案數 | 10 files +609/-285 |

---

## 狀態

🟢 **已交付 + 部署** — 等業主驗證 #11/#12 碎片 bug + 剩餘 10 項依優先序推進。
