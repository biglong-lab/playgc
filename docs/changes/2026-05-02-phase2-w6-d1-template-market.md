# Phase 2 W6 D1 — TemplateMarket 12 情境模板（公開市集首發）

**日期**：2026-05-02
**範圍**：W6 D1 一天、3 個新檔、15 個單元測試、新增 2 個公開頁路由
**狀態**：🟢 W6 D1 完成、12 個情境骨架就位、E2E 6 端點全綠

---

## 🎯 目標達成

> Phase 2 W5 完成 HostScreen 軸線 10/10
> Phase 2 W6 開始進入「情境模板市集」 — 讓客戶不用看單一元件，而是看「完整情境組合」

---

## 📦 新增

### 1. `shared/scenario-templates.ts`（情境資料）

新建 SCENARIO_TEMPLATES 與 GAME_TEMPLATES 並存：

| 比較 | GAME_TEMPLATES | SCENARIO_TEMPLATES |
|------|----------------|---------------------|
| 範圍 | 單一 game session | 跨軸線情境包（含 host + multi + solo）|
| 用途 | game-wizard 建立遊戲 | 銷售工具、業務簡報 |
| 軸線 | 只有 solo / multi | 全部（含 host）|
| 結構 | pages 流程 | components 列表 + value proposition |

**12 情境（5 大分類）**：

| # | ID | 名稱 | 分類 | 狀態 |
|---|----|------|------|------|
| 1 | wedding | 婚禮派對情境包 | social | live |
| 2 | birthday | 生日派對情境包 | social | live |
| 3 | reunion | 同學會 / 聚會情境包 | social | live |
| 4 | carnival-stage | 園遊會主舞台 | event | live |
| 5 | icebreaker | 破冰熱場情境包 | event | live |
| 6 | awards-ceremony | 頒獎典禮情境包 | event | preview |
| 7 | street-walk | 街區走讀情境包 | public | live |
| 8 | district-checkin | 商圈打卡情境包 | public | preview |
| 9 | corporate-training | 企業內訓情境包 | corporate | live |
| 10 | company-trip | 員工旅遊情境包 | corporate | preview |
| 11 | venue-storyline | 場域故事情境包 | venue | live |

> 11 個就位 + 1 個 W6 W7 補上（如「兒童冒險」或「市集街區」）

每個情境都有：
- `tagline`（一句話描述）
- `description`（多段描述）
- `useCases`（具體適用情境舉例）
- `components`（含 pageType / role / axis / demoMode）
- `valueProposition`（商業價值描述、收費區間）

### 2. `client/src/pages/TemplateMarket.tsx`（情境市集列表頁）

公開頁 `/template-market`，按 5 大分類陳列所有情境。
每張卡片顯示：名稱 + 標語 + 玩家數 + 時長 + 元件清單 + 商業價值。

### 3. `client/src/pages/TemplateMarketDetail.tsx`（單一情境詳情頁）

公開頁 `/template-market/:scenarioId`，呈現：
- Hero（名稱 + 描述 + 適用人數時長）
- 適用情境（逐條列出）
- 元件組合（依 axis 分類顯示，含試玩連結到 ShowcaseHub）
- 商業價值（強調收費區間）
- CTA（試玩元件 / 建大螢幕場次）

### 4. ShowcaseHub 整合

在「5 大商業情境」之上新增 TemplateMarket 入口卡片：
- 漸層底色 primary/10 → primary/5
- 大按鈕 `🎯 瀏覽 12 情境模板`

「5 大商業情境」改為簡介，導引至 `/template-market` 看完整版。

### 5. App.tsx 路由

```tsx
<Route path="/template-market/:scenarioId" component={TemplateMarketDetail} />
<Route path="/template-market" component={TemplateMarket} />
```

兩條都是公開頁（無 `ProtectedAdminRoute`）。

---

## 🧪 測試

`shared/__tests__/scenario-templates.test.ts` — **15/15 通過**：

- 至少 11 個情境
- ID 不重複
- 必要欄位完整
- 狀態合法
- 分類合法
- axis 合法
- 5 大分類都有 label
- 婚禮模板必含 PolaroidCollage / GuestbookDigital / EmojiReact
- 園遊會主舞台必含 TriviaShowdown / LiveLeaderboard
- 街區走讀必含 GpsCascade + KnowledgeMap
- getScenarioById 找/找不到
- getScenariosByCategory 各類數量

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署目標：`https://game.homi.cc`
- E2E 端點驗證：
  - `/showcase` 200 ✅
  - `/template-market` 200 ✅（W6 新）
  - `/template-market/wedding` 200 ✅（W6 新）
  - `/host/test` 200 ✅
  - `/play/test` 200 ✅
  - `/admin/host-sessions` 200 ✅

---

## 💡 設計決策

### 為何不複用 GAME_TEMPLATES？

GAME_TEMPLATES 用 `pages: TemplatePageConfig[]` 模型，假設玩家循序闖關。
但 host 元件不是「闖關」，而是「全場同時互動」 — 沒有「下一頁」概念。

如果硬塞進 GAME_TEMPLATES，要分流：
- 有 host_* 的 template → 不能走 wizard
- 沒 host_* 的 template → 走 wizard

維護負擔反而更大。獨立 SCENARIO_TEMPLATES 直接清楚分工。

### 為何先做 demo 不做「一鍵建立」？

W6 D1 範圍：先讓客戶**看到**情境包的可能。
Phase 2 W7 規劃：自動化建立流程（一鍵建 host session + 玩家入口 + 預設配置）。

先有銷售工具，再做後台自動化 — 業務優先。

### 為何放公開頁不放 admin 後台？

情境市集 = **銷售工具**。
- 給未登入訪客看：「我能用這個來辦活動嗎？」
- 給 admin 看：「我等下要建什麼？」

統一公開頁兩端通吃，且能讓 SEO / 分享連結受益。

---

## ⏭ 下一步：W6 D2-D5

- W6 D2：自動化建場（一鍵套用婚禮模板 → 建 3 個 host session）
- W6 D3：園遊會主舞台 + 街區走讀詳情強化
- W6 D4：企業內訓 + 員工旅遊（私部門首發）
- W6 D5：W6 收尾 + ShowcaseHub 改版（深化 demo）

---

## 🔗 相關文件

- W5 收尾：[2026-05-02-phase2-w5-host-axis-complete.md](2026-05-02-phase2-w5-host-axis-complete.md)
- ADR：[../decisions/0004-host-screen-axis.md](../decisions/0004-host-screen-axis.md)
- 主計畫：[2026-05-02-multiplayer-component-platform.md](2026-05-02-multiplayer-component-platform.md)
