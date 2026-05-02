# Phase 2 W7 D1 — 業務化首發（第 12 情境補位 + 主頁業務入口）

**日期**：2026-05-02
**範圍**：W7 D1、4 個檔案、新增 1 個情境 + 主頁入口條帶
**狀態**：🟢 W7 D1 完成、12 情境全部 live、主頁業務入口上線

---

## 🎯 目標達成

> Phase 2 W6 完成「12 情境模板平台基建」，但只做了 11 個（社交 / 活動 / 公部門 / 私部門 / 空間 各補滿）
> Phase 2 W7 D1 補上第 12 個 + 強化主頁的業務銷售動線

---

## 📦 新增

### 1. 第 12 情境：`kids-adventure` 親子冒險

**分類**：social
**標語**：尋寶任務 + 拼圖協作 + 應援池

**元件組合**：
| 元件 | 軸線 | 角色 |
|------|------|------|
| treasure_hunt | multi | 親子一起找線索、解謎 |
| jigsaw_puzzle | multi | 孩子貼拼圖、家長拍照 |
| host_emoji_react | host | 終點應援池 |

**適用情境**：
- 百貨親子節活動
- 親子館主題日
- 主題樂園定點互動
- 暑期夏令營
- 兒童節市集

**商業價值**：親子市場高黏著度 + 日常常駐 + 節慶包裝。NT$ 8,000-25,000 / 場 + 月訂閱。

**為什麼選這個情境補位**：
- 12 情境清單原本 W6 D1 預留 1 個保留位
- 親子市場 = 大宗 B2B（百貨、親子館）+ 高黏著度
- 元件組合是混合情境（multi + host）— 展示 W6 D3 的混合一鍵建場能力
- 替私部門 / 社交分類延伸到「家庭」次群

### 2. 主頁業務入口（FieldEntry.tsx）

在 FieldEntry 末段（玩家流程之後）新增「主辦方入口」區塊：

```
For Event Organizers
辦活動的人？
我們有 12 個預組好的情境模板：婚禮、園遊會、街區走讀、企業內訓、
員工旅遊、親子冒險...
選一個套用，10 分鐘搞定建場 + QR 列印

[ 🌟 瀏覽 12 情境模板 ]    [ 先看單一元件試玩 ]
```

**設計理由**：
- 不污染玩家動線（放在「選擇場域」之後）
- 主辦方一進主頁也能看見 — 提升轉換率
- 漸層底色（primary/5）視覺強調
- 雙 CTA：直接看情境 OR 先看元件試玩

### 3. 測試擴充

`shared/__tests__/scenario-templates.test.ts`：
- 期望 12 個情境（≥ 12）
- 親子冒險必含 TreasureHunt + JigsawPuzzle + EmojiReact
- 16/16 測試全部通過

---

## 🔢 12 情境完整清單

| # | ID | 名稱 | 分類 | Status |
|---|----|------|------|--------|
| 1 | wedding | 婚禮派對 | social | live |
| 2 | birthday | 生日派對 | social | live |
| 3 | reunion | 同學會 | social | live |
| **4** | **kids-adventure** | **親子冒險** ⭐ | **social** | **live** |
| 5 | carnival-stage | 園遊會主舞台 | event | live |
| 6 | icebreaker | 破冰熱場 | event | live |
| 7 | awards-ceremony | 頒獎典禮 | event | preview |
| 8 | street-walk | 街區走讀 | public | live |
| 9 | district-checkin | 商圈打卡 | public | preview |
| 10 | corporate-training | 企業內訓 | corporate | live |
| 11 | company-trip | 員工旅遊 | corporate | preview |
| 12 | venue-storyline | 場域故事 | venue | live |

**12 情境全部上線** ✅

---

## 🚀 部署 + E2E

- TypeScript：零錯誤 ✅
- 測試：16/16 scenario tests ✅
- Vite build：成功 ✅
- 部署目標：`https://game.homi.cc`
- E2E 端點：12 情境詳情頁全部 200 + 主頁顯示新業務入口

---

## ⏭ 下一步：W7 D2-D5

- W7 D2：ShowcaseHub 改版 — 加入情境跳轉、元件詳情頁
- W7 D3：客戶 onboarding 流程（首次主辦方引導）
- W7 D4：第一個付費情境的 demo 影片連結
- W7 D5：W7 收尾、客戶簡報模板

---

## 🔗 相關文件

- [W6 完整收尾](2026-05-02-phase2-w6-complete.md)
- [Runbook 情境啟動 SOP](../runbooks/scenario-launch.md)
