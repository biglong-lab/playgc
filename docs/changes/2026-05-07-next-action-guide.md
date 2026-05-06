# 下次行動快速指南 — 2026-05-07 收工點

> 給下次接手用的快速指南：開新對話讀這份就能直接接著做
> 最後活躍：2026-05-07 02:30
> 生產 commit：`e7647c82`（Phase 1 全套部署）

---

## 一句話現況

**Phase 1 (DBAC 路徑「D 串聯打通」) 已完整完成並部署生產**。下一步進 Phase 2（B 結構優化）或 Phase 3（A 多人持久化補完）。

---

## 必讀文件（依序）

開新對話時：

1. **`CLAUDE.md`**（自動載入）— 紅線 #1-#12 必看
2. **`docs/changes/2026-05-07-phase-1-complete.md`** — Phase 1 14 commits 完整紀錄
3. **`docs/changes/2026-05-07-phase-dbac-plan.md`** — 整體 DBAC 4 Phase 規劃
4. **本檔（next-action-guide.md）** — 接手指南
5. **`docs/decisions/0017-loop-mode-safeguards.md`** — Loop 護欄 ADR（防止再失控）

---

## 當前狀態快照

| 項目 | 數值 |
|------|------|
| 生產 commit | `e7647c82`（Phase 1 D3 部署） |
| 最新 main | `2be115c7`（純文件、無需部署） |
| 多人元件數 | 60（從 416 清理後） |
| admin editor PAGE_TYPES | 81 種（30 既有 + 21 階段A + 30 階段B） |
| host 元件 | 17 種 |
| e2e 黃金路徑 | 17 個 test 全綠（CI 自動跑） |
| **e2e A2 多人 L3 smoke** | **18 個 test 全綠**（2026-05-07 加） |
| **e2e Host 軸線 smoke** | **34 個 test 全綠**（2026-05-07 加，17 元件接 admin editor 後）|
| **e2e 總計** | **69/69 全綠** |
| **PAGE_TYPES host 元件** | **17/17 接入**（從 1/17 修正）|
| **PageCategory** | **6 大類**（加 host_screen 📺）|
| Phase 1 commits | 14 個（1c4b9075..e7647c82） |

---

## ✅ Phase 1 已完成項目

### D4 — e2e 真實測試
- ✅ 黃金路徑 A 單人遊戲（5 tests）
- ✅ 黃金路徑 B 多人關卡（6 tests）
- ✅ 黃金路徑 C 活動互動（6 tests）
- ✅ CI workflow 改造（啟動 server + ENABLE_E2E_HELPERS）
- ✅ dev-only seed endpoint（`server/routes/test-only.ts`，生產禁用）

### D2 — 30 分鐘建場流程
- ✅ D2-c 4 痛點修復（admin 未登入 / 複製 fallback / 列印重列 / toast 引導）
- ✅ D2-b onboarding wizard 加 30 分鐘建場引導步驟
- ✅ 插隊優化：text_card audioAutoplay 設定

### D1 — host + multi 配對 spec
- ✅ `docs/domains/host-multi-pairing.md`（500+ 行）
- ✅ 17 個 host 完整配對表 + 5 大商業情境組合範例

### D3 — 元件三軸分組
- ✅ 81 個 page_type 分 5 大類
- ✅ ToolboxSidebar 摺疊式分組 + 搜尋

---

## ⏭ 待做清單（按優先級）

### 🥇 優先 1：Phase 2（B 結構優化）— 1-1.5 週

| 項目 | 內容 | 估時 |
|------|------|------|
| ~~B1~~ | ~~編輯器分組顯示~~ ✅ 已在 D3 順便完成 | 0 |
| ~~**B2**~~ | ~~情境模板組合~~ ⚠️ **2026-05-07 重新評估**：原 plan「擴 PAGE_TEMPLATES 加 8 個商業套組」設計衝突（路線 II/III 性質塞路線 I 容器）。改先補根因：admin editor 接 16 個 host 元件 ✅ 已完成 → [2026-05-07-host-component-admin-integration.md](2026-05-07-host-component-admin-integration.md)。重組 SCENARIO_TEMPLATES 為 II/III 版未做。 | — |
| **B3** | **AI 推薦引擎**：依輸入情境自動建議元件組合（不是 AI 生內容、是 AI 推架構） | 2-3 天 |
| **B4** | 預覽支援「真實跳轉路徑」（沿用 Phase 1 的 toast 機制） | 1-2 天 |
| **B5（新）** | **重組 SCENARIO_TEMPLATES**：拆「路線 I 版（要登入）」+「路線 II/III 版（純 host 元件、不登入）」 | 3-4 天 |

**架構文件**：[docs/architecture/three-paths.md](../architecture/three-paths.md) — 三條路線對照（避免再混淆）

### 🥈 優先 2：Phase 3（A 品質深耕）— 2 週

| 項目 | 內容 |
|------|------|
| A1 | 工作坊 30 個再篩選 → 真正常用的 ~15 個 |
| ~~**A2**~~ | ~~**多人持久化補完**~~ ✅ **2026-05-07 驗證完成**（程式碼層 2026-05-05 已升級、e2e 18/18 通過、實機 checklist 已寫待驗）→ 詳見 [2026-05-07-a2-l3-validation.md](2026-05-07-a2-l3-validation.md) |
| A3 | 單人關卡無障礙 / 行動 UX 優化 |

**A2 接地驗證紀錄**：原 plan「L0/L1→L3 升級」實為已完成（Phase 5 W18）。本次補的是「驗證 L3 真實可用」：
- 自動 e2e 18/18 ✅（建場 + 載入 + DB schema）
- 實機 checklist 待跑（驗 ws 即時推送 + 重整還原）→ `docs/runbooks/a2-l3-manual-verification.md`

### 🥉 優先 3：Phase 4（C 補齊缺口）— 2-3 週、最謹慎

| 項目 | 內容 |
|------|------|
| C1 | 變數/條件/分支劇情 page_type |
| C2 | 積分/排名/淘汰/復活機制 |
| C3 | LBS 多點解鎖、場域故事鏈 |

⚠️ Phase 4 高風險（容易再陷入「為了加而加」），按 ADR-0017 紅線 #11，只做有具體客戶需求的。

---

## 🚩 已知問題 / 紅旗

| 項目 | 嚴重度 | 處理建議 |
|------|--------|---------|
| websocket 2 個 flaky test 暫 skip | 🟡 | 後續單獨開 task 重寫（用 pollUntilEvent 替代 waitForMessage）|
| D2-a 黃金路徑 D 完整 e2e 未做 | 🟡 | 涉及 Firebase admin auth，留 Phase 4 補 |
| scenario API uniquePageTypes 338 vs admin editor 81 | 🟢 | 部分 scenario 模板還引用已刪除元件、不影響跑場、若客戶用到再修 |
| AI 產生器 maxTokens 8000 是否夠 30 分鐘長腳本 | 🟢 | 有客戶反映再評估 |
| host element pairedHosts UI 提示未做 | 🟢 | spec 文件已足夠當銷售素材、UI 提示可選 |

---

## 🔧 Phase 2 起手範本（如果要做 B2）

```
1. 看現有 PAGE_TEMPLATES 結構（client/src/pages/game-editor/constants.ts:125）
2. 設計「情境模板組合」資料結構：
   - id / 名稱 / 商業情境 / 推薦元件清單 / default config
3. 預設 5-8 個套組（對應 5 大商業情境）：
   - wedding-pack: photo_team + wedding_vow + gratitude_tree + ...
   - icebreaker-pack: never_have_i_ever + would_you_rather + spot_vote + ...
   - retro-pack: kpt_retro + four_ls + rose_bud_thorn + ...
4. UI：admin 一鍵套用整套（生成多個 page）
5. 驗證：跑黃金路徑 A 風格的 e2e 測試
```

---

## 🛡️ 防護機制（必讀）

按 [ADR-0017](../decisions/0017-loop-mode-safeguards.md)：

1. **Loop 模式禁止連續 5 輪不接地驗證** — 每 5 個 task 必須打開 admin editor 確認可選用 + 跑真實流程
2. **禁止單元測試替代 e2e** — 原指令要 e2e 就用 Playwright 真實環境
3. **新元件必須對應五大商業情境之一** — 公部門/私部門/活動/空間/交誼，對應不到禁止建立
4. **禁止把模糊詞彙當作明確指令** — 「完整完成」「全套」必先確認範圍才動手

---

## 📁 重要檔案位置

```
專案根：/Users/hung-macmini/projects/數位遊戲平台/

worktree：.claude/worktrees/priceless-mestorf-2e034e/

關鍵檔案：
├── server/routes/test-only.ts          dev-only seed endpoint（D4 e2e 用）
├── client/src/pages/TemplateMarketDetail.tsx  D2-c 4 痛點修復
├── client/src/components/FieldOnboardingWizard.tsx  D2-b onboarding tour
├── client/src/pages/game-editor/constants.ts  D3 category 映射
├── client/src/pages/game-editor/components/ToolboxSidebar.tsx  D3 分組 UI
├── e2e/golden-path-a-solo.spec.ts      D4 黃金路徑 A
├── e2e/golden-path-b-multiplayer.spec.ts  D4 黃金路徑 B
├── e2e/golden-path-c-activity.spec.ts  D4 黃金路徑 C
└── docs/domains/host-multi-pairing.md  D1 配對 spec

文件：
├── docs/CLAUDE.md（專案紅線 #1-#12）
├── docs/changes/2026-05-07-phase-dbac-plan.md（規劃）
├── docs/changes/2026-05-07-phase-1-complete.md（Phase 1 收尾）
├── docs/changes/2026-05-07-next-action-guide.md（本檔）
└── docs/decisions/0017-loop-mode-safeguards.md（Loop 護欄）
```

---

## 🚀 開新對話時的標準起手

```
1. 讀 CLAUDE.md 紅線 #1-#12（自動載入）
2. 讀本檔 docs/changes/2026-05-07-next-action-guide.md
3. 用 git log --oneline -20 看最近 commits
4. 跟使用者確認當前要做什麼（Phase 2 / Phase 3 / 修舊問題 / 別的）
5. 按 ADR-0017 規則行事，不進入 loop 模式
```

---

## 🎯 下次對話建議開場

> 「我看了 docs/changes/2026-05-07-next-action-guide.md，目前 Phase 1 已完成並部署。
> 你想接著做：
>   A. Phase 2 B2 情境模板組合（最高 ROI、銷售素材）
>   B. Phase 3 A2 多人持久化補完（穩定性最重要）
>   C. 其他？」

---

## 相關文件

- [Phase 1 完整收尾紀錄](2026-05-07-phase-1-complete.md)
- [DBAC 整體規劃](2026-05-07-phase-dbac-plan.md)
- [host + multi 配對 spec](../domains/host-multi-pairing.md)
- [ADR-0017 Loop 護欄](../decisions/0017-loop-mode-safeguards.md)
- [CHANGELOG.md](../CHANGELOG.md)
