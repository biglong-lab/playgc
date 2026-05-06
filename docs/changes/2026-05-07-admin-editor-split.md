# 軟分流階段 1：admin editor 分流 — 2026-05-07

> 範圍：Phase 2 B2 重新評估後的架構級重做（第一階段）
> 狀態：✅ 程式碼層 + e2e 完成
> 部署：尚未部署（待使用者明確指示）

---

## 背景

[next-action-guide.md](2026-05-07-next-action-guide.md) 列 Phase 2 B2「情境模板組合」為最高 ROI 任務。但接地調查 + 使用者反饋發現核心架構問題：

**遊戲 vs 活動本質衝突**：
- 路線 I（手機遊戲）：要 Firebase 登入、要組隊、長時間沉浸、賈村闖關
- 路線 II/III（活動現場）：玩家匿名掃 QR、單點互動、大螢幕配對、婚禮/破冰

但 admin editor 把 98 個 page_type 全混在一起、admin 拖入 host 元件建出來的 game 仍走「要登入」邏輯 → 客戶要的「現場掃 QR 立刻玩」做不到。

**決策**：軟分流（同 codebase、不同入口）+ 漸進式四階段
- 階段 1：admin editor 入口分流 ⚡ 本次
- 階段 2：玩家端入口分流（待）
- 階段 3：SCENARIO_TEMPLATES 重組（待）
- 階段 4：硬分流（如未來路線 II/III 要變獨立產品）

詳細討論：[architecture/three-paths.md](../architecture/three-paths.md)

---

## 影響範圍

| 模組 | 變動 |
|------|------|
| `shared/schema/games.ts` | 加 `editorModeEnum` + `games.editorMode` 欄位（NOT NULL DEFAULT 'game'）|
| `client/src/pages/game-editor/constants.ts` | 加 `EditorMode` type + `EDITOR_MODE_VISIBLE_CATEGORIES` + `EDITOR_MODE_INFO` + `filterPageTypesByEditorMode` helper |
| `client/src/pages/game-editor/components/ToolboxSidebar.tsx` | 接 `editorMode` prop、過濾 PAGE_TYPES、頂部 mode 標籤 |
| `client/src/pages/game-editor/index.tsx` | 帶 `game?.editorMode` 進 ToolboxSidebar |
| `client/src/components/game-wizard/GameWizard.tsx` | 加 `editorMode` prop、隨建立 mutation 一起傳 |
| `client/src/pages/AdminGames.tsx` | 兩個並排按鈕（建立遊戲 / 建立活動）+ filter UI（全部 / 🎮 遊戲 / 🎉 活動 / 含情境實例 toggle）|
| `client/src/pages/admin-games/useAdminGames.ts` | 加 `editorModeFilter` + `showScenarioInstances` state + filtered logic |
| `client/src/pages/admin/AdminHostSessions.tsx` | game select 過濾 editorMode='activity' + 排除 SCENARIO 實例 |
| `server/routes/scenarios.ts` | instantiateComponent 依 axis 自動設 editorMode（host → activity / 其他 → game）|
| `e2e/admin-editor-split.spec.ts` | 新增：DB schema + SCENARIO instantiate + 既有 API 向後相容 |

---

## 元件分流規則（嚴格、不留模糊地帶）

| Category | game editor | activity editor | 元件數 |
|----------|------------|-----------------|--------|
| 📝 narrative | ✅ | ✅ | 5（共用）|
| ✅ mission | ✅ | ❌ | 10 |
| 📷 photo | ✅ | ❌ | 7 |
| 👥 multi_coop | ✅ | ❌ | 13 |
| 📺 host_screen | ❌ | ✅ | 17 |
| 🎉 interactive | ❌ | ✅ | 46 |

```
🎮 game editor 看到 35 個元件     （narrative + mission + photo + multi_coop）
🎉 activity editor 看到 68 個元件  （narrative + host_screen + interactive）
🔄 共用：5 個 narrative
```

photo_team 等隊伍協作元件純放 game（要登入要組隊）。host_word_cloud 從 multi_coop 改 host_screen（屬第三軸不是隊伍協作）。

---

## 登入分流邏輯（自動、不需 admin 每次選）

```
admin 建 editor_mode='game' 的 game
   → 普通 session（hostMode=false）
   → QR Code → /f/:fieldCode/game/:gameId 或 /g/:slug
   → GamePlay（Firebase 登入、要組隊）

admin 建 editor_mode='activity' 的 game
   → admin 走 /admin/host-sessions 建 host_session（hostMode=true、簽 hostToken 12h）
   → 兩個 QR：
      ① 玩家用：/play/:sessionId → HostPlay（不登入）
      ② admin 用：/host/:sessionId?token=xxx → HostScreen（大螢幕）
```

---

## 實作步驟（10+ commits、hook 自動分批）

### 1.A — DB schema
- `shared/schema/games.ts` 加 editorModeEnum + editorMode 欄位
- 本地 dev DB ALTER TABLE 加欄位（NOT NULL DEFAULT 'game'）

### 1.B — API + SCENARIO 自動分流
- POST /api/admin/games 透過 insertGameSchema 自動接收 editorMode（向後相容）
- `server/routes/scenarios.ts` instantiateComponent 依 axis 自動設

### 1.C — AdminGames UI
- 兩個並排按鈕（🎮 建立遊戲 / 🎉 建立活動）
- editor mode filter（全部 / 遊戲 / 活動 + 含情境實例 toggle）
- 預設過濾 description 含 `[scenario:` 的 game

### 1.D — 元件分流 map
- `EDITOR_MODE_VISIBLE_CATEGORIES`：game = 4 類 / activity = 3 類
- `filterPageTypesByEditorMode` helper

### 1.E — ToolboxSidebar 過濾
- 接 editorMode prop、用 filter helper 過濾顯示
- 頂部 mode 標籤（🎮 / 🎉 + emoji + 描述）

### 1.H — host session 分流
- `AdminHostSessions` game select 過濾 editorMode='activity'
- 排除 SCENARIO 實例（已自動建好 session）

### 1.F+1.I — E2E
- `e2e/admin-editor-split.spec.ts`：3 個 test
- 黃金路徑 17 + A2 18 + Host 34 + 階段 1 分流 3 = **72/72 全綠**

---

## 驗證

### 自動 e2e（本地接地驗證）

```bash
ENABLE_E2E_HELPERS=true npm run dev
npx playwright test --grep "黃金路徑|A2 多人元件|Host 軸線|軟分流階段 1"
```

結果：72/72 ✅

### 待實機驗證（admin 自己跑）

#### admin editor 分流
- [ ] /admin/games 看到「🎮 建立遊戲」「🎉 建立活動」兩個並排按鈕
- [ ] /admin/games 看到 filter UI：全部 / 🎮 遊戲 / 🎉 活動 / 含情境實例 toggle
- [ ] 點「建立遊戲」 → wizard editorMode='game'
- [ ] 點「建立活動」 → wizard editorMode='activity'
- [ ] 進「遊戲」editor → ToolboxSidebar 看到 35 個元件、頂部「🎮 遊戲編輯器」標籤
- [ ] 進「活動」editor → ToolboxSidebar 看到 68 個元件、頂部「🎉 活動編輯器」標籤
- [ ] 確認 mission / multi_coop 元件不出現在 activity editor
- [ ] 確認 host_screen / interactive 元件不出現在 game editor

#### host session 分流
- [ ] /admin/host-sessions 只列出 editorMode='activity' 的 game（排除 SCENARIO 實例）

#### SCENARIO 自動分流
- [ ] /template-market instantiate 一個情境 → 看 build 出的 game 各自 editorMode 對

---

## 已知限制 / 後續優化

1. **舊 game 默認 editorMode='game'**：所有 113 個既有 game 走 game mode（含 SCENARIO 之前建的 host_session game）。如果舊 host_session game 想出現在 AdminHostSessions、需要手動改 editorMode='activity'
2. **GameEditor 頂部沒顯示 editorMode**：只有 ToolboxSidebar 有標籤、未來可加在頁面 header
3. **filter UI 沒持久化**：admin 重整後回到「全部」default、未來可存 localStorage
4. **wizard 沒對應 mode 的範本選擇**：StepSelectTemplate 仍顯示所有範本（不過濾 mode）→ 階段 3 跟 SCENARIO_TEMPLATES 重組一起做
5. **photo_team 在 activity 不可選**：但有些婚禮活動可能想用 photo_team → 客戶實際反饋出現再調

---

## 為什麼軟分流（不直接硬分流）

| | 軟分流（同 codebase）| 硬分流（兩個產品）|
|--|---------------------|-------------------|
| 修 bug | 改一處 | 改兩處 |
| DB schema | 共用 | 兩套 |
| 部署 | 一個 deployment | 兩個 |
| 客戶混搭場景 | 同 SCENARIO 跑兩個 session | 變獨立產品難整合 |
| 工作量 | 5.5 天 | 2-3 週 |
| 將來路徑 | 真要硬分流時再硬分 | 已分、退不回來 |

**軟分流 = 短期解決混亂 + 長期保留彈性**。

---

## 相關文件

- [三條路線架構](../architecture/three-paths.md)
- [next-action-guide](2026-05-07-next-action-guide.md)
- [A2 L3 驗證](2026-05-07-a2-l3-validation.md)
- [host 元件接 admin editor](2026-05-07-host-component-admin-integration.md)
- [ADR-0004 HostScreen 第三軸線](../decisions/0004-host-screen-axis.md)
- [ADR-0017 Loop 護欄](../decisions/0017-loop-mode-safeguards.md)
- [自動 e2e spec](../../e2e/admin-editor-split.spec.ts)
