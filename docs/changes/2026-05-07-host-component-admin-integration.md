# 補接 16 個 host 元件到 admin editor — 2026-05-07

> 範圍：B2 重做（從 PAGE_TEMPLATES 商業套組 → 改先補根因問題）
> 狀態：✅ 程式碼層 + e2e smoke 完成、PAGE_TYPES 17/17 接入
> 部署：尚未部署（待使用者明確指示）

---

## 背景

[next-action-guide.md](2026-05-07-next-action-guide.md) 列 Phase 2 B2「情境模板組合」為最高 ROI 任務。原 plan：擴 PAGE_TEMPLATES 加「婚禮收尾包 / 破冰套組」等商業套組。

**接地調查發現設計衝突**：
- PAGE_TEMPLATES 屬路線 I（要登入要組隊）
- 但「婚禮 / 破冰 / 頒獎」本應屬路線 II/III（玩家匿名互動）
- 把路線 II/III 性質的內容塞進路線 I 容器 → 客戶用「破冰套組」建出來的 game 玩家還是要登入 → 違反現場活動本意

**進一步盤點發現根因**：
- codebase 有 17 個 host 元件（client/src/components/game/host/）
- HostPageRenderer 17/17 都有 case
- SCENARIO_TEMPLATES 用到 14/17
- **admin editor PAGE_TYPES 只有 1/17**（只有 host_word_cloud）
- **admin 想自由建含 host 元件的 game 時、99% 選不到**

→ 這是 SCENARIO_TEMPLATES 商業情境包 91% 元件是 multi 軸（要登入）的根因：admin editor 沒有 host 元件可選、只能用 multi。

---

## 影響範圍

| 模組 | 變動 |
|------|------|
| `client/src/pages/game-editor/constants.ts` | +28 行：16 個 PAGE_TYPES + 17 個 PAGE_TYPE_CATEGORY 映射 + 加 PageCategory 第 6 類 host_screen |
| `client/src/pages/game-editor/getDefaultConfig.ts` | +120 行：16 個 case |
| `server/routes/test-only.ts` | seed-multi-game-with-page 支援 host 軸（gameMode=individual + hostMode=true）|
| `e2e/host-components-smoke.spec.ts` | 新增：17 元件 × 2 test = 34 個 smoke |
| `docs/architecture/three-paths.md` | 新增：三條路線架構文件 |

---

## 解決方案

### B2 方向修正
原：擴 PAGE_TEMPLATES 加 8 個商業套組（誤把路線 II/III 塞路線 I）
改：**先補接 16 個 host 元件到 admin editor**（根因）

### PageCategory 從 5 類擴 6 類
新增 `host_screen` 📺（ADR-0004 host 軸線、無需玩家登入）：
- 跟既有 5 類（narrative / mission / photo / multi_coop / interactive）並列
- ToolboxSidebar UI 自動分組（既有 D3 機制）

### 視覺區分
- 賈村風 / 多人協作元件：「👥」標尾
- host 軸元件：「📺」標尾（明確區分大螢幕主控）
- host_word_cloud 從 multi_coop 改 host_screen（屬第三軸不是隊伍協作）

### 17 個 host 元件分組
| 分類 | 元件 |
|------|------|
| 即時互動類 | host_poll_live, host_emoji_react, host_wave_response, host_crowd_gather |
| 競賽類 | host_trivia_showdown, host_live_leaderboard, host_team_battle_score, host_progress_quest |
| 紀念類 | host_polaroid_collage, host_guestbook_digital, host_blessing_wall |
| 場域/活動類 | host_knowledge_map, host_scoreboard_announcement, host_lottery_wheel, host_bingo_board, host_micro_qa, host_word_cloud |

---

## 實作步驟

### `66170476` — 補 PAGE_TYPES + getDefaultConfig
- 16 個 PAGE_TYPES 條目（含 icon / color / label）
- 16 個 getDefaultConfig case（schema 來源 *Config interface）
- PageCategory 加第 6 類 host_screen
- groupPageTypesByCategory 順序：narrative → mission → photo → multi_coop → host_screen → interactive

### `3fdf9db3` — e2e smoke 接地驗證
- 擴 test-only.ts seed-multi-game-with-page 支援 host_* pageType（gameMode=individual + hostMode=true）
- 新增 e2e/host-components-smoke.spec.ts：17 × 2 = 34 個 test
- 所有 test 跑過：載入不崩潰 + DB 驗收正確

---

## 驗證

### 自動 e2e（本地接地驗證）

```bash
ENABLE_E2E_HELPERS=true npm run dev
npx playwright test --grep "黃金路徑|A2 多人元件|Host 軸線"
```

結果：
- 黃金路徑（Phase 1 D4）：17/17 ✅
- A2 多人元件（2026-05-07）：18/18 ✅
- Host 軸線（本次新加）：34/34 ✅
- **總計 69/69 全綠**

### 待實機驗證
admin editor UI 體驗：
- [ ] 開 admin editor → 開 ToolboxSidebar → 看到第 6 類「📺 大螢幕主控」
- [ ] 點開該分類 → 看到 17 個 host 元件可選
- [ ] 拖入任一 host 元件到 game → default config 不為空
- [ ] 玩家端 /play/:sessionId 能看到該元件渲染

---

## 已知限制 / 後續優化

1. **SCENARIO_TEMPLATES 元件分布還是 91% multi**：本次只動 admin editor、沒重組情境包。下一步可重組（路線 II/III 純 host 版 vs 路線 I 完整版）
2. **host_session 機制 + admin 自建 game**：admin 用新接入的 host 元件建 game 後、需走 host_session 流程才能讓玩家匿名進入。如要支援「直接掃 QR 玩」、需擴充 session 建立流程
3. **大螢幕 token 簽發**：目前 host_session token 透過 SCENARIO_TEMPLATES instantiate 簽發；如要支援 admin 自建後也能簽 token、需加 admin UI 入口

---

## 相關文件

- [三條路線架構](../architecture/three-paths.md) — 本次新建
- [ADR-0004 HostScreen 第三軸線](../decisions/0004-host-screen-axis.md)
- [next-action-guide](2026-05-07-next-action-guide.md)
- [A2 L3 驗證紀錄](2026-05-07-a2-l3-validation.md)
- [自動 e2e spec](../../e2e/host-components-smoke.spec.ts)
