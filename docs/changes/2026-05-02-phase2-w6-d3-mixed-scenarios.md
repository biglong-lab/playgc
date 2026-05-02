# Phase 2 W6 D3 — 混合情境一鍵建場（multi/solo 支援）

**日期**：2026-05-02
**範圍**：W6 D3、後端 endpoint 擴充 + 前端 axis-aware UI
**狀態**：🟢 W6 D3 完成、所有 11 個情境都可一鍵建場

---

## 🎯 目標達成

> Phase 2 W6 D2 已支援 pure-host 情境一鍵建場
> Phase 2 W6 D3 移除 pure-host 限制 — **所有 11 個情境**都可以一鍵建場了

---

## 📦 改動

### 後端 `server/routes/scenarios.ts`

**移除 pure-host 限制**：刪掉 `nonHostComponents` 檢查，所有情境都允許 instantiate。

**ScenarioInstance 介面擴充**：
```ts
interface ScenarioInstance {
  axis: "host" | "multi" | "solo" | "shared";
  gameId: string;
  pageType: string;
  label: string;
  role: string;
  // host 才有：sessionId / hostUrl / playUrl / hostToken
  // multi/solo/shared：gameUrl / publicSlug
}
```

**回應加上 breakdown**：
```ts
{
  totalCreated: 3,
  breakdown: { host: 2, multi: 1, other: 0 },
  ...
}
```

**`getDefaultConfigForPageType` 大幅擴充** — 支援：
- 10 個 host 元件（D2 既有）
- 13 個 multi 元件（W6 D3 新增）：gps_cascade / treasure_hunt / jigsaw_puzzle / collective_score / role_assign / photo_team / vote_team / shooting_team / gps_team_mission / lock_coop / relay_mission / territory_capture / choice_verify_race
- shared 元件：dialogue / text_card / video

每個元件都有合理預設值，admin 後續可在 game-editor 微調。

**`getGameModeForComponent`**：依 axis 推導 gameMode：
- `multi` → `team`
- `solo` / `shared` → `individual`

**`instantiateComponent` 邏輯分流**：
- `isHost` → 建 game (gameMode=individual) + page + host_session（既有邏輯）
- 非 host → 建 game (gameMode=multi/individual) + page + 產生 publicSlug
  - 玩家入口：`/g/<slug>`

### 前端 `TemplateMarketDetail.tsx`

**移除 isPureHost 守衛**：admin 對所有情境都可看到「一鍵建場」按鈕。

**結果 Dialog 增強**：
- 顯示 breakdown badges（📺 大螢幕 × N / 👥 隊伍 × M / 👤 其他 × K）
- `InstanceRow` 依 axis 顯示對應 URL：
  - `host` → 顯示「大螢幕」+ 「玩家」雙網址
  - `multi/solo/shared` → 顯示「玩家入口」單網址
- Badge 顯示 axis 中文標籤（大螢幕主控 / 隊伍協作 / 個人闖關 / 通用元件）+ 對應底色

**新增 `UrlRow` 元件**：抽取 URL 顯示樣板，避免重複。

---

## 🧪 驗收

| 情境 | 元件數 | host / multi / solo |
|------|--------|---------------------|
| 婚禮派對 | 3 | 3 / 0 / 0 |
| 同學會 | 3 | 3 / 0 / 0 |
| 街區走讀 | 3 | 2 / 1 / 0 |
| 商圈打卡 | 3 | 2 / 1 / 0 |
| 企業內訓 | 3 | 2 / 1 / 0 |
| 員工旅遊 | 3 | 1 / 2 / 0 |
| 場域故事 | 3 | 1 / 1 / 1 |

11 個情境全部可一鍵建場 ✅

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 部署目標：`https://game.homi.cc`
- E2E 端點：6 既有 + instantiate POST 401 認證守衛維持綠色

---

## 💡 設計決策

### 為何不用單一 game 包多個 page？

選擇：每個元件建獨立 game，而非單一 game 含 N 個 pages

理由：
- 每個元件是獨立場次/任務，可以分時段啟用/結束
- host 元件需要獨立 host_session，不能合併（共用 hostToken）
- 玩家流程：host 元件透過 /play/:sessionId 直接到該元件，不走 page chain
- multi/solo 元件透過 /g/:slug 進入，可走既有 game player 流程

### 為何給每個 multi 元件獨立 publicSlug？

選擇：N 個 multi 元件 = N 個 game = N 個 publicSlug

理由：
- 每個 multi 元件是獨立任務，玩家可以選擇參加哪些
- 街區走讀的 GpsCascade 不應和拍立得牆綁在一起
- admin 可以分別管理每個 game 的隊伍 / 設定

### multi 元件的隊伍 / QR / 玩家分流誰處理？

W6 D3 範圍：建好 game + page + slug 即可，玩家進入後走既有 game player 流程
- 玩家進入 /g/<slug> → 既有的 game lobby/team-formation 邏輯
- 隊伍機制由既有 game player 處理（minTeamPlayers / maxTeamPlayers）

W6 D4 規劃：補上 QR code 自動生成 + Dialog 顯示 QR 圖（讓 admin 直接列印貼出去）。

---

## ⏭ 下一步：W6 D4-D5

- W6 D4：QR code 生成（每個 instance 都有 QR）+ 列印頁
- W6 D5：W6 收尾、E2E 完整流程驗證

---

## 🔗 相關文件

- W6 D2：[2026-05-02-phase2-w6-d2-scenario-instantiate.md](2026-05-02-phase2-w6-d2-scenario-instantiate.md)
- W6 D1：[2026-05-02-phase2-w6-d1-template-market.md](2026-05-02-phase2-w6-d1-template-market.md)
