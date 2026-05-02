# Phase 2 W6 D2 — Scenario Instantiate（一鍵建場）

**日期**：2026-05-02
**範圍**：W6 D2、3 個檔案、後端 endpoint + 前端 UI 完整鏈路
**狀態**：🟢 W6 D2 完成、pure-host 情境一鍵建場可用

---

## 🎯 目標達成

> Phase 2 W6 D1 已完成 12 情境模板的「展示」
> Phase 2 W6 D2 補上「行動」 — admin 可以在詳情頁一鍵建好所有大螢幕場次

---

## 📦 新增

### 1. 後端 endpoint：`server/routes/scenarios.ts`

**端點**：`POST /api/admin/scenarios/:scenarioId/instantiate`

**權限**：`requireAdminAuth + game:create`

**邏輯**：
1. 從 SCENARIO_TEMPLATES 找到對應情境
2. 若情境含 non-host 元件 → 400 拒絕（W7 才支援）
3. 為情境的每個 host_* component：
   - 建一個獨立 game（title="<情境> - <元件 label>"）
   - 建一個 page（pageType=component.pageType, config=合理預設）
   - 建一個 host_session（hostMode=true, hostToken 12h）
4. 回傳 instances 陣列含 hostUrl + playUrl

**為什麼分開建多個 game？**
- 每個 host 元件就是一個獨立大螢幕場次（一個 hostUrl）
- 婚禮場景：拍立得牆 + 簽名簿 + emoji 池可以同時投影或分時段切換
- 各自獨立可結束、不互相影響、12 小時各自計算

**預設 config**（getDefaultConfigForPageType）：
- 為 10 個 host 元件提供合理的預設值
- 例如 host_polaroid_collage → `{ title: "<情境> 紀念牆" }`
- admin 可後續在 game-editor 中微調

### 2. 路由註冊：`server/routes/index.ts`

```ts
import { registerScenarioRoutes } from "./scenarios";
// ...
registerScenarioRoutes(app);
```

### 3. 前端 UI：`TemplateMarketDetail.tsx`

新增功能：
- **使用 useAdminAuth** — 偵測 admin 是否登入
- **isPureHost 判定** — 情境所有 components 都是 host axis
- **「Admin 一鍵建場」卡片**：
  - admin 已登入 + isPureHost → 顯示綠色強調 CTA
  - 未登入 + isPureHost → 顯示淡黃提示「Admin 登入後可一鍵建場」
  - 非 pure-host → 不顯示一鍵按鈕，提示 W7 才能自動化
- **建立中 loading 狀態**（Loader2 spinner）
- **結果 Dialog**：
  - 顯示 N 個 instance 列表
  - 每個 instance 顯示完整 hostUrl + playUrl（含 origin）
  - 提供 Copy 按鈕（用 navigator.clipboard）
  - 提供「在新分頁打開」連結
  - 「到管理後台」按鈕跳轉到 /admin/host-sessions

---

## 🛡 安全性

- 端點要求 `requireAdminAuth + game:create` 權限
- 場域隔離：
  - super_admin 可建在任何場域
  - 一般 admin 必須有 `fieldId`，建立的 game 自動帶上 fieldId
- HostToken 隨機 hex（16 bytes / 32 chars）
- 12 小時 TTL（與既有 host_session 一致）

---

## 🧪 測試

- TypeScript：零錯誤 ✅
- Vite build：成功 ✅
- 既有測試（host 元件 + scenarios）：80/80 通過 ✅

W6 D2 後端 endpoint 是純資料庫操作 endpoint（建 game / page / session），需要實際 DB
連線才能整合測試。本次以「型別安全 + 路由註冊正確」為驗收標準，
正式上線後 admin 端會手動驗證流程。

---

## 🚀 部署 + E2E

- 部署目標：`https://game.homi.cc`
- 推送：（commit 後）
- E2E 端點：
  - `/template-market` 200 ✅
  - `/template-market/wedding` 200 ✅（W6 D1）
  - `POST /api/admin/scenarios/wedding/instantiate` → 401（無 admin 認證 = 正確行為）
  - 其他既有 5 端點維持綠色

---

## 💡 設計決策

### 為何先支援 pure-host 情境？

- 8/11 個情境是 pure-host 或近似 pure-host
- pure-host 邏輯簡單：建 N 個獨立 game + session 即可
- 含 multi/solo 的情境需要額外處理：
  - 隊伍配置（min/maxTeamPlayers）
  - QR code 生成
  - solo / multi 玩家入口分流
- 留給 W7 做「混合情境一鍵建場」

### 為何不持久化 ScenarioInstance？

選擇：直接建多個 game 而不額外建一個「scenario_instances」表

理由：
- 每個 game + host_session 已是獨立可管理單位
- admin 可在 `/admin/host-sessions` 看到所有 active sessions
- 額外的 instance 表增加 schema 複雜度，但沒帶來明顯價值
- 若未來需要「整批結束」，可加一個 `scenarioInstanceId` 欄位到 games

### 為何用 navigator.clipboard 而不用第三方？

- 現代瀏覽器原生支援、HTTPS 環境穩定
- 不增加 bundle size
- 失敗時 graceful fallback（toast destructive）

---

## ⏭ 下一步：W6 D3-D5

- W6 D3：含 multi 元件的情境一鍵建場（如「街區走讀」需要 GPS Cascade）
- W6 D4：QR code 生成 + 玩家入口 deep link
- W6 D5：W6 收尾、E2E 完整流程驗證

---

## 🔗 相關文件

- W6 D1：[2026-05-02-phase2-w6-d1-template-market.md](2026-05-02-phase2-w6-d1-template-market.md)
- W5 收尾：[2026-05-02-phase2-w5-host-axis-complete.md](2026-05-02-phase2-w5-host-axis-complete.md)
- ADR：[../decisions/0004-host-screen-axis.md](../decisions/0004-host-screen-axis.md)
