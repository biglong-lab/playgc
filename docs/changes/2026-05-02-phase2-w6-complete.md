# Phase 2 W6 完整收尾 — 情境模板平台基建（一鍵建場到現場可用）

**日期**：2026-05-02
**範圍**：Phase 2 W6（5 天）— TemplateMarket → Instantiate → 混合情境 → QR 列印 → 收尾
**狀態**：🟢 W6 全部完成、E2E 8 端點 + 11 情境 + QR 列印頁 全綠

---

## 🎯 W6 整體目標

> Phase 2 W5 完成 HostScreen 軸線 10/10 個元件
> Phase 2 W6 補上「銷售工具 + 自動化建場」 — 客戶從看元件變成看情境組合，admin 從手動建多個 game 變成一鍵建場

---

## 📅 5 天時序

### W6 D1（commit `01f0ffbf`）— TemplateMarket 12 情境
- **新增**：`shared/scenario-templates.ts`（12 情境跨軸線、5 大分類）
- **新增**：`/template-market` 公開頁 + `/template-market/:id` 詳情頁
- **新增**：15 個單元測試
- **整合**：ShowcaseHub 加入 TemplateMarket 入口卡
- **設計決策**：與既有 `GAME_TEMPLATES` 並存（不硬塞 host 進 wizard）

### W6 D2（commit `cba7b5b3`）— Pure-host 一鍵建場
- **新增**：後端 `POST /api/admin/scenarios/:id/instantiate`
- **限制**：只支援 pure-host 情境（避免動到 multi/solo）
- **整合**：TemplateMarketDetail 加 admin 一鍵建場卡 + 結果 Dialog
- **預設 config**：10 個 host 元件提供合理預設值
- **安全**：requireAdminAuth + game:create + 場域隔離

### W6 D3（commit `af919703`）— 混合情境支援
- **移除限制**：所有 11 個情境都可以一鍵建場
- **擴充**：13 個 multi 元件 + shared 元件預設 config
- **axis-aware**：host → host_session、multi → game (gameMode=team) + publicSlug、solo/shared → game (gameMode=individual) + publicSlug
- **回應 breakdown**：`{ host: N, multi: M, other: K }`
- **前端 axis-aware UI**：依 axis 顯示對應 URL + 中文標籤（大螢幕主控 / 隊伍協作 / 個人闖關 / 通用元件）

### W6 D4（commit `fcbfca58`）— QR 列印頁
- **新增**：`/admin/scenario-qr-print?data=<base64>` 列印頁
- **client side QR**：用 `qrcode` 套件即時產生（不過 server roundtrip）
- **A4 列印**：每張 QR 一頁、漸層底色依 axis 區分
- **Dialog 整合**：「列印 QR」按鈕 → 新分頁打開列印頁
- **base64 encoding**：`btoa(unescape(encodeURIComponent(json)))` 處理中文字元

### W6 D5（本次）— 收尾 + 完整 walkthrough
- **新增**：`docs/runbooks/scenario-launch.md` admin 操作 SOP
- **新增**：W6 完整收尾文件（這份）
- **更新**：CHANGELOG W6 整體區段
- **E2E 完整流程驗證**

---

## 📊 成果統計

### 新增程式碼
| 檔案 | 角色 | 行數 |
|------|------|------|
| `shared/scenario-templates.ts` | 12 情境資料 + helpers | 449 |
| `shared/__tests__/scenario-templates.test.ts` | 15 個測試 | 117 |
| `client/src/pages/TemplateMarket.tsx` | 情境市集列表頁 | 195 |
| `client/src/pages/TemplateMarketDetail.tsx` | 情境詳情頁 + 一鍵建場 + 列印整合 | 350+ |
| `client/src/pages/ScenarioQrPrint.tsx` | QR 列印頁 | 240+ |
| `server/routes/scenarios.ts` | instantiate endpoint | 280+ |

**總計**：6 個新檔、約 1,600+ 行新程式碼

### 商業流程改造

**Before W6**：
- admin 看 ShowcaseHub 看單一元件 demo（25 個 demo 入口）
- admin 自己想：「我這場活動該用哪幾個元件？」
- admin 手動到 `/admin/games` 建 N 個 game → 進 game-editor 配 page → 進 `/admin/host-sessions` 建 host session
- admin 一個個複製 hostUrl + playUrl
- admin 手動產 QR code（外部工具）→ 印出
- **總時間**：約 1 小時 / 一場活動

**After W6**：
- admin 看 TemplateMarket 11 個情境（看標語就知道適合哪種場合）
- admin 點詳情頁看完整介紹（情境 + 元件 + 商業價值）
- admin 點「一鍵建場」 → 後台自動建 N 個 game + session（< 5 秒）
- admin 點「列印 QR」 → 直接 A4 印好（每張 QR 一頁、含元件名稱 + 完整 URL）
- **總時間**：約 10 分鐘 / 一場活動 ⚡ **6× 加速**

---

## 🧪 E2E 端點全綠

```
GET  /showcase                       200 ✅
GET  /template-market                200 ✅（W6 D1）
GET  /template-market/wedding        200 ✅（W6 D1）
GET  /template-market/street-walk    200 ✅（W6 D3 mixed）
GET  /template-market/corporate-training 200 ✅（W6 D3 mixed）
GET  /admin/scenario-qr-print        200 ✅（W6 D4）
GET  /host/:sessionId                200 ✅
GET  /play/:sessionId                200 ✅
GET  /admin/host-sessions            200 ✅
POST /api/admin/scenarios/:id/instantiate  401 ✅ 認證守衛正確
```

---

## 🛡 安全 & 場域隔離

- 所有 instantiate endpoint 強制 admin 認證 + `game:create` 權限
- 場域邊界：一般 admin 只能在自己場域建（fieldId 自動帶入）
- super_admin 可在任意場域建
- hostToken：12 小時 TTL、隨機 16 bytes hex
- 玩家入口：publicSlug（8 字元 lowercase + digits）走既有 `/g/:slug` 邏輯

---

## 💼 商業價值總結

| 維度 | 改變 |
|------|------|
| 銷售簡報 | 從「看 25 個元件 demo」變「看 11 個情境組合」 — 業務語言更直覺 |
| 報價單 | 每個情境內建 valueProposition（NT$ 區間）— 業務直接報價 |
| 客戶端等待 | 從「等 admin 1 小時建場」變「等 10 分鐘」 — 體驗大幅提升 |
| 場場活動 | 重複套用 11 種情境 + 自訂內容 — 平台化規模可達 |
| 客戶留存 | 場域長期訂閱情境模板使用 — recurring revenue |

---

## ⏭ Phase 2 W7-W8 規劃

### W7 — 業務化 + Phase 2 商業驗證
- 客戶 onboarding 流程簡化（first-time wizard）
- ShowcaseHub 改版（深化 demo 影片連結）
- 第 12 個情境補位（ChildrenAdventure 兒童冒險 / NeighborhoodFair 鄰里園遊會）
- 第一場真實付費活動（婚禮或破冰，搜集回饋）

### W8 — Phase 2 收尾
- 整批 E2E 測試（用 Playwright）
- ShowcaseHub + TemplateMarket 性能優化
- Phase 2 整體文件 + 客戶銷售簡報模板

---

## 🔗 相關文件

- [W6 D1 TemplateMarket](2026-05-02-phase2-w6-d1-template-market.md)
- [W6 D2 Scenario Instantiate](2026-05-02-phase2-w6-d2-scenario-instantiate.md)
- [W6 D3 混合情境支援](2026-05-02-phase2-w6-d3-mixed-scenarios.md)
- [W6 D4 QR 列印頁](2026-05-02-phase2-w6-d4-qr-print.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
- [W5 HostScreen 軸線完成](2026-05-02-phase2-w5-host-axis-complete.md)
- [ADR-0004 HostScreen 軸線](../decisions/0004-host-screen-axis.md)
- [多人元件平台主計畫](2026-05-02-multiplayer-component-platform.md)
