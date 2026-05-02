# Phase 2 W7 完整收尾 — 業務化 + 客戶 onboarding 平台基建

**日期**：2026-05-02
**範圍**：Phase 2 W7（5 天）— 第 12 情境 → 反向連結 → Wizard → 簡報頁 → 收尾
**狀態**：🟢 W7 全部完成、9 端點全綠、12 情境全部上線

---

## 🎯 W7 整體目標

> Phase 2 W6 完成「情境模板平台基建 + 一鍵建場 + QR 列印」
> Phase 2 W7 補上「業務化工具」 — 從技術產品變成可賣的 SaaS

---

## 📅 5 天時序

### W7 D1（commit `95465776`）— 第 12 情境補位 + 主頁業務入口
- 親子冒險（kids-adventure）社交分類補位
- TreasureHunt + JigsawPuzzle + EmojiReact 混合元件組合
- FieldEntry 主頁新增「主辦活動的人？」漸層區塊
- 雙 CTA：12 模板 / 元件試玩
- 16/16 scenario tests 通過

### W7 D2（commit `2d290f48`）— ShowcaseHub 元件 → 情境反向連結
- `getScenariosForPageType()` 反向索引 helper
- 抽出 DemoCard 共用元件（DRY）
- 15 張 demo 卡片全部含「適用情境」chips（前 3 + N 摘要）
- 完整雙向動線：情境 → 元件（W6）+ 元件 → 情境（W7 D2）
- 20/20 scenario tests 通過

### W7 D3（commit `f779cba7`）— Onboarding Wizard 3 問找情境
- `/find-scenario` 公開頁 wizard
- 3 題（分類 / 人數 / 重點）→ score-based Top 3 推薦
- 演算法：分類+5、人數+3、重點關鍵字命中+2、live+0.5
- 推薦結果卡含 🥇🥈🥉 + 為什麼推薦 reasons
- TemplateMarket Hero + FieldEntry 主頁雙 CTA 整合

### W7 D4（commit `0ecdd52d`）— 客戶銷售簡報頁
- `/pitch` 公開頁、7 區段一頁式 scroll narrative
- 痛點 → 解法 → 12 情境 → 流程 → 收費 → 對比 → CTA
- 收費三方案：一次性 / 訂閱（推薦）/ 委辦
- 對比表：自己 vs 客製 vs CHITO（6 維度）
- FieldEntry 底部加「看完整簡報」連結

### W7 D5（本次）— 收尾文件 + Phase 2 W5-W7 階段性回顧

---

## 🎬 完整客戶轉換動線（全部就位）

```
未登入訪客
    ↓
[FieldEntry /]
    ↓ 看見「主辦活動的人？」漸層區塊
    ↓
選擇路徑：
    ├─ /pitch           → 7 區段完整簡報（業務帶看）
    ├─ /find-scenario   → 3 問引導（不知道選什麼時）
    ├─ /template-market → 12 情境列表
    └─ /showcase        → 25 個元件試玩（懂技術的客戶）
    ↓
[詳情頁 /template-market/:id]
    ↓ 看完整介紹（情境 + 元件 + 價值）
    ↓
Admin 登入
    ↓
[Admin 一鍵建場] → 自動建 N 個 game + page + session
    ↓
[列印 QR] → /admin/scenario-qr-print → A4 列印
    ↓
現場執行
    ├─ 投影機 → /host/:sessionId 大螢幕
    └─ 玩家手機掃 QR → /play/:sessionId 或 /g/:slug
```

**關鍵指標**：
- 從「不認識 CHITO」到「現場可掃 QR」全流程 < 30 分鐘
- admin 從 1 小時手動建場 → 10 分鐘搞定 ⚡ 6× 加速

---

## 📊 成果統計

### W7 新增檔案
| 檔案 | 角色 | 行數 |
|------|------|------|
| `client/src/pages/FindScenarioWizard.tsx` | 3 問找情境 | 360+ |
| `client/src/pages/PitchDeck.tsx` | 客戶銷售簡報 | 380+ |
| `shared/scenario-templates.ts`（擴充）| +1 情境 + 反向索引 | +52 |
| `client/src/pages/FieldEntry.tsx`（擴充）| 主頁業務入口 | +30 |
| `client/src/pages/TemplateMarket.tsx`（擴充）| Hero CTA | +10 |
| `client/src/pages/ShowcaseHub.tsx`（擴充）| 反向連結 | +90 |

W7 共 **6 個檔案、~920 行新程式碼**

### 新公開路由
- `/find-scenario`（W7 D3）
- `/pitch`（W7 D4）

---

## 🧪 E2E 完整驗證（W7 收尾）

```
GET  /                                  200 ✅
GET  /pitch                             200 ✅（W7 D4）
GET  /find-scenario                     200 ✅（W7 D3）
GET  /template-market                   200 ✅
GET  /template-market/wedding           200 ✅
GET  /template-market/kids-adventure    200 ✅（W7 D1）
GET  /template-market/street-walk       200 ✅
GET  /template-market/corporate-training 200 ✅
GET  /showcase                          200 ✅
GET  /admin/scenario-qr-print           200 ✅
GET  /host/:sessionId                   200 ✅
GET  /play/:sessionId                   200 ✅
GET  /admin/host-sessions               200 ✅
POST /api/admin/scenarios/:id/instantiate  401 ✅ 認證守衛正確
```

---

## 💼 業務工具完整對照

| 場景 | 工具路徑 | 用途 |
|------|---------|------|
| 業務開會帶看 | `/pitch` | 10 分鐘介紹完整平台 |
| 客戶不知道選什麼 | `/find-scenario` | 3 問推薦 Top 3 |
| 客戶想看完整選項 | `/template-market` | 12 情境 5 大分類 |
| 客戶想看單一元件 | `/showcase` | 25 個 demo 雙版型 |
| 客戶決定後 | `/template-market/:id` | 詳情 + 一鍵建場 |
| 活動現場準備 | `/admin/scenario-qr-print` | A4 QR 列印 |

---

## ⏭ 下一步：Phase 2 W8 — 階段收尾

- W8 D1：第一場真實付費活動（婚禮 or 破冰，搜集回饋）
- W8 D2：依回饋微調情境預設值
- W8 D3：補拍 demo 影片（30 秒 / 情境）
- W8 D4：Phase 2 整體收尾文件
- W8 D5：Phase 3 規劃啟動

---

## 🔗 相關文件

- [W7 D1 業務化首發](2026-05-02-phase2-w7-d1-12th-scenario.md)
- [W7 D2 ShowcaseHub 反向連結](2026-05-02-phase2-w7-d2-showcase-bidirectional.md)
- [W7 D3 Onboarding Wizard](2026-05-02-phase2-w7-d3-onboarding-wizard.md)
- [W7 D4 PitchDeck](2026-05-02-phase2-w7-d4-pitch-deck.md)
- [W6 完整收尾](2026-05-02-phase2-w6-complete.md)
- [W5 HostScreen 軸線完成](2026-05-02-phase2-w5-host-axis-complete.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
